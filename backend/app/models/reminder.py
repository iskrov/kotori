import enum
import uuid

from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import relationship

from .base import Base, UUID
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    frequency = Column(Enum(ReminderFrequency), nullable=False)
    time = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)
    custom_days = Column(String, nullable=True)  # For custom frequency

    # Foreign key to User
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="reminders")
