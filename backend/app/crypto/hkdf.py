"""
HKDF-SHA-256 Key Derivation Implementation

Provides HMAC-based Key Derivation Function using SHA-256
as specified in RFC 5869 for use in the OPAQUE protocol.
"""

import hashlib
import hmac
from typing import Optional

from .config import get_crypto_config
from .errors import InvalidInputError, KeyDerivationError


def hkdf_extract(salt: bytes, input_key_material: bytes) -> bytes:
    """
    HKDF Extract step: extract a pseudorandom key from input key material.
    
    Args:
        salt: Salt value (can be empty bytes for no salt)
        input_key_material: Input keying material
        
    Returns:
        Pseudorandom key (PRK) of hash length
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If extraction fails
    """
    # Input validation
    if not isinstance(salt, bytes):
        raise InvalidInputError("Salt must be bytes", "salt")
    
    if not isinstance(input_key_material, bytes):
        raise InvalidInputError("Input key material must be bytes", "input_key_material")
    
    if len(input_key_material) == 0:
        raise InvalidInputError("Input key material cannot be empty", "input_key_material")
    
    try:
        # If salt is empty, use a string of zeros as per RFC 5869
        if len(salt) == 0:
            salt = b'\x00' * hashlib.sha256().digest_size
        
        # PRK = HMAC-Hash(salt, IKM)
        prk = hmac.new(salt, input_key_material, hashlib.sha256).digest()
        return prk
        
    except Exception as e:
        raise KeyDerivationError(f"HKDF extract failed: {e}", "HKDF-Extract")


def hkdf_expand(prk: bytes, info: bytes, length: int) -> bytes:
    """
    HKDF Expand step: expand pseudorandom key to desired length.
    
    Args:
        prk: Pseudorandom key from extract step
        info: Context and application specific information
        length: Length of output key material in bytes
        
    Returns:
        Output key material of specified length
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If expansion fails
    """
    # Input validation
    if not isinstance(prk, bytes):
        raise InvalidInputError("PRK must be bytes", "prk")
    
    if not isinstance(info, bytes):
        raise InvalidInputError("Info must be bytes", "info")
    
    if len(prk) < hashlib.sha256().digest_size:
        raise InvalidInputError("PRK too short", "prk")
    
    if length <= 0:
        raise InvalidInputError("Output length must be positive", "length")
    
    # Maximum output length is 255 * hash_length
    hash_length = hashlib.sha256().digest_size
    max_length = 255 * hash_length
    
    if length > max_length:
        raise InvalidInputError(f"Output length too large (max {max_length})", "length")
    
    try:
        # Calculate number of iterations needed
        n = (length + hash_length - 1) // hash_length  # Ceiling division
        
        # Generate output key material
        okm = b''
        t = b''
        
        for i in range(1, n + 1):
            # T(i) = HMAC-Hash(PRK, T(i-1) | info | i)
            t = hmac.new(prk, t + info + bytes([i]), hashlib.sha256).digest()
            okm += t
        
        # Return first 'length' bytes
        return okm[:length]
        
    except Exception as e:
        raise KeyDerivationError(f"HKDF expand failed: {e}", "HKDF-Expand")


def hkdf_extract_and_expand(
    input_key_material: bytes,
    context: str,
    salt: Optional[bytes] = None,
    length: Optional[int] = None
) -> bytes:
    """
    Combined HKDF extract and expand operation.
    
    This is the main function for OPAQUE key derivation, supporting
    the "verify" and "encrypt" contexts as specified in the protocol.
    
    Args:
        input_key_material: Source key material (e.g., from Argon2id)
        context: Context string ("verify" or "encrypt")
        salt: Optional salt (empty if None)
        length: Output length in bytes (uses config default if None)
        
    Returns:
        Derived key material
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If derivation fails
        
    Example:
        # Derive verification key
        kv = hkdf_extract_and_expand(argon2_output, "verify")
        
        # Derive encryption key  
        ke = hkdf_extract_and_expand(argon2_output, "encrypt")
    """
    # Input validation
    if not isinstance(input_key_material, bytes):
        raise InvalidInputError("Input key material must be bytes", "input_key_material")
    
    if not isinstance(context, str):
        raise InvalidInputError("Context must be string", "context")
    
    if context not in ["verify", "encrypt"]:
        raise InvalidInputError("Context must be 'verify' or 'encrypt'", "context")
    
    if salt is not None and not isinstance(salt, bytes):
        raise InvalidInputError("Salt must be bytes or None", "salt")
    
    # Use default length if not specified
    if length is None:
        length = get_crypto_config().hkdf_length
    
    # Use empty salt if not provided
    if salt is None:
        salt = b''
    
    try:
        # Convert context to bytes for use as info parameter
        info = context.encode('utf-8')
        
        # Step 1: Extract
        prk = hkdf_extract(salt, input_key_material)
        
        # Step 2: Expand
        okm = hkdf_expand(prk, info, length)
        
        return okm
        
    except (InvalidInputError, KeyDerivationError):
        # Re-raise our own exceptions
        raise
    except Exception as e:
        raise KeyDerivationError(f"HKDF operation failed: {e}", "HKDF")


def derive_opaque_keys(input_key_material: bytes, salt: Optional[bytes] = None) -> tuple[bytes, bytes]:
    """
    Derive both verification and encryption keys for OPAQUE protocol.
    
    This function derives both Kv (verification key) and Ke (encryption key)
    from the same input key material using different contexts.
    
    Args:
        input_key_material: Source key material (typically from Argon2id)
        salt: Optional salt for key derivation
        
    Returns:
        Tuple of (verification_key, encryption_key)
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If key derivation fails
        
    Example:
        argon2_output = argon2id_hash(password, salt)
        kv, ke = derive_opaque_keys(argon2_output)
    """
    try:
        # Derive verification key (Kv) - used in OPAQUE protocol
        verification_key = hkdf_extract_and_expand(
            input_key_material, 
            "verify", 
            salt
        )
        
        # Derive encryption key (Ke) - used for vault key wrapping
        encryption_key = hkdf_extract_and_expand(
            input_key_material, 
            "encrypt", 
            salt
        )
        
        return verification_key, encryption_key
        
    except Exception as e:
        raise KeyDerivationError(f"OPAQUE key derivation failed: {e}", "HKDF-OPAQUE")


def validate_hkdf_inputs(
    input_key_material: bytes,
    salt: bytes,
    info: bytes,
    length: int
) -> None:
    """
    Validate inputs for HKDF operations.
    
    Args:
        input_key_material: Input keying material
        salt: Salt value
        info: Context information
        length: Desired output length
        
    Raises:
        InvalidInputError: If any input is invalid
    """
    if not isinstance(input_key_material, bytes):
        raise InvalidInputError("Input key material must be bytes", "input_key_material")
    
    if len(input_key_material) == 0:
        raise InvalidInputError("Input key material cannot be empty", "input_key_material")
    
    if not isinstance(salt, bytes):
        raise InvalidInputError("Salt must be bytes", "salt")
    
    if not isinstance(info, bytes):
        raise InvalidInputError("Info must be bytes", "info")
    
    if not isinstance(length, int) or length <= 0:
        raise InvalidInputError("Length must be positive integer", "length")
    
    # Check maximum output length
    hash_length = hashlib.sha256().digest_size
    max_length = 255 * hash_length
    
    if length > max_length:
        raise InvalidInputError(f"Length too large (max {max_length})", "length") 