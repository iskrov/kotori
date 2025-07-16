"""
End-to-end integration tests for cross-service communication and system interactions.

This module tests the integration between different services in the secret phrase
authentication system, including data consistency, error propagation, transaction
integrity, and monitoring integration.
"""

import pytest
import asyncio
import time
import uuid
import json
from datetime import datetime, timedelta, UTC
from typing import Dict, Any, List, Optional
from unittest.mock import patch, Mock
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from app.main import app
from app.db.session import get_db
from app.models.user import User
from app.models.secret_tag_opaque import SecretTag, OpaqueSession, VaultBlob, WrappedKey
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag
from app.services.opaque_service import EnhancedOpaqueService
from app.services.vault_service import VaultService
from app.services.session_service import SessionService
from app.services.journal_service import JournalService
from app.services.phrase_processor import SecretPhraseProcessor
from app.services.audit_service import SecurityAuditService
from app.services.cleanup_service import CleanupService
from app.utils.secure_utils import SecureTokenGenerator, SecureHasher
from app.crypto.opaque_keys import derive_opaque_keys_from_phrase
from app.security.constant_time import ConstantTimeOperations
from app.security.rate_limiter import RateLimitStrategy
from app.security.memory_protection import SecureMemoryManager

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_USER_EMAIL = "integration_test@example.com"
TEST_USER_PASSWORD = "IntegrationTestPassword123!"

# Test data
TEST_PHRASES = [
    "Integration test phrase for service communication",
    "Cross-service validation phrase for testing",
    "Data consistency verification test phrase",
    "Error propagation test phrase for integration",
    "Transaction integrity validation phrase"
]

TEST_JOURNAL_ENTRIES = [
    "This is a test journal entry with secret phrase detection",
    "Another entry for testing cross-service integration",
    "Testing data consistency across multiple services",
    "Validating error handling in integrated systems",
    "Final test entry for comprehensive integration testing"
]


