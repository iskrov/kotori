"""
Unit tests for deterministic key derivation implementation.
"""

import pytest
from app.crypto.key_derivation import (
    OpaqueKeys,
    derive_opaque_keys_from_phrase,
    derive_opaque_keys_with_known_salt,
    verify_tag_id_matches_phrase,
    benchmark_key_derivation,
    validate_opaque_keys
)
from app.crypto.config import Argon2Config, Environment
from app.crypto.errors import InvalidInputError, KeyDerivationError


class TestOpaqueKeys:
    """Test cases for OpaqueKeys data class."""
    
    def test_valid_opaque_keys(self):
        """Test creation of valid OpaqueKeys."""
        keys = OpaqueKeys(
            tag_id=b'x' * 16,
            verification_key=b'y' * 32,
            encryption_key=b'z' * 32,
            salt=b'a' * 16
        )
        
        assert len(keys.tag_id) == 16
        assert len(keys.verification_key) == 32
        assert len(keys.encryption_key) == 32
        assert len(keys.salt) == 16
    
    def test_invalid_tag_id_length(self):
        """Test validation of TagID length."""
        with pytest.raises(ValueError) as exc_info:
            OpaqueKeys(
                tag_id=b'x' * 15,  # Wrong length
                verification_key=b'y' * 32,
                encryption_key=b'z' * 32,
                salt=b'a' * 16
            )
        
        assert "TagID must be 16 bytes" in str(exc_info.value)
    
    def test_invalid_verification_key_length(self):
        """Test validation of verification key length."""
        with pytest.raises(ValueError) as exc_info:
            OpaqueKeys(
                tag_id=b'x' * 16,
                verification_key=b'y' * 31,  # Wrong length
                encryption_key=b'z' * 32,
                salt=b'a' * 16
            )
        
        assert "Verification key must be 32 bytes" in str(exc_info.value)
    
    def test_invalid_encryption_key_length(self):
        """Test validation of encryption key length."""
        with pytest.raises(ValueError) as exc_info:
            OpaqueKeys(
                tag_id=b'x' * 16,
                verification_key=b'y' * 32,
                encryption_key=b'z' * 31,  # Wrong length
                salt=b'a' * 16
            )
        
        assert "Encryption key must be 32 bytes" in str(exc_info.value)
    
    def test_invalid_salt_length(self):
        """Test validation of salt length."""
        with pytest.raises(ValueError) as exc_info:
            OpaqueKeys(
                tag_id=b'x' * 16,
                verification_key=b'y' * 32,
                encryption_key=b'z' * 32,
                salt=b'a' * 15  # Wrong length
            )
        
        assert "Salt must be 16 bytes" in str(exc_info.value)


