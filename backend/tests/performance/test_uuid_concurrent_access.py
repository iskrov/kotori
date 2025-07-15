"""
Performance Tests for UUID-based Concurrent Database Access

This module tests the performance of concurrent database access patterns with UUID primary keys,
including multi-threaded queries, concurrent writes, and load handling scenarios.
"""

import pytest
import uuid
import random
import time
import threading
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from .performance_utils import (
    DatabasePerformanceTester,
    PerformanceMetrics,
    PerformanceTestSetup,
    PerformanceTimer,
    TestDataGenerator
)


class TestUUIDConcurrentAccess:
    """Test suite for UUID-based concurrent access performance."""
    
    @pytest.fixture(scope="class")
    def db_tester(self):
        """Create database performance tester."""
        return DatabasePerformanceTester()
    
    @pytest.fixture(scope="class")
    def test_setup(self, db_tester):
        """Set up test data for performance testing."""
        setup = PerformanceTestSetup(db_tester)
        setup.setup_test_data(
            user_count=1000,
            journal_count=5000,
            tag_count=2000,
            reminder_count=1000,
            secret_tag_count=500
        )
        yield setup
        setup.cleanup_test_data()
    
    def test_concurrent_read_performance(self, db_tester, test_setup):
        """Test performance of concurrent read operations."""
        user_ids = random.sample(test_setup.test_data_ids["users"], 100)
        
        # Test concurrent user lookups
        def lookup_user(user_id):
            with PerformanceTimer() as timer:
                with db_tester.get_session() as session:
                    result = session.execute(
                        "SELECT * FROM users WHERE id = :user_id",
                        {"user_id": user_id}
                    ).fetchone()
            return timer.duration, result is not None
        
        # Execute concurrent lookups
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(lookup_user, user_id) for user_id in user_ids]
            results = [future.result() for future in as_completed(futures)]
        
        durations = [result[0] for result in results]
        success_count = sum(1 for result in results if result[1])
        
        # Create metrics
        metrics = PerformanceMetrics()
        metrics.add_measurements(durations)
        
        # Assert performance requirements
        metrics.assert_performance(max_average=0.100)  # 100ms average under concurrent load
        assert success_count == len(user_ids), f"All queries should succeed, got {success_count}/{len(user_ids)}"
        
        print(f"\n=== Concurrent Read Performance ===")
        print(f"Concurrent user lookups: {metrics.get_summary()}")
        print(f"Success rate: {success_count}/{len(user_ids)}")
    
    def test_concurrent_write_performance(self, db_tester, test_setup):
        """Test performance of concurrent write operations."""
        # Create test data for concurrent writes
        user_data = TestDataGenerator.generate_user_data(50)
        
        def insert_user(user):
            with PerformanceTimer() as timer:
                try:
                    with db_tester.get_session() as session:
                        session.execute("""
                            INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                            VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                        """, user)
                    return timer.duration, True
                except Exception as e:
                    return timer.duration, False
        
        # Execute concurrent inserts
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(insert_user, user) for user in user_data]
            results = [future.result() for future in as_completed(futures)]
        
        durations = [result[0] for result in results]
        success_count = sum(1 for result in results if result[1])
        
        # Create metrics
        metrics = PerformanceMetrics()
        metrics.add_measurements(durations)
        
        # Assert performance requirements
        metrics.assert_performance(max_average=0.150)  # 150ms average under concurrent load
        assert success_count == len(user_data), f"All inserts should succeed, got {success_count}/{len(user_data)}"
        
        # Cleanup
        with db_tester.get_session() as session:
            session.execute("DELETE FROM users WHERE id = ANY(:ids)", 
                          {"ids": [user["id"] for user in user_data]})
        
        print(f"\n=== Concurrent Write Performance ===")
        print(f"Concurrent user inserts: {metrics.get_summary()}")
        print(f"Success rate: {success_count}/{len(user_data)}")
    
    def test_concurrent_mixed_operations(self, db_tester, test_setup):
        """Test performance of mixed concurrent operations (reads and writes)."""
        # Prepare test data
        user_ids = random.sample(test_setup.test_data_ids["users"], 50)
        new_user_data = TestDataGenerator.generate_user_data(25)
        
        def read_operation(user_id):
            with PerformanceTimer() as timer:
                with db_tester.get_session() as session:
                    result = session.execute(
                        "SELECT * FROM users WHERE id = :user_id",
                        {"user_id": user_id}
                    ).fetchone()
            return "read", timer.duration, result is not None
        
        def write_operation(user):
            with PerformanceTimer() as timer:
                try:
                    with db_tester.get_session() as session:
                        session.execute("""
                            INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                            VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                        """, user)
                    return "write", timer.duration, True
                except Exception:
                    return "write", timer.duration, False
        
        def update_operation(user_id):
            with PerformanceTimer() as timer:
                try:
                    with db_tester.get_session() as session:
                        session.execute("""
                            UPDATE users 
                            SET first_name = :new_name, updated_at = :updated_at
                            WHERE id = :user_id
                        """, {
                            "new_name": f"Updated_{user_id}",
                            "updated_at": datetime.now(timezone.utc),
                            "user_id": user_id
                        })
                    return "update", timer.duration, True
                except Exception:
                    return "update", timer.duration, False
        
        # Create mixed operations
        operations = []
        operations.extend([(read_operation, user_id) for user_id in user_ids])
        operations.extend([(write_operation, user) for user in new_user_data])
        operations.extend([(update_operation, user_id) for user_id in user_ids[:25]])
        
        # Shuffle operations to simulate real-world mixed load
        random.shuffle(operations)
        
        # Execute mixed operations concurrently
        with ThreadPoolExecutor(max_workers=15) as executor:
            futures = [executor.submit(op_func, op_data) for op_func, op_data in operations]
            results = [future.result() for future in as_completed(futures)]
        
        # Analyze results by operation type
        read_durations = [result[1] for result in results if result[0] == "read"]
        write_durations = [result[1] for result in results if result[0] == "write"]
        update_durations = [result[1] for result in results if result[0] == "update"]
        
        read_success = sum(1 for result in results if result[0] == "read" and result[2])
        write_success = sum(1 for result in results if result[0] == "write" and result[2])
        update_success = sum(1 for result in results if result[0] == "update" and result[2])
        
        # Create metrics
        read_metrics = PerformanceMetrics()
        read_metrics.add_measurements(read_durations)
        
        write_metrics = PerformanceMetrics()
        write_metrics.add_measurements(write_durations)
        
        update_metrics = PerformanceMetrics()
        update_metrics.add_measurements(update_durations)
        
        # Assert performance requirements
        read_metrics.assert_performance(max_average=0.120)  # 120ms average under mixed load
        write_metrics.assert_performance(max_average=0.200)  # 200ms average under mixed load
        update_metrics.assert_performance(max_average=0.150)  # 150ms average under mixed load
        
        # Cleanup
        with db_tester.get_session() as session:
            session.execute("DELETE FROM users WHERE id = ANY(:ids)", 
                          {"ids": [user["id"] for user in new_user_data]})
        
        print(f"\n=== Concurrent Mixed Operations Performance ===")
        print(f"Read operations: {read_metrics.get_summary()}")
        print(f"Write operations: {write_metrics.get_summary()}")
        print(f"Update operations: {update_metrics.get_summary()}")
        print(f"Success rates - Read: {read_success}/{len(read_durations)}, Write: {write_success}/{len(write_durations)}, Update: {update_success}/{len(update_durations)}")
    
    def test_concurrent_relationship_queries(self, db_tester, test_setup):
        """Test performance of concurrent relationship queries."""
        user_ids = random.sample(test_setup.test_data_ids["users"], 50)
        journal_ids = random.sample(test_setup.test_data_ids["journals"], 50)
        
        def get_user_journals(user_id):
            with PerformanceTimer() as timer:
                with db_tester.get_session() as session:
                    result = session.execute("""
                        SELECT j.id, j.title, j.created_at
                        FROM journal_entries j
                        WHERE j.user_id = :user_id
                        ORDER BY j.created_at DESC
                        LIMIT 10
                    """, {"user_id": user_id}).fetchall()
            return timer.duration, len(result)
        
        def get_journal_tags(journal_id):
            with PerformanceTimer() as timer:
                with db_tester.get_session() as session:
                    result = session.execute("""
                        SELECT t.id, t.name, t.created_at
                        FROM tags t
                        WHERE t.journal_id = :journal_id
                        ORDER BY t.created_at DESC
                    """, {"journal_id": journal_id}).fetchall()
            return timer.duration, len(result)
        
        def get_user_statistics(user_id):
            with PerformanceTimer() as timer:
                with db_tester.get_session() as session:
                    result = session.execute("""
                        SELECT COUNT(DISTINCT j.id) as journal_count,
                               COUNT(DISTINCT t.id) as tag_count,
                               COUNT(DISTINCT r.id) as reminder_count
                        FROM users u
                        LEFT JOIN journal_entries j ON u.id = j.user_id
                        LEFT JOIN tags t ON j.id = t.journal_id
                        LEFT JOIN reminders r ON u.id = r.user_id
                        WHERE u.id = :user_id
                    """, {"user_id": user_id}).fetchone()
            return timer.duration, result is not None
        
        # Create concurrent relationship queries
        operations = []
        operations.extend([("user_journals", get_user_journals, user_id) for user_id in user_ids])
        operations.extend([("journal_tags", get_journal_tags, journal_id) for journal_id in journal_ids])
        operations.extend([("user_stats", get_user_statistics, user_id) for user_id in user_ids[:25]])
        
        # Execute concurrent relationship queries
        with ThreadPoolExecutor(max_workers=15) as executor:
            futures = [executor.submit(op_func, op_data) for op_type, op_func, op_data in operations]
            results = [(operations[i][0], future.result()) for i, future in enumerate(as_completed(futures))]
        
        # Analyze results by query type
        user_journals_durations = [result[1][0] for result in results if result[0] == "user_journals"]
        journal_tags_durations = [result[1][0] for result in results if result[0] == "journal_tags"]
        user_stats_durations = [result[1][0] for result in results if result[0] == "user_stats"]
        
        # Create metrics
        user_journals_metrics = PerformanceMetrics()
        user_journals_metrics.add_measurements(user_journals_durations)
        
        journal_tags_metrics = PerformanceMetrics()
        journal_tags_metrics.add_measurements(journal_tags_durations)
        
        user_stats_metrics = PerformanceMetrics()
        user_stats_metrics.add_measurements(user_stats_durations)
        
        # Assert performance requirements
        user_journals_metrics.assert_performance(max_average=0.100)  # 100ms average
        journal_tags_metrics.assert_performance(max_average=0.100)  # 100ms average
        user_stats_metrics.assert_performance(max_average=0.200)  # 200ms average (complex query)
        
        print(f"\n=== Concurrent Relationship Queries Performance ===")
        print(f"User journals: {user_journals_metrics.get_summary()}")
        print(f"Journal tags: {journal_tags_metrics.get_summary()}")
        print(f"User statistics: {user_stats_metrics.get_summary()}")
    
    def test_stress_test_high_concurrency(self, db_tester, test_setup):
        """Test performance under high concurrency stress conditions."""
        user_ids = random.sample(test_setup.test_data_ids["users"], 200)
        
        def stress_operation(user_id):
            operations_per_thread = 5
            thread_durations = []
            
            for _ in range(operations_per_thread):
                with PerformanceTimer() as timer:
                    with db_tester.get_session() as session:
                        # Random operation selection
                        operation_type = random.choice(["user_lookup", "journal_lookup", "user_journals"])
                        
                        if operation_type == "user_lookup":
                            session.execute(
                                "SELECT * FROM users WHERE id = :user_id",
                                {"user_id": user_id}
                            ).fetchone()
                        elif operation_type == "journal_lookup":
                            session.execute(
                                "SELECT * FROM journal_entries WHERE user_id = :user_id LIMIT 5",
                                {"user_id": user_id}
                            ).fetchall()
                        else:  # user_journals
                            session.execute("""
                                SELECT u.email, COUNT(j.id) as journal_count
                                FROM users u
                                LEFT JOIN journal_entries j ON u.id = j.user_id
                                WHERE u.id = :user_id
                                GROUP BY u.id, u.email
                            """, {"user_id": user_id}).fetchone()
                
                thread_durations.append(timer.duration)
            
            return thread_durations
        
        # Execute high concurrency stress test
        with ThreadPoolExecutor(max_workers=50) as executor:
            futures = [executor.submit(stress_operation, user_id) for user_id in user_ids]
            results = [future.result() for future in as_completed(futures)]
        
        # Flatten results
        all_durations = []
        for thread_durations in results:
            all_durations.extend(thread_durations)
        
        # Create metrics
        stress_metrics = PerformanceMetrics()
        stress_metrics.add_measurements(all_durations)
        
        # Assert performance requirements (more lenient under high stress)
        stress_metrics.assert_performance(max_average=0.300)  # 300ms average under high stress
        
        print(f"\n=== High Concurrency Stress Test Performance ===")
        print(f"Stress test (50 threads, 5 ops each): {stress_metrics.get_summary()}")
        print(f"Total operations: {len(all_durations)}")
    
    def test_concurrent_transaction_performance(self, db_tester, test_setup):
        """Test performance of concurrent transactions."""
        user_ids = random.sample(test_setup.test_data_ids["users"], 50)
        
        def transaction_operation(user_id):
            with PerformanceTimer() as timer:
                try:
                    with db_tester.get_session() as session:
                        # Multi-operation transaction
                        # 1. Update user
                        session.execute("""
                            UPDATE users 
                            SET first_name = :new_name, updated_at = :updated_at
                            WHERE id = :user_id
                        """, {
                            "new_name": f"Transaction_{user_id}",
                            "updated_at": datetime.now(timezone.utc),
                            "user_id": user_id
                        })
                        
                        # 2. Insert journal entry
                        journal_id = uuid.uuid4()
                        session.execute("""
                            INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                            VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                        """, {
                            "id": journal_id,
                            "user_id": user_id,
                            "title": f"Transaction Journal {user_id}",
                            "content": "This is a transaction test journal entry.",
                            "created_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc)
                        })
                        
                        # 3. Insert tag
                        session.execute("""
                            INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                            VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                        """, {
                            "id": uuid.uuid4(),
                            "journal_id": journal_id,
                            "name": f"transaction_tag_{user_id}",
                            "created_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc)
                        })
                        
                        # Transaction commits automatically
                        return timer.duration, True, journal_id
                except Exception:
                    return timer.duration, False, None
        
        # Execute concurrent transactions
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(transaction_operation, user_id) for user_id in user_ids]
            results = [future.result() for future in as_completed(futures)]
        
        durations = [result[0] for result in results]
        success_count = sum(1 for result in results if result[1])
        journal_ids = [result[2] for result in results if result[1] and result[2]]
        
        # Create metrics
        transaction_metrics = PerformanceMetrics()
        transaction_metrics.add_measurements(durations)
        
        # Assert performance requirements
        transaction_metrics.assert_performance(max_average=0.200)  # 200ms average for transactions
        assert success_count == len(user_ids), f"All transactions should succeed, got {success_count}/{len(user_ids)}"
        
        # Cleanup transaction test data
        with db_tester.get_session() as session:
            session.execute("DELETE FROM tags WHERE journal_id = ANY(:ids)", {"ids": journal_ids})
            session.execute("DELETE FROM journal_entries WHERE id = ANY(:ids)", {"ids": journal_ids})
        
        print(f"\n=== Concurrent Transaction Performance ===")
        print(f"Concurrent transactions: {transaction_metrics.get_summary()}")
        print(f"Success rate: {success_count}/{len(user_ids)}")
    
    def test_deadlock_prevention(self, db_tester, test_setup):
        """Test that concurrent operations don't cause deadlocks."""
        user_ids = random.sample(test_setup.test_data_ids["users"], 20)
        
        def competing_operation(user_id):
            with PerformanceTimer() as timer:
                try:
                    with db_tester.get_session() as session:
                        # Simulate competing operations that might cause deadlocks
                        # Operation 1: Update user then insert journal
                        session.execute("""
                            UPDATE users 
                            SET updated_at = :updated_at
                            WHERE id = :user_id
                        """, {
                            "updated_at": datetime.now(timezone.utc),
                            "user_id": user_id
                        })
                        
                        # Small delay to increase chance of contention
                        time.sleep(0.01)
                        
                        journal_id = uuid.uuid4()
                        session.execute("""
                            INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                            VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                        """, {
                            "id": journal_id,
                            "user_id": user_id,
                            "title": f"Deadlock Test {user_id}",
                            "content": "Testing deadlock prevention.",
                            "created_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc)
                        })
                        
                        return timer.duration, True, journal_id
                except Exception as e:
                    return timer.duration, False, None
        
        # Execute operations that might compete
        with ThreadPoolExecutor(max_workers=20) as executor:
            # Submit multiple operations for each user to increase contention
            futures = []
            for user_id in user_ids:
                for _ in range(3):  # 3 operations per user
                    futures.append(executor.submit(competing_operation, user_id))
            
            results = [future.result() for future in as_completed(futures)]
        
        durations = [result[0] for result in results]
        success_count = sum(1 for result in results if result[1])
        journal_ids = [result[2] for result in results if result[1] and result[2]]
        
        # Create metrics
        deadlock_metrics = PerformanceMetrics()
        deadlock_metrics.add_measurements(durations)
        
        # Assert no deadlocks occurred (all operations should eventually succeed)
        assert success_count == len(results), f"All operations should succeed without deadlocks, got {success_count}/{len(results)}"
        
        # Cleanup
        with db_tester.get_session() as session:
            session.execute("DELETE FROM journal_entries WHERE id = ANY(:ids)", {"ids": journal_ids})
        
        print(f"\n=== Deadlock Prevention Test ===")
        print(f"Competing operations: {deadlock_metrics.get_summary()}")
        print(f"Success rate: {success_count}/{len(results)} (should be 100%)")


if __name__ == "__main__":
    # Run performance tests standalone
    pytest.main([__file__, "-v", "-s"]) 