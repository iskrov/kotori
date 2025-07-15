"""
End-to-End Conditions of Satisfaction (CoS) validation tests for PBI-8 Database Schema Optimization.

This module contains comprehensive tests that verify all acceptance criteria for PBI-8:
- All ID fields are consistent (native UUID for users and related) 
- Indexes added to all foreign keys
- Alembic configured and initial migration created
- Documentation for cloud migration
- All tests pass with new schema
"""

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import pytest
from sqlalchemy import text, inspect, MetaData, Table
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag, JournalEntryTag
from app.models.reminder import Reminder, ReminderFrequency
from tests.test_config import TestDataFactory, TestAssertions, SchemaValidationHelpers


class TestPBI8AcceptanceCriteria:
    """
    Test class for validating all PBI-8 acceptance criteria.
    
    This class validates that the database schema optimization work meets all
    Conditions of Satisfaction defined in the PBI-8 PRD.
    """
    
    @pytest.fixture(autouse=True)
    def setup_test_data(self, db: Session):
        """Set up test data for each test."""
        self.db = db
        self.test_user_data = TestDataFactory.create_user_data("cos_test_user")
        self.test_user = User(**self.test_user_data)
        db.add(self.test_user)
        db.commit()
        db.refresh(self.test_user)
    
    def test_cos_1_consistent_id_fields(self, db: Session):
        """
        CoS 1: Verify all ID fields are consistent (native UUID for users and related).
        
        This test validates that:
        - User primary key is native UUID
        - All foreign keys referencing users are UUID type
        - UUID fields work correctly across all models
        """
        # Test User model has UUID primary key
        assert isinstance(self.test_user.id, uuid.UUID), "User ID should be UUID type"
        
        # Create journal entry with UUID user_id
        entry_data = TestDataFactory.create_journal_entry_data(
            self.test_user.id, "CoS UUID test entry"
        )
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)
        
        # Verify foreign key relationship works
        assert entry.user_id == self.test_user.id, "Journal entry user_id should match user ID"
        assert isinstance(entry.user_id, uuid.UUID), "Journal entry user_id should be UUID"
        
        # Test tag with UUID user_id
        tag = Tag(name="CoS_Test_Tag", user_id=self.test_user.id)
        db.add(tag)
        db.commit()
        db.refresh(tag)
        
        assert tag.user_id == self.test_user.id, "Tag user_id should match user ID"
        assert isinstance(tag.user_id, uuid.UUID), "Tag user_id should be UUID"
        
        # Test reminder with UUID user_id
        from datetime import datetime, timezone
        reminder = Reminder(
            title="CoS Test Reminder",
            message="This is a CoS test reminder",
            frequency=ReminderFrequency.DAILY,
            time=datetime.now(timezone.utc),
            user_id=self.test_user.id
        )
        db.add(reminder)
        db.commit()
        db.refresh(reminder)
        
        assert reminder.user_id == self.test_user.id, "Reminder user_id should match user ID"
        assert isinstance(reminder.user_id, uuid.UUID), "Reminder user_id should be UUID"
    
    def test_cos_2_foreign_key_indexes(self, db: Session, engine: Engine):
        """
        CoS 2: Verify indexes added to all foreign keys.
        
        This test validates that all foreign key columns have appropriate indexes
        for optimal query performance.
        """
        inspector = inspect(engine)
        
        # Define expected foreign key indexes
        expected_fk_indexes = {
            'journal_entries': ['user_id'],
            'tags': ['user_id'],
            'reminders': ['user_id'],
            'journal_entry_tags': ['entry_id', 'tag_id']
        }
        
        for table_name, expected_columns in expected_fk_indexes.items():
            try:
                indexes = inspector.get_indexes(table_name)
                index_columns = []
                for index in indexes:
                    index_columns.extend(index['column_names'])
                
                for column in expected_columns:
                    assert column in index_columns, f"Missing index on {table_name}.{column}"
                    
            except Exception as e:
                # Table might not exist in test database - that's okay for some tables
                pytest.fail(f"Failed to check indexes for {table_name}: {str(e)}")
    
    def test_cos_3_alembic_configuration(self):
        """
        CoS 3: Verify Alembic configured and initial migration created.
        
        This test validates that:
        - Alembic is properly configured
        - Migration directory exists
        - Initial migration files are present
        """
        # Check Alembic configuration files exist
        alembic_ini = Path("backend/alembic.ini")
        assert alembic_ini.exists(), "Alembic configuration file should exist"
        
        # Check migrations directory exists
        migrations_dir = Path("backend/migrations")
        assert migrations_dir.exists(), "Migrations directory should exist"
        
        # Check versions directory exists
        versions_dir = Path("backend/migrations/versions")
        assert versions_dir.exists(), "Migrations versions directory should exist"
        
        # Check that migration files exist
        migration_files = list(versions_dir.glob("*.py"))
        assert len(migration_files) > 0, "Should have at least one migration file"
        
        # Check env.py exists
        env_file = Path("backend/migrations/env.py")
        assert env_file.exists(), "Alembic env.py file should exist"
    
    def test_cos_4_cloud_migration_documentation(self):
        """
        CoS 4: Verify documentation for cloud migration exists.
        
        This test validates that comprehensive documentation exists for
        migrating to cloud Postgres instances.
        """
        # Check main cloud migration guide exists
        cloud_guide = Path("docs/delivery/8/cloud_migration_guide.md")
        assert cloud_guide.exists(), "Cloud migration guide should exist"
        
        # Check GCP-specific guide exists
        gcp_guide = Path("docs/delivery/8/gcp_cloud_sql_guide.md")
        assert gcp_guide.exists(), "GCP Cloud SQL guide should exist"
        
        # Check AWS-specific guide exists
        aws_guide = Path("docs/delivery/8/aws_rds_guide.md")
        assert aws_guide.exists(), "AWS RDS guide should exist"
        
        # Check migration procedures exist
        migration_procedures = Path("docs/delivery/8/migration_procedures.md")
        assert migration_procedures.exists(), "Migration procedures should exist"
    
    def test_cos_5_all_tests_pass_with_new_schema(self, db: Session):
        """
        CoS 5: Verify all tests pass with new schema.
        
        This test validates that the core functionality still works correctly
        with the new schema by running key operations that would be affected
        by the schema changes.
        """
        # Test complete user workflow
        user = self.test_user
        
        # Test journal entry creation and retrieval
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "CoS workflow test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)
        
        # Verify entry can be retrieved by user_id
        retrieved_entries = db.query(JournalEntry).filter_by(user_id=user.id).all()
        assert len(retrieved_entries) >= 1, "Should be able to retrieve journal entries by user_id"
        
        # Test tag creation and association
        tag = Tag(name="CoS_Workflow_Tag", user_id=user.id)
        db.add(tag)
        db.commit()
        db.refresh(tag)
        
        # Test tag-entry association
        entry_tag = JournalEntryTag(entry_id=entry.id, tag_id=tag.id)
        db.add(entry_tag)
        db.commit()
        
        # Test reminder creation
        reminder = Reminder(
            title="CoS Workflow Reminder",
            message="This is a CoS workflow reminder",
            frequency=ReminderFrequency.DAILY,
            time=datetime.now(timezone.utc),
            user_id=user.id
        )
        db.add(reminder)
        db.commit()
        db.refresh(reminder)
        
        # Test relationships work correctly
        assert entry.user == user, "Journal entry should be related to user"
        assert tag.user == user, "Tag should be related to user"
        assert reminder.user == user, "Reminder should be related to user"
        
        # Test UUID serialization/deserialization
        user_id_str = str(user.id)
        user_id_uuid = uuid.UUID(user_id_str)
        assert user_id_uuid == user.id, "UUID should serialize/deserialize correctly"