class TestDeriveOpaqueKeysFromPhrase:
    """Test cases for derive_opaque_keys_from_phrase function."""
    
    def test_basic_key_derivation(self):
        """Test basic key derivation functionality."""
        password_phrase = "test secret phrase"
        keys = derive_opaque_keys_from_phrase(password_phrase)
        
        # Verify all keys are generated with correct lengths
        assert len(keys.tag_id) == 16
        assert len(keys.verification_key) == 32
        assert len(keys.encryption_key) == 32
        assert len(keys.salt) == 16
        
        # Verify keys are not empty
        assert keys.tag_id != b'\x00' * 16
        assert keys.verification_key != b'\x00' * 32
        assert keys.encryption_key != b'\x00' * 32
        assert keys.salt != b'\x00' * 16
    
    def test_deterministic_tag_id(self):
        """Test that TagID is deterministic (same for same phrase)."""
        password_phrase = "test secret phrase"
        
        keys1 = derive_opaque_keys_from_phrase(password_phrase)
        keys2 = derive_opaque_keys_from_phrase(password_phrase)
        
        # TagID should be the same (deterministic)
        assert keys1.tag_id == keys2.tag_id
        
        # But other keys should be different (random salts)
        assert keys1.salt != keys2.salt
        assert keys1.verification_key != keys2.verification_key
        assert keys1.encryption_key != keys2.encryption_key
    
    def test_deterministic_with_same_salt(self):
        """Test that same phrase and salt produce identical keys."""
        password_phrase = "test secret phrase"
        salt = b"fixed_salt_16byt"
        
        keys1 = derive_opaque_keys_from_phrase(password_phrase, salt)
        keys2 = derive_opaque_keys_from_phrase(password_phrase, salt)
        
        # All keys should be identical
        assert keys1.tag_id == keys2.tag_id
        assert keys1.verification_key == keys2.verification_key
        assert keys1.encryption_key == keys2.encryption_key
        assert keys1.salt == keys2.salt
    
    def test_different_phrases_different_keys(self):
        """Test that different phrases produce different keys."""
        salt = b"fixed_salt_16byt"
        
        keys1 = derive_opaque_keys_from_phrase("phrase one", salt)
        keys2 = derive_opaque_keys_from_phrase("phrase two", salt)
        
        # All keys should be different
        assert keys1.tag_id != keys2.tag_id
        assert keys1.verification_key != keys2.verification_key
        assert keys1.encryption_key != keys2.encryption_key
        assert keys1.salt == keys2.salt  # Same salt
    
    def test_verification_and_encryption_keys_different(self):
        """Test that verification and encryption keys are different."""
        password_phrase = "test secret phrase"
        keys = derive_opaque_keys_from_phrase(password_phrase)
        
        assert keys.verification_key != keys.encryption_key
    
    def test_custom_config(self):
        """Test key derivation with custom configuration."""
        password_phrase = "test secret phrase"
        config = Argon2Config.for_environment(Environment.DEVELOPMENT)
        
        keys = derive_opaque_keys_from_phrase(password_phrase, config=config)
        
        # Should still produce valid keys
        assert len(keys.tag_id) == 16
        assert len(keys.verification_key) == 32
        assert len(keys.encryption_key) == 32
        assert len(keys.salt) == 16
    
    def test_invalid_password_phrase_type(self):
        """Test error handling for invalid password phrase type."""
        with pytest.raises(InvalidInputError) as exc_info:
            derive_opaque_keys_from_phrase(123)  # Should be string
        
        assert "Password phrase must be string" in str(exc_info.value)
    
    def test_empty_password_phrase(self):
        """Test error handling for empty password phrase."""
        with pytest.raises(InvalidInputError) as exc_info:
            derive_opaque_keys_from_phrase("")
        
        assert "Password phrase cannot be empty" in str(exc_info.value)
    
    def test_whitespace_only_password_phrase(self):
        """Test error handling for whitespace-only password phrase."""
        with pytest.raises(InvalidInputError) as exc_info:
            derive_opaque_keys_from_phrase("   ")
        
        assert "Password phrase cannot be empty" in str(exc_info.value)
    
    def test_invalid_salt_type(self):
        """Test error handling for invalid salt type."""
        with pytest.raises(InvalidInputError) as exc_info:
            derive_opaque_keys_from_phrase("test phrase", salt="string_salt")
        
        assert "Salt must be bytes" in str(exc_info.value)
    
    def test_invalid_salt_length(self):
        """Test error handling for invalid salt length."""
        with pytest.raises(InvalidInputError) as exc_info:
            derive_opaque_keys_from_phrase("test phrase", salt=b"short")
        
        assert "Salt must be 16 bytes" in str(exc_info.value)
    
    def test_phrase_normalization(self):
        """Test that password phrases are normalized (whitespace stripped)."""
        phrase1 = "test phrase"
        phrase2 = "  test phrase  "
        
        keys1 = derive_opaque_keys_from_phrase(phrase1)
        keys2 = derive_opaque_keys_from_phrase(phrase2)
        
        # TagID should be the same after normalization
        assert keys1.tag_id == keys2.tag_id


