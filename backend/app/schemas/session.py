"""
Session Management Schemas

Pydantic models for OPAQUE session management API requests and responses.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class SessionState(str, Enum):
    """Session state enumeration"""
    ACTIVE = "active"
    INVALIDATED = "invalidated"
    EXPIRED = "expired"


class SessionCreateRequest(BaseModel):
    """Request to create a new session"""
    user_id: str = Field(..., description="User identifier")
    tag_id: Optional[str] = Field(None, description="Secret tag ID for vault access")
    session_data: Optional[Dict[str, Any]] = Field(None, description="Additional session metadata")
    
    class Config:
        schema_extra = {
            "example": {
                "user_id": "user@example.com",
                "tag_id": "tag123",
                "session_data": {"client_type": "web", "version": "1.0"}
            }
        }


class SessionCreateResponse(BaseModel):
    """Response for session creation"""
    success: bool = Field(..., description="Whether session creation was successful")
    session_token: Optional[str] = Field(None, description="Session token for authentication")
    expires_at: Optional[datetime] = Field(None, description="Session expiration time")
    message: str = Field(..., description="Status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "expires_at": "2025-01-27T02:00:00Z",
                "message": "Session created successfully"
            }
        }


class SessionValidateRequest(BaseModel):
    """Request to validate a session"""
    session_token: str = Field(..., description="Session token to validate")
    
    @validator('session_token')
    def validate_session_token(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Session token cannot be empty')
        return v.strip()
    
    class Config:
        schema_extra = {
            "example": {
                "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }


class SessionValidateResponse(BaseModel):
    """Response for session validation"""
    valid: bool = Field(..., description="Whether the session is valid")
    user_id: Optional[str] = Field(None, description="User ID if session is valid")
    expires_at: Optional[datetime] = Field(None, description="Session expiration time")
    last_activity: Optional[datetime] = Field(None, description="Last activity timestamp")
    message: str = Field(..., description="Validation message")
    
    class Config:
        schema_extra = {
            "example": {
                "valid": True,
                "user_id": "user@example.com",
                "expires_at": "2025-01-27T02:00:00Z",
                "last_activity": "2025-01-20T03:30:00Z",
                "message": "Session is valid"
            }
        }


class SessionRefreshRequest(BaseModel):
    """Request to refresh a session"""
    session_token: str = Field(..., description="Session token to refresh")
    
    @validator('session_token')
    def validate_session_token(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Session token cannot be empty')
        return v.strip()


class SessionRefreshResponse(BaseModel):
    """Response for session refresh"""
    success: bool = Field(..., description="Whether session refresh was successful")
    expires_at: Optional[datetime] = Field(None, description="New session expiration time")
    message: str = Field(..., description="Refresh status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "expires_at": "2025-01-27T02:00:00Z",
                "message": "Session refreshed successfully"
            }
        }


class SessionInvalidateRequest(BaseModel):
    """Request to invalidate a session"""
    session_token: str = Field(..., description="Session token to invalidate")
    
    @validator('session_token')
    def validate_session_token(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Session token cannot be empty')
        return v.strip()


class SessionInvalidateResponse(BaseModel):
    """Response for session invalidation"""
    success: bool = Field(..., description="Whether session invalidation was successful")
    message: str = Field(..., description="Invalidation status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Session invalidated successfully"
            }
        }


class SessionInfo(BaseModel):
    """Information about a session"""
    session_id: str = Field(..., description="Session identifier (hashed)")
    user_id: str = Field(..., description="User identifier")
    tag_id: Optional[str] = Field(None, description="Secret tag ID")
    state: SessionState = Field(..., description="Session state")
    created_at: datetime = Field(..., description="Session creation time")
    expires_at: datetime = Field(..., description="Session expiration time")
    last_activity: datetime = Field(..., description="Last activity timestamp")
    
    class Config:
        schema_extra = {
            "example": {
                "session_id": "abc123def456...",
                "user_id": "user@example.com",
                "tag_id": "tag123",
                "state": "active",
                "created_at": "2025-01-20T02:00:00Z",
                "expires_at": "2025-01-27T02:00:00Z",
                "last_activity": "2025-01-20T03:30:00Z"
            }
        }


class SessionListRequest(BaseModel):
    """Request to list user sessions"""
    user_id: Optional[str] = Field(None, description="User ID to filter sessions")
    active_only: bool = Field(True, description="Whether to return only active sessions")
    limit: int = Field(50, ge=1, le=100, description="Maximum number of sessions to return")
    offset: int = Field(0, ge=0, description="Number of sessions to skip")
    
    class Config:
        schema_extra = {
            "example": {
                "user_id": "user@example.com",
                "active_only": True,
                "limit": 10,
                "offset": 0
            }
        }


class SessionListResponse(BaseModel):
    """Response for session listing"""
    sessions: List[SessionInfo] = Field(..., description="List of sessions")
    total_count: int = Field(..., description="Total number of sessions")
    has_more: bool = Field(..., description="Whether there are more sessions available")
    
    class Config:
        schema_extra = {
            "example": {
                "sessions": [
                    {
                        "session_id": "abc123def456...",
                        "user_id": "user@example.com",
                        "tag_id": "tag123",
                        "state": "active",
                        "created_at": "2025-01-20T02:00:00Z",
                        "expires_at": "2025-01-27T02:00:00Z",
                        "last_activity": "2025-01-20T03:30:00Z"
                    }
                ],
                "total_count": 1,
                "has_more": False
            }
        }


class SessionStatsResponse(BaseModel):
    """Session statistics response"""
    total_sessions: int = Field(..., description="Total number of sessions")
    active_sessions: int = Field(..., description="Number of active sessions")
    expired_sessions: int = Field(..., description="Number of expired sessions")
    sessions_by_user: Dict[str, int] = Field(..., description="Session count by user")
    
    class Config:
        schema_extra = {
            "example": {
                "total_sessions": 150,
                "active_sessions": 45,
                "expired_sessions": 105,
                "sessions_by_user": {
                    "user1@example.com": 3,
                    "user2@example.com": 2
                }
            }
        }


class SessionCleanupResponse(BaseModel):
    """Response for session cleanup operations"""
    success: bool = Field(..., description="Whether cleanup was successful")
    cleaned_sessions: int = Field(..., description="Number of sessions cleaned up")
    message: str = Field(..., description="Cleanup status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "cleaned_sessions": 25,
                "message": "Cleaned up 25 expired sessions"
            }
        }


class SessionErrorResponse(BaseModel):
    """Error response for session operations"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    
    class Config:
        schema_extra = {
            "example": {
                "error": "SessionValidationError",
                "message": "Session token is invalid or expired",
                "details": {"session_id": "abc123..."}
            }
        } 