"""
Vault Key Management with OPAQUE Integration

Provides high-level interface for protecting vault data keys using OPAQUE-derived
encryption keys and AES Key Wrap. Handles the complete lifecycle of vault keys
from generation to secure storage and retrieval.
"""

import base64
import time
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
from contextlib import contextmanager

from .aes_kw import (
    AESKeyWrap, wrap_key, unwrap_key, generate_data_key, 
    validate_wrapped_key, get_unwrapped_key_size, AESKeyWrapError
)
from .key_derivation import OpaqueKeys, derive_opaque_keys_from_phrase
from .key_manager import SessionKeyManager, KeyType
from .secure_memory import locked_memory
from .memory import secure_zero, secure_random_bytes
from .errors import CryptoError, InvalidInputError


class VaultKeyError(CryptoError):
    """Vault key management specific errors."""
    pass


@dataclass
class WrappedVaultKey:
    """
    Represents a vault data key that has been wrapped with AES-KW.
    
    This structure is safe to store in databases or transmit over networks
    as it contains no plaintext key material.
    """
    wrapped_key: str  # Base64-encoded wrapped key data
    key_size: int     # Size of the unwrapped key in bytes
    created_at: float = field(default_factory=time.time)
    tag_id: Optional[str] = None  # Associated TagID for tracking
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            'wrapped_key': self.wrapped_key,
            'key_size': self.key_size,
            'created_at': self.created_at,
            'tag_id': self.tag_id,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'WrappedVaultKey':
        """Create from dictionary loaded from storage."""
        return cls(
            wrapped_key=data['wrapped_key'],
            key_size=data['key_size'],
            created_at=data.get('created_at', time.time()),
            tag_id=data.get('tag_id'),
            metadata=data.get('metadata', {})
        )
    
    def get_wrapped_bytes(self) -> bytes:
        """Get the wrapped key as bytes."""
        try:
            return base64.b64decode(self.wrapped_key)
        except Exception as e:
            raise VaultKeyError(f"Invalid base64 wrapped key: {e}")


