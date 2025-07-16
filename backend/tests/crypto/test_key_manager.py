"""
Tests for Key Lifecycle Management

Tests secure key storage, session management, automatic expiration,
and comprehensive key lifecycle functionality.
"""

import pytest
import threading
import time
from datetime import datetime, timedelta, UTC
from unittest.mock import patch, MagicMock

from backend.app.crypto.key_manager import (
    KeyType,
    KeyStatus,
    KeyMetadata,
    SecureKeyStore,
    SessionKeyManager,
    secure_key_context,
    store_key,
    get_key,
    revoke_key,
    create_session,
    store_session_key,
    get_session_key,
    end_session
)
from backend.app.crypto.memory import secure_random_bytes
from backend.app.crypto.errors import MemoryError


class TestKeyType:
    """Test KeyType enumeration."""
    
    def test_key_types(self):
        """Test all key types are defined."""
        assert KeyType.VERIFICATION.value == "verification"
        assert KeyType.ENCRYPTION.value == "encryption"
        assert KeyType.OPAQUE_STATE.value == "opaque_state"
        assert KeyType.SESSION.value == "session"
        assert KeyType.TEMPORARY.value == "temporary"


class TestKeyStatus:
    """Test KeyStatus enumeration."""
    
    def test_key_statuses(self):
        """Test all key statuses are defined."""
        assert KeyStatus.ACTIVE.value == "active"
        assert KeyStatus.EXPIRED.value == "expired"
        assert KeyStatus.REVOKED.value == "revoked"
        assert KeyStatus.PENDING.value == "pending"


class TestKeyMetadata:
    """Test KeyMetadata dataclass."""
    
    def test_metadata_creation(self):
        """Test creating key metadata."""
        now = datetime.now(UTC)
        metadata = KeyMetadata(
            key_id="test-key-123",
            key_type=KeyType.ENCRYPTION,
            status=KeyStatus.ACTIVE,
            created_at=now,
            expires_at=now + timedelta(hours=1),
            session_id="session-456",
            tags={"test", "encryption"}
        )
        
        assert metadata.key_id == "test-key-123"
        assert metadata.key_type == KeyType.ENCRYPTION
        assert metadata.status == KeyStatus.ACTIVE
        assert metadata.created_at == now
        assert metadata.expires_at == now + timedelta(hours=1)
        assert metadata.session_id == "session-456"
        assert metadata.tags == {"test", "encryption"}
        assert metadata.access_count == 0
        assert metadata.last_accessed is None


