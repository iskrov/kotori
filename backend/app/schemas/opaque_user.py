
"""
Clean OPAQUE User Authentication Schemas

Pydantic models for OPAQUE zero-knowledge user authentication using
opaque_envelope field in the dual authentication architecture.

Supports both OAuth (google_id) and OPAQUE (opaque_envelope) users.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator, EmailStr
import base64


# ============================================================================
# OPAQUE User Registration
# ============================================================================

class UserRegistrationStartRequest(BaseModel):
    """Request schema for starting OPAQUE user registration."""
    
    userIdentifier: EmailStr = Field(
        ..., 
        description="User's email address"
    )
    
    opaque_registration_request: str = Field(
        ..., 
        description="Base64-encoded OPAQUE registration request from client",
        min_length=1
    )
    
    name: str = Field(
        ..., 
        description="User's display name",
        min_length=1,
        max_length=150
    )
    
    @field_validator('opaque_registration_request')
    @classmethod
    def validate_base64(cls, v):
        """Validate that OPAQUE request is base64 or base64url encoded."""
        for decoder in (base64.b64decode, base64.urlsafe_b64decode):
            try:
                # Add correct amount of padding if missing
                missing_padding = len(v) % 4
                if missing_padding:
                    v_padded = v + '=' * (4 - missing_padding)
                else:
                    v_padded = v
                decoded = decoder(v_padded)
                if len(decoded) > 0:
                    return v  # Return original value, not padded
            except Exception:
                continue
        raise ValueError("Invalid base64/base64url encoding for OPAQUE registration request")
    
    class Config:
        json_schema_extra = {
            "example": {
                "userIdentifier": "user@example.com",
                "opaque_registration_request": "base64_encoded_opaque_registration_request",
                "name": "John Doe"
            }
        }


class UserRegistrationStartResponse(BaseModel):
    """Response schema for OPAQUE user registration start."""
    
    session_id: str = Field(
        ...,
        description="Session ID for completing registration"
    )
    
    opaque_registration_response: str = Field(
        ..., 
        description="Base64-encoded OPAQUE registration response from server"
    )
    
    expires_at: datetime = Field(
        ...,
        description="When this registration session expires"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "unique_session_id",
                "opaque_registration_response": "base64_encoded_opaque_registration_response",
                "expires_at": "2025-01-20T00:10:00Z"
            }
        }


class UserRegistrationFinishRequest(BaseModel):
    """Request schema for finishing OPAQUE user registration."""
    
    session_id: str = Field(
        ...,
        description="Session ID from registration start response"
    )
    
    userIdentifier: EmailStr = Field(
        ..., 
        description="User's email address"
    )
    
    opaque_registration_record: str = Field(
        ..., 
        description="Base64-encoded OPAQUE registration record from client",
        min_length=1
    )
    
    @field_validator('opaque_registration_record')
    @classmethod
    def validate_registration_record_base64(cls, v):
        """Validate that registration record is base64 or base64url encoded."""
        for decoder in (base64.b64decode, base64.urlsafe_b64decode):
            try:
                # Add correct amount of padding if missing
                missing_padding = len(v) % 4
                if missing_padding:
                    v_padded = v + '=' * (4 - missing_padding)
                else:
                    v_padded = v
                decoded = decoder(v_padded)
                if len(decoded) > 0:
                    return v  # Return original value, not padded
            except Exception:
                continue
        raise ValueError("Invalid base64/base64url encoding for OPAQUE registration record")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "unique_session_id",
                "userIdentifier": "user@example.com",
                "opaque_registration_record": "base64_encoded_opaque_registration_record"
            }
        }


class UserRegistrationFinishResponse(BaseModel):
    """Response schema for successful OPAQUE user registration."""
    
    success: bool = Field(
        default=True,
        description="Registration success indicator"
    )
    
    user: Dict[str, Any] = Field(
        ..., 
        description="Created user information"
    )
    
    access_token: str = Field(
        ..., 
        description="JWT access token for API authentication"
    )
    
    refresh_token: Optional[str] = Field(
        None, 
        description="JWT refresh token (not used for OPAQUE users)"
    )
    
    token_type: str = Field(
        default="bearer", 
        description="Token type"
    )
    
    message: str = Field(
        default="Registration successful", 
        description="Success message"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "user": {
                    "id": "12345678-1234-1234-1234-123456789012",
                    "email": "user@example.com",
                    "full_name": "John Doe",
                    "is_active": True,
                    "is_superuser": False,
                    "created_at": "2025-01-20T00:00:00Z",
                    "updated_at": "2025-01-20T00:00:00Z"
                },
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": None,
                "token_type": "bearer",
                "message": "Registration successful"
            }
        }


# ============================================================================
# OPAQUE User Login
# ============================================================================

class UserLoginStartRequest(BaseModel):
    """Request schema for starting OPAQUE user login."""
    
    userIdentifier: EmailStr = Field(
        ..., 
        description="User's email address"
    )
    
    client_credential_request: str = Field(
        ..., 
        description="Base64-encoded OPAQUE client credential request",
        min_length=1
    )
    
    @field_validator('client_credential_request')
    @classmethod
    def validate_credential_request_base64(cls, v):
        """Validate that credential request is base64 or base64url encoded."""
        for decoder in (base64.b64decode, base64.urlsafe_b64decode):
            try:
                # Add correct amount of padding if missing
                missing_padding = len(v) % 4
                if missing_padding:
                    v_padded = v + '=' * (4 - missing_padding)
                else:
                    v_padded = v
                decoded = decoder(v_padded)
                if len(decoded) > 0:
                    return v  # Return original value, not padded
            except Exception:
                continue
        raise ValueError("Invalid base64/base64url encoding for client credential request")
    
    class Config:
        json_schema_extra = {
            "example": {
                "userIdentifier": "user@example.com",
                "client_credential_request": "base64_encoded_client_credential_request"
            }
        }


class UserLoginStartResponse(BaseModel):
    """Response schema for OPAQUE user login start."""
    
    session_id: str = Field(
        ...,
        description="Session ID for completing login"
    )
    
    server_credential_response: str = Field(
        ..., 
        description="Base64-encoded OPAQUE server credential response"
    )
    
    expires_at: datetime = Field(
        ...,
        description="When this login session expires"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "unique_session_id",
                "server_credential_response": "base64_encoded_server_credential_response",
                "expires_at": "2025-01-20T00:05:00Z"
            }
        }


class UserLoginFinishRequest(BaseModel):
    """Request schema for finishing OPAQUE user login."""
    
    session_id: str = Field(
        ...,
        description="Session ID from login start response"
    )
    
    userIdentifier: EmailStr = Field(
        ..., 
        description="User's email address"
    )
    
    client_credential_finalization: str = Field(
        ..., 
        description="Base64-encoded OPAQUE client credential finalization",
        min_length=1
    )
    
    @field_validator('client_credential_finalization')
    @classmethod
    def validate_credential_finalization_base64(cls, v):
        """Validate that credential finalization is base64 or base64url encoded."""
        for decoder in (base64.b64decode, base64.urlsafe_b64decode):
            try:
                # Add correct amount of padding if missing
                missing_padding = len(v) % 4
                if missing_padding:
                    v_padded = v + '=' * (4 - missing_padding)
                else:
                    v_padded = v
                decoded = decoder(v_padded)
                if len(decoded) > 0:
                    return v  # Return original value, not padded
            except Exception:
                continue
        raise ValueError("Invalid base64/base64url encoding for client credential finalization")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "unique_session_id",
                "userIdentifier": "user@example.com",
                "client_credential_finalization": "base64_encoded_client_credential_finalization"
            }
        }


class UserLoginFinishResponse(BaseModel):
    """Response schema for successful OPAQUE user login."""
    
    success: bool = Field(
        default=True,
        description="Login success indicator"
    )
    
    user: Dict[str, Any] = Field(
        ..., 
        description="Authenticated user information"
    )
    
    access_token: str = Field(
        ..., 
        description="JWT access token for API authentication"
    )
    
    refresh_token: Optional[str] = Field(
        None, 
        description="JWT refresh token (not used for OPAQUE users)"
    )
    
    token_type: str = Field(
        default="bearer", 
        description="Token type"
    )
    
    message: str = Field(
        default="Login successful", 
        description="Success message"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "user": {
                    "id": "12345678-1234-1234-1234-123456789012",
                    "email": "user@example.com",
                    "full_name": "John Doe",
                    "is_active": True,
                    "is_superuser": False,
                    "created_at": "2025-01-20T00:00:00Z",
                    "updated_at": "2025-01-20T00:00:00Z"
                },
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": None,
                "token_type": "bearer",
                "message": "Login successful"
            }
        }


# ============================================================================
# Health and Status
# ============================================================================

class OpaqueUserAuthStatusResponse(BaseModel):
    """OPAQUE user authentication status response."""
    
    opaque_enabled: bool = Field(
        True, 
        description="Whether OPAQUE user authentication is enabled"
    )
    
    supported_features: Dict[str, bool] = Field(
        default_factory=lambda: {
            "user_registration": True,
            "user_login": True,
            "dual_authentication": True,
            "oauth_fallback": True
        },
        description="Supported OPAQUE user authentication features"
    )
    
    authentication_methods: Dict[str, bool] = Field(
        default_factory=lambda: {
            "google_oauth": True,
            "opaque_password": True
        },
        description="Available authentication methods"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "opaque_enabled": True,
                "supported_features": {
                    "user_registration": True,
                    "user_login": True,
                    "dual_authentication": True,
                    "oauth_fallback": True
                },
                "authentication_methods": {
                    "google_oauth": True,
                    "opaque_password": True
                }
            }
        } 