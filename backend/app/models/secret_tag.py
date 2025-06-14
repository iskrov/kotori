from sqlalchemy import Column, Integer, String, LargeBinary, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base
from .base import TimestampMixin


class SecretTag(Base, TimestampMixin):
    """
    Secret Tag model for server-side hash verification.
    
    Stores tag metadata and salted phrase hashes for verification,
    but never stores the actual secret phrases or decrypted content.
    """
    __tablename__ = "secret_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tag_name = Column(String(100), nullable=False)
    phrase_salt = Column(LargeBinary, nullable=False)  # 32-byte salt for Argon2
    phrase_hash = Column(String(255), nullable=False)  # Argon2 hash of phrase

    # Relationships
    user = relationship("User", back_populates="secret_tags")
    journal_entries = relationship("JournalEntry", back_populates="secret_tag", cascade="all, delete-orphan")

    # Unique constraint on user_id + tag_name
    __table_args__ = (
        {"extend_existing": True},
    )

    def __repr__(self):
        return f"<SecretTag(id={self.id}, user_id={self.user_id}, tag_name='{self.tag_name}')>" 