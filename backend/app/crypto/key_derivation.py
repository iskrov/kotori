"""
Deterministic Key Derivation Schedule for OPAQUE

Implements the complete key derivation pipeline as specified in the OPAQUE
zero-knowledge implementation guide. Transforms password phrases into all
required cryptographic keys: TagID, Kv (verification), and Ke (encryption).
"""

from typing import NamedTuple, Optional
from dataclasses import dataclass

from .argon2 import argon2id_hash
from .hkdf import hkdf_extract_and_expand
from .blake2 import generate_tag_id
from .config import get_crypto_config, Argon2Config
from .errors import InvalidInputError, KeyDerivationError
from .memory import secure_zero, SecureMemory


@dataclass(frozen=True)
class OpaqueKeys:
    """Container for all OPAQUE-derived keys."""
    
    # 16-byte deterministic identifier (salt-free)
    tag_id: bytes
    
    # 32-byte verification key for OPAQUE protocol (server-side)
    verification_key: bytes
    
    # 32-byte encryption key for vault key wrapping (client-side only)
    encryption_key: bytes
    
    # 16-byte salt used for Argon2id (stored with tag)
    salt: bytes
    
    def __post_init__(self):
        """Validate key lengths after creation."""
        if len(self.tag_id) != 16:
            raise ValueError(f"TagID must be 16 bytes, got {len(self.tag_id)}")
        if len(self.verification_key) != 32:
            raise ValueError(f"Verification key must be 32 bytes, got {len(self.verification_key)}")
        if len(self.encryption_key) != 32:
            raise ValueError(f"Encryption key must be 32 bytes, got {len(self.encryption_key)}")
        if len(self.salt) != 16:
            raise ValueError(f"Salt must be 16 bytes, got {len(self.salt)}")


def derive_opaque_keys_from_phrase(
    password_phrase: str,
    salt: Optional[bytes] = None,
    config: Optional[Argon2Config] = None
) -> OpaqueKeys:
    """
    Derive all OPAQUE keys from a password phrase following the specification.
    
    This implements the complete key derivation schedule:
    
    Input:  pass-phrase P, 16-byte salt
    S     = Argon2id(P, salt, mem=64 MiB, iters=3 desktop / 1 mobile)
    Kv    = HKDF(S, "verify")        # 32 B — lives on server
    Ke    = HKDF(S, "encrypt")       # 32 B — lives only in client RAM
    TagID = first16(BLAKE2s(P))      # 128-bit, salt-free
    
    Args:
        password_phrase: The secret password phrase
        salt: Optional 16-byte salt (random generated if None)
        config: Optional Argon2 configuration (uses global if None)
        
    Returns:
        OpaqueKeys containing TagID, verification key, encryption key, and salt
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If key derivation fails
        
    Example:
        keys = derive_opaque_keys_from_phrase("my secret phrase")
        # keys.tag_id is deterministic (same for same phrase)
        # keys.verification_key and encryption_key depend on salt
    """
    # Input validation
    if not isinstance(password_phrase, str):
        raise InvalidInputError("Password phrase must be string", "password_phrase")
    
    if len(password_phrase.strip()) == 0:
        raise InvalidInputError("Password phrase cannot be empty", "password_phrase")
    
    if salt is not None:
        if not isinstance(salt, bytes):
            raise InvalidInputError("Salt must be bytes", "salt")
        if len(salt) != 16:
            raise InvalidInputError("Salt must be 16 bytes", "salt")
    
    # Normalize the password phrase
    normalized_phrase = password_phrase.strip()
    
    try:
        # Step 1: Generate deterministic TagID (salt-free)
        # TagID = first16(BLAKE2s(P))
        tag_id = generate_tag_id(normalized_phrase)
        
        # Step 2: Perform Argon2id password stretching
        # S = Argon2id(P, salt, mem=64 MiB, iters=3 desktop / 1 mobile)
        phrase_bytes = normalized_phrase.encode('utf-8')
        
        # Use secure memory for password handling
        with SecureMemory(len(phrase_bytes)) as password_buffer:
            password_buffer[:] = phrase_bytes
            
            # Perform Argon2id hashing
            argon2_output, used_salt = argon2id_hash(
                bytes(password_buffer), 
                salt=salt, 
                config=config
            )
        
        # Step 3: Derive verification and encryption keys using HKDF
        # Kv = HKDF(S, "verify")    # 32 B — lives on server
        # Ke = HKDF(S, "encrypt")   # 32 B — lives only in client RAM
        
        # Use secure memory for Argon2 output
        with SecureMemory(len(argon2_output)) as argon2_buffer:
            argon2_buffer[:] = argon2_output
            
            # Derive verification key
            verification_key = hkdf_extract_and_expand(
                bytes(argon2_buffer),
                "verify"
            )
            
            # Derive encryption key
            encryption_key = hkdf_extract_and_expand(
                bytes(argon2_buffer),
                "encrypt"
            )
        
        # Securely clear the Argon2 output
        secure_zero(bytearray(argon2_output))
        
        # Return all derived keys
        return OpaqueKeys(
            tag_id=tag_id,
            verification_key=verification_key,
            encryption_key=encryption_key,
            salt=used_salt
        )
        
    except (InvalidInputError, KeyDerivationError):
        # Re-raise our own exceptions
        raise
    except Exception as e:
        raise KeyDerivationError(f"OPAQUE key derivation failed: {e}", "OPAQUE")


