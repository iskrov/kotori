"""
Performance Testing Utilities for UUID-based Database Operations

This module provides utilities for measuring and analyzing the performance
of database operations with UUID primary keys and indexes.
"""

import time
import statistics
import threading
import uuid
from contextlib import contextmanager
from typing import List, Dict, Any, Callable, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import psycopg2
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag
from app.models.reminder import Reminder
from app.models.secret_tag_opaque import SecretTag


class PerformanceTimer:
    """Context manager for timing operations."""
    
    def __init__(self, description: str = ""):
        self.description = description
        self.start_time = None
        self.end_time = None
        self.duration = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration = self.end_time - self.start_time
    
    def __str__(self):
        return f"{self.description}: {self.duration:.4f}s"


class PerformanceMetrics:
    """Collects and analyzes performance metrics."""
    
    def __init__(self):
        self.measurements: List[float] = []
        self.operation_tag_display_tag_display_name= ""
    
    def add_measurement(self, duration: float):
        """Add a single measurement."""
        self.measurements.append(duration)
    
    def add_measurements(self, durations: List[float]):
        """Add multiple measurements."""
        self.measurements.extend(durations)
    
    @property
    def count(self) -> int:
        return len(self.measurements)
    
    @property
    def total_time(self) -> float:
        return sum(self.measurements)
    
    @property
    def average(self) -> float:
        return statistics.mean(self.measurements) if self.measurements else 0.0
    
    @property
    def median(self) -> float:
        return statistics.median(self.measurements) if self.measurements else 0.0
    
    @property
    def min_time(self) -> float:
        return min(self.measurements) if self.measurements else 0.0
    
    @property
    def max_time(self) -> float:
        return max(self.measurements) if self.measurements else 0.0
    
    @property
    def std_dev(self) -> float:
        return statistics.stdev(self.measurements) if len(self.measurements) > 1 else 0.0
    
    @property
    def percentile_95(self) -> float:
        if not self.measurements:
            return 0.0
        sorted_measurements = sorted(self.measurements)
        index = int(0.95 * len(sorted_measurements))
        return sorted_measurements[index]
    
    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of all metrics."""
        return {
            "count": self.count,
            "total_time": self.total_time,
            "average": self.average,
            "median": self.median,
            "min": self.min_time,
            "max": self.max_time,
            "std_dev": self.std_dev,
            "percentile_95": self.percentile_95
        }
    
    def assert_performance(self, max_average: float, max_percentile_95: float = None):
        """Assert that performance meets requirements."""
        assert self.average <= max_average, f"Average time {self.average:.4f}s exceeds limit {max_average:.4f}s"
        
        if max_percentile_95:
            assert self.percentile_95 <= max_percentile_95, \
                f"95th percentile {self.percentile_95:.4f}s exceeds limit {max_percentile_95:.4f}s"


class DatabasePerformanceTester:
    """Provides database performance testing utilities."""
    
    def __init__(self, db_url: str = None):
        self.db_url = db_url or settings.DATABASE_URL
        self.engine = create_engine(self.db_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
    
    @contextmanager
    def get_session(self):
        """Get a database session."""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    def execute_query(self, query: str, params: Dict[str, Any] = None) -> List[Dict]:
        """Execute a query and return results."""
        with self.get_session() as session:
            result = session.execute(text(query), params or {})
            return [dict(row) for row in result]
    
    def get_query_plan(self, query: str, params: Dict[str, Any] = None) -> List[Dict]:
        """Get the execution plan for a query."""
        explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"
        with self.get_session() as session:
            result = session.execute(text(explain_query), params or {})
            return result.fetchall()
    
    def time_query(self, query: str, params: Dict[str, Any] = None) -> Tuple[float, List[Dict]]:
        """Time a query execution and return duration and results."""
        with PerformanceTimer() as timer:
            results = self.execute_query(query, params)
        return timer.duration, results
    
    def time_multiple_queries(self, query: str, param_list: List[Dict[str, Any]]) -> PerformanceMetrics:
        """Time multiple executions of the same query with different parameters."""
        metrics = PerformanceMetrics()
        
        for params in param_list:
            duration, _ = self.time_query(query, params)
            metrics.add_measurement(duration)
        
        return metrics
    
    def time_concurrent_queries(self, query: str, param_list: List[Dict[str, Any]], 
                               max_workers: int = 10) -> PerformanceMetrics:
        """Time concurrent executions of queries."""
        metrics = PerformanceMetrics()
        
        def execute_single_query(params):
            return self.time_query(query, params)[0]
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(execute_single_query, params) for params in param_list]
            
            for future in as_completed(futures):
                duration = future.result()
                metrics.add_measurement(duration)
        
        return metrics


class TestDataGenerator:
    """Generates test data for performance testing."""
    
    @staticmethod
    def generate_user_data(count: int = 1000) -> List[Dict[str, Any]]:
        """Generate test user data."""
        return [
            {
                "id": uuid.uuid4(),
                "email": f"user{i}@example.com",
                "first_name": f"User{i}",
                "last_name": f"Test{i}",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            for i in range(count)
        ]
    
    @staticmethod
    def generate_journal_data(user_ids: List[uuid.UUID], count: int = 5000) -> List[Dict[str, Any]]:
        """Generate test journal entry data."""
        import random
        
        return [
            {
                "id": uuid.uuid4(),
                "user_id": random.choice(user_ids),
                "title": f"Journal Entry {i}",
                "content": f"This is the content of journal entry {i}. " * 10,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            for i in range(count)
        ]
    
    @staticmethod
    def generate_tag_data(journal_ids: List[uuid.UUID], count: int = 2000) -> List[Dict[str, Any]]:
        """Generate test tag data."""
        import random
        
        return [
            {
                "id": uuid.uuid4(),
                "journal_id": random.choice(journal_ids),
                "name": f"tag_{i}",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            for i in range(count)
        ]
    
    @staticmethod
    def generate_reminder_data(user_ids: List[uuid.UUID], count: int = 1000) -> List[Dict[str, Any]]:
        """Generate test reminder data."""
        import random
        from datetime import timedelta
        
        return [
            {
                "id": uuid.uuid4(),
                "user_id": random.choice(user_ids),
                "title": f"Reminder {i}",
                "description": f"Description for reminder {i}",
                "due_date": datetime.now(timezone.utc) + timedelta(days=random.randint(1, 30)),
                "is_completed": False,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            for i in range(count)
        ]
    
    @staticmethod
    def generate_secret_tag_data(journal_ids: List[uuid.UUID], count: int = 500) -> List[Dict[str, Any]]:
        """Generate test secret tag data."""
        import random
        
        return [
            {
                "id": uuid.uuid4(),
                "journal_id": random.choice(journal_ids),
                "name": f"secret_tag_{i}",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            for i in range(count)
        ]


class PerformanceTestSetup:
    """Setup and teardown utilities for performance tests."""
    
    def __init__(self, db_tester: DatabasePerformanceTester):
        self.db_tester = db_tester
        self.test_data_ids = {
            "users": [],
            "journals": [],
            "tags": [],
            "reminders": [],
            "secret_tags": []
        }
    
    def setup_test_data(self, user_count: int = 1000, journal_count: int = 5000, 
                       tag_count: int = 2000, reminder_count: int = 1000, 
                       secret_tag_count: int = 500):
        """Set up comprehensive test data."""
        print(f"Setting up test data...")
        
        # Generate test data
        user_data = TestDataGenerator.generate_user_data(user_count)
        self.test_data_ids["users"] = [user["id"] for user in user_data]
        
        journal_data = TestDataGenerator.generate_journal_data(
            self.test_data_ids["users"], journal_count
        )
        self.test_data_ids["journals"] = [journal["id"] for journal in journal_data]
        
        tag_data = TestDataGenerator.generate_tag_data(
            self.test_data_ids["journals"], tag_count
        )
        self.test_data_ids["tags"] = [tag["id"] for tag in tag_data]
        
        reminder_data = TestDataGenerator.generate_reminder_data(
            self.test_data_ids["users"], reminder_count
        )
        self.test_data_ids["reminders"] = [reminder["id"] for reminder in reminder_data]
        
        secret_tag_data = TestDataGenerator.generate_secret_tag_data(
            self.test_data_ids["journals"], secret_tag_count
        )
        self.test_data_ids["secret_tags"] = [secret_tag["id"] for secret_tag in secret_tag_data]
        
        # Insert test data
        self._insert_test_data(user_data, journal_data, tag_data, reminder_data, secret_tag_data)
        
        print(f"Test data setup complete:")
        print(f"- Users: {len(self.test_data_ids['users'])}")
        print(f"- Journals: {len(self.test_data_ids['journals'])}")
        print(f"- Tags: {len(self.test_data_ids['tags'])}")
        print(f"- Reminders: {len(self.test_data_ids['reminders'])}")
        print(f"- Secret Tags: {len(self.test_data_ids['secret_tags'])}")
    
    def _insert_test_data(self, user_data, journal_data, tag_data, reminder_data, secret_tag_data):
        """Insert test data into database."""
        with self.db_tester.get_session() as session:
            # Insert users
            for user in user_data:
                session.execute(text("""
                    INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                    VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
                """), user)
            
            # Insert journal entries
            for journal in journal_data:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal)
            
            # Insert tags
            for tag in tag_data:
                session.execute(text("""
                    INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                    VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                """), tag)
            
            # Insert reminders
            for reminder in reminder_data:
                session.execute(text("""
                    INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
                """), reminder)
            
            # Insert secret tags
            for secret_tag in secret_tag_data:
                session.execute(text("""
                    INSERT INTO secret_tags (id, journal_id, name, created_at, updated_at)
                    VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                """), secret_tag)
    
    def cleanup_test_data(self):
        """Clean up test data after tests."""
        with self.db_tester.get_session() as session:
            # Delete in reverse order to handle foreign key constraints
            session.execute(text("DELETE FROM secret_tags WHERE id = ANY(:ids)"), 
                          {"ids": self.test_data_ids["secret_tags"]})
            session.execute(text("DELETE FROM tags WHERE id = ANY(:ids)"), 
                          {"ids": self.test_data_ids["tags"]})
            session.execute(text("DELETE FROM reminders WHERE id = ANY(:ids)"), 
                          {"ids": self.test_data_ids["reminders"]})
            session.execute(text("DELETE FROM journal_entries WHERE id = ANY(:ids)"), 
                          {"ids": self.test_data_ids["journals"]})
            session.execute(text("DELETE FROM users WHERE id = ANY(:ids)"), 
                          {"ids": self.test_data_ids["users"]}) 