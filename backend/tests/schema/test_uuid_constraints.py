"""
Comprehensive Constraint Tests for UUID-based Database Schema

This module tests all database constraints including primary key uniqueness,
unique constraints, NOT NULL constraints, and data type validation.
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


class TestUUIDConstraints:
    """Test suite for UUID-based database constraints."""
    
    @pytest.fixture(scope="class")
    def schema_tester(self):
        """Create schema validation tester."""
        return SchemaValidationTester()
    
    def test_primary_key_uniqueness_users(self, schema_tester):
        """Test that user primary keys enforce uniqueness."""
        # Create first user
        user1_data = ConstraintTestDataGenerator.generate_valid_user("user1@example.com")
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user1_data)
        
        # Attempt to create second user with same UUID
        user2_data = ConstraintTestDataGenerator.generate_valid_user("user2@example.com")
        user2_data["id"] = user1_data["id"]  # Same UUID
        
        with schema_tester.expect_constraint_violation(
            expected_constraint="users_pkey",
            expected_error_type="UniqueViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user2_data)
        
        # Verify the constraint violation details
        assert violation.error_type == "UniqueViolation"
        assert "users_pkey" in violation.constraint_name
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user1_data["id"]])
    
    def test_primary_key_uniqueness_journals(self, schema_tester):
        """Test that journal entry primary keys enforce uniqueness."""
        # Create test user first
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create first journal
        journal1_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
            """), journal1_data)
        
        # Attempt to create second journal with same UUID
        journal2_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        journal2_data["id"] = journal1_data["id"]  # Same UUID
        
        with schema_tester.expect_constraint_violation(
            expected_constraint="journal_entries_pkey",
            expected_error_type="UniqueViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal2_data)
        
        # Verify the constraint violation details
        assert violation.error_type == "UniqueViolation"
        assert "journal_entries_pkey" in violation.constraint_name
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", [journal1_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_unique_constraint_user_email(self, schema_tester):
        """Test that user email unique constraint is enforced."""
        # Create first user
        user1_data = ConstraintTestDataGenerator.generate_valid_user("duplicate@example.com")
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user1_data)
        
        # Attempt to create second user with same email
        user2_data = ConstraintTestDataGenerator.generate_valid_user("duplicate@example.com")
        
        with schema_tester.expect_constraint_violation(
            expected_constraint="users_email_key",
            expected_error_type="UniqueViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user2_data)
        
        # Verify the constraint violation details
        assert violation.error_type == "UniqueViolation"
        assert "users_email_key" in violation.constraint_name
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user1_data["id"]])
    
    def test_not_null_constraint_user_email(self, schema_tester):
        """Test that user email NOT NULL constraint is enforced."""
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        user_data["email"] = None  # NULL email
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="NotNullViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user_data)
        
        # Verify the constraint violation details
        assert violation.error_type == "NotNullViolation"
        assert "not_null_constraint" in violation.constraint_name
    
    def test_not_null_constraint_user_first_name(self, schema_tester):
        """Test that user first_name NOT NULL constraint is enforced."""
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        user_data["first_name"] = None  # NULL first_name
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="NotNullViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user_data)
        
        assert violation.error_type == "NotNullViolation"
    
    def test_not_null_constraint_journal_title(self, schema_tester):
        """Test that journal title NOT NULL constraint is enforced."""
        # Create test user first
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Attempt to create journal with NULL title
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        journal_data["title"] = None  # NULL title
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="NotNullViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        assert violation.error_type == "NotNullViolation"
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_not_null_constraint_tag_name(self, schema_tester):
        """Test that tag name NOT NULL constraint is enforced."""
        # Create test user and journal first
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
        
        # Attempt to create tag with NULL name
        tag_data = ConstraintTestDataGenerator.generate_valid_tag(journal_data["id"])
        tag_data["name"] = None  # NULL name
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="NotNullViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                    VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                """), tag_data)
        
        assert violation.error_type == "NotNullViolation"
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", [journal_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_not_null_constraint_reminder_title(self, schema_tester):
        """Test that reminder title NOT NULL constraint is enforced."""
        # Create test user first
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Attempt to create reminder with NULL title
        reminder_data = ConstraintTestDataGenerator.generate_valid_reminder(user_data["id"])
        reminder_data["title"] = None  # NULL title
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="NotNullViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
                """), reminder_data)
        
        assert violation.error_type == "NotNullViolation"
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_uuid_data_type_validation_users(self, schema_tester):
        """Test that invalid UUID values are rejected for user IDs."""
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        # Test with invalid UUID string
        with schema_tester.expect_constraint_violation(
            expected_error_type="DataError"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), {
                    **user_data,
                    "id": "not-a-valid-uuid"
                })
        
        assert violation.error_type == "DataError"
    
    def test_uuid_data_type_validation_foreign_keys(self, schema_tester):
        """Test that invalid UUID values are rejected for foreign keys."""
        # Create test user first
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Test with invalid UUID string for foreign key
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
    
    def test_boolean_data_type_validation(self, schema_tester):
        """Test that invalid boolean values are handled correctly."""
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        # Test with invalid boolean value
        with schema_tester.expect_constraint_violation(
            expected_error_type="DataError"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), {
                    **user_data,
                    "is_active": "not-a-boolean"
                })
        
        assert violation.error_type == "DataError"
    
    def test_timestamp_data_type_validation(self, schema_tester):
        """Test that invalid timestamp values are rejected."""
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        # Test with invalid timestamp
        with schema_tester.expect_constraint_violation(
            expected_error_type="DataError"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), {
                    **user_data,
                    "created_at": "not-a-timestamp"
                })
        
        assert violation.error_type == "DataError"
    
    def test_constraint_violation_error_messages(self, schema_tester):
        """Test that constraint violation error messages are informative."""
        # Test unique constraint violation message
        user1_data = ConstraintTestDataGenerator.generate_valid_user("test@example.com")
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user1_data)
        
        user2_data = ConstraintTestDataGenerator.generate_valid_user("test@example.com")
        
        with schema_tester.expect_constraint_violation() as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user2_data)
        
        # Verify error message contains useful information
        assert "duplicate key value" in violation.message.lower()
        assert "users_email_key" in violation.constraint_name
        assert violation.error_code == "23505"  # PostgreSQL unique violation code
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user1_data["id"]])
    
    def test_multiple_constraint_violations(self, schema_tester):
        """Test handling of multiple potential constraint violations."""
        # Create user with multiple constraint violations
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        user_data["email"] = None  # NOT NULL violation
        user_data["first_name"] = None  # NOT NULL violation
        
        # Should get the first constraint violation encountered
        with schema_tester.expect_constraint_violation(
            expected_error_type="NotNullViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user_data)
        
        assert violation.error_type == "NotNullViolation"
    
    def test_constraint_validation_with_null_uuids(self, schema_tester):
        """Test that NULL UUID values are properly handled."""
        # Create user first
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Attempt to create journal with NULL UUID
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        journal_data["id"] = None  # NULL UUID
        
        with schema_tester.expect_constraint_violation(
            expected_error_type="NotNullViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        assert violation.error_type == "NotNullViolation"
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user_data["id"]])


if __name__ == "__main__":
    # Run constraint tests standalone
    pytest.main([__file__, "-v", "-s"]) 