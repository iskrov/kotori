import uuid
from sqlalchemy import Boolean, Column, String, Date, Integer, Text, ForeignKey, LargeBinary
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .base import Base, UUID
from .base import TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    
    # OPAQUE authentication - nullable for OAuth-only users
    opaque_envelope = Column(LargeBinary, nullable=True)  # OPAQUE envelope for password-based auth
    
    # OAuth authentication - nullable for OPAQUE-only users  
    google_id = Column(String, unique=True, nullable=True)
    
    # Secret tag preferences
    show_secret_tag_names = Column(Boolean, nullable=False, default=True)
    
    # Personal Information Fields
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    full_name = Column(String, nullable=True)  # Keep for backward compatibility
    display_name = Column(String(150), nullable=True)
    bio = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    
    # User Preferences & Localization
    timezone = Column(String(50), nullable=False, default='timezone.utc')
    language_code = Column(String(10), nullable=False, default='en')
    theme_preference = Column(String(20), nullable=False, default='system')
    notification_preferences = Column(JSONB, nullable=False, default=dict)
    privacy_settings = Column(JSONB, nullable=False, default=dict)
    
    # Flexible User Tier Foundation
    account_tier = Column(String(50), nullable=False, default='free')
    tier_metadata = Column(JSONB, nullable=False, default=dict)
    subscription_status = Column(String(20), nullable=False, default='none')
    subscription_expires_at = Column(TimestampMixin.updated_at.type, nullable=True)
    
    # Enhanced User Experience
    onboarding_completed = Column(Boolean, nullable=False, default=False)
    last_seen_at = Column(TimestampMixin.updated_at.type, nullable=True)
    login_count = Column(Integer, nullable=False, default=0)
    avatar_url = Column(String(500), nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    
    # Security & Compliance
    email_verified = Column(Boolean, nullable=False, default=False)
    phone_verified = Column(Boolean, nullable=False, default=False)
    two_factor_enabled = Column(Boolean, nullable=False, default=False)
    terms_accepted_at = Column(TimestampMixin.updated_at.type, nullable=True)
    privacy_policy_accepted_at = Column(TimestampMixin.updated_at.type, nullable=True)
    
    # Analytics & Insights (privacy-conscious)
    registration_source = Column(String(50), nullable=True)
    referral_code = Column(String(20), nullable=True)
    referred_by_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    user_agent = Column(Text, nullable=True)
    ip_address_hash = Column(String(64), nullable=True)
    
    # Legacy fields (maintain compatibility)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    


    # Relationships
    journal_entries = relationship("JournalEntry", back_populates="user")
    reminders = relationship("Reminder", back_populates="user")
    # secret_tags relationship removed in PBI-4 Stage 2
    tags = relationship("Tag", back_populates="user", cascade="all, delete-orphan")
    shares = relationship("Share", back_populates="user", cascade="all, delete-orphan")
    
    # Self-referential relationship for referrals
    referred_users = relationship("User", backref="referred_by", remote_side=[id])
    
    # Table constraints (will be added in migration)
    __table_args__ = (
        # These constraints will be added in the migration file
    )