class VaultKeyManager:
    """
    High-level manager for vault data keys with OPAQUE integration.
    
    Handles the complete lifecycle of vault keys:
    - Generation of new data keys
    - Wrapping with OPAQUE-derived encryption keys
    - Secure storage and retrieval
    - Session-based key management
    """
    
    def __init__(self, key_manager: Optional[SessionKeyManager] = None):
        """
        Initialize vault key manager.
        
        Args:
            key_manager: Session key manager instance (creates new if None)
        """
        self.key_manager = key_manager or SessionKeyManager()
    
    def create_vault_key(
        self,
        secret_phrase: str,
        key_size: int = 32,
        session_id: Optional[str] = None
    ) -> WrappedVaultKey:
        """
        Create a new vault data key and wrap it with OPAQUE-derived encryption key.
        
        Args:
            secret_phrase: Secret phrase for OPAQUE key derivation
            key_size: Size of data key to generate (default 32 bytes)
            session_id: Session ID for key management
            
        Returns:
            WrappedVaultKey containing the protected data key
            
        Raises:
            VaultKeyError: If key creation fails
            InvalidInputError: If parameters are invalid
        """
        if not secret_phrase:
            raise InvalidInputError("Secret phrase cannot be empty")
        
        if key_size < 16 or key_size > 64 or key_size % 8 != 0:
            raise InvalidInputError(
                "Key size must be between 16-64 bytes and multiple of 8"
            )
        
        try:
            # Derive OPAQUE keys from secret phrase
            opaque_keys = derive_opaque_keys_from_phrase(secret_phrase)
            
            # Store encryption key in session if provided
            if session_id:
                self.key_manager.store_session_key(
                    session_id=session_id,
                    key_data=opaque_keys.encryption_key,
                    key_type=KeyType.ENCRYPTION,
                    ttl=3600  # 1 hour default
                )
            
            # Generate new data key
            data_key = generate_data_key(key_size)
            
            # Wrap data key with encryption key
            wrapped_data = wrap_key(opaque_keys.encryption_key, data_key)
            
            # Create wrapped vault key
            wrapped_vault_key = WrappedVaultKey(
                wrapped_key=base64.b64encode(wrapped_data).decode('ascii'),
                key_size=key_size,
                tag_id=opaque_keys.tag_id.hex(),
                metadata={
                    'algorithm': 'AES-KW',
                    'kek_size': len(opaque_keys.encryption_key),
                    'session_id': session_id,
                    'salt': base64.b64encode(opaque_keys.salt).decode('ascii')
                }
            )
            
            # Secure cleanup - convert to bytearray first for zeroing
            if isinstance(data_key, bytes):
                data_key_array = bytearray(data_key)
                secure_zero(data_key_array)
            else:
                secure_zero(data_key)
            
            return wrapped_vault_key
            
        except Exception as e:
            raise VaultKeyError(f"Failed to create vault key: {e}")
    
    def unwrap_vault_key(
        self,
        wrapped_vault_key: WrappedVaultKey,
        secret_phrase: str,
        session_id: Optional[str] = None
    ) -> bytes:
        """
        Unwrap a vault data key using OPAQUE-derived encryption key.
        
        Args:
            wrapped_vault_key: The wrapped vault key to unwrap
            secret_phrase: Secret phrase for OPAQUE key derivation
            session_id: Session ID for key caching
            
        Returns:
            Unwrapped data key bytes
            
        Raises:
            VaultKeyError: If unwrapping fails
            InvalidInputError: If parameters are invalid
        """
        if not secret_phrase:
            raise InvalidInputError("Secret phrase cannot be empty")
        
        try:
            # Try to get cached encryption key first
            encryption_key = None
            if session_id:
                try:
                    # We need to store the key_id when we store the key
                    # For now, fall back to derivation since we don't have the key_id
                    pass
                except:
                    pass  # Fall back to derivation
            
            # Derive encryption key if not cached
            if encryption_key is None:
                # Get the salt from metadata if available
                salt = None
                if 'salt' in wrapped_vault_key.metadata:
                    import base64
                    salt = base64.b64decode(wrapped_vault_key.metadata['salt'])
                
                opaque_keys = derive_opaque_keys_from_phrase(secret_phrase, salt=salt)
                encryption_key = opaque_keys.encryption_key
                
                # Verify TagID matches if available
                if wrapped_vault_key.tag_id:
                    expected_tag_id = wrapped_vault_key.tag_id
                    actual_tag_id = opaque_keys.tag_id.hex()
                    if expected_tag_id != actual_tag_id:
                        raise VaultKeyError(
                            f"TagID mismatch: expected {expected_tag_id}, got {actual_tag_id}"
                        )
                
                # Cache for future use
                if session_id:
                    self.key_manager.store_session_key(
                        session_id=session_id,
                        key_data=encryption_key,
                        key_type=KeyType.ENCRYPTION,
                        ttl=3600
                    )
            
            # Get wrapped key bytes
            wrapped_data = wrapped_vault_key.get_wrapped_bytes()
            
            # Validate wrapped key format
            if not validate_wrapped_key(wrapped_data):
                raise VaultKeyError("Invalid wrapped key format")
            
            # Verify expected key size matches
            expected_size = get_unwrapped_key_size(wrapped_data)
            if expected_size != wrapped_vault_key.key_size:
                raise VaultKeyError(
                    f"Key size mismatch: expected {wrapped_vault_key.key_size}, "
                    f"wrapped data indicates {expected_size}"
                )
            
            # Unwrap the data key
            data_key = unwrap_key(encryption_key, wrapped_data)
            
            return data_key
            
        except AESKeyWrapError as e:
            raise VaultKeyError(f"Key unwrapping failed: {e}")
        except Exception as e:
            raise VaultKeyError(f"Failed to unwrap vault key: {e}")
    
    @contextmanager
    def temporary_vault_key(
        self,
        wrapped_vault_key: WrappedVaultKey,
        secret_phrase: str,
        session_id: Optional[str] = None
    ):
        """
        Context manager for temporary access to unwrapped vault key.
        
        Automatically cleans up the unwrapped key when exiting the context.
        
        Args:
            wrapped_vault_key: The wrapped vault key to unwrap
            secret_phrase: Secret phrase for OPAQUE key derivation
            session_id: Session ID for key caching
            
        Yields:
            Unwrapped data key bytes
            
        Raises:
            VaultKeyError: If unwrapping fails
        """
        data_key = None
        try:
            data_key = self.unwrap_vault_key(
                wrapped_vault_key, secret_phrase, session_id
            )
            yield data_key
        finally:
            if data_key is not None:
                # Convert to bytearray for secure zeroing
                if isinstance(data_key, bytes):
                    data_key_array = bytearray(data_key)
                    secure_zero(data_key_array)
                else:
                    secure_zero(data_key)
    
    def rotate_vault_key(
        self,
        old_wrapped_key: WrappedVaultKey,
        secret_phrase: str,
        new_key_size: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> WrappedVaultKey:
        """
        Rotate a vault key by creating a new one with the same or different size.
        
        Args:
            old_wrapped_key: The existing wrapped vault key
            secret_phrase: Secret phrase for OPAQUE key derivation
            new_key_size: Size of new key (uses old size if None)
            session_id: Session ID for key management
            
        Returns:
            New WrappedVaultKey with rotated key material
            
        Raises:
            VaultKeyError: If rotation fails
        """
        if new_key_size is None:
            new_key_size = old_wrapped_key.key_size
        
        try:
            # Verify we can unwrap the old key
            with self.temporary_vault_key(old_wrapped_key, secret_phrase, session_id):
                pass  # Just verify unwrapping works
            
            # Create new vault key
            new_wrapped_key = self.create_vault_key(
                secret_phrase, new_key_size, session_id
            )
            
            # Copy metadata from old key
            new_wrapped_key.metadata.update(old_wrapped_key.metadata)
            new_wrapped_key.metadata['rotated_from'] = {
                'old_key_size': old_wrapped_key.key_size,
                'rotation_time': time.time()
            }
            
            return new_wrapped_key
            
        except Exception as e:
            raise VaultKeyError(f"Key rotation failed: {e}")
    
    def verify_vault_key(
        self,
        wrapped_vault_key: WrappedVaultKey,
        secret_phrase: str,
        session_id: Optional[str] = None
    ) -> bool:
        """
        Verify that a wrapped vault key can be successfully unwrapped.
        
        Args:
            wrapped_vault_key: The wrapped vault key to verify
            secret_phrase: Secret phrase for OPAQUE key derivation
            session_id: Session ID for key caching
            
        Returns:
            True if key can be unwrapped, False otherwise
        """
        try:
            with self.temporary_vault_key(wrapped_vault_key, secret_phrase, session_id):
                return True
        except:
            return False
    
    def get_key_info(self, wrapped_vault_key: WrappedVaultKey) -> Dict[str, Any]:
        """
        Get information about a wrapped vault key without unwrapping it.
        
        Args:
            wrapped_vault_key: The wrapped vault key to analyze
            
        Returns:
            Dictionary containing key information
        """
        try:
            wrapped_data = wrapped_vault_key.get_wrapped_bytes()
            is_valid = validate_wrapped_key(wrapped_data)
            
            info = {
                'key_size': wrapped_vault_key.key_size,
                'wrapped_size': len(wrapped_data),
                'is_valid_format': is_valid,
                'created_at': wrapped_vault_key.created_at,
                'tag_id': wrapped_vault_key.tag_id,
                'metadata': wrapped_vault_key.metadata.copy()
            }
            
            if is_valid:
                info['calculated_key_size'] = get_unwrapped_key_size(wrapped_data)
                info['size_consistent'] = (
                    info['calculated_key_size'] == wrapped_vault_key.key_size
                )
            
            return info
            
        except Exception as e:
            return {
                'error': str(e),
                'is_valid_format': False
            }
    
    def cleanup_session(self, session_id: str) -> None:
        """
        Clean up all vault-related keys for a session.
        
        Args:
            session_id: Session ID to clean up
        """
        try:
            # End the session to clean up all keys
            self.key_manager.end_session(session_id)
        except:
            pass  # Session might not exist


# Convenience functions for direct use

def create_vault_key_for_phrase(
    secret_phrase: str,
    key_size: int = 32
) -> WrappedVaultKey:
    """
    Convenience function to create a vault key for a secret phrase.
    
    Args:
        secret_phrase: Secret phrase for OPAQUE key derivation
        key_size: Size of data key to generate
        
    Returns:
        WrappedVaultKey containing the protected data key
    """
    manager = VaultKeyManager()
    return manager.create_vault_key(secret_phrase, key_size)


def unwrap_vault_key_with_phrase(
    wrapped_vault_key: WrappedVaultKey,
    secret_phrase: str
) -> bytes:
    """
    Convenience function to unwrap a vault key with a secret phrase.
    
    Args:
        wrapped_vault_key: The wrapped vault key to unwrap
        secret_phrase: Secret phrase for OPAQUE key derivation
        
    Returns:
        Unwrapped data key bytes
    """
    manager = VaultKeyManager()
    return manager.unwrap_vault_key(wrapped_vault_key, secret_phrase)


@contextmanager
def vault_key_context(
    wrapped_vault_key: WrappedVaultKey,
    secret_phrase: str
):
    """
    Convenience context manager for temporary vault key access.
    
    Args:
        wrapped_vault_key: The wrapped vault key to unwrap
        secret_phrase: Secret phrase for OPAQUE key derivation
        
    Yields:
        Unwrapped data key bytes
    """
    manager = VaultKeyManager()
    with manager.temporary_vault_key(wrapped_vault_key, secret_phrase) as key:
        yield key 