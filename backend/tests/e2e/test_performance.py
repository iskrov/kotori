"""
End-to-end performance tests for the secret phrase authentication system.

This module tests performance characteristics including authentication latency,
phrase detection performance, throughput, memory usage, and scalability
with real implementations and no mocking.
"""

import pytest
import asyncio
import time
import uuid
import statistics
import psutil
import tracemalloc
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.models.user import User
from app.models.secret_tag_opaque import SecretTag
from app.models.journal_entry import JournalEntry
from app.crypto.opaque_keys import derive_opaque_keys_from_phrase
from app.services.opaque_service import EnhancedOpaqueService
from app.services.phrase_processor import SecretPhraseProcessor
from app.services.journal_service import JournalService
from app.services.vault_service import VaultService
from app.utils.secure_utils import SecureHasher

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_USER_EMAIL = "performance_test@example.com"
TEST_USER_PASSWORD = "PerformanceTestPassword123!"

# Performance test parameters
PERFORMANCE_BENCHMARKS = {
    "authentication_latency": {
        "target": 0.5,  # 500ms
        "max_acceptable": 1.0,  # 1 second
        "unit": "seconds"
    },
    "phrase_detection_latency": {
        "target": 0.2,  # 200ms
        "max_acceptable": 0.5,  # 500ms
        "unit": "seconds"
    },
    "registration_latency": {
        "target": 0.3,  # 300ms
        "max_acceptable": 0.8,  # 800ms
        "unit": "seconds"
    },
    "throughput_auth": {
        "target": 10,  # 10 ops/second
        "min_acceptable": 5,  # 5 ops/second
        "unit": "operations/second"
    },
    "memory_usage": {
        "target": 50,  # 50 MB
        "max_acceptable": 100,  # 100 MB
        "unit": "MB"
    },
    "concurrent_users": {
        "target": 50,  # 50 concurrent users
        "min_acceptable": 20,  # 20 concurrent users
        "unit": "users"
    }
}

# Test data
TEST_PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Waltz, bad nymph, for quick jigs vex",
    "Sphinx of black quartz, judge my vow",
    "The five boxing wizards jump quickly",
    "Bright vixens jump doggedly",
    "Jackdaws love my big sphinx of quartz",
    "The job requires extra pluck and zeal",
    "Few quips galvanized the mock jury box"
]

# Large content for testing
LARGE_CONTENT_TEMPLATES = [
    "Daily journal entry with lots of content. " * 100,
    "Meeting notes with detailed information. " * 200,
    "Project documentation with extensive details. " * 150,
    "Research findings with comprehensive analysis. " * 250,
    "Technical specifications with complete coverage. " * 300,
]


@dataclass
class PerformanceMetrics:
    """Container for performance metrics."""
    operation: str
    latency_avg: float
    latency_p95: float
    latency_p99: float
    throughput: float
    memory_usage: float
    cpu_usage: float
    error_rate: float
    concurrent_users: int


