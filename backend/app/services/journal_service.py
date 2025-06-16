from datetime import date, datetime
from typing import Any, List, Optional
import logging

from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload # Import joinedload for eager loading

from ..core.config import settings
from ..models.journal_entry import JournalEntry as JournalEntryModel
from ..models.tag import JournalEntryTag
from ..models.tag import Tag as TagModel
from ..schemas.journal import JournalEntry, JournalEntryCreate, JournalEntryUpdate
from ..schemas.journal import Tag as TagSchema
from ..schemas.journal import TagCreate
from .base import BaseService
from .session_service import session_service

logger = logging.getLogger(__name__)


class JournalService(BaseService[JournalEntryModel, JournalEntryCreate, JournalEntryUpdate]):
    def get(self, db: Session, id: Any) -> JournalEntryModel | None:
        """
        Get a single journal entry by ID as SQLAlchemy model, with tags eagerly loaded.
        This is used internal to the service layer when we need the actual model instance.
        """
        db_obj = (
            db.query(self.model)
            .options(joinedload(self.model.tags).joinedload(JournalEntryTag.tag))
            .filter(self.model.id == id)
            .first()
        )
        return db_obj

    def get_schema(self, db: Session, id: Any) -> JournalEntry | None:
        """
        Get a single journal entry by ID as a Pydantic schema, with tags correctly formatted.
        ⚠️  ZERO-KNOWLEDGE: Returns encrypted content as-is for client-side decryption.
        """
        db_obj = self.get(db, id)
        if not db_obj:
            return None

        # Manually construct the Pydantic response model
        orm_tags = [assoc.tag for assoc in db_obj.tags]
        schema_tags = [TagSchema.from_orm(tag_orm_obj) for tag_orm_obj in orm_tags]

        # ✅ ZERO-KNOWLEDGE: Return encrypted content as-is
        # Client will handle decryption if user has proper keys
        content = db_obj.encrypted_content if db_obj.encrypted_content else db_obj.content

        return JournalEntry(
            id=db_obj.id,
            title=db_obj.title,
            content=content,  # Encrypted or plaintext - server doesn't decrypt
            entry_date=db_obj.entry_date,
            audio_url=db_obj.audio_url,
            user_id=db_obj.user_id,
            created_at=db_obj.created_at,
            updated_at=db_obj.updated_at,
            tags=schema_tags,
        )

    def get_multi_by_user(
        self,
        db: Session,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        start_date: date | None = None,
        end_date: date | None = None,
        tags: list[str] | None = None,
        include_hidden: bool = False,  # Client controls visibility
    ) -> list[JournalEntry]: # Return type is now list of Pydantic schemas
        """
        Get multiple journal entries by user_id with optional filtering.
        ✅ ZERO-KNOWLEDGE: Server doesn't decrypt - returns encrypted blobs only.
        """
        query = (
            db.query(JournalEntryModel)
            .filter(JournalEntryModel.user_id == user_id)
            .options(joinedload(JournalEntryModel.tags).joinedload(JournalEntryTag.tag)) # Fixed relationship name
        )

        # ✅ ZERO-KNOWLEDGE: Let client decide what to show
        # Server doesn't have hidden mode concept anymore - secret tags handle privacy
        # No filtering needed here - client will filter by secret tags

        # Fix date filtering to handle date vs datetime comparison
        if start_date:
            # Convert date to datetime at start of day
            start_datetime = datetime.combine(start_date, datetime.min.time())
            query = query.filter(JournalEntryModel.entry_date >= start_datetime)
        if end_date:
            # Convert date to datetime at end of day (23:59:59.999999)
            end_datetime = datetime.combine(end_date, datetime.max.time())
            query = query.filter(JournalEntryModel.entry_date <= end_datetime)

        if tags and len(tags) > 0:
            tag_subquery = (
                db.query(JournalEntryTag.entry_id)
                .join(TagModel)
                .filter(TagModel.name.in_(tags))
                .distinct()
            )
            query = query.filter(JournalEntryModel.id.in_(tag_subquery))

        query = query.order_by(JournalEntryModel.entry_date.desc())
        db_journal_entries = query.offset(skip).limit(limit).all()

        # Manually construct Pydantic response models to ensure correct structure
        response_entries: list[JournalEntry] = []
        for db_entry in db_journal_entries:
            # ✅ ZERO-KNOWLEDGE: Return content as-is
            # Client will handle decryption for secret tag entries
            content = db_entry.encrypted_content if db_entry.encrypted_content else db_entry.content
            
            # Extract ORM tags from the association
            orm_tags = [assoc.tag for assoc in db_entry.tags]
            # Convert ORM tags to TagSchema instances
            schema_tags = [TagSchema.from_orm(tag_orm_obj) for tag_orm_obj in orm_tags]
            
            # Create the JournalEntry Pydantic model
            response_entry = JournalEntry(
                id=db_entry.id,
                title=db_entry.title,
                content=content,  # Encrypted or plaintext - server doesn't know the difference
                entry_date=db_entry.entry_date,
                audio_url=db_entry.audio_url,
                user_id=db_entry.user_id,
                created_at=db_entry.created_at,
                updated_at=db_entry.updated_at,
                tags=schema_tags
            )
            response_entries.append(response_entry)
        
        return response_entries

    def create_tag(self, db: Session, *, tag_in: TagCreate, user_id: int) -> TagModel:
        """Create a new tag."""
        # Tags are not user-specific in this model, but we check for existence.
        tag_obj = db.query(TagModel).filter(TagModel.name == tag_in.name).first()
        if tag_obj:
            raise ValueError("Tag with this name already exists")
            
        tag_obj = TagModel(**tag_in.model_dump())
        db.add(tag_obj)
        db.commit()
        db.refresh(tag_obj)
        return tag_obj

    def update_tag(
        self, db: Session, *, tag_id: int, tag_in: TagSchema, user_id: int
    ) -> TagModel:
        """Update a tag."""
        tag_obj = db.query(TagModel).get(tag_id)
        if not tag_obj:
            raise ValueError("Tag not found")
        
        update_data = tag_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(tag_obj, field, value)
            
        db.add(tag_obj)
        db.commit()
        db.refresh(tag_obj)
        return tag_obj

    def delete_tag(self, db: Session, *, tag_id: int, user_id: int) -> TagModel:
        """Delete a tag."""
        tag_obj = db.query(TagModel).get(tag_id)
        if not tag_obj:
            raise ValueError("Tag not found")
            
        db.delete(tag_obj)
        db.commit()
        return tag_obj

    def create_with_user(
        self, db: Session, *, obj_in: JournalEntryCreate, user_id: int
    ) -> JournalEntry:  # Change return type to JournalEntry schema
        """
        Create a new journal entry with user_id and process tags.
        ✅ ZERO-KNOWLEDGE: Accepts pre-encrypted content from client.
        """
        # Extract tags
        tag_names = obj_in.tags or []
        obj_data = obj_in.model_dump(exclude={"tags"})

        # ✅ ZERO-KNOWLEDGE: Store content as provided by client
        # Client handles encryption for secret tag entries
        obj_data["user_id"] = user_id
        
        # Create the journal entry
        db_journal_entry = JournalEntryModel(**obj_data)
        db.add(db_journal_entry)
        db.flush()  # Get the ID

        # Process tags if any
        if tag_names:
            self._update_tags(db, db_journal_entry, tag_names)

        db.commit()
        db.refresh(db_journal_entry)

        # Convert to schema and return
        orm_tags = [assoc.tag for assoc in db_journal_entry.tags]
        schema_tags = [TagSchema.from_orm(tag_orm_obj) for tag_orm_obj in orm_tags]

        return JournalEntry(
            id=db_journal_entry.id,
            title=db_journal_entry.title,
            content=db_journal_entry.encrypted_content if db_journal_entry.encrypted_content else db_journal_entry.content,
            entry_date=db_journal_entry.entry_date,
            audio_url=db_journal_entry.audio_url,
            user_id=db_journal_entry.user_id,
            created_at=db_journal_entry.created_at,
            updated_at=db_journal_entry.updated_at,
            tags=schema_tags,
        )

    def update(
        self,
        db: Session,
        *,
        db_obj: JournalEntryModel,
        obj_in: JournalEntryUpdate | dict[str, Any],
    ) -> JournalEntry:  # Change return type to JournalEntry schema
        """
        Update a journal entry, including its tags
        """
        # Extract tags if present
        tag_names = None
        if isinstance(obj_in, dict):
            tag_names = obj_in.pop("tags", None)
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
            tag_names = update_data.pop("tags", None)
            obj_in = update_data

        # Update the journal entry
        db_obj = super().update(db, db_obj=db_obj, obj_in=obj_in)

        # Update tags if provided
        if tag_names is not None:
            self._update_tags(db, db_obj, tag_names)
            db.refresh(db_obj)

        # Load the tags to ensure they're available
        db.refresh(db_obj)
        
        # Manually construct the response with properly formatted tags
        orm_tags = [assoc.tag for assoc in db_obj.tags]
        schema_tags = [TagSchema.from_orm(tag_orm_obj) for tag_orm_obj in orm_tags]
        
        # Create and return a JournalEntry schema
        return JournalEntry(
            id=db_obj.id,
            title=db_obj.title,
            content=db_obj.content,
            entry_date=db_obj.entry_date,
            audio_url=db_obj.audio_url,
            user_id=db_obj.user_id,
            created_at=db_obj.created_at,
            updated_at=db_obj.updated_at,
            tags=schema_tags
        )

    def _update_tags(
        self, db: Session, journal_entry: JournalEntryModel, tag_names: list[str]
    ) -> None:
        """
        Update tags for a journal entry based on a list of tag names.
        """
        # Clear existing tag associations for this journal entry
        current_associations = db.query(JournalEntryTag).filter(
            JournalEntryTag.entry_id == journal_entry.id
        ).all()
        for assoc in current_associations:
            db.delete(assoc)
        db.commit()

        # Add new tags and associations
        processed_tags = []
        for tag_name_str in tag_names:
            # Get or create tag
            tag_orm_obj = db.query(TagModel).filter(TagModel.name == tag_name_str).first()
            if not tag_orm_obj:
                tag_orm_obj = TagModel(name=tag_name_str)
                db.add(tag_orm_obj)
                db.commit()
                db.refresh(tag_orm_obj)
            
            # Create the association if it doesn't already exist (e.g. after clearing)
            entry_tag_assoc = JournalEntryTag(entry_id=journal_entry.id, tag_id=tag_orm_obj.id)
            db.add(entry_tag_assoc)
            processed_tags.append(tag_orm_obj)
        
        # Commit all new associations
        db.commit()

    def get_tags_by_user(self, db: Session, *, user_id: int) -> list[TagModel]:
        """
        Get all tags (tags are global, not user-specific)
        """
        # Return all tags since they are global in this system
        return db.query(TagModel).all()

    # Legacy static methods removed - use instance methods instead






# Create singleton instance
journal_service = JournalService(JournalEntryModel)