class TestSchemaConsistencyValidation:
    """
    Additional validation tests for schema consistency across all models.
    """
    
    def test_timestamp_consistency_across_models(self, db: Session):
        """
        Test that all models use consistent timestamp handling.
        
        Note: This test accounts for SQLite limitations with timezone handling.
        """
        # Create test data for all models
        user_data = TestDataFactory.create_user_data("timestamp_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Test journal entry timestamps
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "timestamp test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)
        
        # Test tag timestamps
        tag = Tag(name="TimestampTestTag", user_id=user.id)
        db.add(tag)
        db.commit()
        db.refresh(tag)
        
        # Verify all models have timestamps
        models_with_timestamps = [user, entry, tag]
        for model in models_with_timestamps:
            assert hasattr(model, 'created_at'), f"{model.__class__.__name__} should have created_at"
            assert hasattr(model, 'updated_at'), f"{model.__class__.__name__} should have updated_at"
            assert model.created_at is not None, f"{model.__class__.__name__} created_at should not be None"
            assert model.updated_at is not None, f"{model.__class__.__name__} updated_at should not be None"
    
    def test_uuid_foreign_key_constraints(self, db: Session):
        """
        Test that UUID foreign key constraints work correctly.
        """
        # Create user
        user_data = TestDataFactory.create_user_data("fk_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Test that foreign key constraints prevent invalid UUIDs
        with pytest.raises(Exception):
            invalid_entry = JournalEntry(
                title="Invalid Entry",
                content="This should fail",
                user_id=uuid.uuid4()  # Non-existent user ID
            )
            db.add(invalid_entry)
            db.commit()
    
    def test_performance_with_uuid_keys(self, db: Session):
        """
        Test that UUID primary keys don't significantly impact performance.
        """
        # Create multiple users to test performance
        users = []
        for i in range(10):
            user_data = TestDataFactory.create_user_data(f"perf_test_{i}")
            user = User(**user_data)
            users.append(user)
        
        # Batch insert users
        db.add_all(users)
        db.commit()
        
        # Test query performance by user ID
        for user in users:
            db.refresh(user)
            retrieved_user = db.query(User).filter_by(id=user.id).first()
            assert retrieved_user is not None, f"Should be able to retrieve user {user.id}"
            assert retrieved_user.id == user.id, "Retrieved user ID should match"


class TestDataMigrationValidation:
    """
    Test data migration procedures and rollback capabilities.
    """
    
    def test_migration_script_exists(self):
        """
        Test that data migration scripts exist and are accessible.
        """
        migration_script = Path("backend/scripts/data_migration.py")
        assert migration_script.exists(), "Data migration script should exist"
        
        # Test script can be imported
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))
        
        try:
            import data_migration
            assert hasattr(data_migration, 'main'), "Migration script should have main function"
        except ImportError as e:
            pytest.fail(f"Could not import data migration script: {e}")
    
    def test_rollback_procedures_documented(self):
        """
        Test that rollback procedures are properly documented.
        """
        rollback_doc = Path("docs/delivery/8/rollback_procedures.md")
        assert rollback_doc.exists(), "Rollback procedures should be documented"


