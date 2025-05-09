from datetime import datetime

from pydantic import BaseModel


# Base schema for Tag
class TagBase(BaseModel):
    name: str


class TagCreate(TagBase):
    pass


class Tag(TagBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Base model for journal entries
class JournalEntryBase(BaseModel):
    title: str | None = None
    content: str
    entry_date: datetime


# Properties to receive on creation
class JournalEntryCreate(JournalEntryBase):
    audio_url: str | None = None
    tags: list[str] | None = []


# Properties to receive on update
class JournalEntryUpdate(JournalEntryBase):
    audio_url: str | None = None
    tags: list[str] | None = []


# Properties shared by models stored in DB
class JournalEntryInDBBase(JournalEntryBase):
    id: int
    audio_url: str | None = None
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Properties to return to client
class JournalEntry(JournalEntryInDBBase):
    tags: list[TagBase] = []


# Properties stored in DB
class JournalEntryInDB(JournalEntryInDBBase):
    pass
