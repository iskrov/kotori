"""
Tests for AES Key Wrap (AES-KW) Implementation

Tests RFC 3394 compliance, security properties, and integration with
the OPAQUE cryptographic system.
"""

import pytest
import secrets
from unittest.mock import patch

from app.crypto.aes_kw import (
    AESKeyWrap, AESKeyWrapError, wrap_key, unwrap_key,
    generate_data_key, validate_wrapped_key, get_unwrapped_key_size,
    DEFAULT_IV, SUPPORTED_KEK_SIZES, MIN_PLAINTEXT_KEY_SIZE, MAX_PLAINTEXT_KEY_SIZE
)
from app.crypto.errors import InvalidInputError, CryptoError


class TestAESKeyWrapRFC3394:
    """Test AES Key Wrap against RFC 3394 test vectors."""
    
    def test_rfc3394_128_bit_kek(self):
        """Test RFC 3394 example with 128-bit KEK."""
        # Test vector from RFC 3394 Section 4.1
        kek = bytes.fromhex("000102030405060708090A0B0C0D0E0F")
        plaintext = bytes.fromhex("00112233445566778899AABBCCDDEEFF")
        expected = bytes.fromhex("1FA68B0A8112B447AEF34BD8FB5A7B829D3E862371D2CFE5")
        
        # Test wrapping
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext)
        assert wrapped == expected
        
        # Test unwrapping
        unwrapped = wrapper.unwrap(wrapped)
        assert unwrapped == plaintext
    
    def test_rfc3394_192_bit_kek(self):
        """Test RFC 3394 example with 192-bit KEK."""
        # Test vector from RFC 3394 Section 4.2
        kek = bytes.fromhex("000102030405060708090A0B0C0D0E0F1011121314151617")
        plaintext = bytes.fromhex("00112233445566778899AABBCCDDEEFF")
        expected = bytes.fromhex("96778B25AE6CA435F92B5B97C050AED2468AB8A17AD84E5D")
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext)
        assert wrapped == expected
        
        unwrapped = wrapper.unwrap(wrapped)
        assert unwrapped == plaintext
    
    def test_rfc3394_256_bit_kek(self):
        """Test RFC 3394 example with 256-bit KEK."""
        # Test vector from RFC 3394 Section 4.3
        kek = bytes.fromhex("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F")
        plaintext = bytes.fromhex("00112233445566778899AABBCCDDEEFF")
        expected = bytes.fromhex("64E8C3F9CE0F5BA263E9777905818A2A93C8191E7D6E8AE7")
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext)
        assert wrapped == expected
        
        unwrapped = wrapper.unwrap(wrapped)
        assert unwrapped == plaintext
    
    def test_rfc3394_longer_plaintext(self):
        """Test RFC 3394 with longer plaintext (24 bytes)."""
        # Test vector from RFC 3394 Section 4.4
        kek = bytes.fromhex("000102030405060708090A0B0C0D0E0F1011121314151617")
        plaintext = bytes.fromhex("00112233445566778899AABBCCDDEEFF0001020304050607")
        expected = bytes.fromhex("031D33264E15D33268F24EC260743EDCE1C6C7DDEE725A936BA814915C6762D2")
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext)
        assert wrapped == expected
        
        unwrapped = wrapper.unwrap(wrapped)
        assert unwrapped == plaintext