class TestDeriveOpaqueKeysWithKnownSalt:
    """Test cases for derive_opaque_keys_with_known_salt function."""
    
    def test_known_salt_derivation(self):
        """Test key derivation with known salt."""
        password_phrase = "test secret phrase"
        salt = b"known_salt_16byt"
        
        keys = derive_opaque_keys_with_known_salt(password_phrase, salt)
        
        # Verify keys are generated correctly
        assert len(keys.tag_id) == 16
        assert len(keys.verification_key) == 32
        assert len(keys.encryption_key) == 32
        assert keys.salt == salt
    
    def test_invalid_salt_type(self):
        """Test error handling for invalid salt type."""
        with pytest.raises(InvalidInputError) as exc_info:
            derive_opaque_keys_with_known_salt("test phrase", "string_salt")
        
        assert "Salt must be 16 bytes" in str(exc_info.value)
    
    def test_invalid_salt_length(self):
        """Test error handling for invalid salt length."""
        with pytest.raises(InvalidInputError) as exc_info:
            derive_opaque_keys_with_known_salt("test phrase", b"short")
        
        assert "Salt must be 16 bytes" in str(exc_info.value)


class TestVerifyTagIdMatchesPhrase:
    """Test cases for verify_tag_id_matches_phrase function."""
    
    def test_successful_verification(self):
        """Test successful TagID verification."""
        password_phrase = "test secret phrase"
        keys = derive_opaque_keys_from_phrase(password_phrase)
        
        result = verify_tag_id_matches_phrase(keys.tag_id, password_phrase)
        assert result is True
    
    def test_failed_verification_wrong_phrase(self):
        """Test failed verification with wrong phrase."""
        password_phrase = "test secret phrase"
        wrong_phrase = "wrong secret phrase"
        keys = derive_opaque_keys_from_phrase(password_phrase)
        
        result = verify_tag_id_matches_phrase(keys.tag_id, wrong_phrase)
        assert result is False
    
    def test_failed_verification_wrong_tag_id(self):
        """Test failed verification with wrong TagID."""
        password_phrase = "test secret phrase"
        wrong_tag_id = b"wrong_tag_id_16b"
        
        result = verify_tag_id_matches_phrase(wrong_tag_id, password_phrase)
        assert result is False
    
    def test_invalid_tag_id_type(self):
        """Test error handling for invalid TagID type."""
        with pytest.raises(InvalidInputError) as exc_info:
            verify_tag_id_matches_phrase("string_tag_id", "test phrase")
        
        assert "TagID must be bytes" in str(exc_info.value)
    
    def test_invalid_tag_id_length(self):
        """Test error handling for invalid TagID length."""
        with pytest.raises(InvalidInputError) as exc_info:
            verify_tag_id_matches_phrase(b"short", "test phrase")
        
        assert "TagID must be 16 bytes" in str(exc_info.value)


class TestValidateOpaqueKeys:
    """Test cases for validate_opaque_keys function."""
    
    def test_valid_keys(self):
        """Test validation of valid keys."""
        keys = OpaqueKeys(
            tag_id=b'x' * 16,
            verification_key=b'y' * 32,
            encryption_key=b'z' * 32,
            salt=b'a' * 16
        )
        
        # Should not raise any exception
        validate_opaque_keys(keys)
    
    def test_invalid_type(self):
        """Test validation with invalid type."""
        with pytest.raises(InvalidInputError) as exc_info:
            validate_opaque_keys("not_opaque_keys")
        
        assert "Must be OpaqueKeys instance" in str(exc_info.value)
    
    def test_all_zero_tag_id(self):
        """Test validation rejects all-zero TagID."""
        keys = OpaqueKeys(
            tag_id=b'\x00' * 16,  # All zeros
            verification_key=b'y' * 32,
            encryption_key=b'z' * 32,
            salt=b'a' * 16
        )
        
        with pytest.raises(InvalidInputError) as exc_info:
            validate_opaque_keys(keys)
        
        assert "TagID cannot be all zeros" in str(exc_info.value)
    
    def test_all_zero_verification_key(self):
        """Test validation rejects all-zero verification key."""
        keys = OpaqueKeys(
            tag_id=b'x' * 16,
            verification_key=b'\x00' * 32,  # All zeros
            encryption_key=b'z' * 32,
            salt=b'a' * 16
        )
        
        with pytest.raises(InvalidInputError) as exc_info:
            validate_opaque_keys(keys)
        
        assert "Verification key cannot be all zeros" in str(exc_info.value)
    
    def test_all_zero_encryption_key(self):
        """Test validation rejects all-zero encryption key."""
        keys = OpaqueKeys(
            tag_id=b'x' * 16,
            verification_key=b'y' * 32,
            encryption_key=b'\x00' * 32,  # All zeros
            salt=b'a' * 16
        )
        
        with pytest.raises(InvalidInputError) as exc_info:
            validate_opaque_keys(keys)
        
        assert "Encryption key cannot be all zeros" in str(exc_info.value)
    
    def test_identical_verification_and_encryption_keys(self):
        """Test validation rejects identical verification and encryption keys."""
        same_key = b'y' * 32
        keys = OpaqueKeys(
            tag_id=b'x' * 16,
            verification_key=same_key,
            encryption_key=same_key,  # Same as verification key
            salt=b'a' * 16
        )
        
        with pytest.raises(InvalidInputError) as exc_info:
            validate_opaque_keys(keys)
        
        assert "Verification and encryption keys must be different" in str(exc_info.value)


