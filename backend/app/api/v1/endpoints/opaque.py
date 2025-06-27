"""
OPAQUE Authentication API Endpoints

FastAPI endpoints for OPAQUE zero-knowledge authentication protocol
including registration, authentication, and secret tag management.
"""

import logging
import time
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import User
from app.services.opaque_service import (
    OpaqueService,
    create_opaque_service,
    OpaqueRegistrationError,
    OpaqueAuthenticationError,
    OpaqueServiceError
)
from app.schemas.opaque import (
    OpaqueRegistrationRequest,
    OpaqueRegistrationResponse,
    OpaqueErrorResponse,
    SecretTagInfo,
    OpaqueAuthInitRequest,
    OpaqueAuthInitResponse,
    OpaqueAuthFinalizeRequest,
    OpaqueAuthFinalizeResponse
)

logger = logging.getLogger(__name__)

router = APIRouter()


# Timing attack prevention - constant response time
RESPONSE_DELAY_MS = 100  # Minimum response time in milliseconds


def _ensure_constant_timing(start_time: float) -> None:
    """
    Ensure constant response timing to prevent timing attacks.
    
    Args:
        start_time: Start time of the request processing
    """
    elapsed = (time.time() - start_time) * 1000  # Convert to milliseconds
    if elapsed < RESPONSE_DELAY_MS:
        time.sleep((RESPONSE_DELAY_MS - elapsed) / 1000)


def _create_error_response(
    error_type: str,
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    request_id: str = None
) -> JSONResponse:
    """
    Create a standardized error response for OPAQUE operations.
    
    Args:
        error_type: Type of error
        message: Human-readable error message
        status_code: HTTP status code
        request_id: Optional request ID for debugging
        
    Returns:
        JSONResponse with error details
    """
    error_response = OpaqueErrorResponse(
        error=error_type,
        message=message,
        request_id=request_id,
        success=False
    )
    
    return JSONResponse(
        status_code=status_code,
        content=error_response.dict()
    )


