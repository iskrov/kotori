-- Simple table creation for Kotori
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (essential)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR UNIQUE NOT NULL,
    opaque_envelope BYTEA,
    google_id VARCHAR UNIQUE,
    show_secret_tag_names BOOLEAN NOT NULL DEFAULT true,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR,
    display_name VARCHAR(150),
    bio TEXT,
    phone VARCHAR(20),
    date_of_birth DATE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'timezone.utc',
    language_code VARCHAR(10) NOT NULL DEFAULT 'en',
    theme_preference VARCHAR(20) NOT NULL DEFAULT 'system',
    notification_preferences JSONB NOT NULL DEFAULT '{}',
    privacy_settings JSONB NOT NULL DEFAULT '{}',
    account_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    tier_metadata JSONB NOT NULL DEFAULT '{}',
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'none',
    subscription_expires_at TIMESTAMPTZ,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    login_count INTEGER NOT NULL DEFAULT 0,
    avatar_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    email_verified BOOLEAN NOT NULL DEFAULT false,
    phone_verified BOOLEAN NOT NULL DEFAULT false,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    terms_accepted_at TIMESTAMPTZ,
    privacy_policy_accepted_at TIMESTAMPTZ,
    registration_source VARCHAR(50),
    referral_code VARCHAR(20),
    referred_by_user_id UUID,
    user_agent TEXT,
    ip_address_hash VARCHAR(64),
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS ix_users_id ON users(id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- Create opaque_sessions table (essential for auth)
CREATE TABLE IF NOT EXISTS opaque_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL,
    session_state VARCHAR(64) NOT NULL DEFAULT 'initialized',
    session_data BYTEA,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opaque_sessions_user_id ON opaque_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_opaque_sessions_expires_at ON opaque_sessions(expires_at);

-- Create opaque_server_configs table (essential for auth)
CREATE TABLE IF NOT EXISTS opaque_server_configs (
    id VARCHAR PRIMARY KEY DEFAULT 'default',
    server_setup TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    description VARCHAR(255) DEFAULT 'Default OPAQUE server configuration'
);

SELECT 'Essential tables created successfully!' as result;
