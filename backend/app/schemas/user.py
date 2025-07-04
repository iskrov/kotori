from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic import EmailStr


# Base model for shared properties
class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    is_active: bool = True
    is_superuser: bool = False
    profile_picture: str | None = None


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str | None = None
    google_id: str | None = None


# Properties to receive via API on update
class UserUpdate(UserBase):
    password: str | None = None


# Additional properties stored in DB
class UserInDBBase(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Additional properties to return via API
class User(UserInDBBase):
    pass


# Additional properties stored in DB but not returned by API
class UserInDB(UserInDBBase):
    hashed_password: str | None = None
    google_id: str | None = None


# Schema for returning user statistics
class UserStats(BaseModel):
    total_entries: int
    current_streak: int
    longest_streak: int
    entries_this_week: int


# Schema for profile picture upload response
class ProfilePictureUploadResponse(BaseModel):
    profile_picture_url: str
