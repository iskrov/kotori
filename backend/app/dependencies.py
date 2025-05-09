import logging

from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings

# Use absolute imports for specific modules/classes needed
from app.db.session import SessionLocal
from app.models.user import User  # Import the User model

# Assuming TokenPayload schema is in schemas/token.py and holds the subject
from app.schemas.token import TokenPayload  # Correctly import TokenPayload

# Import the user service instead of a crud module
from app.services.user_service import user_service

logger = logging.getLogger(__name__)

# Reusable OAuth2 scheme
# The tokenUrl should point to your login endpoint (where tokens are issued)
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login/json"
)  # Adjust tokenUrl if needed


def get_db():
    """Dependency to get a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User: # Use the imported User model
    """
    Dependency to get the current user from the JWT token.
    Raises HTTPException if the token is invalid or the user is not found.
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
        token_payload = TokenPayload(sub=username) # Use TokenPayload
    except JWTError as e:
        logger.error(f"JWT decoding error: {e}", exc_info=True)
        raise credentials_exception from e
    except ValidationError as e:
        logger.error(f"Token payload validation error: {e}", exc_info=True)
        raise credentials_exception from e

    # Fetch user using the username extracted from the token's 'sub' claim
    # Ensure the user_service.get_by_email expects the correct type for username (e.g., str)
    user = user_service.get_by_email(db, email=str(token_payload.sub)) # Use token_payload.sub

    if user is None:
        logger.warning(f"User with email {token_payload.sub} from token not found in DB.")
        raise credentials_exception from None

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User: # Use the imported User model
    """
    Dependency to get the current active user.
    Raises HTTPException if the user is inactive.
    """
    if not current_user.is_active:
        logger.warning(f"Inactive user attempted access: {current_user.email}")
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User: # Use the imported User model
    """
    Dependency to get the current active superuser.
    Raises HTTPException if the user is not a superuser.
    """
    # Check the is_superuser property directly on the User model
    if not current_user.is_superuser:
        logger.warning(
            f"Non-superuser attempted superuser access: {current_user.email}"
        )
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
