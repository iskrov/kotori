"""
BLAKE2s Fast Hashing Implementation

Provides BLAKE2s fast hashing for TagID generation
as specified in RFC 7693 for use in the OPAQUE protocol.
"""

import hashlib
from typing import Optional

from .config import get_crypto_config
from .errors import InvalidInputError, HashingError


def blake2s_hash(
    data: bytes,
    length: Optional[int] = None,
    key: Optional[bytes] = None,
    salt: Optional[bytes] = None,
    person: Optional[bytes] = None
) -> bytes:
    """
    Hash data using BLAKE2s algorithm.
    
    This function provides fast hashing for TagID generation in the OPAQUE
    protocol. BLAKE2s is optimized for speed and provides good security
    properties for non-cryptographic applications like deterministic IDs.
    
    Args:
        data: Data to hash
        length: Output length in bytes (uses config default if None)
        key: Optional key for keyed hashing
        salt: Optional salt (max 8 bytes for BLAKE2s)
        person: Optional personalization parameter (max 8 bytes)
        
    Returns:
        Hash digest of specified length
        
    Raises:
        InvalidInputError: If input parameters are invalid
        HashingError: If hashing operation fails
        
    Example:
        # Generate TagID from password phrase
        tag_id = blake2s_hash(password_phrase.encode(), length=16)
    """
    # Input validation
    if not isinstance(data, bytes):
        raise InvalidInputError("Data must be bytes", "data")
    
    if len(data) == 0:
        raise InvalidInputError("Data cannot be empty", "data")
    
    # Use default length if not specified (16 bytes for TagID)
    if length is None:
        length = get_crypto_config().tagid_length
    
    if not isinstance(length, int) or length <= 0:
        raise InvalidInputError("Length must be positive integer", "length")
    
    if length > 32:  # BLAKE2s maximum output length
        raise InvalidInputError("Length too large (max 32 bytes)", "length")
    
    # Validate optional parameters
    if key is not None:
        if not isinstance(key, bytes):
            raise InvalidInputError("Key must be bytes", "key")
        if len(key) > 32:  # BLAKE2s maximum key length
            raise InvalidInputError("Key too long (max 32 bytes)", "key")
    
    if salt is not None:
        if not isinstance(salt, bytes):
            raise InvalidInputError("Salt must be bytes", "salt")
        if len(salt) > 8:  # BLAKE2s maximum salt length
            raise InvalidInputError("Salt too long (max 8 bytes)", "salt")
    
    if person is not None:
        if not isinstance(person, bytes):
            raise InvalidInputError("Person must be bytes", "person")
        if len(person) > 8:  # BLAKE2s maximum person length
            raise InvalidInputError("Person too long (max 8 bytes)", "person")
    
    try:
        # Create BLAKE2s hasher with specified parameters
        # Only pass non-None parameters to avoid TypeError
        hasher_kwargs = {'digest_size': length}
        if key is not None:
            hasher_kwargs['key'] = key
        if salt is not None:
            hasher_kwargs['salt'] = salt
        if person is not None:
            hasher_kwargs['person'] = person
            
        hasher = hashlib.blake2s(**hasher_kwargs)
        
        # Hash the data
        hasher.update(data)
        
        return hasher.digest()
        
    except Exception as e:
        raise HashingError(f"BLAKE2s hashing failed: {e}", "BLAKE2s")


