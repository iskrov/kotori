#!/usr/bin/env python3
"""
Data Migration Scripts for UUID Schema Conversion

This module provides comprehensive data migration scripts for safely converting
existing data to the new UUID-based schema. It handles:
- User model UUID conversion from String(36) to native UUID
- Foreign key migrations for dependent models
- Batch processing for large datasets
- Data validation and integrity checks
- Rollback procedures

Usage:
    python data_migration.py --operation=validate_schema
    python data_migration.py --operation=backup_data
    python data_migration.py --operation=migrate_users
    python data_migration.py --operation=migrate_foreign_keys
    python data_migration.py --operation=validate_migration
    python data_migration.py --operation=rollback
"""

import argparse
import logging
import sys
import uuid
from datetime import datetime, UTC
from typing import Dict, List, Optional, Tuple, Any
from contextlib import contextmanager
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy import create_engine, text, MetaData, Table, Column, String, Integer, DateTime, Boolean, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from alembic import command
from alembic.config import Config

# Add the parent directory to the path so we can import our app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings

# Constants
BATCH_SIZE = 1000
BACKUP_SCHEMA = "migration_backup"
MIGRATION_LOG_TABLE = "migration_log"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

class MigrationError(Exception):
    """Custom exception for migration errors."""
    pass

class DataMigrationManager:
    """Manages data migration operations for UUID schema conversion."""
    
    def __init__(self, database_url: str = None):
        """Initialize the migration manager."""
        self.database_url = database_url or settings.DATABASE_URL
        self.engine = create_engine(self.database_url)
        self.Session = sessionmaker(bind=self.engine)
        self.metadata = MetaData()
        
        # Migration state tracking
        self.migration_state = {
            'users_migrated': False,
            'foreign_keys_migrated': False,
            'backup_created': False,
            'validated': False
        }
        
    @contextmanager
    def get_session(self):
        """Context manager for database sessions."""
        session = self.Session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()
            
    def create_migration_log_table(self):
        """Create migration log table to track migration progress."""
        with self.engine.connect() as conn:
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {MIGRATION_LOG_TABLE} (
                    id SERIAL PRIMARY KEY,
                    operation VARCHAR(100) NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    message TEXT,
                    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    completed_at TIMESTAMP WITH TIME ZONE,
                    metadata JSON
                )
            """))
            conn.commit()
            
    def log_migration_step(self, operation: str, status: str, message: str = None, metadata: Dict = None):
        """Log migration step to tracking table."""
        with self.engine.connect() as conn:
            conn.execute(text(f"""
                INSERT INTO {MIGRATION_LOG_TABLE} (operation, status, message, metadata)
                VALUES (:operation, :status, :message, :metadata)
            """), {
                'operation': operation,
                'status': status,
                'message': message,
                'metadata': metadata
            })
            conn.commit()
            
    def validate_schema(self) -> bool:
        """Validate current schema state before migration."""
        logger.info("Validating current schema state...")
        
        try:
            with self.engine.connect() as conn:
                # Check if tables exist
                result = conn.execute(text("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name IN ('users', 'journal_entries', 'tags', 'reminders')
                """))
                existing_tables = [row[0] for row in result.fetchall()]
                
                if len(existing_tables) != 4:
                    missing = {'users', 'journal_entries', 'tags', 'reminders'} - set(existing_tables)
                    raise MigrationError(f"Missing tables: {missing}")
                
                # Check column types
                result = conn.execute(text("""
                    SELECT table_name, column_name, data_type, udt_name
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND ((table_name = 'users' AND column_name = 'id') OR
                         (table_name IN ('journal_entries', 'tags', 'reminders') AND column_name = 'user_id'))
                """))
                
                column_info = {f"{row[0]}.{row[1]}": row[3] for row in result.fetchall()}
                
                # Check if already migrated (UUID types)
                if column_info.get('users.id') == 'uuid':
                    logger.info("Schema already migrated to UUID types")
                    return True
                
                # Check if needs migration (varchar/text types)
                if column_info.get('users.id') in ('varchar', 'text'):
                    logger.info("Schema needs migration from string to UUID")
                    return True
                
                logger.error(f"Unexpected column types: {column_info}")
                return False
                
        except Exception as e:
            logger.error(f"Schema validation failed: {e}")
            return False
            
    def create_backup(self) -> bool:
        """Create backup of current data before migration."""
        logger.info("Creating data backup...")
        
        try:
            with self.engine.connect() as conn:
                # Create backup schema
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {BACKUP_SCHEMA}"))
                
                # Backup tables
                tables_to_backup = ['users', 'journal_entries', 'tags', 'reminders']
                
                for table in tables_to_backup:
                    logger.info(f"Backing up table: {table}")
                    
                    # Get row count
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    row_count = result.fetchone()[0]
                    
                    if row_count > 0:
                        # Create backup table
                        conn.execute(text(f"""
                            CREATE TABLE {BACKUP_SCHEMA}.{table}_backup AS 
                            SELECT * FROM {table}
                        """))
                        
                        # Verify backup
                        result = conn.execute(text(f"SELECT COUNT(*) FROM {BACKUP_SCHEMA}.{table}_backup"))
                        backup_count = result.fetchone()[0]
                        
                        if backup_count != row_count:
                            raise MigrationError(f"Backup verification failed for {table}: {row_count} != {backup_count}")
                            
                        logger.info(f"Backed up {row_count} rows from {table}")
                    else:
                        logger.info(f"No data to backup in {table}")
                
                conn.commit()
                self.migration_state['backup_created'] = True
                self.log_migration_step('backup', 'completed', 'Data backup created successfully')
                return True
                
        except Exception as e:
            logger.error(f"Backup creation failed: {e}")
            self.log_migration_step('backup', 'failed', str(e))
            return False
            
    def migrate_users(self) -> bool:
        """Migrate user IDs from String(36) to native UUID."""
        logger.info("Starting user ID migration...")
        
        try:
            with self.engine.connect() as conn:
                # Check if users table needs migration
                result = conn.execute(text("""
                    SELECT data_type FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'id'
                """))
                current_type = result.fetchone()[0]
                
                if current_type == 'uuid':
                    logger.info("Users table already uses UUID type")
                    self.migration_state['users_migrated'] = True
                    return True
                
                # Get total user count
                result = conn.execute(text("SELECT COUNT(*) FROM users"))
                total_users = result.fetchone()[0]
                
                if total_users == 0:
                    logger.info("No users to migrate")
                    self.migration_state['users_migrated'] = True
                    return True
                
                logger.info(f"Migrating {total_users} users...")
                
                # Create temporary UUID column
                conn.execute(text("ALTER TABLE users ADD COLUMN id_uuid UUID"))
                
                # Migrate in batches
                migrated_count = 0
                for offset in range(0, total_users, BATCH_SIZE):
                    # Get batch of users
                    result = conn.execute(text("""
                        SELECT id FROM users 
                        ORDER BY id 
                        LIMIT :batch_size OFFSET :offset
                    """), {'batch_size': BATCH_SIZE, 'offset': offset})
                    
                    batch_users = result.fetchall()
                    
                    for user in batch_users:
                        old_id = user[0]
                        
                        # Validate UUID format
                        try:
                            uuid_obj = uuid.UUID(old_id)
                            new_id = uuid_obj
                        except ValueError:
                            raise MigrationError(f"Invalid UUID format: {old_id}")
                        
                        # Update with UUID
                        conn.execute(text("""
                            UPDATE users 
                            SET id_uuid = :new_id 
                            WHERE id = :old_id
                        """), {'new_id': new_id, 'old_id': old_id})
                        
                        migrated_count += 1
                    
                    conn.commit()
                    logger.info(f"Migrated {migrated_count}/{total_users} users")
                
                # Verify all users have UUID values
                result = conn.execute(text("SELECT COUNT(*) FROM users WHERE id_uuid IS NULL"))
                null_count = result.fetchone()[0]
                
                if null_count > 0:
                    raise MigrationError(f"Migration incomplete: {null_count} users missing UUID values")
                
                # Replace old column with new UUID column
                conn.execute(text("ALTER TABLE users DROP COLUMN id CASCADE"))
                conn.execute(text("ALTER TABLE users RENAME COLUMN id_uuid TO id"))
                conn.execute(text("ALTER TABLE users ADD PRIMARY KEY (id)"))
                
                conn.commit()
                self.migration_state['users_migrated'] = True
                self.log_migration_step('migrate_users', 'completed', f'Migrated {migrated_count} users')
                
                logger.info(f"User migration completed: {migrated_count} users migrated")
                return True
                
        except Exception as e:
            logger.error(f"User migration failed: {e}")
            self.log_migration_step('migrate_users', 'failed', str(e))
            return False
            
    def migrate_foreign_keys(self) -> bool:
        """Migrate foreign key references to use UUID."""
        logger.info("Starting foreign key migration...")
        
        try:
            with self.engine.connect() as conn:
                # Tables with user_id foreign keys
                fk_tables = ['journal_entries', 'tags', 'reminders']
                
                for table in fk_tables:
                    logger.info(f"Migrating foreign keys in {table}...")
                    
                    # Check if already migrated
                    result = conn.execute(text(f"""
                        SELECT data_type FROM information_schema.columns 
                        WHERE table_name = '{table}' AND column_name = 'user_id'
                    """))
                    current_type = result.fetchone()[0]
                    
                    if current_type == 'uuid':
                        logger.info(f"{table} already uses UUID foreign keys")
                        continue
                    
                    # Get total row count
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    total_rows = result.fetchone()[0]
                    
                    if total_rows == 0:
                        logger.info(f"No data to migrate in {table}")
                        continue
                    
                    # Create temporary UUID column
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id_uuid UUID"))
                    
                    # Migrate in batches
                    migrated_count = 0
                    for offset in range(0, total_rows, BATCH_SIZE):
                        # Get batch of records
                        result = conn.execute(text(f"""
                            SELECT id, user_id FROM {table} 
                            WHERE user_id IS NOT NULL
                            ORDER BY id 
                            LIMIT :batch_size OFFSET :offset
                        """), {'batch_size': BATCH_SIZE, 'offset': offset})
                        
                        batch_records = result.fetchall()
                        
                        for record in batch_records:
                            record_id, old_user_id = record
                            
                            # Validate and convert UUID
                            try:
                                uuid_obj = uuid.UUID(old_user_id)
                                new_user_id = uuid_obj
                            except ValueError:
                                raise MigrationError(f"Invalid UUID format in {table}: {old_user_id}")
                            
                            # Update with UUID
                            conn.execute(text(f"""
                                UPDATE {table} 
                                SET user_id_uuid = :new_user_id 
                                WHERE id = :record_id
                            """), {'new_user_id': new_user_id, 'record_id': record_id})
                            
                            migrated_count += 1
                        
                        conn.commit()
                        logger.info(f"Migrated {migrated_count}/{total_rows} records in {table}")
                    
                    # Verify migration
                    result = conn.execute(text(f"""
                        SELECT COUNT(*) FROM {table} 
                        WHERE user_id IS NOT NULL AND user_id_uuid IS NULL
                    """))
                    null_count = result.fetchone()[0]
                    
                    if null_count > 0:
                        raise MigrationError(f"Migration incomplete in {table}: {null_count} records missing UUID values")
                    
                    # Replace old column with new UUID column
                    conn.execute(text(f"ALTER TABLE {table} DROP COLUMN user_id CASCADE"))
                    conn.execute(text(f"ALTER TABLE {table} RENAME COLUMN user_id_uuid TO user_id"))
                    
                    # Re-create foreign key constraint
                    conn.execute(text(f"""
                        ALTER TABLE {table} 
                        ADD CONSTRAINT fk_{table}_user_id 
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    """))
                    
                    # Create index on foreign key
                    conn.execute(text(f"CREATE INDEX ix_{table}_user_id ON {table} (user_id)"))
                    
                    conn.commit()
                    logger.info(f"Foreign key migration completed for {table}: {migrated_count} records")
                
                self.migration_state['foreign_keys_migrated'] = True
                self.log_migration_step('migrate_foreign_keys', 'completed', 'All foreign keys migrated')
                
                logger.info("Foreign key migration completed")
                return True
                
        except Exception as e:
            logger.error(f"Foreign key migration failed: {e}")
            self.log_migration_step('migrate_foreign_keys', 'failed', str(e))
            return False
            
    def validate_migration(self) -> bool:
        """Validate the migration was successful."""
        logger.info("Validating migration...")
        
        try:
            with self.engine.connect() as conn:
                # Check data types
                result = conn.execute(text("""
                    SELECT table_name, column_name, data_type, udt_name
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND ((table_name = 'users' AND column_name = 'id') OR
                         (table_name IN ('journal_entries', 'tags', 'reminders') AND column_name = 'user_id'))
                """))
                
                column_info = {f"{row[0]}.{row[1]}": row[3] for row in result.fetchall()}
                
                # Verify all columns are UUID type
                expected_columns = [
                    'users.id',
                    'journal_entries.user_id',
                    'tags.user_id',
                    'reminders.user_id'
                ]
                
                for col in expected_columns:
                    if column_info.get(col) != 'uuid':
                        raise MigrationError(f"Column {col} is not UUID type: {column_info.get(col)}")
                
                # Check referential integrity
                result = conn.execute(text("""
                    SELECT 
                        (SELECT COUNT(*) FROM journal_entries WHERE user_id NOT IN (SELECT id FROM users)) as orphaned_entries,
                        (SELECT COUNT(*) FROM tags WHERE user_id NOT IN (SELECT id FROM users)) as orphaned_tags,
                        (SELECT COUNT(*) FROM reminders WHERE user_id NOT IN (SELECT id FROM users)) as orphaned_reminders
                """))
                
                orphaned = result.fetchone()
                if any(orphaned):
                    raise MigrationError(f"Orphaned records found: entries={orphaned[0]}, tags={orphaned[1]}, reminders={orphaned[2]}")
                
                # Check data counts match backup
                if self.migration_state['backup_created']:
                    tables = ['users', 'journal_entries', 'tags', 'reminders']
                    for table in tables:
                        result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                        current_count = result.fetchone()[0]
                        
                        result = conn.execute(text(f"SELECT COUNT(*) FROM {BACKUP_SCHEMA}.{table}_backup"))
                        backup_count = result.fetchone()[0] if result.fetchone() else 0
                        
                        if current_count != backup_count:
                            raise MigrationError(f"Data count mismatch in {table}: {current_count} != {backup_count}")
                
                self.migration_state['validated'] = True
                self.log_migration_step('validate_migration', 'completed', 'Migration validation successful')
                
                logger.info("Migration validation completed successfully")
                return True
                
        except Exception as e:
            logger.error(f"Migration validation failed: {e}")
            self.log_migration_step('validate_migration', 'failed', str(e))
            return False
            
    def rollback_migration(self) -> bool:
        """Rollback migration using backup data."""
        logger.info("Starting migration rollback...")
        
        try:
            with self.engine.connect() as conn:
                # Check if backup exists
                result = conn.execute(text(f"""
                    SELECT schema_name FROM information_schema.schemata 
                    WHERE schema_name = '{BACKUP_SCHEMA}'
                """))
                
                if not result.fetchone():
                    raise MigrationError("Backup schema not found - cannot rollback")
                
                # Rollback tables
                tables = ['users', 'journal_entries', 'tags', 'reminders']
                
                for table in tables:
                    logger.info(f"Rolling back {table}...")
                    
                    # Check if backup table exists
                    result = conn.execute(text(f"""
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_schema = '{BACKUP_SCHEMA}' AND table_name = '{table}_backup'
                    """))
                    
                    if not result.fetchone():
                        logger.warning(f"No backup found for {table}")
                        continue
                    
                    # Drop current table and recreate from backup
                    conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                    conn.execute(text(f"""
                        CREATE TABLE {table} AS 
                        SELECT * FROM {BACKUP_SCHEMA}.{table}_backup
                    """))
                    
                    # Recreate primary key and constraints
                    if table == 'users':
                        conn.execute(text(f"ALTER TABLE {table} ADD PRIMARY KEY (id)"))
                    else:
                        conn.execute(text(f"ALTER TABLE {table} ADD PRIMARY KEY (id)"))
                        conn.execute(text(f"""
                            ALTER TABLE {table} 
                            ADD CONSTRAINT fk_{table}_user_id 
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        """))
                    
                    conn.commit()
                    logger.info(f"Rollback completed for {table}")
                
                self.log_migration_step('rollback_migration', 'completed', 'Migration rollback successful')
                
                logger.info("Migration rollback completed")
                return True
                
        except Exception as e:
            logger.error(f"Migration rollback failed: {e}")
            self.log_migration_step('rollback_migration', 'failed', str(e))
            return False
            
    def cleanup_backup(self) -> bool:
        """Clean up backup schema after successful migration."""
        logger.info("Cleaning up backup data...")
        
        try:
            with self.engine.connect() as conn:
                conn.execute(text(f"DROP SCHEMA IF EXISTS {BACKUP_SCHEMA} CASCADE"))
                conn.commit()
                
                logger.info("Backup cleanup completed")
                return True
                
        except Exception as e:
            logger.error(f"Backup cleanup failed: {e}")
            return False
            
    def get_migration_status(self) -> Dict:
        """Get current migration status."""
        return {
            'state': self.migration_state,
            'timestamp': datetime.now(UTC).isoformat()
        }