class TestSecureKeyStore:
    """Test secure key storage functionality."""
    
    def test_store_and_retrieve_key(self):
        """Test basic key storage and retrieval."""
        store = SecureKeyStore(default_ttl=3600)
        test_key = secure_random_bytes(32)
        
        # Store the key
        key_id = store.store_key(test_key, KeyType.ENCRYPTION)
        assert key_id is not None
        assert len(key_id) > 0
        
        # Retrieve the key
        retrieved_key = store.retrieve_key(key_id)
        assert retrieved_key == test_key
        
        # Check metadata
        metadata = store._metadata[key_id]
        assert metadata.key_type == KeyType.ENCRYPTION
        assert metadata.status == KeyStatus.ACTIVE
        assert metadata.access_count == 1
        assert metadata.last_accessed is not None
    
    def test_store_key_with_custom_ttl(self):
        """Test storing key with custom TTL."""
        store = SecureKeyStore(default_ttl=3600)
        test_key = secure_random_bytes(32)
        
        # Store with custom TTL
        key_id = store.store_key(test_key, KeyType.VERIFICATION, ttl=1800)
        
        metadata = store._metadata[key_id]
        expected_expiry = metadata.created_at + timedelta(seconds=1800)
        
        # Allow for small timing differences
        time_diff = abs((metadata.expires_at - expected_expiry).total_seconds())
        assert time_diff < 1
    
    def test_store_key_with_session_and_tags(self):
        """Test storing key with session ID and tags."""
        store = SecureKeyStore()
        test_key = secure_random_bytes(32)
        tags = {"auth", "session"}
        
        key_id = store.store_key(
            test_key,
            KeyType.SESSION,
            session_id="session-123",
            tags=tags
        )
        
        metadata = store._metadata[key_id]
        assert metadata.session_id == "session-123"
        assert metadata.tags == tags
    
    def test_key_expiration(self):
        """Test key expiration functionality."""
        store = SecureKeyStore(default_ttl=1)  # 1 second TTL
        test_key = secure_random_bytes(32)
        
        # Store key with short TTL
        key_id = store.store_key(test_key, KeyType.TEMPORARY, ttl=1)
        
        # Key should be retrievable immediately
        retrieved_key = store.retrieve_key(key_id)
        assert retrieved_key == test_key
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Key should no longer be retrievable
        expired_key = store.retrieve_key(key_id)
        assert expired_key is None
        
        # Key should be removed from storage
        assert key_id not in store._keys
        assert key_id not in store._metadata
    
    def test_revoke_key(self):
        """Test key revocation."""
        store = SecureKeyStore()
        test_key = secure_random_bytes(32)
        
        key_id = store.store_key(test_key, KeyType.ENCRYPTION)
        
        # Key should be retrievable
        assert store.retrieve_key(key_id) == test_key
        
        # Revoke the key
        assert store.revoke_key(key_id) is True
        
        # Key should no longer be retrievable
        assert store.retrieve_key(key_id) is None
        
        # Metadata should show revoked status
        metadata = store._metadata[key_id]
        assert metadata.status == KeyStatus.REVOKED
    
    def test_remove_key(self):
        """Test key removal."""
        store = SecureKeyStore()
        test_key = secure_random_bytes(32)
        
        key_id = store.store_key(test_key, KeyType.ENCRYPTION)
        
        # Key should exist
        assert store.retrieve_key(key_id) == test_key
        
        # Remove the key
        assert store.remove_key(key_id) is True
        
        # Key should be completely gone
        assert store.retrieve_key(key_id) is None
        assert key_id not in store._keys
        assert key_id not in store._metadata
        
        # Removing non-existent key should return False
        assert store.remove_key(key_id) is False
    
    def test_list_keys(self):
        """Test listing keys with filters."""
        store = SecureKeyStore()
        
        # Store different types of keys
        key1_id = store.store_key(
            secure_random_bytes(32),
            KeyType.ENCRYPTION,
            session_id="session-1",
            tags={"auth"}
        )
        key2_id = store.store_key(
            secure_random_bytes(32),
            KeyType.VERIFICATION,
            session_id="session-1",
            tags={"auth", "server"}
        )
        key3_id = store.store_key(
            secure_random_bytes(32),
            KeyType.ENCRYPTION,
            session_id="session-2",
            tags={"temp"}
        )
        
        # List all keys
        all_keys = store.list_keys()
        assert len(all_keys) >= 3
        
        # Filter by key type
        encryption_keys = store.list_keys(key_type=KeyType.ENCRYPTION)
        encryption_ids = {meta.key_id for meta in encryption_keys}
        assert key1_id in encryption_ids
        assert key3_id in encryption_ids
        assert key2_id not in encryption_ids
        
        # Filter by session
        session1_keys = store.list_keys(session_id="session-1")
        session1_ids = {meta.key_id for meta in session1_keys}
        assert key1_id in session1_ids
        assert key2_id in session1_ids
        assert key3_id not in session1_ids
        
        # Filter by tags
        auth_keys = store.list_keys(tags={"auth"})
        auth_ids = {meta.key_id for meta in auth_keys}
        assert key1_id in auth_ids
        assert key2_id in auth_ids
        assert key3_id not in auth_ids
    
    def test_cleanup_expired(self):
        """Test cleanup of expired keys."""
        store = SecureKeyStore()
        
        # Store keys with different TTLs
        key1_id = store.store_key(secure_random_bytes(32), KeyType.TEMPORARY, ttl=1)
        key2_id = store.store_key(secure_random_bytes(32), KeyType.ENCRYPTION, ttl=3600)
        key3_id = store.store_key(secure_random_bytes(32), KeyType.TEMPORARY, ttl=1)
        
        # Wait for short-lived keys to expire
        time.sleep(1.1)
        
        # Clean up expired keys
        removed_count = store.cleanup_expired()
        assert removed_count == 2
        
        # Check that expired keys are gone
        assert store.retrieve_key(key1_id) is None
        assert store.retrieve_key(key3_id) is None
        
        # Long-lived key should still exist
        assert store.retrieve_key(key2_id) is not None
    
    def test_cleanup_session(self):
        """Test cleanup of session keys."""
        store = SecureKeyStore()
        
        # Store keys in different sessions
        key1_id = store.store_key(
            secure_random_bytes(32),
            KeyType.SESSION,
            session_id="session-1"
        )
        key2_id = store.store_key(
            secure_random_bytes(32),
            KeyType.SESSION,
            session_id="session-1"
        )
        key3_id = store.store_key(
            secure_random_bytes(32),
            KeyType.SESSION,
            session_id="session-2"
        )
        
        # Clean up session-1
        removed_count = store.cleanup_session("session-1")
        assert removed_count == 2
        
        # Session-1 keys should be gone
        assert store.retrieve_key(key1_id) is None
        assert store.retrieve_key(key2_id) is None
        
        # Session-2 key should still exist
        assert store.retrieve_key(key3_id) is not None
    
    def test_concurrent_access(self):
        """Test concurrent access to key store."""
        store = SecureKeyStore()
        results = []
        
        def worker(worker_id):
            try:
                # Store a key
                test_key = secure_random_bytes(32)
                key_id = store.store_key(test_key, KeyType.TEMPORARY)
                
                # Retrieve the key
                retrieved_key = store.retrieve_key(key_id)
                
                # Verify key integrity
                success = retrieved_key == test_key
                results.append(success)
                
                # Clean up
                store.remove_key(key_id)
                
            except Exception as e:
                results.append(False)
        
        # Start multiple workers
        threads = []
        for i in range(10):
            thread = threading.Thread(target=worker, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # All operations should succeed
        assert all(results)
        assert len(results) == 10
    
    def test_error_conditions(self):
        """Test error conditions."""
        store = SecureKeyStore()
        
        # Empty key data should raise error
        with pytest.raises(MemoryError):
            store.store_key(b"", KeyType.ENCRYPTION)
        
        # Retrieving non-existent key should return None
        assert store.retrieve_key("non-existent") is None
        
        # Revoking non-existent key should return False
        assert store.revoke_key("non-existent") is False


class TestSessionKeyManager:
    """Test session-based key management."""
    
    def test_create_session(self):
        """Test session creation."""
        manager = SessionKeyManager()
        
        session_id = manager.create_session()
        assert session_id is not None
        assert len(session_id) > 0
        
        # Session should be valid
        assert manager._is_session_valid(session_id) is True
    
    def test_create_session_with_custom_ttl(self):
        """Test session creation with custom TTL."""
        manager = SessionKeyManager()
        
        session_id = manager.create_session(session_ttl=1800)
        
        # Check session expiry time
        expires_at = manager._sessions[session_id]
        expected_expiry = datetime.now(UTC) + timedelta(seconds=1800)
        
        # Allow for small timing differences
        time_diff = abs((expires_at - expected_expiry).total_seconds())
        assert time_diff < 1
    
    def test_store_and_retrieve_session_key(self):
        """Test storing and retrieving session keys."""
        manager = SessionKeyManager()
        
        session_id = manager.create_session()
        test_key = secure_random_bytes(32)
        
        # Store key in session
        key_id = manager.store_session_key(
            session_id,
            test_key,
            KeyType.ENCRYPTION
        )
        
        # Retrieve key from session
        retrieved_key = manager.retrieve_session_key(session_id, key_id)
        assert retrieved_key == test_key
    
    def test_session_key_isolation(self):
        """Test that session keys are isolated between sessions."""
        manager = SessionKeyManager()
        
        session1_id = manager.create_session()
        session2_id = manager.create_session()
        
        test_key = secure_random_bytes(32)
        
        # Store key in session1
        key_id = manager.store_session_key(
            session1_id,
            test_key,
            KeyType.ENCRYPTION
        )
        
        # Key should be retrievable from session1
        retrieved_key = manager.retrieve_session_key(session1_id, key_id)
        assert retrieved_key == test_key
        
        # Key should NOT be retrievable from session2
        retrieved_key = manager.retrieve_session_key(session2_id, key_id)
        assert retrieved_key is None
    
    def test_end_session(self):
        """Test ending a session and cleanup."""
        manager = SessionKeyManager()
        
        session_id = manager.create_session()
        
        # Store some keys in the session
        key1_id = manager.store_session_key(
            session_id,
            secure_random_bytes(32),
            KeyType.ENCRYPTION
        )
        key2_id = manager.store_session_key(
            session_id,
            secure_random_bytes(32),
            KeyType.VERIFICATION
        )
        
        # End the session
        removed_count = manager.end_session(session_id)
        assert removed_count == 2
        
        # Session should no longer be valid
        assert manager._is_session_valid(session_id) is False
        
        # Keys should no longer be retrievable
        assert manager.retrieve_session_key(session_id, key1_id) is None
        assert manager.retrieve_session_key(session_id, key2_id) is None
    
    def test_session_expiration(self):
        """Test session expiration."""
        manager = SessionKeyManager(default_session_ttl=1)
        
        session_id = manager.create_session(session_ttl=1)
        
        # Session should be valid initially
        assert manager._is_session_valid(session_id) is True
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Session should no longer be valid
        assert manager._is_session_valid(session_id) is False
    
    def test_cleanup_expired_sessions(self):
        """Test cleanup of expired sessions."""
        manager = SessionKeyManager()
        
        # Create sessions with different TTLs
        session1_id = manager.create_session(session_ttl=1)
        session2_id = manager.create_session(session_ttl=3600)
        session3_id = manager.create_session(session_ttl=1)
        
        # Store keys in sessions
        manager.store_session_key(
            session1_id,
            secure_random_bytes(32),
            KeyType.TEMPORARY
        )
        manager.store_session_key(
            session2_id,
            secure_random_bytes(32),
            KeyType.ENCRYPTION
        )
        
        # Wait for short-lived sessions to expire
        time.sleep(1.1)
        
        # Clean up expired sessions
        removed_count = manager.cleanup_expired_sessions()
        assert removed_count == 2
        
        # Expired sessions should be gone
        assert manager._is_session_valid(session1_id) is False
        assert manager._is_session_valid(session3_id) is False
        
        # Long-lived session should still exist
        assert manager._is_session_valid(session2_id) is True
    
    def test_list_session_keys(self):
        """Test listing keys in a session."""
        manager = SessionKeyManager()
        
        session_id = manager.create_session()
        
        # Store multiple keys
        key1_id = manager.store_session_key(
            session_id,
            secure_random_bytes(32),
            KeyType.ENCRYPTION,
            tags={"primary"}
        )
        key2_id = manager.store_session_key(
            session_id,
            secure_random_bytes(32),
            KeyType.VERIFICATION,
            tags={"backup"}
        )
        
        # List session keys
        session_keys = manager.list_session_keys(session_id)
        
        assert len(session_keys) == 2
        key_ids = {meta.key_id for meta in session_keys}
        assert key1_id in key_ids
        assert key2_id in key_ids
    
    def test_invalid_session_operations(self):
        """Test operations on invalid sessions."""
        manager = SessionKeyManager()
        
        # Try to store key in non-existent session
        with pytest.raises(MemoryError):
            manager.store_session_key(
                "invalid-session",
                secure_random_bytes(32),
                KeyType.ENCRYPTION
            )
        
        # Try to retrieve key from non-existent session
        result = manager.retrieve_session_key("invalid-session", "some-key")
        assert result is None
        
        # Try to list keys from non-existent session
        keys = manager.list_session_keys("invalid-session")
        assert keys == []


class TestSecureKeyContext:
    """Test secure key context manager."""
    
    def test_secure_key_context_basic(self):
        """Test basic secure key context functionality."""
        test_key = secure_random_bytes(32)
        
        with secure_key_context(test_key) as key_id:
            # Key should be retrievable within context
            retrieved_key = get_key(key_id)
            assert retrieved_key == test_key
        
        # Key should be automatically removed after context
        retrieved_key = get_key(key_id)
        assert retrieved_key is None
    
    def test_secure_key_context_with_parameters(self):
        """Test secure key context with custom parameters."""
        test_key = secure_random_bytes(32)
        
        with secure_key_context(
            test_key,
            key_type=KeyType.ENCRYPTION,
            ttl=300
        ) as key_id:
            retrieved_key = get_key(key_id)
            assert retrieved_key == test_key
    
    def test_secure_key_context_exception_handling(self):
        """Test that keys are cleaned up even when exceptions occur."""
        test_key = secure_random_bytes(32)
        
        try:
            with secure_key_context(test_key) as key_id:
                # Key should exist
                assert get_key(key_id) == test_key
                
                # Raise an exception
                raise ValueError("Test exception")
        
        except ValueError:
            pass
        
        # Key should still be cleaned up
        retrieved_key = get_key(key_id)
        assert retrieved_key is None


class TestGlobalFunctions:
    """Test global convenience functions."""
    
    def test_global_key_operations(self):
        """Test global key store operations."""
        test_key = secure_random_bytes(32)
        
        # Store key globally
        key_id = store_key(test_key, KeyType.ENCRYPTION, ttl=3600)
        
        # Retrieve key globally
        retrieved_key = get_key(key_id)
        assert retrieved_key == test_key
        
        # Revoke key globally
        assert revoke_key(key_id) is True
        
        # Key should no longer be retrievable
        assert get_key(key_id) is None
    
    def test_global_session_operations(self):
        """Test global session management operations."""
        # Create session
        session_id = create_session(session_ttl=3600)
        
        # Store key in session
        test_key = secure_random_bytes(32)
        key_id = store_session_key(
            session_id,
            test_key,
            KeyType.SESSION
        )
        
        # Retrieve key from session
        retrieved_key = get_session_key(session_id, key_id)
        assert retrieved_key == test_key
        
        # End session
        removed_count = end_session(session_id)
        assert removed_count == 1
        
        # Key should no longer be retrievable
        assert get_session_key(session_id, key_id) is None


if __name__ == "__main__":
    pytest.main([__file__]) 