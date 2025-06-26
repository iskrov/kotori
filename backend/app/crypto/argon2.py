"""
Argon2id Password Hashing Implementation

Provides memory-hard password stretching using Argon2id algorithm
as specified in RFC 9106 for use in the OPAQUE protocol.
"""

import argon2
from typing import Optional

from .config import Argon2Config, get_crypto_config
from .errors import InvalidInputError, KeyDerivationError
from .memory import secure_random_bytes, secure_zero


def argon2id_hash(
    password: bytes,
    salt: Optional[bytes] = None,
    config: Optional[Argon2Config] = None
) -> tuple[bytes, bytes]:
    """
    Hash a password using Argon2id algorithm.
    
    This function implements memory-hard password stretching as required
    by the OPAQUE protocol specification. It uses Argon2id which provides
    resistance against both side-channel and GPU attacks.
    
    Args:
        password: The password to hash (will be securely cleared)
        salt: Optional salt (if None, a random salt is generated)
        config: Optional Argon2 configuration (uses global config if None)
        
    Returns:
        Tuple of (hash, salt) where both are bytes
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If hashing operation fails
        
    Example:
        password = b"user_password"
        hash_value, salt = argon2id_hash(password)
        # password is securely cleared after use
    """
    # Input validation
    if not isinstance(password, bytes):
        raise InvalidInputError("Password must be bytes", "password")
    
    if len(password) == 0:
        raise InvalidInputError("Password cannot be empty", "password")
    
    if len(password) > 1024 * 1024:  # 1 MB limit
        raise InvalidInputError("Password too long (max 1MB)", "password")
    
    if salt is not None:
        if not isinstance(salt, bytes):
            raise InvalidInputError("Salt must be bytes", "salt")
        if len(salt) == 0:
            raise InvalidInputError("Salt cannot be empty", "salt")
    
    # Get configuration
    if config is None:
        config = get_crypto_config().argon2
    
    # Generate salt if not provided
    if salt is None:
        try:
            salt = secure_random_bytes(config.salt_length)
        except Exception as e:
            raise KeyDerivationError(f"Failed to generate salt: {e}", "Argon2id")
    
    # Create a copy of password for secure handling
    password_copy = bytearray(password)
    
    try:
        # Create Argon2 hasher with specified parameters
        hasher = argon2.PasswordHasher(
            time_cost=config.time_cost,
            memory_cost=config.memory_cost,
            parallelism=config.parallelism,
            hash_len=config.hash_length,
            salt_len=len(salt),
            encoding='raw'  # Return raw bytes instead of encoded string
        )
        
        # Perform the hash operation
        try:
            # argon2-cffi expects string input, so we need to use low-level API
            from argon2.low_level import hash_secret_raw, Type
            
            hash_result = hash_secret_raw(
                secret=bytes(password_copy),
                salt=salt,
                time_cost=config.time_cost,
                memory_cost=config.memory_cost,
                parallelism=config.parallelism,
                hash_len=config.hash_length,
                type=Type.ID  # Argon2id
            )
            
            return hash_result, salt
            
        except Exception as e:
            raise KeyDerivationError(f"Argon2id hashing failed: {e}", "Argon2id")
    
    finally:
        # Securely clear the password copy
        secure_zero(password_copy)


def verify_argon2id_hash(
    password: bytes,
    hash_value: bytes,
    salt: bytes,
    config: Optional[Argon2Config] = None
) -> bool:
    """
    Verify a password against an Argon2id hash.
    
    Args:
        password: The password to verify
        hash_value: The expected hash value
        salt: The salt used for hashing
        config: Optional Argon2 configuration
        
    Returns:
        True if password matches hash, False otherwise
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If verification fails due to crypto error
    """
    # Input validation
    if not isinstance(password, bytes):
        raise InvalidInputError("Password must be bytes", "password")
    
    if not isinstance(hash_value, bytes):
        raise InvalidInputError("Hash must be bytes", "hash_value")
    
    if not isinstance(salt, bytes):
        raise InvalidInputError("Salt must be bytes", "salt")
    
    # Get configuration
    if config is None:
        config = get_crypto_config().argon2
    
    try:
        # Compute hash with same parameters
        computed_hash, _ = argon2id_hash(password, salt, config)
        
        # Constant-time comparison to prevent timing attacks
        from .memory import constant_time_compare
        return constant_time_compare(computed_hash, hash_value)
        
    except Exception as e:
        raise KeyDerivationError(f"Hash verification failed: {e}", "Argon2id")


def benchmark_argon2id(
    config: Argon2Config,
    password: bytes = b"benchmark_password",
    iterations: int = 10
) -> float:
    """
    Benchmark Argon2id performance with given configuration.
    
    Args:
        config: Argon2 configuration to benchmark
        password: Test password (default provided)
        iterations: Number of iterations to average
        
    Returns:
        Average time per hash operation in seconds
        
    Raises:
        KeyDerivationError: If benchmarking fails
    """
    import time
    
    if iterations <= 0:
        raise InvalidInputError("Iterations must be positive", "iterations")
    
    total_time = 0.0
    
    try:
        for _ in range(iterations):
            start_time = time.time()
            argon2id_hash(password, config=config)
            end_time = time.time()
            total_time += (end_time - start_time)
        
        return total_time / iterations
        
    except Exception as e:
        raise KeyDerivationError(f"Benchmarking failed: {e}", "Argon2id") 