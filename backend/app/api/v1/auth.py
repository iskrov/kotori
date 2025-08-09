"""
Unified Authentication API Router (v1)

This module provides unified authentication endpoints under /api/v1/auth for both:
1. OAuth authentication (Google Sign-In)
2. OPAQUE zero-knowledge password authentication

Clean, consistent authentication API following the target architecture.
"""

import logging
import time
from datetime import timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.dependencies import get_db
from app.schemas.token import GoogleAuthRequest, RefreshTokenRequest, Token
from app.schemas.user import User as UserSchema
from app.services import auth_service
# Clean OPAQUE user authentication service
from app.services.opaque_user_service import (
    create_opaque_user_service,
    OpaqueUserServiceError,
    OpaqueUserRegistrationError,
    OpaqueUserAuthenticationError
)
from app.schemas.opaque_user import (
    UserRegistrationStartRequest,
    UserRegistrationStartResponse,
    UserRegistrationFinishRequest,
    UserRegistrationFinishResponse,
    UserLoginStartRequest,
    UserLoginStartResponse,
    UserLoginFinishRequest,
    UserLoginFinishResponse,
    OpaqueUserAuthStatusResponse
)

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication v1"])

# Timing attack prevention
RESPONSE_DELAY_MS = 100


def _ensure_constant_timing(start_time: float) -> None:
    """Ensure constant response timing to prevent timing attacks."""
    elapsed = (time.time() - start_time) * 1000
    if elapsed < RESPONSE_DELAY_MS:
        time.sleep((RESPONSE_DELAY_MS - elapsed) / 1000)


def _create_token_response(user_obj: UserSchema, access_token_expire_minutes: int) -> dict:
    """Helper to create access token, refresh token, and the response dictionary."""
    access_token_expires = timedelta(minutes=access_token_expire_minutes)
    access_token = security.create_access_token(
        user_obj.id, expires_delta=access_token_expires
    )
    refresh_token = security.create_refresh_token(user_obj.id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_obj,
    }


# ============================================================================
# OAuth Authentication (Google Sign-In)
# ============================================================================

@router.post("/google", response_model=Token, summary="Google OAuth Authentication")
async def login_google(
    request: Request,
    google_data: GoogleAuthRequest,
    db: Session = Depends(get_db),
) -> Any:
    """
    Google OAuth authentication endpoint.
    
    Authenticates users via Google Sign-In and returns JWT tokens for API access.
    Users with Google accounts have google_id populated and opaque_envelope as NULL.
    """
    start_time = time.time()
    logger.info("Google login attempt")
    
    try:
        user = auth_service.authenticate_google(db, token=google_data.token)

        if not user:
            logger.warning("Failed Google login attempt - user not authenticated or found")
            _ensure_constant_timing(start_time)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google authentication credentials or user not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        if not user.is_active:
            logger.warning(f"Google login attempt for inactive user: {user.email}")
            _ensure_constant_timing(start_time)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is inactive. Please contact support.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.info(f"Successful Google authentication for user: {user.email}")
        _ensure_constant_timing(start_time)
        
        return _create_token_response(user, settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Google Sign-In ValueError: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {e}",
        ) from e
    except Exception as e:
        logger.error(f"Unexpected Google login error: {str(e)}", exc_info=True)
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during Google login. Please try again.",
        ) from e


# ============================================================================
# OPAQUE Zero-Knowledge Password Authentication
# ============================================================================

