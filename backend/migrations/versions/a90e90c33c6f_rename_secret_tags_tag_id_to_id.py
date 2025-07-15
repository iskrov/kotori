"""rename secret_tags.tag_id to id

Revision ID: a90e90c33c6f
Revises: 1a46576934f6
Create Date: 2025-01-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'a90e90c33c6f'
down_revision = '1a46576934f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Rename secret_tags.tag_id to id for consistency with other tables.
    
    This migration:
    1. Drops foreign key constraints that reference secret_tags.tag_id
    2. Renames secret_tags.tag_id to secret_tags.id
    3. Updates all foreign key references to use the new column name
    4. Recreates foreign key constraints with proper references
    """
    
    # Step 1: Drop foreign key constraints that reference secret_tags.tag_id
    op.drop_constraint('journal_entries_secret_tag_id_fkey', 'journal_entries', type_='foreignkey')
    op.drop_constraint('wrapped_keys_tag_id_fkey', 'wrapped_keys', type_='foreignkey')
    
    # Step 2: Drop indexes on secret_tags.tag_id
    op.drop_index('idx_secret_tags_phrase_hash', table_name='secret_tags')
    op.drop_index('idx_secret_tags_user_id', table_name='secret_tags')
    op.drop_index('idx_secret_tags_user_tag_name', table_name='secret_tags')
    op.drop_index('idx_secret_tags_user_created', table_name='secret_tags')
    
    # Step 3: Drop unique constraints
    op.drop_constraint('secret_tags_phrase_hash_key', 'secret_tags', type_='unique')
    op.drop_constraint('unique_user_secret_tag', 'secret_tags', type_='unique')
    
    # Step 4: Rename secret_tags.tag_id to secret_tags.id
    op.alter_column('secret_tags', 'tag_id', new_column_name='id')
    
    # Step 5: Update foreign key column references
    # Update journal_entries.secret_tag_id to reference the renamed column
    # (The column name stays the same, but now it references secret_tags.id)
    
    # Update wrapped_keys.tag_id to reference the renamed column
    # (The column name stays the same, but now it references secret_tags.id)
    
    # Step 6: Recreate indexes on secret_tags.id
    op.create_index('idx_secret_tags_phrase_hash', 'secret_tags', ['phrase_hash'], unique=True)
    op.create_index('idx_secret_tags_user_id', 'secret_tags', ['user_id'])
    op.create_index('idx_secret_tags_user_tag_name', 'secret_tags', ['user_id', 'tag_name'])
    op.create_index('idx_secret_tags_user_created', 'secret_tags', ['user_id', 'created_at'])
    
    # Step 7: Recreate unique constraints
    op.create_unique_constraint('secret_tags_phrase_hash_key', 'secret_tags', ['phrase_hash'])
    op.create_unique_constraint('unique_user_secret_tag', 'secret_tags', ['user_id', 'tag_name'])
    
    # Step 8: Recreate foreign key constraints with proper references
    op.create_foreign_key('journal_entries_secret_tag_id_fkey', 'journal_entries', 'secret_tags', ['secret_tag_id'], ['id'])
    op.create_foreign_key('wrapped_keys_tag_id_fkey', 'wrapped_keys', 'secret_tags', ['tag_id'], ['id'])


def downgrade() -> None:
    """
    Revert secret_tags.id back to tag_id.
    
    This reverses all the changes made in upgrade().
    """
    
    # Step 1: Drop foreign key constraints
    op.drop_constraint('journal_entries_secret_tag_id_fkey', 'journal_entries', type_='foreignkey')
    op.drop_constraint('wrapped_keys_tag_id_fkey', 'wrapped_keys', type_='foreignkey')
    
    # Step 2: Drop indexes
    op.drop_index('idx_secret_tags_phrase_hash', table_name='secret_tags')
    op.drop_index('idx_secret_tags_user_id', table_name='secret_tags')
    op.drop_index('idx_secret_tags_user_tag_name', table_name='secret_tags')
    op.drop_index('idx_secret_tags_user_created', table_name='secret_tags')
    
    # Step 3: Drop unique constraints
    op.drop_constraint('secret_tags_phrase_hash_key', 'secret_tags', type_='unique')
    op.drop_constraint('unique_user_secret_tag', 'secret_tags', type_='unique')
    
    # Step 4: Rename secret_tags.id back to secret_tags.tag_id
    op.alter_column('secret_tags', 'id', new_column_name='tag_id')
    
    # Step 5: Recreate indexes with original names
    op.create_index('idx_secret_tags_phrase_hash', 'secret_tags', ['phrase_hash'], unique=True)
    op.create_index('idx_secret_tags_user_id', 'secret_tags', ['user_id'])
    op.create_index('idx_secret_tags_user_tag_name', 'secret_tags', ['user_id', 'tag_name'])
    op.create_index('idx_secret_tags_user_created', 'secret_tags', ['user_id', 'created_at'])
    
    # Step 6: Recreate unique constraints
    op.create_unique_constraint('secret_tags_phrase_hash_key', 'secret_tags', ['phrase_hash'])
    op.create_unique_constraint('unique_user_secret_tag', 'secret_tags', ['user_id', 'tag_name'])
    
    # Step 7: Recreate foreign key constraints with original references
    op.create_foreign_key('journal_entries_secret_tag_id_fkey', 'journal_entries', 'secret_tags', ['secret_tag_id'], ['tag_id'])
    op.create_foreign_key('wrapped_keys_tag_id_fkey', 'wrapped_keys', 'secret_tags', ['tag_id'], ['tag_id'])
