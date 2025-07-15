"""
Business Logic Constraint Tests for UUID-based Database Schema

This module tests business logic constraints and validation rules
with UUID primary keys and relationships.
"""

import pytest
import uuid
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import text

from .schema_validation_utils import (
    SchemaValidationTester,
    ConstraintTestDataGenerator,
    ConstraintViolationError
)


class TestUUIDBusinessLogic:
    """Test suite for UUID-based business logic constraints."""
    
    @pytest.fixture(scope="class")
    def schema_tester(self):
        """Create schema validation tester."""
        return SchemaValidationTester()
    
    def test_user_email_uniqueness_business_logic(self, schema_tester):
        """Test business logic for user email uniqueness."""
        # Create first user
        user1_data = ConstraintTestDataGenerator.generate_valid_user("business@example.com")
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user1_data)
        
        # Attempt to create second user with same email (case insensitive)
        user2_data = ConstraintTestDataGenerator.generate_valid_user("BUSINESS@EXAMPLE.COM")
        
        with schema_tester.expect_constraint_violation(
            expected_constraint="users_email_key",
            expected_error_type="UniqueViolation"
        ) as violation:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user2_data)
        
        assert violation.error_type == "UniqueViolation"
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user1_data["id"]])
    
    def test_journal_ownership_validation(self, schema_tester):
        """Test that journal entries are properly associated with users."""
        # Create two users
        user1_data = ConstraintTestDataGenerator.generate_valid_user("owner1@example.com")
        user2_data = ConstraintTestDataGenerator.generate_valid_user("owner2@example.com")
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user1_data)
            
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user2_data)
        
        # Create journal for user1
        journal_data = ConstraintTestDataGenerator.generate_valid_journal(user1_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
            """), journal_data)
        
        # Verify journal ownership
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT j.id, j.user_id, u.email
                FROM journal_entries j
                JOIN users u ON j.user_id = u.id
                WHERE j.id = :journal_id
            """), {"journal_id": journal_data["id"]}).fetchone()
            
            assert result is not None
            assert result[0] == journal_data["id"]
            assert result[1] == user1_data["id"]
            assert result[2] == user1_data["email"]
        
        # Verify journal cannot be accessed by wrong user
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT j.id
                FROM journal_entries j
                WHERE j.id = :journal_id AND j.user_id = :wrong_user_id
            """), {"journal_id": journal_data["id"], "wrong_user_id": user2_data["id"]}).fetchone()
            
            assert result is None
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", [journal_data["id"]])
        schema_tester.cleanup_test_data("users", [user1_data["id"], user2_data["id"]])
    
    def test_tag_journal_relationship_validation(self, schema_tester):
        """Test that tags are properly associated with journal entries."""
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
        
        # Create tag for journal
        tag_data = ConstraintTestDataGenerator.generate_valid_tag(journal_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                VALUES (:id, :journal_id, :name, :created_at, :updated_at)
            """), tag_data)
        
        # Verify tag-journal relationship
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT t.id, t.journal_id, j.title, j.user_id
                FROM tags t
                JOIN journal_entries j ON t.journal_id = j.id
                WHERE t.id = :tag_id
            """), {"tag_id": tag_data["id"]}).fetchone()
            
            assert result is not None
            assert result[0] == tag_data["id"]
            assert result[1] == journal_data["id"]
            assert result[2] == journal_data["title"]
            assert result[3] == user_data["id"]
        
        # Cleanup
        schema_tester.cleanup_test_data("tags", [tag_data["id"]])
        schema_tester.cleanup_test_data("journal_entries", [journal_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_reminder_user_relationship_validation(self, schema_tester):
        """Test that reminders are properly associated with users."""
        # Create user
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create reminder for user
        reminder_data = ConstraintTestDataGenerator.generate_valid_reminder(user_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
            """), reminder_data)
        
        # Verify reminder-user relationship
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT r.id, r.user_id, u.email, r.title, r.is_completed
                FROM reminders r
                JOIN users u ON r.user_id = u.id
                WHERE r.id = :reminder_id
            """), {"reminder_id": reminder_data["id"]}).fetchone()
            
            assert result is not None
            assert result[0] == reminder_data["id"]
            assert result[1] == user_data["id"]
            assert result[2] == user_data["email"]
            assert result[3] == reminder_data["title"]
            assert result[4] == reminder_data["is_completed"]
        
        # Cleanup
        schema_tester.cleanup_test_data("reminders", [reminder_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_secret_tag_access_validation(self, schema_tester):
        """Test that secret tags are properly associated with journal entries."""
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
        
        # Create secret tag for journal
        secret_tag_data = ConstraintTestDataGenerator.generate_valid_secret_tag(journal_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO secret_tags (id, journal_id, name, created_at, updated_at)
                VALUES (:id, :journal_id, :name, :created_at, :updated_at)
            """), secret_tag_data)
        
        # Verify secret tag access through journal ownership
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT st.id, st.journal_id, j.title, j.user_id, u.email
                FROM secret_tags st
                JOIN journal_entries j ON st.journal_id = j.id
                JOIN users u ON j.user_id = u.id
                WHERE st.id = :secret_tag_id
            """), {"secret_tag_id": secret_tag_data["id"]}).fetchone()
            
            assert result is not None
            assert result[0] == secret_tag_data["id"]
            assert result[1] == journal_data["id"]
            assert result[2] == journal_data["title"]
            assert result[3] == user_data["id"]
            assert result[4] == user_data["email"]
        
        # Cleanup
        schema_tester.cleanup_test_data("secret_tags", [secret_tag_data["id"]])
        schema_tester.cleanup_test_data("journal_entries", [journal_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_timestamp_constraints_validation(self, schema_tester):
        """Test that timestamp constraints are properly enforced."""
        # Create user with specific timestamps
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        created_time = datetime.now(timezone.utc)
        updated_time = created_time + timedelta(minutes=5)
        
        user_data["created_at"] = created_time
        user_data["updated_at"] = updated_time
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Verify timestamps are stored correctly
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT created_at, updated_at
                FROM users
                WHERE id = :user_id
            """), {"user_id": user_data["id"]}).fetchone()
            
            assert result is not None
            stored_created = result[0]
            stored_updated = result[1]
            
            # Verify timestamps (allowing for small precision differences)
            assert abs((stored_created - created_time).total_seconds()) < 1
            assert abs((stored_updated - updated_time).total_seconds()) < 1
            assert stored_updated >= stored_created
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_user_active_status_validation(self, schema_tester):
        """Test that user active status is properly validated."""
        # Create active user
        active_user_data = ConstraintTestDataGenerator.generate_valid_user()
        active_user_data["is_active"] = True
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), active_user_data)
        
        # Create inactive user
        inactive_user_data = ConstraintTestDataGenerator.generate_valid_user()
        inactive_user_data["is_active"] = False
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), inactive_user_data)
        
        # Verify active status is stored correctly
        with schema_tester.get_session() as session:
            active_result = session.execute(text("""
                SELECT is_active FROM users WHERE id = :user_id
            """), {"user_id": active_user_data["id"]}).fetchone()
            
            inactive_result = session.execute(text("""
                SELECT is_active FROM users WHERE id = :user_id
            """), {"user_id": inactive_user_data["id"]}).fetchone()
            
            assert active_result[0] is True
            assert inactive_result[0] is False
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [active_user_data["id"], inactive_user_data["id"]])
    
    def test_reminder_completion_status_validation(self, schema_tester):
        """Test that reminder completion status is properly validated."""
        # Create user
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create incomplete reminder
        incomplete_reminder_data = ConstraintTestDataGenerator.generate_valid_reminder(user_data["id"])
        incomplete_reminder_data["is_completed"] = False
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
            """), incomplete_reminder_data)
        
        # Create completed reminder
        completed_reminder_data = ConstraintTestDataGenerator.generate_valid_reminder(user_data["id"])
        completed_reminder_data["is_completed"] = True
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
            """), completed_reminder_data)
        
        # Verify completion status is stored correctly
        with schema_tester.get_session() as session:
            incomplete_result = session.execute(text("""
                SELECT is_completed FROM reminders WHERE id = :reminder_id
            """), {"reminder_id": incomplete_reminder_data["id"]}).fetchone()
            
            completed_result = session.execute(text("""
                SELECT is_completed FROM reminders WHERE id = :reminder_id
            """), {"reminder_id": completed_reminder_data["id"]}).fetchone()
            
            assert incomplete_result[0] is False
            assert completed_result[0] is True
        
        # Cleanup
        schema_tester.cleanup_test_data("reminders", [incomplete_reminder_data["id"], completed_reminder_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_data_integrity_across_relationships(self, schema_tester):
        """Test data integrity across all relationship types."""
        # Create comprehensive test data
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create multiple journals
        journal_data_list = []
        for i in range(3):
            journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
            journal_data_list.append(journal_data)
            
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        # Create tags and secret tags for each journal
        tag_data_list = []
        secret_tag_data_list = []
        
        for journal_data in journal_data_list:
            for i in range(2):
                tag_data = ConstraintTestDataGenerator.generate_valid_tag(journal_data["id"])
                tag_data_list.append(tag_data)
                
                with schema_tester.get_session() as session:
                    session.execute(text("""
                        INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                        VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                    """), tag_data)
                
                secret_tag_data = ConstraintTestDataGenerator.generate_valid_secret_tag(journal_data["id"])
                secret_tag_data_list.append(secret_tag_data)
                
                with schema_tester.get_session() as session:
                    session.execute(text("""
                        INSERT INTO secret_tags (id, journal_id, name, created_at, updated_at)
                        VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                    """), secret_tag_data)
        
        # Create reminders for user
        reminder_data_list = []
        for i in range(2):
            reminder_data = ConstraintTestDataGenerator.generate_valid_reminder(user_data["id"])
            reminder_data_list.append(reminder_data)
            
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
                """), reminder_data)
        
        # Verify complete data integrity
        with schema_tester.get_session() as session:
            result = session.execute(text("""
                SELECT 
                    u.id as user_id,
                    u.email,
                    COUNT(DISTINCT j.id) as journal_count,
                    COUNT(DISTINCT t.id) as tag_count,
                    COUNT(DISTINCT st.id) as secret_tag_count,
                    COUNT(DISTINCT r.id) as reminder_count
                FROM users u
                LEFT JOIN journal_entries j ON u.id = j.user_id
                LEFT JOIN tags t ON j.id = t.journal_id
                LEFT JOIN secret_tags st ON j.id = st.journal_id
                LEFT JOIN reminders r ON u.id = r.user_id
                WHERE u.id = :user_id
                GROUP BY u.id, u.email
            """), {"user_id": user_data["id"]}).fetchone()
            
            assert result is not None
            assert result[0] == user_data["id"]
            assert result[1] == user_data["email"]
            assert result[2] == 3  # 3 journals
            assert result[3] == 6  # 6 tags (2 per journal)
            assert result[4] == 6  # 6 secret tags (2 per journal)
            assert result[5] == 2  # 2 reminders
        
        # Cleanup
        schema_tester.cleanup_test_data("reminders", [r["id"] for r in reminder_data_list])
        schema_tester.cleanup_test_data("secret_tags", [st["id"] for st in secret_tag_data_list])
        schema_tester.cleanup_test_data("tags", [t["id"] for t in tag_data_list])
        schema_tester.cleanup_test_data("journal_entries", [j["id"] for j in journal_data_list])
        schema_tester.cleanup_test_data("users", [user_data["id"]])
    
    def test_business_logic_constraint_performance(self, schema_tester):
        """Test that business logic constraints don't significantly impact performance."""
        import time
        
        # Create many users to test constraint performance
        user_data_list = []
        for i in range(100):
            user_data = ConstraintTestDataGenerator.generate_valid_user(f"perf_test_{i}@example.com")
            user_data_list.append(user_data)
        
        # Time the creation process
        start_time = time.time()
        
        for user_data in user_data_list:
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user_data)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Should be able to create 100 users with constraints in reasonable time
        assert duration < 3.0, f"Business logic constraints too slow: {duration:.2f}s for 100 users"
        
        # Cleanup
        schema_tester.cleanup_test_data("users", [u["id"] for u in user_data_list])


if __name__ == "__main__":
    # Run business logic tests standalone
    pytest.main([__file__, "-v", "-s"]) 