"""
AES-GCM Cryptographic Utilities

This module provides low-level AES-GCM encryption and decryption operations
with secure random number generation and proper error handling.

Features:
- AES-256-GCM authenticated encryption
- Secure random IV generation
- Proper key validation
- Comprehensive error handling
- Memory-safe operations

Security:
- Uses cryptographically secure random number generation
- Validates all input parameters
- Provides constant-time operations where applicable
- Includes comprehensive error handling
"""

import os
import logging
from typing import Tuple, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

logger = logging.getLogger(__name__)

class AESGCMError(Exception):
    """Base exception for AES-GCM operations"""
    pass

class AESGCMKeyError(AESGCMError):
    """Exception for invalid key parameters"""
    pass

class AESGCMEncryptionError(AESGCMError):
    """Exception for encryption failures"""
    pass

class AESGCMDecryptionError(AESGCMError):
    """Exception for decryption failures"""
    pass

class AESGCMCrypto:
    """
    Low-level AES-GCM cryptographic operations.
    
    This class provides secure AES-256-GCM encryption and decryption
    with proper validation and error handling.
    """
    
    # Constants
    KEY_SIZE = 32       # 256-bit AES keys
    IV_SIZE = 12        # 96-bit IV for AES-GCM (recommended)
    AUTH_TAG_SIZE = 16  # 128-bit authentication tag
    
    def __init__(self):
        """Initialize AES-GCM crypto utility"""
        self._validate_environment()
    
    def _validate_environment(self) -> None:
        """Validate that the cryptographic environment is properly set up"""
        try:
            # Test basic AES-GCM functionality
            test_key = self.generate_key()
            test_iv = self.generate_iv()
            test_data = b"test_data"
            
            # Test encryption/decryption round trip
            ciphertext = self.encrypt(test_data, test_key, test_iv)
            plaintext = self.decrypt(ciphertext, test_key)
            
            if plaintext != test_data:
                raise AESGCMError("AES-GCM round-trip test failed")
                
            logger.debug("AES-GCM crypto environment validation successful")
            
        except Exception as e:
            logger.error(f"AES-GCM environment validation failed: {e}")
            raise AESGCMError(f"Cryptographic environment validation failed: {e}")
    
    def generate_key(self) -> bytes:
        """
        Generate a cryptographically secure 256-bit AES key.
        
        Returns:
            32-byte AES-256 key
        """
        return os.urandom(self.KEY_SIZE)
    
    def generate_iv(self) -> bytes:
        """
        Generate a cryptographically secure 96-bit IV for AES-GCM.
        
        Returns:
            12-byte initialization vector
        """
        return os.urandom(self.IV_SIZE)
    
    def encrypt(
        self,
        plaintext: bytes,
        key: bytes,
        iv: Optional[bytes] = None,
        associated_data: Optional[bytes] = None
    ) -> bytes:
        """
        Encrypt data using AES-256-GCM.
        
        Args:
            plaintext: Data to encrypt
            key: 32-byte AES-256 key
            iv: Optional 12-byte IV (generated if not provided)
            associated_data: Optional additional authenticated data
            
        Returns:
            Ciphertext including authentication tag
            
        Raises:
            AESGCMEncryptionError: If encryption fails
            AESGCMKeyError: If key parameters are invalid
        """
        # Validate inputs
        self._validate_key(key)
        
        if iv is None:
            iv = self.generate_iv()
        else:
            self._validate_iv(iv)
        
        if not plaintext:
            raise AESGCMEncryptionError("Plaintext cannot be empty")
        
        try:
            # Create AESGCM cipher
            aesgcm = AESGCM(key)
            
            # Encrypt with authentication
            ciphertext = aesgcm.encrypt(iv, plaintext, associated_data)
            
            # Prepend IV to ciphertext for easier handling
            return iv + ciphertext
            
        except Exception as e:
            logger.error(f"AES-GCM encryption failed: {e}")
            raise AESGCMEncryptionError(f"Encryption failed: {e}")
    
    def decrypt(
        self,
        ciphertext_with_iv: bytes,
        key: bytes,
        iv: Optional[bytes] = None,
        associated_data: Optional[bytes] = None
    ) -> bytes:
        """
        Decrypt data using AES-256-GCM.
        
        Args:
            ciphertext_with_iv: Ciphertext with IV prepended (or without if IV provided)
            key: 32-byte AES-256 key
            iv: Optional 12-byte IV (extracted from ciphertext if not provided)
            associated_data: Optional additional authenticated data
            
        Returns:
            Decrypted plaintext
            
        Raises:
            AESGCMDecryptionError: If decryption fails
            AESGCMKeyError: If key parameters are invalid
        """
        # Validate inputs
        self._validate_key(key)
        
        if not ciphertext_with_iv:
            raise AESGCMDecryptionError("Ciphertext cannot be empty")
        
        try:
            # Extract IV and ciphertext
            if iv is None:
                if len(ciphertext_with_iv) < self.IV_SIZE:
                    raise AESGCMDecryptionError("Ciphertext too short to contain IV")
                
                iv = ciphertext_with_iv[:self.IV_SIZE]
                ciphertext = ciphertext_with_iv[self.IV_SIZE:]
            else:
                self._validate_iv(iv)
                ciphertext = ciphertext_with_iv
            
            # Create AESGCM cipher
            aesgcm = AESGCM(key)
            
            # Decrypt and verify authentication
            plaintext = aesgcm.decrypt(iv, ciphertext, associated_data)
            
            return plaintext
            
        except InvalidTag:
            logger.error("AES-GCM authentication verification failed")
            raise AESGCMDecryptionError("Authentication verification failed - data may be corrupted or tampered")
        except Exception as e:
            logger.error(f"AES-GCM decryption failed: {e}")
            raise AESGCMDecryptionError(f"Decryption failed: {e}")
    
    def encrypt_separate_iv(
        self,
        plaintext: bytes,
        key: bytes,
        iv: Optional[bytes] = None,
        associated_data: Optional[bytes] = None
    ) -> Tuple[bytes, bytes]:
        """
        Encrypt data and return IV and ciphertext separately.
        
        Args:
            plaintext: Data to encrypt
            key: 32-byte AES-256 key
            iv: Optional 12-byte IV (generated if not provided)
            associated_data: Optional additional authenticated data
            
        Returns:
            Tuple of (iv, ciphertext)
            
        Raises:
            AESGCMEncryptionError: If encryption fails
            AESGCMKeyError: If key parameters are invalid
        """
        # Validate inputs
        self._validate_key(key)
        
        if iv is None:
            iv = self.generate_iv()
        else:
            self._validate_iv(iv)
        
        if not plaintext:
            raise AESGCMEncryptionError("Plaintext cannot be empty")
        
        try:
            # Create AESGCM cipher
            aesgcm = AESGCM(key)
            
            # Encrypt with authentication
            ciphertext = aesgcm.encrypt(iv, plaintext, associated_data)
            
            return iv, ciphertext
            
        except Exception as e:
            logger.error(f"AES-GCM encryption failed: {e}")
            raise AESGCMEncryptionError(f"Encryption failed: {e}")
    
    def decrypt_separate_iv(
        self,
        iv: bytes,
        ciphertext: bytes,
        key: bytes,
        associated_data: Optional[bytes] = None
    ) -> bytes:
        """
        Decrypt data with separately provided IV and ciphertext.
        
        Args:
            iv: 12-byte initialization vector
            ciphertext: Encrypted data with authentication tag
            key: 32-byte AES-256 key
            associated_data: Optional additional authenticated data
            
        Returns:
            Decrypted plaintext
            
        Raises:
            AESGCMDecryptionError: If decryption fails
            AESGCMKeyError: If key parameters are invalid
        """
        # Validate inputs
        self._validate_key(key)
        self._validate_iv(iv)
        
        if not ciphertext:
            raise AESGCMDecryptionError("Ciphertext cannot be empty")
        
        try:
            # Create AESGCM cipher
            aesgcm = AESGCM(key)
            
            # Decrypt and verify authentication
            plaintext = aesgcm.decrypt(iv, ciphertext, associated_data)
            
            return plaintext
            
        except InvalidTag:
            logger.error("AES-GCM authentication verification failed")
            raise AESGCMDecryptionError("Authentication verification failed - data may be corrupted or tampered")
        except Exception as e:
            logger.error(f"AES-GCM decryption failed: {e}")
            raise AESGCMDecryptionError(f"Decryption failed: {e}")
    
    def _validate_key(self, key: bytes) -> None:
        """Validate AES key parameters"""
        if not isinstance(key, bytes):
            raise AESGCMKeyError("Key must be bytes")
        
        if len(key) != self.KEY_SIZE:
            raise AESGCMKeyError(f"Key must be {self.KEY_SIZE} bytes (got {len(key)})")
    
    def _validate_iv(self, iv: bytes) -> None:
        """Validate IV parameters"""
        if not isinstance(iv, bytes):
            raise AESGCMKeyError("IV must be bytes")
        
        if len(iv) != self.IV_SIZE:
            raise AESGCMKeyError(f"IV must be {self.IV_SIZE} bytes (got {len(iv)})")
    
    def get_info(self) -> dict:
        """Get information about AES-GCM configuration"""
        return {
            "algorithm": "AES-256-GCM",
            "key_size_bytes": self.KEY_SIZE,
            "iv_size_bytes": self.IV_SIZE,
            "auth_tag_size_bytes": self.AUTH_TAG_SIZE,
            "block_size_bytes": 16  # AES block size
        } 