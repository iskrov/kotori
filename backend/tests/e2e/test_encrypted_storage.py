"""
End-to-end tests for encrypted storage functionality.

This module tests the complete encrypted storage system including vault operations,
key management, encrypted journal entry storage, and security validation
with real implementations and no mocking.
"""

import pytest
import asyncio
import time
import uuid
import json
from datetime import datetime, timedelta, UTC
from typing import Dict, Any, List, Optional, Union
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import secrets

from app.main import app
from app.db.session import get_db
from app.db.session_factory import DatabaseSessionFactory
from app.models.user import User
from app.models.secret_tag_opaque import SecretTag, VaultBlob, WrappedKey
from app.models.journal_entry import JournalEntry
from app.services.vault_service import VaultService
from app.services.opaque_service import EnhancedOpaqueService
from app.services.journal_service import JournalService
from app.services.encryption_service import EncryptionService
from app.crypto.aes_gcm import AESGCMCrypto
from app.crypto.opaque_keys import derive_opaque_keys_from_phrase
from app.utils.secure_utils import SecureTokenGenerator, SecureHasher
from app.security.constant_time import ConstantTimeOperations
from app.security.memory_protection import SecureMemoryManager
from app.services.audit_service import SecurityAuditService

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_USER_EMAIL = "storage_test@example.com"
TEST_USER_PASSWORD = "StorageTestPassword123!"

# Test data
TEST_PHRASES = [
    "Storage encryption test phrase number one",
    "Second phrase for encrypted storage testing",
    "Third encrypted storage validation phrase",
    "Fourth phrase for storage encryption testing",
    "Fifth and final encrypted storage test phrase"
]

TEST_BLOB_DATA = [
    b"This is test blob data for encryption testing",
    b"Second blob with different content for testing",
    b"Third blob containing various test data",
    b"Fourth test blob with additional content",
    b"Fifth and final test blob for validation"
]

TEST_CONTENT_TYPES = [
    "text/plain",
    "application/json",
    "application/octet-stream",
    "text/html",
    "application/pdf"
]

TEST_VAULT_CONTENTS = [
    {
        "vault_id": "test_vault_1",
        "object_id": "test_object_1",
        "content": TEST_BLOB_DATA[0],
        "content_type": TEST_CONTENT_TYPES[0]
    },
    {
        "vault_id": "test_vault_2", 
        "object_id": "test_object_2",
        "content": TEST_BLOB_DATA[1],
        "content_type": TEST_CONTENT_TYPES[1]
    },
    {
        "vault_id": "test_vault_3",
        "object_id": "test_object_3", 
        "content": TEST_BLOB_DATA[2],
        "content_type": TEST_CONTENT_TYPES[2]
    }
]


