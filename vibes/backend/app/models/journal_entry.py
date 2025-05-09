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
    content = Column(Text, nullable=False)  # Journal entry content
    audio_url = Column(String, nullable=True)  # URL to stored audio file (if any)
    entry_date = Column(
        DateTime(timezone=True), nullable=False
    )  # When the entry was recorded

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="journal_entries")
    tags = relationship("JournalEntryTag", back_populates="entry")
