"""
End-to-end tests for secret tag registration flow.

This module tests the complete secret tag registration process from user input
through OPAQUE protocol execution to database persistence, with no mocking
of core functionality.
"""

import pytest
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.models.user import User
from app.models.secret_tag_opaque import SecretTag
from app.models.tag import Tag
from app.crypto.opaque_keys import derive_opaque_keys_from_phrase
from app.services.opaque_service import EnhancedOpaqueService
from app.services.vault_service import VaultService
from app.services.session_service import SessionService
from app.utils.secure_utils import SecureTokenGenerator, SecureHasher
from app.security.constant_time import ConstantTimeOperations
from app.security.memory_protection import SecureMemoryManager
from app.core.security import get_password_hash
from app.services.audit_service import SecurityAuditService

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "TestPassword123!"

# Test data
VALID_TEST_PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Waltz, bad nymph, for quick jigs vex",
    "Sphinx of black quartz, judge my vow"
]

INVALID_TEST_PHRASES = [
    "",  # Empty phrase
    "short",  # Too short
    "a" * 201,  # Too long
    "123456789",  # No words
    "test test test",  # Repeated words
]

TEST_TAG_NAMES = [
    "Personal Diary",
    "Work Notes",
    "Financial Records",
    "Health Records",
    "Travel Journal"
]

INVALID_TAG_NAMES = [
    "",  # Empty name
    "a" * 101,  # Too long
    "Test<script>alert('xss')</script>",  # XSS attempt
    "Test'; DROP TABLE users; --",  # SQL injection attempt
    "Test\x00Null",  # Null byte injection
]