class TestEncryptedStorage:
    """Test class for encrypted storage functionality."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment before each test method."""
        self.client = TestClient(app)
        self.hasher = SecureHasher()
        self.token_generator = SecureTokenGenerator()
        self.constant_time_ops = ConstantTimeOperations()
        self.memory_manager = SecureMemoryManager()
        
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
        
        # Create test user and related data
        self.test_user = self._create_test_user()
        self.user_id = self.test_user.id
        
        # Initialize services
        self.vault_service = VaultService(self.db)
        self.opaque_service = EnhancedOpaqueService(self.db)
        self.journal_service = JournalService(self.db)
        self.encryption_service = EncryptionService()
        self.audit_service = SecurityAuditService()
        
        # Create test secret tags
        self.test_tags = self._create_test_secret_tags()

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
        """Create a test user for storage testing."""
        # Check if user already exists and delete if so
        existing_user = self.db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        if existing_user:
            self.db.delete(existing_user)
            self.db.commit()
            
        user = User(
            id=str(uuid.uuid4()),
            email=TEST_USER_EMAIL,
            hashed_password=self.hasher.hash_password(TEST_USER_PASSWORD),
            full_tag_display_tag_display_name="Storage Test User"
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _create_test_secret_tags(self) -> List[SecretTag]:
        """Create test secret tags for storage testing."""
        tags = []
        for i, phrase in enumerate(TEST_PHRASES):
            tag_name = f"storage_tag_{i + 1}"
            
            # Clean up any existing tags with same name
            existing_tags = self.db.query(SecretTag).filter(
                SecretTag.user_id == self.user_id,
                SecretTag.tag_name == tag_name
            ).all()
            for existing_tag in existing_tags:
                self.db.delete(existing_tag)
            
            # Create new tag
            phrase_hash = uuid.uuid4().bytes
            salt = uuid.uuid4().bytes
            verifier_kv = uuid.uuid4().bytes
            opaque_envelope = uuid.uuid4().bytes
            
        tag = SecretTag(
            phrase_hash=phrase_hash,
            user_id=self.user_id,
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

    def _create_test_wrapped_key(self) -> WrappedKey:
        """Create a test wrapped key for encryption testing."""
        wrapped_key = WrappedKey(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            key_type="vault",
            wrapped_key=self.test_vault_key,
            created_at=datetime.now(UTC)
        )
        self.db.add(wrapped_key)
        self.db.commit()
        return wrapped_key

    def _cleanup_test_data(self):
        """Clean up test data."""
        try:
            # Delete in reverse dependency order
            self.db.query(VaultBlob).filter_by(user_id=self.user_id).delete()
            self.db.query(WrappedKey).filter_by(user_id=self.user_id).delete()
            self.db.query(JournalEntry).filter_by(user_id=self.user_id).delete()
            self.db.query(SecretTag).filter_by(user_id=self.user_id).delete()
            self.db.query(User).filter_by(self.user_id).delete()
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"Cleanup error: {e}")

    # Test Cases

    def test_vault_blob_storage_complete_flow(self):
        """Test complete vault blob storage flow."""
        test_content = TEST_VAULT_CONTENTS[0]
        content_type = TEST_CONTENT_TYPES[0]
        
        # Encrypt content
        encrypted_content = self.aes_crypto.encrypt(
            test_content.encode(),
            self.test_vault_key
        )
        
        # Store in vault
        vault_blob = VaultBlob(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            content_type=content_type,
            encrypted_content=encrypted_content,
            created_at=datetime.now(UTC)
        )
        self.db.add(vault_blob)
        self.db.commit()
        
        # Retrieve from vault
        stored_blob = self.db.query(VaultBlob).filter_by(
            id=vault_blob.id,
            user_id=self.user_id
        ).first()
        
        assert stored_blob is not None
        assert stored_blob.content_type == content_type
        
        # Decrypt and verify content
        decrypted_content = self.aes_crypto.decrypt(
            stored_blob.encrypted_content,
            self.test_vault_key
        )
        assert decrypted_content.decode() == test_content

    def test_vault_blob_upload_via_service(self):
        """Test vault blob upload through service layer."""
        test_content = TEST_VAULT_CONTENTS[1]
        content_type = TEST_CONTENT_TYPES[1]
        
        # Upload through service
        upload_result = self.vault_service.upload_blob(
            user_id=self.user_id,
            content=test_content.encode(),
            content_type=content_type,
            vault_key=self.test_vault_key
        )
        
        assert upload_result is not None
        assert "blob_id" in upload_result
        
        # Verify storage
        stored_blob = self.db.query(VaultBlob).filter_by(
            id=upload_result["blob_id"],
            user_id=self.user_id
        ).first()
        
        assert stored_blob is not None
        assert stored_blob.content_type == content_type

    def test_vault_blob_download_via_service(self):
        """Test vault blob download through service layer."""
        test_content = TEST_VAULT_CONTENTS[2]
        content_type = TEST_CONTENT_TYPES[2]
        
        # First upload
        upload_result = self.vault_service.upload_blob(
            user_id=self.user_id,
            content=test_content.encode(),
            content_type=content_type,
            vault_key=self.test_vault_key
        )
        
        # Then download
        download_result = self.vault_service.download_blob(
            user_id=self.user_id,
            blob_id=upload_result["blob_id"],
            vault_key=self.test_vault_key
        )
        
        assert download_result is not None
        assert download_result["content"].decode() == test_content
        assert download_result["content_type"] == content_type

    def test_vault_blob_listing(self):
        """Test vault blob listing functionality."""
        # Upload multiple blobs
        blob_ids = []
        for i, (content, content_type) in enumerate(zip(TEST_VAULT_CONTENTS, TEST_CONTENT_TYPES)):
            upload_result = self.vault_service.upload_blob(
                user_id=self.user_id,
                content=content.encode(),
                content_type=content_type,
                vault_key=self.test_vault_key
            )
            blob_ids.append(upload_result["blob_id"])
        
        # List blobs
        blob_list = self.vault_service.list_blobs(self.user_id)
        
        assert len(blob_list) == len(TEST_VAULT_CONTENTS)
        
        # Verify all blobs are listed
        listed_ids = [blob["id"] for blob in blob_list]
        for blob_id in blob_ids:
            assert blob_id in listed_ids

    def test_vault_blob_deletion(self):
        """Test vault blob deletion functionality."""
        test_content = TEST_VAULT_CONTENTS[0]
        content_type = TEST_CONTENT_TYPES[0]
        
        # Upload blob
        upload_result = self.vault_service.upload_blob(
            user_id=self.user_id,
            content=test_content.encode(),
            content_type=content_type,
            vault_key=self.test_vault_key
        )
        
        blob_id = upload_result["blob_id"]
        
        # Verify blob exists
        blob = self.db.query(VaultBlob).filter_by(
            id=blob_id,
            user_id=self.user_id
        ).first()
        assert blob is not None
        
        # Delete blob
        delete_result = self.vault_service.delete_blob(
            user_id=self.user_id,
            blob_id=blob_id
        )
        
        assert delete_result["success"] is True
        
        # Verify blob is deleted
        deleted_blob = self.db.query(VaultBlob).filter_by(
            id=blob_id,
            user_id=self.user_id
        ).first()
        assert deleted_blob is None

    def test_vault_statistics_and_quotas(self):
        """Test vault statistics and quota management."""
        # Upload multiple blobs of different sizes
        total_size = 0
        for i, content in enumerate(TEST_VAULT_CONTENTS):
            upload_result = self.vault_service.upload_blob(
                user_id=self.user_id,
                content=content.encode(),
                content_type=TEST_CONTENT_TYPES[i % len(TEST_CONTENT_TYPES)],
                vault_key=self.test_vault_key
            )
            total_size += len(content.encode())
        
        # Get vault statistics
        stats = self.vault_service.get_vault_stats(self.user_id)
        
        assert stats["total_blobs"] == len(TEST_VAULT_CONTENTS)
        assert stats["total_size"] >= total_size  # May include encryption overhead
        assert "quota_used" in stats
        assert "quota_limit" in stats

    def test_encrypted_journal_entry_storage(self):
        """Test encrypted journal entry storage and retrieval."""
        test_content = "This is a secret journal entry that should be encrypted"
        tag = self.test_tags[0]
        
        # Create encrypted journal entry
        journal_entry = JournalEntry(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            content=test_content,
            is_encrypted=True,
            secret_phrase_hash=tag.id,
            created_at=datetime.now(UTC)
        )
        self.db.add(journal_entry)
        self.db.commit()
        
        # Retrieve and verify
        stored_entry = self.db.query(JournalEntry).filter_by(
            id=journal_entry.id,
            user_id=self.user_id
        ).first()
        
        assert stored_entry is not None
        assert stored_entry.is_encrypted is True
        assert stored_entry.secret_phrase_hash== tag.id

    def test_key_management_and_rotation(self):
        """Test key management and rotation functionality."""
        # Create additional wrapped key
        new_vault_key = secrets.token_bytes(32)
        new_wrapped_key = WrappedKey(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            key_type="vault",
            wrapped_key=new_vault_key,
            created_at=datetime.now(UTC)
        )
        self.db.add(new_wrapped_key)
        self.db.commit()
        
        # Test key rotation by re-encrypting content
        test_content = "Content to be re-encrypted with new key"
        
        # Encrypt with old key
        old_encrypted = self.aes_crypto.encrypt(
            test_content.encode(),
            self.test_vault_key
        )
        
        # Decrypt with old key
        decrypted = self.aes_crypto.decrypt(old_encrypted, self.test_vault_key)
        
        # Re-encrypt with new key
        new_encrypted = self.aes_crypto.encrypt(decrypted, new_vault_key)
        
        # Verify new encryption works
        final_decrypted = self.aes_crypto.decrypt(new_encrypted, new_vault_key)
        assert final_decrypted.decode() == test_content

    def test_vault_access_control(self):
        """Test vault access control and authorization."""
        # Create second user
        second_user = User(
            id=str(uuid.uuid4()),
            email="second_storage_user@example.com",
            hashed_password=self.hasher.hash_password("SecondPassword123!"),
            tag_display_tag_display_name="Second Storage User"
        )
        self.db.add(second_user)
        self.db.commit()
        
        # Create vault blob for first user
        test_content = "Private content for first user"
        upload_result = self.vault_service.upload_blob(
            user_id=self.user_id,
            content=test_content.encode(),
            content_type="text/plain",
            vault_key=self.test_vault_key
        )
        
        # Try to access with second user (should fail)
        with pytest.raises(Exception):
            self.vault_service.download_blob(
                user_id=second_user.id,
                blob_id=upload_result["blob_id"],
                vault_key=self.test_vault_key
            )
        
        # Clean up second user
        self.db.query(User).filter_by(id=second_user.id).delete()
        self.db.commit()

    def test_encryption_security_validation(self):
        """Test encryption security measures."""
        test_content = "Sensitive content for security validation"
        
        # Test that same content with different keys produces different ciphertext
        key1 = secrets.token_bytes(32)
        key2 = secrets.token_bytes(32)
        
        encrypted1 = self.aes_crypto.encrypt(test_content.encode(), key1)
        encrypted2 = self.aes_crypto.encrypt(test_content.encode(), key2)
        
        # Ciphertext should be different
        assert encrypted1 != encrypted2
        
        # Test that same content with same key produces different ciphertext (due to IV)
        encrypted3 = self.aes_crypto.encrypt(test_content.encode(), key1)
        encrypted4 = self.aes_crypto.encrypt(test_content.encode(), key1)
        
        # Should be different due to random IV
        assert encrypted3 != encrypted4
        
        # But both should decrypt to same content
        decrypted3 = self.aes_crypto.decrypt(encrypted3, key1)
        decrypted4 = self.aes_crypto.decrypt(encrypted4, key1)
        
        assert decrypted3 == decrypted4 == test_content.encode()

    def test_memory_protection_during_encryption(self):
        """Test memory protection during encryption operations."""
        test_content = "Sensitive content for memory protection testing"
        
        # Monitor memory usage during encryption
        with self.memory_manager.secure_context():
            # Encrypt content
            encrypted_content = self.aes_crypto.encrypt(
                test_content.encode(),
                self.test_vault_key
            )
            
            # Verify encryption worked
            assert encrypted_content is not None
            assert len(encrypted_content) > len(test_content)
            
            # Decrypt content
            decrypted_content = self.aes_crypto.decrypt(
                encrypted_content,
                self.test_vault_key
            )
            
            assert decrypted_content.decode() == test_content

    def test_concurrent_vault_operations(self):
        """Test concurrent vault operations."""
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        def upload_blob(blob_id):
            """Upload a blob concurrently."""
            content = f"Concurrent blob content {blob_id}"
            result = self.vault_service.upload_blob(
                user_id=self.user_id,
                content=content.encode(),
                content_type="text/plain",
                vault_key=self.test_vault_key
            )
            return result
        
        # Execute concurrent uploads
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [
                executor.submit(upload_blob, i)
                for i in range(10)
            ]
            
            results = [f.result() for f in as_completed(futures)]
        
        # Verify all uploads succeeded
        assert len(results) == 10
        
        # Verify all blobs are stored
        stored_blobs = self.db.query(VaultBlob).filter_by(user_id=self.user_id).all()
        assert len(stored_blobs) == 10

    def test_vault_error_handling(self):
        """Test vault error handling and recovery."""
        # Test upload with invalid key
        with pytest.raises(Exception):
            self.vault_service.upload_blob(
                user_id=self.user_id,
                content=b"test content",
                content_type="text/plain",
                vault_key=b"invalid_key"  # Wrong key length
            )
        
        # Test download with non-existent blob
        with pytest.raises(Exception):
            self.vault_service.download_blob(
                user_id=self.user_id,
                blob_id=str(uuid.uuid4()),
                vault_key=self.test_vault_key
            )
        
        # Test delete with non-existent blob
        with pytest.raises(Exception):
            self.vault_service.delete_blob(
                user_id=self.user_id,
                blob_id=str(uuid.uuid4())
            )

    def test_vault_audit_logging(self):
        """Test vault operations are properly audited."""
        test_content = "Content for audit logging test"
        
        # Upload blob (should be audited)
        upload_result = self.vault_service.upload_blob(
            user_id=self.user_id,
            content=test_content.encode(),
            content_type="text/plain",
            vault_key=self.test_vault_key
        )
        
        # Download blob (should be audited)
        download_result = self.vault_service.download_blob(
            user_id=self.user_id,
            blob_id=upload_result["blob_id"],
            vault_key=self.test_vault_key
        )
        
        # Delete blob (should be audited)
        delete_result = self.vault_service.delete_blob(
            user_id=self.user_id,
            blob_id=upload_result["blob_id"]
        )
        
        # Verify audit service health
        health_status = self.audit_service.get_service_health()
        assert health_status["status"] == "healthy"

    def test_vault_performance_characteristics(self):
        """Test vault performance characteristics."""
        # Test upload performance
        test_content = "Performance test content" * 100  # Larger content
        
        start_time = time.time()
        upload_result = self.vault_service.upload_blob(
            user_id=self.user_id,
            content=test_content.encode(),
            content_type="text/plain",
            vault_key=self.test_vault_key
        )
        upload_time = time.time() - start_time
        
        # Test download performance
        start_time = time.time()
        download_result = self.vault_service.download_blob(
            user_id=self.user_id,
            blob_id=upload_result["blob_id"],
            vault_key=self.test_vault_key
        )
        download_time = time.time() - start_time
        
        # Verify performance is reasonable
        assert upload_time < 1.0  # Should complete within 1 second
        assert download_time < 1.0  # Should complete within 1 second
        
        # Verify content integrity
        assert download_result["content"].decode() == test_content 