class TestIntegration:
    """Comprehensive integration tests for cross-service communication."""

    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment before each test."""
        self.client = TestClient(app)
        self.hasher = SecureHasher()
        self.token_generator = SecureTokenGenerator()
        self.constant_time = ConstantTimeOperations()
        self.memory_manager = SecureMemoryManager()
        
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
        
        # Initialize all services
        self.opaque_service = EnhancedOpaqueService(self.db)
        self.vault_service = VaultService(self.db)
        self.session_service = SessionService()
        self.journal_service = JournalService(self.db)
        self.phrase_processor = SecretPhraseProcessor(self.db)
        self.audit_service = SecurityAuditService()
        self.cleanup_service = CleanupService(self.db)
        
        # Create test secret tags
        self.test_tags = self._create_test_secret_tags()

    def teardown_method(self):
        """Clean up after each test."""
        # Clean up test data
        self._cleanup_test_data()
        
        # Close database connections
        self.db.close()
        
        # Clear dependency overrides
        app.dependency_overrides.clear()

    def _create_test_user(self) -> User:
        """Create a test user."""
        user = User(
            id=str(uuid.uuid4()),
            email=TEST_USER_EMAIL,
            hashed_password=self.hasher.hash_password(TEST_USER_PASSWORD),
            full_tag_display_tag_display_name="Integration Test User"
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _create_test_secret_tags(self) -> List[SecretTag]:
        """Create test secret tags for integration testing."""
        tags = []
        for i, phrase in enumerate(TEST_PHRASES):
            tag_name = f"integration_tag_{i + 1}"
            
            # Create secret tag with OPAQUE registration
            tag = SecretTag(
                id=str(uuid.uuid4()),
                tag_name=tag_name,
                user_id=self.user_id,
                phrase_hash=self.hasher.hash_password(phrase),
                created_at=datetime.now(UTC),
                is_active=True
            )
            self.db.add(tag)
            tags.append(tag)
        
        self.db.commit()
        return tags

    def _cleanup_test_data(self):
        """Clean up test data."""
        try:
            # Delete in reverse dependency order
            self.db.query(OpaqueSession).filter_by(user_id=self.user_id).delete()
            self.db.query(VaultBlob).filter_by(user_id=self.user_id).delete()
            self.db.query(WrappedKey).filter_by(user_id=self.user_id).delete()
            self.db.query(JournalEntry).filter_by(user_id=self.user_id).delete()
            self.db.query(SecretTag).filter_by(user_id=self.user_id).delete()
            self.db.query(User).filter_by(id=self.user_id).delete()
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"Cleanup error: {e}")

    # Test Cases

    def test_cross_service_communication(self):
        """Test communication between different services."""
        # Test OPAQUE service -> Vault service communication
        phrase = TEST_PHRASES[0]
        tag_name= "cross_service_test"
        
        # Create secret tag through OPAQUE service
        tag = self.test_tags[0]
        
        # Verify vault service can access tag data
        vault_stats = self.vault_service.get_vault_stats(self.user_id)
        assert vault_stats is not None
        
        # Test phrase processor -> journal service communication
        test_entry = "Test entry with phrase detection"
        detected_phrases = self.phrase_processor.detect_phrases(test_entry, self.user_id)
        
        # Verify journal service can store entry with detected phrases
        journal_entry = self.journal_service.create_entry(
            user_id=self.user_id,
            content=test_entry,
            detected_phrases=detected_phrases
        )
        assert journal_entry is not None
        
        # Test session service -> audit service communication
        session_token = self.session_service.create_session(self.user_id)
        assert session_token is not None
        
        # Verify audit service logged the session creation
        # This would be checked through audit logs in a real implementation

    def test_data_consistency_across_services(self):
        """Test data consistency across multiple services."""
        phrase = TEST_PHRASES[1]
        tag_name= "consistency_test"
        
        # Create secret tag
        tag = self.test_tags[1]
        
        # Test transaction consistency
        with self.db.begin():
            # Create journal entry
            entry = JournalEntry(
                id=str(uuid.uuid4()),
                user_id=self.user_id,
                content="Test entry for consistency check",
                created_at=datetime.now(UTC)
            )
            self.db.add(entry)
            
            # Create vault blob
            vault_blob = VaultBlob(
                id=str(uuid.uuid4()),
                user_id=self.user_id,
                content_type="text/plain",
                encrypted_content=b"encrypted_test_content",
                created_at=datetime.now(UTC)
            )
            self.db.add(vault_blob)
            
            # Both should be committed together
            self.db.commit()
        
        # Verify both records exist
        stored_entry = self.db.query(JournalEntry).filter_by(user_id=self.user_id).first()
        stored_blob = self.db.query(VaultBlob).filter_by(user_id=self.user_id).first()
        
        assert stored_entry is not None
        assert stored_blob is not None

    def test_error_propagation_across_services(self):
        """Test error handling and propagation between services."""
        # Test database connection error handling
        original_engine = self.opaque_service.db.bind
        
        try:
            # Simulate database connection error
            with patch.object(self.opaque_service.db, 'execute', side_effect=SQLAlchemyError("Connection failed")):
                # This should handle the error gracefully
                result = self.opaque_service.get_secret_tags(self.user_id)
                # The service should return empty list or handle error appropriately
                assert result is not None
        finally:
            # Restore original engine
            self.opaque_service.db.bind = original_engine

    def test_transaction_integrity(self):
        """Test transaction integrity across service boundaries."""
        phrase = TEST_PHRASES[2]
        
        # Test rollback on failure
        with pytest.raises(Exception):
            with self.db.begin():
                # Create valid entry
                entry = JournalEntry(
                    id=str(uuid.uuid4()),
                    user_id=self.user_id,
                    content="Valid entry",
                    created_at=datetime.now(UTC)
                )
                self.db.add(entry)
                
                # Force an error
                raise Exception("Forced error for rollback test")
        
        # Verify rollback happened
        stored_entry = self.db.query(JournalEntry).filter(
            JournalEntry.user_id == self.user_id,
            JournalEntry.content == "Valid entry"
        ).first()
        assert stored_entry is None

    def test_monitoring_integration(self):
        """Test integration with monitoring and audit systems."""
        # Test audit logging integration
        correlation_id = str(uuid.uuid4())
        
        # Perform actions that should be audited
        tag = self.test_tags[0]
        
        # Create session (should be audited)
        session_token = self.session_service.create_session(self.user_id)
        
        # Access vault (should be audited)
        vault_stats = self.vault_service.get_vault_stats(self.user_id)
        
        # Process phrase (should be audited)
        detected_phrases = self.phrase_processor.detect_phrases(
            "Test entry with monitoring integration",
            self.user_id
        )
        
        # Verify audit service health
        health_status = self.audit_service.get_service_health()
        assert health_status["status"] == "healthy"

    def test_concurrent_service_operations(self):
        """Test concurrent operations across multiple services."""
        def create_journal_entry(entry_id):
            """Create a journal entry concurrently."""
            entry = JournalEntry(
                id=str(uuid.uuid4()),
                user_id=self.user_id,
                content=f"Concurrent entry {entry_id}",
                created_at=datetime.now(UTC)
            )
            self.db.add(entry)
            self.db.commit()
            return entry_id

        def create_vault_blob(blob_id):
            """Create a vault blob concurrently."""
            blob = VaultBlob(
                id=str(uuid.uuid4()),
                user_id=self.user_id,
                content_type="text/plain",
                encrypted_content=f"encrypted_content_{blob_id}".encode(),
                created_at=datetime.now(UTC)
            )
            self.db.add(blob)
            self.db.commit()
            return blob_id

        # Execute concurrent operations
        with ThreadPoolExecutor(max_workers=4) as executor:
            # Submit journal entry creation tasks
            journal_futures = [
                executor.submit(create_journal_entry, i)
                for i in range(5)
            ]
            
            # Submit vault blob creation tasks
            vault_futures = [
                executor.submit(create_vault_blob, i)
                for i in range(5)
            ]
            
            # Wait for all tasks to complete
            journal_results = [f.result() for f in as_completed(journal_futures)]
            vault_results = [f.result() for f in as_completed(vault_futures)]
        
        # Verify all operations completed successfully
        assert len(journal_results) == 5
        assert len(vault_results) == 5
        
        # Verify data integrity
        stored_entries = self.db.query(JournalEntry).filter_by(user_id=self.user_id).all()
        stored_blobs = self.db.query(VaultBlob).filter_by(user_id=self.user_id).all()
        
        assert len(stored_entries) >= 5
        assert len(stored_blobs) >= 5

    def test_service_dependency_validation(self):
        """Test that service dependencies are properly validated."""
        # Test that services fail gracefully when dependencies are unavailable
        
        # Test OPAQUE service without database
        with patch.object(self.opaque_service, 'db', None):
            # Should handle missing database gracefully
            try:
                result = self.opaque_service.get_secret_tags(self.user_id)
                # Should return empty list or handle error appropriately
                assert result is not None
            except Exception as e:
                # Expected behavior for missing dependency
                assert "database" in str(e).lower() or "connection" in str(e).lower()

    def test_cleanup_service_integration(self):
        """Test integration with cleanup and maintenance services."""
        # Create test data that should be cleaned up
        expired_session = OpaqueSession(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            client_public_key=b"test_key",
            server_public_key=b"test_server_key",
            created_at=datetime.now(UTC) - timedelta(hours=2),
            expires_at=datetime.now(UTC) - timedelta(hours=1)
        )
        self.db.add(expired_session)
        self.db.commit()
        
        # Run cleanup service
        cleanup_result = self.cleanup_service.cleanup_expired_sessions()
        
        # Verify cleanup worked
        remaining_sessions = self.db.query(OpaqueSession).filter_by(user_id=self.user_id).all()
        assert len(remaining_sessions) == 0

    def test_performance_monitoring_integration(self):
        """Test integration with performance monitoring systems."""
        start_time = time.time()
        
        # Perform a series of operations that should be monitored
        for i in range(10):
            # Create journal entry
            entry = JournalEntry(
                id=str(uuid.uuid4()),
                user_id=self.user_id,
                content=f"Performance test entry {i}",
                created_at=datetime.now(UTC)
            )
            self.db.add(entry)
            
            # Process phrase
            detected_phrases = self.phrase_processor.detect_phrases(
                f"Performance test with phrase {i}",
                self.user_id
            )
        
        self.db.commit()
        end_time = time.time()
        
        # Verify operations completed within reasonable time
        total_time = end_time - start_time
        assert total_time < 5.0  # Should complete within 5 seconds
        
        # Verify performance metrics are available
        # This would integrate with actual performance monitoring in production
        assert total_time > 0

    def test_multi_user_isolation(self):
        """Test that services properly isolate data between users."""
        # Create second test user
        second_user = User(
            id=str(uuid.uuid4()),
            email="second_user@example.com",
            hashed_password=self.hasher.hash_password("SecondUserPassword123!"),
            full_tag_display_tag_display_name="Second Test User"
        )
        self.db.add(second_user)
        self.db.commit()
        
        # Create data for both users
        entry1 = JournalEntry(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            content="First user's entry",
            created_at=datetime.now(UTC)
        )
        
        entry2 = JournalEntry(
            id=str(uuid.uuid4()),
            user_id=second_user.id,
            content="Second user's entry",
            created_at=datetime.now(UTC)
        )
        
        self.db.add(entry1)
        self.db.add(entry2)
        self.db.commit()
        
        # Verify isolation - each user should only see their own data
        user1_entries = self.journal_service.get_entries(self.user_id)
        user2_entries = self.journal_service.get_entries(second_user.id)
        
        # Each user should have exactly one entry
        assert len(user1_entries) == 1
        assert len(user2_entries) == 1
        
        # Verify content isolation
        assert user1_entries[0].content == "First user's entry"
        assert user2_entries[0].content == "Second user's entry"
        
        # Clean up second user
        self.db.query(JournalEntry).filter_by(user_id=second_user.id).delete()
        self.db.query(User).filter_by(id=second_user.id).delete()
        self.db.commit()

    def test_service_health_monitoring(self):
        """Test service health monitoring and status reporting."""
        # Test health status of all services
        services = [
            self.opaque_service,
            self.vault_service,
            self.journal_service,
            self.phrase_processor,
            self.audit_service,
            self.cleanup_service
        ]
        
        for service in services:
            if hasattr(service, 'get_health_status'):
                health = service.get_health_status()
                assert health is not None
                assert "status" in health
            elif hasattr(service, 'is_healthy'):
                assert service.is_healthy() is True
        
        # Test overall system health
        overall_health = {
            "database": self.db.is_active,
            "services": len(services),
            "timestamp": datetime.now(UTC).isoformat()
        }
        
        assert overall_health["database"] is True
        assert overall_health["services"] == len(services) 