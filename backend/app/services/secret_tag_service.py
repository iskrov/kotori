from typing import List, Optional
import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.secret_tag import SecretTag
from app.models.journal_entry import JournalEntry
from app.schemas.secret_tag import SecretTagCreate, SecretTagUpdate

logger = logging.getLogger(__name__)


class SecretTagService:
    """
    Service for managing secret tags with server-side hash verification.
    
    This service handles CRUD operations for secret tags while maintaining
    the security principle that the server never sees actual secret phrases.
    """

    def create_secret_tag(
        self, 
        db: Session, 
        *, 
        tag_data: SecretTagCreate, 
        user_id: int
    ) -> SecretTag:
        """
        Create a new secret tag with salted phrase hash.
        
        Args:
            db: Database session
            tag_data: Secret tag creation data (includes phrase hash and salt)
            user_id: ID of the user creating the tag
            
        Returns:
            Created SecretTag instance
            
        Raises:
            IntegrityError: If tag name already exists for user
        """
        try:
            # Convert salt from list of integers to bytes
            phrase_salt = bytes(tag_data.phrase_salt)
            
            secret_tag = SecretTag(
                user_id=user_id,
                tag_name=tag_data.tag_name,
                phrase_salt=phrase_salt,
                phrase_hash=tag_data.phrase_hash
            )
            
            db.add(secret_tag)
            db.commit()
            db.refresh(secret_tag)
            
            logger.info(f"Created secret tag '{tag_data.tag_name}' for user {user_id}")
            return secret_tag
            
        except IntegrityError as e:
            db.rollback()
            logger.warning(f"Failed to create secret tag '{tag_data.tag_name}' for user {user_id}: {e}")
            raise ValueError(f"Secret tag '{tag_data.tag_name}' already exists")

    def get_user_secret_tags(self, db: Session, user_id: int) -> List[SecretTag]:
        """
        Get all secret tags for a user.
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            List of SecretTag instances for the user
        """
        tags = db.query(SecretTag).filter(
            SecretTag.user_id == user_id
        ).order_by(SecretTag.created_at.desc()).all()
        
        logger.debug(f"Retrieved {len(tags)} secret tags for user {user_id}")
        return tags

    def get_secret_tag_by_id(
        self, 
        db: Session, 
        tag_id: str, 
        user_id: int
    ) -> Optional[SecretTag]:
        """
        Get a specific secret tag by ID, ensuring it belongs to the user.
        
        Args:
            db: Database session
            tag_id: UUID of the secret tag
            user_id: ID of the user
            
        Returns:
            SecretTag instance if found and belongs to user, None otherwise
        """
        tag = db.query(SecretTag).filter(
            SecretTag.id == tag_id,
            SecretTag.user_id == user_id
        ).first()
        
        if tag:
            logger.debug(f"Retrieved secret tag {tag_id} for user {user_id}")
        else:
            logger.warning(f"Secret tag {tag_id} not found for user {user_id}")
            
        return tag

    def get_secret_tag_by_name(
        self, 
        db: Session, 
        tag_name: str, 
        user_id: int
    ) -> Optional[SecretTag]:
        """
        Get a secret tag by name for a specific user.
        
        Args:
            db: Database session
            tag_name: Name of the secret tag
            user_id: ID of the user
            
        Returns:
            SecretTag instance if found, None otherwise
        """
        tag = db.query(SecretTag).filter(
            SecretTag.tag_name == tag_name,
            SecretTag.user_id == user_id
        ).first()
        
        if tag:
            logger.debug(f"Retrieved secret tag '{tag_name}' for user {user_id}")
        else:
            logger.debug(f"Secret tag '{tag_name}' not found for user {user_id}")
            
        return tag

    def update_secret_tag(
        self, 
        db: Session, 
        *, 
        tag_id: str, 
        tag_update: SecretTagUpdate, 
        user_id: int
    ) -> Optional[SecretTag]:
        """
        Update a secret tag (currently only supports updating phrase hash/salt).
        
        Args:
            db: Database session
            tag_id: UUID of the secret tag
            tag_update: Update data
            user_id: ID of the user
            
        Returns:
            Updated SecretTag instance if successful, None if not found
        """
        tag = self.get_secret_tag_by_id(db, tag_id, user_id)
        if not tag:
            return None
            
        # Update fields if provided
        if tag_update.phrase_hash is not None:
            tag.phrase_hash = tag_update.phrase_hash
            
        if tag_update.phrase_salt is not None:
            tag.phrase_salt = bytes(tag_update.phrase_salt)
            
        db.commit()
        db.refresh(tag)
        
        logger.info(f"Updated secret tag {tag_id} for user {user_id}")
        return tag

    def delete_secret_tag(
        self, 
        db: Session, 
        tag_id: str, 
        user_id: int
    ) -> bool:
        """
        Delete a secret tag and all associated journal entries.
        
        Args:
            db: Database session
            tag_id: UUID of the secret tag
            user_id: ID of the user
            
        Returns:
            True if deleted successfully, False if not found
        """
        tag = self.get_secret_tag_by_id(db, tag_id, user_id)
        if not tag:
            return False
            
        # Count associated entries for logging
        entry_count = db.query(JournalEntry).filter(
            JournalEntry.secret_tag_id == tag_id
        ).count()
        
        # Delete the tag (cascade will delete associated entries)
        db.delete(tag)
        db.commit()
        
        logger.info(
            f"Deleted secret tag '{tag.tag_name}' ({tag_id}) and {entry_count} "
            f"associated entries for user {user_id}"
        )
        return True

    def get_tag_entries(
        self, 
        db: Session, 
        tag_id: str, 
        user_id: int,
        limit: int = 100,
        offset: int = 0
    ) -> List[JournalEntry]:
        """
        Get encrypted journal entries for a specific secret tag.
        
        Args:
            db: Database session
            tag_id: UUID of the secret tag
            user_id: ID of the user
            limit: Maximum number of entries to return
            offset: Number of entries to skip
            
        Returns:
            List of JournalEntry instances for the secret tag
        """
        # Verify tag belongs to user
        tag = self.get_secret_tag_by_id(db, tag_id, user_id)
        if not tag:
            logger.warning(f"Attempted to access entries for non-existent tag {tag_id} by user {user_id}")
            return []
            
        entries = db.query(JournalEntry).filter(
            JournalEntry.secret_tag_id == tag_id,
            JournalEntry.user_id == user_id
        ).order_by(
            JournalEntry.entry_date.desc()
        ).offset(offset).limit(limit).all()
        
        logger.debug(f"Retrieved {len(entries)} entries for secret tag {tag_id}")
        return entries


# Create service instance
secret_tag_service = SecretTagService() 