"""
Vault Blob Storage Schemas

This module defines Pydantic schemas for vault blob storage operations,
including upload, download, listing, and management of encrypted content.
"""

import base64
from datetime import datetime
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class ContentTypeEnum(str, Enum):
    """Supported content types for vault blobs"""
    TEXT = "text/plain"
    JSON = "application/json"
    AUDIO_MP3 = "audio/mpeg"
    AUDIO_WAV = "audio/wav"
    AUDIO_M4A = "audio/mp4"
    IMAGE_JPEG = "image/jpeg"
    IMAGE_PNG = "image/png"
    BINARY = "application/octet-stream"


class VaultBlobUploadRequest(BaseModel):
    """
    Request schema for uploading encrypted content to a vault.
    
    Contains the encrypted blob data and metadata needed for storage.
    All encryption is performed client-side using vault keys.
    """
    
    ciphertext: str = Field(
        ...,
        description="Base64-encoded encrypted content (AES-GCM)",
        min_length=1
    )
    
    iv: str = Field(
        ...,
        description="Base64-encoded initialization vector (12 bytes)",
        min_length=1
    )
    
    auth_tag: str = Field(
        ...,
        description="Base64-encoded authentication tag (16 bytes)",
        min_length=1
    )
    
    content_type: str = Field(
        default=ContentTypeEnum.BINARY,
        description="MIME type of the original content"
    )
    
    content_size: int = Field(
        ...,
        description="Size of the original (unencrypted) content in bytes",
        ge=0,
        le=100 * 1024 * 1024  # 100MB limit
    )
    
    object_id: Optional[str] = Field(
        None,
        description="Optional object ID (UUID). If not provided, one will be generated",
        min_length=36,
        max_length=36
    )
    
    @field_validator('ciphertext', 'iv', 'auth_tag')
    def validate_base64(cls, v):
        """Validate that fields are proper base64."""
        try:
            decoded = base64.b64decode(v)
            if len(decoded) == 0:
                raise ValueError("Base64 field cannot decode to empty")
            return v
        except Exception:
            raise ValueError("Invalid base64 encoding")
    
    @field_validator('iv')
    def validate_iv_length(cls, v):
        """Validate that IV is exactly 12 bytes when decoded."""
        try:
            decoded = base64.b64decode(v)
            if len(decoded) != 12:
                raise ValueError("IV must be exactly 12 bytes")
            return v
        except Exception:
            raise ValueError("Invalid IV format")
    
    @field_validator('auth_tag')
    def validate_auth_tag_length(cls, v):
        """Validate that auth tag is exactly 16 bytes when decoded."""
        try:
            decoded = base64.b64decode(v)
            if len(decoded) != 16:
                raise ValueError("Auth tag must be exactly 16 bytes")
            return v
        except Exception:
            raise ValueError("Invalid auth tag format")
    
    @field_validator('content_type')
    def validate_content_type(cls, v):
        """Validate content type format."""
        if '/' not in v or len(v) > 100:
            raise ValueError("Invalid content type format")
        return v


class VaultBlobUploadResponse(BaseModel):
    """
    Response schema for successful vault blob upload.
    
    Returns the object ID and confirmation of successful storage.
    """
    
    object_id: str = Field(
        ...,
        description="UUID of the stored blob object"
    )
    
    vault_id: str = Field(
        ...,
        description="UUID of the vault containing the blob"
    )
    
    content_size: int = Field(
        ...,
        description="Size of the stored encrypted content"
    )
    
    content_type: str = Field(
        ...,
        description="MIME type of the original content"
    )
    
    created_at: datetime = Field(
        ...,
        description="Timestamp when the blob was created"
    )
    
    success: bool = Field(
        default=True,
        description="Upload success indicator"
    )


class VaultBlobMetadata(BaseModel):
    """
    Schema for vault blob metadata without content.
    
    Used for blob listing and summary operations.
    """
    
    object_id: str = Field(
        ...,
        description="UUID of the blob object"
    )
    
    content_type: str = Field(
        ...,
        description="MIME type of the original content"
    )
    
    content_size: int = Field(
        ...,
        description="Size of the original (unencrypted) content"
    )
    
    encrypted_size: int = Field(
        ...,
        description="Size of the encrypted content stored"
    )
    
    created_at: datetime = Field(
        ...,
        description="When the blob was created"
    )
    
    updated_at: datetime = Field(
        ...,
        description="When the blob was last modified"
    )


class VaultBlobDownloadResponse(BaseModel):
    """
    Response schema for vault blob download.
    
    Contains the encrypted blob content and metadata for client decryption.
    """
    
    object_id: str = Field(
        ...,
        description="UUID of the blob object"
    )
    
    ciphertext: str = Field(
        ...,
        description="Base64-encoded encrypted content"
    )
    
    iv: str = Field(
        ...,
        description="Base64-encoded initialization vector"
    )
    
    auth_tag: str = Field(
        ...,
        description="Base64-encoded authentication tag"
    )
    
    content_type: str = Field(
        ...,
        description="MIME type of the original content"
    )
    
    content_size: int = Field(
        ...,
        description="Size of the original (unencrypted) content"
    )
    
    created_at: datetime = Field(
        ...,
        description="When the blob was created"
    )
    
    updated_at: datetime = Field(
        ...,
        description="When the blob was last modified"
    )


