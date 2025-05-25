from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy.orm import relationship

from .base import Base
from .base import TimestampMixin


class JournalEntry(Base, TimestampMixin):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=True)  # Optional title
    content = Column(Text, nullable=False)  # Journal entry content (plaintext for non-hidden)
    audio_url = Column(String, nullable=True)  # URL to stored audio file (if any)
    entry_date = Column(
        DateTime(timezone=True), nullable=False
    )  # When the entry was recorded

    # Zero-Knowledge Encryption Fields
    is_hidden = Column(Boolean, nullable=False, default=False)  # Whether entry is hidden/encrypted
    encrypted_content = Column(Text, nullable=True)  # Encrypted version of content when hidden
    encryption_iv = Column(String, nullable=True)  # Initialization vector for encryption
    encryption_salt = Column(String, nullable=True)  # Per-entry salt for key derivation
    encrypted_key = Column(Text, nullable=True)  # Entry encryption key wrapped with master key
    key_derivation_iterations = Column(Integer, nullable=True)  # PBKDF2 iterations used
    encryption_algorithm = Column(String, nullable=True)  # Algorithm used (e.g., 'AES-GCM')
    encryption_wrap_iv = Column(String, nullable=True)  # IV used for key wrapping/unwrapping

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="journal_entries")
    tags = relationship("JournalEntryTag", back_populates="entry", cascade="all, delete-orphan")