@router.post(
    "/register/start", 
    response_model=UserRegistrationStartResponse,
    summary="Start OPAQUE User Registration"
)
async def start_user_registration(
    request: UserRegistrationStartRequest,
    db: Session = Depends(get_db)
):
    """
    Start OPAQUE user registration process.
    
    This is the first phase of OPAQUE registration where the client submits
    a registration request and receives a registration response from the server.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Starting OPAQUE user registration for {request.userIdentifier}")
        
        # Create OPAQUE user service
        opaque_service = create_opaque_user_service(db)
        response = opaque_service.start_registration(request)
        
        logger.info(f"OPAQUE user registration started for {request.userIdentifier}")
        _ensure_constant_timing(start_time)
        
        return response
        
    except OpaqueUserRegistrationError as e:
        logger.error(f"OPAQUE registration start error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except OpaqueUserServiceError as e:
        logger.error(f"OPAQUE service error in registration start: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE registration start: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration start failed"
        )


@router.post(
    "/register/finish", 
    response_model=UserRegistrationFinishResponse,
    summary="Finish OPAQUE User Registration"
)
async def finish_user_registration(
    request: UserRegistrationFinishRequest,
    db: Session = Depends(get_db)
):
    """
    Complete OPAQUE user registration process.
    
    This is the second phase where the client submits the registration record
    and the user account is created with OPAQUE authentication.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Finishing OPAQUE user registration for {request.userIdentifier}")
        
        # Create OPAQUE user service
        opaque_service = create_opaque_user_service(db)
        response = opaque_service.finish_registration(request)
        
        logger.info(f"OPAQUE user registration completed for {request.userIdentifier}")
        _ensure_constant_timing(start_time)
        
        return response
        
    except OpaqueUserRegistrationError as e:
        logger.error(f"OPAQUE registration finish error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except OpaqueUserServiceError as e:
        logger.error(f"OPAQUE service error in registration finish: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE registration finish: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration finish failed"
        )


@router.post(
    "/login/start", 
    response_model=UserLoginStartResponse,
    summary="Start OPAQUE User Login"
)
async def start_user_login(
    request: UserLoginStartRequest,
    db: Session = Depends(get_db)
):
    """
    Start OPAQUE user login process.
    
    This is the first phase of OPAQUE authentication where the client submits
    a login request and receives a credential response from the server.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Starting OPAQUE user login for {request.userIdentifier}")
        
        # Create OPAQUE user service
        opaque_service = create_opaque_user_service(db)
        response = opaque_service.start_login(request)
        
        logger.info(f"OPAQUE user login started for {request.userIdentifier}")
        _ensure_constant_timing(start_time)
        
        return response
        
    except OpaqueUserAuthenticationError as e:
        logger.error(f"OPAQUE login start error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    except OpaqueUserServiceError as e:
        logger.error(f"OPAQUE service error in login start: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE login start: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login start failed"
        )


@router.post(
    "/login/finish", 
    response_model=UserLoginFinishResponse,
    summary="Finish OPAQUE User Login"
)
async def finish_user_login(
    request: UserLoginFinishRequest,
    db: Session = Depends(get_db)
):
    """
    Complete OPAQUE user login process.
    
    This is the second phase where the client completes the OPAQUE authentication
    and receives JWT tokens for API access. Users with OPAQUE accounts have
    opaque_envelope populated and google_id as NULL.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Finishing OPAQUE user login for {request.userIdentifier}")
        
        # Create OPAQUE user service
        opaque_service = create_opaque_user_service(db)
        response = opaque_service.finish_login(request)
        
        logger.info(f"OPAQUE user login completed for {request.userIdentifier}")
        _ensure_constant_timing(start_time)
        
        return response
        
    except OpaqueUserAuthenticationError as e:
        logger.error(f"OPAQUE login finish error: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    except OpaqueUserServiceError as e:
        logger.error(f"OPAQUE service error in login finish: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error in OPAQUE login finish: {e}")
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login finish failed"
        )


# ============================================================================
# Token Management (Shared by OAuth and OPAQUE)
# ============================================================================

@router.post("/token/refresh", response_model=Token, summary="Refresh Access Token")
async def refresh_access_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> Any:
    """Refresh access token using a refresh token (OAuth users only)."""
    start_time = time.time()
    logger.info("Token refresh attempt")
    
    try:
        new_token_payload = auth_service.refresh_token(
            db=db, refresh_token=refresh_data.refresh_token
        )

        logger.info(f"Successful token refresh for user ID: {new_token_payload['user_id']}")
        _ensure_constant_timing(start_time)
        
        return {
            "access_token": new_token_payload["access_token"],
            "refresh_token": None,
            "token_type": "bearer",
            "user": None,
        }
    except HTTPException:
        _ensure_constant_timing(start_time)
        raise
    except Exception as e:
        logger.error(f"Unexpected token refresh error: {str(e)}", exc_info=True)
        _ensure_constant_timing(start_time)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during token refresh.",
        ) from e


@router.post("/logout", summary="Logout")
async def logout(
    request: Request,
    db: Session = Depends(get_db),
) -> Any:
    """Logout endpoint (placeholder for any cleanup operations)."""
    logger.info("Logout request received")
    return {"message": "Logged out successfully"}


# ============================================================================
# Health Check and Status
# ============================================================================

@router.get("/health", summary="Authentication Health Check")
async def auth_health_check() -> Dict[str, Any]:
    """Health check for the unified authentication system."""
    return {
        "status": "healthy",
        "service": "unified-auth-v1",
        "version": "1.0.0",
        "features": [
            "oauth-google",
            "opaque-user-auth",
            "jwt-tokens",
            "timing-protection"
        ],
        "timestamp": time.time()
    }


@router.get("/status", response_model=OpaqueUserAuthStatusResponse, summary="Authentication Status")
async def auth_status() -> OpaqueUserAuthStatusResponse:
    """Get authentication system status and supported features."""
    return OpaqueUserAuthStatusResponse() 