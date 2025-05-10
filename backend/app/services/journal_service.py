from datetime import date
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload # Import joinedload for eager loading

from ..models.journal_entry import JournalEntry as JournalEntryModel
from ..models.tag import JournalEntryTag
from ..models.tag import Tag as TagModel
from ..schemas.journal import JournalEntry, JournalEntryCreate, JournalEntryUpdate
from ..schemas.journal import Tag as TagSchema
from .base import BaseService


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
        This is used for API responses to ensure consistent formatting.
        """
        db_obj = self.get(db, id)
        if not db_obj:
            return None

        # Manually construct the Pydantic response model
        orm_tags = [assoc.tag for assoc in db_obj.tags]
        schema_tags = [TagSchema.from_orm(tag_orm_obj) for tag_orm_obj in orm_tags]

        return JournalEntry(
            id=db_obj.id,
            title=db_obj.title,
            content=db_obj.content,
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
    ) -> list[JournalEntry]: # Return type is now list of Pydantic schemas
        """
        Get multiple journal entries by user_id with optional filtering
        """
        query = (
            db.query(JournalEntryModel)
            .filter(JournalEntryModel.user_id == user_id)
            .options(joinedload(JournalEntryModel.tags).joinedload(JournalEntryTag.tag)) # Fixed relationship name
        )

        if start_date:
            query = query.filter(JournalEntryModel.entry_date >= start_date)
        if end_date:
            query = query.filter(JournalEntryModel.entry_date <= end_date)

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
            # Extract ORM tags from the association
            orm_tags = [assoc.tag for assoc in db_entry.tags]
            # Convert ORM tags to TagSchema instances
            schema_tags = [TagSchema.from_orm(tag_orm_obj) for tag_orm_obj in orm_tags]
            
            # Create the JournalEntry Pydantic model
            response_entry = JournalEntry(
                id=db_entry.id,
                title=db_entry.title,
                content=db_entry.content,
                entry_date=db_entry.entry_date,
                audio_url=db_entry.audio_url,
                user_id=db_entry.user_id,
                created_at=db_entry.created_at,
                updated_at=db_entry.updated_at,
                tags=schema_tags
            )
            response_entries.append(response_entry)
        
        return response_entries

    def create_with_user(
        self, db: Session, *, obj_in: JournalEntryCreate, user_id: int
    ) -> JournalEntry:  # Change return type to JournalEntry schema
        """
        Create a new journal entry with user_id and process tags
        """
        # Extract tags
        tag_names = obj_in.tags or []
        obj_data = obj_in.dict(exclude={"tags"})

        # Create journal entry
        db_obj = JournalEntryModel(**obj_data, user_id=user_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

        # Process tags
        if tag_names:
            self._update_tags(db, db_obj, tag_names)
            db.refresh(db_obj)
            
        # Load the tags to ensure they're available
        db.refresh(db_obj)
        
        # Manually construct the response with properly formatted tags
        # This matches the expected response_model=JournalEntry format
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
            update_data = obj_in.dict(exclude_unset=True)
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
        Get all tags used by a user
        """
        # Find all tag IDs used by this user's journal entries
        tag_ids = (
            db.query(TagModel.id)
            .join(JournalEntryTag)
            .join(JournalEntryModel)
            .filter(JournalEntryModel.user_id == user_id)
            .distinct()
        )

        # Get the tags
        return db.query(TagModel).filter(TagModel.id.in_(tag_ids)).all()


# Create singleton instance
journal_service = JournalService(JournalEntryModel)
