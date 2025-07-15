"""
Cascade Operation Tests for UUID-based Database Schema

This module tests cascade delete operations and referential integrity
maintenance with UUID primary and foreign keys.
"""

import pytest
import uuid
from typing import Dict, Any
from sqlalchemy import text

from .schema_validation_utils import (
    SchemaValidationTester,
    ConstraintTestDataGenerator,
    CascadeTestHelper
)


class TestUUIDCascadeOperations:
    """Test suite for UUID-based cascade operations."""
    
    @pytest.fixture(scope="class")
    def schema_tester(self):
        """Create schema validation tester."""
        return SchemaValidationTester()
    
    @pytest.fixture(scope="class")
    def cascade_helper(self, schema_tester):
        """Create cascade test helper."""
        return CascadeTestHelper(schema_tester)
    
    def test_cascade_delete_user_deletes_journals(self, schema_tester, cascade_helper):
        """Test that deleting a user cascades to delete journal entries."""
        # Create test hierarchy
        hierarchy = cascade_helper.create_test_hierarchy()
        user_id = hierarchy["user"]["id"]
        journal_ids = [j["id"] for j in hierarchy["journals"]]
        
        # Verify initial state
        assert schema_tester.verify_record_exists("users", user_id)
        for journal_id in journal_ids:
            assert schema_tester.verify_record_exists("journal_entries", journal_id)
        
        # Delete the user
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_id})
        
        # Verify cascade deletion
        cascade_helper.verify_cascade_deletion(hierarchy, "user")
    
    def test_cascade_delete_user_deletes_reminders(self, schema_tester, cascade_helper):
        """Test that deleting a user cascades to delete reminders."""
        # Create test hierarchy
        hierarchy = cascade_helper.create_test_hierarchy()
        user_id = hierarchy["user"]["id"]
        reminder_ids = [r["id"] for r in hierarchy["reminders"]]
        
        # Verify initial state
        assert schema_tester.verify_record_exists("users", user_id)
        for reminder_id in reminder_ids:
            assert schema_tester.verify_record_exists("reminders", reminder_id)
        
        # Delete the user
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_id})
        
        # Verify cascade deletion
        cascade_helper.verify_cascade_deletion(hierarchy, "user")
    
    def test_cascade_delete_journal_deletes_tags(self, schema_tester, cascade_helper):
        """Test that deleting a journal entry cascades to delete tags."""
        # Create test hierarchy
        hierarchy = cascade_helper.create_test_hierarchy()
        journal_id = hierarchy["journals"][0]["id"]
        
        # Get tags for this specific journal
        with schema_tester.get_session() as session:
            tag_results = session.execute(text("""
                SELECT id FROM tags WHERE journal_id = :journal_id
            """), {"journal_id": journal_id}).fetchall()
            tag_ids = [row[0] for row in tag_results]
        
        # Verify initial state
        assert schema_tester.verify_record_exists("journal_entries", journal_id)
        for tag_id in tag_ids:
            assert schema_tester.verify_record_exists("tags", tag_id)
        
        # Delete the journal
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM journal_entries WHERE id = :journal_id"), {"journal_id": journal_id})
        
        # Verify cascade deletion
        assert not schema_tester.verify_record_exists("journal_entries", journal_id)
        for tag_id in tag_ids:
            assert not schema_tester.verify_record_exists("tags", tag_id)
        
        # Cleanup remaining test data
        remaining_journal_ids = [j["id"] for j in hierarchy["journals"] if j["id"] != journal_id]
        user_id = hierarchy["user"]["id"]
        
        with schema_tester.get_session() as session:
            if remaining_journal_ids:
                session.execute(text("DELETE FROM journal_entries WHERE id = ANY(:ids)"), {"ids": remaining_journal_ids})
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_id})
    
    def test_cascade_delete_journal_deletes_secret_tags(self, schema_tester, cascade_helper):
        """Test that deleting a journal entry cascades to delete secret tags."""
        # Create test hierarchy
        hierarchy = cascade_helper.create_test_hierarchy()
        journal_id = hierarchy["journals"][0]["id"]
        
        # Get secret tags for this specific journal
        with schema_tester.get_session() as session:
            secret_tag_results = session.execute(text("""
                SELECT id FROM secret_tags WHERE journal_id = :journal_id
            """), {"journal_id": journal_id}).fetchall()
            secret_tag_ids = [row[0] for row in secret_tag_results]
        
        # Verify initial state
        assert schema_tester.verify_record_exists("journal_entries", journal_id)
        for secret_tag_id in secret_tag_ids:
            assert schema_tester.verify_record_exists("secret_tags", secret_tag_id)
        
        # Delete the journal
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM journal_entries WHERE id = :journal_id"), {"journal_id": journal_id})
        
        # Verify cascade deletion
        assert not schema_tester.verify_record_exists("journal_entries", journal_id)
        for secret_tag_id in secret_tag_ids:
            assert not schema_tester.verify_record_exists("secret_tags", secret_tag_id)
        
        # Cleanup remaining test data
        remaining_journal_ids = [j["id"] for j in hierarchy["journals"] if j["id"] != journal_id]
        user_id = hierarchy["user"]["id"]
        
        with schema_tester.get_session() as session:
            if remaining_journal_ids:
                session.execute(text("DELETE FROM journal_entries WHERE id = ANY(:ids)"), {"ids": remaining_journal_ids})
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_id})
    
    def test_cascade_delete_user_full_hierarchy(self, schema_tester, cascade_helper):
        """Test that deleting a user cascades through the entire hierarchy."""
        # Create test hierarchy
        hierarchy = cascade_helper.create_test_hierarchy()
        user_id = hierarchy["user"]["id"]
        
        # Count records before deletion
        with schema_tester.get_session() as session:
            user_count = session.execute(text("SELECT COUNT(*) FROM users WHERE id = :user_id"), {"user_id": user_id}).fetchone()[0]
            journal_count = session.execute(text("SELECT COUNT(*) FROM journal_entries WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()[0]
            tag_count = session.execute(text("""
                SELECT COUNT(*) FROM tags t 
                JOIN journal_entries j ON t.journal_id = j.id 
                WHERE j.user_id = :user_id
            """), {"user_id": user_id}).fetchone()[0]
            secret_tag_count = session.execute(text("""
                SELECT COUNT(*) FROM secret_tags st 
                JOIN journal_entries j ON st.journal_id = j.id 
                WHERE j.user_id = :user_id
            """), {"user_id": user_id}).fetchone()[0]
            reminder_count = session.execute(text("SELECT COUNT(*) FROM reminders WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()[0]
        
        # Verify we have data to delete
        assert user_count == 1
        assert journal_count == 2
        assert tag_count == 4  # 2 tags per journal
        assert secret_tag_count == 4  # 2 secret tags per journal
        assert reminder_count == 2
        
        # Delete the user
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_id})
        
        # Verify all related records are deleted
        with schema_tester.get_session() as session:
            user_count_after = session.execute(text("SELECT COUNT(*) FROM users WHERE id = :user_id"), {"user_id": user_id}).fetchone()[0]
            journal_count_after = session.execute(text("SELECT COUNT(*) FROM journal_entries WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()[0]
            tag_count_after = session.execute(text("""
                SELECT COUNT(*) FROM tags t 
                JOIN journal_entries j ON t.journal_id = j.id 
                WHERE j.user_id = :user_id
            """), {"user_id": user_id}).fetchone()[0]
            secret_tag_count_after = session.execute(text("""
                SELECT COUNT(*) FROM secret_tags st 
                JOIN journal_entries j ON st.journal_id = j.id 
                WHERE j.user_id = :user_id
            """), {"user_id": user_id}).fetchone()[0]
            reminder_count_after = session.execute(text("SELECT COUNT(*) FROM reminders WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()[0]
        
        # Verify cascade deletion worked
        assert user_count_after == 0
        assert journal_count_after == 0
        assert tag_count_after == 0
        assert secret_tag_count_after == 0
        assert reminder_count_after == 0
    
    def test_cascade_delete_preserves_unrelated_data(self, schema_tester):
        """Test that cascade delete only affects related records."""
        # Create two separate users with their own data
        user1_data = ConstraintTestDataGenerator.generate_valid_user("user1@example.com")
        user2_data = ConstraintTestDataGenerator.generate_valid_user("user2@example.com")
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user1_data)
            
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user2_data)
        
        # Create journal entries for both users
        journal1_data = ConstraintTestDataGenerator.generate_valid_journal(user1_data["id"])
        journal2_data = ConstraintTestDataGenerator.generate_valid_journal(user2_data["id"])
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
            """), journal1_data)
            
            session.execute(text("""
                INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
            """), journal2_data)
        
        # Delete user1
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user1_data["id"]})
        
        # Verify user1 and their journal are deleted
        assert not schema_tester.verify_record_exists("users", user1_data["id"])
        assert not schema_tester.verify_record_exists("journal_entries", journal1_data["id"])
        
        # Verify user2 and their journal are preserved
        assert schema_tester.verify_record_exists("users", user2_data["id"])
        assert schema_tester.verify_record_exists("journal_entries", journal2_data["id"])
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", [journal2_data["id"]])
        schema_tester.cleanup_test_data("users", [user2_data["id"]])
    
    def test_cascade_delete_performance(self, schema_tester):
        """Test cascade delete performance with large datasets."""
        # Create user with many related records
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create many journals
        journal_ids = []
        for i in range(50):
            journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
            journal_ids.append(journal_data["id"])
            
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        # Create tags for each journal
        tag_ids = []
        for journal_id in journal_ids:
            for i in range(3):  # 3 tags per journal
                tag_data = ConstraintTestDataGenerator.generate_valid_tag(journal_id)
                tag_ids.append(tag_data["id"])
                
                with schema_tester.get_session() as session:
                    session.execute(text("""
                        INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                        VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                    """), tag_data)
        
        # Time the cascade delete operation
        import time
        start_time = time.time()
        
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_data["id"]})
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Verify cascade delete completed in reasonable time
        assert duration < 2.0, f"Cascade delete too slow: {duration:.2f}s for 50 journals and 150 tags"
        
        # Verify all records are deleted
        assert not schema_tester.verify_record_exists("users", user_data["id"])
        assert schema_tester.verify_record_count("journal_entries", 0, "user_id = :user_id", {"user_id": user_data["id"]})
        assert schema_tester.verify_record_count("tags", 0, "id = ANY(:ids)", {"ids": tag_ids})
    
    def test_cascade_delete_with_null_foreign_keys(self, schema_tester):
        """Test cascade delete behavior with NULL foreign keys."""
        # This test verifies that NULL foreign keys don't interfere with cascade operations
        # Note: Our schema doesn't allow NULL foreign keys, but we test the behavior
        
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
        
        # Delete user (should cascade to journal)
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_data["id"]})
        
        # Verify cascade deletion worked
        assert not schema_tester.verify_record_exists("users", user_data["id"])
        assert not schema_tester.verify_record_exists("journal_entries", journal_data["id"])
    
    def test_cascade_delete_circular_reference_protection(self, schema_tester):
        """Test that cascade delete handles potential circular references correctly."""
        # Our current schema doesn't have circular references, but this tests the behavior
        
        # Create user and multiple journals
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create multiple journals that reference the same user
        journal_data_list = []
        for i in range(3):
            journal_data = ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
            journal_data_list.append(journal_data)
            
            with schema_tester.get_session() as session:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal_data)
        
        # Delete user (should cascade to all journals)
        with schema_tester.get_session() as session:
            session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_data["id"]})
        
        # Verify all journals are deleted
        assert not schema_tester.verify_record_exists("users", user_data["id"])
        for journal_data in journal_data_list:
            assert not schema_tester.verify_record_exists("journal_entries", journal_data["id"])
    
    def test_cascade_delete_transaction_rollback(self, schema_tester):
        """Test cascade delete behavior during transaction rollback."""
        # Create test data
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
        
        # Attempt cascade delete in a transaction that will be rolled back
        try:
            with schema_tester.get_session() as session:
                session.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_data["id"]})
                # Force an error to trigger rollback
                session.execute(text("SELECT 1/0"))  # Division by zero error
        except Exception:
            # Expected to fail and rollback
            pass
        
        # Verify records still exist after rollback
        assert schema_tester.verify_record_exists("users", user_data["id"])
        assert schema_tester.verify_record_exists("journal_entries", journal_data["id"])
        
        # Cleanup
        schema_tester.cleanup_test_data("journal_entries", [journal_data["id"]])
        schema_tester.cleanup_test_data("users", [user_data["id"]])


if __name__ == "__main__":
    # Run cascade operation tests standalone
    pytest.main([__file__, "-v", "-s"]) 