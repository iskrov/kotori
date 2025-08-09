# Database Schema Documentation

## Table of Contents
- [Overview](#overview)
- [Database Architecture](#database-architecture)
- [Schema Design](#schema-design)
- [Table Definitions](#table-definitions)
- [Relationships and Constraints](#relationships-and-constraints)
- [Indexes and Performance](#indexes-and-performance)
- [Data Types and Standards](#data-types-and-standards)
- [Security and Access Control](#security-and-access-control)
- [Backup and Recovery](#backup-and-recovery)
- [Monitoring and Maintenance](#monitoring-and-maintenance)

## Overview

This document provides comprehensive documentation of the database schema for the Vibes application. The schema is designed to support a personal journaling and reminder system with **dual authentication** (OAuth and OPAQUE), **zero-knowledge secret tags**, robust data integrity, optimal performance, and scalability.

### Database Technology
- **Database Engine**: PostgreSQL 14+
- **Primary Features**: ACID compliance, advanced indexing, full-text search
- **Extensions**: uuid-ossp for UUID generation, pg_stat_statements for monitoring
- **Character Set**: UTF-8 for international character support
- **Timezone**: UTC for consistent timestamp handling

### Design Principles
- **Normalization**: Third normal form (3NF) for data integrity
- **Referential Integrity**: Foreign key constraints throughout
- **UUID Primary Keys**: Globally unique identifiers for all entities
- **Dual Authentication**: Support for both OAuth (convenience) and OPAQUE (zero-knowledge)
- **Zero-Knowledge Security**: Server never stores passwords or secret phrases
- **Audit Trail**: Created/updated timestamps on all tables
- **Soft Deletes**: Logical deletion for data recovery capabilities
- **Performance**: Strategic indexing for common query patterns
- **Privacy by Design**: Minimal data collection, encrypted sensitive content

## Database Architecture

### Physical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL Database Cluster                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │  Primary Server │  │  Replica Server │                 │
│  │  (Read/Write)   │  │  (Read Only)    │                 │
│  │                 │  │                 │                 │
│  │  ┌───────────┐  │  │  ┌───────────┐  │                 │
│  │  │   vibes   │  │  │  │   vibes   │  │                 │
│  │  │ database  │◄─┼──┼──┤ database  │  │                 │
│  │  └───────────┘  │  │  └───────────┘  │                 │
│  └─────────────────┘  └─────────────────┘                 │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │  Backup Server  │  │ Monitoring DB   │                 │
│  │  (Point-in-Time)│  │ (Metrics/Logs)  │                 │
│  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Logical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Database Schema                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐                                       │
│  │  User Domain    │                                       │
│  │  ┌───────────┐  │                                       │
│  │  │   users   │  │ (Dual Auth: OAuth + OPAQUE)          │
│  │  └───────────┘  │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  ┌─────────────────┐                                       │
│  │ Content Domain  │                                       │
│  │  ┌───────────┐  │                                       │
│  │  │ journals  │  │                                       │
│  │  │   tags    │  │                                       │
│  │  │secret_tags│  │ (Zero-knowledge OPAQUE)               │
│  │  │tag_sessions│ │ (Ephemeral auth sessions)             │
│  │  └───────────┘  │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  ┌─────────────────┐                                       │
│  │ Encryption      │                                       │
│  │  ┌───────────┐  │                                       │
│  │  │wrapped_keys│ │ (AES-KW key storage)                  │
│  │  │vault_blobs │ │ (AES-GCM encrypted content)           │
│  │  └───────────┘  │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  ┌─────────────────┐                                       │
│  │ Task Domain     │                                       │
│  │  ┌───────────┐  │                                       │
│  │  │ reminders │  │                                       │
│  │  └───────────┘  │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  ┌─────────────────┐                                       │
│  │ System Domain   │                                       │
│  │  ┌───────────┐  │                                       │
│  │  │   logs    │  │                                       │
│  │  │ sessions  │  │                                       │
│  │  │migrations │  │                                       │
│  │  └───────────┘  │                                       │
│  └─────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

## Schema Design

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 Complete Schema Diagram                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐                                       │
│  │     users       │                                       │
│  │─────────────────│                                       │
│  │ id (UUID) PK    │◄──────────────────────┐               │
│  │ email (UNIQUE)  │                       │               │
│  │ google_id       │ (OAuth)               │               │
│  │ opaque_envelope │ (OPAQUE)              │               │
│  │ show_secret_tag │                       │               │
│  │ first_name      │                       │               │
│  │ last_name       │                       │               │
│  │ is_active       │                       │               │
│  │ created_at      │                       │               │
│  │ updated_at      │                       │               │
│  └─────────────────┘                       │               │
│         │                                  │               │
│         │ 1:N                              │               │
│         ▼                                  │               │
│  ┌─────────────────┐                       │               │
│  │    journals     │                       │               │
│  │─────────────────│                       │               │
│  │ id (UUID) PK    │                       │               │
│  │ user_id FK      │──────────────────────┘               │
│  │ title           │                                       │
│  │ content         │                                       │
│  │ mood_rating     │                                       │
│  │ is_private      │                                       │
│  │ word_count      │                                       │
│  │ created_at      │                                       │
│  │ updated_at      │                                       │
│  │ published_at    │                                       │
│  └─────────────────┘                                       │
│         │                                                  │
│         │ 1:N                                              │
│         ▼                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │      tags       │  │  secret_tags    │                 │
│  │─────────────────│  │─────────────────│                 │
│  │ id (UUID) PK    │  │ id (UUID) PK    │                 │
│  │ user_id FK      │  │ user_id FK      │                 │
│  │ name            │  │ tag_handle      │ (32 bytes)      │
│  │ color           │  │ opaque_envelope │ (OPAQUE)        │
│  │ created_at      │  │ tag_name        │                 │
│  │ updated_at      │  │ color           │                 │
│  └─────────────────┘  │ created_at      │                 │
│                        │ updated_at      │                 │
│                        └─────────────────┘                 │
│                               │                            │
│                               │ 1:N                        │
│                               ▼                            │
│                        ┌─────────────────┐                 │
│                        │  tag_sessions   │                 │
│                        │─────────────────│                 │
│                        │ id (UUID) PK    │                 │
│                        │ user_id FK      │                 │
│                        │ tag_id FK       │                 │
│                        │ server_ephemeral│                 │
│                        │ created_at      │                 │
│                        └─────────────────┘                 │
│                                                             │
│  ┌─────────────────┐                                       │
│  │   reminders     │                                       │
│  │─────────────────│                                       │
│  │ id (UUID) PK    │                                       │
│  │ user_id FK      │──────────────────────┐               │
│  │ title           │                      │               │
│  │ description     │                      │               │
│  │ reminder_time   │                      │               │
│  │ is_completed    │                      │               │
│  │ priority        │                      │               │
│  │ repeat_pattern  │                      │               │
│  │ created_at      │                      │               │
│  │ updated_at      │                      │               │
│  │ completed_at    │                      │               │
│  └─────────────────┘                      │               │
│                                           │               │
│                                           └───────────────┘
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   audit_logs    │  │   user_sessions │                 │
│  │─────────────────│  │─────────────────│                 │
│  │ id (UUID) PK    │  │ id (UUID) PK    │                 │
│  │ user_id FK      │  │ user_id FK      │                 │
│  │ action          │  │ session_token   │                 │
│  │ table_name      │  │ ip_address      │                 │
│  │ record_id       │  │ user_agent      │                 │
│  │ old_values      │  │ created_at      │                 │
│  │ new_values      │  │ expires_at      │                 │
│  │ created_at      │  │ last_activity   │                 │
│  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Domain Boundaries

#### User Domain
- **Purpose**: Dual authentication and profile management
- **Tables**: users
- **Responsibilities**: OAuth & OPAQUE authentication, user preferences, profile data

#### Content Domain
- **Purpose**: Journal entries and content management
- **Tables**: journals, tags, secret_tags, tag_sessions
- **Responsibilities**: Content creation, organization, zero-knowledge secret tags

#### Encryption Domain
- **Purpose**: Cryptographic key management and encrypted storage
- **Tables**: wrapped_keys, vault_blobs
- **Responsibilities**: AES-KW key wrapping, AES-GCM encrypted content storage

#### Task Domain
- **Purpose**: Personal task and reminder management
- **Tables**: reminders
- **Responsibilities**: Task tracking, notifications, scheduling

#### System Domain
- **Purpose**: System operations and maintenance
- **Tables**: migrations, system_logs
- **Responsibilities**: Schema versioning, system monitoring

## Table Definitions

### users

The core user table storing account information and dual authentication data.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    
    -- OAuth authentication (Google Sign-in)
    google_id TEXT UNIQUE NULL,
    
    -- OPAQUE authentication (zero-knowledge passwords)
    opaque_envelope BYTEA NULL,
    
    -- Secret tag preferences
    show_secret_tag_names BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Personal Information Fields
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255),  -- Keep for backward compatibility
    display_name VARCHAR(150),
    bio TEXT,
    phone VARCHAR(20),
    date_of_birth DATE,
    
    -- User Preferences & Localization
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    language_code VARCHAR(10) NOT NULL DEFAULT 'en',
    theme_preference VARCHAR(20) NOT NULL DEFAULT 'system',
    notification_preferences JSONB NOT NULL DEFAULT '{}',
    privacy_settings JSONB NOT NULL DEFAULT '{}',
    
    -- Flexible User Tier Foundation
    account_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    tier_metadata JSONB NOT NULL DEFAULT '{}',
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'none',
    subscription_expires_at TIMESTAMPTZ,
    
    -- Enhanced User Experience
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ,
    login_count INTEGER NOT NULL DEFAULT 0,
    avatar_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    
    -- Security & Compliance
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted_at TIMESTAMPTZ,
    privacy_policy_accepted_at TIMESTAMPTZ,
    
    -- Analytics & Insights (privacy-conscious)
    registration_source VARCHAR(50),
    referral_code VARCHAR(20),
    referred_by_user_id UUID REFERENCES users(id),
    user_agent TEXT,
    ip_address_hash VARCHAR(64),
    
    -- Legacy fields (maintain compatibility)
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_name_length CHECK (
        (first_name IS NULL OR length(first_name) >= 1) AND
        (last_name IS NULL OR length(last_name) >= 1)
    ),
    -- Dual authentication constraint: exactly one method must be configured
    CONSTRAINT user_auth_method CHECK (
        (google_id IS NOT NULL AND opaque_envelope IS NULL) OR
        (google_id IS NULL AND opaque_envelope IS NOT NULL)
    )
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `email`: Unique email address (case-insensitive via CITEXT)
- `google_id`: OAuth user identifier from Google (NULL for OPAQUE users)
- `opaque_envelope`: OPAQUE registration envelope (NULL for OAuth users)
- `show_secret_tag_names`: User preference for displaying secret tag names
- `first_name`, `last_name`, `full_name`, `display_name`: User display information
- `bio`: Optional user biography
- `phone`, `date_of_birth`: Personal contact information
- `timezone`, `language_code`: Localization preferences
- `theme_preference`: UI theme selection ('light', 'dark', 'system')
- `notification_preferences`, `privacy_settings`: JSON configuration objects
- `account_tier`: User subscription level ('free', 'premium', 'enterprise')
- `tier_metadata`: Flexible tier-specific configuration
- `subscription_status`, `subscription_expires_at`: Subscription management
- `onboarding_completed`: First-time user experience tracking
- `last_seen_at`, `login_count`: Activity tracking
- `avatar_url`, `cover_image_url`: Profile media
- `email_verified`, `phone_verified`, `two_factor_enabled`: Security features
- `terms_accepted_at`, `privacy_policy_accepted_at`: Legal compliance
- `registration_source`, `referral_code`, `referred_by_user_id`: Analytics
- `user_agent`, `ip_address_hash`: Privacy-conscious tracking
- `is_active`, `is_superuser`: Legacy compatibility fields
- `created_at`, `updated_at`: Audit timestamps

**Authentication Methods:**
- **OAuth Users**: `google_id` populated, `opaque_envelope` is NULL
- **OPAQUE Users**: `opaque_envelope` populated, `google_id` is NULL
- **Constraint**: Exactly one authentication method must be configured per user

**Business Rules:**
- Email must be unique across all users (case-insensitive)
- Email format validation via check constraint
- Dual authentication constraint ensures data integrity
- Names must be at least 1 character if provided
- Soft deletion via `is_active` flag
- Self-referential relationship for user referrals
- Privacy-conscious analytics (hashed IP addresses)

### journals

The primary content table storing user journal entries.

```sql
CREATE TABLE journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 10),
    is_private BOOLEAN DEFAULT false,
    word_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT journals_title_length CHECK (length(title) >= 1),
    CONSTRAINT journals_word_count_positive CHECK (word_count >= 0)
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `user_id`: Foreign key to users table with cascade delete
- `title`: Journal entry title (required, max 500 chars)
- `content`: Main journal content (unlimited text)
- `mood_rating`: Optional mood scale 1-10
- `is_private`: Privacy flag for journal entry
- `word_count`: Calculated word count for analytics
- `created_at`: Entry creation timestamp
- `updated_at`: Last modification timestamp
- `published_at`: Publication timestamp (for sharing features)

**Business Rules:**
- Must belong to a valid user
- Title is required and cannot be empty
- Word count automatically calculated on save
- Soft privacy controls via `is_private` flag
- Mood rating must be between 1-10 if provided

### tags

Public tags for categorizing journal entries.

```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT tags_name_length CHECK (length(name) >= 1),
    CONSTRAINT tags_color_format CHECK (color ~* '^#[0-9a-f]{6}$'),
    UNIQUE(user_id, name)
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `user_id`: Foreign key to users table with cascade delete
- `name`: Tag name (required, max 100 chars)
- `color`: Hex color code for UI display
- `created_at`: Tag creation timestamp
- `updated_at`: Last modification timestamp

**Business Rules:**
- Must belong to a valid user
- Tag names must be unique per user
- Color must be valid hex format
- Name cannot be empty

### secret_tags

Clean OPAQUE zero-knowledge secret tags for secure voice phrase activation.

```sql
CREATE TABLE secret_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Clean OPAQUE authentication - random handle chosen by client
    tag_handle BYTEA(32) UNIQUE NOT NULL,
    opaque_envelope BYTEA NOT NULL,
    
    -- Tag metadata
    tag_name TEXT NOT NULL,
    color TEXT NULL,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT unique_user_secret_tag UNIQUE (user_id, tag_name)
);

-- Indexes for performance
CREATE INDEX idx_secret_tags_user_id ON secret_tags(user_id);
CREATE UNIQUE INDEX idx_secret_tags_handle ON secret_tags(tag_handle);
CREATE INDEX idx_secret_tags_user_tag_name ON secret_tags(user_id, tag_name);
CREATE INDEX idx_secret_tags_user_created ON secret_tags(user_id, created_at);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `user_id`: Foreign key to users table with cascade delete
- `tag_handle`: Random 32-byte identifier chosen by client (not derived from phrase)
- `opaque_envelope`: OPAQUE registration envelope (variable length)
- `tag_name`: Human-readable tag name
- `color`: Hex color code for UI display (nullable)
- `created_at`: Tag creation timestamp
- `updated_at`: Last modification timestamp

**Business Rules:**
- Must belong to a valid user
- Secret tag names must be unique per user
- Tag handle must be globally unique (32 random bytes)
- Implements zero-knowledge authentication via OPAQUE protocol
- Server never stores actual secret phrases
- Clean implementation without legacy phrase_hash/salt/verifier_kv fields

**Security Properties:**
- **Zero-knowledge**: Server stores only OPAQUE envelopes, never learns phrases
- **Random handles**: Tag handles are not derived from phrases, providing plausible deniability
- **Independent authentication**: Secret tags use OPAQUE regardless of user authentication method
- **Perfect forward secrecy**: Authentication sessions are ephemeral

### tag_sessions

Ephemeral OPAQUE authentication sessions for secret tags.

```sql
CREATE TABLE tag_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tag_id UUID NOT NULL REFERENCES secret_tags(id),
    server_ephemeral BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tag_sessions_user_id ON tag_sessions(user_id);
CREATE INDEX idx_tag_sessions_tag_id ON tag_sessions(tag_id);
CREATE INDEX idx_tag_sessions_created_at ON tag_sessions(created_at);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `user_id`: Foreign key to users table
- `tag_id`: Foreign key to secret_tags table
- `server_ephemeral`: OPAQUE server ephemeral state (binary data)
- `created_at`: Session creation timestamp
- `updated_at`: Last modification timestamp

**Business Rules:**
- Sessions are ephemeral and automatically cleaned up by TTL job
- Used for multi-round OPAQUE authentication protocol
- Contains temporary cryptographic state during authentication
- Cleaned up after configured timeout (typically 15 minutes)

**Security Properties:**
- **Ephemeral**: Sessions exist only during active authentication
- **Automatic cleanup**: TTL job removes expired sessions
- **No persistent secrets**: Contains only temporary protocol state

### wrapped_keys

AES-KW wrapped data encryption keys for vault access control.

```sql
CREATE TABLE wrapped_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES secret_tags(id) ON DELETE CASCADE,
    vault_id UUID NOT NULL,
    wrapped_key BYTEA(40) NOT NULL,
    key_purpose TEXT NOT NULL DEFAULT 'vault_data',
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_wrapped_keys_tag_id ON wrapped_keys(tag_id);
CREATE INDEX idx_wrapped_keys_vault_id ON wrapped_keys(vault_id);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `tag_id`: Foreign key to secret_tags table with cascade delete
- `vault_id`: UUID identifier for the encrypted vault
- `wrapped_key`: AES-KW wrapped data encryption key (40 bytes)
- `key_purpose`: Purpose of the wrapped key (default: 'vault_data')
- `key_version`: Key version for rotation support
- `created_at`: Key creation timestamp
- `updated_at`: Last modification timestamp

**Business Rules:**
- Must reference a valid secret tag
- Wrapped key provides access to encrypted vault content
- Key wrapping uses AES Key Wrap (RFC 3394) standard
- Supports key rotation through version tracking

**Security Properties:**
- **AES-KW**: Industry standard key wrapping algorithm
- **Cascade delete**: Keys are automatically removed when tags are deleted
- **Version tracking**: Supports key rotation for enhanced security

### vault_blobs

Encrypted content blobs stored in secure vaults.

```sql
CREATE TABLE vault_blobs (
    vault_id UUID NOT NULL,
    object_id UUID NOT NULL,
    wrapped_key_id UUID NOT NULL REFERENCES wrapped_keys(id),
    iv BYTEA(12) NOT NULL,
    ciphertext BYTEA NOT NULL,
    auth_tag BYTEA(16) NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    content_size INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (vault_id, object_id)
);

-- Indexes for performance
CREATE INDEX idx_vault_blobs_vault_id ON vault_blobs(vault_id);
CREATE INDEX idx_vault_blobs_wrapped_key_id ON vault_blobs(wrapped_key_id);
```

**Column Details:**
- `vault_id`: UUID identifier for the vault containing this blob (part of composite PK)
- `object_id`: UUID identifier for the specific object within the vault (part of composite PK)
- `wrapped_key_id`: Foreign key to wrapped_keys table
- `iv`: AES-GCM initialization vector (12 bytes)
- `ciphertext`: Encrypted content (variable length)
- `auth_tag`: AES-GCM authentication tag (16 bytes)
- `content_type`: MIME type of the original content
- `content_size`: Size of the original unencrypted content
- `created_at`: Blob creation timestamp
- `updated_at`: Last modification timestamp

**Business Rules:**
- Must reference a valid wrapped key for decryption
- Uses AES-GCM authenticated encryption
- Vault/object combination forms composite primary key
- Content type helps with proper handling after decryption

**Security Properties:**
- **AES-GCM**: Authenticated encryption with associated data (AEAD)
- **Composite key**: Ensures uniqueness within vaults
- **IV uniqueness**: Each blob has unique initialization vector
- **Authentication tag**: Prevents tampering with encrypted content

### Legacy Tables (Deprecated)

The following tables have been deprecated in favor of the clean dual authentication system:

#### opaque_sessions (Deprecated)
- **Replaced by**: `tag_sessions` for secret tag authentication
- **Reason**: Simplified to focus only on secret tag authentication sessions
- **Migration**: Old OPAQUE user sessions are now handled via JWT tokens directly

**Note**: This table may still exist in some database instances but is no longer used by the application.

### security_audit_logs

Security audit trail for OPAQUE authentication and system events.

```sql
CREATE TABLE security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    user_id_hash VARCHAR(64),
    session_id_hash VARCHAR(64),
    correlation_id UUID,
    request_id UUID,
    ip_address_hash VARCHAR(64),
    user_agent_hash VARCHAR(64),
    event_data TEXT,
    event_message VARCHAR(500) NOT NULL,
    log_signature VARCHAR(128),
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_time_ms INTEGER,
    success BOOLEAN,
    error_code VARCHAR(50)
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `event_type`: Type of security event (authentication, registration, etc.)
- `event_category`: Category of event (auth, session, vault, system)
- `severity`: Event severity level (info, warning, error, critical)
- `user_id_hash`: SHA-256 hash of user ID (privacy protection)
- `session_id_hash`: SHA-256 hash of session ID (privacy protection)
- `correlation_id`: UUID for tracking related events
- `request_id`: UUID for request tracking
- `ip_address_hash`: Hashed IP address for privacy
- `user_agent_hash`: Hashed user agent string
- `event_data`: JSON event-specific data
- `event_message`: Human-readable event description
- `log_signature`: HMAC signature for log integrity
- `is_sensitive`: Flag for sensitive security events
- `timestamp`: Event timestamp
- `processing_time_ms`: Request processing time
- `success`: Success/failure flag for operations
- `error_code`: Standardized error code

**Business Rules:**
- All personally identifiable information is hashed
- Log signatures ensure audit trail integrity
- Supports correlation across multiple events
- Sensitive events are flagged for special handling

### reminders

User task and reminder management.

```sql
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 2 CHECK (priority >= 1 AND priority <= 5),
    repeat_pattern VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT reminders_title_length CHECK (length(title) >= 1),
    CONSTRAINT reminders_future_time CHECK (reminder_time > created_at),
    CONSTRAINT reminders_completion_logic CHECK (
        (is_completed = false AND completed_at IS NULL) OR
        (is_completed = true AND completed_at IS NOT NULL)
    )
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `user_id`: Foreign key to users table with cascade delete
- `title`: Reminder title (required, max 255 chars)
- `description`: Optional detailed description
- `reminder_time`: When the reminder should trigger
- `is_completed`: Completion status flag
- `priority`: Priority level (1=low, 5=high)
- `repeat_pattern`: Recurrence pattern (daily, weekly, etc.)
- `created_at`: Reminder creation timestamp
- `updated_at`: Last modification timestamp
- `completed_at`: Completion timestamp

**Business Rules:**
- Must belong to a valid user
- Title is required and cannot be empty
- Reminder time must be in the future when created
- Completion logic: completed_at must be set when is_completed is true
- Priority must be between 1-5

### audit_logs

System audit trail for security and compliance.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT audit_logs_action_valid CHECK (
        action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN')
    )
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `user_id`: Foreign key to users table (nullable for system actions)
- `action`: Type of action performed
- `table_name`: Table affected by the action
- `record_id`: UUID of the affected record
- `old_values`: Previous values (JSON format)
- `new_values`: New values (JSON format)
- `ip_address`: Client IP address
- `user_agent`: Client user agent string
- `created_at`: Action timestamp

**Business Rules:**
- Action must be from predefined list
- User ID can be null for system actions
- JSON values store complete change history
- IP address and user agent for security tracking

### user_sessions

Active user session management.

```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT user_sessions_valid_expiry CHECK (expires_at > created_at)
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `user_id`: Foreign key to users table with cascade delete
- `session_token`: Unique session identifier
- `ip_address`: Client IP address
- `user_agent`: Client user agent string
- `created_at`: Session creation timestamp
- `expires_at`: Session expiration timestamp
- `last_activity`: Last activity timestamp

**Business Rules:**
- Must belong to a valid user
- Session token must be unique
- Expiration time must be after creation time
- Last activity updated on each request

## Relationships and Constraints

### Primary Key Constraints

All tables use UUID primary keys for global uniqueness:

```sql
-- UUID primary key pattern used throughout
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

### Foreign Key Relationships

#### User-Centric Relationships
```sql
-- Users own journals (1:N)
ALTER TABLE journals ADD CONSTRAINT fk_journals_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Users own reminders (1:N)
ALTER TABLE reminders ADD CONSTRAINT fk_reminders_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Users have sessions (1:N)
ALTER TABLE user_sessions ADD CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Users generate audit logs (1:N, nullable)
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
```

#### Content Relationships
```sql
-- Journals have tags (1:N)
ALTER TABLE tags ADD CONSTRAINT fk_tags_journal
    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE;

-- Journals have secret tags (1:N)
ALTER TABLE secret_tags ADD CONSTRAINT fk_secret_tags_journal
    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE;
```

### Unique Constraints

```sql
-- User email uniqueness
ALTER TABLE users ADD CONSTRAINT uk_users_email UNIQUE (email);

-- Session token uniqueness
ALTER TABLE user_sessions ADD CONSTRAINT uk_sessions_token UNIQUE (session_token);

-- Tag name uniqueness per journal
ALTER TABLE tags ADD CONSTRAINT uk_tags_journal_name UNIQUE (journal_id, name);

-- Secret tag name uniqueness per journal
ALTER TABLE secret_tags ADD CONSTRAINT uk_secret_tags_journal_name UNIQUE (journal_id, name);
```

### Check Constraints

```sql
-- Email format validation
ALTER TABLE users ADD CONSTRAINT chk_users_email_format 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Mood rating range
ALTER TABLE journals ADD CONSTRAINT chk_journals_mood_rating 
    CHECK (mood_rating >= 1 AND mood_rating <= 10);

-- Priority range
ALTER TABLE reminders ADD CONSTRAINT chk_reminders_priority 
    CHECK (priority >= 1 AND priority <= 5);

-- Color format validation
ALTER TABLE tags ADD CONSTRAINT chk_tags_color_format 
    CHECK (color ~* '^#[0-9a-f]{6}$');

-- Future reminder time
ALTER TABLE reminders ADD CONSTRAINT chk_reminders_future_time 
    CHECK (reminder_time > created_at);
```

## Indexes and Performance

### Primary Key Indexes

Automatically created B-tree indexes for all primary keys:

```sql
-- Automatic primary key indexes
CREATE UNIQUE INDEX users_pkey ON users USING btree (id);
CREATE UNIQUE INDEX journals_pkey ON journals USING btree (id);
CREATE UNIQUE INDEX tags_pkey ON tags USING btree (id);
CREATE UNIQUE INDEX secret_tags_pkey ON secret_tags USING btree (id);
CREATE UNIQUE INDEX reminders_pkey ON reminders USING btree (id);
CREATE UNIQUE INDEX audit_logs_pkey ON audit_logs USING btree (id);
CREATE UNIQUE INDEX user_sessions_pkey ON user_sessions USING btree (id);
```

### Foreign Key Indexes

Optimized indexes for foreign key relationships:

```sql
-- User relationship indexes
CREATE INDEX idx_journals_user_id ON journals USING btree (user_id);
CREATE INDEX idx_reminders_user_id ON reminders USING btree (user_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions USING btree (user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs USING btree (user_id);

-- Content relationship indexes
CREATE INDEX idx_tags_journal_id ON tags USING btree (journal_id);
CREATE INDEX idx_secret_tags_journal_id ON secret_tags USING btree (journal_id);
```

### Unique Constraint Indexes

```sql
-- Unique constraint indexes
CREATE UNIQUE INDEX idx_users_email ON users USING btree (email);
CREATE UNIQUE INDEX idx_user_sessions_token ON user_sessions USING btree (session_token);
CREATE UNIQUE INDEX idx_tags_journal_name ON tags USING btree (journal_id, name);
CREATE UNIQUE INDEX idx_secret_tags_journal_name ON secret_tags USING btree (journal_id, name);
```

### Performance Optimization Indexes

```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_journals_user_created ON journals USING btree (user_id, created_at DESC);
CREATE INDEX idx_journals_user_updated ON journals USING btree (user_id, updated_at DESC);
CREATE INDEX idx_reminders_user_time ON reminders USING btree (user_id, reminder_time);
CREATE INDEX idx_reminders_user_completed ON reminders USING btree (user_id, is_completed);
CREATE INDEX idx_reminders_incomplete ON reminders USING btree (user_id, reminder_time) 
    WHERE is_completed = false;

-- Full-text search indexes
CREATE INDEX idx_journals_title_search ON journals USING gin (to_tsvector('english', title));
CREATE INDEX idx_journals_content_search ON journals USING gin (to_tsvector('english', content));

-- Audit log indexes for security queries
CREATE INDEX idx_audit_logs_user_created ON audit_logs USING btree (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action_created ON audit_logs USING btree (action, created_at DESC);
CREATE INDEX idx_audit_logs_table_created ON audit_logs USING btree (table_name, created_at DESC);

-- Session management indexes
CREATE INDEX idx_user_sessions_expires ON user_sessions USING btree (expires_at);
CREATE INDEX idx_user_sessions_activity ON user_sessions USING btree (last_activity DESC);
```

### Partial Indexes

Optimized indexes for specific conditions:

```sql
-- Active users only
CREATE INDEX idx_users_active ON users USING btree (email) WHERE is_active = true;

-- Incomplete reminders
CREATE INDEX idx_reminders_pending ON reminders USING btree (user_id, reminder_time) 
    WHERE is_completed = false;

-- Private journals
CREATE INDEX idx_journals_private ON journals USING btree (user_id, created_at DESC) 
    WHERE is_private = true;

-- Recent audit logs (last 30 days)
CREATE INDEX idx_audit_logs_recent ON audit_logs USING btree (created_at DESC) 
    WHERE created_at > (CURRENT_TIMESTAMP - INTERVAL '30 days');
```

## Data Types and Standards

### UUID Standards
- **Primary Keys**: All tables use UUID v4 (random) for primary keys
- **Foreign Keys**: All foreign key references use UUID type
- **Generation**: PostgreSQL `gen_random_uuid()` function for performance
- **Format**: Standard 36-character hyphenated format

### Timestamp Standards
- **Type**: `TIMESTAMP WITH TIME ZONE` for all datetime fields
- **Default**: `CURRENT_TIMESTAMP` for creation timestamps
- **Timezone**: All timestamps stored in UTC
- **Precision**: Microsecond precision for audit trails

### String Standards
- **Encoding**: UTF-8 for international character support
- **Email**: VARCHAR(255) with format validation
- **Names**: VARCHAR(100) for person names
- **Titles**: VARCHAR(255) for content titles
- **Descriptions**: TEXT for unlimited content

### Numeric Standards
- **Ratings**: INTEGER with range constraints (1-10)
- **Priorities**: INTEGER with range constraints (1-5)
- **Counts**: INTEGER with non-negative constraints
- **Flags**: BOOLEAN for true/false values

### JSON Standards
- **Audit Data**: JSONB for structured audit information
- **Configuration**: JSONB for flexible configuration storage
- **Indexing**: GIN indexes for JSON field searches

## Security and Access Control

### Authentication Security
- **Password Storage**: Bcrypt hashing with salt
- **Session Management**: Secure token-based sessions
- **Session Expiry**: Configurable session timeouts
- **IP Tracking**: Client IP logging for security

### Data Access Control
- **Row-Level Security**: User-based data isolation
- **Privacy Controls**: Private/public content flags
- **Audit Trail**: Complete action logging
- **Soft Deletes**: Logical deletion for recovery

### Database Security
- **Connection Security**: SSL/TLS encryption required
- **User Privileges**: Minimal required permissions
- **Backup Encryption**: Encrypted backup storage
- **Network Security**: VPC isolation in production

### Compliance Features
- **GDPR Compliance**: User data export/deletion capabilities
- **Audit Logging**: Complete change history
- **Data Retention**: Configurable retention policies
- **Privacy Controls**: Granular privacy settings

## Backup and Recovery

### Backup Strategy
- **Full Backups**: Daily full database backups
- **Incremental Backups**: Hourly incremental backups
- **Point-in-Time Recovery**: WAL-based recovery capability
- **Cross-Region Replication**: Disaster recovery replicas

### Backup Procedures
```sql
-- Full backup command
pg_dump -h localhost -U postgres -d vibes_db -f backup_$(date +%Y%m%d_%H%M%S).sql

-- Compressed backup
pg_dump -h localhost -U postgres -d vibes_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

-- Custom format backup (recommended)
pg_dump -h localhost -U postgres -d vibes_db -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump
```

### Recovery Procedures
```sql
-- Full restore from SQL backup
psql -h localhost -U postgres -d vibes_db_new < backup_20250127_120000.sql

-- Restore from custom format
pg_restore -h localhost -U postgres -d vibes_db_new -c backup_20250127_120000.dump

-- Point-in-time recovery
pg_restore -h localhost -U postgres -d vibes_db_new -T "2025-01-27 12:00:00" backup.dump
```

### Backup Validation
```sql
-- Verify backup integrity
pg_restore --list backup_20250127_120000.dump

-- Test restore in staging
pg_restore -h staging-host -U postgres -d vibes_staging -c backup_20250127_120000.dump

-- Validate data consistency
SELECT 
    table_name,
    COUNT(*) as row_count
FROM information_schema.tables t
JOIN (
    SELECT 'users' as table_name, COUNT(*) as count FROM users
    UNION ALL
    SELECT 'journals' as table_name, COUNT(*) as count FROM journals
    UNION ALL
    SELECT 'reminders' as table_name, COUNT(*) as count FROM reminders
) counts ON t.table_name = counts.table_name
WHERE t.table_schema = 'public';
```

## Monitoring and Maintenance

### Database Monitoring
```sql
-- Enable monitoring extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_stat_activity;

-- Monitor query performance
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Monitor table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables;

-- Monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Maintenance Procedures
```sql
-- Regular maintenance tasks
VACUUM ANALYZE;  -- Update statistics and clean up dead tuples
REINDEX DATABASE vibes_db;  -- Rebuild indexes for performance

-- Table-specific maintenance
VACUUM FULL journals;  -- Aggressive cleanup for heavily modified tables
ANALYZE journals;  -- Update query planner statistics

-- Index maintenance
REINDEX TABLE journals;  -- Rebuild table indexes
REINDEX INDEX idx_journals_user_created;  -- Rebuild specific index
```

### Performance Monitoring
```sql
-- Create monitoring views
CREATE VIEW performance_summary AS
SELECT 
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT 
    'Active Connections' as metric,
    COUNT(*)::text as value
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT 
    'Slow Queries (>100ms)' as metric,
    COUNT(*)::text as value
FROM pg_stat_statements
WHERE mean_time > 100;

-- Monitor connection usage
SELECT 
    datname,
    numbackends,
    xact_commit,
    xact_rollback,
    blks_read,
    blks_hit,
    tup_returned,
    tup_fetched,
    tup_inserted,
    tup_updated,
    tup_deleted
FROM pg_stat_database
WHERE datname = 'vibes_db';
```

### Alerting Thresholds
- **Connection Usage**: Alert when > 80% of max_connections
- **Query Performance**: Alert when mean query time > 100ms
- **Disk Usage**: Alert when database size > 80% of available space
- **Backup Status**: Alert when backup age > 25 hours
- **Replication Lag**: Alert when replica lag > 5 minutes

---

*Last Updated: January 27, 2025*
*Version: 2.0*
*Related PBI: [PBI-9: Database Schema Standardization and UUID Implementation](../../delivery/9/prd.md)* 