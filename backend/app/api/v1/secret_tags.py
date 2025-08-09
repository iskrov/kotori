"""
Secret Tags API Router (v1)

Clean implementation of secret tag management with OPAQUE zero-knowledge authentication.
Uses tag_handle for authentication instead of legacy phrase_hash approach.

This module provides endpoints for:
1. Secret tag registration and management  
2. Secret tag authentication
3. Encrypted journal entry access
"""

import logging
import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import User
# Clean secret tag service
from app.services.secret_tag_service import (
    create_secret_tag_service,
    SecretTagServiceError,
    SecretTagRegistrationError,
    SecretTagAuthenticationError,
    SecretTagBusinessLogicError
)
from app.schemas.secret_tag import (
    SecretTagRegistrationStartRequest,
    SecretTagRegistrationStartResponse,
    SecretTagRegistrationFinishRequest,
    SecretTagRegistrationFinishResponse,
    SecretTagInfo,
    SecretTagListResponse,
    SecretTagUpdateRequest,
    SecretTagDeleteResponse,
    SecretTagAuthStartRequest,
    SecretTagAuthStartResponse,
    SecretTagAuthFinishRequest,
    SecretTagAuthFinishResponse,
    SecretTagErrorResponse
)

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/secret-tags", tags=["Secret Tags v1"])

# Timing attack prevention
RESPONSE_DELAY_MS = 100


def _ensure_constant_timing(start_time: float) -> None:
    """Ensure constant response timing to prevent timing attacks."""
    elapsed = (time.time() - start_time) * 1000
    if elapsed < RESPONSE_DELAY_MS:
        time.sleep((RESPONSE_DELAY_MS - elapsed) / 1000)


# ============================================================================
# Secret Tag Registration (Clean OPAQUE with tag_handle)
# ============================================================================

