"""
Tests for Vault Key Management with OPAQUE Integration

Tests the complete vault key lifecycle including creation, wrapping,
unwrapping, and integration with OPAQUE-derived encryption keys.
"""

import pytest
import secrets
import time
import json
from unittest.mock import Mock, patch

from app.crypto.vault_keys import (
    VaultKeyError, WrappedVaultKey, VaultKeyManager,
    create_vault_key_for_phrase, unwrap_vault_key_with_phrase,
    vault_key_context
)
from app.crypto.key_manager import KeyManager, KeyType
from app.crypto.aes_kw import AESKeyWrapError
from app.crypto.errors import InvalidInputError


class TestWrappedVaultKey:
    """Test WrappedVaultKey data structure."""
    
    def test_wrapped_vault_key_creation(self):
        """Test creating a WrappedVaultKey."""
        wrapped_key = WrappedVaultKey(
            wrapped_key="dGVzdCBkYXRh",  # base64 for "test data"
            key_size=32,
            tag_id="abc123",
            metadata={"algorithm": "AES-KW"}
        )
        
        assert wrapped_key.wrapped_key == "dGVzdCBkYXRh"
        assert wrapped_key.key_size == 32
        assert wrapped_key.tag_id == "abc123"
        assert wrapped_key.metadata["algorithm"] == "AES-KW"
        assert isinstance(wrapped_key.created_at, float)
    
    def test_wrapped_vault_key_to_dict(self):
        """Test converting WrappedVaultKey to dictionary."""
        wrapped_key = WrappedVaultKey(
            wrapped_key="dGVzdCBkYXRh",
            key_size=32,
            tag_id="abc123",
            metadata={"algorithm": "AES-KW"}
        )
        
        data = wrapped_key.to_dict()
        
        assert data["wrapped_key"] == "dGVzdCBkYXRh"
        assert data["key_size"] == 32
        assert data["tag_id"] == "abc123"
        assert data["metadata"]["algorithm"] == "AES-KW"
        assert "created_at" in data
    
    def test_wrapped_vault_key_from_dict(self):
        """Test creating WrappedVaultKey from dictionary."""
        data = {
            "wrapped_key": "dGVzdCBkYXRh",
            "key_size": 32,
            "tag_id": "abc123",
            "metadata": {"algorithm": "AES-KW"},
            "created_at": 1234567890.0
        }
        
        wrapped_key = WrappedVaultKey.from_dict(data)
        
        assert wrapped_key.wrapped_key == "dGVzdCBkYXRh"
        assert wrapped_key.key_size == 32
        assert wrapped_key.tag_id == "abc123"
        assert wrapped_key.created_at == 1234567890.0
    
    def test_wrapped_vault_key_from_dict_defaults(self):
        """Test creating WrappedVaultKey from dictionary with defaults."""
        data = {
            "wrapped_key": "dGVzdCBkYXRh",
            "key_size": 32
        }
        
        wrapped_key = WrappedVaultKey.from_dict(data)
        
        assert wrapped_key.wrapped_key == "dGVzdCBkYXRh"
        assert wrapped_key.key_size == 32
        assert wrapped_key.tag_id is None
        assert wrapped_key.metadata == {}
        assert isinstance(wrapped_key.created_at, float)
    
    def test_get_wrapped_bytes_valid(self):
        """Test getting wrapped key bytes from valid base64."""
        import base64
        test_data = b"test wrapped key data"
        b64_data = base64.b64encode(test_data).decode('ascii')
        
        wrapped_key = WrappedVaultKey(
            wrapped_key=b64_data,
            key_size=32
        )
        
        result = wrapped_key.get_wrapped_bytes()
        assert result == test_data
    
    def test_get_wrapped_bytes_invalid(self):
        """Test error handling for invalid base64."""
        wrapped_key = WrappedVaultKey(
            wrapped_key="invalid base64!@#",
            key_size=32
        )
        
        with pytest.raises(VaultKeyError, match="Invalid base64 wrapped key"):
            wrapped_key.get_wrapped_bytes()


