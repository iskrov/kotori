import logging

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError
from jose import jwt
from sqlalchemy.orm import Session
from google.auth.transport import requests
from google.oauth2 import id_token

from ..core.config import settings
from ..core.security import create_access_token
from ..core.security import verify_password
from ..models.user import User
from .user_service import user_service

logger = logging.getLogger(__name__)


class AuthService:
    def authenticate(self, db: Session, *, email: str, password: str) -> User | None:
        """Authenticate a user with email and password"""
        user = user_service.get_by_email(db, email=email)

        # Removed auto-creation of test user during authentication
        # Test users should be created via fixtures or specific dev endpoints
        if not user:
            return None

        if not user.hashed_password:
            # User might exist but have registered via OAuth, no password set
            return None

        if not verify_password(password, user.hashed_password):
            return None

        return user

    def authenticate_google(self, db: Session, *, token: str) -> User | None:
        """
        Authenticate a user with a Google ID token.
        Verifies the token with Google and creates/updates user.
        """
        try:
            # Check if we have Google client ID configured
            if not settings.GOOGLE_CLIENT_ID:
                logger.error("GOOGLE_CLIENT_ID not configured")
                return None
                
            # Verify the Google ID token; allow multiple client IDs (web/ios/android)
            audience_candidates = [cid for cid in [
                getattr(settings, 'GOOGLE_CLIENT_ID', None),
                getattr(settings, 'GOOGLE_WEB_CLIENT_ID', None),
                getattr(settings, 'GOOGLE_IOS_CLIENT_ID', None),
                getattr(settings, 'GOOGLE_ANDROID_CLIENT_ID', None)
            ] if cid]

            verify_audience = audience_candidates[0] if audience_candidates else None
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                verify_audience,
            )
            
            # Validate issuer
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                logger.error("Invalid Google token issuer: %s", idinfo.get('iss'))
                return None
                
            # Extract user info
            google_id = idinfo['sub']
            email = idinfo['email']
            name = idinfo.get('name', '')
            
            logger.info(f"Google auth successful for email: {email}")
            
            # Find or create user
            user = db.query(User).filter(User.google_id == google_id).first()
            
            if not user:
                # Check if user exists with same email but different auth method
                existing_user = db.query(User).filter(User.email == email).first()
                if existing_user and existing_user.opaque_envelope is not None:
                    # User has OPAQUE account - don't allow Google auth
                    logger.warning(f"User {email} has OPAQUE account, cannot use Google auth")
                    return None
                
                # Create new Google user
                user = User(
                    email=email,
                    full_name=name,
                    google_id=google_id,
                    is_active=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                    # Google users don't have OPAQUE envelope
                    opaque_envelope=None
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                
                logger.info(f"Created new Google user: {email}")
            else:
                # Update existing user info
                user.full_name = name
                user.email = email
                user.updated_at = datetime.now(timezone.utc)
                db.commit()
                
                logger.info(f"Updated existing Google user: {email}")
            
            return user
            
        except ValueError as e:
            logger.error(f"Invalid Google token: {e}")
            return None
        except Exception as e:
            logger.error(f"Google authentication error: {e}", exc_info=True)
            return None

    def refresh_token(
        self, db: Session, *, refresh_token: str
    ) -> dict[str, Any] | None:
        """Verify refresh token and issue new access token"""
        try:
            payload = jwt.decode(
                refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            token_type = payload.get("type")
            user_id = payload.get("sub")

            if token_type != "refresh" or user_id is None:
                # Invalid token type or missing user ID
                return None

            user = user_service.get(db, id=user_id)  # Remove int() conversion
            if not user or not user.is_active:
                # User not found or inactive
                return None

            # Issue a new access token
            access_token_expires = timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
            new_access_token = create_access_token(
                user.id, expires_delta=access_token_expires
            )

            return {
                "access_token": new_access_token,
                "user_id": user.id,
                # Add logic here if you want rotating refresh tokens
            }
        except JWTError:
            # Token is invalid or expired
            return None
        except Exception as e:
            # Handle potential errors like user_service.get failing
            print(f"Error during token refresh: {e}")  # Basic logging
            return None


# Create singleton instance
auth_service = AuthService()
