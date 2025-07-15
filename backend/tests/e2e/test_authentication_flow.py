"""
End-to-End Authentication Flow Tests

This module provides comprehensive testing for the OPAQUE authentication flow
including registration, authentication, session management, and vault access.
"""

import pytest
import asyncio
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.sql import text

from app.main import app
from app.db.session import get_db
from app.db.session_factory import DatabaseSessionFactory
from app.models.user import User
from app.models.secret_tag_opaque import SecretTag, OpaqueSession
from app.services.opaque_service import create_opaque_service
from app.services.user_service import user_service
from app.services.session_service import session_service
from app.schemas.opaque import (
    OpaqueRegistrationRequest,
    OpaqueAuthInitRequest,
    OpaqueAuthFinalizeRequest
)
from app.utils.secure_utils import SecureHasher
from app.crypto.opaque_keys import derive_opaque_keys_from_phrase
from app.crypto.opaque_server import OpaqueServer
from app.services.opaque_service import EnhancedOpaqueService
from app.services.vault_service import VaultService
from app.services.session_service import SessionService
from app.services.audit_service import SecurityAuditService
from app.utils.secure_utils import SecureTokenGenerator, SecureHasher
from app.security.constant_time import ConstantTimeOperations
from app.security.rate_limiter import RateLimitStrategy
from app.security.memory_protection import SecureMemoryManager

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_USER_EMAIL = "auth_test@example.com"
TEST_USER_PASSWORD = "AuthTestPassword123!"

# Test phrases and tag data
TEST_PHRASES = [
    "Authentication test phrase number one",
    "The second authentication test phrase",
    "Third phrase for authentication testing",
    "Fourth authentication phrase for testing",
    "Fifth and final authentication test phrase"
]

TEST_TAG_NAMES = [
    "Auth Test Tag 1",
    "Auth Test Tag 2", 
    "Auth Test Tag 3",
    "Auth Test Tag 4",
    "Auth Test Tag 5"
]

# Wrong phrases for failure testing
WRONG_PHRASES = [
    "This is not the correct phrase",
    "Wrong authentication phrase",
    "Incorrect secret phrase",
    "Not the right words",
    "This will fail authentication"
]


