from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import relationship

from .base import Base
from .base import TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth users
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    # OAuth information
    google_id = Column(String, unique=True, nullable=True)
    profile_picture = Column(String, nullable=True)

    # Relationships
    journal_entries = relationship("JournalEntry", back_populates="user")
    reminders = relationship("Reminder", back_populates="user")
    secret_tags = relationship("SecretTag", back_populates="user", cascade="all, delete-orphan")