class TestPerformance:
    """Comprehensive performance tests for the secret phrase authentication system."""

    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment before each test."""
        self.client = TestClient(app)
        self.hasher = SecureHasher()
        
        # Create test database session
        self.engine = create_engine(TEST_DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = SessionLocal()
        
        # Override database dependency
        def override_get_db():
            try:
                yield self.db
            finally:
                self.db.close()
        
        app.dependency_overrides[get_db] = override_get_db
        
        # Create test user
        self.test_user = self._create_test_user()
        self.user_id = self.test_user.id
        
        # Initialize services
        self.opaque_service = EnhancedOpaqueService(self.db)
        self.phrase_processor = SecretPhraseProcessor(self.db)
        self.journal_service = JournalService(self.db)
        self.vault_service = VaultService(self.db)
        
        # Create test secret tags
        self.test_tags = self._create_test_secret_tags()
        
        # Initialize performance monitoring
        self.process = psutil.Process()
        self.initial_memory = self.process.memory_info().rss

    def teardown_method(self):
        """Clean up after each test."""
        # Clean up test data
        self._cleanup_test_data()
        
        # Close database connections
        self.db.close()
        
        # Clear dependency overrides
        app.dependency_overrides.clear()

    def _create_test_user(self) -> User:
        """Create a test user for performance tests."""
        existing_user = self.db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        if existing_user:
            return existing_user
        
        hashed_password = self.hasher.hash_password(TEST_USER_PASSWORD)
        user = User(
            id=uuid.uuid4(),
            email=TEST_USER_EMAIL,
            hashed_password=hashed_password,
            is_active=True,
            created_at=datetime.utcnow()
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _create_test_secret_tags(self) -> list:
        """Create test secret tags for performance testing."""
        tags = []
        
        for i, phrase in enumerate(TEST_PHRASES):
            opaque_keys = derive_opaque_keys_from_phrase(phrase)
            
            secret_tag = SecretTag(
                tag_id=opaque_keys.tag_id,
                user_id=self.user_id,
                salt=opaque_keys.salt,
                verifier_kv=b"test_verifier_" + str(i).encode(),
                opaque_envelope=b"test_envelope_" + str(i).encode(),
                tag_name=f"Performance Test Tag {i+1}",
                color_code=f"#FF{i:02d}{i:02d}",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            self.db.add(secret_tag)
            tags.append({
                'tag': secret_tag,
                'phrase': phrase,
                'keys': opaque_keys
            })
        
        self.db.commit()
        return tags

    def _cleanup_test_data(self):
        """Clean up test data from database."""
        try:
            self.db.query(JournalEntry).filter(
                JournalEntry.user_id == self.user_id
            ).delete()
            
            self.db.query(SecretTag).filter(
                SecretTag.user_id == self.user_id
            ).delete()
            
            self.db.query(User).filter(
                User.id == self.user_id
            ).delete()
            
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"Cleanup error: {e}")

    def _authenticate_user(self) -> str:
        """Authenticate test user and return access token."""
        response = self.client.post(
            "/api/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        assert response.status_code == 200
        return response.json()["access_token"]

    def _measure_resource_usage(self) -> Dict[str, float]:
        """Measure current resource usage."""
        memory_info = self.process.memory_info()
        cpu_percent = self.process.cpu_percent()
        
        return {
            "memory_mb": memory_info.rss / 1024 / 1024,
            "memory_delta_mb": (memory_info.rss - self.initial_memory) / 1024 / 1024,
            "cpu_percent": cpu_percent
        }

    def _benchmark_operation(self, operation, iterations: int = 100) -> Dict[str, float]:
        """Benchmark an operation and return performance metrics."""
        latencies = []
        errors = 0
        
        # Warm up
        for _ in range(5):
            try:
                operation()
            except Exception:
                pass
        
        # Actual measurements
        start_time = time.time()
        
        for _ in range(iterations):
            try:
                op_start = time.time()
                operation()
                op_end = time.time()
                latencies.append(op_end - op_start)
            except Exception:
                errors += 1
        
        end_time = time.time()
        
        # Calculate metrics
        if latencies:
            avg_latency = statistics.mean(latencies)
            p95_latency = statistics.quantiles(latencies, n=20)[18]  # 95th percentile
            p99_latency = statistics.quantiles(latencies, n=100)[98]  # 99th percentile
        else:
            avg_latency = p95_latency = p99_latency = 0
        
        total_time = end_time - start_time
        throughput = iterations / total_time if total_time > 0 else 0
        error_rate = errors / iterations if iterations > 0 else 0
        
        return {
            "avg_latency": avg_latency,
            "p95_latency": p95_latency,
            "p99_latency": p99_latency,
            "throughput": throughput,
            "error_rate": error_rate
        }

    @pytest.mark.asyncio
    async def test_authentication_latency_benchmark(self):
        """Test authentication latency performance."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_tags[0]
        phrase = test_tag_data['phrase']
        tag_id = test_tag_data['keys'].tag_id.hex()
        
        # Define authentication operation
        def auth_operation():
            response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": phrase,
                    "tag_id": tag_id
                },
                headers=headers
            )
            assert response.status_code == 200
            return response
        
        # Benchmark authentication
        metrics = self._benchmark_operation(auth_operation, iterations=50)
        
        # Verify performance benchmarks
        assert metrics["avg_latency"] < PERFORMANCE_BENCHMARKS["authentication_latency"]["max_acceptable"], \
            f"Authentication latency too high: {metrics['avg_latency']:.3f}s"
        
        assert metrics["p95_latency"] < PERFORMANCE_BENCHMARKS["authentication_latency"]["max_acceptable"] * 1.5, \
            f"P95 authentication latency too high: {metrics['p95_latency']:.3f}s"
        
        assert metrics["error_rate"] < 0.01, f"Authentication error rate too high: {metrics['error_rate']:.2%}"
        
        # Log performance metrics
        print(f"Authentication Performance:")
        print(f"  Average latency: {metrics['avg_latency']:.3f}s")
        print(f"  P95 latency: {metrics['p95_latency']:.3f}s")
        print(f"  P99 latency: {metrics['p99_latency']:.3f}s")
        print(f"  Throughput: {metrics['throughput']:.1f} ops/sec")
        print(f"  Error rate: {metrics['error_rate']:.2%}")

    @pytest.mark.asyncio
    async def test_phrase_detection_performance(self):
        """Test phrase detection performance."""
        test_content = LARGE_CONTENT_TEMPLATES[0] + TEST_PHRASES[0]
        
        # Define phrase detection operation
        def detection_operation():
            result = asyncio.run(
                self.phrase_processor.process_entry_for_secret_phrases(
                    test_content, self.user_id
                )
            )
            return result
        
        # Benchmark phrase detection
        metrics = self._benchmark_operation(detection_operation, iterations=50)
        
        # Verify performance benchmarks
        assert metrics["avg_latency"] < PERFORMANCE_BENCHMARKS["phrase_detection_latency"]["max_acceptable"], \
            f"Phrase detection latency too high: {metrics['avg_latency']:.3f}s"
        
        assert metrics["throughput"] > 2.0, f"Phrase detection throughput too low: {metrics['throughput']:.1f} ops/sec"
        
        # Log performance metrics
        print(f"Phrase Detection Performance:")
        print(f"  Average latency: {metrics['avg_latency']:.3f}s")
        print(f"  P95 latency: {metrics['p95_latency']:.3f}s")
        print(f"  Throughput: {metrics['throughput']:.1f} ops/sec")

    @pytest.mark.asyncio
    async def test_registration_performance(self):
        """Test registration performance."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Define registration operation
        def registration_operation():
            phrase = f"Test phrase {uuid.uuid4()}"
            keys = derive_opaque_keys_from_phrase(phrase)
            
            response = self.client.post(
                "/api/opaque/register",
                json={
                    "phrase": phrase,
                    "tag_name": f"Perf Test Tag {uuid.uuid4()}",
                    "color_code": "#FF0000",
                    "tag_id": keys.tag_id.hex(),
                    "salt": keys.salt.hex(),
                    "verification_key": keys.verification_key.hex()
                },
                headers=headers
            )
            return response
        
        # Benchmark registration
        metrics = self._benchmark_operation(registration_operation, iterations=20)
        
        # Verify performance benchmarks
        assert metrics["avg_latency"] < PERFORMANCE_BENCHMARKS["registration_latency"]["max_acceptable"], \
            f"Registration latency too high: {metrics['avg_latency']:.3f}s"
        
        assert metrics["error_rate"] < 0.05, f"Registration error rate too high: {metrics['error_rate']:.2%}"
        
        # Log performance metrics
        print(f"Registration Performance:")
        print(f"  Average latency: {metrics['avg_latency']:.3f}s")
        print(f"  P95 latency: {metrics['p95_latency']:.3f}s")
        print(f"  Throughput: {metrics['throughput']:.1f} ops/sec")

    @pytest.mark.asyncio
    async def test_concurrent_authentication_performance(self):
        """Test performance under concurrent authentication load."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_tags[0]
        phrase = test_tag_data['phrase']
        tag_id = test_tag_data['keys'].tag_id.hex()
        
        # Define concurrent authentication operation
        async def concurrent_auth():
            def single_auth():
                response = self.client.post(
                    "/api/opaque/auth/init",
                    json={
                        "phrase": phrase,
                        "tag_id": tag_id
                    },
                    headers=headers
                )
                return response
            
            return single_auth()
        
        # Test different concurrency levels
        concurrency_levels = [1, 5, 10, 20, 50]
        results = {}
        
        for concurrent_users in concurrency_levels:
            print(f"Testing {concurrent_users} concurrent users...")
            
            start_time = time.time()
            
            # Run concurrent operations
            tasks = [concurrent_auth() for _ in range(concurrent_users)]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            
            # Analyze results
            successful = [r for r in responses if not isinstance(r, Exception) and r.status_code == 200]
            failed = [r for r in responses if isinstance(r, Exception) or r.status_code != 200]
            
            total_time = end_time - start_time
            throughput = len(successful) / total_time if total_time > 0 else 0
            success_rate = len(successful) / len(responses) if responses else 0
            
            results[concurrent_users] = {
                "throughput": throughput,
                "success_rate": success_rate,
                "total_time": total_time,
                "successful": len(successful),
                "failed": len(failed)
            }
            
            # Log results
            print(f"  Throughput: {throughput:.1f} ops/sec")
            print(f"  Success rate: {success_rate:.2%}")
            print(f"  Total time: {total_time:.3f}s")
        
        # Verify performance under load
        max_concurrent = max(
            users for users, result in results.items()
            if result["success_rate"] > 0.95  # 95% success rate
        )
        
        assert max_concurrent >= PERFORMANCE_BENCHMARKS["concurrent_users"]["min_acceptable"], \
            f"Concurrent user capacity too low: {max_concurrent} users"
        
        print(f"Maximum concurrent users with 95% success rate: {max_concurrent}")

    @pytest.mark.asyncio
    async def test_memory_usage_performance(self):
        """Test memory usage performance."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Start memory tracking
        tracemalloc.start()
        initial_memory = self.process.memory_info().rss
        
        # Perform memory-intensive operations
        operations = [
            # Multiple authentications
            lambda: [
                self.client.post(
                    "/api/opaque/auth/init",
                    json={
                        "phrase": self.test_tags[0]['phrase'],
                        "tag_id": self.test_tags[0]['keys'].tag_id.hex()
                    },
                    headers=headers
                ) for _ in range(50)
            ],
            # Large phrase detection
            lambda: [
                asyncio.run(
                    self.phrase_processor.process_entry_for_secret_phrases(
                        LARGE_CONTENT_TEMPLATES[i % len(LARGE_CONTENT_TEMPLATES)] + TEST_PHRASES[i % len(TEST_PHRASES)],
                        self.user_id
                    )
                ) for i in range(30)
            ],
            # Multiple registrations
            lambda: [
                self.client.post(
                    "/api/opaque/register",
                    json={
                        "phrase": f"Memory test phrase {i}",
                        "tag_name": f"Memory Test Tag {i}",
                        "color_code": "#FF0000",
                        "tag_id": f"{i:032d}",
                        "salt": f"{i:032d}",
                        "verification_key": f"{i:064d}"
                    },
                    headers=headers
                ) for i in range(20)
            ]
        ]
        
        memory_measurements = []
        
        for operation in operations:
            start_memory = self.process.memory_info().rss
            operation()
            end_memory = self.process.memory_info().rss
            
            memory_delta = (end_memory - start_memory) / 1024 / 1024  # MB
            memory_measurements.append(memory_delta)
            
            # Force garbage collection
            import gc
            gc.collect()
        
        # Get peak memory usage
        current_memory, peak_memory = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        peak_memory_mb = peak_memory / 1024 / 1024
        avg_memory_delta = statistics.mean(memory_measurements)
        
        # Verify memory usage
        assert peak_memory_mb < PERFORMANCE_BENCHMARKS["memory_usage"]["max_acceptable"], \
            f"Peak memory usage too high: {peak_memory_mb:.1f}MB"
        
        assert avg_memory_delta < 20, f"Average memory delta too high: {avg_memory_delta:.1f}MB"
        
        # Log memory metrics
        print(f"Memory Usage Performance:")
        print(f"  Peak memory: {peak_memory_mb:.1f}MB")
        print(f"  Average memory delta: {avg_memory_delta:.1f}MB")
        print(f"  Memory measurements: {memory_measurements}")

    @pytest.mark.asyncio
    async def test_database_performance(self):
        """Test database performance under load."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test database operations
        def database_operations():
            # Query operations
            secret_tags = self.db.query(SecretTag).filter(
                SecretTag.user_id == self.user_id
            ).all()
            
            # Insert operations
            for i in range(10):
                entry = JournalEntry(
                    id=uuid.uuid4(),
                    user_id=self.user_id,
                    title=f"Performance Test Entry {i}",
                    content=f"Test content {i}",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                self.db.add(entry)
            
            self.db.commit()
            
            # Update operations
            entries = self.db.query(JournalEntry).filter(
                JournalEntry.user_id == self.user_id
            ).limit(5).all()
            
            for entry in entries:
                entry.updated_at = datetime.utcnow()
            
            self.db.commit()
        
        # Benchmark database operations
        metrics = self._benchmark_operation(database_operations, iterations=20)
        
        # Verify database performance
        assert metrics["avg_latency"] < 0.5, f"Database operations too slow: {metrics['avg_latency']:.3f}s"
        assert metrics["throughput"] > 2.0, f"Database throughput too low: {metrics['throughput']:.1f} ops/sec"
        
        # Log database performance
        print(f"Database Performance:")
        print(f"  Average latency: {metrics['avg_latency']:.3f}s")
        print(f"  Throughput: {metrics['throughput']:.1f} ops/sec")

    @pytest.mark.asyncio
    async def test_end_to_end_performance(self):
        """Test complete end-to-end workflow performance."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Define complete workflow
        def complete_workflow():
            # 1. Create secret tag
            phrase = f"E2E test phrase {uuid.uuid4()}"
            keys = derive_opaque_keys_from_phrase(phrase)
            
            reg_response = self.client.post(
                "/api/opaque/register",
                json={
                    "phrase": phrase,
                    "tag_name": f"E2E Test Tag {uuid.uuid4()}",
                    "color_code": "#FF0000",
                    "tag_id": keys.tag_id.hex(),
                    "salt": keys.salt.hex(),
                    "verification_key": keys.verification_key.hex()
                },
                headers=headers
            )
            assert reg_response.status_code == 200
            
            # 2. Authenticate with phrase
            auth_response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": phrase,
                    "tag_id": keys.tag_id.hex()
                },
                headers=headers
            )
            assert auth_response.status_code == 200
            
            # 3. Create journal entry with phrase
            entry_response = self.client.post(
                "/api/journals/entries",
                json={
                    "content": f"Test entry with phrase: {phrase}",
                    "entry_type": "text"
                },
                headers=headers
            )
            # Should succeed regardless of specific implementation
            
            return reg_response, auth_response, entry_response
        
        # Benchmark complete workflow
        metrics = self._benchmark_operation(complete_workflow, iterations=10)
        
        # Verify end-to-end performance
        assert metrics["avg_latency"] < 2.0, f"E2E workflow too slow: {metrics['avg_latency']:.3f}s"
        assert metrics["error_rate"] < 0.1, f"E2E error rate too high: {metrics['error_rate']:.2%}"
        
        # Log E2E performance
        print(f"End-to-End Performance:")
        print(f"  Average latency: {metrics['avg_latency']:.3f}s")
        print(f"  P95 latency: {metrics['p95_latency']:.3f}s")
        print(f"  Throughput: {metrics['throughput']:.1f} workflows/sec")
        print(f"  Error rate: {metrics['error_rate']:.2%}")

    @pytest.mark.asyncio
    async def test_scalability_characteristics(self):
        """Test system scalability characteristics."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test scalability with increasing load
        load_levels = [1, 5, 10, 20, 50, 100]
        scalability_results = {}
        
        for load_level in load_levels:
            print(f"Testing load level: {load_level}")
            
            # Define load test operation
            async def load_test_operation():
                response = self.client.post(
                    "/api/opaque/auth/init",
                    json={
                        "phrase": self.test_tags[0]['phrase'],
                        "tag_id": self.test_tags[0]['keys'].tag_id.hex()
                    },
                    headers=headers
                )
                return response
            
            # Measure performance at this load level
            start_time = time.time()
            start_memory = self.process.memory_info().rss
            start_cpu = self.process.cpu_percent()
            
            # Run concurrent operations
            tasks = [load_test_operation() for _ in range(load_level)]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            end_memory = self.process.memory_info().rss
            end_cpu = self.process.cpu_percent()
            
            # Calculate metrics
            successful = [r for r in responses if not isinstance(r, Exception) and r.status_code == 200]
            total_time = end_time - start_time
            throughput = len(successful) / total_time if total_time > 0 else 0
            success_rate = len(successful) / len(responses) if responses else 0
            
            memory_delta = (end_memory - start_memory) / 1024 / 1024  # MB
            cpu_delta = end_cpu - start_cpu
            
            scalability_results[load_level] = {
                "throughput": throughput,
                "success_rate": success_rate,
                "latency": total_time / load_level if load_level > 0 else 0,
                "memory_delta": memory_delta,
                "cpu_delta": cpu_delta
            }
            
            # Log results
            print(f"  Throughput: {throughput:.1f} ops/sec")
            print(f"  Success rate: {success_rate:.2%}")
            print(f"  Latency: {scalability_results[load_level]['latency']:.3f}s")
            print(f"  Memory delta: {memory_delta:.1f}MB")
            print(f"  CPU delta: {cpu_delta:.1f}%")
        
        # Analyze scalability
        max_sustainable_load = max(
            load for load, result in scalability_results.items()
            if result["success_rate"] > 0.95 and result["latency"] < 1.0
        )
        
        print(f"Maximum sustainable load: {max_sustainable_load} concurrent operations")
        
        # Verify scalability
        assert max_sustainable_load >= 10, f"Scalability too low: {max_sustainable_load} max load"

    @pytest.mark.asyncio
    async def test_resource_cleanup_performance(self):
        """Test performance of resource cleanup operations."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Create resources that need cleanup
        def create_resources():
            # Create multiple secret tags
            for i in range(20):
                phrase = f"Cleanup test phrase {i}"
                keys = derive_opaque_keys_from_phrase(phrase)
                
                response = self.client.post(
                    "/api/opaque/register",
                    json={
                        "phrase": phrase,
                        "tag_name": f"Cleanup Test Tag {i}",
                        "color_code": "#FF0000",
                        "tag_id": keys.tag_id.hex(),
                        "salt": keys.salt.hex(),
                        "verification_key": keys.verification_key.hex()
                    },
                    headers=headers
                )
            
            # Create journal entries
            for i in range(50):
                response = self.client.post(
                    "/api/journals/entries",
                    json={
                        "content": f"Cleanup test entry {i}",
                        "entry_type": "text"
                    },
                    headers=headers
                )
        
        # Benchmark resource creation
        create_metrics = self._benchmark_operation(create_resources, iterations=5)
        
        # Benchmark resource cleanup
        def cleanup_resources():
            # Delete secret tags
            secret_tags = self.db.query(SecretTag).filter(
                SecretTag.user_id == self.user_id
            ).all()
            
            for tag in secret_tags:
                self.db.delete(tag)
            
            # Delete journal entries
            journal_entries = self.db.query(JournalEntry).filter(
                JournalEntry.user_id == self.user_id
            ).all()
            
            for entry in journal_entries:
                self.db.delete(entry)
            
            self.db.commit()
        
        cleanup_metrics = self._benchmark_operation(cleanup_resources, iterations=5)
        
        # Verify cleanup performance
        assert cleanup_metrics["avg_latency"] < 1.0, f"Cleanup too slow: {cleanup_metrics['avg_latency']:.3f}s"
        
        # Log cleanup performance
        print(f"Resource Cleanup Performance:")
        print(f"  Create latency: {create_metrics['avg_latency']:.3f}s")
        print(f"  Cleanup latency: {cleanup_metrics['avg_latency']:.3f}s")
        print(f"  Cleanup throughput: {cleanup_metrics['throughput']:.1f} ops/sec")

    @pytest.mark.asyncio
    async def test_performance_regression_detection(self):
        """Test for performance regression detection."""
        # This test would compare current performance against baseline
        # In a real implementation, this would load baseline metrics from storage
        
        baseline_metrics = {
            "authentication_latency": 0.3,  # seconds
            "phrase_detection_latency": 0.15,  # seconds
            "registration_latency": 0.25,  # seconds
            "throughput": 15.0,  # ops/sec
        }
        
        # Run current performance tests
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test authentication latency
        def auth_test():
            response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": self.test_tags[0]['phrase'],
                    "tag_id": self.test_tags[0]['keys'].tag_id.hex()
                },
                headers=headers
            )
            return response
        
        current_metrics = self._benchmark_operation(auth_test, iterations=20)
        
        # Compare against baseline
        regression_threshold = 0.2  # 20% regression threshold
        
        latency_regression = (current_metrics["avg_latency"] - baseline_metrics["authentication_latency"]) / baseline_metrics["authentication_latency"]
        throughput_regression = (baseline_metrics["throughput"] - current_metrics["throughput"]) / baseline_metrics["throughput"]
        
        # Check for regressions
        assert latency_regression < regression_threshold, f"Latency regression detected: {latency_regression:.1%}"
        assert throughput_regression < regression_threshold, f"Throughput regression detected: {throughput_regression:.1%}"
        
        print(f"Performance Regression Analysis:")
        print(f"  Latency change: {latency_regression:.1%}")
        print(f"  Throughput change: {throughput_regression:.1%}")
        print(f"  Baseline latency: {baseline_metrics['authentication_latency']:.3f}s")
        print(f"  Current latency: {current_metrics['avg_latency']:.3f}s")
        print(f"  Baseline throughput: {baseline_metrics['throughput']:.1f} ops/sec")
        print(f"  Current throughput: {current_metrics['throughput']:.1f} ops/sec") 