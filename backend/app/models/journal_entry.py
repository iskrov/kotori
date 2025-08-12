from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import LargeBinary
from sqlalchemy.orm import relationship
import uuid

from .base import Base, UUID
from .base import TimestampMixin


class JournalEntry(Base, TimestampMixin):
    __tablename__ = "journal_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, nullable=True)  # Optional title
    content = Column(Text, nullable=True)  # Plaintext for public entries; null when encrypted
    audio_url = Column(String, nullable=True)  # URL to stored audio file (if any)
    entry_date = Column(
        DateTime(timezone=True), nullable=False
    )  # When the entry was recorded

    # Per-user Encryption Fields (secret_tag_id removed in PBI-4 Stage 2)
    encrypted_content = Column(LargeBinary, nullable=True)  # AES-encrypted content for per-user encryption
    wrapped_key = Column(LargeBinary, nullable=True)  # Entry key wrapped with user master key
    encryption_iv = Column(LargeBinary, nullable=True)  # IV for AES encryption
    wrap_iv = Column(LargeBinary, nullable=True)  # IV for key wrapping
    encryption_algorithm = Column(String, nullable=True)  # Algorithm identifier (e.g., AES-GCM)

    # Foreign key to User
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="journal_entries")
    # secret_tag relationship removed in PBI-4 Stage 2
    # Ensure association rows are removed when an entry is deleted
    tags = relationship(
        "JournalEntryTag",
        back_populates="entry",
        cascade="all, delete-orphan",
    )

# Import JournalEntryTag from tag.py to avoid duplicate definition
from .tag import JournalEntryTag