class TestBenchmarkKeyDerivation:
    """Test cases for benchmark_key_derivation function."""
    
    def test_basic_benchmark(self):
        """Test basic benchmarking functionality."""
        config = Argon2Config.for_environment(Environment.DEVELOPMENT)
        
        results = benchmark_key_derivation(
            password_phrase="benchmark phrase",
            iterations=2,
            config=config
        )
        
        # Verify all timing components are present
        expected_components = ['tag_id', 'argon2id', 'hkdf_verify', 'hkdf_encrypt', 'total']
        for component in expected_components:
            assert component in results
            assert isinstance(results[component], float)
            assert results[component] >= 0
    
    def test_benchmark_invalid_iterations(self):
        """Test benchmark with invalid iterations."""
        with pytest.raises(InvalidInputError) as exc_info:
            benchmark_key_derivation(iterations=0)
        
        assert "Iterations must be positive" in str(exc_info.value)


class TestSpecificationCompliance:
    """Test cases to verify compliance with OPAQUE specification."""
    
    def test_key_schedule_specification(self):
        """Test that key derivation follows the exact specification."""
        password_phrase = "test secret phrase"
        salt = b"spec_test_salt16"
        
        keys = derive_opaque_keys_from_phrase(password_phrase, salt)
        
        # Verify the specification requirements:
        # - TagID = first16(BLAKE2s(P)) — 128-bit, salt-free
        # - S = Argon2id(P, salt, ...)
        # - Kv = HKDF(S, "verify") — 32 B
        # - Ke = HKDF(S, "encrypt") — 32 B
        
        assert len(keys.tag_id) == 16      # 128-bit TagID
        assert len(keys.verification_key) == 32  # 32-byte Kv
        assert len(keys.encryption_key) == 32    # 32-byte Ke
        assert len(keys.salt) == 16       # 16-byte salt
        
        # TagID should be deterministic (salt-free)
        keys2 = derive_opaque_keys_from_phrase(password_phrase, b"different_salt16")
        assert keys.tag_id == keys2.tag_id  # Same TagID despite different salt
        
        # Kv and Ke should be different with different salts
        assert keys.verification_key != keys2.verification_key
        assert keys.encryption_key != keys2.encryption_key
    
    def test_environment_configurations(self):
        """Test that different environments use appropriate parameters."""
        password_phrase = "test secret phrase"
        salt = b"env_test_salt_16"
        
        # Test development configuration (fast)
        dev_config = Argon2Config.for_environment(Environment.DEVELOPMENT)
        dev_keys = derive_opaque_keys_from_phrase(password_phrase, salt, dev_config)
        
        # Test production configuration (secure)
        prod_config = Argon2Config.for_environment(Environment.PRODUCTION)
        prod_keys = derive_opaque_keys_from_phrase(password_phrase, salt, prod_config)
        
        # TagID should be the same (deterministic)
        assert dev_keys.tag_id == prod_keys.tag_id
        
        # But derived keys should be different (different Argon2id parameters)
        assert dev_keys.verification_key != prod_keys.verification_key
        assert dev_keys.encryption_key != prod_keys.encryption_key 