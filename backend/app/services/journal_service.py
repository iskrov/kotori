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
        content = db_obj.encrypted_content if db_obj.is_hidden else db_obj.content

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
        # Server doesn't have hidden mode concept anymore
        if not include_hidden:
            query = query.filter(JournalEntryModel.is_hidden == False)

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
            # ✅ ZERO-KNOWLEDGE: Return encrypted content as-is for hidden entries
            # Client will decrypt if it has the proper keys
            content = db_entry.encrypted_content if db_entry.is_hidden else db_entry.content
            
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

    def create_with_user(
        self, db: Session, *, obj_in: JournalEntryCreate, user_id: int, is_hidden: bool = False
    ) -> JournalEntry:  # Change return type to JournalEntry schema
        """
        Create a new journal entry with user_id and process tags.
        ✅ ZERO-KNOWLEDGE: Accepts pre-encrypted content from client.
        """
        # Extract tags
        tag_names = obj_in.tags or []
        obj_data = obj_in.dict(exclude={"tags"})

        # ✅ ZERO-KNOWLEDGE: Store content as provided by client
        # If is_hidden=True, content should already be encrypted by client
        obj_data["user_id"] = user_id
        obj_data["is_hidden"] = is_hidden
        
        if is_hidden:
            # Client should send encrypted content in the 'content' field
            # Move to encrypted_content field and clear plaintext
            obj_data["encrypted_content"] = obj_data["content"]
            obj_data["content"] = ""  # No plaintext for hidden entries
        
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
            content=db_journal_entry.encrypted_content if is_hidden else db_journal_entry.content,
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

    @staticmethod
    def create_journal_entry(
        db: Session, 
        entry: JournalEntryCreate, 
        user_id: int
    ) -> JournalEntry:
        """
        Create a new journal entry (regular or hidden with client-side encryption)
        
        For hidden entries, the content should already be encrypted client-side
        and the encrypted_content, encryption_iv, and encryption_salt fields populated.
        """
        try:
            db_entry = JournalEntry(
                title=entry.title,
                content=entry.content,  # Plain text for regular entries, empty for hidden
                user_id=user_id,
                created_at=entry.created_at or datetime.utcnow(),
                is_hidden=entry.is_hidden or False,
                encrypted_content=entry.encrypted_content,  # Client-encrypted content
                encryption_iv=entry.encryption_iv,  # IV used for encryption
                encryption_salt=entry.encryption_salt,  # Salt used for key derivation
                tags=entry.tags
            )
            
            db.add(db_entry)
            db.commit()
            db.refresh(db_entry)
            
            entry_type = "hidden" if db_entry.is_hidden else "regular"
            logger.info(f"Created {entry_type} journal entry with ID: {db_entry.id}")
            
            return db_entry
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create journal entry: {str(e)}")
            raise

    @staticmethod
    def get_journal_entries(
        db: Session, 
        user_id: int, 
        skip: int = 0, 
        limit: int = 100,
        include_hidden: bool = False
    ) -> List[JournalEntry]:
        """
        Get journal entries for a user.
        
        Args:
            db: Database session
            user_id: User ID
            skip: Number of entries to skip
            limit: Maximum number of entries to return
            include_hidden: Whether to include hidden entries in results
        
        Returns:
            List of journal entries (server cannot decrypt hidden content)
        """
        try:
            query = db.query(JournalEntryModel).filter(JournalEntryModel.user_id == user_id)
            
            if not include_hidden:
                # Only return regular entries (non-hidden)
                query = query.filter(JournalEntryModel.is_hidden == False)
            
            entries = query.order_by(JournalEntryModel.created_at.desc()).offset(skip).limit(limit).all()
            
            logger.info(f"Retrieved {len(entries)} journal entries for user {user_id} (include_hidden: {include_hidden})")
            return entries
            
        except Exception as e:
            logger.error(f"Failed to retrieve journal entries: {str(e)}")
            raise

    @staticmethod
    def get_hidden_entries_only(
        db: Session, 
        user_id: int, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[JournalEntry]:
        """
        Get only hidden entries for a user.
        Content will be encrypted and requires client-side decryption.
        """
        try:
            entries = db.query(JournalEntryModel).filter(
                JournalEntryModel.user_id == user_id,
                JournalEntryModel.is_hidden == True
            ).order_by(JournalEntryModel.created_at.desc()).offset(skip).limit(limit).all()
            
            logger.info(f"Retrieved {len(entries)} hidden journal entries for user {user_id}")
            return entries
            
        except Exception as e:
            logger.error(f"Failed to retrieve hidden journal entries: {str(e)}")
            raise

    @staticmethod
    def get_journal_entry_by_id(
        db: Session, 
        entry_id: int, 
        user_id: int
    ) -> Optional[JournalEntry]:
        """Get a specific journal entry by ID and user ID."""
        try:
            entry = db.query(JournalEntryModel).filter(
                JournalEntryModel.id == entry_id,
                JournalEntryModel.user_id == user_id
            ).first()
            
            if entry:
                entry_type = "hidden" if entry.is_hidden else "regular"
                logger.info(f"Retrieved {entry_type} journal entry {entry_id} for user {user_id}")
            else:
                logger.info(f"Journal entry {entry_id} not found for user {user_id}")
            
            return entry
            
        except Exception as e:
            logger.error(f"Failed to retrieve journal entry {entry_id}: {str(e)}")
            raise

    @staticmethod
    def update_journal_entry(
        db: Session, 
        entry_id: int, 
        user_id: int, 
        entry_update: JournalEntryUpdate
    ) -> Optional[JournalEntry]:
        """
        Update a journal entry.
        
        For hidden entries being updated, the new content should be 
        client-side encrypted before being sent to the server.
        """
        try:
            entry = db.query(JournalEntryModel).filter(
                JournalEntryModel.id == entry_id,
                JournalEntryModel.user_id == user_id
            ).first()
            
            if not entry:
                logger.info(f"Journal entry {entry_id} not found for user {user_id}")
                return None
            
            # Update fields that are provided
            update_data = entry_update.dict(exclude_unset=True)
            
            for field, value in update_data.items():
                setattr(entry, field, value)
            
            # Update timestamp
            entry.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(entry)
            
            entry_type = "hidden" if entry.is_hidden else "regular"
            logger.info(f"Updated {entry_type} journal entry {entry_id}")
            
            return entry
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update journal entry {entry_id}: {str(e)}")
            raise

    @staticmethod
    def delete_journal_entry(
        db: Session, 
        entry_id: int, 
        user_id: int
    ) -> bool:
        """Delete a journal entry."""
        try:
            entry = db.query(JournalEntryModel).filter(
                JournalEntryModel.id == entry_id,
                JournalEntryModel.user_id == user_id
            ).first()
            
            if not entry:
                logger.info(f"Journal entry {entry_id} not found for user {user_id}")
                return False
            
            entry_type = "hidden" if entry.is_hidden else "regular"
            
            db.delete(entry)
            db.commit()
            
            logger.info(f"Deleted {entry_type} journal entry {entry_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete journal entry {entry_id}: {str(e)}")
            raise

    @staticmethod
    def search_journal_entries(
        db: Session, 
        user_id: int, 
        search_term: str,
        include_hidden: bool = False
    ) -> List[JournalEntry]:
        """
        Search journal entries by title and content.
        
        Note: Hidden entries cannot be searched by content since it's encrypted.
        Only title can be searched for hidden entries.
        """
        try:
            from sqlalchemy import or_, and_
            
            query = db.query(JournalEntryModel).filter(JournalEntryModel.user_id == user_id)
            
            if include_hidden:
                # For hidden entries, only search title (content is encrypted)
                query = query.filter(
                    or_(
                        and_(
                            JournalEntryModel.is_hidden == False,
                            or_(
                                JournalEntryModel.content.ilike(f"%{search_term}%"),
                                JournalEntryModel.title.ilike(f"%{search_term}%")
                            )
                        ),
                        and_(
                            JournalEntryModel.is_hidden == True,
                            JournalEntryModel.title.ilike(f"%{search_term}%")
                        )
                    )
                )
            else:
                # Regular entries only - search title and content
                query = query.filter(
                    JournalEntryModel.is_hidden == False
                ).filter(
                    or_(
                        JournalEntryModel.content.ilike(f"%{search_term}%"),
                        JournalEntryModel.title.ilike(f"%{search_term}%")
                    )
                )
            
            entries = query.order_by(JournalEntryModel.created_at.desc()).all()
            
            logger.info(f"Found {len(entries)} entries matching search term '{search_term}' for user {user_id}")
            return entries
            
        except Exception as e:
            logger.error(f"Failed to search journal entries: {str(e)}")
            raise

    @staticmethod
    def get_entry_count(db: Session, user_id: int, include_hidden: bool = False) -> int:
        """Get total count of journal entries for a user."""
        try:
            query = db.query(JournalEntryModel).filter(JournalEntryModel.user_id == user_id)
            
            if not include_hidden:
                query = query.filter(JournalEntryModel.is_hidden == False)
            
            count = query.count()
            
            logger.info(f"User {user_id} has {count} journal entries (include_hidden: {include_hidden})")
            return count
            
        except Exception as e:
            logger.error(f"Failed to count journal entries: {str(e)}")
            raise


# Create singleton instance
journal_service = JournalService(JournalEntryModel)
