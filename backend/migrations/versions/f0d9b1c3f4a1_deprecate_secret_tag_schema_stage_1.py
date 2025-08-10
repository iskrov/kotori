"""deprecate_secret_tag_schema_stage_1

Revision ID: f0d9b1c3f4a1
Revises: 5116795d9b74
Create Date: 2025-08-09 12:20:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "f0d9b1c3f4a1"
down_revision = "5116795d9b74"
branch_labels = None
depends_on = None


DEPRECATION_COMMENT = (
    "DEPRECATED (PBI-4 Stage 1): Legacy secret-tag object retained for compatibility. "
    "Feature disabled while ENABLE_SECRET_TAGS=false. No writes should occur."
)

COLUMN_DEPRECATION_COMMENT = (
    "DEPRECATED (PBI-4 Stage 1): Optional FK/field for legacy secret-tags. "
    "Not used when ENABLE_SECRET_TAGS=false."
)


def _exec(sql: str) -> None:
    op.execute(sql)


def upgrade() -> None:
    # Add comments and disable triggers for legacy secret-tag related tables, if they exist
    _exec(
        f"""
        DO $$
        BEGIN
            -- secret_tags
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'secret_tags'
            ) THEN
                EXECUTE 'COMMENT ON TABLE public.secret_tags IS ' || quote_literal('{DEPRECATION_COMMENT}');
                EXECUTE 'ALTER TABLE public.secret_tags DISABLE TRIGGER ALL';
            END IF;

            -- wrapped_keys
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'wrapped_keys'
            ) THEN
                EXECUTE 'COMMENT ON TABLE public.wrapped_keys IS ' || quote_literal('{DEPRECATION_COMMENT}');
                EXECUTE 'ALTER TABLE public.wrapped_keys DISABLE TRIGGER ALL';
            END IF;

            -- vault_blobs
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'vault_blobs'
            ) THEN
                EXECUTE 'COMMENT ON TABLE public.vault_blobs IS ' || quote_literal('{DEPRECATION_COMMENT}');
                EXECUTE 'ALTER TABLE public.vault_blobs DISABLE TRIGGER ALL';
            END IF;

            -- tag_sessions
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'tag_sessions'
            ) THEN
                EXECUTE 'COMMENT ON TABLE public.tag_sessions IS ' || quote_literal('{DEPRECATION_COMMENT}');
                EXECUTE 'ALTER TABLE public.tag_sessions DISABLE TRIGGER ALL';
            END IF;

            -- Column comments for references
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'secret_tag_id'
            ) THEN
                EXECUTE 'COMMENT ON COLUMN public.journal_entries.secret_tag_id IS ' || quote_literal('{COLUMN_DEPRECATION_COMMENT}');
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'wrapped_keys' AND column_name = 'tag_id'
            ) THEN
                EXECUTE 'COMMENT ON COLUMN public.wrapped_keys.tag_id IS ' || quote_literal('{COLUMN_DEPRECATION_COMMENT}');
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'tag_sessions' AND column_name = 'tag_id'
            ) THEN
                EXECUTE 'COMMENT ON COLUMN public.tag_sessions.tag_id IS ' || quote_literal('{COLUMN_DEPRECATION_COMMENT}');
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    # Re-enable triggers and remove comments (set to NULL) if the objects exist
    _exec(
        """
        DO $$
        BEGIN
            -- secret_tags
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'secret_tags'
            ) THEN
                EXECUTE 'ALTER TABLE public.secret_tags ENABLE TRIGGER ALL';
                EXECUTE 'COMMENT ON TABLE public.secret_tags IS NULL';
            END IF;

            -- wrapped_keys
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'wrapped_keys'
            ) THEN
                EXECUTE 'ALTER TABLE public.wrapped_keys ENABLE TRIGGER ALL';
                EXECUTE 'COMMENT ON TABLE public.wrapped_keys IS NULL';
            END IF;

            -- vault_blobs
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'vault_blobs'
            ) THEN
                EXECUTE 'ALTER TABLE public.vault_blobs ENABLE TRIGGER ALL';
                EXECUTE 'COMMENT ON TABLE public.vault_blobs IS NULL';
            END IF;

            -- tag_sessions
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'tag_sessions'
            ) THEN
                EXECUTE 'ALTER TABLE public.tag_sessions ENABLE TRIGGER ALL';
                EXECUTE 'COMMENT ON TABLE public.tag_sessions IS NULL';
            END IF;

            -- Column comments
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'secret_tag_id'
            ) THEN
                EXECUTE 'COMMENT ON COLUMN public.journal_entries.secret_tag_id IS NULL';
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'wrapped_keys' AND column_name = 'tag_id'
            ) THEN
                EXECUTE 'COMMENT ON COLUMN public.wrapped_keys.tag_id IS NULL';
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'tag_sessions' AND column_name = 'tag_id'
            ) THEN
                EXECUTE 'COMMENT ON COLUMN public.tag_sessions.tag_id IS NULL';
            END IF;
        END$$;
        """
    )