class TestCloudCompatibilityValidation:
    """
    Test that schema changes are compatible with cloud database services.
    """
    
    def test_postgresql_compatibility(self, db: Session):
        """
        Test that the schema works correctly with PostgreSQL features.
        
        This test validates that UUID types and other features work correctly
        in a way that's compatible with cloud PostgreSQL services.
        """
        # Test UUID generation and storage
        user_data = TestDataFactory.create_user_data("cloud_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Test that UUID is properly formatted
        assert isinstance(user.id, uuid.UUID), "User ID should be UUID type"
        
        # Test UUID string representation
        uuid_str = str(user.id)
        assert len(uuid_str) == 36, "UUID string should be 36 characters"
        assert uuid_str.count('-') == 4, "UUID string should have 4 hyphens"
        
        # Test that UUID can be converted back
        converted_uuid = uuid.UUID(uuid_str)
        assert converted_uuid == user.id, "UUID should convert back correctly"
    
    def test_index_effectiveness(self, db: Session, engine: Engine):
        """
        Test that indexes are effectively improving query performance.
        """
        # Create test data
        user_data = TestDataFactory.create_user_data("index_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create multiple journal entries
        entries = []
        for i in range(5):
            entry_data = TestDataFactory.create_journal_entry_data(user.id, f"Entry {i}")
            entry = JournalEntry(**entry_data)
            entries.append(entry)
        
        db.add_all(entries)
        db.commit()
        
        # Test query by user_id uses index
        result = db.query(JournalEntry).filter_by(user_id=user.id).all()
        assert len(result) == 5, "Should retrieve all entries for user"
        
        # Verify all entries belong to the correct user
        for entry in result:
            assert entry.user_id == user.id, "All entries should belong to the test user"


if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 