def main():
    """Main entry point for data migration script."""
    parser = argparse.ArgumentParser(description='Data Migration for UUID Schema Conversion')
    parser.add_argument('--operation', required=True, choices=[
        'validate_schema', 'backup_data', 'migrate_users', 'migrate_foreign_keys',
        'validate_migration', 'rollback', 'cleanup_backup', 'full_migration', 'status'
    ], help='Migration operation to perform')
    parser.add_argument('--database-url', help='Database URL (defaults to settings)')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE, help='Batch size for processing')
    
    args = parser.parse_args()
    
    # Update global batch size from arguments
    if args.batch_size != BATCH_SIZE:
        globals()['BATCH_SIZE'] = args.batch_size
    
    # Initialize migration manager
    migration_manager = DataMigrationManager(args.database_url)
    migration_manager.create_migration_log_table()
    
    success = True
    
    try:
        if args.operation == 'validate_schema':
            success = migration_manager.validate_schema()
            
        elif args.operation == 'backup_data':
            success = migration_manager.create_backup()
            
        elif args.operation == 'migrate_users':
            success = migration_manager.migrate_users()
            
        elif args.operation == 'migrate_foreign_keys':
            success = migration_manager.migrate_foreign_keys()
            
        elif args.operation == 'validate_migration':
            success = migration_manager.validate_migration()
            
        elif args.operation == 'rollback':
            success = migration_manager.rollback_migration()
            
        elif args.operation == 'cleanup_backup':
            success = migration_manager.cleanup_backup()
            
        elif args.operation == 'full_migration':
            logger.info("Starting full migration process...")
            
            # Step 1: Validate schema
            if not migration_manager.validate_schema():
                raise MigrationError("Schema validation failed")
                
            # Step 2: Create backup
            if not migration_manager.create_backup():
                raise MigrationError("Backup creation failed")
                
            # Step 3: Migrate users
            if not migration_manager.migrate_users():
                raise MigrationError("User migration failed")
                
            # Step 4: Migrate foreign keys
            if not migration_manager.migrate_foreign_keys():
                raise MigrationError("Foreign key migration failed")
                
            # Step 5: Validate migration
            if not migration_manager.validate_migration():
                raise MigrationError("Migration validation failed")
                
            logger.info("Full migration completed successfully")
            
        elif args.operation == 'status':
            status = migration_manager.get_migration_status()
            logger.info(f"Migration status: {status}")
            
    except Exception as e:
        logger.error(f"Migration operation failed: {e}")
        success = False
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main() 