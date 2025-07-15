"""
Performance tests for the UUID-optimized database schema.

These tests validate that the database optimizations provide measurable
performance improvements for common query patterns.
"""

import pytest
import time
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag, JournalEntryTag
from app.models.reminder import Reminder
from tests.test_config import PerformanceTestHelpers, TestDataFactory


class TestQueryPerformance:
    """Test suite for validating query performance with optimized schema."""

    @pytest.fixture
    def bulk_test_data(self, db: Session):
        """Create bulk test data for performance testing."""
        # Create a smaller dataset for testing to avoid long test times
        users, entries = PerformanceTestHelpers.create_bulk_test_data(
            db, num_users=20, entries_per_user=10
        )
        yield users, entries
        
        # Cleanup
        db.query(JournalEntry).filter(
            JournalEntry.user_id.in_([u.id for u in users])
        ).delete(synchronize_session=False)
        for user in users:
            db.delete(user)
        db.commit()

    def test_user_lookup_performance(self, db: Session, bulk_test_data):
        """Test performance of user lookup by UUID."""
        users, _ = bulk_test_data
        test_user = users[0]

        def user_lookup_query(session):
            return session.query(User).filter(User.id == test_user.id).first()

        # Measure performance
        performance_stats = PerformanceTestHelpers.measure_query_performance(
            db, user_lookup_query, iterations=50
        )

        # Assert performance is acceptable (should be very fast with UUID index)
        assert performance_stats['avg_time'] < 0.01, f"User lookup too slow: {performance_stats['avg_time']}s"
        assert performance_stats['max_time'] < 0.05, f"Worst case user lookup too slow: {performance_stats['max_time']}s"

    def test_journal_entries_by_user_performance(self, db: Session, bulk_test_data):
        """Test performance of fetching journal entries for a user."""
        users, _ = bulk_test_data
        test_user = users[0]

        def entries_by_user_query(session):
            return session.query(JournalEntry).filter(
                JournalEntry.user_id == test_user.id
            ).all()

        # Measure performance
        performance_stats = PerformanceTestHelpers.measure_query_performance(
            db, entries_by_user_query, iterations=30
        )

        # Assert performance is acceptable
        assert performance_stats['avg_time'] < 0.02, f"Entries by user query too slow: {performance_stats['avg_time']}s"
        
    def test_date_range_query_performance(self, db: Session, bulk_test_data):
        """Test performance of date range queries on journal entries."""
        users, _ = bulk_test_data
        test_user = users[0]

        from datetime import datetime, timedelta
        start_date = datetime.now() - timedelta(days=30)
        end_date = datetime.now()

        def date_range_query(session):
            return session.query(JournalEntry).filter(
                JournalEntry.user_id == test_user.id,
                JournalEntry.entry_date >= start_date,
                JournalEntry.entry_date <= end_date
            ).all()

        # Measure performance
        performance_stats = PerformanceTestHelpers.measure_query_performance(
            db, date_range_query, iterations=20
        )

        # Assert performance is acceptable (should benefit from composite index)
        assert performance_stats['avg_time'] < 0.03, f"Date range query too slow: {performance_stats['avg_time']}s"

    def test_tag_association_performance(self, db: Session, bulk_test_data):
        """Test performance of tag association queries."""
        users, entries = bulk_test_data
        
        # Create some tags and associations
        tags = []
        for i in range(5):
            tag = Tag(name=f"PerfTestTag{i}")
            tags.append(tag)
        
        db.add_all(tags)
        db.commit()
        
        # Associate tags with some entries
        associations = []
        for i, entry in enumerate(entries[:20]):  # Associate tags with first 20 entries
            tag = tags[i % len(tags)]
            association = JournalEntryTag(journal_entry_id=entry.id, tag_id=tag.id)
            associations.append(association)
        
        db.add_all(associations)
        db.commit()

        def tag_query(session):
            return session.query(JournalEntry).join(JournalEntryTag).join(Tag).filter(
                Tag.name == "PerfTestTag0"
            ).all()

        # Measure performance
        performance_stats = PerformanceTestHelpers.measure_query_performance(
            db, tag_query, iterations=15
        )

        # Assert performance is acceptable
        assert performance_stats['avg_time'] < 0.05, f"Tag association query too slow: {performance_stats['avg_time']}s"

        # Cleanup tag associations
        db.query(JournalEntryTag).filter(
            JournalEntryTag.journal_entry_id.in_([e.id for e in entries[:20]])
        ).delete(synchronize_session=False)
        for tag in tags:
            db.delete(tag)
        db.commit()

    def test_aggregate_query_performance(self, db: Session, bulk_test_data):
        """Test performance of aggregate queries."""
        users, _ = bulk_test_data

        def count_entries_by_user(session):
            return session.query(
                User.id,
                func.count(JournalEntry.id).label('entry_count')
            ).join(JournalEntry).group_by(User.id).all()

        # Measure performance
        performance_stats = PerformanceTestHelpers.measure_query_performance(
            db, count_entries_by_user, iterations=10
        )

        # Assert performance is acceptable
        assert performance_stats['avg_time'] < 0.1, f"Aggregate query too slow: {performance_stats['avg_time']}s"

    def test_bulk_insert_performance(self, db: Session):
        """Test performance of bulk insert operations."""
        # Test bulk user creation
        start_time = time.time()
        
        users = []
        for i in range(50):
            user_data = TestDataFactory.create_user_data(f"bulk_perf_user_{i}")
            user = User(**user_data)
            users.append(user)
        
        db.add_all(users)
        db.commit()
        
        user_insert_time = time.time() - start_time
        
        # Test bulk entry creation
        start_time = time.time()
        
        entries = []
        for user in users:
            for j in range(5):
                entry_data = TestDataFactory.create_journal_entry_data(user.id, f"bulk_entry_{j}")
                entry = JournalEntry(**entry_data)
                entries.append(entry)
        
        db.add_all(entries)
        db.commit()
        
        entry_insert_time = time.time() - start_time

        # Assert reasonable performance
        assert user_insert_time < 1.0, f"Bulk user insert too slow: {user_insert_time}s"
        assert entry_insert_time < 2.0, f"Bulk entry insert too slow: {entry_insert_time}s"

        # Cleanup
        db.query(JournalEntry).filter(
            JournalEntry.user_id.in_([u.id for u in users])
        ).delete(synchronize_session=False)
        for user in users:
            db.delete(user)
        db.commit()

    def test_complex_join_performance(self, db: Session, bulk_test_data):
        """Test performance of complex join queries."""
        users, entries = bulk_test_data

        def complex_join_query(session):
            return session.query(
                User.email,
                JournalEntry.title,
                JournalEntry.created_at
            ).join(JournalEntry).filter(
                User.is_active == True
            ).order_by(JournalEntry.created_at.desc()).limit(20).all()

        # Measure performance
        performance_stats = PerformanceTestHelpers.measure_query_performance(
            db, complex_join_query, iterations=10
        )

        # Assert performance is acceptable
        assert performance_stats['avg_time'] < 0.1, f"Complex join query too slow: {performance_stats['avg_time']}s"

    def test_search_query_performance(self, db: Session, bulk_test_data):
        """Test performance of text search queries."""
        users, entries = bulk_test_data
        test_user = users[0]

        def search_query(session):
            return session.query(JournalEntry).filter(
                JournalEntry.user_id == test_user.id,
                JournalEntry.content.ilike('%test%')
            ).all()

        # Measure performance
        performance_stats = PerformanceTestHelpers.measure_query_performance(
            db, search_query, iterations=10
        )

        # Assert performance is acceptable (note: text search without full-text indexing will be slower)
        assert performance_stats['avg_time'] < 0.2, f"Search query too slow: {performance_stats['avg_time']}s"


