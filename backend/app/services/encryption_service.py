"""
Encryption Service

This service provides secure AES-GCM encryption capabilities for journal entries
with integrated key management, secure memory handling, and comprehensive security features.

Key Features:
- AES-GCM authenticated encryption with 256-bit keys
- Secure random IV generation for each encryption operation
- Key derivation and management integration with OPAQUE system
- Secure memory handling to prevent key leakage
- Comprehensive error handling and validation
- Performance monitoring and audit logging

Security:
- Authenticated encryption prevents tampering
- Random IV ensures unique ciphertexts
- Secure key derivation using OPAQUE protocol
- Memory protection for sensitive operations
- Constant-time operations where applicable
"""

import logging
import os
import hashlib
import time
from typing import Tuple, Optional, Dict, Any
from dataclasses import dataclass
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend

from ..crypto.memory import SecureMemory
from ..utils.performance_monitor import get_performance_monitor, time_operation
from ..core.security import audit_security_event

logger = logging.getLogger(__name__)

class EncryptionError(Exception):
    """Base exception for encryption operations"""
    pass

class KeyDerivationError(EncryptionError):
    """Exception for key derivation errors"""
    pass

class EncryptionOperationError(EncryptionError):
    """Exception for encryption/decryption operation errors"""
    pass

@dataclass
class EncryptionResult:
    """Result of an encryption operation"""
    iv: bytes                    # 12-byte initialization vector
    ciphertext: bytes           # Encrypted content
    auth_tag: bytes             # 16-byte authentication tag (included in AESGCM)
    key_id: Optional[str] = None # Optional key identifier
    
    def to_dict(self) -> Dict[str, str]:
        """Convert to dictionary with hex-encoded values"""
        return {
            "iv": self.iv.hex(),
            "ciphertext": self.ciphertext.hex(),
            "auth_tag": self.auth_tag.hex() if self.auth_tag else "",
            "key_id": self.key_id or ""
        }

@dataclass
class DecryptionRequest:
    """Request for decryption operation"""
    iv: bytes
    ciphertext: bytes
    auth_tag: bytes
    encryption_key: bytes
    associated_data: Optional[bytes] = None