@router.post(
    "/secret-tags/register",
    response_model=OpaqueRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register OPAQUE Secret Tag",
    description="Register a new secret tag using OPAQUE zero-knowledge protocol"
)
async def register_secret_tag(
    request: OpaqueRegistrationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    http_request: Request = None
) -> OpaqueRegistrationResponse:
    """
    Register a new secret tag using the OPAQUE protocol.
    
    This endpoint:
    1. Validates the OPAQUE registration data
    2. Creates a new secret tag with OPAQUE verifier
    3. Generates vault keys for encrypted storage
    4. Returns tag_id and vault information
    
    The OPAQUE protocol ensures that the server never learns the secret phrase
    or any information that could be used to recover it.
    
    **Security Features:**
    - Zero-knowledge authentication
    - Constant-time response to prevent timing attacks
    - Atomic database operations
    - No sensitive data in logs or responses
    
    **Request Format:**
    ```json
    {
        "opaque_envelope": "base64-encoded OPAQUE envelope",
        "verifier_kv": "base64-encoded OPAQUE verifier (32 bytes)",
        "salt": "base64-encoded salt (16 bytes)",
        "tag_name": "My Secret Tag",
        "color_code": "#007AFF"
    }
    ```
    
    **Response Format:**
    ```json
    {
        "tag_id": "hex-encoded tag ID (32 chars)",
        "tag_name": "My Secret Tag",
        "color_code": "#007AFF",
        "vault_id": "uuid-of-created-vault",
        "created_at": "2025-01-19T23:30:00Z",
        "success": true
    }
    ```
    """
    start_time = time.time()
    request_id = getattr(http_request, 'state', {}).get('request_id', 'unknown')
    
    try:
        logger.info(f"OPAQUE registration request from user {current_user.id}")
        
        # Create OPAQUE service
        opaque_service = create_opaque_service(db)
        
        # Register the secret tag
        response = opaque_service.register_secret_tag(
            user_id=current_user.id,
            request=request
        )
        
        logger.info(f"Successfully registered secret tag for user {current_user.id}")
        
        # Ensure constant timing
        _ensure_constant_timing(start_time)
        
        return response
        
    except OpaqueRegistrationError as e:
        logger.warning(f"OPAQUE registration error for user {current_user.id}: {e}")
        _ensure_constant_timing(start_time)
        
        return _create_error_response(
            error_type="registration_failed",
            message="Failed to register secret tag",
            status_code=status.HTTP_400_BAD_REQUEST,
            request_id=request_id
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE registration: {e}")
        _ensure_constant_timing(start_time)
        
        return _create_error_response(
            error_type="internal_error",
            message="An unexpected error occurred",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            request_id=request_id
        )


@router.get(
    "/secret-tags",
    response_model=List[SecretTagInfo],
    summary="List Secret Tags",
    description="Get all secret tags for the current user"
)
async def list_secret_tags(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[SecretTagInfo]:
    """
    Get all secret tags for the current user.
    
    Returns a list of secret tags without any sensitive cryptographic data.
    Only returns tag metadata such as name, color, and creation time.
    
    **Security Note:** This endpoint does not return any OPAQUE verifiers,
    salts, or other cryptographic material.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Listing secret tags for user {current_user.id}")
        
        # Create OPAQUE service
        opaque_service = create_opaque_service(db)
        
        # Get user's secret tags
        tags_data = opaque_service.get_user_secret_tags(current_user.id)
        
        # Convert to response models
        secret_tags = [
            SecretTagInfo(
                tag_id=tag["tag_id"],
                tag_name=tag["tag_name"],
                color_code=tag["color_code"],
                vault_id=tag["vault_id"],
                created_at=tag["created_at"],
                updated_at=tag["updated_at"]
            )
            for tag in tags_data
        ]
        
        logger.info(f"Found {len(secret_tags)} secret tags for user {current_user.id}")
        
        # Ensure constant timing
        _ensure_constant_timing(start_time)
        
        return secret_tags
        
    except OpaqueServiceError as e:
        logger.error(f"Error listing secret tags for user {current_user.id}: {e}")
        _ensure_constant_timing(start_time)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve secret tags"
        )
        
    except Exception as e:
        logger.error(f"Unexpected error listing secret tags: {e}")
        _ensure_constant_timing(start_time)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )


@router.delete(
    "/secret-tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Secret Tag",
    description="Delete a secret tag and its associated vault data"
)
async def delete_secret_tag(
    tag_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Delete a secret tag and its associated vault data.
    
    This operation:
    1. Validates that the tag belongs to the current user
    2. Deletes the secret tag record
    3. Deletes associated wrapped keys
    4. Removes vault data (if implemented)
    
    **Warning:** This operation is irreversible. All data associated
    with this secret tag will be permanently deleted.
    
    Args:
        tag_id: Hex-encoded tag ID (32 characters)
    """
    start_time = time.time()
    
    try:
        logger.info(f"Deleting secret tag {tag_id} for user {current_user.id}")
        
        # Validate tag_id format
        if len(tag_id) != 32:
            _ensure_constant_timing(start_time)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tag ID format"
            )
        
        # Create OPAQUE service
        opaque_service = create_opaque_service(db)
        
        # Validate that tag exists and belongs to user
        if not opaque_service.validate_tag_exists(current_user.id, tag_id):
            _ensure_constant_timing(start_time)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Secret tag not found"
            )
        
        # Delete the secret tag
        success = opaque_service.delete_secret_tag(current_user.id, tag_id)
        
        if not success:
            _ensure_constant_timing(start_time)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete secret tag"
            )
        
        logger.info(f"Successfully deleted secret tag {tag_id} for user {current_user.id}")
        
        # Ensure constant timing
        _ensure_constant_timing(start_time)
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
        
    except Exception as e:
        logger.error(f"Unexpected error deleting secret tag {tag_id}: {e}")
        _ensure_constant_timing(start_time)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )


@router.get(
    "/health",
    summary="OPAQUE Health Check",
    description="Health check endpoint for OPAQUE authentication system"
)
async def opaque_health_check() -> Dict[str, Any]:
    """
    Health check endpoint for the OPAQUE authentication system.
    
    Returns system status and basic configuration information
    without exposing sensitive details.
    """
    try:
        return {
            "status": "healthy",
            "service": "opaque-auth",
            "version": "1.0.0",
            "features": [
                "registration",
                "authentication",
                "vault-keys",
                "timing-protection"
            ],
            "timestamp": time.time()
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "opaque-auth",
            "error": "Health check failed",
            "timestamp": time.time()
        }


