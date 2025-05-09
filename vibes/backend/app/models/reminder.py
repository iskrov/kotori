import enum

from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import relationship

from .base import Base
from .base import TimestampMixin


class ReminderFrequency(str, enum.Enum):
    DAILY = "daily"
    WEEKDAYS = "weekdays"
    WEEKENDS = "weekends"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class Reminder(Base, TimestampMixin):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    frequency = Column(Enum(ReminderFrequency), nullable=False)
    time = Column(
        DateTime(timezone=True), nullable=False
    )  # Time of day for the reminder
    is_active = Column(Boolean, default=True)

    # For custom frequency
    custom_days = Column(
        String, nullable=True
    )  # CSV of days (1-7) for custom schedules

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="reminders")
