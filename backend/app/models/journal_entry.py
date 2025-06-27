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

    # OPAQUE Secret Tag Encryption Fields
    secret_tag_id = Column(LargeBinary(16), ForeignKey("secret_tags.tag_id"), nullable=True, index=True)  # OPAQUE tag_id
    encrypted_content = Column(LargeBinary, nullable=True)  # AES-encrypted content for secret entries
    wrapped_key = Column(LargeBinary, nullable=True)  # Entry key wrapped with phrase-derived key
    encryption_iv = Column(LargeBinary, nullable=True)  # Initialization vector for content encryption
    wrap_iv = Column(LargeBinary, nullable=True)  # IV for key wrapping

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="journal_entries")
    tags = relationship("JournalEntryTag", back_populates="entry", cascade="all, delete-orphan")
    secret_tag = relationship("SecretTag", back_populates="journal_entries")