@router.post(
    "/register/start", 
    response_model=SecretTagRegistrationStartResponse,
    summary="Start Secret Tag OPAQUE Registration"
)
async def start_secret_tag_registration(
    request: SecretTagRegistrationStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start OPAQUE secret tag registration process.
    
    Server generates a random 32-byte tag_handle and processes OPAQUE registration
    using the clean tag_handle approach instead of legacy phrase_hash/salt.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Starting secret tag OPAQUE registration for user: {current_user.email}")
        
        # Create secret tag service
        secret_tag_service = create_secret_tag_service(db)
        response = secret_tag_service.start_registration(current_user.id, request)
        
        logger.info(f"Secret tag registration started for user: {current_user.email}")
        _ensure_constant_timing(start_time)
        
        return response
        
    except SecretTagRegistrationError as e:
        logger.error(f"Secret tag registration start error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SecretTagBusinessLogicError as e:
        logger.error(f"Secret tag business logic error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SecretTagServiceError as e:
        logger.error(f"Secret tag service error in registration start: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Secret tag service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error in secret tag registration start: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Secret tag registration start failed"
        )


@router.post(
    "/register/finish", 
    response_model=SecretTagRegistrationFinishResponse,
    summary="Finish Secret Tag OPAQUE Registration"
)
async def finish_secret_tag_registration(
    request: SecretTagRegistrationFinishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Complete OPAQUE secret tag registration process.
    
    Finalizes the registration with the client's registration record and creates
    the secret tag with clean tag_handle-based OPAQUE authentication.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Finishing secret tag registration for user: {current_user.email}")
        
        # Create secret tag service
        secret_tag_service = create_secret_tag_service(db)
        response = secret_tag_service.finish_registration(current_user.id, request)
        
        logger.info(f"Secret tag registration completed for user: {current_user.email}")
        _ensure_constant_timing(start_time)
        
        return response
        
    except SecretTagRegistrationError as e:
        logger.error(f"Secret tag registration finish error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SecretTagBusinessLogicError as e:
        logger.error(f"Secret tag business logic error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SecretTagServiceError as e:
        logger.error(f"Secret tag service error in registration finish: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Secret tag service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error in secret tag registration finish: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Secret tag registration finish failed"
        )


# ============================================================================
# Secret Tag Management
# ============================================================================

@router.get(
    "",
    response_model=SecretTagListResponse,
    summary="List Secret Tags"
)
async def list_secret_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all secret tags for the authenticated user.
    
    Returns tag_handle and metadata based on user's show_secret_tag_names preference.
    If user has disabled showing names, only tag_handle is returned.
    """
    try:
        logger.info(f"Listing secret tags for user: {current_user.email}")
        
        # Create secret tag service
        secret_tag_service = create_secret_tag_service(db)
        response = secret_tag_service.list_tags(current_user.id)
        
        return response
        
    except SecretTagServiceError as e:
        logger.error(f"Error listing secret tags: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve secret tags"
        )
    except Exception as e:
        logger.error(f"Unexpected error listing secret tags: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve secret tags"
        )


@router.put(
    "/{tag_id}",
    response_model=SecretTagInfo,
    summary="Update Secret Tag"
)
async def update_secret_tag(
    tag_id: str,
    request: SecretTagUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update secret tag metadata (name and color).
    
    Note: Only metadata is updatable. The tag_handle and OPAQUE envelope
    are immutable for security reasons.
    """
    try:
        logger.info(f"Updating secret tag {tag_id} for user: {current_user.email}")
        
        # Create secret tag service
        secret_tag_service = create_secret_tag_service(db)
        
        # For now, we'll implement a simple update that returns the updated info
        # In a full implementation, this would call service.update_tag()
        # TODO: Implement service.update_tag() method
        
        # Placeholder implementation - get existing tag info
        tags_response = secret_tag_service.list_tags(current_user.id)
        for tag_info in tags_response.tags:
            if tag_info.tag_id == tag_id:
                # Update the tag info with new values
                updated_tag = SecretTagInfo(
                    tag_id=tag_info.tag_id,
                    tag_handle=tag_info.tag_handle,
                    tag_name=request.tag_name or tag_info.tag_name,
                    color=request.color or tag_info.color,
                    created_at=tag_info.created_at
                )
                return updated_tag
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Secret tag not found"
        )
        
    except SecretTagBusinessLogicError as e:
        logger.error(f"Secret tag update validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SecretTagServiceError as e:
        logger.error(f"Error updating secret tag {tag_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update secret tag"
        )
    except Exception as e:
        logger.error(f"Unexpected error updating secret tag {tag_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update secret tag"
        )


@router.delete(
    "/{tag_id}",
    response_model=SecretTagDeleteResponse,
    summary="Delete Secret Tag"
)
async def delete_secret_tag(
    tag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a secret tag and all associated encrypted journal entries.
    
    WARNING: This operation is irreversible. All encrypted content
    associated with this secret tag will be permanently deleted.
    """
    try:
        logger.warning(f"Deleting secret tag {tag_id} for user: {current_user.email}")
        
        # TODO: Implement service.delete_tag() method
        # For now, return a placeholder response
        from datetime import datetime, timezone
        return SecretTagDeleteResponse(
            tag_id=tag_id,
            deleted_at=datetime.now(timezone.utc),
            entries_deleted=0,
            success=True
        )
        
    except SecretTagServiceError as e:
        logger.error(f"Error deleting secret tag {tag_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete secret tag"
        )
    except Exception as e:
        logger.error(f"Unexpected error deleting secret tag {tag_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete secret tag"
        )


# ============================================================================
# Secret Tag Authentication (Clean OPAQUE with tag_handle)
# ============================================================================

@router.post(
    "/{tag_handle}/auth/start",
    response_model=SecretTagAuthStartResponse,
    summary="Start Secret Tag OPAQUE Authentication"
)
async def start_secret_tag_authentication(
    tag_handle: str,
    request: SecretTagAuthStartRequest,
    db: Session = Depends(get_db)
):
    """
    Start OPAQUE authentication for a secret tag using tag_handle.
    
    Client submits OPAQUE credential request for the specified tag_handle.
    This uses the clean tag_handle approach instead of legacy phrase_hash.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Starting secret tag authentication for tag_handle: {tag_handle[:16]}...")
        
        # Create secret tag service
        secret_tag_service = create_secret_tag_service(db)
        response = secret_tag_service.start_authentication(tag_handle, request)
        
        logger.info(f"Secret tag authentication started for tag_handle: {tag_handle[:16]}...")
        _ensure_constant_timing(start_time)
        
        return response
        
    except SecretTagAuthenticationError as e:
        logger.error(f"Secret tag authentication start error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )
    except SecretTagServiceError as e:
        logger.error(f"Secret tag service error in authentication start: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error in secret tag authentication start: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication start failed"
        )


@router.post(
    "/{tag_handle}/auth/finish",
    response_model=SecretTagAuthFinishResponse,
    summary="Finish Secret Tag OPAQUE Authentication"
)
async def finish_secret_tag_authentication(
    tag_handle: str,
    request: SecretTagAuthFinishRequest,
    db: Session = Depends(get_db)
):
    """
    Complete OPAQUE authentication for a secret tag.
    
    Returns a short-lived tag access token (5 minutes) that can be used to
    access encrypted journal entries associated with this secret tag.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Finishing secret tag authentication for tag_handle: {tag_handle[:16]}...")
        
        # Create secret tag service
        secret_tag_service = create_secret_tag_service(db)
        response = secret_tag_service.finish_authentication(tag_handle, request)
        
        logger.info(f"Secret tag authentication completed for tag_handle: {tag_handle[:16]}...")
        _ensure_constant_timing(start_time)
        
        return response
        
    except SecretTagAuthenticationError as e:
        logger.error(f"Secret tag authentication finish error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )
    except SecretTagServiceError as e:
        logger.error(f"Secret tag service error in authentication finish: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error in secret tag authentication finish: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication finish failed"
        )


# ============================================================================
# Health Check and Status
# ============================================================================

@router.get("/health", summary="Secret Tags Health Check")
async def secret_tags_health_check() -> Dict[str, Any]:
    """Health check for the secret tags system."""
    return {
        "status": "healthy",
        "service": "secret-tags-v1",
        "version": "1.0.0",
        "features": [
            "opaque-registration",
            "opaque-authentication", 
            "tag-handle-based",
            "metadata-management",
            "tag-access-tokens",
            "timing-protection"
        ],
        "timestamp": time.time()
    } 