from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, validator
import uuid


class SecretTagBase(BaseModel):
    """Base schema for secret tag data."""
    tag_name: str = Field(..., min_length=1, max_length=100, description="Name of the secret tag")
    color_code: str = Field(default='#007AFF', pattern=r'^#[0-9A-Fa-f]{6}$', description="Hex color code for UI")


class SecretTagCreate(SecretTagBase):
    """Schema for creating a new secret tag."""
    phrase: str = Field(..., min_length=1, max_length=255, description="Raw secret phrase (will be hashed server-side)")
    
    # Internal fields used by the service layer (not part of the API)
    phrase_salt: Optional[List[int]] = Field(None, description="32-byte salt as list of integers for Argon2 hashing")
    phrase_hash: Optional[str] = Field(None, min_length=1, max_length=255, description="Argon2 hash of the secret phrase")
    
    @validator('phrase_salt')
    def validate_salt_length(cls, v):
        if v is not None:
            if len(v) != 32:
                raise ValueError('phrase_salt must be exactly 32 bytes')
            if not all(0 <= byte <= 255 for byte in v):
                raise ValueError('phrase_salt must contain valid byte values (0-255)')
        return v


class SecretTagUpdate(BaseModel):
    """Schema for updating a secret tag."""
    phrase_salt: Optional[List[int]] = Field(None, description="New 32-byte salt as list of integers")
    phrase_hash: Optional[str] = Field(None, min_length=1, max_length=255, description="New Argon2 hash")
    color_code: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', description="New hex color code for UI")
    
    @validator('phrase_salt')
    def validate_salt_length(cls, v):
        if v is not None:
            if len(v) != 32:
                raise ValueError('phrase_salt must be exactly 32 bytes')
            if not all(0 <= byte <= 255 for byte in v):
                raise ValueError('phrase_salt must contain valid byte values (0-255)')
        return v


class SecretTagResponse(SecretTagBase):
    """Schema for secret tag responses (excludes sensitive data)."""
    id: uuid.UUID = Field(..., description="Unique identifier for the secret tag")
    user_id: int = Field(..., description="ID of the user who owns this tag")
    phrase_salt: List[int] = Field(..., description="32-byte salt as list of integers for phrase verification")
    color_code: str = Field(..., description="Hex color code for UI")
    created_at: datetime = Field(..., description="When the tag was created")
    updated_at: datetime = Field(..., description="When the tag was last updated")
    
    class Config:
        from_attributes = True
        
    @validator('phrase_salt', pre=True)
    def convert_salt_to_list(cls, v):
        """Convert bytes salt to list of integers for JSON serialization."""
        if isinstance(v, bytes):
            return list(v)
        return v


class SecretTagListResponse(BaseModel):
    """Schema for listing secret tags."""
    tags: List[SecretTagResponse] = Field(..., description="List of secret tags")
    total: int = Field(..., description="Total number of tags")


class PhraseVerificationRequest(BaseModel):
    """Schema for verifying a secret phrase against stored hash."""
    phrase: str = Field(..., min_length=1, description="Secret phrase to verify")
    tag_id: uuid.UUID = Field(..., description="ID of the secret tag to verify against")


class PhraseVerificationResponse(BaseModel):
    """Schema for phrase verification response."""
    is_valid: bool = Field(..., description="Whether the phrase matches the stored hash")
    tag_name: str = Field(..., description="Name of the verified tag")


class SecretTagStatsResponse(BaseModel):
    """Schema for secret tag statistics."""
    tag_id: uuid.UUID = Field(..., description="ID of the secret tag")
    tag_name: str = Field(..., description="Name of the secret tag")
    entry_count: int = Field(..., description="Number of journal entries with this tag")
    created_at: datetime = Field(..., description="When the tag was created")
    last_used: Optional[datetime] = Field(None, description="When the tag was last used for an entry") 