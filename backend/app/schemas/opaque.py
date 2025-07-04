"""
OPAQUE Authentication Schemas

Pydantic models for OPAQUE zero-knowledge authentication protocol
including registration, authentication, and session management.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
import base64


class OpaqueRegistrationRequest(BaseModel):
    """
    Request schema for OPAQUE secret tag registration.
    
    Contains the OPAQUE envelope data from the client registration process
    along with user-friendly metadata for the secret tag.
    """
    
    # OPAQUE protocol data (base64 encoded)
    opaque_envelope: str = Field(
        ...,
        description="Base64-encoded OPAQUE registration envelope from client",
        min_length=1
    )
    
    verifier_kv: str = Field(
        ...,
        description="Base64-encoded OPAQUE verifier (Kv) for server storage",
        min_length=1
    )
    
    salt: str = Field(
        ...,
        description="Base64-encoded salt used in key derivation",
        min_length=1
    )
    
    # User-friendly metadata
    tag_name: str = Field(
        ...,
        description="Human-readable name for the secret tag",
        min_length=1,
        max_length=100
    )
    
    color_code: str = Field(
        default="#007AFF",
        description="Hex color code for UI display",
        pattern=r"^#[0-9A-Fa-f]{6}$"
    )
    
    @field_validator('opaque_envelope', 'verifier_kv', 'salt')
    def validate_base64(cls, v):
        """Validate that fields are proper base64 encoded data."""
        try:
            decoded = base64.b64decode(v)
            if len(decoded) == 0:
                raise ValueError("Decoded data cannot be empty")
            return v
        except Exception:
            raise ValueError("Invalid base64 encoding")
    
    @field_validator('verifier_kv')
    def validate_verifier_length(cls, v):
        """Validate that verifier is 32 bytes when decoded."""
        try:
            decoded = base64.b64decode(v)
            if len(decoded) != 32:
                raise ValueError("Verifier must be 32 bytes when decoded")
            return v
        except Exception:
            raise ValueError("Invalid verifier format")
    
    @field_validator('salt')
    def validate_salt_length(cls, v):
        """Validate that salt is 16 bytes when decoded."""
        try:
            decoded = base64.b64decode(v)
            if len(decoded) != 16:
                raise ValueError("Salt must be 16 bytes when decoded")
            return v
        except Exception:
            raise ValueError("Invalid salt format")


class OpaqueRegistrationResponse(BaseModel):
    """
    Response schema for successful OPAQUE secret tag registration.
    
    Returns the tag_id and confirmation of successful registration
    without exposing sensitive cryptographic data.
    """
    
    tag_id: str = Field(
        ...,
        description="Hex-encoded 16-byte tag ID for the registered secret tag"
    )
    
    tag_name: str = Field(
        ...,
        description="Human-readable name for the secret tag"
    )
    
    color_code: str = Field(
        ...,
        description="Hex color code for UI display"
    )
    
    vault_id: str = Field(
        ...,
        description="UUID of the vault created for this secret tag"
    )
    
    created_at: datetime = Field(
        ...,
        description="Timestamp when the secret tag was created"
    )
    
    success: bool = Field(
        default=True,
        description="Registration success indicator"
    )


class OpaqueAuthInitRequest(BaseModel):
    """
    Request schema for OPAQUE authentication initialization.
    
    Contains the tag_id to authenticate against and client's
    initial OPAQUE protocol data.
    """
    
    tag_id: str = Field(
        ...,
        description="Hex-encoded 16-byte tag ID to authenticate",
        min_length=32,
        max_length=32
    )
    
    client_message: str = Field(
        ...,
        description="Base64-encoded OPAQUE client message for authentication init",
        min_length=1
    )
    
    @field_validator('tag_id')
    def validate_tag_id_hex(cls, v):
        """Validate that tag_id is valid hex encoding."""
        try:
            decoded = bytes.fromhex(v)
            if len(decoded) != 16:
                raise ValueError("Tag ID must be 16 bytes when decoded")
            return v
        except ValueError:
            raise ValueError("Invalid hex encoding for tag_id")
    
    @field_validator('client_message')
    def validate_client_message_base64(cls, v):
        """Validate that client_message is proper base64."""
        try:
            decoded = base64.b64decode(v)
            if len(decoded) == 0:
                raise ValueError("Client message cannot be empty")
            return v
        except Exception:
            raise ValueError("Invalid base64 encoding for client_message")


class OpaqueAuthInitResponse(BaseModel):
    """
    Response schema for OPAQUE authentication initialization.
    
    Contains server's response to the authentication request
    and session information for the finalization step.
    """
    
    session_id: str = Field(
        ...,
        description="Session ID for this authentication attempt"
    )
    
    server_message: str = Field(
        ...,
        description="Base64-encoded OPAQUE server response message"
    )
    
    expires_at: datetime = Field(
        ...,
        description="When this authentication session expires"
    )


class OpaqueAuthFinalizeRequest(BaseModel):
    """
    Request schema for OPAQUE authentication finalization.
    
    Contains the session_id and client's final OPAQUE protocol data.
    """
    
    session_id: str = Field(
        ...,
        description="Session ID from the authentication init response"
    )
    
    client_finalize_message: str = Field(
        ...,
        description="Base64-encoded OPAQUE client finalization message",
        min_length=1
    )
    
    @field_validator('client_finalize_message')
    def validate_finalize_message_base64(cls, v):
        """Validate that finalize message is proper base64."""
        try:
            decoded = base64.b64decode(v)
            if len(decoded) == 0:
                raise ValueError("Finalize message cannot be empty")
            return v
        except Exception:
            raise ValueError("Invalid base64 encoding for finalize_message")


class OpaqueAuthFinalizeResponse(BaseModel):
    """
    Response schema for successful OPAQUE authentication.
    
    Contains wrapped keys and vault access information for the
    authenticated secret tag.
    """
    
    tag_id: str = Field(
        ...,
        description="Hex-encoded tag ID that was authenticated"
    )
    
    vault_id: str = Field(
        ...,
        description="UUID of the vault for this secret tag"
    )
    
    wrapped_keys: Dict[str, str] = Field(
        ...,
        description="Base64-encoded wrapped keys for vault access"
    )
    
    session_token: str = Field(
        ...,
        description="JWT session token for authenticated access"
    )
    
    expires_at: datetime = Field(
        ...,
        description="When the session token expires"
    )
    
    success: bool = Field(
        default=True,
        description="Authentication success indicator"
    )


class OpaqueErrorResponse(BaseModel):
    """
    Error response schema for OPAQUE operations.
    
    Provides error information without leaking sensitive details
    about authentication success/failure.
    """
    
    error: str = Field(
        ...,
        description="Error type identifier"
    )
    
    message: str = Field(
        ...,
        description="Human-readable error message"
    )
    
    request_id: Optional[str] = Field(
        None,
        description="Request ID for debugging (optional)"
    )
    
    success: bool = Field(
        default=False,
        description="Operation success indicator"
    )


class SecretTagInfo(BaseModel):
    """
    Schema for secret tag information without sensitive data.
    
    Used for listing user's secret tags and general information.
    """
    
    tag_id: str = Field(
        ...,
        description="Hex-encoded tag ID"
    )
    
    tag_name: str = Field(
        ...,
        description="Human-readable name for the secret tag"
    )
    
    color_code: str = Field(
        ...,
        description="Hex color code for UI display"
    )
    
    vault_id: str = Field(
        ...,
        description="UUID of the vault for this secret tag"
    )
    
    created_at: datetime = Field(
        ...,
        description="When the secret tag was created"
    )
    
    updated_at: datetime = Field(
        ...,
        description="When the secret tag was last updated"
    )
    
    entry_count: Optional[int] = Field(
        None,
        description="Number of journal entries in this vault (optional)"
    )


class VaultStatsResponse(BaseModel):
    """
    Response schema for vault statistics.
    
    Provides aggregate information about vault contents
    without exposing sensitive data.
    """
    
    vault_id: str = Field(
        ...,
        description="UUID of the vault"
    )
    
    total_entries: int = Field(
        ...,
        description="Total number of entries in the vault"
    )
    
    total_size_bytes: int = Field(
        ...,
        description="Total size of encrypted data in bytes"
    )
    
    last_activity: Optional[datetime] = Field(
        None,
        description="Timestamp of last vault activity"
    )
    
    created_at: datetime = Field(
        ...,
        description="When the vault was created"
    ) 