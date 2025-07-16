"""
Performance Tests for UUID-based Bulk Database Operations

This module tests the performance of bulk database operations with UUID primary keys,
including batch inserts, updates, deletes, and bulk queries.
"""

import pytest
import uuid
import random
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta

from tests.performance.performance_utils import (
    DatabasePerformanceTester,
    PerformanceMetrics,
    PerformanceTestSetup,
    PerformanceTimer,
    TestDataGenerator
)


class TestUUIDBulkOperations:
    """Test suite for UUID-based bulk operation performance."""
    
    @pytest.fixture(scope="class")
    def db_tester(self):
        """Create database performance tester."""
        return DatabasePerformanceTester()
    
    @pytest.fixture(scope="class")
    def test_setup(self, db_tester):
        """Set up test data for performance testing."""
        setup = PerformanceTestSetup(db_tester)
        setup.setup_test_data(
            user_count=500,
            journal_count=2000,
            tag_count=1000,
            reminder_count=500,
            secret_tag_count=250
        )
        yield setup
        setup.cleanup_test_data()
    
    def test_bulk_insert_performance(self, db_tester, test_setup):
        """Test performance of bulk insert operations."""
        # Test bulk user inserts
        user_data = TestDataGenerator.generate_user_data(100)
        
        with PerformanceTimer("Bulk user insert") as timer:
            with db_tester.get_session() as session:
                for user in user_data:
                    session.execute("""
                        INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                        VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                    """, user)
        
        user_insert_time = timer.duration
        
        # Test bulk journal inserts
        journal_data = TestDataGenerator.generate_journal_data(
            [user["id"] for user in user_data], 500
        )
        
        with PerformanceTimer("Bulk journal insert") as timer:
            with db_tester.get_session() as session:
                for journal in journal_data:
                    session.execute("""
                        INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                        VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                    """, journal)
        
        journal_insert_time = timer.duration
        
        # Test bulk tag inserts
        tag_data = TestDataGenerator.generate_tag_data(
            [journal["id"] for journal in journal_data], 1000
        )
        
        with PerformanceTimer("Bulk tag insert") as timer:
            with db_tester.get_session() as session:
                for tag in tag_data:
                    session.execute("""
                        INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                        VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                    """, tag)
        
        tag_insert_time = timer.duration
        
        # Assert performance requirements (< 50ms for 100 records)
        assert user_insert_time < 0.050, f"User bulk insert too slow: {user_insert_time:.4f}s"
        assert journal_insert_time < 0.250, f"Journal bulk insert too slow: {journal_insert_time:.4f}s"  # 500 records
        assert tag_insert_time < 0.500, f"Tag bulk insert too slow: {tag_insert_time:.4f}s"  # 1000 records
        
        # Cleanup test data
        with db_tester.get_session() as session:
            session.execute("DELETE FROM tags WHERE id = ANY(:ids)", 
                          {"ids": [tag["id"] for tag in tag_data]})
            session.execute("DELETE FROM journal_entries WHERE id = ANY(:ids)", 
                          {"ids": [journal["id"] for journal in journal_data]})
            session.execute("DELETE FROM users WHERE id = ANY(:ids)", 
                          {"ids": [user["id"] for user in user_data]})
        
        print(f"\n=== Bulk Insert Performance ===")
        print(f"Users (100 records): {user_insert_time:.4f}s")
        print(f"Journals (500 records): {journal_insert_time:.4f}s")
        print(f"Tags (1000 records): {tag_insert_time:.4f}s")
    
    def test_bulk_update_performance(self, db_tester, test_setup):
        """Test performance of bulk update operations."""
        # Test bulk user updates
        user_ids = random.sample(test_setup.test_data_ids["users"], 100)
        
        with PerformanceTimer("Bulk user update") as timer:
            with db_tester.get_session() as session:
                for user_id in user_ids:
                    session.execute("""
                        UPDATE users 
                        SET first_tag_display_tag_display_name= :new_name, updated_at = :updated_at
                        WHERE id = :user_id
                    """, {
                        "new_name": f"Updated_User_{user_id}",
                        "updated_at": datetime.now(timezone.utc),
                        "user_id": user_id
                    })
        
        user_update_time = timer.duration
        
        # Test bulk journal updates
        journal_ids = random.sample(test_setup.test_data_ids["journals"], 100)
        
        with PerformanceTimer("Bulk journal update") as timer:
            with db_tester.get_session() as session:
                for journal_id in journal_ids:
                    session.execute("""
                        UPDATE journal_entries 
                        SET title = :new_title, updated_at = :updated_at
                        WHERE id = :journal_id
                    """, {
                        "new_title": f"Updated Journal {journal_id}",
                        "updated_at": datetime.now(timezone.utc),
                        "journal_id": journal_id
                    })
        
        journal_update_time = timer.duration
        
        # Test bulk reminder status updates
        reminder_ids = random.sample(test_setup.test_data_ids["reminders"], 50)
        
        with PerformanceTimer("Bulk reminder update") as timer:
            with db_tester.get_session() as session:
                for reminder_id in reminder_ids:
                    session.execute("""
                        UPDATE reminders 
                        SET is_completed = :is_completed, updated_at = :updated_at
                        WHERE id = :reminder_id
                    """, {
                        "is_completed": True,
                        "updated_at": datetime.now(timezone.utc),
                        "reminder_id": reminder_id
                    })
        
        reminder_update_time = timer.duration
        
        # Assert performance requirements
        assert user_update_time < 0.050, f"User bulk update too slow: {user_update_time:.4f}s"
        assert journal_update_time < 0.050, f"Journal bulk update too slow: {journal_update_time:.4f}s"
        assert reminder_update_time < 0.025, f"Reminder bulk update too slow: {reminder_update_time:.4f}s"
        
        print(f"\n=== Bulk Update Performance ===")
        print(f"Users (100 records): {user_update_time:.4f}s")
        print(f"Journals (100 records): {journal_update_time:.4f}s")
        print(f"Reminders (50 records): {reminder_update_time:.4f}s")
    
    def test_bulk_delete_performance(self, db_tester, test_setup):
        """Test performance of bulk delete operations."""
        # Create test data to delete
        user_data = TestDataGenerator.generate_user_data(50)
        journal_data = TestDataGenerator.generate_journal_data(
            [user["id"] for user in user_data], 200
        )
        tag_data = TestDataGenerator.generate_tag_data(
            [journal["id"] for journal in journal_data], 300
        )
        
        # Insert test data
        with db_tester.get_session() as session:
            for user in user_data:
                session.execute("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """, user)
            
            for journal in journal_data:
                session.execute("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """, journal)
            
            for tag in tag_data:
                session.execute("""
                    INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                    VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                """, tag)
        
        # Test bulk delete operations
        tag_ids = [tag["id"] for tag in tag_data]
        
        with PerformanceTimer("Bulk tag delete") as timer:
            with db_tester.get_session() as session:
                session.execute("DELETE FROM tags WHERE id = ANY(:ids)", {"ids": tag_ids})
        
        tag_delete_time = timer.duration
        
        journal_ids = [journal["id"] for journal in journal_data]
        
        with PerformanceTimer("Bulk journal delete") as timer:
            with db_tester.get_session() as session:
                session.execute("DELETE FROM journal_entries WHERE id = ANY(:ids)", {"ids": journal_ids})
        
        journal_delete_time = timer.duration
        
        user_ids = [user["id"] for user in user_data]
        
        with PerformanceTimer("Bulk user delete") as timer:
            with db_tester.get_session() as session:
                session.execute("DELETE FROM users WHERE id = ANY(:ids)", {"ids": user_ids})
        
        user_delete_time = timer.duration
        
        # Assert performance requirements
        assert tag_delete_time < 0.020, f"Tag bulk delete too slow: {tag_delete_time:.4f}s"
        assert journal_delete_time < 0.020, f"Journal bulk delete too slow: {journal_delete_time:.4f}s"
        assert user_delete_time < 0.020, f"User bulk delete too slow: {user_delete_time:.4f}s"
        
        print(f"\n=== Bulk Delete Performance ===")
        print(f"Tags (300 records): {tag_delete_time:.4f}s")
        print(f"Journals (200 records): {journal_delete_time:.4f}s")
        print(f"Users (50 records): {user_delete_time:.4f}s")
    
    def test_bulk_query_performance(self, db_tester, test_setup):
        """Test performance of bulk query operations."""
        # Test bulk user queries
        user_ids = random.sample(test_setup.test_data_ids["users"], 100)
        
        with PerformanceTimer("Bulk user query") as timer:
            results = db_tester.execute_query(
                "SELECT * FROM users WHERE id = ANY(:ids)",
                {"ids": user_ids}
            )
        
        user_query_time = timer.duration
        assert len(results) == len(user_ids), "Should return all requested users"
        
        # Test bulk journal queries
        journal_ids = random.sample(test_setup.test_data_ids["journals"], 200)
        
        with PerformanceTimer("Bulk journal query") as timer:
            results = db_tester.execute_query(
                "SELECT * FROM journal_entries WHERE id = ANY(:ids)",
                {"ids": journal_ids}
            )
        
        journal_query_time = timer.duration
        assert len(results) == len(journal_ids), "Should return all requested journals"
        
        # Test bulk tag queries
        tag_ids = random.sample(test_setup.test_data_ids["tags"], 300)
        
        with PerformanceTimer("Bulk tag query") as timer:
            results = db_tester.execute_query(
                "SELECT * FROM tags WHERE id = ANY(:ids)",
                {"ids": tag_ids}
            )
        
        tag_query_time = timer.duration
        assert len(results) == len(tag_ids), "Should return all requested tags"
        
        # Assert performance requirements
        assert user_query_time < 0.020, f"User bulk query too slow: {user_query_time:.4f}s"
        assert journal_query_time < 0.030, f"Journal bulk query too slow: {journal_query_time:.4f}s"
        assert tag_query_time < 0.040, f"Tag bulk query too slow: {tag_query_time:.4f}s"
        
        print(f"\n=== Bulk Query Performance ===")
        print(f"Users (100 records): {user_query_time:.4f}s")
        print(f"Journals (200 records): {journal_query_time:.4f}s")
        print(f"Tags (300 records): {tag_query_time:.4f}s")
    
    def test_batch_insert_with_relationships(self, db_tester, test_setup):
        """Test performance of batch inserts with foreign key relationships."""
        # Create related data in batches
        user_data = TestDataGenerator.generate_user_data(50)
        
        # Batch insert users
        with PerformanceTimer("Batch user insert") as timer:
            with db_tester.get_session() as session:
                for user in user_data:
                    session.execute("""
                        INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                        VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                    """, user)
        
        user_batch_time = timer.duration
        
        # Batch insert journals with foreign keys
        journal_data = TestDataGenerator.generate_journal_data(
            [user["id"] for user in user_data], 250
        )
        
        with PerformanceTimer("Batch journal insert with FK") as timer:
            with db_tester.get_session() as session:
                for journal in journal_data:
                    session.execute("""
                        INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                        VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                    """, journal)
        
        journal_batch_time = timer.duration
        
        # Batch insert tags with foreign keys
        tag_data = TestDataGenerator.generate_tag_data(
            [journal["id"] for journal in journal_data], 500
        )
        
        with PerformanceTimer("Batch tag insert with FK") as timer:
            with db_tester.get_session() as session:
                for tag in tag_data:
                    session.execute("""
                        INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                        VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                    """, tag)
        
        tag_batch_time = timer.duration
        
        # Batch insert reminders with foreign keys
        reminder_data = TestDataGenerator.generate_reminder_data(
            [user["id"] for user in user_data], 100
        )
        
        with PerformanceTimer("Batch reminder insert with FK") as timer:
            with db_tester.get_session() as session:
                for reminder in reminder_data:
                    session.execute("""
                        INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                        VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
                    """, reminder)
        
        reminder_batch_time = timer.duration
        
        # Assert performance requirements
        assert user_batch_time < 0.025, f"User batch insert too slow: {user_batch_time:.4f}s"
        assert journal_batch_time < 0.125, f"Journal batch insert too slow: {journal_batch_time:.4f}s"
        assert tag_batch_time < 0.250, f"Tag batch insert too slow: {tag_batch_time:.4f}s"
        assert reminder_batch_time < 0.050, f"Reminder batch insert too slow: {reminder_batch_time:.4f}s"
        
        # Cleanup test data
        with db_tester.get_session() as session:
            session.execute("DELETE FROM reminders WHERE id = ANY(:ids)", 
                          {"ids": [reminder["id"] for reminder in reminder_data]})
            session.execute("DELETE FROM tags WHERE id = ANY(:ids)", 
                          {"ids": [tag["id"] for tag in tag_data]})
            session.execute("DELETE FROM journal_entries WHERE id = ANY(:ids)", 
                          {"ids": [journal["id"] for journal in journal_data]})
            session.execute("DELETE FROM users WHERE id = ANY(:ids)", 
                          {"ids": [user["id"] for user in user_data]})
        
        print(f"\n=== Batch Insert with Relationships Performance ===")
        print(f"Users (50 records): {user_batch_time:.4f}s")
        print(f"Journals (250 records): {journal_batch_time:.4f}s")
        print(f"Tags (500 records): {tag_batch_time:.4f}s")
        print(f"Reminders (100 records): {reminder_batch_time:.4f}s")
    
    def test_bulk_aggregation_performance(self, db_tester, test_setup):
        """Test performance of bulk aggregation operations."""
        # Test bulk user statistics
        user_ids = random.sample(test_setup.test_data_ids["users"], 100)
        
        with PerformanceTimer("Bulk user statistics") as timer:
            results = db_tester.execute_query("""
                SELECT u.id, u.email,
                       COUNT(DISTINCT j.id) as journal_count,
                       COUNT(DISTINCT t.id) as tag_count,
                       COUNT(DISTINCT r.id) as reminder_count
                FROM users u
                LEFT JOIN journal_entries j ON u.id = j.user_id
                LEFT JOIN tags t ON j.id = t.journal_id
                LEFT JOIN reminders r ON u.id = r.user_id
                WHERE u.id = ANY(:user_ids)
                GROUP BY u.id, u.email
            """, {"user_ids": user_ids})
        
        user_stats_time = timer.duration
        
        # Test bulk journal statistics
        journal_ids = random.sample(test_setup.test_data_ids["journals"], 200)
        
        with PerformanceTimer("Bulk journal statistics") as timer:
            results = db_tester.execute_query("""
                SELECT j.id, j.title,
                       COUNT(DISTINCT t.id) as tag_count,
                       COUNT(DISTINCT st.id) as secret_tag_count
                FROM journal_entries j
                LEFT JOIN tags t ON j.id = t.journal_id
                LEFT JOIN secret_tags st ON j.id = st.journal_id
                WHERE j.id = ANY(:journal_ids)
                GROUP BY j.id, j.title
            """, {"journal_ids": journal_ids})
        
        journal_stats_time = timer.duration
        
        # Test bulk tag popularity
        with PerformanceTimer("Bulk tag popularity") as timer:
            results = db_tester.execute_query("""
                SELECT t.name, COUNT(*) as usage_count
                FROM tags t
                WHERE t.journal_id = ANY(:journal_ids)
                GROUP BY t.name
                ORDER BY usage_count DESC
                LIMIT 100
            """, {"journal_ids": journal_ids})
        
        tag_popularity_time = timer.duration
        
        # Assert performance requirements
        assert user_stats_time < 0.100, f"User statistics too slow: {user_stats_time:.4f}s"
        assert journal_stats_time < 0.080, f"Journal statistics too slow: {journal_stats_time:.4f}s"
        assert tag_popularity_time < 0.060, f"Tag popularity too slow: {tag_popularity_time:.4f}s"
        
        print(f"\n=== Bulk Aggregation Performance ===")
        print(f"User statistics (100 users): {user_stats_time:.4f}s")
        print(f"Journal statistics (200 journals): {journal_stats_time:.4f}s")
        print(f"Tag popularity analysis: {tag_popularity_time:.4f}s")
    
    def test_bulk_search_performance(self, db_tester, test_setup):
        """Test performance of bulk search operations."""
        # Test bulk journal search
        search_terms = [f"Journal Entry {i}" for i in range(1, 51)]
        
        with PerformanceTimer("Bulk journal search") as timer:
            results = db_tester.execute_query("""
                SELECT * FROM journal_entries 
                WHERE title ILIKE ANY(:search_terms)
                ORDER BY created_at DESC
                LIMIT 100
            """, {"search_terms": [f"%{term}%" for term in search_terms]})
        
        journal_search_time = timer.duration
        
        # Test bulk user search
        email_patterns = [f"user{i}@example.com" for i in range(1, 51)]
        
        with PerformanceTimer("Bulk user search") as timer:
            results = db_tester.execute_query("""
                SELECT * FROM users 
                WHERE email = ANY(:emails)
            """, {"emails": email_patterns})
        
        user_search_time = timer.duration
        
        # Test bulk tag search
        tag_patterns = [f"tag_{i}" for i in range(1, 51)]
        
        with PerformanceTimer("Bulk tag search") as timer:
            results = db_tester.execute_query("""
                SELECT t.*, j.title as journal_title
                FROM tags t
                JOIN journal_entries j ON t.journal_id = j.id
                WHERE t.tag_name= ANY(:tag_names)
                ORDER BY t.created_at DESC
                LIMIT 100
            """, {"tag_names": tag_patterns})
        
        tag_search_time = timer.duration
        
        # Assert performance requirements
        assert journal_search_time < 0.080, f"Journal search too slow: {journal_search_time:.4f}s"
        assert user_search_time < 0.020, f"User search too slow: {user_search_time:.4f}s"
        assert tag_search_time < 0.060, f"Tag search too slow: {tag_search_time:.4f}s"
        
        print(f"\n=== Bulk Search Performance ===")
        print(f"Journal search (50 terms): {journal_search_time:.4f}s")
        print(f"User search (50 emails): {user_search_time:.4f}s")
        print(f"Tag search (50 tags): {tag_search_time:.4f}s")


if __name__ == "__main__":
    # Run performance tests standalone
    pytest.main([__file__, "-v", "-s"]) 