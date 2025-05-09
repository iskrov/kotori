
from pydantic import BaseModel

from .user import User  # Import User schema


class Token(BaseModel):
    access_token: str
    refresh_token: str | None = None  # Added refresh token field
    token_type: str = "bearer"
    user: User | None = None  # Made user optional for refresh


class TokenPayload(BaseModel):
    sub: int | None = None
    type: str | None = None  # Added type field


class GoogleAuthRequest(BaseModel):
    token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