@router.post(
    "/auth/init",
    response_model=OpaqueAuthInitResponse,
    status_code=status.HTTP_200_OK,
    summary="Initialize OPAQUE Authentication",
    description="Start OPAQUE authentication flow for a secret tag"
)
async def authenticate_init(
    request: OpaqueAuthInitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    http_request: Request = None
) -> OpaqueAuthInitResponse:
    """
    Initialize OPAQUE authentication flow for a secret tag.
    
    This endpoint:
    1. Validates that the tag_id exists for the current user
    2. Creates a temporary authentication session
    3. Processes the client's initial OPAQUE message
    4. Returns server response and session information
    
    The OPAQUE protocol ensures zero-knowledge authentication where
    the server learns nothing about the secret phrase.
    
    **Security Features:**
    - Zero-knowledge authentication protocol
    - Session-based state management
    - Constant-time response to prevent timing attacks
    - Automatic session expiration (5 minutes)
    
    **Request Format:**
    ```json
    {
        "tag_id": "hex-encoded tag ID (32 chars)",
        "client_message": "base64-encoded OPAQUE client message"
    }
    ```
    
    **Response Format:**
    ```json
    {
        "session_id": "unique session identifier",
        "server_message": "base64-encoded OPAQUE server response",
        "expires_at": "2025-01-20T00:10:00Z"
    }
    ```
    """
    start_time = time.time()
    request_id = getattr(http_request, 'state', {}).get('request_id', 'unknown')
    
    try:
        logger.info(f"OPAQUE authentication init request from user {current_user.id}")
        
        # Create OPAQUE service
        opaque_service = create_opaque_service(db)
        
        # Initialize authentication
        response = opaque_service.authenticate_init(
            user_id=current_user.id,
            request=request
        )
        
        logger.info(f"OPAQUE authentication init successful for user {current_user.id}")
        
        # Ensure constant timing
        _ensure_constant_timing(start_time)
        
        return response
        
    except OpaqueAuthenticationError as e:
        logger.warning(f"OPAQUE authentication init error for user {current_user.id}: {e}")
        _ensure_constant_timing(start_time)
        
        return _create_error_response(
            error_type="authentication_init_failed",
            message="Failed to initialize authentication",
            status_code=status.HTTP_400_BAD_REQUEST,
            request_id=request_id
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE authentication init: {e}")
        _ensure_constant_timing(start_time)
        
        return _create_error_response(
            error_type="internal_error",
            message="An unexpected error occurred",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            request_id=request_id
        )


@router.post(
    "/auth/finalize",
    response_model=OpaqueAuthFinalizeResponse,
    status_code=status.HTTP_200_OK,
    summary="Finalize OPAQUE Authentication",
    description="Complete OPAQUE authentication flow and retrieve vault keys"
)
async def authenticate_finalize(
    request: OpaqueAuthFinalizeRequest,
    db: Session = Depends(get_db),
    http_request: Request = None
) -> OpaqueAuthFinalizeResponse:
    """
    Finalize OPAQUE authentication flow and retrieve vault keys.
    
    This endpoint:
    1. Validates the session_id from the init response
    2. Processes the client's final OPAQUE message
    3. Completes the OPAQUE authentication protocol
    4. Returns wrapped vault keys and session token on success
    
    **Security Features:**
    - Zero-knowledge authentication completion
    - Session validation and cleanup
    - Wrapped key retrieval for authenticated access
    - Session token generation for subsequent requests
    
    **Request Format:**
    ```json
    {
        "session_id": "session ID from init response",
        "client_finalize_message": "base64-encoded OPAQUE finalization"
    }
    ```
    
    **Response Format:**
    ```json
    {
        "tag_id": "hex-encoded authenticated tag ID",
        "vault_id": "UUID of the vault for this tag",
        "wrapped_keys": {
            "vault_data": "base64-encoded wrapped data key"
        },
        "session_token": "JWT token for authenticated access",
        "expires_at": "2025-01-21T00:05:00Z",
        "success": true
    }
    ```
    """
    start_time = time.time()
    request_id = getattr(http_request, 'state', {}).get('request_id', 'unknown')
    
    try:
        logger.info(f"OPAQUE authentication finalize request for session {request.session_id}")
        
        # Create OPAQUE service
        opaque_service = create_opaque_service(db)
        
        # Finalize authentication
        response = opaque_service.authenticate_finalize(request)
        
        logger.info(f"OPAQUE authentication finalize successful for session {request.session_id}")
        
        # Ensure constant timing
        _ensure_constant_timing(start_time)
        
        return response
        
    except OpaqueAuthenticationError as e:
        logger.warning(f"OPAQUE authentication finalize error for session {request.session_id}: {e}")
        _ensure_constant_timing(start_time)
        
        return _create_error_response(
            error_type="authentication_finalize_failed",
            message="Failed to complete authentication",
            status_code=status.HTTP_400_BAD_REQUEST,
            request_id=request_id
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE authentication finalize: {e}")
        _ensure_constant_timing(start_time)
        
        return _create_error_response(
            error_type="internal_error",
            message="An unexpected error occurred",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            request_id=request_id
        )


@router.post(
    "/sessions/cleanup",
    status_code=status.HTTP_200_OK,
    summary="Cleanup Expired Sessions",
    description="Clean up expired OPAQUE authentication sessions"
)
async def cleanup_expired_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Clean up expired OPAQUE authentication sessions.
    
    This endpoint removes expired authentication sessions from the database
    to prevent storage bloat and maintain security.
    
    **Note:** This is typically called automatically, but can be triggered
    manually for maintenance purposes.
    """
    try:
        logger.info(f"Manual session cleanup requested by user {current_user.id}")
        
        # Create OPAQUE service
        opaque_service = create_opaque_service(db)
        
        # Clean up expired sessions
        cleaned_count = opaque_service.cleanup_expired_sessions()
        
        return {
            "success": True,
            "sessions_cleaned": cleaned_count,
            "message": f"Cleaned up {cleaned_count} expired sessions"
        }
        
    except Exception as e:
        logger.error(f"Error during session cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup sessions"
        ) 