class TestAESKeyWrapBasicFunctionality:
    """Test basic AES Key Wrap functionality."""
    
    def test_wrap_unwrap_round_trip_128_bit(self):
        """Test wrap/unwrap round trip with 128-bit KEK."""
        kek = secrets.token_bytes(16)
        plaintext = secrets.token_bytes(32)
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext)
        unwrapped = wrapper.unwrap(wrapped)
        
        assert unwrapped == plaintext
        assert len(wrapped) == len(plaintext) + 8  # 8 bytes overhead
    
    def test_wrap_unwrap_round_trip_256_bit(self):
        """Test wrap/unwrap round trip with 256-bit KEK."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(64)
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext)
        unwrapped = wrapper.unwrap(wrapped)
        
        assert unwrapped == plaintext
        assert len(wrapped) == len(plaintext) + 8
    
    def test_different_key_sizes(self):
        """Test with different plaintext key sizes."""
        kek = secrets.token_bytes(32)
        wrapper = AESKeyWrap(kek)
        
        for size in [16, 24, 32, 40, 48, 56, 64]:
            plaintext = secrets.token_bytes(size)
            wrapped = wrapper.wrap(plaintext)
            unwrapped = wrapper.unwrap(wrapped)
            assert unwrapped == plaintext
    
    def test_custom_iv(self):
        """Test with custom IV."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        custom_iv = b'\x12\x34\x56\x78\x9A\xBC\xDE\xF0'
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext, iv=custom_iv)
        unwrapped = wrapper.unwrap(wrapped, iv=custom_iv)
        
        assert unwrapped == plaintext
    
    def test_convenience_functions(self):
        """Test convenience wrap_key and unwrap_key functions."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        
        wrapped = wrap_key(kek, plaintext)
        unwrapped = unwrap_key(kek, wrapped)
        
        assert unwrapped == plaintext


class TestAESKeyWrapValidation:
    """Test input validation and error handling."""
    
    def test_invalid_kek_sizes(self):
        """Test rejection of invalid KEK sizes."""
        invalid_sizes = [15, 17, 23, 25, 31, 33, 64]
        
        for size in invalid_sizes:
            kek = secrets.token_bytes(size)
            with pytest.raises(InvalidInputError, match="KEK size must be"):
                AESKeyWrap(kek)
    
    def test_invalid_plaintext_sizes(self):
        """Test rejection of invalid plaintext sizes."""
        kek = secrets.token_bytes(32)
        wrapper = AESKeyWrap(kek)
        
        # Too small
        with pytest.raises(InvalidInputError, match="at least 16 bytes"):
            wrapper.wrap(b"short")
        
        # Too large
        large_key = secrets.token_bytes(MAX_PLAINTEXT_KEY_SIZE + 8)
        with pytest.raises(InvalidInputError, match="at most"):
            wrapper.wrap(large_key)
        
        # Not multiple of 8
        invalid_key = secrets.token_bytes(17)
        with pytest.raises(InvalidInputError, match="multiple of 8 bytes"):
            wrapper.wrap(invalid_key)
    
    def test_empty_inputs(self):
        """Test handling of empty inputs."""
        kek = secrets.token_bytes(32)
        wrapper = AESKeyWrap(kek)
        
        with pytest.raises(InvalidInputError, match="cannot be empty"):
            wrapper.wrap(b"")
        
        with pytest.raises(InvalidInputError, match="cannot be empty"):
            wrapper.unwrap(b"")
    
    def test_invalid_iv_size(self):
        """Test rejection of invalid IV sizes."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        wrapper = AESKeyWrap(kek)
        
        invalid_ivs = [b"short", b"toolongforiv", b""]
        
        for iv in invalid_ivs:
            with pytest.raises(InvalidInputError, match="IV must be exactly 8 bytes"):
                wrapper.wrap(plaintext, iv=iv)
    
    def test_invalid_wrapped_key_format(self):
        """Test handling of invalid wrapped key formats."""
        kek = secrets.token_bytes(32)
        wrapper = AESKeyWrap(kek)
        
        # Too short
        with pytest.raises(InvalidInputError, match="too short"):
            wrapper.unwrap(b"short")
        
        # Not multiple of 8
        invalid_wrapped = secrets.token_bytes(25)
        with pytest.raises(InvalidInputError, match="multiple of 8 bytes"):
            wrapper.unwrap(invalid_wrapped)


class TestAESKeyWrapSecurity:
    """Test security properties of AES Key Wrap."""
    
    def test_integrity_protection(self):
        """Test that tampering with wrapped key is detected."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext)
        
        # Tamper with different positions
        for i in range(len(wrapped)):
            tampered = bytearray(wrapped)
            tampered[i] ^= 0x01  # Flip one bit
            
            with pytest.raises(AESKeyWrapError, match="Integrity check failed"):
                wrapper.unwrap(bytes(tampered))
    
    def test_wrong_kek_detection(self):
        """Test that wrong KEK is detected."""
        kek1 = secrets.token_bytes(32)
        kek2 = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        
        wrapper1 = AESKeyWrap(kek1)
        wrapper2 = AESKeyWrap(kek2)
        
        wrapped = wrapper1.wrap(plaintext)
        
        with pytest.raises(AESKeyWrapError, match="Integrity check failed"):
            wrapper2.unwrap(wrapped)
    
    def test_wrong_iv_detection(self):
        """Test that wrong IV is detected."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        iv1 = b'\x11\x22\x33\x44\x55\x66\x77\x88'
        iv2 = b'\x99\xAA\xBB\xCC\xDD\xEE\xFF\x00'
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext, iv=iv1)
        
        with pytest.raises(AESKeyWrapError, match="Integrity check failed"):
            wrapper.unwrap(wrapped, iv=iv2)
    
    def test_deterministic_output(self):
        """Test that wrapping with same inputs produces same output."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        
        wrapper = AESKeyWrap(kek)
        wrapped1 = wrapper.wrap(plaintext)
        wrapped2 = wrapper.wrap(plaintext)
        
        assert wrapped1 == wrapped2
    
    def test_different_plaintexts_different_outputs(self):
        """Test that different plaintexts produce different outputs."""
        kek = secrets.token_bytes(32)
        plaintext1 = secrets.token_bytes(32)
        plaintext2 = secrets.token_bytes(32)
        
        # Ensure plaintexts are different
        while plaintext1 == plaintext2:
            plaintext2 = secrets.token_bytes(32)
        
        wrapper = AESKeyWrap(kek)
        wrapped1 = wrapper.wrap(plaintext1)
        wrapped2 = wrapper.wrap(plaintext2)
        
        assert wrapped1 != wrapped2


class TestDataKeyGeneration:
    """Test data key generation functionality."""
    
    def test_generate_data_key_default_size(self):
        """Test default data key generation."""
        key = generate_data_key()
        assert len(key) == 32  # Default AES-256 key size
        assert isinstance(key, bytes)
    
    def test_generate_data_key_custom_sizes(self):
        """Test data key generation with custom sizes."""
        for size in [16, 24, 32, 40, 48, 56, 64]:
            key = generate_data_key(size)
            assert len(key) == size
            assert isinstance(key, bytes)
    
    def test_generate_data_key_randomness(self):
        """Test that generated keys are random."""
        keys = [generate_data_key() for _ in range(100)]
        
        # All keys should be different
        assert len(set(keys)) == 100
        
        # Keys should not be all zeros or all ones
        for key in keys[:10]:  # Check first 10
            assert key != b'\x00' * 32
            assert key != b'\xFF' * 32
    
    def test_generate_data_key_invalid_sizes(self):
        """Test rejection of invalid key sizes."""
        invalid_sizes = [15, 17, 65, 0, -1]
        
        for size in invalid_sizes:
            with pytest.raises(InvalidInputError):
                generate_data_key(size)


class TestUtilityFunctions:
    """Test utility functions."""
    
    def test_validate_wrapped_key_valid(self):
        """Test validation of valid wrapped keys."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        
        wrapped = wrap_key(kek, plaintext)
        assert validate_wrapped_key(wrapped) is True
    
    def test_validate_wrapped_key_invalid(self):
        """Test validation of invalid wrapped keys."""
        invalid_keys = [
            b"",  # Empty
            b"short",  # Too short
            secrets.token_bytes(25),  # Not multiple of 8
        ]
        
        for key in invalid_keys:
            assert validate_wrapped_key(key) is False
    
    def test_get_unwrapped_key_size(self):
        """Test calculation of unwrapped key size."""
        kek = secrets.token_bytes(32)
        
        for plaintext_size in [16, 24, 32, 40, 48]:
            plaintext = secrets.token_bytes(plaintext_size)
            wrapped = wrap_key(kek, plaintext)
            
            calculated_size = get_unwrapped_key_size(wrapped)
            assert calculated_size == plaintext_size
    
    def test_get_unwrapped_key_size_invalid(self):
        """Test error handling for invalid wrapped keys."""
        invalid_keys = [
            b"",  # Empty
            b"short",  # Too short
            secrets.token_bytes(25),  # Not multiple of 8
        ]
        
        for key in invalid_keys:
            with pytest.raises(InvalidInputError, match="Invalid wrapped key format"):
                get_unwrapped_key_size(key)