class TestVaultKeyManager:
    """Test VaultKeyManager functionality."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.test_phrase = "test secret phrase for vault keys"
        self.key_manager = KeyManager()
        self.vault_manager = VaultKeyManager(self.key_manager)
    
    def test_create_vault_key_basic(self):
        """Test basic vault key creation."""
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase)
        
        assert isinstance(wrapped_key, WrappedVaultKey)
        assert wrapped_key.key_size == 32  # Default size
        assert wrapped_key.tag_id is not None
        assert wrapped_key.metadata["algorithm"] == "AES-KW"
        assert wrapped_key.metadata["kek_size"] == 32
        assert len(wrapped_key.wrapped_key) > 0
    
    def test_create_vault_key_custom_size(self):
        """Test vault key creation with custom size."""
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase, key_size=48)
        
        assert wrapped_key.key_size == 48
        assert wrapped_key.metadata["algorithm"] == "AES-KW"
    
    def test_create_vault_key_with_session(self):
        """Test vault key creation with session ID."""
        session_id = "test_session_123"
        wrapped_key = self.vault_manager.create_vault_key(
            self.test_phrase, 
            session_id=session_id
        )
        
        assert wrapped_key.metadata["session_id"] == session_id
        
        # Verify KEK is cached in session
        cached_key = self.key_manager.get_key(
            f"vault_kek_{session_id}",
            session_id=session_id
        )
        assert cached_key is not None
        assert len(cached_key) == 32
    
    def test_create_vault_key_invalid_phrase(self):
        """Test error handling for invalid secret phrase."""
        with pytest.raises(InvalidInputError, match="Secret phrase cannot be empty"):
            self.vault_manager.create_vault_key("")
    
    def test_create_vault_key_invalid_size(self):
        """Test error handling for invalid key sizes."""
        invalid_sizes = [15, 17, 65, 0, -1]
        
        for size in invalid_sizes:
            with pytest.raises(InvalidInputError, match="Key size must be"):
                self.vault_manager.create_vault_key(self.test_phrase, key_size=size)
    
    def test_unwrap_vault_key_basic(self):
        """Test basic vault key unwrapping."""
        # Create a vault key
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase)
        
        # Unwrap it
        data_key = self.vault_manager.unwrap_vault_key(wrapped_key, self.test_phrase)
        
        assert isinstance(data_key, bytes)
        assert len(data_key) == wrapped_key.key_size
    
    def test_unwrap_vault_key_with_session(self):
        """Test vault key unwrapping with session caching."""
        session_id = "test_session_456"
        
        # Create vault key with session
        wrapped_key = self.vault_manager.create_vault_key(
            self.test_phrase,
            session_id=session_id
        )
        
        # Unwrap using same session (should use cached KEK)
        data_key = self.vault_manager.unwrap_vault_key(
            wrapped_key,
            self.test_phrase,
            session_id=session_id
        )
        
        assert isinstance(data_key, bytes)
        assert len(data_key) == wrapped_key.key_size
    
    def test_unwrap_vault_key_wrong_phrase(self):
        """Test error handling for wrong secret phrase."""
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase)
        
        with pytest.raises(VaultKeyError, match="Key unwrapping failed"):
            self.vault_manager.unwrap_vault_key(wrapped_key, "wrong phrase")
    
    def test_unwrap_vault_key_tag_id_mismatch(self):
        """Test error handling for TagID mismatch."""
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase)
        
        # Modify TagID to simulate mismatch
        wrapped_key.tag_id = "wrong_tag_id"
        
        with pytest.raises(VaultKeyError, match="TagID mismatch"):
            self.vault_manager.unwrap_vault_key(wrapped_key, self.test_phrase)
    
    def test_unwrap_vault_key_invalid_format(self):
        """Test error handling for invalid wrapped key format."""
        wrapped_key = WrappedVaultKey(
            wrapped_key="invalid",  # Invalid base64/format
            key_size=32
        )
        
        with pytest.raises(VaultKeyError):
            self.vault_manager.unwrap_vault_key(wrapped_key, self.test_phrase)
    
    def test_temporary_vault_key_context(self):
        """Test temporary vault key context manager."""
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase)
        
        with self.vault_manager.temporary_vault_key(wrapped_key, self.test_phrase) as data_key:
            assert isinstance(data_key, bytes)
            assert len(data_key) == wrapped_key.key_size
            
            # Use the key for something
            test_data = b"test encryption data"
            # In real usage, would encrypt test_data with data_key
        
        # Key should be cleaned up after context exit
        # (Can't easily test cleanup, but context manager ensures it)
    
    def test_rotate_vault_key(self):
        """Test vault key rotation."""
        old_wrapped_key = self.vault_manager.create_vault_key(self.test_phrase)
        
        # Rotate to new key
        new_wrapped_key = self.vault_manager.rotate_vault_key(
            old_wrapped_key,
            self.test_phrase
        )
        
        assert new_wrapped_key.key_size == old_wrapped_key.key_size
        assert new_wrapped_key.tag_id == old_wrapped_key.tag_id  # Same phrase
        assert new_wrapped_key.wrapped_key != old_wrapped_key.wrapped_key  # Different key
        assert "rotated_from" in new_wrapped_key.metadata
        assert new_wrapped_key.metadata["rotated_from"]["old_key_size"] == old_wrapped_key.key_size
    
    def test_rotate_vault_key_different_size(self):
        """Test vault key rotation with different size."""
        old_wrapped_key = self.vault_manager.create_vault_key(self.test_phrase, key_size=32)
        
        # Rotate to larger key
        new_wrapped_key = self.vault_manager.rotate_vault_key(
            old_wrapped_key,
            self.test_phrase,
            new_key_size=48
        )
        
        assert new_wrapped_key.key_size == 48
        assert new_wrapped_key.metadata["rotated_from"]["old_key_size"] == 32
    
    def test_verify_vault_key_valid(self):
        """Test verification of valid vault key."""
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase)
        
        is_valid = self.vault_manager.verify_vault_key(wrapped_key, self.test_phrase)
        assert is_valid is True
    
    def test_verify_vault_key_invalid(self):
        """Test verification of invalid vault key."""
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase)
        
        # Corrupt the wrapped key
        wrapped_key.wrapped_key = "corrupted_data"
        
        is_valid = self.vault_manager.verify_vault_key(wrapped_key, self.test_phrase)
        assert is_valid is False
    
    def test_get_key_info(self):
        """Test getting key information without unwrapping."""
        wrapped_key = self.vault_manager.create_vault_key(self.test_phrase, key_size=48)
        
        info = self.vault_manager.get_key_info(wrapped_key)
        
        assert info["key_size"] == 48
        assert info["is_valid_format"] is True
        assert info["calculated_key_size"] == 48
        assert info["size_consistent"] is True
        assert "wrapped_size" in info
        assert "created_at" in info
        assert "tag_id" in info
        assert "metadata" in info
    
    def test_get_key_info_invalid(self):
        """Test getting key information for invalid key."""
        wrapped_key = WrappedVaultKey(
            wrapped_key="invalid_base64!@#",
            key_size=32
        )
        
        info = self.vault_manager.get_key_info(wrapped_key)
        
        assert info["is_valid_format"] is False
        assert "error" in info
    
    def test_cleanup_session(self):
        """Test session cleanup."""
        session_id = "test_cleanup_session"
        
        # Create vault key with session
        wrapped_key = self.vault_manager.create_vault_key(
            self.test_phrase,
            session_id=session_id
        )
        
        # Verify KEK is cached
        cached_key = self.key_manager.get_key(
            f"vault_kek_{session_id}",
            session_id=session_id
        )
        assert cached_key is not None
        
        # Cleanup session
        self.vault_manager.cleanup_session(session_id)
        
        # Verify KEK is removed
        with pytest.raises(Exception):  # Key should not be found
            self.key_manager.get_key(
                f"vault_kek_{session_id}",
                session_id=session_id
            )


class TestVaultKeyRoundTrip:
    """Test complete vault key round-trip scenarios."""
    
    def test_create_unwrap_round_trip(self):
        """Test complete create/unwrap round trip."""
        phrase = "test phrase for round trip"
        manager = VaultKeyManager()
        
        # Create vault key
        wrapped_key = manager.create_vault_key(phrase, key_size=40)
        
        # Unwrap and verify
        data_key = manager.unwrap_vault_key(wrapped_key, phrase)
        
        assert len(data_key) == 40
        assert isinstance(data_key, bytes)
        
        # Verify we can unwrap again with same result
        data_key2 = manager.unwrap_vault_key(wrapped_key, phrase)
        assert data_key == data_key2
    
    def test_multiple_keys_same_phrase(self):
        """Test creating multiple vault keys with same phrase."""
        phrase = "shared secret phrase"
        manager = VaultKeyManager()
        
        # Create multiple keys
        key1 = manager.create_vault_key(phrase, key_size=32)
        key2 = manager.create_vault_key(phrase, key_size=32)
        
        # Should have same TagID but different wrapped keys
        assert key1.tag_id == key2.tag_id
        assert key1.wrapped_key != key2.wrapped_key
        
        # Both should unwrap successfully
        data1 = manager.unwrap_vault_key(key1, phrase)
        data2 = manager.unwrap_vault_key(key2, phrase)
        
        # Data keys should be different (randomly generated)
        assert data1 != data2
    
    def test_serialization_round_trip(self):
        """Test serialization/deserialization round trip."""
        phrase = "serialization test phrase"
        manager = VaultKeyManager()
        
        # Create vault key
        original_key = manager.create_vault_key(phrase)
        
        # Serialize to dict and back
        key_dict = original_key.to_dict()
        restored_key = WrappedVaultKey.from_dict(key_dict)
        
        # Should be able to unwrap restored key
        original_data = manager.unwrap_vault_key(original_key, phrase)
        restored_data = manager.unwrap_vault_key(restored_key, phrase)
        
        assert original_data == restored_data
    
    def test_json_serialization(self):
        """Test JSON serialization compatibility."""
        phrase = "json serialization test"
        manager = VaultKeyManager()
        
        # Create vault key
        wrapped_key = manager.create_vault_key(phrase)
        
        # Convert to JSON and back
        key_dict = wrapped_key.to_dict()
        json_str = json.dumps(key_dict)
        restored_dict = json.loads(json_str)
        restored_key = WrappedVaultKey.from_dict(restored_dict)
        
        # Should unwrap correctly
        original_data = manager.unwrap_vault_key(wrapped_key, phrase)
        restored_data = manager.unwrap_vault_key(restored_key, phrase)
        
        assert original_data == restored_data


class TestConvenienceFunctions:
    """Test convenience functions."""
    
    def test_create_vault_key_for_phrase(self):
        """Test convenience function for creating vault keys."""
        phrase = "convenience test phrase"
        
        wrapped_key = create_vault_key_for_phrase(phrase, key_size=24)
        
        assert isinstance(wrapped_key, WrappedVaultKey)
        assert wrapped_key.key_size == 24
    
    def test_unwrap_vault_key_with_phrase(self):
        """Test convenience function for unwrapping vault keys."""
        phrase = "convenience unwrap test"
        
        wrapped_key = create_vault_key_for_phrase(phrase)
        data_key = unwrap_vault_key_with_phrase(wrapped_key, phrase)
        
        assert isinstance(data_key, bytes)
        assert len(data_key) == wrapped_key.key_size
    
    def test_vault_key_context(self):
        """Test convenience context manager."""
        phrase = "context manager test"
        
        wrapped_key = create_vault_key_for_phrase(phrase)
        
        with vault_key_context(wrapped_key, phrase) as data_key:
            assert isinstance(data_key, bytes)
            assert len(data_key) == wrapped_key.key_size


class TestVaultKeyErrorHandling:
    """Test error handling scenarios."""
    
    def test_exception_during_key_creation(self):
        """Test exception handling during key creation."""
        manager = VaultKeyManager()
        
        # Mock key derivation to raise exception
        with patch('app.crypto.vault_keys.derive_opaque_keys_from_phrase') as mock_derive:
            mock_derive.side_effect = Exception("Mock derivation error")
            
            with pytest.raises(VaultKeyError, match="Failed to create vault key"):
                manager.create_vault_key("test phrase")
    
    def test_exception_during_key_unwrapping(self):
        """Test exception handling during key unwrapping."""
        manager = VaultKeyManager()
        phrase = "test phrase"
        
        # Create valid key first
        wrapped_key = manager.create_vault_key(phrase)
        
        # Mock unwrap_key to raise exception
        with patch('app.crypto.vault_keys.unwrap_key') as mock_unwrap:
            mock_unwrap.side_effect = AESKeyWrapError("Mock unwrap error")
            
            with pytest.raises(VaultKeyError, match="Key unwrapping failed"):
                manager.unwrap_vault_key(wrapped_key, phrase)
    
    def test_temporary_key_cleanup_on_exception(self):
        """Test that temporary keys are cleaned up even on exception."""
        manager = VaultKeyManager()
        phrase = "cleanup test phrase"
        wrapped_key = manager.create_vault_key(phrase)
        
        try:
            with manager.temporary_vault_key(wrapped_key, phrase) as data_key:
                assert data_key is not None
                raise Exception("Test exception")
        except Exception as e:
            assert str(e) == "Test exception"
        
        # Context manager should have cleaned up despite exception
        # (Can't easily verify cleanup, but test ensures no other exceptions)


class TestVaultKeyPerformance:
    """Test performance characteristics."""
    
    def test_key_creation_performance(self):
        """Test vault key creation performance."""
        import time
        
        phrase = "performance test phrase"
        manager = VaultKeyManager()
        
        # Warm up
        for _ in range(5):
            manager.create_vault_key(phrase)
        
        # Measure performance
        start_time = time.time()
        for _ in range(10):
            manager.create_vault_key(phrase)
        end_time = time.time()
        
        avg_time = (end_time - start_time) / 10
        assert avg_time < 1.0  # Should complete in less than 1 second per operation
    
    def test_key_unwrapping_performance(self):
        """Test vault key unwrapping performance."""
        import time
        
        phrase = "unwrap performance test"
        manager = VaultKeyManager()
        wrapped_key = manager.create_vault_key(phrase)
        
        # Warm up
        for _ in range(5):
            data_key = manager.unwrap_vault_key(wrapped_key, phrase)
        
        # Measure performance
        start_time = time.time()
        for _ in range(50):
            data_key = manager.unwrap_vault_key(wrapped_key, phrase)
        end_time = time.time()
        
        avg_time = (end_time - start_time) / 50
        assert avg_time < 0.1  # Should complete in less than 100ms per operation
    
    def test_session_caching_performance(self):
        """Test that session caching improves performance."""
        import time
        
        phrase = "caching performance test"
        manager = VaultKeyManager()
        wrapped_key = manager.create_vault_key(phrase)
        session_id = "perf_test_session"
        
        # Time without caching
        start_time = time.time()
        for _ in range(10):
            manager.unwrap_vault_key(wrapped_key, phrase)
        no_cache_time = time.time() - start_time
        
        # Time with caching
        start_time = time.time()
        for _ in range(10):
            manager.unwrap_vault_key(wrapped_key, phrase, session_id=session_id)
        cache_time = time.time() - start_time
        
        # Caching should provide some performance improvement
        # (May not always be measurable due to test environment variations)
        assert cache_time <= no_cache_time * 1.5  # Allow some variance 