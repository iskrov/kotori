from datetime import datetime
from typing import Optional, List, Union
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


# Base schema for Tag
class TagBase(BaseModel):
    name: str
    color: Optional[str] = None


class TagCreate(TagBase):
    pass


class Tag(TagBase):
    id: UUID
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Base schema for JournalEntry
class JournalEntryBase(BaseModel):
    title: Optional[str] = None
    content: str
    entry_date: datetime
    tags: List[str] = []  # List of tag names


# Properties to receive on creation
class JournalEntryCreate(JournalEntryBase):
    audio_url: Optional[str] = None
    
    # OPAQUE Secret Tag fields for encrypted entries
    secret_tag_id: Optional[bytes] = None
    encrypted_content: Optional[str] = None
    wrapped_key: Optional[str] = None
    encryption_iv: Optional[str] = None
    wrap_iv: Optional[str] = None


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
    id: UUID
    audio_url: Optional[str] = None
    user_id: UUID
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


# Secret phrase authentication response
class SecretPhraseAuthResponse(BaseModel):
    """Response for secret phrase authentication"""
    success: bool
    message: str
    session_token: Optional[str] = None
    secret_entries: List[JournalEntry] = []
    
    model_config = ConfigDict(from_attributes=True)


# Secret tag journal entry schema
class SecretTagJournalEntry(BaseModel):
    """Schema for journal entries associated with secret tags"""
    id: UUID
    title: Optional[str] = None
    content: str  # Encrypted content
    entry_date: datetime
    secret_tag_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# Journal entry creation response
class JournalEntryCreateResponse(BaseModel):
    """Response schema for journal entry creation"""
    entry: JournalEntry
    message: str
    
    model_config = ConfigDict(from_attributes=True)


# Journal entry deletion response
class JournalEntryDeleteResponse(BaseModel):
    """Response schema for journal entry deletion"""
    message: str
    deleted_entry_id: UUID
    
    model_config = ConfigDict(from_attributes=True)


# Journal entry count response
class JournalEntryCountResponse(BaseModel):
    """Response schema for journal entry count"""
    total_entries: int
    include_hidden: bool
    user_id: UUID
    
    model_config = ConfigDict(from_attributes=True)


# Bulk response for journal entries
class JournalEntryBulkResponse(BaseModel):
    """Response schema for bulk journal entry operations"""
    entries: List[JournalEntry]
    total_count: int
    has_more: bool
    
    model_config = ConfigDict(from_attributes=True)


# Search response for journal entries
class JournalEntrySearchResponse(BaseModel):
    """Response schema for journal entry search"""
    entries: List[JournalEntry]
    search_term: str
    total_matches: int
    
    model_config = ConfigDict(from_attributes=True)


# Hidden journal entry schema
class HiddenJournalEntry(BaseModel):
    """Schema for hidden journal entries with encrypted content"""
    id: UUID
    title: Optional[str] = None
    encrypted_content: str
    encryption_iv: str
    entry_date: datetime
    user_id: UUID
    secret_tag_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
