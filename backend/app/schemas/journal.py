from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


# Base schema for Tag
class TagBase(BaseModel):
    name: str


class TagCreate(TagBase):
    color: Optional[str] = None


class Tag(TagBase):
    id: int
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Base model for journal entries
class JournalEntryBase(BaseModel):
    title: Optional[str] = None
    content: str = ""  # Empty for hidden entries (content encrypted client-side)
    entry_date: Optional[datetime] = None


# Properties to receive on creation
class JournalEntryCreate(JournalEntryBase):
    audio_url: Optional[str] = None
    tags: Optional[List[str]] = []
    
    # OPAQUE Secret Tag support with client-side encryption
    secret_tag_id: Optional[bytes] = None       # Binary tag_id from OPAQUE model
    encrypted_content: Optional[str] = None     # Base64 encoded encrypted content
    wrapped_key: Optional[str] = None           # Entry key wrapped with tag-derived key
    encryption_iv: Optional[str] = None         # Base64 encoded initialization vector
    wrap_iv: Optional[str] = None               # IV for key wrapping
    
    # Timestamps
    created_at: Optional[datetime] = None


# Properties to receive on update
class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    entry_date: Optional[datetime] = None
    audio_url: Optional[str] = None
    tags: Optional[List[str]] = None
    
    # OPAQUE Secret Tag updates
    secret_tag_id: Optional[bytes] = None
    encrypted_content: Optional[str] = None
    wrapped_key: Optional[str] = None
    encryption_iv: Optional[str] = None
    wrap_iv: Optional[str] = None


# Properties shared by models stored in DB
class JournalEntryInDBBase(JournalEntryBase):
    id: int
    audio_url: Optional[str] = None
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # OPAQUE Secret Tag fields
    secret_tag_id: Optional[bytes] = None
    encrypted_content: Optional[str] = None
    wrapped_key: Optional[str] = None
    encryption_iv: Optional[str] = None
    wrap_iv: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Properties to return to client
class JournalEntry(JournalEntryInDBBase):
    tags: List[Tag] = []


# Properties stored in DB
class JournalEntryInDB(JournalEntryInDBBase):
    pass


# Response for secret tag entries (with encryption metadata)
class SecretTagJournalEntry(JournalEntryInDBBase):
    """
    Response schema for secret tag entries.
    Contains encrypted content that can only be decrypted client-side.
    """
    tags: List[Tag] = []
    
    model_config = ConfigDict(from_attributes=True)


# Schema for bulk operations
class JournalEntryBulkResponse(BaseModel):
    entries: List[JournalEntry]
    total_count: int
    has_more: bool
    
    
# Schema for search results
class JournalEntrySearchResponse(BaseModel):
    entries: List[JournalEntry]
    search_term: str
    total_matches: int