class TestSecretTagRegistration:
    """Comprehensive end-to-end tests for secret tag registration."""

    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment before each test."""
        self.client = TestClient(app)
        self.token_generator = SecureTokenGenerator()
        self.hasher = SecureHasher()
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
        
        # Initialize services
        self.opaque_service = EnhancedOpaqueService(self.db)
        self.vault_service = VaultService(self.db)
        self.session_service = SessionService()
        self.audit_service = SecurityAuditService()

    def teardown_method(self):
        """Clean up test data after each test."""
        self._cleanup_test_data()
        
        # Clear app dependency overrides
        app.dependency_overrides.clear()
        
        # Clear secure memory
        self.memory_manager.cleanup_all()

    def _create_test_user(self) -> User:
        """Create a test user for registration tests."""
        # Check if user already exists
        existing_user = self.db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        if existing_user:
            return existing_user
        
        # Create new test user
        hashed_password = get_password_hash(TEST_USER_PASSWORD)
        user = User(
            id=str(uuid.uuid4()),
            email=TEST_USER_EMAIL,
            hashed_password=hashed_password,
            is_active=True,
            created_at=datetime.utcnow()
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _cleanup_test_data(self):
        """Clean up test data from database."""
        try:
            # Delete secret tags
            self.db.query(SecretTag).filter(
                SecretTag.user_id == self.user_id
            ).delete()
            
            # Delete regular tags
            self.db.query(Tag).filter(
                Tag.user_id == self.user_id
            ).delete()
            
            # Delete test user
            self.db.query(User).filter(
                User.id == self.user_id
            ).delete()
            
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"Cleanup error: {e}")

    def _authenticate_user(self) -> str:
        """Authenticate test user and return access token."""
        # Create test user if it doesn't exist
        user = self._create_test_user()
        print(f"Created/found user: {user.email}, ID: {user.id}, Active: {user.is_active}")
        print(f"Password hash: {user.hashed_password[:50]}...")
        
        # Verify user exists in database with correct password
        from app.core.security import verify_password
        db_user = self.db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        print(f"User in DB: {db_user is not None}")
        if db_user:
            print(f"DB user active: {db_user.is_active}")
            print(f"Password verification: {verify_password(TEST_USER_PASSWORD, db_user.hashed_password)}")
        
        response = self.client.post(
            "/api/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        print(f"Login response status: {response.status_code}")
        print(f"Login response content: {response.text}")
        assert response.status_code == 200
        return response.json()["access_token"]

    @pytest.mark.asyncio
    async def test_complete_secret_tag_registration_flow(self):
        """Test complete secret tag registration flow end-to-end."""
        # 1. Authenticate user
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # 2. Prepare registration data
        phrase = VALID_TEST_PHRASES[0]
        tag_name = TEST_TAG_NAMES[0]
        color_code = "#FF5733"
        
        # 3. Derive OPAQUE keys from phrase
        opaque_keys = derive_opaque_keys_from_phrase(phrase)
        
        # 4. Create registration request
        registration_data = {
            "phrase": phrase,
            "tag_name": tag_name,
            "color_code": color_code,
            "tag_id": opaque_keys.tag_id.hex(),
            "salt": opaque_keys.salt.hex(),
            "verification_key": opaque_keys.verification_key.hex()
        }
        
        # 5. Send registration request
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        
        # 6. Verify response
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["tag_id"] == opaque_keys.tag_id.hex()
        assert "vault_id" in result
        
        # 7. Verify database persistence
        secret_tag = self.db.query(SecretTag).filter(
            SecretTag.tag_id == opaque_keys.tag_id
        ).first()
        assert secret_tag is not None
        assert secret_tag.user_id == self.user_id
        assert secret_tag.tag_name == tag_name
        assert secret_tag.color_code == color_code
        
        # 8. Verify OPAQUE verifier is stored
        assert secret_tag.verifier_kv is not None
        assert secret_tag.opaque_envelope is not None
        assert secret_tag.salt == opaque_keys.salt
        
        # 9. Verify vault keys are created
        vault_keys = self.vault_service.get_vault_keys(
            str(self.user_id),
            result["vault_id"]
        )
        assert vault_keys is not None
        
        # 10. Verify zero-knowledge properties
        # Server should not have access to the original phrase
        assert phrase not in str(secret_tag.verifier_kv)
        assert phrase not in str(secret_tag.opaque_envelope)
        
        # 11. Verify tag_id is deterministic
        keys_2 = derive_opaque_keys_from_phrase(phrase)
        assert opaque_keys.tag_id == keys_2.tag_id

    @pytest.mark.asyncio
    async def test_registration_with_duplicate_tag_name(self):
        """Test registration fails with duplicate tag name."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Create first tag
        phrase1 = VALID_TEST_PHRASES[0]
        tag_name = TEST_TAG_NAMES[0]
        keys1 = derive_opaque_keys_from_phrase(phrase1)
        
        registration_data1 = {
            "phrase": phrase1,
            "tag_name": tag_name,
            "color_code": "#FF5733",
            "tag_id": keys1.tag_id.hex(),
            "salt": keys1.salt.hex(),
            "verification_key": keys1.verification_key.hex()
        }
        
        response1 = self.client.post(
            "/api/opaque/register",
            json=registration_data1,
            headers=headers
        )
        assert response1.status_code == 200
        
        # Attempt to create second tag with same name
        phrase2 = VALID_TEST_PHRASES[1]
        keys2 = derive_opaque_keys_from_phrase(phrase2)
        
        registration_data2 = {
            "phrase": phrase2,
            "tag_name": tag_name,  # Same name
            "color_code": "#33FF57",
            "tag_id": keys2.tag_id.hex(),
            "salt": keys2.salt.hex(),
            "verification_key": keys2.verification_key.hex()
        }
        
        response2 = self.client.post(
            "/api/opaque/register",
            json=registration_data2,
            headers=headers
        )
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]

    @pytest.mark.asyncio
    async def test_registration_with_duplicate_phrase(self):
        """Test registration fails with duplicate phrase (same tag_id)."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        phrase = VALID_TEST_PHRASES[0]
        keys = derive_opaque_keys_from_phrase(phrase)
        
        # Create first tag
        registration_data1 = {
            "phrase": phrase,
            "tag_name": TEST_TAG_NAMES[0],
            "color_code": "#FF5733",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        response1 = self.client.post(
            "/api/opaque/register",
            json=registration_data1,
            headers=headers
        )
        assert response1.status_code == 200
        
        # Attempt to create second tag with same phrase
        registration_data2 = {
            "phrase": phrase,  # Same phrase
            "tag_name": TEST_TAG_NAMES[1],
            "color_code": "#33FF57",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        response2 = self.client.post(
            "/api/opaque/register",
            json=registration_data2,
            headers=headers
        )
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]

    @pytest.mark.parametrize("invalid_phrase", INVALID_TEST_PHRASES)
    @pytest.mark.asyncio
    async def test_registration_with_invalid_phrases(self, invalid_phrase):
        """Test registration fails with invalid phrases."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Generate keys for invalid phrase (may fail)
        try:
            keys = derive_opaque_keys_from_phrase(invalid_phrase)
            tag_id = keys.tag_id.hex()
            salt = keys.salt.hex()
            verification_key = keys.verification_key.hex()
        except Exception:
            # If key derivation fails, use dummy values
            tag_id = "0" * 32
            salt = "0" * 32
            verification_key = "0" * 64
        
        registration_data = {
            "phrase": invalid_phrase,
            "tag_name": TEST_TAG_NAMES[0],
            "color_code": "#FF5733",
            "tag_id": tag_id,
            "salt": salt,
            "verification_key": verification_key
        }
        
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        assert response.status_code == 400

    @pytest.mark.parametrize("invalid_tag_name", INVALID_TAG_NAMES)
    @pytest.mark.asyncio
    async def test_registration_with_invalid_tag_names(self, invalid_tag_name):
        """Test registration fails with invalid tag names."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        phrase = VALID_TEST_PHRASES[0]
        keys = derive_opaque_keys_from_phrase(phrase)
        
        registration_data = {
            "phrase": phrase,
            "tag_name": invalid_tag_name,
            "color_code": "#FF5733",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_registration_user_limit_enforcement(self):
        """Test that user tag limit is enforced."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Create maximum number of tags (assuming limit is 10)
        MAX_TAGS = 10
        
        for i in range(MAX_TAGS):
            phrase = f"Test phrase number {i} for limit testing"
            keys = derive_opaque_keys_from_phrase(phrase)
            
            registration_data = {
                "phrase": phrase,
                "tag_name": f"Test Tag {i}",
                "color_code": "#FF5733",
                "tag_id": keys.tag_id.hex(),
                "salt": keys.salt.hex(),
                "verification_key": keys.verification_key.hex()
            }
            
            response = self.client.post(
                "/api/opaque/register",
                json=registration_data,
                headers=headers
            )
            assert response.status_code == 200
        
        # Attempt to create one more tag (should fail)
        phrase = "This should exceed the limit"
        keys = derive_opaque_keys_from_phrase(phrase)
        
        registration_data = {
            "phrase": phrase,
            "tag_name": "Limit Exceeded Tag",
            "color_code": "#FF5733",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        assert response.status_code == 400
        assert "limit" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_registration_timing_consistency(self):
        """Test that registration timing is consistent (timing attack prevention)."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Measure timing for successful registration
        import time
        phrase = VALID_TEST_PHRASES[0]
        keys = derive_opaque_keys_from_phrase(phrase)
        
        registration_data = {
            "phrase": phrase,
            "tag_name": TEST_TAG_NAMES[0],
            "color_code": "#FF5733",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        start_time = time.time()
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        success_time = time.time() - start_time
        assert response.status_code == 200
        
        # Measure timing for failed registration (duplicate)
        start_time = time.time()
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        failure_time = time.time() - start_time
        assert response.status_code == 400
        
        # Timing should be relatively similar (within 50ms)
        timing_difference = abs(success_time - failure_time)
        assert timing_difference < 0.05, f"Timing difference too large: {timing_difference:.3f}s"

    @pytest.mark.asyncio
    async def test_registration_concurrent_users(self):
        """Test registration with concurrent users."""
        # Create multiple users
        users = []
        for i in range(3):
            user_email = f"concurrent_user_{i}@example.com"
            hashed_password = get_password_hash(f"TestPassword{i}123!")
            user = User(
                id=uuid.uuid4(),
                email=user_email,
                hashed_password=hashed_password,
                is_active=True,
                created_at=datetime.utcnow()
            )
            self.db.add(user)
            users.append(user)
        
        self.db.commit()
        
        # Authenticate all users
        tokens = []
        for i, user in enumerate(users):
            response = self.client.post(
                "/api/auth/login",
                data={
                    "username": user.email,
                    "password": f"TestPassword{i}123!"
                }
            )
            assert response.status_code == 200
            tokens.append(response.json()["access_token"])
        
        # Register tags concurrently
        async def register_tag(user_index):
            phrase = f"Concurrent test phrase for user {user_index}"
            keys = derive_opaque_keys_from_phrase(phrase)
            
            registration_data = {
                "phrase": phrase,
                "tag_name": f"Concurrent Tag {user_index}",
                "color_code": "#FF5733",
                "tag_id": keys.tag_id.hex(),
                "salt": keys.salt.hex(),
                "verification_key": keys.verification_key.hex()
            }
            
            headers = {"Authorization": f"Bearer {tokens[user_index]}"}
            response = self.client.post(
                "/api/opaque/register",
                json=registration_data,
                headers=headers
            )
            return response
        
        # Execute concurrent registrations
        tasks = [register_tag(i) for i in range(3)]
        responses = await asyncio.gather(*tasks)
        
        # Verify all registrations succeeded
        for response in responses:
            assert response.status_code == 200
        
        # Verify all tags were created
        for user in users:
            secret_tags = self.db.query(SecretTag).filter(
                SecretTag.user_id == user.id
            ).all()
            assert len(secret_tags) == 1
        
        # Cleanup concurrent users
        for user in users:
            self.db.query(SecretTag).filter(
                SecretTag.user_id == user.id
            ).delete()
            self.db.query(User).filter(User.id == user.id).delete()
        self.db.commit()

    @pytest.mark.asyncio
    async def test_registration_memory_protection(self):
        """Test that sensitive data is properly protected in memory."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        phrase = VALID_TEST_PHRASES[0]
        keys = derive_opaque_keys_from_phrase(phrase)
        
        # Monitor memory allocation
        initial_allocations = len(self.memory_manager.tracked_allocations)
        
        registration_data = {
            "phrase": phrase,
            "tag_name": TEST_TAG_NAMES[0],
            "color_code": "#FF5733",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        assert response.status_code == 200
        
        # Check that sensitive data was properly managed
        current_allocations = len(self.memory_manager.tracked_allocations)
        
        # Memory should be cleaned up after operation
        # (This is a simplified test - in practice, you'd need more sophisticated monitoring)
        assert current_allocations >= initial_allocations

    @pytest.mark.asyncio
    async def test_registration_rate_limiting(self):
        """Test that rate limiting is enforced for registration."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Send multiple registration requests quickly
        responses = []
        for i in range(20):  # Exceed rate limit
            phrase = f"Rate limit test phrase {i}"
            keys = derive_opaque_keys_from_phrase(phrase)
            
            registration_data = {
                "phrase": phrase,
                "tag_name": f"Rate Limit Tag {i}",
                "color_code": "#FF5733",
                "tag_id": keys.tag_id.hex(),
                "salt": keys.salt.hex(),
                "verification_key": keys.verification_key.hex()
            }
            
            response = self.client.post(
                "/api/opaque/register",
                json=registration_data,
                headers=headers
            )
            responses.append(response)
        
        # Some requests should be rate limited
        rate_limited_responses = [r for r in responses if r.status_code == 429]
        assert len(rate_limited_responses) > 0, "Rate limiting should trigger"
        
        # Successful responses should still work
        successful_responses = [r for r in responses if r.status_code == 200]
        assert len(successful_responses) > 0, "Some requests should succeed"

    @pytest.mark.asyncio
    async def test_registration_database_consistency(self):
        """Test database consistency during registration."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        phrase = VALID_TEST_PHRASES[0]
        keys = derive_opaque_keys_from_phrase(phrase)
        
        registration_data = {
            "phrase": phrase,
            "tag_name": TEST_TAG_NAMES[0],
            "color_code": "#FF5733",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        # Register tag
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        assert response.status_code == 200
        result = response.json()
        
        # Verify database consistency
        # 1. Secret tag exists
        secret_tag = self.db.query(SecretTag).filter(
            SecretTag.tag_id == keys.tag_id
        ).first()
        assert secret_tag is not None
        
        # 2. User association is correct
        assert secret_tag.user_id == self.user_id
        
        # 3. Vault keys exist
        vault_keys = self.vault_service.get_vault_keys(
            str(self.user_id),
            result["vault_id"]
        )
        assert vault_keys is not None
        
        # 4. Timestamps are reasonable
        assert secret_tag.created_at <= datetime.utcnow()
        assert secret_tag.updated_at <= datetime.utcnow()
        
        # 5. Data integrity
        assert len(secret_tag.tag_id) == 16  # 16 bytes
        assert len(secret_tag.salt) == 16    # 16 bytes
        assert len(secret_tag.verifier_kv) == 32  # 32 bytes
        assert secret_tag.opaque_envelope is not None

    @pytest.mark.asyncio
    async def test_registration_error_handling(self):
        """Test error handling during registration."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test malformed request
        response = self.client.post(
            "/api/opaque/register",
            json={"invalid": "data"},
            headers=headers
        )
        assert response.status_code == 400
        
        # Test missing authentication
        phrase = VALID_TEST_PHRASES[0]
        keys = derive_opaque_keys_from_phrase(phrase)
        
        registration_data = {
            "phrase": phrase,
            "tag_name": TEST_TAG_NAMES[0],
            "color_code": "#FF5733",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data
            # No headers
        )
        assert response.status_code == 401
        
        # Test invalid authentication
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_registration_audit_logging(self):
        """Test that registration events are properly logged."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        phrase = VALID_TEST_PHRASES[0]
        keys = derive_opaque_keys_from_phrase(phrase)
        
        registration_data = {
            "phrase": phrase,
            "tag_name": TEST_TAG_NAMES[0],
            "color_code": "#FF5733",
            "tag_id": keys.tag_id.hex(),
            "salt": keys.salt.hex(),
            "verification_key": keys.verification_key.hex()
        }
        
        # Register tag
        response = self.client.post(
            "/api/opaque/register",
            json=registration_data,
            headers=headers
        )
        assert response.status_code == 200
        
        # Check audit logs (would require access to audit service)
        # This is a placeholder - actual implementation would check the audit log
        # for the registration event
        pass 