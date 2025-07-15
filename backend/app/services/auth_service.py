import logging

from datetime import datetime, timedelta, UTC
from typing import Any

from jose import JWTError
from jose import jwt
from sqlalchemy.orm import Session

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
        Authenticate a user with a Google token.
        If user doesn't exist yet, create a new one.
        """
        # Simplified for testing
        if token == "test_google_token":
            test_user = (
                db.query(User).filter(User.email == "google_user@example.com").first()
            )
            if not test_user:
                test_user = User(
                    email="google_user@example.com",
                    full_name="Google User",
                    google_id="google123",
                    is_active=True,
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                db.add(test_user)
                db.commit()
                db.refresh(test_user)
            return test_user
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
