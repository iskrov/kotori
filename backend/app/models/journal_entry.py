from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import LargeBinary
from sqlalchemy.orm import relationship

from .base import Base, UUID
from .base import TimestampMixin


class JournalEntry(Base, TimestampMixin):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=True)  # Optional title
    content = Column(Text, nullable=False)  # Journal entry content (plaintext for public entries)
    audio_url = Column(String, nullable=True)  # URL to stored audio file (if any)
    entry_date = Column(
        DateTime(timezone=True), nullable=False
    )  # When the entry was recorded

    # New Secret Tag Encryption Fields (server-side hash verification)
    # Temporarily using String(36) to match current database schema (VARCHAR(36))
    # TODO: Create migration to convert to proper UUID type
    secret_tag_id = Column(String(36), ForeignKey("secret_tags.id"), nullable=True, index=True)  # UUID of the secret tag (if any)
    encrypted_content = Column(LargeBinary, nullable=True)  # AES-encrypted content for secret entries
    wrapped_key = Column(LargeBinary, nullable=True)  # Entry key wrapped with phrase-derived key
    encryption_iv = Column(LargeBinary, nullable=True)  # Initialization vector for content encryption
    wrap_iv = Column(LargeBinary, nullable=True)  # IV for key wrapping

    # Legacy Zero-Knowledge Encryption Fields (for backward compatibility)
    encryption_salt = Column(String, nullable=True)  # Per-entry salt for key derivation
    encrypted_key = Column(Text, nullable=True)  # Entry encryption key wrapped with secret tag master key
    key_derivation_iterations = Column(Integer, nullable=True)  # PBKDF2 iterations used
    encryption_algorithm = Column(String, nullable=True)  # Algorithm used (e.g., 'AES-GCM')
    encryption_wrap_iv = Column(String, nullable=True)  # IV used for key wrapping/unwrapping
    secret_tag_hash = Column(String(64), nullable=True, index=True)  # Hash of secret tag for server-side filtering

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="journal_entries")
    tags = relationship("JournalEntryTag", back_populates="entry", cascade="all, delete-orphan")
    secret_tag = relationship("SecretTag", back_populates="journal_entries")
