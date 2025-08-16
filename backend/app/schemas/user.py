from datetime import datetime, date
from typing import Dict, Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic import EmailStr


# Base model for shared properties
class UserBase(BaseModel):
    email: EmailStr

    # Personal Information Fields
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None  # Keep for backward compatibility
    display_name: str | None = None
    bio: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None

    # User Preferences & Localization
    timezone: str = Field(default="timezone.utc", max_length=50)
    language_code: str = Field(default="en", max_length=10)
    theme_preference: str = Field(default="system", pattern="^(light|dark|system)$")
    notification_preferences: Dict[str, Any] = Field(default_factory=dict)
    privacy_settings: Dict[str, Any] = Field(default_factory=dict)

    # Legacy fields (maintain compatibility)
    is_active: bool = True
    is_superuser: bool = False

    # Enhanced User Experience
    avatar_url: str | None = Field(None, max_length=500)
    cover_image_url: str | None = Field(None, max_length=500)

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v is not None and len(v) > 20:
            raise ValueError('Phone number too long')
        return v

    @field_validator('display_name')
    @classmethod
    def validate_display_name(cls, v):
        if v is not None and len(v) > 150:
            raise ValueError('Display name too long')
        return v


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str | None = None
    google_id: str | None = None

    # Analytics & Insights (for registration)
    registration_source: str | None = Field(None, max_length=50)
    referral_code: str | None = Field(None, max_length=20)
    referred_by_user_id: UUID | None = None
    user_agent: str | None = None

    # Security & Compliance (for registration)
    terms_accepted_at: datetime | None = None
    privacy_policy_accepted_at: datetime | None = None


# Properties to receive via API on update
class UserUpdate(BaseModel):
    email: EmailStr | None = None

    # Personal Information Fields
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None  # Keep for backward compatibility
    display_name: str | None = None
    bio: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None

    # User Preferences & Localization
    timezone: str | None = Field(None, max_length=50)
    language_code: str | None = Field(None, max_length=10)
    theme_preference: str | None = Field(None, pattern="^(light|dark|system)$")
    notification_preferences: Dict[str, Any] | None = None
    privacy_settings: Dict[str, Any] | None = None

    # Enhanced User Experience
    avatar_url: str | None = Field(None, max_length=500)
    cover_image_url: str | None = Field(None, max_length=500)

    # Legacy fields
    is_active: bool | None = None
    is_superuser: bool | None = None
    password: str | None = None

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v is not None and len(v) > 20:
            raise ValueError('Phone number too long')
        return v

    @field_validator('display_name')
    @classmethod
    def validate_display_name(cls, v):
        if v is not None and len(v) > 150:
            raise ValueError('Display name too long')
        return v


# Additional properties stored in DB
class UserInDBBase(UserBase):
    id: UUID

    # Flexible User Tier Foundation
    account_tier: str = "free"
    tier_metadata: Dict[str, Any] = Field(default_factory=dict)
    subscription_status: str = "none"
    subscription_expires_at: datetime | None = None

    # Enhanced User Experience
    onboarding_completed: bool = False
    last_seen_at: datetime | None = None
    login_count: int = 0

    # Security & Compliance
    email_verified: bool = False
    phone_verified: bool = False
    two_factor_enabled: bool = False
    terms_accepted_at: datetime | None = None
    privacy_policy_accepted_at: datetime | None = None

    # Analytics & Insights (privacy-conscious)
    registration_source: str | None = None
    referral_code: str | None = None
    referred_by_user_id: UUID | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Additional properties to return via API
class User(UserInDBBase):
    google_id: str | None = None


# Additional properties stored in DB but not returned by API
class UserInDB(UserInDBBase):
    hashed_password: str | None = None
    google_id: str | None = None
    user_agent: str | None = None  # Keep private
    ip_address_hash: str | None = None  # Keep private


# Schema for user preferences management
class UserPreferences(BaseModel):
    timezone: str = Field(default="timezone.utc", max_length=50)
    language_code: str = Field(default="en", max_length=10)
    theme_preference: str = Field(default="system", pattern="^(light|dark|system)$")
    notification_preferences: Dict[str, Any] = Field(default_factory=dict)
    privacy_settings: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


# Schema for user profile management
class UserProfile(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    display_name: str | None = None
    bio: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    avatar_url: str | None = Field(None, max_length=500)
    cover_image_url: str | None = Field(None, max_length=500)

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v is not None and len(v) > 20:
            raise ValueError('Phone number too long')
        return v

    @field_validator('display_name')
    @classmethod
    def validate_display_name(cls, v):
        if v is not None and len(v) > 150:
            raise ValueError('Display name too long')
        return v

    model_config = ConfigDict(from_attributes=True)


# Schema for user subscription information
class UserSubscription(BaseModel):
    account_tier: str
    tier_metadata: Dict[str, Any]
    subscription_status: str
    subscription_expires_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# Schema for user security information
class UserSecurity(BaseModel):
    email_verified: bool
    phone_verified: bool
    two_factor_enabled: bool
    terms_accepted_at: datetime | None = None
    privacy_policy_accepted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# Schema for returning user statistics
class UserStats(BaseModel):
    total_entries: int
    current_streak: int
    longest_streak: int
    entries_today: int
    entries_this_week: int

    # Enhanced user stats
    login_count: int = 0
    last_seen_at: datetime | None = None
    account_tier: str = "free"
    onboarding_completed: bool = False
    days_since_registration: int = 0

    model_config = ConfigDict(from_attributes=True)


# Schema for avatar upload response
class AvatarUploadResponse(BaseModel):
    avatar_url: str


# Schema for email verification
class EmailVerificationRequest(BaseModel):
    email: EmailStr


# Schema for phone verification
class PhoneVerificationRequest(BaseModel):
    phone: str = Field(..., max_length=20)


# Schema for verification response
class VerificationResponse(BaseModel):
    success: bool
    message: str
    verification_token: str | None = None


# Schema for terms/privacy acceptance
class TermsAcceptanceRequest(BaseModel):
    terms_accepted: bool = True
    privacy_policy_accepted: bool = True


# Schema for referral information
class ReferralInfo(BaseModel):
    referral_code: str
    referred_users_count: int = 0
    total_referrals: int = 0

    model_config = ConfigDict(from_attributes=True)


# Schema for user onboarding
class OnboardingUpdate(BaseModel):
    onboarding_completed: bool = True
    onboarding_step: str | None = None
    onboarding_data: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)