class TestIndexEffectiveness:
    """Test suite for validating that indexes are effectively used."""

    def test_uuid_index_usage(self, db: Session):
        """Test that UUID indexes are being used effectively."""
        # Create test user
        user_data = TestDataFactory.create_user_data("index_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create test entry
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "index_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()

        # Test that queries use indexes efficiently
        # Note: This is a basic test - in a real environment you'd use EXPLAIN ANALYZE
        start_time = time.time()
        
        # Query by primary key (should be very fast with index)
        result = db.query(User).filter(User.id == user.id).first()
        pk_query_time = time.time() - start_time
        
        assert result is not None
        assert pk_query_time < 0.001, f"Primary key lookup too slow: {pk_query_time}s"

        start_time = time.time()
        
        # Query by foreign key (should benefit from foreign key index)
        entries = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).all()
        fk_query_time = time.time() - start_time
        
        assert len(entries) >= 1
        assert fk_query_time < 0.01, f"Foreign key lookup too slow: {fk_query_time}s"

        # Cleanup
        db.delete(entry)
        db.delete(user)
        db.commit()

    def test_composite_index_effectiveness(self, db: Session):
        """Test that composite indexes improve query performance."""
        # Create test user
        user_data = TestDataFactory.create_user_data("composite_index_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create multiple entries
        entries = []
        for i in range(10):
            entry_data = TestDataFactory.create_journal_entry_data(user.id, f"composite_entry_{i}")
            entry = JournalEntry(**entry_data)
            entries.append(entry)
        
        db.add_all(entries)
        db.commit()

        # Test composite query (user_id + entry_date) - should benefit from composite index
        from datetime import datetime, timedelta
        start_date = datetime.now() - timedelta(days=1)
        
        start_time = time.time()
        result = db.query(JournalEntry).filter(
            JournalEntry.user_id == user.id,
            JournalEntry.entry_date >= start_date
        ).all()
        composite_query_time = time.time() - start_time

        assert len(result) >= 1
        assert composite_query_time < 0.02, f"Composite index query too slow: {composite_query_time}s"

        # Cleanup
        for entry in entries:
            db.delete(entry)
        db.delete(user)
        db.commit()


class TestConcurrencyPerformance:
    """Test suite for validating performance under concurrent access."""

    def test_concurrent_user_creation(self, db: Session):
        """Test performance when creating users concurrently."""
        import threading
        import queue

        results = queue.Queue()
        errors = queue.Queue()

        def create_user_batch(thread_id):
            try:
                # Create separate session for each thread
                from app.db.session_factory import get_session_factory
                session_factory = get_session_factory()
                local_session = session_factory.create_session()
                
                start_time = time.time()
                
                users = []
                for i in range(5):
                    user_data = TestDataFactory.create_user_data(f"concurrent_user_{thread_id}_{i}")
                    user = User(**user_data)
                    users.append(user)
                
                local_session.add_all(users)
                local_session.commit()
                
                end_time = time.time()
                results.put((thread_id, end_time - start_time, len(users)))
                
                # Cleanup
                for user in users:
                    local_session.delete(user)
                local_session.commit()
                local_session.close()
                
            except Exception as e:
                errors.put((thread_id, str(e)))

        # Create multiple threads
        threads = []
        num_threads = 3
        
        for i in range(num_threads):
            thread = threading.Thread(target=create_user_batch, args=(i,))
            threads.append(thread)
        
        # Start all threads
        start_time = time.time()
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        total_time = time.time() - start_time

        # Check for errors
        assert errors.empty(), f"Errors occurred during concurrent operations: {list(errors.queue)}"

        # Validate performance
        assert total_time < 5.0, f"Concurrent user creation too slow: {total_time}s"
        
        # Validate results
        assert results.qsize() == num_threads, "Not all threads completed successfully"


class TestMemoryUsage:
    """Test suite for validating memory usage with optimized schema."""

    def test_large_dataset_memory_usage(self, db: Session):
        """Test memory usage when working with large datasets."""
        import psutil
        import os

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss

        # Create a moderately large dataset
        users = []
        for i in range(100):
            user_data = TestDataFactory.create_user_data(f"memory_test_user_{i}")
            user = User(**user_data)
            users.append(user)

        db.add_all(users)
        db.commit()

        # Create entries
        entries = []
        for user in users:
            for j in range(10):
                entry_data = TestDataFactory.create_journal_entry_data(user.id, f"memory_entry_{j}")
                entry = JournalEntry(**entry_data)
                entries.append(entry)

        db.add_all(entries)
        db.commit()

        peak_memory = process.memory_info().rss
        memory_increase = peak_memory - initial_memory

        # Memory increase should be reasonable (less than 100MB for this test)
        assert memory_increase < 100 * 1024 * 1024, f"Memory usage too high: {memory_increase / 1024 / 1024:.2f}MB"

        # Cleanup
        db.query(JournalEntry).filter(
            JournalEntry.user_id.in_([u.id for u in users])
        ).delete(synchronize_session=False)
        for user in users:
            db.delete(user)
        db.commit()

        # Memory should be released after cleanup
        final_memory = process.memory_info().rss
        memory_retained = final_memory - initial_memory

        # Some memory retention is normal, but it shouldn't be excessive
        assert memory_retained < 50 * 1024 * 1024, f"Too much memory retained after cleanup: {memory_retained / 1024 / 1024:.2f}MB" 