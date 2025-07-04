from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


# Reminder frequency enum
class ReminderFrequency(str, Enum):
    DAILY = "daily"
    WEEKDAYS = "weekdays"
    WEEKENDS = "weekends"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


# Base model for reminders
class ReminderBase(BaseModel):
    title: str
    message: str
    frequency: ReminderFrequency
    time: datetime
    is_active: bool = True
    custom_days: str | None = None  # CSV of days (1-7) for custom schedules


# Properties to receive via API on creation
class ReminderCreate(ReminderBase):
    pass


# Properties to receive via API on update
class ReminderUpdate(ReminderBase):
    pass


# Properties shared by models stored in DB
class ReminderInDBBase(ReminderBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Additional properties to return via API
class Reminder(ReminderInDBBase):
    pass


# Additional properties stored in DB
class ReminderInDB(ReminderInDBBase):
    pass
