"""
High-Level OPAQUE Key Operations Interface

Provides simplified, high-level functions for common OPAQUE key operations
including secret tag creation, authentication, and key management.
"""

from typing import Optional, Tuple
from dataclasses import dataclass
import base64

from .key_derivation import (
    OpaqueKeys,
    derive_opaque_keys_from_phrase,
    derive_opaque_keys_with_known_salt,
    verify_tag_id_matches_phrase,
    validate_opaque_keys
)
from .config import Argon2Config, Environment
from .errors import InvalidInputError, KeyDerivationError


@dataclass(frozen=True)
class SecretTag:
    """
    Represents a secret tag for storage in the database.
    
    Contains the minimal information needed to authenticate a secret phrase
    and derive encryption keys for vault access.
    """
    
    # 16-byte opaque identifier (base64 encoded for storage)
    tag_id_b64: str
    
    # 16-byte salt (base64 encoded for storage)
    salt_b64: str
    
    # 32-byte verification key for OPAQUE (base64 encoded for storage)
    verifier_b64: str
    
    @property
    def tag_id(self) -> bytes:
        """Get TagID as bytes."""
        return base64.b64decode(self.tag_id_b64)
    
    @property
    def salt(self) -> bytes:
        """Get salt as bytes."""
        return base64.b64decode(self.salt_b64)
    
    @property
    def verifier(self) -> bytes:
        """Get verifier (Kv) as bytes."""
        return base64.b64decode(self.verifier_b64)
    
    @classmethod
    def from_opaque_keys(cls, keys: OpaqueKeys) -> "SecretTag":
        """Create SecretTag from OpaqueKeys."""
        return cls(
            tag_id_b64=base64.b64encode(keys.tag_id).decode('ascii'),
            salt_b64=base64.b64encode(keys.salt).decode('ascii'),
            verifier_b64=base64.b64encode(keys.verification_key).decode('ascii')
        )
    
    def to_opaque_keys(self, encryption_key: bytes) -> OpaqueKeys:
        """Convert SecretTag back to OpaqueKeys with provided encryption key."""
        return OpaqueKeys(
            tag_id=self.tag_id,
            verification_key=self.verifier,
            encryption_key=encryption_key,
            salt=self.salt
        )


def create_secret_tag(
    password_phrase: str,
    environment: Optional[Environment] = None
) -> Tuple[SecretTag, bytes]:
    """
    Create a new secret tag from a password phrase.
    
    This is used when a user creates a new secret phrase. It generates
    all required keys and returns a SecretTag for database storage
    plus the encryption key for immediate use.
    
    Args:
        password_phrase: The secret password phrase
        environment: Target environment (affects Argon2id parameters)
        
    Returns:
        Tuple of (SecretTag for storage, encryption_key for immediate use)
        
    Raises:
        InvalidInputError: If password phrase is invalid
        KeyDerivationError: If key derivation fails
        
    Example:
        secret_tag, encryption_key = create_secret_tag("my secret phrase")
        # Store secret_tag in database
        # Use encryption_key to encrypt vault data
    """
    # Get appropriate configuration for environment
    config = None
    if environment is not None:
        config = Argon2Config.for_environment(environment)
    
    # Derive all keys
    keys = derive_opaque_keys_from_phrase(password_phrase, config=config)
    
    # Validate keys
    validate_opaque_keys(keys)
    
    # Create secret tag for storage
    secret_tag = SecretTag.from_opaque_keys(keys)
    
    # Return secret tag and encryption key
    return secret_tag, keys.encryption_key


def authenticate_secret_phrase(
    password_phrase: str,
    secret_tag: SecretTag
) -> Optional[bytes]:
    """
    Authenticate a password phrase against a stored secret tag.
    
    This is used during authentication to verify that a spoken phrase
    matches a stored secret tag and derive the encryption key.
    
    Args:
        password_phrase: The password phrase to authenticate
        secret_tag: The stored secret tag to authenticate against
        
    Returns:
        Encryption key if authentication succeeds, None if it fails
        
    Raises:
        InvalidInputError: If input parameters are invalid
        KeyDerivationError: If key derivation fails
        
    Example:
        encryption_key = authenticate_secret_phrase(
            spoken_phrase, 
            stored_secret_tag
        )
        if encryption_key:
            # Authentication successful, use encryption_key for vault access
        else:
            # Authentication failed
    """
    try:
        # First check if TagID matches (fast check)
        if not verify_tag_id_matches_phrase(secret_tag.phrase_hash, password_phrase):
            return None
        
        # TagID matches, now derive keys with stored salt
        keys = derive_opaque_keys_with_known_salt(
            password_phrase,
            secret_tag.salt
        )
        
        # Verify that the verification key matches
        from .memory import constant_time_compare
        if not constant_time_compare(keys.verification_key, secret_tag.verifier):
            return None
        
        # Authentication successful
        return keys.encryption_key
        
    except Exception as e:
        # Log error but don't reveal details to prevent information leakage
        raise KeyDerivationError(f"Authentication failed: {e}", "Authentication")