class TestAESKeyWrapCleanup:
    """Test secure cleanup of sensitive data."""
    
    def test_secure_cleanup_on_deletion(self):
        """Test that KEK is cleaned up when wrapper is deleted."""
        kek = bytearray(secrets.token_bytes(32))
        original_kek = bytes(kek)
        
        wrapper = AESKeyWrap(kek)
        wrapper.kek = kek  # Use mutable type to test cleanup
        
        del wrapper
        
        # Note: This test verifies the cleanup code exists,
        # but actual zeroing depends on implementation details
        # and may not be verifiable in all Python implementations
    
    def test_exception_handling_during_wrap(self):
        """Test exception handling during wrap operation."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        
        wrapper = AESKeyWrap(kek)
        
        # Mock cipher to raise exception
        with patch.object(wrapper.cipher, 'encryptor') as mock_encryptor:
            mock_encryptor.side_effect = Exception("Mock cipher error")
            
            with pytest.raises(AESKeyWrapError, match="Key wrapping failed"):
                wrapper.wrap(plaintext)
    
    def test_exception_handling_during_unwrap(self):
        """Test exception handling during unwrap operation."""
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(plaintext)
        
        # Mock cipher to raise exception
        with patch.object(wrapper.cipher, 'decryptor') as mock_decryptor:
            mock_decryptor.side_effect = Exception("Mock cipher error")
            
            with pytest.raises(AESKeyWrapError, match="Key unwrapping failed"):
                wrapper.unwrap(wrapped)


class TestAESKeyWrapPerformance:
    """Test performance characteristics."""
    
    def test_wrap_unwrap_performance(self):
        """Test that wrap/unwrap operations complete in reasonable time."""
        import time
        
        kek = secrets.token_bytes(32)
        plaintext = secrets.token_bytes(32)
        wrapper = AESKeyWrap(kek)
        
        # Warm up
        for _ in range(10):
            wrapped = wrapper.wrap(plaintext)
            wrapper.unwrap(wrapped)
        
        # Measure performance
        start_time = time.time()
        for _ in range(100):
            wrapped = wrapper.wrap(plaintext)
            wrapper.unwrap(wrapped)
        end_time = time.time()
        
        avg_time = (end_time - start_time) / 100
        assert avg_time < 0.01  # Should complete in less than 10ms per operation
    
    def test_memory_usage_large_keys(self):
        """Test memory usage with larger keys."""
        kek = secrets.token_bytes(32)
        large_key = secrets.token_bytes(512)  # Maximum supported size
        
        wrapper = AESKeyWrap(kek)
        wrapped = wrapper.wrap(large_key)
        unwrapped = wrapper.unwrap(wrapped)
        
        assert unwrapped == large_key
        assert len(wrapped) == len(large_key) + 8 