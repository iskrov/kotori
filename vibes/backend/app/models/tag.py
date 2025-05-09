from sqlalchemy import Column
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import relationship

from .base import Base
from .base import TimestampMixin


class Tag(Base, TimestampMixin):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)

    # Relationships
    entries = relationship("JournalEntryTag", back_populates="tag")


class JournalEntryTag(Base):
    __tablename__ = "journal_entry_tags"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)

    # Relationships
    entry = relationship("JournalEntry", back_populates="tags")
    tag = relationship("Tag", back_populates="entries")
