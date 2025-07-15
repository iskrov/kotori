"""
Integration tests for complete schema validation.

This module contains integration tests that validate the complete schema
works correctly as a whole system, testing interactions between all
components after the PBI-8 schema optimization.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any

import pytest
from sqlalchemy import text, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag, JournalEntryTag
from app.models.reminder import Reminder
from tests.test_config import TestDataFactory, TestAssertions


class TestCompleteSchemaIntegration:
    """
    Integration tests for complete schema validation.
    
    These tests validate that all components work together correctly
    after the schema optimization changes.
    """
    
    @pytest.fixture(autouse=True)
    def setup_integration_data(self, db: Session):
        """Set up integration test data."""
        self.db = db
        # Create multiple users for integration testing
        self.users = []
        for i in range(3):
            user_data = TestDataFactory.create_user_data(f"integration_user_{i}")
            user = User(**user_data)
            self.users.append(user)
        
        db.add_all(self.users)
        db.commit()
        for user in self.users:
            db.refresh(user)
    
    def test_multi_user_data_isolation(self, db: Session):
        """
        Test that data is properly isolated between users.
        """
        # Create data for each user
        user_data = {}
        for i, user in enumerate(self.users):
            # Create journal entries
            entries = []
            for j in range(2):
                entry_data = TestDataFactory.create_journal_entry_data(
                    user.id, f"User {i} Entry {j}"
                )
                entry = JournalEntry(**entry_data)
                entries.append(entry)
            
            # Create tags
            tags = []
            for j in range(2):
                tag = Tag(name=f"User_{i}_Tag_{j}", user_id=user.id)
                tags.append(tag)
            
            # Create reminders
            reminders = []
            for j in range(2):
                reminder = Reminder(
                    reminder_text=f"User {i} Reminder {j}",
                    user_id=user.id,
                    reminder_type="daily"
                )
                reminders.append(reminder)
            
            user_data[user.id] = {
                'entries': entries,
                'tags': tags,
                'reminders': reminders
            }
            
            db.add_all(entries + tags + reminders)
        
        db.commit()
        
        # Verify data isolation
        for user_id, data in user_data.items():
            # Check journal entries
            user_entries = db.query(JournalEntry).filter_by(user_id=user_id).all()
            assert len(user_entries) == 2, f"User {user_id} should have 2 entries"
            
            # Check tags
            user_tags = db.query(Tag).filter_by(user_id=user_id).all()
            assert len(user_tags) == 2, f"User {user_id} should have 2 tags"
            
            # Check reminders
            user_reminders = db.query(Reminder).filter_by(user_id=user_id).all()
            assert len(user_reminders) == 2, f"User {user_id} should have 2 reminders"
            
            # Verify no cross-contamination
            for entry in user_entries:
                assert entry.user_id == user_id, "Entry should belong to correct user"
            for tag in user_tags:
                assert tag.user_id == user_id, "Tag should belong to correct user"
            for reminder in user_reminders:
                assert reminder.user_id == user_id, "Reminder should belong to correct user"
    
    def test_complex_relationships_with_uuids(self, db: Session):
        """
        Test complex relationships work correctly with UUID foreign keys.
        """
        user = self.users[0]
        
        # Create journal entries
        entries = []
        for i in range(3):
            entry_data = TestDataFactory.create_journal_entry_data(
                user.id, f"Complex relationship entry {i}"
            )
            entry = JournalEntry(**entry_data)
            entries.append(entry)
        
        db.add_all(entries)
        db.commit()
        for entry in entries:
            db.refresh(entry)
        
        # Create tags
        tags = []
        for i in range(3):
            tag = Tag(name=f"ComplexTag_{i}", user_id=user.id)
            tags.append(tag)
        
        db.add_all(tags)
        db.commit()
        for tag in tags:
            db.refresh(tag)
        
        # Create many-to-many relationships
        entry_tags = []
        for entry in entries:
            for tag in tags:
                entry_tag = JournalEntryTag(entry_id=entry.id, tag_id=tag.id)
                entry_tags.append(entry_tag)
        
        db.add_all(entry_tags)
        db.commit()
        
        # Verify relationships
        for entry in entries:
            entry_tag_records = db.query(JournalEntryTag).filter_by(entry_id=entry.id).all()
            assert len(entry_tag_records) == 3, f"Entry {entry.id} should have 3 tags"
            
            for entry_tag in entry_tag_records:
                assert entry_tag.entry_id == entry.id, "Entry tag should reference correct entry"
                assert entry_tag.tag_id in [tag.id for tag in tags], "Entry tag should reference valid tag"
        
        # Test relationship navigation
        for entry in entries:
            db.refresh(entry)
            assert entry.user_id == user.id, "Entry should belong to correct user"
            assert entry.user == user, "Entry user relationship should work"
    
    def test_schema_performance_with_indexes(self, db: Session, engine: Engine):
        """
        Test that schema performance is good with proper indexes.
        """
        user = self.users[0]
        
        # Create a larger dataset
        entries = []
        for i in range(50):
            entry_data = TestDataFactory.create_journal_entry_data(
                user.id, f"Performance test entry {i}"
            )
            entry = JournalEntry(**entry_data)
            entries.append(entry)
        
        db.add_all(entries)
        db.commit()
        
        # Test query performance
        import time
        
        # Query by user_id (should use index)
        start_time = time.time()
        user_entries = db.query(JournalEntry).filter_by(user_id=user.id).all()
        query_time = time.time() - start_time
        
        assert len(user_entries) == 50, "Should retrieve all entries for user"
        assert query_time < 1.0, "Query should complete quickly with index"
        
        # Test UUID-based queries
        start_time = time.time()
        specific_entry = db.query(JournalEntry).filter_by(id=entries[0].id).first()
        query_time = time.time() - start_time
        
        assert specific_entry is not None, "Should find specific entry"
        assert query_time < 0.1, "Primary key query should be very fast"
    
    def test_concurrent_user_operations(self, db: Session):
        """
        Test that concurrent operations on different users work correctly.
        """
        # Simulate concurrent operations by creating data for multiple users
        all_entries = []
        all_tags = []
        all_reminders = []
        
        for user in self.users:
            # Create entries
            for i in range(5):
                entry_data = TestDataFactory.create_journal_entry_data(
                    user.id, f"Concurrent test entry {i}"
                )
                entry = JournalEntry(**entry_data)
                all_entries.append(entry)
            
            # Create tags
            for i in range(3):
                tag = Tag(name=f"ConcurrentTag_{user.id}_{i}", user_id=user.id)
                all_tags.append(tag)
            
            # Create reminders
            for i in range(2):
                reminder = Reminder(
                    reminder_text=f"Concurrent reminder {i}",
                    user_id=user.id,
                    reminder_type="daily"
                )
                all_reminders.append(reminder)
        
        # Batch insert all data
        db.add_all(all_entries + all_tags + all_reminders)
        db.commit()
        
        # Verify data integrity
        for user in self.users:
            user_entries = db.query(JournalEntry).filter_by(user_id=user.id).all()
            user_tags = db.query(Tag).filter_by(user_id=user.id).all()
            user_reminders = db.query(Reminder).filter_by(user_id=user.id).all()
            
            assert len(user_entries) == 5, f"User {user.id} should have 5 entries"
            assert len(user_tags) == 3, f"User {user.id} should have 3 tags"
            assert len(user_reminders) == 2, f"User {user.id} should have 2 reminders"
            
            # Verify UUID consistency
            for entry in user_entries:
                assert isinstance(entry.user_id, uuid.UUID), "Entry user_id should be UUID"
                assert entry.user_id == user.id, "Entry should belong to correct user"
            
            for tag in user_tags:
                assert isinstance(tag.user_id, uuid.UUID), "Tag user_id should be UUID"
                assert tag.user_id == user.id, "Tag should belong to correct user"
            
            for reminder in user_reminders:
                assert isinstance(reminder.user_id, uuid.UUID), "Reminder user_id should be UUID"
                assert reminder.user_id == user.id, "Reminder should belong to correct user"
    
    def test_schema_constraints_enforcement(self, db: Session):
        """
        Test that schema constraints are properly enforced.
        """
        user = self.users[0]
        
        # Test NOT NULL constraints
        with pytest.raises(Exception):
            # This should fail because user_id is required
            invalid_tag = Tag(name="InvalidTag")
            db.add(invalid_tag)
            db.commit()
        
        # Test unique constraints
        tag1 = Tag(name="UniqueTestTag", user_id=user.id)
        db.add(tag1)
        db.commit()
        
        # This should fail because tag name should be unique
        with pytest.raises(Exception):
            tag2 = Tag(name="UniqueTestTag", user_id=user.id)
            db.add(tag2)
            db.commit()
        
        db.rollback()  # Clean up failed transaction
        
        # Test foreign key constraints
        with pytest.raises(Exception):
            # This should fail because user_id references non-existent user
            invalid_entry = JournalEntry(
                title="Invalid Entry",
                content="This should fail",
                user_id=uuid.uuid4()  # Non-existent user
            )
            db.add(invalid_entry)
            db.commit()
        
        db.rollback()  # Clean up failed transaction
    
    def test_complete_crud_operations(self, db: Session):
        """
        Test complete CRUD operations work correctly with new schema.
        """
        user = self.users[0]
        
        # CREATE operations
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "CRUD test entry")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)
        
        tag = Tag(name="CRUDTestTag", user_id=user.id)
        db.add(tag)
        db.commit()
        db.refresh(tag)
        
        reminder = Reminder(
            reminder_text="CRUD test reminder",
            user_id=user.id,
            reminder_type="daily"
        )
        db.add(reminder)
        db.commit()
        db.refresh(reminder)
        
        # READ operations
        retrieved_entry = db.query(JournalEntry).filter_by(id=entry.id).first()
        assert retrieved_entry is not None, "Should be able to read entry"
        assert retrieved_entry.user_id == user.id, "Entry should belong to correct user"
        
        retrieved_tag = db.query(Tag).filter_by(id=tag.id).first()
        assert retrieved_tag is not None, "Should be able to read tag"
        assert retrieved_tag.user_id == user.id, "Tag should belong to correct user"
        
        retrieved_reminder = db.query(Reminder).filter_by(id=reminder.id).first()
        assert retrieved_reminder is not None, "Should be able to read reminder"
        assert retrieved_reminder.user_id == user.id, "Reminder should belong to correct user"
        
        # UPDATE operations
        entry.title = "Updated CRUD test entry"
        tag.name = "UpdatedCRUDTestTag"
        reminder.reminder_text = "Updated CRUD test reminder"
        db.commit()
        
        # Verify updates
        db.refresh(entry)
        db.refresh(tag)
        db.refresh(reminder)
        
        assert entry.title == "Updated CRUD test entry", "Entry should be updated"
        assert tag.name == "UpdatedCRUDTestTag", "Tag should be updated"
        assert reminder.reminder_text == "Updated CRUD test reminder", "Reminder should be updated"
        
        # DELETE operations
        entry_id = entry.id
        tag_id = tag.id
        reminder_id = reminder.id
        
        db.delete(entry)
        db.delete(tag)
        db.delete(reminder)
        db.commit()
        
        # Verify deletions
        assert db.query(JournalEntry).filter_by(id=entry_id).first() is None, "Entry should be deleted"
        assert db.query(Tag).filter_by(id=tag_id).first() is None, "Tag should be deleted"
        assert db.query(Reminder).filter_by(id=reminder_id).first() is None, "Reminder should be deleted"


class TestSchemaValidationHelpers:
    """
    Test helper methods for schema validation.
    """
    
    def test_uuid_validation_helpers(self, db: Session):
        """Test UUID validation helper methods."""
        from tests.test_config import SchemaValidationHelpers
        
        # Test valid UUID
        valid_uuid = uuid.uuid4()
        assert SchemaValidationHelpers.is_valid_uuid(valid_uuid), "Should validate UUID object"
        assert SchemaValidationHelpers.is_valid_uuid(str(valid_uuid)), "Should validate UUID string"
        
        # Test invalid UUID
        assert not SchemaValidationHelpers.is_valid_uuid("invalid-uuid"), "Should reject invalid UUID"
        assert not SchemaValidationHelpers.is_valid_uuid(123), "Should reject non-string/UUID"
    
    def test_schema_inspection_helpers(self, db: Session, engine: Engine):
        """Test schema inspection helper methods."""
        from tests.test_config import SchemaValidationHelpers
        
        # Test table exists
        assert SchemaValidationHelpers.table_exists(engine, "users"), "Users table should exist"
        assert SchemaValidationHelpers.table_exists(engine, "journal_entries"), "Journal entries table should exist"
        assert not SchemaValidationHelpers.table_exists(engine, "nonexistent_table"), "Should detect non-existent table"
        
        # Test column exists
        assert SchemaValidationHelpers.column_exists(engine, "users", "id"), "Users.id column should exist"
        assert SchemaValidationHelpers.column_exists(engine, "journal_entries", "user_id"), "Journal entries.user_id should exist"
        assert not SchemaValidationHelpers.column_exists(engine, "users", "nonexistent_column"), "Should detect non-existent column"


if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 