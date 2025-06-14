"""merge_secret_tags_migrations

Revision ID: 3491d7c81daa
Revises: cleanup_old_secret_tags_001, create_secret_tags_table
Create Date: 2025-06-13 23:03:03.986525

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3491d7c81daa'
down_revision = ('cleanup_old_secret_tags_001', 'create_secret_tags_table')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