class VaultBlobListRequest(BaseModel):
    """
    Request schema for listing vault blobs with filtering and pagination.
    """
    
    limit: int = Field(
        default=50,
        description="Maximum number of blobs to return",
        ge=1,
        le=1000
    )
    
    offset: int = Field(
        default=0,
        description="Number of blobs to skip for pagination",
        ge=0
    )
    
    content_type_filter: Optional[str] = Field(
        None,
        description="Filter by content type (e.g., 'text/*', 'audio/*')"
    )
    
    created_after: Optional[datetime] = Field(
        None,
        description="Filter blobs created after this timestamp"
    )
    
    created_before: Optional[datetime] = Field(
        None,
        description="Filter blobs created before this timestamp"
    )
    
    order_by: str = Field(
        default="created_at",
        description="Field to order by: 'created_at', 'updated_at', 'content_size'"
    )
    
    order_direction: str = Field(
        default="desc",
        description="Order direction: 'asc' or 'desc'"
    )
    
    @field_validator('order_by')
    def validate_order_by(cls, v):
        """Validate order_by field."""
        allowed = ['created_at', 'updated_at', 'content_size', 'content_type']
        if v not in allowed:
            raise ValueError(f"order_by must be one of: {allowed}")
        return v
    
    @field_validator('order_direction')
    def validate_order_direction(cls, v):
        """Validate order direction."""
        if v.lower() not in ['asc', 'desc']:
            raise ValueError("order_direction must be 'asc' or 'desc'")
        return v.lower()


class VaultBlobListResponse(BaseModel):
    """
    Response schema for vault blob listing.
    
    Contains paginated list of blob metadata and pagination info.
    """
    
    blobs: List[VaultBlobMetadata] = Field(
        ...,
        description="List of blob metadata objects"
    )
    
    total_count: int = Field(
        ...,
        description="Total number of blobs in the vault (before filtering)"
    )
    
    filtered_count: int = Field(
        ...,
        description="Number of blobs matching the filter criteria"
    )
    
    has_more: bool = Field(
        ...,
        description="Whether there are more blobs available"
    )
    
    next_offset: Optional[int] = Field(
        None,
        description="Offset for the next page of results"
    )


class VaultStatsResponse(BaseModel):
    """
    Response schema for vault statistics.
    
    Provides aggregate information about vault usage and contents.
    """
    
    vault_id: str = Field(
        ...,
        description="UUID of the vault"
    )
    
    total_blobs: int = Field(
        ...,
        description="Total number of blobs in the vault"
    )
    
    total_size: int = Field(
        ...,
        description="Total size of all encrypted content in bytes"
    )
    
    total_original_size: int = Field(
        ...,
        description="Total size of all original (unencrypted) content"
    )
    
    content_type_breakdown: Dict[str, int] = Field(
        ...,
        description="Count of blobs by content type"
    )
    
    size_breakdown: Dict[str, int] = Field(
        ...,
        description="Size breakdown by content type"
    )
    
    oldest_blob: Optional[datetime] = Field(
        None,
        description="Creation time of the oldest blob"
    )
    
    newest_blob: Optional[datetime] = Field(
        None,
        description="Creation time of the newest blob"
    )
    
    last_activity: Optional[datetime] = Field(
        None,
        description="Timestamp of last vault activity"
    )


class VaultBlobDeleteResponse(BaseModel):
    """
    Response schema for vault blob deletion.
    """
    
    object_id: str = Field(
        ...,
        description="UUID of the deleted blob object"
    )
    
    vault_id: str = Field(
        ...,
        description="UUID of the vault"
    )
    
    deleted_at: datetime = Field(
        ...,
        description="Timestamp when the blob was deleted"
    )
    
    success: bool = Field(
        default=True,
        description="Deletion success indicator"
    )


class VaultErrorResponse(BaseModel):
    """
    Error response schema for vault operations.
    
    Provides error information without leaking sensitive details.
    """
    
    error: str = Field(
        ...,
        description="Error type identifier"
    )
    
    message: str = Field(
        ...,
        description="Human-readable error message"
    )
    
    vault_id: Optional[str] = Field(
        None,
        description="Vault ID if applicable"
    )
    
    object_id: Optional[str] = Field(
        None,
        description="Object ID if applicable"
    )
    
    request_id: Optional[str] = Field(
        None,
        description="Request ID for debugging"
    )
    
    success: bool = Field(
        default=False,
        description="Operation success indicator"
    ) 