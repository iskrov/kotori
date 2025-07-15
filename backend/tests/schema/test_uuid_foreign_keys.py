"""
Foreign Key Constraint Tests for UUID-based Database Schema

This module tests foreign key constraints and referential integrity
with UUID primary and foreign keys.
"""

import pytest
import uuid
from typing import Dict, Any
from sqlalchemy import text

from .schema_validation_utils import (
    SchemaValidationTester,
    ConstraintTestDataGenerator,
    ConstraintViolationError
)


class TestUUIDForeignKeys:
    """Test suite for UUID-based foreign key constraints."""
    
    @pytest.fixture(scope="class")
    def schema_tester(self):
        """Create schema validation tester."""
        return SchemaValidationTester()
    
    def test_foreign_key_constraint_journal_user(self, schema_tester):
        """Test foreign key constraint between journal entries and users."""
        # Attempt to create journal with non-existent user
        non_existent_user_id = uuid.uuid4()
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(non_existent_user_id)
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="ForeignKeyViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        assert violation.error_type == "ForeignKeyViolation"
        assert "23503" == violation.error_code  # PostgreSQL foreign key violation
    
    def test_foreign_key_constraint_tag_journal(self, schema_tester):
        """Test foreign key constraint between tags and journal entries."""
        # Attempt to create tag with non-existent journal
        non_existent_journal_id = uuid.uuid4()
        tag_data = ConstraintTestDataGenerator.generate_valid_tag(non_existent_journal_id)
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="ForeignKeyViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                    VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                """), tag_data)
        
        assert violation.error_type == "ForeignKeyViolation"
        assert "23503" == violation.error_code
    
    def test_foreign_key_constraint_reminder_user(self, schema_tester):
        """Test foreign key constraint between reminders and users."""
        # Attempt to create reminder with non-existent user
        non_existent_user_id = uuid.uuid4()
        reminder_data = ConstraintTestDataGenerator.generate_valid_reminder(non_existent_user_id)
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="ForeignKeyViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
                """), reminder_data)
        
        assert violation.error_type == "ForeignKeyViolation"
        assert "23503" == violation.error_code
    
    def test_foreign_key_constraint_secret_tag_journal(self, schema_tester):
        """Test foreign key constraint between secret tags and journal entries."""
        # Attempt to create secret tag with non-existent journal
        non_existent_journal_id = uuid.uuid4()
        secret_tag_data = ConstraintTestDataGenerator.generate_valid_secret_tag(non_existent_journal_id)
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="ForeignKeyViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO secret_tags (id, journal_id, name, created_at, updated_at)
                    VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                """), secret_tag_data)
        
        assert violation.error_type == "ForeignKeyViolation"
        assert "23503" == violation.error_code
    
    def test_foreign_key_null_values(self, schema_tester):
        """Test that NULL foreign key values are handled correctly."""
        # Create journal with NULL user_id
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(uuid.uuid4())
        journal_data["user_id"] = None  # NULL foreign key
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="NotNullViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        assert violation.error_type == "NotNullViolation"
    
    def test_foreign_key_referential_integrity(self, schema_tester):
        """Test that foreign key relationships maintain referential integrity."""
        # Create valid user
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create valid journal entry
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
            """), journal_data)
        
        # Verify the relationship exists
        assert schema_tester.verify_record_exists("users", user_data["id"])
        assert schema_tester.verify_record_exists("journal_entries", journal_data["id"])
        
        # Verify foreign key relationship
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT j.id, j.user_id, u.email 
                FROM journal_entries j 
                JOIN users u ON j.user_id = u.id 
                WHERE j.id = :journal_id
            """), {"journal_id": journal_data["id"]}).fetchone()
            
            assert result is not None
            assert result[0] == journal_data["id"]
            assert result[1] == user_data["id"]
            assert result[2] == user_data["email"]
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", [journal_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_foreign_key_update_cascade(self, schema_tester):
        """Test foreign key behavior during parent record updates."""
        # Create user and journal
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
            """), journal_data)
        
        # Update user (non-key fields should work)
        with schema_tester.get_session() as session:
            session.execute(text("""
                UPDATE users 
                SET first_name = :new_name 
                WHERE id = :user_id
            """), {"new_name": "Updated Name", "user_id": user_data["id"]})
        
        # Verify update worked and foreign key relationship is intact
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT u.first_name, j.title 
                FROM users u 
                JOIN journal_entries j ON u.id = j.user_id 
                WHERE u.id = :user_id
            """), {"user_id": user_data["id"]}).fetchone()
            
            assert result is not None
            assert result[0] == "Updated Name"
            assert result[1] == journal_data["title"]
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", [journal_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_foreign_key_multiple_relationships(self, schema_tester):
        """Test foreign key constraints with multiple relationships."""
        # Create user
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create journal
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
            """), journal_data)
        
        # Create tag and secret tag for the journal
        tag_data = ConstraintTestDataGenerator.generate_valid_tag(journal_data["id"])
        secret_tag_data = ConstraintTestDataGenerator.generate_valid_secret_tag(journal_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                VALUES (:id, :journal_id, :name, :created_at, :updated_at)
            """), tag_data)
            
            session.execute(text("""
                INSERT INTO secret_tags (id, journal_id, name, created_at, updated_at)
                VALUES (:id, :journal_id, :name, :created_at, :updated_at)
            """), secret_tag_data)
        
        # Create reminder for the user
        reminder_data = ConstraintTestDataGenerator.generate_valid_reminder(user_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
            """), reminder_data)
        
        # Verify all relationships exist
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT 
                    u.email,
                    j.title,
                    t.name as tag_name,
                    st.name as secret_tag_name,
                    r.title as reminder_title
                FROM users u
                JOIN journal_entries j ON u.id = j.user_id
                JOIN tags t ON j.id = t.journal_id
                JOIN secret_tags st ON j.id = st.journal_id
                JOIN reminders r ON u.id = r.user_id
                WHERE u.id = :user_id
            """), {"user_id": user_data["id"]}).fetchone()
            
            assert result is not None
            assert result[0] == user_data["email"]
            assert result[1] == journal_data["title"]
            assert result[2] == tag_data["name"]
            assert result[3] == secret_tag_data["name"]
            assert result[4] == reminder_data["title"]
        
        # Cleanup
        schema_tester.cleanup_test_data("reminders", [reminder_data["id"]])
        schema_tester.cleanup_test_data("secret_tags", [secret_tag_data["id"]])
        schema_tester.cleanup_test_data("tags", [tag_data["id"]])
        schema_tester.cleanup_test_data("journal_entries", [journal_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_foreign_key_constraint_error_messages(self, schema_tester):
        """Test that foreign key constraint error messages are informative."""
        non_existent_user_id = uuid.uuid4()
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(non_existent_user_id)
        
        with schema_tester.expect_constraint_violation() as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        # Verify error message contains useful information
        assert "foreign key constraint" in violation.message.lower()
        assert violation.error_code == "23503"  # PostgreSQL foreign key violation
        assert str(non_existent_user_id) in violation.message
    
    def test_foreign_key_constraint_with_uuid_validation(self, schema_tester):
        """Test foreign key constraints with UUID validation."""
        # Create user first
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Test with invalid UUID format for foreign key
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="DataError"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), {
                    **journal_data,
                    "user_id": "not-a-valid-uuid"
                })
        
        assert violation.error_type == "DataError"
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_foreign_key_constraint_performance(self, schema_tester):
        """Test that foreign key constraint validation performs well."""
        # Create user
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create multiple journal entries to test foreign key lookup performance
        journal_ids = []
        
        import time
        start_time = time.time()
        
        for i in range(100):
            journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
            journal_ids.append(journal_data["id"])
            
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Should be able to create 100 records with foreign key validation in reasonable time
        assert duration < 5.0, f"Foreign key validation too slow: {duration:.2f}s for 100 records"
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", journal_ids)
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_foreign_key_constraint_with_concurrent_access(self, schema_tester):
        """Test foreign key constraints under concurrent access."""
        import threading
        import time
        
        # Create user
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Function to create journal entries concurrently
        journal_ids = []
        errors = []
        
        def create_journal():
            try:
                journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
                journal_ids.append(journal_data["id"])
                
                with schema_tester.get_session() as session:
                    session.execute(text("""
                        INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                        VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                    """), journal_data)
            except Exception as e:
                errors.append(e)
        
        # Create journals concurrently
        threads = []
        for i in range(10):
            thread = threading.Thread(target=create_journal)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Verify no errors occurred
        assert len(errors) == 0, f"Concurrent foreign key validation failed: {errors}"
        assert len(journal_ids) == 10, f"Expected 10 journals, got {len(journal_ids)}"
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", journal_ids)
        schema_tester.cleanup_test_data("users", [user_data["id"]])


if __name__ == "__main__":
    # Run foreign key tests standalone
    pytest.main([__file__, "-v", "-s"]) 