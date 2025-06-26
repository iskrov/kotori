"""
AES Key Wrap (AES-KW) Implementation

Implements RFC 3394 AES Key Wrap algorithm for secure protection of cryptographic keys.
Provides authenticated encryption for key material with integrity protection.
"""

import struct
from typing import Union, Optional
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

from .memory import secure_zero, secure_random_bytes
from .secure_memory import locked_memory
from .secure_ops import constant_time_compare
from .errors import CryptoError, InvalidInputError


# RFC 3394 Default Initial Value
DEFAULT_IV = b'\xA6\xA6\xA6\xA6\xA6\xA6\xA6\xA6'

# Supported key sizes (in bytes)
SUPPORTED_KEK_SIZES = {16, 24, 32}  # 128, 192, 256 bits
MIN_PLAINTEXT_KEY_SIZE = 16  # 128 bits minimum
MAX_PLAINTEXT_KEY_SIZE = 512  # 4096 bits maximum


class AESKeyWrapError(CryptoError):
    """AES Key Wrap specific errors."""
    pass


class AESKeyWrap:
    """
    AES Key Wrap implementation following RFC 3394.
    
    Provides secure wrapping and unwrapping of cryptographic keys using AES
    with authenticated encryption and integrity protection.
    """
    
    def __init__(self, kek: bytes, backend=None):
        """
        Initialize AES Key Wrap with a Key Encryption Key.
        
        Args:
            kek: Key Encryption Key (16, 24, or 32 bytes)
            backend: Cryptographic backend (uses default if None)
            
        Raises:
            InvalidInputError: If KEK size is not supported
        """
        if len(kek) not in SUPPORTED_KEK_SIZES:
            raise InvalidInputError(
                f"KEK size must be {SUPPORTED_KEK_SIZES} bytes, got {len(kek)}"
            )
        
        self.kek = kek
        self.backend = backend or default_backend()
        
        # Create AES cipher for ECB mode (used in key wrap)
        self.cipher = Cipher(
            algorithms.AES(kek),
            modes.ECB(),
            backend=self.backend
        )
    
    def wrap(self, plaintext_key: bytes, iv: Optional[bytes] = None) -> bytes:
        """
        Wrap a plaintext key using AES Key Wrap.
        
        Args:
            plaintext_key: The key to be wrapped (minimum 16 bytes)
            iv: Initial Value (8 bytes, uses default if None)
            
        Returns:
            Wrapped key data (8 bytes longer than input)
            
        Raises:
            InvalidInputError: If input parameters are invalid
            AESKeyWrapError: If wrapping operation fails
        """
        if not plaintext_key:
            raise InvalidInputError("Plaintext key cannot be empty")
        
        if len(plaintext_key) < MIN_PLAINTEXT_KEY_SIZE:
            raise InvalidInputError(
                f"Plaintext key must be at least {MIN_PLAINTEXT_KEY_SIZE} bytes"
            )
        
        if len(plaintext_key) > MAX_PLAINTEXT_KEY_SIZE:
            raise InvalidInputError(
                f"Plaintext key must be at most {MAX_PLAINTEXT_KEY_SIZE} bytes"
            )
        
        if len(plaintext_key) % 8 != 0:
            raise InvalidInputError("Plaintext key length must be a multiple of 8 bytes")
        
        if iv is None:
            iv = DEFAULT_IV
        elif len(iv) != 8:
            raise InvalidInputError("IV must be exactly 8 bytes")
        
        try:
            return self._wrap_key(plaintext_key, iv)
        except Exception as e:
            raise AESKeyWrapError(f"Key wrapping failed: {e}")
    
    def unwrap(self, wrapped_key: bytes, iv: Optional[bytes] = None) -> bytes:
        """
        Unwrap a wrapped key using AES Key Wrap.
        
        Args:
            wrapped_key: The wrapped key data
            iv: Expected Initial Value (8 bytes, uses default if None)
            
        Returns:
            Unwrapped plaintext key
            
        Raises:
            InvalidInputError: If input parameters are invalid
            AESKeyWrapError: If unwrapping operation fails or integrity check fails
        """
        if not wrapped_key:
            raise InvalidInputError("Wrapped key cannot be empty")
        
        if len(wrapped_key) < 24:  # Minimum: 8-byte IV + 16-byte key
            raise InvalidInputError("Wrapped key is too short")
        
        if len(wrapped_key) % 8 != 0:
            raise InvalidInputError("Wrapped key length must be a multiple of 8 bytes")
        
        if iv is None:
            iv = DEFAULT_IV
        elif len(iv) != 8:
            raise InvalidInputError("IV must be exactly 8 bytes")
        
        try:
            return self._unwrap_key(wrapped_key, iv)
        except Exception as e:
            raise AESKeyWrapError(f"Key unwrapping failed: {e}")
    
    def _wrap_key(self, plaintext_key: bytes, iv: bytes) -> bytes:
        """
        Internal key wrapping implementation following RFC 3394.
        
        Args:
            plaintext_key: Key to wrap
            iv: Initial value
            
        Returns:
            Wrapped key
        """
        n = len(plaintext_key) // 8  # Number of 64-bit blocks
        
        with locked_memory(len(plaintext_key) + 8) as secure_buffer:
            # Initialize A (IV) and R (key blocks)
            A = bytearray(iv)
            R = [plaintext_key[i:i+8] for i in range(0, len(plaintext_key), 8)]
            
            # Perform wrapping algorithm
            encryptor = self.cipher.encryptor()
            
            for j in range(6):  # 6 iterations as per RFC 3394
                for i in range(n):
                    # B = AES(K, A | R[i])
                    block_input = bytes(A) + R[i]
                    B = encryptor.update(block_input)
                    
                    # A = MSB(64, B) ^ t where t = (n*j)+i+1
                    t = (n * j) + i + 1
                    A = bytearray(B[:8])
                    A[7] ^= t & 0xFF
                    A[6] ^= (t >> 8) & 0xFF
                    A[5] ^= (t >> 16) & 0xFF
                    A[4] ^= (t >> 24) & 0xFF
                    A[3] ^= (t >> 32) & 0xFF
                    A[2] ^= (t >> 40) & 0xFF
                    A[1] ^= (t >> 48) & 0xFF
                    A[0] ^= (t >> 56) & 0xFF
                    
                    # R[i] = LSB(64, B)
                    R[i] = B[8:]
            
            encryptor.finalize()
            
            # Return C = A | R[1] | R[2] | ... | R[n]
            result = bytes(A) + b''.join(R)
            
            # Clear sensitive data
            secure_zero(A)
            for r in R:
                if isinstance(r, bytearray):
                    secure_zero(r)
            
            return result
    
    def _unwrap_key(self, wrapped_key: bytes, expected_iv: bytes) -> bytes:
        """
        Internal key unwrapping implementation following RFC 3394.
        
        Args:
            wrapped_key: Wrapped key data
            expected_iv: Expected initial value for integrity check
            
        Returns:
            Unwrapped plaintext key
            
        Raises:
            AESKeyWrapError: If integrity check fails
        """
        n = (len(wrapped_key) // 8) - 1  # Number of key blocks
        
        with locked_memory(len(wrapped_key)) as secure_buffer:
            # Initialize A and R from wrapped key
            A = bytearray(wrapped_key[:8])
            R = [wrapped_key[8 + i*8:8 + (i+1)*8] for i in range(n)]
            
            # Perform unwrapping algorithm
            decryptor = self.cipher.decryptor()
            
            for j in range(5, -1, -1):  # 6 iterations in reverse
                for i in range(n-1, -1, -1):
                    # Calculate t
                    t = (n * j) + i + 1
                    
                    # A = A ^ t
                    A[7] ^= t & 0xFF
                    A[6] ^= (t >> 8) & 0xFF
                    A[5] ^= (t >> 16) & 0xFF
                    A[4] ^= (t >> 24) & 0xFF
                    A[3] ^= (t >> 32) & 0xFF
                    A[2] ^= (t >> 40) & 0xFF
                    A[1] ^= (t >> 48) & 0xFF
                    A[0] ^= (t >> 56) & 0xFF
                    
                    # B = AES-1(K, (A ^ t) | R[i])
                    block_input = bytes(A) + R[i]
                    B = decryptor.update(block_input)
                    
                    # A = MSB(64, B)
                    A = bytearray(B[:8])
                    
                    # R[i] = LSB(64, B)
                    R[i] = B[8:]
            
            decryptor.finalize()
            
            # Verify integrity (A should equal expected IV)
            if not constant_time_compare(bytes(A), expected_iv):
                # Clear sensitive data before raising error
                secure_zero(A)
                for r in R:
                    if isinstance(r, bytearray):
                        secure_zero(r)
                raise AESKeyWrapError("Integrity check failed - invalid wrapped key or KEK")
            
            # Return unwrapped key
            result = b''.join(R)
            
            # Clear sensitive data
            secure_zero(A)
            for r in R:
                if isinstance(r, bytearray):
                    secure_zero(r)
            
            return result
    
    def __del__(self):
        """Secure cleanup of sensitive data."""
        if hasattr(self, 'kek'):
            if isinstance(self.kek, (bytearray, memoryview)):
                secure_zero(self.kek)


def wrap_key(kek: bytes, plaintext_key: bytes, iv: Optional[bytes] = None) -> bytes:
    """
    Convenience function to wrap a key using AES Key Wrap.
    
    Args:
        kek: Key Encryption Key (16, 24, or 32 bytes)
        plaintext_key: Key to be wrapped
        iv: Initial Value (8 bytes, uses default if None)
        
    Returns:
        Wrapped key data
        
    Raises:
        InvalidInputError: If input parameters are invalid
        AESKeyWrapError: If wrapping operation fails
    """
    wrapper = AESKeyWrap(kek)
    try:
        return wrapper.wrap(plaintext_key, iv)
    finally:
        del wrapper


def unwrap_key(kek: bytes, wrapped_key: bytes, iv: Optional[bytes] = None) -> bytes:
    """
    Convenience function to unwrap a key using AES Key Wrap.
    
    Args:
        kek: Key Encryption Key (16, 24, or 32 bytes)
        wrapped_key: Wrapped key data
        iv: Expected Initial Value (8 bytes, uses default if None)
        
    Returns:
        Unwrapped plaintext key
        
    Raises:
        InvalidInputError: If input parameters are invalid
        AESKeyWrapError: If unwrapping operation fails or integrity check fails
    """
    wrapper = AESKeyWrap(kek)
    try:
        return wrapper.unwrap(wrapped_key, iv)
    finally:
        del wrapper


def generate_data_key(size: int = 32) -> bytes:
    """
    Generate a new data encryption key for vault storage.
    
    Args:
        size: Key size in bytes (default 32 for AES-256)
        
    Returns:
        Cryptographically secure random key
        
    Raises:
        InvalidInputError: If key size is invalid
    """
    if size < 16:
        raise InvalidInputError("Data key size must be at least 16 bytes")
    if size > 64:
        raise InvalidInputError("Data key size must be at most 64 bytes")
    if size % 8 != 0:
        raise InvalidInputError("Data key size must be a multiple of 8 bytes")
    
    return secure_random_bytes(size)


def validate_wrapped_key(wrapped_key: bytes) -> bool:
    """
    Validate that a wrapped key has the correct format.
    
    Args:
        wrapped_key: Wrapped key data to validate
        
    Returns:
        True if format is valid, False otherwise
    """
    if not wrapped_key:
        return False
    
    if len(wrapped_key) < 24:  # Minimum: 8-byte IV + 16-byte key
        return False
    
    if len(wrapped_key) % 8 != 0:
        return False
    
    return True


def get_unwrapped_key_size(wrapped_key: bytes) -> int:
    """
    Calculate the size of the unwrapped key from wrapped key data.
    
    Args:
        wrapped_key: Wrapped key data
        
    Returns:
        Size of unwrapped key in bytes
        
    Raises:
        InvalidInputError: If wrapped key format is invalid
    """
    if not validate_wrapped_key(wrapped_key):
        raise InvalidInputError("Invalid wrapped key format")
    
    return len(wrapped_key) - 8  # Subtract 8-byte IV 