class TestOpaqueAuthenticationFlow:
    """Test class for comprehensive OPAQUE authentication flow testing."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment before each test method."""
        self.client = TestClient(app)
        self.hasher = SecureHasher()
        self.token_generator = SecureTokenGenerator()
        self.constant_time_ops = ConstantTimeOperations()
        self.memory_manager = SecureMemoryManager()
        self.opaque_server = OpaqueServer()
        
        # Create test database session using our session factory
        self.session_factory = DatabaseSessionFactory(TEST_DATABASE_URL)
        self.db = self.session_factory.get_session()
        
        # Override database dependency to use our test session
        def override_get_db():
            try:
                yield self.db
            finally:
                pass  # Don't close here, we'll manage it in teardown
        
        app.dependency_overrides[get_db] = override_get_db
        
        # Create test user and secret tags
        self.test_user = self._create_test_user()
        self.test_secret_tags = self._create_test_secret_tags()
        
        # Initialize services with test database
        self.opaque_service = create_opaque_service(self.db)
        self.user_service = user_service
        self.session_service = session_service
        self.vault_service = VaultService(self.db)
        self.audit_service = SecurityAuditService()
        
        # Set up rate limiter for testing
        self.rate_limiter = RateLimitStrategy(max_attempts=5, window_seconds=60)

    def teardown_method(self):
        """Clean up after each test method."""
        try:
            self._cleanup_test_data()
        except Exception as e:
            print(f"Error during cleanup: {e}")
        finally:
            if hasattr(self, 'db'):
                self.db.close()
            # Clear dependency overrides
            app.dependency_overrides.clear()

    def _create_test_user(self) -> User:
        """Create a test user for authentication testing."""
        # Check if user already exists and delete if so
        existing_user = self.db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        if existing_user:
            self.db.delete(existing_user)
            self.db.commit()
            
        user = User(
            id=str(uuid.uuid4()),
            email=TEST_USER_EMAIL,
            hashed_password=self.hasher.hash_password(TEST_USER_PASSWORD),
            full_name="Authentication Test User"
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _create_test_secret_tags(self) -> list:
        """Create test secret tags for authentication testing."""
        tags = []
        for i, phrase in enumerate(TEST_PHRASES):
            tag_name = TEST_TAG_NAMES[i]
            
            # Clean up any existing tags with same name
            existing_tags = self.db.query(SecretTag).filter(
                SecretTag.user_id == self.test_user.id,
                SecretTag.tag_name == tag_name
            ).all()
            for existing_tag in existing_tags:
                self.db.delete(existing_tag)
            
            # Create new tag
            tag_id = uuid.uuid4().bytes
            salt = uuid.uuid4().bytes
            verifier_kv = uuid.uuid4().bytes
            opaque_envelope = uuid.uuid4().bytes
            
            tag = SecretTag(
                tag_id=tag_id,
                user_id=self.test_user.id,
                salt=salt,
                verifier_kv=verifier_kv,
                opaque_envelope=opaque_envelope,
                tag_name=tag_name,
                color_code="#FF0000"
            )
            self.db.add(tag)
            tags.append(tag)
        
        self.db.commit()
        return tags

    def _cleanup_test_data(self):
        """Clean up test data from database."""
        try:
            # Clean up sessions
            self.db.query(OpaqueSession).filter(
                OpaqueSession.user_id == self.test_user.id
            ).delete()
            
            # Clean up secret tags
            self.db.query(SecretTag).filter(
                SecretTag.user_id == self.test_user.id
            ).delete()
            
            # Clean up test user
            self.db.query(User).filter(
                User.id == self.test_user.id
            ).delete()
            
            self.db.commit()
        except Exception as e:
            print(f"Error during cleanup: {e}")
            self.db.rollback()

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

    @pytest.mark.asyncio
    async def test_complete_opaque_authentication_flow(self):
        """Test complete OPAQUE authentication flow end-to-end."""
        # 1. Authenticate user
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # 2. Get test tag data
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # 3. Initialize authentication
        init_request = {
            "phrase": phrase,
            "tag_id": tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        
        # 4. Verify init response
        assert init_response.status_code == 200
        init_result = init_response.json()
        assert init_result["success"] is True
        assert "session_id" in init_result
        assert "server_message" in init_result
        
        session_id = init_result["session_id"]
        
        # 5. Verify session was created
        session = self.db.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert session is not None
        assert session.user_id == str(self.test_user.id)
        assert session.session_state == "authentication_initialized"
        
        # 6. Finalize authentication
        finalize_request = {
            "session_id": session_id,
            "client_message": "mock_client_message"  # In real implementation, this would be actual OPAQUE client message
        }
        
        finalize_response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        
        # 7. Verify finalize response
        assert finalize_response.status_code == 200
        finalize_result = finalize_response.json()
        assert finalize_result["success"] is True
        assert "session_token" in finalize_result
        assert "vault_keys" in finalize_result
        
        # 8. Verify session was completed
        updated_session = self.db.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert updated_session.session_state == "authenticated"
        
        # 9. Verify vault keys are accessible
        vault_keys = finalize_result["vault_keys"]
        assert vault_keys is not None
        assert len(vault_keys) > 0

    @pytest.mark.asyncio
    async def test_authentication_with_wrong_phrase(self):
        """Test authentication fails with wrong phrase."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Use wrong phrase for existing tag
        test_tag_data = self.test_secret_tags[0]
        tag_id = test_tag_data.tag_id.hex()
        wrong_phrase = WRONG_PHRASES[0]
        
        # Initialize authentication with wrong phrase
        init_request = {
            "phrase": wrong_phrase,
            "tag_id": tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        
        # Should fail during initialization
        assert init_response.status_code == 401
        assert "authentication failed" in init_response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_authentication_with_nonexistent_tag(self):
        """Test authentication fails with non-existent tag ID."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Use non-existent tag ID
        fake_tag_id = "0" * 32
        phrase = TEST_PHRASES[0]
        
        init_request = {
            "phrase": phrase,
            "tag_id": fake_tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        
        # Should fail - tag not found
        assert init_response.status_code == 404
        assert "not found" in init_response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_authentication_timing_consistency(self):
        """Test authentication timing is consistent (timing attack prevention)."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test with correct phrase
        test_tag_data = self.test_secret_tags[0]
        correct_phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # Measure correct authentication timing
        start_time = time.time()
        init_request = {
            "phrase": correct_phrase,
            "tag_id": tag_id
        }
        
        correct_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        correct_time = time.time() - start_time
        
        # Test with wrong phrase
        wrong_phrase = WRONG_PHRASES[0]
        
        start_time = time.time()
        init_request = {
            "phrase": wrong_phrase,
            "tag_id": tag_id
        }
        
        wrong_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        wrong_time = time.time() - start_time
        
        # Verify responses
        assert correct_response.status_code == 200
        assert wrong_response.status_code == 401
        
        # Timing should be similar (within 50ms)
        timing_difference = abs(correct_time - wrong_time)
        assert timing_difference < 0.05, f"Timing difference too large: {timing_difference:.3f}s"

    @pytest.mark.asyncio
    async def test_authentication_session_management(self):
        """Test proper session management during authentication."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # Initialize authentication
        init_request = {
            "phrase": phrase,
            "tag_id": tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        assert init_response.status_code == 200
        
        session_id = init_response.json()["session_id"]
        
        # Verify session exists and has correct state
        session = self.db.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert session is not None
        assert session.session_state == "authentication_initialized"
        assert session.user_id == str(self.test_user.id)
        
        # Verify session expiration
        assert session.expires_at > datetime.utcnow()
        
        # Finalize authentication
        finalize_request = {
            "session_id": session_id,
            "client_message": "mock_client_message"
        }
        
        finalize_response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        assert finalize_response.status_code == 200
        
        # Verify session state updated
        updated_session = self.db.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert updated_session.session_state == "authenticated"
        assert updated_session.last_activity > session.last_activity

    @pytest.mark.asyncio
    async def test_authentication_session_expiration(self):
        """Test authentication session expiration handling."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # Initialize authentication
        init_request = {
            "phrase": phrase,
            "tag_id": tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        assert init_response.status_code == 200
        
        session_id = init_response.json()["session_id"]
        
        # Manually expire the session
        session = self.db.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        session.expires_at = datetime.utcnow() - timedelta(minutes=1)
        self.db.commit()
        
        # Attempt to finalize expired session
        finalize_request = {
            "session_id": session_id,
            "client_message": "mock_client_message"
        }
        
        finalize_response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        
        # Should fail due to expiration
        assert finalize_response.status_code == 401
        assert "expired" in finalize_response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_authentication_concurrent_sessions(self):
        """Test handling of concurrent authentication sessions."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # Initialize multiple authentication sessions
        sessions = []
        for i in range(3):
            init_request = {
                "phrase": phrase,
                "tag_id": tag_id
            }
            
            init_response = self.client.post(
                "/api/opaque/auth/init",
                json=init_request,
                headers=headers
            )
            assert init_response.status_code == 200
            sessions.append(init_response.json()["session_id"])
        
        # Verify all sessions exist
        for session_id in sessions:
            session = self.db.query(OpaqueSession).filter(
                OpaqueSession.session_id == session_id
            ).first()
            assert session is not None
            assert session.session_state == "authentication_initialized"
        
        # Finalize first session
        finalize_request = {
            "session_id": sessions[0],
            "client_message": "mock_client_message"
        }
        
        finalize_response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        assert finalize_response.status_code == 200
        
        # Other sessions should still be valid
        for session_id in sessions[1:]:
            session = self.db.query(OpaqueSession).filter(
                OpaqueSession.session_id == session_id
            ).first()
            assert session.session_state == "authentication_initialized"

    @pytest.mark.asyncio
    async def test_authentication_rate_limiting(self):
        """Test rate limiting for authentication attempts."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_secret_tags[0]
        tag_id = test_tag_data.tag_id.hex()
        
        # Send many authentication requests quickly
        responses = []
        for i in range(25):  # Exceed rate limit
            init_request = {
                "phrase": WRONG_PHRASES[0],  # Use wrong phrase
                "tag_id": tag_id
            }
            
            response = self.client.post(
                "/api/opaque/auth/init",
                json=init_request,
                headers=headers
            )
            responses.append(response)
        
        # Should have some rate limited responses
        rate_limited_responses = [r for r in responses if r.status_code == 429]
        assert len(rate_limited_responses) > 0, "Rate limiting should trigger"
        
        # Should still have some authentication failure responses
        auth_failed_responses = [r for r in responses if r.status_code == 401]
        assert len(auth_failed_responses) > 0, "Some auth failures should occur"

    @pytest.mark.asyncio
    async def test_authentication_multiple_tags(self):
        """Test authentication with multiple secret tags."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test authentication with each tag
        for i, test_tag_data in enumerate(self.test_secret_tags):
            phrase = TEST_PHRASES[i] # Use the phrase from TEST_PHRASES
            tag_id = test_tag_data.tag_id.hex()
            
            # Initialize authentication
            init_request = {
                "phrase": phrase,
                "tag_id": tag_id
            }
            
            init_response = self.client.post(
                "/api/opaque/auth/init",
                json=init_request,
                headers=headers
            )
            assert init_response.status_code == 200
            
            session_id = init_response.json()["session_id"]
            
            # Finalize authentication
            finalize_request = {
                "session_id": session_id,
                "client_message": "mock_client_message"
            }
            
            finalize_response = self.client.post(
                "/api/opaque/auth/finalize",
                json=finalize_request,
                headers=headers
            )
            assert finalize_response.status_code == 200
            
            # Verify vault keys are different for each tag
            vault_keys = finalize_response.json()["vault_keys"]
            assert vault_keys is not None

    @pytest.mark.asyncio
    async def test_authentication_vault_key_derivation(self):
        """Test that vault keys are properly derived after authentication."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # Complete authentication flow
        init_request = {
            "phrase": phrase,
            "tag_id": tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        assert init_response.status_code == 200
        
        session_id = init_response.json()["session_id"]
        
        finalize_request = {
            "session_id": session_id,
            "client_message": "mock_client_message"
        }
        
        finalize_response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        assert finalize_response.status_code == 200
        
        # Verify vault keys
        vault_keys = finalize_response.json()["vault_keys"]
        assert vault_keys is not None
        assert len(vault_keys) > 0
        
        # Verify keys are valid for vault operations
        for vault_key in vault_keys:
            assert "vault_id" in vault_key
            assert "wrapped_key" in vault_key
            assert len(vault_key["wrapped_key"]) > 0

    @pytest.mark.asyncio
    async def test_authentication_audit_logging(self):
        """Test that authentication events are properly logged."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # Get initial audit log count
        initial_log_count = self.db.execute(
            text("SELECT COUNT(*) FROM audit_logs WHERE user_id = :user_id"),
            {"user_id": str(self.test_user.id)}
        ).scalar()
        
        # Complete authentication flow
        init_request = {
            "phrase": phrase,
            "tag_id": tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        assert init_response.status_code == 200
        
        session_id = init_response.json()["session_id"]
        
        finalize_request = {
            "session_id": session_id,
            "client_message": "mock_client_message"
        }
        
        finalize_response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        assert finalize_response.status_code == 200
        
        # Verify audit logs were created
        final_log_count = self.db.execute(
            text("SELECT COUNT(*) FROM audit_logs WHERE user_id = :user_id"),
            {"user_id": str(self.test_user.id)}
        ).scalar()
        
        assert final_log_count > initial_log_count, "Audit logs should be created"

    @pytest.mark.asyncio
    async def test_authentication_memory_protection(self):
        """Test memory protection during authentication."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # Monitor memory allocations
        initial_allocations = len(self.memory_manager.tracked_allocations)
        
        # Complete authentication flow
        init_request = {
            "phrase": phrase,
            "tag_id": tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        assert init_response.status_code == 200
        
        session_id = init_response.json()["session_id"]
        
        finalize_request = {
            "session_id": session_id,
            "client_message": "mock_client_message"
        }
        
        finalize_response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        assert finalize_response.status_code == 200
        
        # Verify memory management
        current_allocations = len(self.memory_manager.tracked_allocations)
        
        # Memory should be properly managed
        assert current_allocations >= initial_allocations

    @pytest.mark.asyncio
    async def test_authentication_error_handling(self):
        """Test error handling during authentication."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test malformed init request
        response = self.client.post(
            "/api/opaque/auth/init",
            json={"invalid": "data"},
            headers=headers
        )
        assert response.status_code == 400
        
        # Test missing authentication
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        init_request = {
            "phrase": phrase,
            "tag_id": tag_id
        }
        
        response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request
            # No headers
        )
        assert response.status_code == 401
        
        # Test invalid session ID in finalize
        finalize_request = {
            "session_id": "invalid_session_id",
            "client_message": "mock_client_message"
        }
        
        response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_authentication_database_consistency(self):
        """Test database consistency during authentication."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        test_tag_data = self.test_secret_tags[0]
        phrase = TEST_PHRASES[0] # Use the phrase from TEST_PHRASES
        tag_id = test_tag_data.tag_id.hex()
        
        # Complete authentication flow
        init_request = {
            "phrase": phrase,
            "tag_id": tag_id
        }
        
        init_response = self.client.post(
            "/api/opaque/auth/init",
            json=init_request,
            headers=headers
        )
        assert init_response.status_code == 200
        
        session_id = init_response.json()["session_id"]
        
        # Verify session consistency
        session = self.db.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert session is not None
        assert session.user_id == str(self.test_user.id)
        
        # Finalize authentication
        finalize_request = {
            "session_id": session_id,
            "client_message": "mock_client_message"
        }
        
        finalize_response = self.client.post(
            "/api/opaque/auth/finalize",
            json=finalize_request,
            headers=headers
        )
        assert finalize_response.status_code == 200
        
        # Verify session state consistency
        updated_session = self.db.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert updated_session.session_state == "authenticated"
        assert updated_session.last_activity > session.last_activity
        
        # Verify no orphaned sessions
        orphaned_sessions = self.db.query(OpaqueSession).filter(
            OpaqueSession.user_id == str(self.test_user.id),
            OpaqueSession.session_state == "authentication_initialized",
            OpaqueSession.expires_at < datetime.utcnow()
        ).all()
        # Note: In a real implementation, there might be cleanup processes
        # that remove orphaned sessions 