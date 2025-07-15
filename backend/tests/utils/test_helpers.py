"""
Test Helper Utilities

This module provides comprehensive test helper utilities for common test functionality
including database setup, user creation, test data generation, performance monitoring,
and security validation utilities.
"""

import uuid
import secrets
import time
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union, Callable
from contextlib import contextmanager
from dataclasses import dataclass
from unittest.mock import Mock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from app.models.user import User
from app.models.secret_tag_opaque import SecretTag, OpaqueSession, VaultBlob, WrappedKey
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag
from app.utils.secure_utils import SecureHasher, SecureTokenGenerator
from app.crypto.aes_gcm import AESGCMCrypto
from app.security.constant_time import ConstantTimeOperations
from app.security.memory_protection import SecureMemoryManager

# Test configuration constants
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
DEFAULT_TEST_PASSWORD = "TestPassword123!"
DEFAULT_PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Waltz, bad nymph, for quick jigs vex",
    "Sphinx of black quartz, judge my vow"
]


@dataclass
class TestUserData:
    """Container for test user data."""
    user: User
    email: str
    password: str
    full_name: str
    secret_tags: List[SecretTag]
    journal_entries: List[JournalEntry]
    vault_blobs: List[VaultBlob]


@dataclass
class PerformanceMetrics:
    """Container for performance test metrics."""
    operation_name: str
    start_time: float
    end_time: float
    duration: float
    memory_before: int
    memory_after: int
    memory_delta: int
    success: bool
    error_message: Optional[str] = None


