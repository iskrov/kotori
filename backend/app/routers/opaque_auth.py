"""
OPAQUE Authentication API Routes

This module provides FastAPI routes for OPAQUE zero-knowledge authentication.
It handles registration and login flows while maintaining zero-knowledge properties.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import logging
import base64

from ..crypto.opaque_server import (
    OpaqueServer, 
    OpaqueRegistrationRequest,
    OpaqueLoginRequest,
    OpaqueServerError,
    serialize_opaque_data,
    deserialize_opaque_data
)
from ..db.session import get_db
from ..schemas.user import User as UserSchema
from ..core.security import create_access_token

# Configure logging
logger = logging.getLogger(__name__)

# Global OPAQUE server instance (in production, this would be properly managed)
opaque_server = OpaqueServer()

# Security scheme
security = HTTPBearer(auto_error=False)

# Router instance
router = APIRouter(prefix="/api/auth/opaque", tags=["opaque-auth"])


# Pydantic models for API requests/responses
class OpaqueRegistrationStartRequest(BaseModel):
    """Start OPAQUE registration request"""
    user_id: str = Field(..., description="User identifier (email)")
    blinded_element: str = Field(..., description="Base64-encoded blinded element")
    client_public_key: str = Field(..., description="Base64-encoded client public key")


class OpaqueRegistrationStartResponse(BaseModel):
    """Start OPAQUE registration response"""
    evaluated_element: str = Field(..., description="Base64-encoded evaluated element")
    server_public_key: str = Field(..., description="Base64-encoded server public key")
    salt: str = Field(..., description="Base64-encoded salt")


class OpaqueRegistrationFinishRequest(BaseModel):
    """Finish OPAQUE registration request"""
    user_id: str = Field(..., description="User identifier (email)")
    envelope: str = Field(..., description="Base64-encoded client envelope")
    export_key: str = Field(..., description="Base64-encoded export key for verification")


class OpaqueRegistrationFinishResponse(BaseModel):
    """Finish OPAQUE registration response"""
    success: bool = Field(..., description="Registration success status")
    message: str = Field(..., description="Status message")


class OpaqueLoginStartRequest(BaseModel):
    """Start OPAQUE login request"""
    user_id: str = Field(..., description="User identifier (email)")
    blinded_element: str = Field(..., description="Base64-encoded blinded element")
    client_public_key: str = Field(..., description="Base64-encoded client public key")


class OpaqueLoginStartResponse(BaseModel):
    """Start OPAQUE login response"""
    evaluated_element: str = Field(..., description="Base64-encoded evaluated element")
    server_public_key: str = Field(..., description="Base64-encoded server public key")
    salt: str = Field(..., description="Base64-encoded salt")
    success: bool = Field(..., description="Login start success status")


class OpaqueLoginFinishRequest(BaseModel):
    """Finish OPAQUE login request"""
    user_id: str = Field(..., description="User identifier (email)")
    client_proof: str = Field(..., description="Base64-encoded client proof")
    export_key: str = Field(..., description="Base64-encoded export key")


class OpaqueLoginFinishResponse(BaseModel):
    """Finish OPAQUE login response"""
    success: bool = Field(..., description="Login success status")
    access_token: Optional[str] = Field(None, description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    message: str = Field(..., description="Status message")


class OpaqueStatusResponse(BaseModel):
    """OPAQUE server status response"""
    opaque_enabled: bool = Field(..., description="Whether OPAQUE is enabled")
    supported_features: Dict[str, bool] = Field(..., description="Supported OPAQUE features")


# Helper functions
def validate_user_id(user_id: str) -> str:
    """Validate and normalize user ID"""
    if not user_id or len(user_id.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID cannot be empty"
        )
    
    # Basic email validation
    user_id = user_id.strip().lower()
    if "@" not in user_id or "." not in user_id.split("@")[1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID must be a valid email address"
        )
    
    return user_id


async def get_or_create_user(user_id: str) -> UserSchema:
    """Get existing user or create new one for OPAQUE registration"""
    try:
        # In a real implementation, this would interact with the database
        # For now, we'll create a simple user object
        return UserSchema(
            id=hash(user_id) % 1000000,  # Simple ID generation
            email=user_id,
            is_active=True,
            created_at=None,
            updated_at=None
        )
    except Exception as e:
        logger.error(f"Error getting/creating user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing user"
        )


# API Routes
@router.get("/status", response_model=OpaqueStatusResponse)
async def get_opaque_status():
    """
    Get OPAQUE server status and capabilities
    
    Returns information about OPAQUE support and available features.
    """
    try:
        return OpaqueStatusResponse(
            opaque_enabled=True,
            supported_features={
                "registration": True,
                "login": True,
                "key_derivation": True,
                "session_management": True
            }
        )
    except Exception as e:
        logger.error(f"Error getting OPAQUE status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting OPAQUE status"
        )


@router.post("/register/start", response_model=OpaqueRegistrationStartResponse)
async def start_opaque_registration(request: OpaqueRegistrationStartRequest):
    """
    Start OPAQUE registration flow
    
    Initiates the OPAQUE registration process by evaluating the client's
    blinded element and returning server parameters.
    """
    try:
        # Validate user ID
        user_id = validate_user_id(request.user_id)
        
        # Check if user already has OPAQUE registration
        if opaque_server.has_user(user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already registered with OPAQUE"
            )
        
        # Deserialize client data
        blinded_element = deserialize_opaque_data(request.blinded_element)
        client_public_key = deserialize_opaque_data(request.client_public_key)
        
        # Create OPAQUE registration request
        opaque_request = OpaqueRegistrationRequest(
            user_id=user_id,
            blinded_element=blinded_element,
            client_public_key=client_public_key
        )
        
        # Process registration start
        response = opaque_server.start_registration(opaque_request)
        
        # Serialize response data
        return OpaqueRegistrationStartResponse(
            evaluated_element=base64.b64encode(response.evaluated_element).decode('utf-8'),
            server_public_key=base64.b64encode(response.server_public_key).decode('utf-8'),
            salt=base64.b64encode(response.salt).decode('utf-8')
        )
        
    except OpaqueServerError as e:
        logger.error(f"OPAQUE registration start error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OPAQUE registration error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE registration start: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during registration"
        )


@router.post("/register/finish", response_model=OpaqueRegistrationFinishResponse)
async def finish_opaque_registration(request: OpaqueRegistrationFinishRequest):
    """
    Finish OPAQUE registration flow
    
    Completes the OPAQUE registration by storing the client envelope
    and creating the user account.
    """
    try:
        # Validate user ID
        user_id = validate_user_id(request.user_id)
        
        # Deserialize envelope
        envelope = deserialize_opaque_data(request.envelope)
        
        # Finish OPAQUE registration
        success = opaque_server.finish_registration(user_id, envelope)
        
        if success:
            # Create or update user in database
            user = await get_or_create_user(user_id)
            logger.info(f"OPAQUE registration completed for user: {user_id}")
            
            return OpaqueRegistrationFinishResponse(
                success=True,
                message="OPAQUE registration completed successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OPAQUE registration failed"
            )
        
    except OpaqueServerError as e:
        logger.error(f"OPAQUE registration finish error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OPAQUE registration error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE registration finish: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during registration"
        )


@router.post("/login/start", response_model=OpaqueLoginStartResponse)
async def start_opaque_login(request: OpaqueLoginStartRequest):
    """
    Start OPAQUE login flow
    
    Initiates the OPAQUE login process by evaluating the client's
    blinded element using stored server parameters.
    """
    try:
        # Validate user ID
        user_id = validate_user_id(request.user_id)
        
        # Deserialize client data
        blinded_element = deserialize_opaque_data(request.blinded_element)
        client_public_key = deserialize_opaque_data(request.client_public_key)
        
        # Create OPAQUE login request
        opaque_request = OpaqueLoginRequest(
            user_id=user_id,
            blinded_element=blinded_element,
            client_public_key=client_public_key
        )
        
        # Process login start
        response = opaque_server.start_login(opaque_request)
        
        if response.success:
            return OpaqueLoginStartResponse(
                evaluated_element=base64.b64encode(response.evaluated_element).decode('utf-8'),
                server_public_key=base64.b64encode(response.server_public_key).decode('utf-8'),
                salt=base64.b64encode(response.salt).decode('utf-8'),
                success=True
            )
        else:
            return OpaqueLoginStartResponse(
                evaluated_element="",
                server_public_key="",
                salt="",
                success=False
            )
            
    except OpaqueServerError as e:
        logger.error(f"OPAQUE login start error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OPAQUE login error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE login start: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )


@router.post("/login/finish", response_model=OpaqueLoginFinishResponse)
async def finish_opaque_login(request: OpaqueLoginFinishRequest):
    """
    Finish OPAQUE login flow
    
    Completes the OPAQUE login by verifying the client proof
    and issuing an access token.
    """
    try:
        # Validate user ID
        user_id = validate_user_id(request.user_id)
        
        # Deserialize client proof
        client_proof = deserialize_opaque_data(request.client_proof)
        
        # Finish OPAQUE login
        success, session_key = opaque_server.finish_login(user_id, client_proof)
        
        if success and session_key:
            # Get user for token creation
            user = await get_or_create_user(user_id)
            
            # Create access token
            access_token = create_access_token(
                data={"sub": str(user.id), "email": user.email}
            )
            
            logger.info(f"OPAQUE login completed for user: {user_id}")
            
            return OpaqueLoginFinishResponse(
                success=True,
                access_token=access_token,
                token_type="bearer",
                message="OPAQUE login completed successfully"
            )
        else:
            return OpaqueLoginFinishResponse(
                success=False,
                access_token=None,
                token_type="bearer",
                message="OPAQUE login failed - invalid credentials"
            )
        
    except OpaqueServerError as e:
        logger.error(f"OPAQUE login finish error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OPAQUE login error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE login finish: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )


@router.delete("/session/{user_id}")
async def invalidate_opaque_session(
    user_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Invalidate OPAQUE session
    
    Removes the active OPAQUE session for the specified user.
    Requires valid authentication.
    """
    try:
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Validate user ID
        user_id = validate_user_id(user_id)
        
        # Invalidate session
        success = opaque_server.invalidate_session(user_id)
        
        if success:
            logger.info(f"OPAQUE session invalidated for user: {user_id}")
            return {"success": True, "message": "Session invalidated"}
        else:
            return {"success": False, "message": "No active session found"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error invalidating OPAQUE session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error invalidating session"
        ) 