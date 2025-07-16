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

This document provides comprehensive documentation of the database schema for the Vibes application. The schema is designed to support a personal journaling and reminder system with robust data integrity, optimal performance, and scalability.

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
- **Audit Trail**: Created/updated timestamps on all tables
- **Soft Deletes**: Logical deletion for data recovery capabilities
- **Performance**: Strategic indexing for common query patterns

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
│  │  │   users   │  │                                       │
│  │  └───────────┘  │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  ┌─────────────────┐                                       │
│  │ Content Domain  │                                       │
│  │  ┌───────────┐  │                                       │
│  │  │ journals  │  │                                       │
│  │  │   tags    │  │                                       │
│  │  │secret_tags│  │                                       │
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
│  │ password_hash   │                       │               │
│  │ first_name      │                       │               │
│  │ last_name       │                       │               │
│  │ is_active       │                       │               │
│  │ created_at      │                       │               │
│  │ updated_at      │                       │               │
│  │ last_login      │                       │               │
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
│  │ journal_id FK   │  │ journal_id FK   │                 │
│  │ name            │  │ name            │                 │
│  │ color           │  │ access_level    │                 │
│  │ created_at      │  │ created_at      │                 │
│  │ updated_at      │  │ updated_at      │                 │
│  └─────────────────┘  └─────────────────┘                 │
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
- **Purpose**: User authentication and profile management
- **Tables**: users, user_sessions, audit_logs
- **Responsibilities**: Authentication, authorization, user preferences

#### Content Domain
- **Purpose**: Journal entries and content management
- **Tables**: journals, tags, secret_tags
- **Responsibilities**: Content creation, organization, privacy

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

The core user table storing account information and authentication data.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_name_length CHECK (
        (first_name IS NULL OR length(first_name) >= 1) AND
        (last_name IS NULL OR length(last_name) >= 1)
    )
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `email`: Unique email address for authentication
- `password_hash`: Bcrypt hashed password (never store plain text)
- `first_name`, `last_name`: Optional user display names
- `is_active`: Account status flag for soft deletion
- `created_at`: Account creation timestamp
- `updated_at`: Last profile update timestamp
- `last_login`: Last successful login timestamp

**Business Rules:**
- Email must be unique across all users
- Email format validation via check constraint
- Password must be hashed before storage
- Soft deletion via `is_active` flag
- Names must be at least 1 character if provided

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
    journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT tags_name_length CHECK (length(name) >= 1),
    CONSTRAINT tags_color_format CHECK (color ~* '^#[0-9a-f]{6}$'),
    UNIQUE(journal_id, name)
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `journal_id`: Foreign key to journals table with cascade delete
- `name`: Tag name (required, max 100 chars)
- `color`: Hex color code for UI display
- `created_at`: Tag creation timestamp
- `updated_at`: Last modification timestamp

**Business Rules:**
- Must belong to a valid journal entry
- Tag names must be unique per journal
- Color must be valid hex format
- Name cannot be empty

### secret_tags

Private tags for sensitive categorization.

```sql
CREATE TABLE secret_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    access_level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT secret_tags_name_length CHECK (length(name) >= 1),
    CONSTRAINT secret_tags_access_level CHECK (access_level >= 1 AND access_level <= 5),
    UNIQUE(journal_id, name)
);
```

**Column Details:**
- `id`: UUID primary key, automatically generated
- `journal_id`: Foreign key to journals table with cascade delete
- `name`: Secret tag name (required, max 100 chars)
- `access_level`: Security level (1-5, higher = more restricted)
- `created_at`: Tag creation timestamp
- `updated_at`: Last modification timestamp

**Business Rules:**
- Must belong to a valid journal entry
- Secret tag names must be unique per journal
- Access level controls visibility (1=low, 5=high security)
- Name cannot be empty

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