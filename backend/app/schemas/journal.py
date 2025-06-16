from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


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

    class Config:
        from_attributes = True


# Base model for journal entries
class JournalEntryBase(BaseModel):
    title: Optional[str] = None
    content: str = ""  # Empty for hidden entries (content encrypted client-side)
    entry_date: Optional[datetime] = None


# Properties to receive on creation
class JournalEntryCreate(JournalEntryBase):
    audio_url: Optional[str] = None
    tags: Optional[List[str]] = []
    
    # Secret tag support with client-side encryption
    secret_tag_id: Optional[int] = None      # ID of secret tag for this entry
    secret_tag_hash: Optional[str] = None    # Hash of secret tag for verification
    encrypted_content: Optional[str] = None  # Base64 encoded encrypted content
    encryption_iv: Optional[str] = None      # Base64 encoded initialization vector
    encryption_salt: Optional[str] = None    # Base64 encoded salt for key derivation
    encrypted_key: Optional[str] = None      # Entry key wrapped with master key
    key_derivation_iterations: Optional[int] = None  # PBKDF2 iterations
    encryption_algorithm: Optional[str] = None       # Encryption algorithm
    encryption_wrap_iv: Optional[str] = None         # IV for key wrapping
    
    # Timestamps
    created_at: Optional[datetime] = None


# Properties to receive on update
class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    entry_date: Optional[datetime] = None
    audio_url: Optional[str] = None
    tags: Optional[List[str]] = None
    
    # Secret tag updates
    secret_tag_id: Optional[int] = None
    secret_tag_hash: Optional[str] = None
    encrypted_content: Optional[str] = None
    encryption_iv: Optional[str] = None
    encryption_salt: Optional[str] = None
    encrypted_key: Optional[str] = None
    key_derivation_iterations: Optional[int] = None
    encryption_algorithm: Optional[str] = None
    encryption_wrap_iv: Optional[str] = None


# Properties shared by models stored in DB
class JournalEntryInDBBase(JournalEntryBase):
    id: int
    audio_url: Optional[str] = None
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Secret tag fields
    secret_tag_id: Optional[int] = None
    secret_tag_hash: Optional[str] = None
    encrypted_content: Optional[str] = None
    encryption_iv: Optional[str] = None
    encryption_salt: Optional[str] = None
    encrypted_key: Optional[str] = None
    key_derivation_iterations: Optional[int] = None
    encryption_algorithm: Optional[str] = None
    encryption_wrap_iv: Optional[str] = None

    class Config:
        from_attributes = True


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
    
    class Config:
        from_attributes = True


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
