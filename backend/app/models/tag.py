from sqlalchemy import Column
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import relationship
import uuid

from .base import Base, UUID
from .base import TimestampMixin


class Tag(Base, TimestampMixin):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)  # Uniqueness handled by table constraint
    color = Column(String, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Relationships
    entries = relationship("JournalEntryTag", back_populates="tag")
    user = relationship("User", back_populates="tags")

    # Table constraints
    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='unique_user_tag'),
        {"extend_existing": True},
    )


class JournalEntryTag(Base):
    __tablename__ = "journal_entry_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    entry_id = Column(UUID(as_uuid=True), ForeignKey("journal_entries.id"), nullable=False)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("tags.id"), nullable=False)

    # Relationships
    entry = relationship("JournalEntry", back_populates="tags")
    tag = relationship("Tag", back_populates="entries")

    __table_args__ = (
        {"extend_existing": True},
    )