class EncryptionService:
    """
    Service for secure AES-GCM encryption operations.
    
    Provides high-level encryption and decryption capabilities with:
    - Secure key management and derivation
    - Authenticated encryption (AES-GCM)
    - Secure memory handling
    - Performance monitoring
    - Comprehensive audit logging
    """
    
    # Encryption configuration
    AES_KEY_SIZE = 32       # 256-bit AES keys
    IV_SIZE = 12            # 96-bit IV for AES-GCM
    AUTH_TAG_SIZE = 16      # 128-bit authentication tag
    MAX_CONTENT_SIZE = 10 * 1024 * 1024  # 10MB max content size
    
    def __init__(self):
        """Initialize the encryption service"""
        # Create secure memory buffer for key operations (64KB should be sufficient)
        self.secure_memory = SecureMemory(64 * 1024)
        self.performance_monitor = get_performance_monitor()
        self.backend = default_backend()
        
        # Validate cryptographic library availability
        self._validate_crypto_support()
    
    def _validate_crypto_support(self) -> None:
        """Validate that required cryptographic primitives are available"""
        try:
            # Test AES-GCM availability
            test_key = os.urandom(self.AES_KEY_SIZE)
            test_iv = os.urandom(self.IV_SIZE)
            test_data = b"test"
            
            aesgcm = AESGCM(test_key)
            ciphertext = aesgcm.encrypt(test_iv, test_data, None)
            plaintext = aesgcm.decrypt(test_iv, ciphertext, None)
            
            if plaintext != test_data:
                raise EncryptionError("AES-GCM test encryption/decryption failed")
                
            logger.info("Encryption service initialized successfully")
            
        except Exception as e:
            logger.error(f"Cryptographic support validation failed: {e}")
            raise EncryptionError(f"Cryptographic library validation failed: {e}")
    
    def encrypt_content(
        self,
        content: str,
        encryption_key: bytes,
        associated_data: Optional[bytes] = None,
        key_id: Optional[str] = None
    ) -> EncryptionResult:
        """
        Encrypt content using AES-GCM.
        
        Args:
            content: The plaintext content to encrypt
            encryption_key: 32-byte AES encryption key
            associated_data: Optional additional authenticated data
            key_id: Optional identifier for the encryption key
            
        Returns:
            EncryptionResult containing IV, ciphertext, and auth tag
            
        Raises:
            EncryptionOperationError: If encryption fails
        """
        if not content:
            raise EncryptionOperationError("Content cannot be empty")
        
        if len(content.encode('utf-8')) > self.MAX_CONTENT_SIZE:
            raise EncryptionOperationError(f"Content size exceeds maximum ({self.MAX_CONTENT_SIZE} bytes)")
        
        if len(encryption_key) != self.AES_KEY_SIZE:
            raise EncryptionOperationError(f"Encryption key must be {self.AES_KEY_SIZE} bytes")
        
        try:
            with time_operation("content_encryption"):
                # Generate random IV
                iv = os.urandom(self.IV_SIZE)
                
                # Convert content to bytes
                plaintext = content.encode('utf-8')
                
                # Perform AES-GCM encryption
                aesgcm = AESGCM(encryption_key)
                ciphertext = aesgcm.encrypt(iv, plaintext, associated_data)
                
                # Extract auth tag (last 16 bytes for AES-GCM)
                auth_tag = ciphertext[-self.AUTH_TAG_SIZE:]
                ciphertext_only = ciphertext[:-self.AUTH_TAG_SIZE]
                
                result = EncryptionResult(
                    iv=iv,
                    ciphertext=ciphertext_only,
                    auth_tag=auth_tag,
                    key_id=key_id
                )
                
                # Audit encryption operation
                self._audit_encryption_operation(
                    key_id=key_id,
                    content_size=len(plaintext),
                    success=True
                )
                
                logger.debug(f"Successfully encrypted content ({len(plaintext)} bytes)")
                
                return result
                
        except Exception as e:
            logger.error(f"Content encryption failed: {e}")
            self._audit_encryption_operation(
                key_id=key_id,
                content_size=len(content.encode('utf-8')),
                success=False,
                error=str(e)
            )
            raise EncryptionOperationError(f"Encryption failed: {e}")
    
    def decrypt_content(
        self,
        decryption_request: DecryptionRequest,
        key_id: Optional[str] = None
    ) -> str:
        """
        Decrypt content using AES-GCM.
        
        Args:
            decryption_request: DecryptionRequest with encrypted data and key
            key_id: Optional identifier for the decryption key
            
        Returns:
            Decrypted plaintext content as string
            
        Raises:
            EncryptionOperationError: If decryption fails
        """
        req = decryption_request
        
        if len(req.encryption_key) != self.AES_KEY_SIZE:
            raise EncryptionOperationError(f"Decryption key must be {self.AES_KEY_SIZE} bytes")
        
        if len(req.iv) != self.IV_SIZE:
            raise EncryptionOperationError(f"IV must be {self.IV_SIZE} bytes")
        
        if len(req.auth_tag) != self.AUTH_TAG_SIZE:
            raise EncryptionOperationError(f"Auth tag must be {self.AUTH_TAG_SIZE} bytes")
        
        try:
            with time_operation("content_decryption"):
                # Reconstruct full ciphertext with auth tag
                full_ciphertext = req.ciphertext + req.auth_tag
                
                # Perform AES-GCM decryption
                aesgcm = AESGCM(req.encryption_key)
                plaintext = aesgcm.decrypt(req.iv, full_ciphertext, req.associated_data)
                
                # Convert to string
                content = plaintext.decode('utf-8')
                
                # Audit decryption operation
                self._audit_decryption_operation(
                    key_id=key_id,
                    content_size=len(plaintext),
                    success=True
                )
                
                logger.debug(f"Successfully decrypted content ({len(plaintext)} bytes)")
                
                return content
                
        except Exception as e:
            logger.error(f"Content decryption failed: {e}")
            self._audit_decryption_operation(
                key_id=key_id,
                content_size=len(req.ciphertext),
                success=False,
                error=str(e)
            )
            raise EncryptionOperationError(f"Decryption failed: {e}")
    
    def derive_content_key(
        self,
        master_key: bytes,
        salt: bytes,
        info: bytes = b"journal_content_key"
    ) -> bytes:
        """
        Derive a content encryption key from a master key using HKDF.
        
        Args:
            master_key: Master key material (e.g., from OPAQUE)
            salt: Random salt for key derivation
            info: Context-specific info string
            
        Returns:
            Derived 32-byte AES key
            
        Raises:
            KeyDerivationError: If key derivation fails
        """
        if len(master_key) < 16:
            raise KeyDerivationError("Master key must be at least 16 bytes")
        
        if len(salt) < 16:
            raise KeyDerivationError("Salt must be at least 16 bytes")
        
        try:
            with time_operation("key_derivation"):
                # Derive key using HKDF-SHA256
                hkdf = HKDF(
                    algorithm=hashes.SHA256(),
                    length=self.AES_KEY_SIZE,
                    salt=salt,
                    info=info,
                    backend=self.backend
                )
                
                derived_key = hkdf.derive(master_key)
                
                logger.debug("Successfully derived content encryption key")
                
                return derived_key
                
        except Exception as e:
            logger.error(f"Key derivation failed: {e}")
            raise KeyDerivationError(f"Key derivation failed: {e}")
    
    def generate_encryption_salt(self, size: int = 32) -> bytes:
        """
        Generate a random salt for key derivation.
        
        Args:
            size: Size of salt in bytes (default 32)
            
        Returns:
            Random salt bytes
        """
        if size < 16:
            raise ValueError("Salt size must be at least 16 bytes")
        
        return os.urandom(size)
    
    def validate_encryption_parameters(
        self,
        iv: Optional[bytes] = None,
        key: Optional[bytes] = None,
        auth_tag: Optional[bytes] = None
    ) -> Dict[str, bool]:
        """
        Validate encryption parameters.
        
        Args:
            iv: Optional IV to validate
            key: Optional key to validate
            auth_tag: Optional auth tag to validate
            
        Returns:
            Dictionary of validation results
        """
        results = {}
        
        if iv is not None:
            results["iv_valid"] = len(iv) == self.IV_SIZE
        
        if key is not None:
            results["key_valid"] = len(key) == self.AES_KEY_SIZE
        
        if auth_tag is not None:
            results["auth_tag_valid"] = len(auth_tag) == self.AUTH_TAG_SIZE
        
        return results
    
    def get_encryption_info(self) -> Dict[str, Any]:
        """
        Get information about encryption configuration.
        
        Returns:
            Dictionary with encryption configuration details
        """
        return {
            "algorithm": "AES-GCM",
            "key_size_bits": self.AES_KEY_SIZE * 8,
            "iv_size_bytes": self.IV_SIZE,
            "auth_tag_size_bytes": self.AUTH_TAG_SIZE,
            "max_content_size_bytes": self.MAX_CONTENT_SIZE,
            "kdf": "HKDF-SHA256"
        }
    
    def secure_compare(self, a: bytes, b: bytes) -> bool:
        """
        Constant-time comparison of byte sequences.
        
        Args:
            a: First byte sequence
            b: Second byte sequence
            
        Returns:
            True if sequences are equal, False otherwise
        """
        if len(a) != len(b):
            return False
        
        result = 0
        for x, y in zip(a, b):
            result |= x ^ y
        
        return result == 0
    
    def cleanup_key(self, key: bytes) -> None:
        """
        Securely clean up a key from memory.
        
        Args:
            key: Key bytes to clean up
        """
        try:
            self.secure_memory.secure_zero(key)
        except Exception as e:
            logger.warning(f"Failed to securely zero key: {e}")
    
    # Audit logging methods
    def _audit_encryption_operation(
        self,
        key_id: Optional[str],
        content_size: int,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Audit encryption operations"""
        audit_security_event(
            event_type="content_encryption",
            details={
                "key_id": key_id,
                "content_size_bytes": content_size,
                "success": success,
                "error": error,
                "timestamp": time.time()
            }
        )
    
    def _audit_decryption_operation(
        self,
        key_id: Optional[str],
        content_size: int,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Audit decryption operations"""
        audit_security_event(
            event_type="content_decryption",
            details={
                "key_id": key_id,
                "content_size_bytes": content_size,
                "success": success,
                "error": error,
                "timestamp": time.time()
            }
        )

# Service factory function
def create_encryption_service() -> EncryptionService:
    """Create and configure an encryption service instance"""
    return EncryptionService()


# Create singleton instance
encryption_service = EncryptionService() 