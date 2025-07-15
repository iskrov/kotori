"""enhance_users_table_mobile_app_management

Revision ID: a8fa7e169899
Revises: a90e90c33c6f
Create Date: 2025-07-14 12:13:52.571017

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = 'a8fa7e169899'
down_revision = 'a90e90c33c6f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Enhance users table with comprehensive mobile app user management fields.
    
    This migration adds:
    1. Personal Information Fields (first_name, last_name, display_name, bio, phone, date_of_birth)
    2. User Preferences & Localization (timezone, language_code, theme_preference, notification_preferences, privacy_settings)
    3. Flexible User Tier Foundation (account_tier, tier_metadata, subscription_status, subscription_expires_at)
    4. Enhanced User Experience (onboarding_completed, last_seen_at, login_count, avatar_url, cover_image_url)
    5. Security & Compliance (email_verified, phone_verified, two_factor_enabled, terms_accepted_at, privacy_policy_accepted_at)
    6. Analytics & Insights (registration_source, referral_code, referred_by_user_id, user_agent, ip_address_hash)
    """
    
    # Personal Information Fields
    op.add_column('users', sa.Column('first_name', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('display_name', sa.String(150), nullable=True))
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))
    
    # User Preferences & Localization
    op.add_column('users', sa.Column('timezone', sa.String(50), nullable=False, server_default='UTC'))
    op.add_column('users', sa.Column('language_code', sa.String(10), nullable=False, server_default='en'))
    op.add_column('users', sa.Column('theme_preference', sa.String(20), nullable=False, server_default='system'))
    op.add_column('users', sa.Column('notification_preferences', JSONB, nullable=False, server_default='{}'))
    op.add_column('users', sa.Column('privacy_settings', JSONB, nullable=False, server_default='{}'))
    
    # Flexible User Tier Foundation
    op.add_column('users', sa.Column('account_tier', sa.String(50), nullable=False, server_default='free'))
    op.add_column('users', sa.Column('tier_metadata', JSONB, nullable=False, server_default='{}'))
    op.add_column('users', sa.Column('subscription_status', sa.String(20), nullable=False, server_default='none'))
    op.add_column('users', sa.Column('subscription_expires_at', sa.DateTime(timezone=True), nullable=True))
    
    # Enhanced User Experience
    op.add_column('users', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('login_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('avatar_url', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('cover_image_url', sa.String(500), nullable=True))
    
    # Security & Compliance
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('phone_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('two_factor_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('privacy_policy_accepted_at', sa.DateTime(timezone=True), nullable=True))
    
    # Analytics & Insights (privacy-conscious)
    op.add_column('users', sa.Column('registration_source', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('referral_code', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('referred_by_user_id', sa.UUID(), nullable=True))
    op.add_column('users', sa.Column('user_agent', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('ip_address_hash', sa.String(64), nullable=True))
    
    # Create indexes for performance
    op.create_index('idx_users_account_tier', 'users', ['account_tier'])
    op.create_index('idx_users_subscription_status', 'users', ['subscription_status'])
    op.create_index('idx_users_email_verified', 'users', ['email_verified'])
    op.create_index('idx_users_last_seen_at', 'users', ['last_seen_at'])
    op.create_index('idx_users_registration_source', 'users', ['registration_source'])
    op.create_index('idx_users_referred_by_user_id', 'users', ['referred_by_user_id'])
    
    # Add constraints for data integrity
    op.create_check_constraint(
        'chk_users_account_tier',
        'users',
        "account_tier IN ('free', 'premium', 'enterprise', 'admin')"
    )
    
    op.create_check_constraint(
        'chk_users_subscription_status',
        'users',
        "subscription_status IN ('none', 'active', 'cancelled', 'expired', 'trial')"
    )
    
    op.create_check_constraint(
        'chk_users_theme_preference',
        'users',
        "theme_preference IN ('light', 'dark', 'system')"
    )
    
    # Add self-referential foreign key for referrals
    op.create_foreign_key(
        'fk_users_referred_by',
        'users',
        'users',
        ['referred_by_user_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """
    Rollback users table enhancements.
    
    This removes all the mobile app user management fields added in the upgrade.
    """
    
    # Remove foreign key constraint
    op.drop_constraint('fk_users_referred_by', 'users', type_='foreignkey')
    
    # Remove check constraints
    op.drop_constraint('chk_users_theme_preference', 'users', type_='check')
    op.drop_constraint('chk_users_subscription_status', 'users', type_='check')
    op.drop_constraint('chk_users_account_tier', 'users', type_='check')
    
    # Remove indexes
    op.drop_index('idx_users_referred_by_user_id', 'users')
    op.drop_index('idx_users_registration_source', 'users')
    op.drop_index('idx_users_last_seen_at', 'users')
    op.drop_index('idx_users_email_verified', 'users')
    op.drop_index('idx_users_subscription_status', 'users')
    op.drop_index('idx_users_account_tier', 'users')
    
    # Remove Analytics & Insights columns
    op.drop_column('users', 'ip_address_hash')
    op.drop_column('users', 'user_agent')
    op.drop_column('users', 'referred_by_user_id')
    op.drop_column('users', 'referral_code')
    op.drop_column('users', 'registration_source')
    
    # Remove Security & Compliance columns
    op.drop_column('users', 'privacy_policy_accepted_at')
    op.drop_column('users', 'terms_accepted_at')
    op.drop_column('users', 'two_factor_enabled')
    op.drop_column('users', 'phone_verified')
    op.drop_column('users', 'email_verified')
    
    # Remove Enhanced User Experience columns
    op.drop_column('users', 'cover_image_url')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'login_count')
    op.drop_column('users', 'last_seen_at')
    op.drop_column('users', 'onboarding_completed')
    
    # Remove Flexible User Tier Foundation columns
    op.drop_column('users', 'subscription_expires_at')
    op.drop_column('users', 'subscription_status')
    op.drop_column('users', 'tier_metadata')
    op.drop_column('users', 'account_tier')
    
    # Remove User Preferences & Localization columns
    op.drop_column('users', 'privacy_settings')
    op.drop_column('users', 'notification_preferences')
    op.drop_column('users', 'theme_preference')
    op.drop_column('users', 'language_code')
    op.drop_column('users', 'timezone')
    
    # Remove Personal Information Fields
    op.drop_column('users', 'date_of_birth')
    op.drop_column('users', 'phone')
    op.drop_column('users', 'bio')
    op.drop_column('users', 'display_name')
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
