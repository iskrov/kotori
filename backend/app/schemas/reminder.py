from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from ..models.reminder import ReminderFrequency


# Shared properties
class ReminderBase(BaseModel):
    title: str
    message: str
    frequency: ReminderFrequency
    time: datetime
    is_active: bool = True
    custom_days: Optional[str] = None


# Properties to receive on creation
class ReminderCreate(ReminderBase):
    user_id: Optional[UUID] = None


# Properties to receive on update
class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    frequency: Optional[ReminderFrequency] = None
    time: Optional[datetime] = None
    is_active: Optional[bool] = None
    custom_days: Optional[str] = None


# Properties shared by models stored in DB
class ReminderInDBBase(ReminderBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Properties to return to client
class Reminder(ReminderInDBBase):
    pass


# Properties stored in DB
class ReminderInDB(ReminderInDBBase):
    pass