def derive_opaque_keys_with_known_salt(
    password_phrase: str,
    salt: bytes,
    config: Optional[Argon2Config] = None
) -> OpaqueKeys:
    """
    Derive OPAQUE keys with a known salt (for verification/authentication).
    
    This is used when authenticating with an existing secret tag where
    the salt is already known and stored with the tag.
    
    Args:
        password_phrase: The secret password phrase
        salt: The 16-byte salt stored with the secret tag
        config: Optional Argon2 configuration
        
    Returns:
        OpaqueKeys with deterministic verification and encryption keys
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If key derivation fails
    """
    if not isinstance(salt, bytes) or len(salt) != 16:
        raise InvalidInputError("Salt must be 16 bytes", "salt")
    
    return derive_opaque_keys_from_phrase(password_phrase, salt, config)


def verify_tag_id_matches_phrase(tag_id: bytes, password_phrase: str) -> bool:
    """
    Verify that a TagID matches a password phrase.
    
    This performs the deterministic TagID generation and compares it
    with the provided TagID in constant time.
    
    Args:
        tag_id: The TagID to verify (16 bytes)
        password_phrase: The password phrase to check
        
    Returns:
        True if TagID matches phrase, False otherwise
        
    Raises:
        InvalidInputError: If input parameters are invalid
    """
    if not isinstance(tag_id, bytes):
        raise InvalidInputError("TagID must be bytes", "tag_id")
    
    if len(tag_id) != 16:
        raise InvalidInputError("TagID must be 16 bytes", "tag_id")
    
    try:
        # Generate TagID from phrase
        computed_tag_id = generate_tag_id(password_phrase)
        
        # Constant-time comparison
        from .memory import constant_time_compare
        return constant_time_compare(tag_id, computed_tag_id)
        
    except Exception as e:
        raise KeyDerivationError(f"TagID verification failed: {e}", "TagID-Verify")


def benchmark_key_derivation(
    password_phrase: str = "benchmark phrase",
    iterations: int = 5,
    config: Optional[Argon2Config] = None
) -> dict:
    """
    Benchmark the complete key derivation pipeline.
    
    Args:
        password_phrase: Test phrase for benchmarking
        iterations: Number of iterations to average
        config: Optional Argon2 configuration
        
    Returns:
        Dictionary with timing results for each component
        
    Raises:
        KeyDerivationError: If benchmarking fails
    """
    import time
    
    if iterations <= 0:
        raise InvalidInputError("Iterations must be positive", "iterations")
    
    try:
        total_times = {
            'tag_id': 0.0,
            'argon2id': 0.0,
            'hkdf_verify': 0.0,
            'hkdf_encrypt': 0.0,
            'total': 0.0
        }
        
        for _ in range(iterations):
            # Benchmark TagID generation
            start_time = time.time()
            tag_id = generate_tag_id(password_phrase)
            total_times['tag_id'] += time.time() - start_time
            
            # Benchmark Argon2id
            phrase_bytes = password_phrase.encode('utf-8')
            start_time = time.time()
            argon2_output, salt = argon2id_hash(phrase_bytes, config=config)
            total_times['argon2id'] += time.time() - start_time
            
            # Benchmark HKDF verification key
            start_time = time.time()
            verification_key = hkdf_extract_and_expand(argon2_output, "verify")
            total_times['hkdf_verify'] += time.time() - start_time
            
            # Benchmark HKDF encryption key
            start_time = time.time()
            encryption_key = hkdf_extract_and_expand(argon2_output, "encrypt")
            total_times['hkdf_encrypt'] += time.time() - start_time
            
            # Benchmark complete pipeline
            start_time = time.time()
            keys = derive_opaque_keys_from_phrase(password_phrase, salt, config)
            total_times['total'] += time.time() - start_time
            
            # Clean up
            secure_zero(bytearray(argon2_output))
        
        # Calculate averages
        return {
            component: total_time / iterations
            for component, total_time in total_times.items()
        }
        
    except Exception as e:
        raise KeyDerivationError(f"Benchmarking failed: {e}", "Benchmark")


def validate_opaque_keys(keys: OpaqueKeys) -> None:
    """
    Validate that OpaqueKeys contain properly formatted keys.
    
    Args:
        keys: The OpaqueKeys to validate
        
    Raises:
        InvalidInputError: If keys are invalid
    """
    if not isinstance(keys, OpaqueKeys):
        raise InvalidInputError("Must be OpaqueKeys instance", "keys")
    
    # Length validation is handled by OpaqueKeys.__post_init__
    
    # Additional validation
    if keys.tag_id == b'\x00' * 16:
        raise InvalidInputError("TagID cannot be all zeros", "tag_id")
    
    if keys.verification_key == b'\x00' * 32:
        raise InvalidInputError("Verification key cannot be all zeros", "verification_key")
    
    if keys.encryption_key == b'\x00' * 32:
        raise InvalidInputError("Encryption key cannot be all zeros", "encryption_key")
    
    if keys.verification_key == keys.encryption_key:
        raise InvalidInputError("Verification and encryption keys must be different", "keys") 