def generate_tag_id(password_phrase: str) -> bytes:
    """
    Generate a deterministic TagID from a password phrase.
    
    This function creates a 16-byte (128-bit) TagID that uniquely
    identifies a secret tag. The TagID is deterministic and salt-free
    to ensure consistent identification across sessions.
    
    Args:
        password_phrase: The secret password phrase
        
    Returns:
        16-byte TagID
        
    Raises:
        InvalidInputError: If password phrase is invalid
        HashingError: If TagID generation fails
        
    Example:
        tag_id = generate_tag_id("my secret phrase")
        # tag_id is always the same for the same phrase
    """
    # Input validation
    if not isinstance(password_phrase, str):
        raise InvalidInputError("Password phrase must be string", "password_phrase")
    
    if len(password_phrase.strip()) == 0:
        raise InvalidInputError("Password phrase cannot be empty", "password_phrase")
    
    # Normalize the phrase (strip whitespace, encode to UTF-8)
    normalized_phrase = password_phrase.strip()
    phrase_bytes = normalized_phrase.encode('utf-8')
    
    try:
        # Generate deterministic 16-byte TagID
        tag_id = blake2s_hash(phrase_bytes, length=16)
        return tag_id
        
    except Exception as e:
        raise HashingError(f"TagID generation failed: {e}", "TagID")


def blake2s_keyed_hash(data: bytes, key: bytes, length: int = 32) -> bytes:
    """
    Perform keyed hashing with BLAKE2s.
    
    This provides authenticated hashing where the key must be known
    to verify the hash. Useful for message authentication codes.
    
    Args:
        data: Data to hash
        key: Secret key for authentication
        length: Output length in bytes (default 32)
        
    Returns:
        Keyed hash digest
        
    Raises:
        InvalidInputError: If input parameters are invalid
        HashingError: If keyed hashing fails
    """
    # Input validation
    if not isinstance(data, bytes):
        raise InvalidInputError("Data must be bytes", "data")
    
    if not isinstance(key, bytes):
        raise InvalidInputError("Key must be bytes", "key")
    
    if len(key) == 0:
        raise InvalidInputError("Key cannot be empty", "key")
    
    if len(key) > 32:
        raise InvalidInputError("Key too long (max 32 bytes)", "key")
    
    try:
        return blake2s_hash(data, length=length, key=key)
        
    except Exception as e:
        raise HashingError(f"Keyed BLAKE2s hashing failed: {e}", "BLAKE2s-Keyed")


def verify_blake2s_hash(data: bytes, expected_hash: bytes, **kwargs) -> bool:
    """
    Verify data against a BLAKE2s hash.
    
    Args:
        data: Data to verify
        expected_hash: Expected hash value
        **kwargs: Additional parameters for blake2s_hash
        
    Returns:
        True if hash matches, False otherwise
        
    Raises:
        InvalidInputError: If input parameters are invalid
        HashingError: If verification fails due to crypto error
    """
    # Input validation
    if not isinstance(data, bytes):
        raise InvalidInputError("Data must be bytes", "data")
    
    if not isinstance(expected_hash, bytes):
        raise InvalidInputError("Expected hash must be bytes", "expected_hash")
    
    try:
        # Compute hash with same parameters
        computed_hash = blake2s_hash(data, length=len(expected_hash), **kwargs)
        
        # Constant-time comparison to prevent timing attacks
        from .memory import constant_time_compare
        return constant_time_compare(computed_hash, expected_hash)
        
    except Exception as e:
        raise HashingError(f"Hash verification failed: {e}", "BLAKE2s-Verify")


def benchmark_blake2s(
    data_size: int = 1024,
    iterations: int = 1000,
    length: int = 16
) -> float:
    """
    Benchmark BLAKE2s performance.
    
    Args:
        data_size: Size of test data in bytes
        iterations: Number of iterations to average
        length: Output hash length
        
    Returns:
        Average time per hash operation in seconds
        
    Raises:
        HashingError: If benchmarking fails
    """
    import time
    import secrets
    
    if data_size <= 0 or iterations <= 0:
        raise InvalidInputError("Data size and iterations must be positive")
    
    try:
        # Generate test data
        test_data = secrets.token_bytes(data_size)
        
        # Benchmark hashing
        total_time = 0.0
        
        for _ in range(iterations):
            start_time = time.time()
            blake2s_hash(test_data, length=length)
            end_time = time.time()
            total_time += (end_time - start_time)
        
        return total_time / iterations
        
    except Exception as e:
        raise HashingError(f"Benchmarking failed: {e}", "BLAKE2s") 