class DatabaseTestHelper:
    """Helper class for database operations in tests."""
    
    def __init__(self, db_url: str = TEST_DATABASE_URL):
        self.db_url = db_url
        self.engine = create_engine(db_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
    def get_session(self) -> Session:
        """Get a database session for testing."""
        return self.SessionLocal()
    
    def create_test_database(self, db_name: str = "vibes_test"):
        """Create a test database."""
        # Connect to postgres database to create test database
        postgres_url = self.db_url.replace(f"/{db_name}", "/postgres")
        engine = create_engine(postgres_url)
        
        with engine.connect() as conn:
            conn.execute(text(f"DROP DATABASE IF EXISTS {db_name}"))
            conn.execute(text(f"CREATE DATABASE {db_name}"))
    
    def drop_test_database(self, db_name: str = "vibes_test"):
        """Drop a test database."""
        postgres_url = self.db_url.replace(f"/{db_name}", "/postgres")
        engine = create_engine(postgres_url)
        
        with engine.connect() as conn:
            conn.execute(text(f"DROP DATABASE IF EXISTS {db_name}"))
    
    def clean_all_tables(self, db: Session):
        """Clean all tables in the database."""
        try:
            # Delete in reverse dependency order
            db.query(OpaqueSession).delete()
            db.query(VaultBlob).delete()
            db.query(WrappedKey).delete()
            db.query(JournalEntry).delete()
            db.query(SecretTag).delete()
            db.query(Tag).delete()
            db.query(User).delete()
            db.commit()
        except Exception as e:
            db.rollback()
            raise e
    
    def get_table_count(self, db: Session, table_name: str) -> int:
        """Get the count of records in a table."""
        result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        return result.scalar()


class UserTestHelper:
    """Helper class for user-related test operations."""
    
    def __init__(self, db: Session):
        self.db = db
        self.hasher = SecureHasher()
        self.token_generator = SecureTokenGenerator()
    
    def create_test_user(
        self,
        email: str = "test@example.com",
        password: str = DEFAULT_TEST_PASSWORD,
        full_name: str = "Test User"
    ) -> User:
        """Create a test user."""
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            hashed_password=self.hasher.hash_password(password),
            full_name=full_name,
            created_at=datetime.utcnow()
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def create_multiple_users(self, count: int) -> List[User]:
        """Create multiple test users."""
        users = []
        for i in range(count):
            user = self.create_test_user(
                email=f"test_user_{i}@example.com",
                password=f"TestPassword{i}!",
                full_name=f"Test User {i}"
            )
            users.append(user)
        return users
    
    def create_user_with_secret_tags(
        self,
        email: str = "test@example.com",
        password: str = DEFAULT_TEST_PASSWORD,
        phrases: List[str] = None
    ) -> TestUserData:
        """Create a user with secret tags."""
        if phrases is None:
            phrases = DEFAULT_PHRASES
        
        user = self.create_test_user(email, password)
        secret_tags = []
        
        for i, phrase in enumerate(phrases):
            tag = SecretTag(
                id=str(uuid.uuid4()),
                name=f"test_tag_{i}",
                user_id=user.id,
                phrase_hash=self.hasher.hash_password(phrase),
                created_at=datetime.utcnow(),
                is_active=True
            )
            self.db.add(tag)
            secret_tags.append(tag)
        
        self.db.commit()
        
        return TestUserData(
            user=user,
            email=email,
            password=password,
            full_name=user.full_name,
            secret_tags=secret_tags,
            journal_entries=[],
            vault_blobs=[]
        )


class SecretTagTestHelper:
    """Helper class for secret tag test operations."""
    
    def __init__(self, db: Session):
        self.db = db
        self.hasher = SecureHasher()
    
    def create_secret_tag(
        self,
        user_id: str,
        name: str,
        phrase: str,
        is_active: bool = True
    ) -> SecretTag:
        """Create a secret tag."""
        tag = SecretTag(
            id=str(uuid.uuid4()),
            name=name,
            user_id=user_id,
            phrase_hash=self.hasher.hash_password(phrase),
            created_at=datetime.utcnow(),
            is_active=is_active
        )
        self.db.add(tag)
        self.db.commit()
        self.db.refresh(tag)
        return tag
    
    def create_multiple_secret_tags(
        self,
        user_id: str,
        count: int,
        phrases: List[str] = None
    ) -> List[SecretTag]:
        """Create multiple secret tags."""
        if phrases is None:
            phrases = DEFAULT_PHRASES
        
        tags = []
        for i in range(count):
            phrase = phrases[i % len(phrases)]
            tag = self.create_secret_tag(
                user_id=user_id,
                name=f"test_tag_{i}",
                phrase=phrase
            )
            tags.append(tag)
        
        return tags


class JournalEntryTestHelper:
    """Helper class for journal entry test operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_journal_entry(
        self,
        user_id: str,
        content: str,
        is_encrypted: bool = False,
        secret_tag_id: Optional[str] = None
    ) -> JournalEntry:
        """Create a journal entry."""
        entry = JournalEntry(
            id=str(uuid.uuid4()),
            user_id=user_id,
            content=content,
            is_encrypted=is_encrypted,
            secret_tag_id=secret_tag_id,
            created_at=datetime.utcnow()
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry
    
    def create_multiple_entries(
        self,
        user_id: str,
        count: int,
        content_prefix: str = "Test entry"
    ) -> List[JournalEntry]:
        """Create multiple journal entries."""
        entries = []
        for i in range(count):
            entry = self.create_journal_entry(
                user_id=user_id,
                content=f"{content_prefix} {i}"
            )
            entries.append(entry)
        
        return entries
    
    def create_encrypted_entry(
        self,
        user_id: str,
        content: str,
        secret_tag_id: str
    ) -> JournalEntry:
        """Create an encrypted journal entry."""
        return self.create_journal_entry(
            user_id=user_id,
            content=content,
            is_encrypted=True,
            secret_tag_id=secret_tag_id
        )


class VaultTestHelper:
    """Helper class for vault test operations."""
    
    def __init__(self, db: Session):
        self.db = db
        self.aes_crypto = AESGCMCrypto()
    
    def create_vault_blob(
        self,
        user_id: str,
        content: Union[str, bytes],
        content_type: str = "text/plain",
        vault_key: Optional[bytes] = None
    ) -> VaultBlob:
        """Create a vault blob."""
        if vault_key is None:
            vault_key = secrets.token_bytes(32)
        
        if isinstance(content, str):
            content = content.encode()
        
        encrypted_content = self.aes_crypto.encrypt(content, vault_key)
        
        blob = VaultBlob(
            id=str(uuid.uuid4()),
            user_id=user_id,
            content_type=content_type,
            encrypted_content=encrypted_content,
            created_at=datetime.utcnow()
        )
        self.db.add(blob)
        self.db.commit()
        self.db.refresh(blob)
        return blob
    
    def create_wrapped_key(
        self,
        user_id: str,
        key_type: str = "vault",
        key_data: Optional[bytes] = None
    ) -> WrappedKey:
        """Create a wrapped key."""
        if key_data is None:
            key_data = secrets.token_bytes(32)
        
        wrapped_key = WrappedKey(
            id=str(uuid.uuid4()),
            user_id=user_id,
            key_type=key_type,
            wrapped_key=key_data,
            created_at=datetime.utcnow()
        )
        self.db.add(wrapped_key)
        self.db.commit()
        self.db.refresh(wrapped_key)
        return wrapped_key


class PerformanceTestHelper:
    """Helper class for performance testing."""
    
    def __init__(self):
        self.memory_manager = SecureMemoryManager()
    
    @contextmanager
    def measure_performance(self, operation_name: str):
        """Context manager for measuring performance."""
        import psutil
        process = psutil.Process()
        
        memory_before = process.memory_info().rss
        start_time = time.time()
        success = True
        error_message = None
        
        try:
            yield
        except Exception as e:
            success = False
            error_message = str(e)
            raise
        finally:
            end_time = time.time()
            memory_after = process.memory_info().rss
            
            metrics = PerformanceMetrics(
                operation_name=operation_name,
                start_time=start_time,
                end_time=end_time,
                duration=end_time - start_time,
                memory_before=memory_before,
                memory_after=memory_after,
                memory_delta=memory_after - memory_before,
                success=success,
                error_message=error_message
            )
            
            # Store metrics for analysis
            self._store_metrics(metrics)
    
    def _store_metrics(self, metrics: PerformanceMetrics):
        """Store performance metrics for analysis."""
        # In a real implementation, this would store metrics in a database
        # or metrics system for analysis
        pass
    
    def benchmark_function(
        self,
        func: Callable,
        args: tuple = (),
        kwargs: dict = None,
        iterations: int = 1
    ) -> List[float]:
        """Benchmark a function over multiple iterations."""
        if kwargs is None:
            kwargs = {}
        
        times = []
        for _ in range(iterations):
            start_time = time.time()
            func(*args, **kwargs)
            end_time = time.time()
            times.append(end_time - start_time)
        
        return times


class SecurityTestHelper:
    """Helper class for security testing."""
    
    def __init__(self):
        self.constant_time = ConstantTimeOperations()
        self.memory_manager = SecureMemoryManager()
    
    def test_constant_time_operation(
        self,
        operation: Callable,
        test_inputs: List[Any],
        tolerance: float = 0.1
    ) -> bool:
        """Test if an operation runs in constant time."""
        times = []
        
        for input_data in test_inputs:
            start_time = time.time()
            operation(input_data)
            end_time = time.time()
            times.append(end_time - start_time)
        
        # Calculate coefficient of variation
        import statistics
        mean_time = statistics.mean(times)
        std_time = statistics.stdev(times)
        cv = std_time / mean_time if mean_time > 0 else 0
        
        return cv < tolerance
    
    def test_memory_protection(self, operation: Callable) -> bool:
        """Test if an operation properly protects memory."""
        with self.memory_manager.secure_context():
            try:
                operation()
                return True
            except Exception:
                return False
    
    def generate_timing_attack_inputs(self, base_input: str, count: int = 100) -> List[str]:
        """Generate inputs for timing attack testing."""
        inputs = [base_input]
        
        for i in range(count - 1):
            # Create variations of the input
            variation = base_input + str(i)
            inputs.append(variation)
        
        return inputs


class TestDataGenerator:
    """Helper class for generating test data."""
    
    def __init__(self):
        self.hasher = SecureHasher()
    
    def generate_phrases(self, count: int) -> List[str]:
        """Generate test phrases."""
        base_phrases = [
            "The quick brown fox jumps over the lazy dog",
            "Pack my box with five dozen liquor jugs",
            "How vexingly quick daft zebras jump",
            "Waltz, bad nymph, for quick jigs vex",
            "Sphinx of black quartz, judge my vow"
        ]
        
        phrases = []
        for i in range(count):
            if i < len(base_phrases):
                phrases.append(base_phrases[i])
            else:
                phrases.append(f"Generated test phrase number {i}")
        
        return phrases
    
    def generate_journal_entries(self, count: int) -> List[str]:
        """Generate test journal entries."""
        entries = []
        for i in range(count):
            entries.append(f"Test journal entry number {i} with some content")
        
        return entries
    
    def generate_user_data(self, count: int) -> List[Dict[str, str]]:
        """Generate test user data."""
        users = []
        for i in range(count):
            users.append({
                "email": f"test_user_{i}@example.com",
                "password": f"TestPassword{i}!",
                "name": f"Test User {i}"
            })
        
        return users
    
    def generate_random_content(self, size_bytes: int) -> bytes:
        """Generate random content of specified size."""
        return secrets.token_bytes(size_bytes)


class MockServiceHelper:
    """Helper class for creating mock services."""
    
    def create_mock_opaque_service(self) -> Mock:
        """Create a mock OPAQUE service."""
        mock_service = Mock()
        mock_service.register_secret_tag.return_value = {"success": True}
        mock_service.authenticate_init.return_value = {"challenge": "mock_challenge"}
        mock_service.authenticate_finalize.return_value = {"success": True, "session_token": "mock_token"}
        return mock_service
    
    def create_mock_vault_service(self) -> Mock:
        """Create a mock vault service."""
        mock_service = Mock()
        mock_service.upload_blob.return_value = {"blob_id": str(uuid.uuid4())}
        mock_service.download_blob.return_value = {"content": b"mock_content"}
        mock_service.list_blobs.return_value = []
        mock_service.delete_blob.return_value = {"success": True}
        return mock_service
    
    def create_mock_audit_service(self) -> Mock:
        """Create a mock audit service."""
        mock_service = Mock()
        mock_service.log_security_event.return_value = None
        mock_service.get_service_health.return_value = {"status": "healthy"}
        return mock_service


class TestAssertionHelper:
    """Helper class for common test assertions."""
    
    @staticmethod
    def assert_uuid_format(value: str):
        """Assert that a value is a valid UUID."""
        try:
            uuid.UUID(value)
        except ValueError:
            pytest.fail(f"'{value}' is not a valid UUID")
    
    @staticmethod
    def assert_datetime_recent(dt: datetime, tolerance_seconds: int = 60):
        """Assert that a datetime is recent (within tolerance)."""
        now = datetime.utcnow()
        diff = abs((now - dt).total_seconds())
        assert diff <= tolerance_seconds, f"DateTime {dt} is not recent (diff: {diff}s)"
    
    @staticmethod
    def assert_encrypted_content(content: bytes):
        """Assert that content appears to be encrypted."""
        # Basic checks for encrypted content
        assert isinstance(content, bytes)
        assert len(content) > 0
        # Should not be readable as ASCII
        try:
            content.decode('ascii')
            pytest.fail("Content appears to be unencrypted (readable as ASCII)")
        except UnicodeDecodeError:
            pass  # Expected for encrypted content
    
    @staticmethod
    def assert_performance_within_limits(duration: float, max_seconds: float):
        """Assert that performance is within acceptable limits."""
        assert duration <= max_seconds, f"Operation took {duration:.3f}s, expected <= {max_seconds}s"
    
    @staticmethod
    def assert_memory_usage_reasonable(memory_delta: int, max_bytes: int):
        """Assert that memory usage is reasonable."""
        assert memory_delta <= max_bytes, f"Memory usage {memory_delta} bytes exceeds limit {max_bytes}"


# Convenience functions
def create_test_user(db: Session, email: str = "test@example.com") -> User:
    """Convenience function to create a test user."""
    helper = UserTestHelper(db)
    return helper.create_test_user(email)


def create_test_secret_tag(db: Session, user_id: str, phrase: str) -> SecretTag:
    """Convenience function to create a test secret tag."""
    helper = SecretTagTestHelper(db)
    return helper.create_secret_tag(user_id, "test_tag", phrase)


def measure_performance(operation_name: str):
    """Convenience decorator for measuring performance."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            helper = PerformanceTestHelper()
            with helper.measure_performance(operation_name):
                return func(*args, **kwargs)
        return wrapper
    return decorator


def cleanup_test_data(db: Session):
    """Convenience function to clean up test data."""
    helper = DatabaseTestHelper()
    helper.clean_all_tables(db) 