def find_matching_tag_id(
    password_phrase: str,
    secret_tags: list[SecretTag]
) -> Optional[SecretTag]:
    """
    Find a secret tag that matches the given password phrase by TagID.
    
    This is used to quickly identify which secret tag corresponds to
    a spoken phrase without performing expensive key derivation.
    
    Args:
        password_phrase: The password phrase to search for
        secret_tags: List of secret tags to search
        
    Returns:
        Matching SecretTag if found, None otherwise
        
    Raises:
        InvalidInputError: If input parameters are invalid
        
    Example:
        matching_tag = find_matching_tag_id(spoken_phrase, user_secret_tags)
        if matching_tag:
            # Found matching tag, proceed with authentication
            encryption_key = authenticate_secret_phrase(spoken_phrase, matching_tag)
    """
    if not isinstance(secret_tags, list):
        raise InvalidInputError("Secret tags must be a list", "secret_tags")
    
    try:
        # Generate TagID for the phrase
        from .blake2 import generate_tag_id
        target_tag_id = generate_tag_id(password_phrase)
        
        # Search for matching TagID
        for secret_tag in secret_tags:
            if not isinstance(secret_tag, SecretTag):
                continue
                
            if secret_tag.phrase_hash == target_tag_id:
                return secret_tag
        
        return None
        
    except Exception as e:
        raise KeyDerivationError(f"TagID search failed: {e}", "TagID-Search")


def validate_secret_tag(secret_tag: SecretTag) -> None:
    """
    Validate that a SecretTag contains properly formatted data.
    
    Args:
        secret_tag: The SecretTag to validate
        
    Raises:
        InvalidInputError: If secret tag is invalid
    """
    if not isinstance(secret_tag, SecretTag):
        raise InvalidInputError("Must be SecretTag instance", "secret_tag")
    
    # Validate base64 encoding and lengths
    try:
        tag_id = secret_tag.phrase_hash
        if len(tag_id) != 16:
            raise InvalidInputError("TagID must be 16 bytes", "tag_id")
        
        salt = secret_tag.salt
        if len(salt) != 16:
            raise InvalidInputError("Salt must be 16 bytes", "salt")
        
        verifier = secret_tag.verifier
        if len(verifier) != 32:
            raise InvalidInputError("Verifier must be 32 bytes", "verifier")
            
    except Exception as e:
        raise InvalidInputError(f"Invalid SecretTag encoding: {e}", "secret_tag")


def export_secret_tag_for_backup(secret_tag: SecretTag) -> dict:
    """
    Export a secret tag in a format suitable for backup/export.
    
    Args:
        secret_tag: The SecretTag to export
        
    Returns:
        Dictionary with base64-encoded fields for backup
        
    Example:
        backup_data = export_secret_tag_for_backup(secret_tag)
        # Store backup_data in secure backup system
    """
    validate_secret_tag(secret_tag)
    
    return {
                    'tag_id': base64.b64encode(secret_tag.phrase_hash).decode('ascii'),
        'salt': secret_tag.salt_b64,
        'verifier': secret_tag.verifier_b64,
        'version': '1.0',  # For future compatibility
        'algorithm': 'OPAQUE-Argon2id-HKDF-BLAKE2s'
    }


def import_secret_tag_from_backup(backup_data: dict) -> SecretTag:
    """
    Import a secret tag from backup data.
    
    Args:
        backup_data: Dictionary with backup data
        
    Returns:
        Restored SecretTag
        
    Raises:
        InvalidInputError: If backup data is invalid
        
    Example:
        secret_tag = import_secret_tag_from_backup(backup_data)
        # secret_tag is ready for use
    """
    if not isinstance(backup_data, dict):
        raise InvalidInputError("Backup data must be dictionary", "backup_data")
    
    required_fields = ['tag_id', 'salt', 'verifier']
    for field in required_fields:
        if field not in backup_data:
            raise InvalidInputError(f"Missing field: {field}", "backup_data")
    
    try:
        secret_tag = SecretTag(
            tag_id_b64=backup_data['tag_id'],
            salt_b64=backup_data['salt'],
            verifier_b64=backup_data['verifier']
        )
        
        # Validate the imported tag
        validate_secret_tag(secret_tag)
        
        return secret_tag
        
    except Exception as e:
        raise InvalidInputError(f"Invalid backup data: {e}", "backup_data")


def get_performance_profile(environment: Environment) -> dict:
    """
    Get performance characteristics for a given environment.
    
    Args:
        environment: The target environment
        
    Returns:
        Dictionary with expected performance characteristics
    """
    config = Argon2Config.for_environment(environment)
    
    # Estimated times based on typical hardware (rough estimates)
    if environment == Environment.DEVELOPMENT:
        return {
            'argon2id_time_ms': 50,    # Fast for development
            'total_derivation_ms': 60,
            'memory_usage_mb': 16,
            'recommended_use': 'Development and testing only'
        }
    elif environment == Environment.MOBILE:
        return {
            'argon2id_time_ms': 200,   # Optimized for mobile
            'total_derivation_ms': 220,
            'memory_usage_mb': 64,
            'recommended_use': 'Mobile devices and memory-constrained environments'
        }
    else:  # PRODUCTION
        return {
            'argon2id_time_ms': 500,   # Secure for production
            'total_derivation_ms': 520,
            'memory_usage_mb': 64,
            'recommended_use': 'Production servers and high-security environments'
        } 