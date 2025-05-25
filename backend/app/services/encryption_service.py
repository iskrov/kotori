"""
Encryption service for handling hidden journal entries.
Uses AES-256-GCM for authenticated encryption.
"""

import base64
import hashlib
import hmac
import logging
import os
import secrets
from typing import Optional, Tuple

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)


class EncryptionError(Exception):
    """Custom exception for encryption-related errors."""
    pass


class EncryptionService:
    """
    Service for encrypting and decrypting hidden journal entries.
    Uses AES-256-GCM for authenticated encryption with associated data (AEAD).
    """

    @staticmethod
    def generate_key() -> bytes:
        """
        Generate a new 256-bit encryption key.
        This should be stored securely per-user (not implemented in this service).
        """
        return AESGCM.generate_key(bit_length=256)

    @staticmethod
    def hash_phrase(phrase: str, salt: Optional[bytes] = None) -> Tuple[str, str]:
        """
        Hash a code phrase using SHA-256 with salt.
        Returns (hash_hex, salt_hex) for secure storage.
        Uses constant-time comparison-safe hashing.
        """
        if salt is None:
            salt = secrets.token_bytes(32)  # 256-bit salt
        
        # Normalize the phrase (lowercase, strip whitespace, remove punctuation)
        normalized_phrase = phrase.strip().lower().translate(
            str.maketrans('', '', '.,!?;:')
        )
        
        # Use PBKDF2 for key stretching (more secure than plain SHA-256)
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,  # OWASP recommended minimum
            backend=default_backend()
        )
        
        key = kdf.derive(normalized_phrase.encode('utf-8'))
        
        return base64.b64encode(key).decode('utf-8'), base64.b64encode(salt).decode('utf-8')

    @staticmethod
    def verify_phrase(phrase: str, stored_hash: str, stored_salt: str) -> bool:
        """
        Verify a code phrase against stored hash using constant-time comparison.
        """
        try:
            salt = base64.b64decode(stored_salt.encode('utf-8'))
            expected_hash, _ = EncryptionService.hash_phrase(phrase, salt)
            
            # Use constant-time comparison to prevent timing attacks
            return hmac.compare_digest(expected_hash, stored_hash)
        except Exception as e:
            logger.error(f"Error verifying phrase: {e}")
            return False

    @staticmethod
    def encrypt_content(content: str, key: bytes) -> Tuple[str, str]:
        """
        Encrypt content using AES-256-GCM.
        Returns (encrypted_content_b64, iv_b64).
        """
        try:
            aesgcm = AESGCM(key)
            iv = os.urandom(12)  # 96-bit IV for GCM
            
            # Encrypt with authenticated encryption
            encrypted_data = aesgcm.encrypt(iv, content.encode('utf-8'), None)
            
            # Return base64-encoded strings for database storage
            encrypted_b64 = base64.b64encode(encrypted_data).decode('utf-8')
            iv_b64 = base64.b64encode(iv).decode('utf-8')
            
            return encrypted_b64, iv_b64
            
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise EncryptionError(f"Failed to encrypt content: {e}") from e

    @staticmethod
    def decrypt_content(encrypted_content_b64: str, iv_b64: str, key: bytes) -> str:
        """
        Decrypt content using AES-256-GCM.
        Returns the original plaintext content.
        """
        try:
            aesgcm = AESGCM(key)
            
            # Decode from base64
            encrypted_data = base64.b64decode(encrypted_content_b64.encode('utf-8'))
            iv = base64.b64decode(iv_b64.encode('utf-8'))
            
            # Decrypt and verify authenticity
            decrypted_data = aesgcm.decrypt(iv, encrypted_data, None)
            
            return decrypted_data.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise EncryptionError(f"Failed to decrypt content: {e}") from e

    @staticmethod
    def derive_user_key(user_id: int, master_salt: bytes) -> bytes:
        """
        Derive a user-specific encryption key from user ID and master salt.
        This is a temporary solution - in production, keys should be stored
        in device secure enclaves (Android Keystore/iOS Secure Enclave).
        """
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=master_salt,
            iterations=100000,
            backend=default_backend()
        )
        
        # Use user ID as key material (in production, use device-specific data)
        user_key_material = f"user_{user_id}".encode('utf-8')
        return kdf.derive(user_key_material)


# Singleton instance
encryption_service = EncryptionService() 