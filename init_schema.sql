-- Initialize Kotori database schema
-- This creates all essential tables needed for the application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
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
    referred_by_user_id UUID REFERENCES users(id),
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

-- Create opaque_sessions table (essential for OPAQUE auth)
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

-- Create opaque_server_configs table (essential for OPAQUE auth)
CREATE TABLE IF NOT EXISTS opaque_server_configs (
    id VARCHAR PRIMARY KEY DEFAULT 'default',
    server_setup TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    description VARCHAR(255) DEFAULT 'Default OPAQUE server configuration'
);

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR,
    content TEXT,
    audio_url VARCHAR,
    entry_date TIMESTAMPTZ NOT NULL,
    encrypted_content BYTEA,
    wrapped_key BYTEA,
    encryption_iv BYTEA,
    wrap_iv BYTEA,
    encryption_algorithm VARCHAR,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_journal_entries_id ON journal_entries(id);
CREATE INDEX IF NOT EXISTS ix_journal_entries_user_id ON journal_entries(user_id);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    color VARCHAR,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_tag UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS ix_tags_id ON tags(id);
CREATE INDEX IF NOT EXISTS ix_tags_user_id ON tags(user_id);

-- Create journal_entry_tags table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS journal_entry_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES journal_entries(id),
    tag_id UUID NOT NULL REFERENCES tags(id)
);

CREATE INDEX IF NOT EXISTS ix_journal_entry_tags_id ON journal_entry_tags(id);

-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,
    message VARCHAR NOT NULL,
    frequency VARCHAR NOT NULL CHECK (frequency IN ('daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'custom')),
    time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    custom_days VARCHAR,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_reminders_id ON reminders(id);
CREATE INDEX IF NOT EXISTS ix_reminders_user_id ON reminders(user_id);

-- Create update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opaque_sessions_updated_at BEFORE UPDATE ON opaque_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opaque_server_configs_updated_at BEFORE UPDATE ON opaque_server_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify tables were created
SELECT 'Schema initialization completed successfully!' as result;
SELECT 'Created tables: ' || string_agg(tablename, ', ') as tables_created 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'opaque_sessions', 'opaque_server_configs', 'journal_entries', 'tags', 'journal_entry_tags', 'reminders');
