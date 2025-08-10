"""stage_2_remove_secret_tag_schema

Revision ID: a1b2c3d4e5f6
Revises: f0d9b1c3f4a1
Create Date: 2025-08-09 12:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f0d9b1c3f4a1"
branch_labels = None
depends_on = None


def _exec(sql: str) -> None:
    op.execute(sql)


def upgrade() -> None:
    """
    Stage 2: Destructive removal of legacy secret-tag schema objects.
    
    Order of operations (safe dependency order):
    1. Drop foreign key constraints referencing secret_tags
    2. Drop dependent tables: tag_sessions, vault_blobs, wrapped_keys
    3. Drop journal_entries.secret_tag_id column and related indexes
    4. Drop secret_tags table and all its indexes/constraints
    """
    
    # Step 1: Drop foreign key constraints that reference secret_tags
    _exec(
        """
        DO $$
        BEGIN
            -- Drop FK from journal_entries.secret_tag_id if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'journal_entries_secret_tag_id_fkey' 
                AND table_name = 'journal_entries'
            ) THEN
                ALTER TABLE journal_entries DROP CONSTRAINT journal_entries_secret_tag_id_fkey;
            END IF;
            
            -- Drop FK from wrapped_keys.tag_id if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'wrapped_keys_tag_id_fkey' 
                AND table_name = 'wrapped_keys'
            ) THEN
                ALTER TABLE wrapped_keys DROP CONSTRAINT wrapped_keys_tag_id_fkey;
            END IF;
            
            -- Drop FK from tag_sessions.tag_id if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'tag_sessions_tag_id_fkey' 
                AND table_name = 'tag_sessions'
            ) THEN
                ALTER TABLE tag_sessions DROP CONSTRAINT tag_sessions_tag_id_fkey;
            END IF;
        END$$;
        """
    )
    
    # Step 2: Drop dependent tables in safe order
    _exec(
        """
        DO $$
        BEGIN
            -- Drop tag_sessions table if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'tag_sessions'
            ) THEN
                DROP TABLE tag_sessions CASCADE;
            END IF;
            
            -- Drop vault_blobs table if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'vault_blobs'
            ) THEN
                DROP TABLE vault_blobs CASCADE;
            END IF;
            
            -- Drop wrapped_keys table if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'wrapped_keys'
            ) THEN
                DROP TABLE wrapped_keys CASCADE;
            END IF;
        END$$;
        """
    )
    
    # Step 3: Drop journal_entries.secret_tag_id column and related indexes
    _exec(
        """
        DO $$
        BEGIN
            -- Drop indexes on secret_tag_id if they exist
            IF EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = 'idx_journal_entries_secret_tag_id'
            ) THEN
                DROP INDEX idx_journal_entries_secret_tag_id;
            END IF;
            
            IF EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = 'ix_journal_entries_secret_tag_id'
            ) THEN
                DROP INDEX ix_journal_entries_secret_tag_id;
            END IF;
            
            -- Drop the secret_tag_id column if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'journal_entries' 
                AND column_name = 'secret_tag_id'
            ) THEN
                ALTER TABLE journal_entries DROP COLUMN secret_tag_id;
            END IF;
        END$$;
        """
    )
    
    # Step 4: Drop secret_tags table and all related objects
    _exec(
        """
        DO $$
        BEGIN
            -- Drop secret_tags table if it exists (CASCADE will handle remaining dependencies)
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'secret_tags'
            ) THEN
                DROP TABLE secret_tags CASCADE;
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    """
    Downgrade: Recreate the secret-tag schema.
    
    WARNING: This will recreate empty tables. Data will not be restored.
    This is primarily for development/testing rollback scenarios.
    """
    
    # Recreate secret_tags table with clean schema (from 23ca77cbbca2 migration)
    op.create_table(
        'secret_tags',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tag_handle', sa.LargeBinary(32), nullable=False, unique=True),
        sa.Column('opaque_envelope', sa.LargeBinary(), nullable=False),
        sa.Column('tag_name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Recreate indexes
    op.create_index('idx_secret_tags_user_id', 'secret_tags', ['user_id'])
    op.create_index('idx_secret_tags_handle', 'secret_tags', ['tag_handle'], unique=True)
    op.create_index('idx_secret_tags_user_tag_name', 'secret_tags', ['user_id', 'tag_name'])
    op.create_index('idx_secret_tags_user_created', 'secret_tags', ['user_id', 'created_at'])
    
    # Recreate unique constraint
    op.create_unique_constraint('unique_user_secret_tag', 'secret_tags', ['user_id', 'tag_name'])
    
    # Recreate wrapped_keys table
    op.create_table(
        'wrapped_keys',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tag_id', UUID(as_uuid=True), sa.ForeignKey('secret_tags.id'), nullable=False),
        sa.Column('vault_id', UUID(as_uuid=True), nullable=False),
        sa.Column('wrapped_key', sa.LargeBinary(40), nullable=False),
        sa.Column('key_algorithm', sa.String(20), nullable=False, default='AES-KW'),
        sa.Column('key_version', sa.Integer(), nullable=False, default=1),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    op.create_index('idx_wrapped_keys_tag_id', 'wrapped_keys', ['tag_id'])
    op.create_index('idx_wrapped_keys_vault_id', 'wrapped_keys', ['vault_id'])
    
    # Recreate vault_blobs table
    op.create_table(
        'vault_blobs',
        sa.Column('vault_id', UUID(as_uuid=True), primary_key=True),
        sa.Column('object_id', UUID(as_uuid=True), primary_key=True),
        sa.Column('wrapped_key_id', UUID(as_uuid=True), sa.ForeignKey('wrapped_keys.id'), nullable=False),
        sa.Column('iv', sa.LargeBinary(12), nullable=False),
        sa.Column('ciphertext', sa.LargeBinary(), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('content_size', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    op.create_index('idx_vault_blobs_wrapped_key_id', 'vault_blobs', ['wrapped_key_id'])
    
    # Recreate tag_sessions table
    op.create_table(
        'tag_sessions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tag_id', UUID(as_uuid=True), sa.ForeignKey('secret_tags.id'), nullable=False),
        sa.Column('server_ephemeral', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    op.create_index('idx_tag_sessions_user_id', 'tag_sessions', ['user_id'])
    op.create_index('idx_tag_sessions_tag_id', 'tag_sessions', ['tag_id'])
    op.create_index('idx_tag_sessions_created_at', 'tag_sessions', ['created_at'])
    
    # Recreate journal_entries.secret_tag_id column
    op.add_column('journal_entries', sa.Column('secret_tag_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('journal_entries_secret_tag_id_fkey', 'journal_entries', 'secret_tags', ['secret_tag_id'], ['id'])
    op.create_index('idx_journal_entries_secret_tag_id', 'journal_entries', ['secret_tag_id'])
