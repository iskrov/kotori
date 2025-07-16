"""
User OPAQUE Authentication Schemas

Pydantic models for user OPAQUE authentication endpoints.
"""

from typing import Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class UserRegistrationStartRequest(BaseModel):
    """Request for starting user registration"""
    userIdentifier: str = Field(..., description="User's email address")
    registrationRequest: str = Field(..., description="Base64 OPAQUE registration request")
    name: str = Field(..., description="User's display name")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "userIdentifier": "user@example.com",
                "registrationRequest": "base64_encoded_registration_request",
                "name": "John Doe"
            }
        }
    )


class UserRegistrationStartResponse(BaseModel):
    """Response for registration start"""
    registrationResponse: str = Field(..., description="Base64 OPAQUE registration response")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "registrationResponse": "base64_encoded_registration_response"
            }
        }
    )


class UserRegistrationFinishRequest(BaseModel):
    """Request for finishing user registration"""
    userIdentifier: str = Field(..., description="User's email address")
    registrationRecord: str = Field(..., description="Base64 OPAQUE registration record")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "userIdentifier": "user@example.com",
                "registrationRecord": "base64_encoded_registration_record"
            }
        }
    )


class UserRegistrationFinishResponse(BaseModel):
    """Response for finishing user registration"""
    success: bool = Field(..., description="Whether registration was successful")
    message: str = Field(..., description="Registration status message")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "User registered successfully"
            }
        }
    )


class UserLoginStartRequest(BaseModel):
    """Request for starting user login"""
    userIdentifier: str = Field(..., description="User's email address")
    loginRequest: str = Field(..., description="Base64 OPAQUE login request")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "userIdentifier": "user@example.com",
                "loginRequest": "base64_encoded_login_request"
            }
        }
    )


class UserLoginStartResponse(BaseModel):
    """Response for login start"""
    loginResponse: str = Field(..., description="Base64 OPAQUE login response")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "loginResponse": "base64_encoded_login_response"
            }
        }
    )


class UserLoginFinishRequest(BaseModel):
    """Request for finishing user login"""
    userIdentifier: str = Field(..., description="User's email address")
    finishLoginRequest: str = Field(..., description="Base64 OPAQUE finish login request")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "userIdentifier": "user@example.com",
                "finishLoginRequest": "base64_encoded_finish_login_request"
            }
        }
    )


class UserLoginFinishResponse(BaseModel):
    """Response for finishing user login"""
    success: bool = Field(..., description="Whether login was successful")
    user: Dict[str, Any] = Field(..., description="User information")
    token: str = Field(..., description="JWT access token")
    token_type: str = Field(..., description="Token type (bearer)")
    sessionKey: str = Field(..., description="OPAQUE session key for client-side key derivation")
    exportKey: str = Field(..., description="OPAQUE export key for client-side key derivation")
    message: str = Field(..., description="Login status message")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "user": {
                    "id": "12345678-1234-1234-1234-123456789012",
                    "email": "user@example.com",
                    "full_name": "John Doe",
                    "is_active": True,
                    "is_superuser": False
                },
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "sessionKey": "base64_encoded_session_key",
                "exportKey": "base64_encoded_export_key",
                "message": "Login successful"
            }
        }
    )


class OpaqueStatusResponse(BaseModel):
    """OPAQUE server status response"""
    opaque_enabled: bool = Field(True, description="Whether OPAQUE is enabled")
    supported_features: Dict[str, bool] = Field(
        default_factory=lambda: {
            "registration": True,
            "login": True,
            "user_authentication": True
        },
        description="Supported OPAQUE features"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "opaque_enabled": True,
                "supported_features": {
                    "registration": True,
                    "login": True,
                    "user_authentication": True
                }
            }
        }
    ) 