import logging

from fastapi import Depends, Request
from fastapi import HTTPException
from fastapi import status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session
from typing import Optional

from app.core.config import settings

# Use absolute imports for specific modules/classes needed
from app.db.session import SessionLocal
from app.models.user import User
from app.models.secret_tag_opaque import OpaqueSession
from app.schemas.token import TokenPayload

# Import the user service
from app.services.user_service import user_service

# Import session service for OPAQUE session management
from app.services.session_service import session_service, SessionValidationError

logger = logging.getLogger(__name__)

# OAuth2 scheme for traditional user account management
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login/json")

# HTTP Bearer scheme for OPAQUE session tokens
session_bearer = HTTPBearer(auto_error=False)


def get_db():
    """Dependency to get a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    Dependency for traditional user account management authentication.
    Used for user registration, profile management, and OPAQUE tag registration.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            logger.warning("JWT token missing 'sub' claim.")
            raise credentials_exception from None
        token_payload = TokenPayload(sub=username)
    except JWTError as e:
        logger.error(f"JWT decoding error: {e}", exc_info=True)
        raise credentials_exception from e
    except ValidationError as e:
        logger.error(f"Token payload validation error: {e}", exc_info=True)
        raise credentials_exception from e

    # Fetch user using the username extracted from the token's 'sub' claim
    user = user_service.get_by_email(db, email=str(token_payload.sub))

    if user is None:
        logger.warning(f"User with email {token_payload.sub} from token not found in DB.")
        raise credentials_exception from None

    return user


async def get_current_user_from_session_token(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(session_bearer)
) -> User:
    """
    Dependency to get the current user from an OPAQUE session token.
    Used for secret tag authentication and vault access.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate session credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        logger.debug("No session credentials provided")
        raise credentials_exception
    
    try:
        # Extract client information for fingerprinting
        user_agent = request.headers.get("user-agent", "")
        # Get client IP (considering proxy headers)
        ip_address = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not ip_address:
            ip_address = request.headers.get("x-real-ip", "")
        if not ip_address:
            ip_address = getattr(request.client, "host", "")
        
        # Validate session token
        session = session_service.validate_session_token(
            db=db,
            token=credentials.credentials,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        if not session:
            logger.debug("Invalid or expired session token")
            raise credentials_exception
        
        # Get user from session
        user = user_service.get_by_id(db, user_id=session.user_id)
        if not user:
            logger.warning(f"User {session.user_id} from session not found in DB")
            raise credentials_exception
        
        # Store session in request state for later use
        request.state.opaque_session = session
        
        logger.debug(f"Authenticated user {user.email} via session token")
        return user
        
    except SessionValidationError as e:
        logger.error(f"Session validation error: {str(e)}")
        raise credentials_exception from e
    except Exception as e:
        logger.error(f"Unexpected error in session authentication: {str(e)}")
        raise credentials_exception from e


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency to get the current active user for traditional endpoints.
    """
    if not current_user.is_active:
        logger.warning(f"Inactive user attempted access: {current_user.email}")
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_active_user_from_session(
    current_user: User = Depends(get_current_user_from_session_token),
) -> User:
    """
    Dependency to get the current active user from OPAQUE session token.
    """
    if not current_user.is_active:
        logger.warning(f"Inactive user attempted access via session: {current_user.email}")
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_opaque_session(request: Request) -> Optional[OpaqueSession]:
    """
    Dependency to get the current OPAQUE session if available.
    Returns None if no session is available.
    """
    return getattr(request.state, 'opaque_session', None)
