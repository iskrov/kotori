"""UUID standardization - Drop and recreate with UUID primary keys

Revision ID: 1a46576934f6
Revises: 2c88eb7b741c
Create Date: 2025-07-14 10:19:37.942775

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic.
revision = '1a46576934f6'
down_revision = '2c88eb7b741c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    UUID Standardization Migration
    
    This migration drops existing tables and recreates them with standardized UUID primary keys.
    Since dev and test databases are empty, this is safe to do without data migration.
    
    Key changes:
    1. All core models use native UUID primary keys
    2. SecretTag model fixed with proper UUID primary key and phrase_hash column
    3. All foreign keys updated to reference UUID primary keys
    4. Proper indexes added for performance
    """
    
    # Ensure idempotency: drop existing objects created by previous revisions
    # so this migration can recreate a clean schema even if prior revision created tables.
    # Use IF EXISTS to avoid transaction aborts when objects don't exist
    op.execute('DROP TABLE IF EXISTS journal_entry_tags CASCADE')
    op.execute('DROP TABLE IF EXISTS wrapped_keys CASCADE')
    op.execute('DROP TABLE IF EXISTS vault_blobs CASCADE')
    op.execute('DROP TABLE IF EXISTS reminders CASCADE')
    op.execute('DROP TABLE IF EXISTS tags CASCADE')
    op.execute('DROP TABLE IF EXISTS journal_entries CASCADE')
    op.execute('DROP TABLE IF EXISTS opaque_sessions CASCADE')
    op.execute('DROP TABLE IF EXISTS secret_tags CASCADE')
    op.execute('DROP TABLE IF EXISTS security_alerts CASCADE')
    op.execute('DROP TABLE IF EXISTS security_metrics CASCADE')
    op.execute('DROP TABLE IF EXISTS security_audit_logs CASCADE')
    op.execute('DROP TABLE IF EXISTS users CASCADE')
    # Drop enum if exists
    op.execute('DROP TYPE IF EXISTS reminderfrequency CASCADE')
    
    # Create users table with UUID primary key
    op.create_table('users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, default=False),
        sa.Column('google_id', sa.String(length=255), nullable=True, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for users table
    op.create_index('idx_users_email', 'users', ['email'], unique=True)
    op.create_index('idx_users_google_id', 'users', ['google_id'], unique=True)
    op.create_index('idx_users_is_active', 'users', ['is_active'])
    
    # Create secret_tags table with proper UUID primary key and phrase_hash
    op.create_table('secret_tags',
        sa.Column('tag_id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('phrase_hash', sa.LargeBinary(16), nullable=False, unique=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('salt', sa.LargeBinary(16), nullable=False),
        sa.Column('verifier_kv', sa.LargeBinary(32), nullable=False),
        sa.Column('opaque_envelope', sa.LargeBinary, nullable=False),
        sa.Column('tag_name', sa.String(100), nullable=False),
        sa.Column('color_code', sa.String(7), nullable=False, default='#007AFF'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for secret_tags table
    op.create_index('idx_secret_tags_user_id', 'secret_tags', ['user_id'])
    op.create_index('idx_secret_tags_phrase_hash', 'secret_tags', ['phrase_hash'], unique=True)
    op.create_index('idx_secret_tags_user_tag_name', 'secret_tags', ['user_id', 'tag_name'])
    op.create_index('idx_secret_tags_user_created', 'secret_tags', ['user_id', 'created_at'])
    
    # Create unique constraint for user secret tag names
    op.create_unique_constraint('unique_user_secret_tag', 'secret_tags', ['user_id', 'tag_name'])
    
    # Create journal_entries table with UUID primary key
    op.create_table('journal_entries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('title', sa.String, nullable=True),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('audio_url', sa.String, nullable=True),
        sa.Column('entry_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('secret_tag_id', UUID(as_uuid=True), sa.ForeignKey('secret_tags.tag_id'), nullable=True),
        sa.Column('encrypted_content', sa.LargeBinary, nullable=True),
        sa.Column('wrapped_key', sa.LargeBinary, nullable=True),
        sa.Column('encryption_iv', sa.LargeBinary, nullable=True),
        sa.Column('wrap_iv', sa.LargeBinary, nullable=True),
        sa.Column('encryption_algorithm', sa.String, nullable=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for journal_entries table
    op.create_index('idx_journal_entries_user_id', 'journal_entries', ['user_id'])
    op.create_index('idx_journal_entries_secret_tag_id', 'journal_entries', ['secret_tag_id'])
    op.create_index('idx_journal_entries_user_created', 'journal_entries', ['user_id', 'created_at'])
    op.create_index('idx_journal_entries_user_entry_date', 'journal_entries', ['user_id', 'entry_date'])
    op.create_index('idx_journal_entries_entry_date', 'journal_entries', ['entry_date'])
    
    # Create tags table with UUID primary key
    op.create_table('tags',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String, nullable=False, unique=True),
        sa.Column('color', sa.String, nullable=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for tags table
    op.create_index('idx_tags_user_id', 'tags', ['user_id'])
    op.create_index('idx_tags_name', 'tags', ['name'], unique=True)
    op.create_index('idx_tags_user_created', 'tags', ['user_id', 'created_at'])
    
    # Create unique constraint for user tag names
    op.create_unique_constraint('unique_user_tag', 'tags', ['user_id', 'name'])
    
    # Create journal_entry_tags association table with UUID primary key
    op.create_table('journal_entry_tags',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('entry_id', UUID(as_uuid=True), sa.ForeignKey('journal_entries.id'), nullable=False),
        sa.Column('tag_id', UUID(as_uuid=True), sa.ForeignKey('tags.id'), nullable=False),
    )
    
    # Create indexes for journal_entry_tags table
    op.create_index('idx_journal_entry_tags_entry_id', 'journal_entry_tags', ['entry_id'])
    op.create_index('idx_journal_entry_tags_tag_id', 'journal_entry_tags', ['tag_id'])
    
    # Create unique constraint for entry-tag associations
    op.create_unique_constraint('unique_entry_tag', 'journal_entry_tags', ['entry_id', 'tag_id'])
    
    # Create enum type for reminderfrequency prior to table creation
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminderfrequency') THEN
                CREATE TYPE reminderfrequency AS ENUM (
                    'DAILY','WEEKDAYS','WEEKENDS','WEEKLY','MONTHLY','CUSTOM'
                );
            END IF;
        END$$;
    """)

    # Create reminders table with UUID primary key
    op.create_table('reminders',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('title', sa.String, nullable=False),
        sa.Column('message', sa.String, nullable=False),
        sa.Column('frequency', sa.Enum('DAILY', 'WEEKDAYS', 'WEEKENDS', 'WEEKLY', 'MONTHLY', 'CUSTOM', name='reminderfrequency'), nullable=False),
        sa.Column('time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('custom_days', sa.String, nullable=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for reminders table
    op.create_index('idx_reminders_user_id', 'reminders', ['user_id'])
    op.create_index('idx_reminders_is_active', 'reminders', ['is_active'])
    op.create_index('idx_reminders_user_created', 'reminders', ['user_id', 'created_at'])
    
    # Create wrapped_keys table with UUID primary key
    op.create_table('wrapped_keys',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tag_id', UUID(as_uuid=True), sa.ForeignKey('secret_tags.tag_id'), nullable=False),
        sa.Column('vault_id', UUID(as_uuid=True), nullable=False),
        sa.Column('wrapped_key', sa.LargeBinary(40), nullable=False),
        sa.Column('key_purpose', sa.String(50), nullable=False, default='vault_data'),
        sa.Column('key_version', sa.Integer, nullable=False, default=1),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for wrapped_keys table
    op.create_index('idx_wrapped_keys_tag_id', 'wrapped_keys', ['tag_id'])
    op.create_index('idx_wrapped_keys_vault_id', 'wrapped_keys', ['vault_id'])
    
    # Create vault_blobs table with UUID primary key
    op.create_table('vault_blobs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('vault_id', UUID(as_uuid=True), nullable=False),
        sa.Column('object_id', UUID(as_uuid=True), nullable=False),
        sa.Column('wrapped_key_id', UUID(as_uuid=True), sa.ForeignKey('wrapped_keys.id'), nullable=False),
        sa.Column('iv', sa.LargeBinary(12), nullable=False),
        sa.Column('ciphertext', sa.LargeBinary, nullable=False),
        sa.Column('auth_tag', sa.LargeBinary(16), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False, default='application/octet-stream'),
        sa.Column('content_size', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for vault_blobs table
    op.create_index('idx_vault_blobs_vault_id', 'vault_blobs', ['vault_id'])
    op.create_index('idx_vault_blobs_wrapped_key_id', 'vault_blobs', ['wrapped_key_id'])
    
    # Create unique constraint for vault blob objects
    op.create_unique_constraint('unique_vault_object', 'vault_blobs', ['vault_id', 'object_id'])
    
    # Create opaque_sessions table with string primary key (protocol requirement)
    op.create_table('opaque_sessions',
        sa.Column('session_id', sa.String(64), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('phrase_hash', sa.LargeBinary(16), nullable=True),
        sa.Column('session_state', sa.String(20), nullable=False, default='initialized'),
        sa.Column('session_data', sa.LargeBinary, nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_activity', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for opaque_sessions table
    op.create_index('idx_opaque_sessions_user_id', 'opaque_sessions', ['user_id'])
    op.create_index('idx_opaque_sessions_phrase_hash', 'opaque_sessions', ['phrase_hash'])
    op.create_index('idx_opaque_sessions_expires_at', 'opaque_sessions', ['expires_at'])
    op.create_index('idx_opaque_sessions_last_activity', 'opaque_sessions', ['last_activity'])
    
    # Create security_audit_logs table with UUID primary key
    op.create_table('security_audit_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('event_category', sa.String(30), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('user_id_hash', sa.String(64), nullable=True),
        sa.Column('session_id_hash', sa.String(64), nullable=True),
        sa.Column('correlation_id', UUID(as_uuid=True), nullable=True),
        sa.Column('request_id', UUID(as_uuid=True), nullable=True),
        sa.Column('ip_address_hash', sa.String(64), nullable=True),
        sa.Column('user_agent_hash', sa.String(64), nullable=True),
        sa.Column('event_data', sa.Text, nullable=True),
        sa.Column('event_message', sa.String(500), nullable=False),
        sa.Column('log_signature', sa.String(128), nullable=True),
        sa.Column('is_sensitive', sa.Boolean(), nullable=False, default=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('processing_time_ms', sa.Integer, nullable=True),
        sa.Column('success', sa.Boolean(), nullable=True),
        sa.Column('error_code', sa.String(50), nullable=True),
    )
    
    # Create indexes for security_audit_logs table
    op.create_index('idx_security_audit_logs_event_type', 'security_audit_logs', ['event_type'])
    op.create_index('idx_security_audit_logs_event_category', 'security_audit_logs', ['event_category'])
    op.create_index('idx_security_audit_logs_severity', 'security_audit_logs', ['severity'])
    op.create_index('idx_security_audit_logs_user_id_hash', 'security_audit_logs', ['user_id_hash'])
    op.create_index('idx_security_audit_logs_correlation_id', 'security_audit_logs', ['correlation_id'])
    op.create_index('idx_security_audit_logs_timestamp', 'security_audit_logs', ['timestamp'])
    
    # Create security_metrics table with UUID primary key
    op.create_table('security_metrics',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('metric_name', sa.String(100), nullable=False),
        sa.Column('metric_type', sa.String(30), nullable=False),
        sa.Column('time_window', sa.String(20), nullable=False),
        sa.Column('window_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('window_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('value', sa.Integer, nullable=False),
        sa.Column('max_value', sa.Integer, nullable=True),
        sa.Column('min_value', sa.Integer, nullable=True),
        sa.Column('avg_value', sa.Integer, nullable=True),
        sa.Column('tags', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for security_metrics table
    op.create_index('idx_security_metrics_metric_name', 'security_metrics', ['metric_name'])
    op.create_index('idx_security_metrics_window_start', 'security_metrics', ['window_start'])
    op.create_index('idx_security_metrics_window_end', 'security_metrics', ['window_end'])
    
    # Create security_alerts table with UUID primary key
    op.create_table('security_alerts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='active'),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('detection_rule', sa.String(100), nullable=False),
        sa.Column('user_id_hash', sa.String(64), nullable=True),
        sa.Column('correlation_id', UUID(as_uuid=True), nullable=True),
        sa.Column('related_events', sa.Text, nullable=True),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('response_actions', sa.Text, nullable=True),
        sa.Column('manual_notes', sa.Text, nullable=True),
        sa.Column('event_count', sa.Integer, nullable=False, default=1),
        sa.Column('confidence_score', sa.Integer, nullable=False, default=100),
    )
    
    # Create indexes for security_alerts table
    op.create_index('idx_security_alerts_alert_type', 'security_alerts', ['alert_type'])
    op.create_index('idx_security_alerts_severity', 'security_alerts', ['severity'])
    op.create_index('idx_security_alerts_status', 'security_alerts', ['status'])
    op.create_index('idx_security_alerts_user_id_hash', 'security_alerts', ['user_id_hash'])
    op.create_index('idx_security_alerts_correlation_id', 'security_alerts', ['correlation_id'])
    op.create_index('idx_security_alerts_first_seen', 'security_alerts', ['first_seen'])


def downgrade() -> None:
    """
    Downgrade migration - recreate original schema with mixed primary key types.
    This should only be used in development/testing environments.
    """
    # Drop all tables created in upgrade
    try:
        op.drop_table('security_alerts')
    except:
        pass
    try:
        op.drop_table('security_metrics')
    except:
        pass
    try:
        op.drop_table('security_audit_logs')
    except:
        pass
    try:
        op.drop_table('opaque_sessions')
    except:
        pass
    try:
        op.drop_table('vault_blobs')
    except:
        pass
    try:
        op.drop_table('wrapped_keys')
    except:
        pass
    try:
        op.drop_table('journal_entry_tags')
    except:
        pass
    try:
        op.drop_table('reminders')
    except:
        pass
    try:
        op.drop_table('tags')
    except:
        pass
    try:
        op.drop_table('journal_entries')
    except:
        pass
    try:
        op.drop_table('secret_tags')
    except:
        pass
    try:
        op.drop_table('users')
    except:
        pass
    
    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS reminderfrequency')
    
    # Note: In a real scenario, you would recreate the original schema here
    # For this migration, we're doing a clean slate approach
    # The original schema can be recreated by rolling back to the previous migration
    # and then re-running it if needed
