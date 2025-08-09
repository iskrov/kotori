"""
Authentication routes for the Kotori application.

This module provides endpoints for user authentication, registration, and session management.
It includes support for both traditional email/password authentication and OPAQUE protocol
for secure password authentication.
"""

import logging
import traceback
from datetime import timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi import Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..core import security
from ..core.config import settings
from ..dependencies import get_db, get_current_user
from ..schemas.token import GoogleAuthRequest
from ..schemas.token import RefreshTokenRequest
from ..schemas.token import Token
from ..schemas.user import User as UserSchema
from ..schemas.user import UserCreate
from ..services import auth_service
from ..services.user_service import user_service
from ..core.security import create_access_token, verify_password, audit_authentication_event

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


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


# Common authentication logic for username/password flows
async def _authenticate_user_and_get_tokens(
    db: Session,
    email: str,
    password: str
) -> dict:
    """Authenticates a user and returns token response or raises HTTPException."""
    user = auth_service.authenticate(db, email=email, password=password)
    if not user:
        logger.warning(f"Failed login attempt for email: {email} - Invalid credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        logger.warning(f"Login attempt for inactive user: {email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Please contact support.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.info(f"Successful authentication for user: {email}")
    return _create_token_response(user, settings.ACCESS_TOKEN_EXPIRE_MINUTES)


@router.post("/login", response_model=Token)
async def login_access_token(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests (form data)."""
    logger.info(f"Form login attempt for email: {form_data.username}")
    try:
        return await _authenticate_user_and_get_tokens(
            db, email=form_data.username, password=form_data.password
        )
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Login ValueError for {form_data.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except Exception as e:
        logger.error(f"Unexpected login error for email {form_data.username}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during login. Please try again.",
        ) from e


@router.post("/login/json", response_model=Token)
async def login_json(
    request: Request,
    email: str = Body(...),
    password: str = Body(...),
    db: Session = Depends(get_db),
) -> Any:
    """Login endpoint that accepts JSON payload."""
    logger.info(f"JSON login attempt for email: {email}")
    try:
        return await _authenticate_user_and_get_tokens(
            db, email=email, password=password
        )
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Login ValueError for {email} (JSON): {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except Exception as e:
        logger.error(f"Unexpected JSON login error for email {email}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during login. Please try again.",
        ) from e


@router.post("/google", response_model=Token)
async def login_google(
    request: Request,
    google_data: GoogleAuthRequest,
    db: Session = Depends(get_db),
) -> Any:
    """Google auth token login, get an access token for future requests"""
    logger.info("Google login attempt")
    try:
        user = auth_service.authenticate_google(db, token=google_data.token)

        if not user:
            logger.warning("Failed Google login attempt - user not authenticated or found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google authentication credentials or user not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            logger.warning(f"Google login attempt for inactive user: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is inactive. Please contact support.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.info(f"Successful Google authentication for user: {user.email}")
        return _create_token_response(user, settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    except ValueError as e:
        logger.error(f"Google Sign-In ValueError: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {e}",
        ) from e
    except Exception as e:
        logger.error(f"Unexpected Google login error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during Google login. Please try again.",
        ) from e


@router.post("/register", response_model=Token)
async def register_user(
    request: Request,
    user_in: UserCreate,
    db: Session = Depends(get_db),
) -> Any:
    """Register a new user"""
    logger.info(f"Registration attempt for email: {user_in.email}")
    try:
        existing_user = user_service.get_by_email(db, email=user_in.email)
        if existing_user:
            logger.warning(f"Registration attempt with existing email: {user_in.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists. Please login or use a different email.",
            )

        new_user = user_service.create(db, obj_in=user_in)
        logger.info(f"Successfully registered user: {new_user.email} (ID: {new_user.id})")

        return _create_token_response(new_user, settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Registration ValueError for email {user_in.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error(f"Unexpected registration error for email {user_in.email}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during registration. Please try again.",
        ) from e


@router.get("/me", response_model=UserSchema)
async def read_current_user(
    request: Request,
    current_user_from_token: UserSchema = Depends(get_current_user)
) -> Any:
    """Get current user"""
    logger.info(f"Fetching current user data for: {current_user_from_token.email}")
    return current_user_from_token


@router.get(
    "/test-user",
    response_model=UserSchema,
    include_in_schema=settings.ENVIRONMENT == "development",
)
async def create_test_user(
    request: Request,
    db: Session = Depends(get_db),
) -> Any:
    """Create a test user (dev only). Returns the created or existing test user."""
    if settings.ENVIRONMENT != "development":
        logger.warning("Attempt to access /test-user in non-development environment.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found in this environment.",
        )
    try:
        logger.info("Attempting to create/fetch test user")
        test_user = user_service.create_test_user(db)
        logger.info(f"Test user operation successful for: {test_user.email}")
        return test_user
    except Exception as e:
        logger.error(f"Unexpected error creating test user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the test user.",
        ) from e


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(
    request: Request,
    _: UserSchema = Depends(get_current_user)
) -> None:
    """Logout user (currently a placeholder, relies on client deleting token)."""
    logger.info(f"Logout request processed for authenticated user.")
    return None


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> Any:
    """Refresh access token using a refresh token."""
    logger.info("Token refresh attempt")
    try:
        new_token_payload = auth_service.refresh_token(
            db=db, refresh_token=refresh_data.refresh_token
        )

        logger.info(
            f"Successful token refresh for user ID: {new_token_payload['user_id']}"
        )
        return {
            "access_token": new_token_payload["access_token"],
            "refresh_token": None,
            "token_type": "bearer",
            "user": None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected token refresh error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during token refresh.",
        ) from e
