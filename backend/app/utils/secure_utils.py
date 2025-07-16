"""
Secure utility functions for production-ready security operations.

This module provides secure token generation, hashing, validation, 
configuration management, and logging utilities.
"""

import secrets
import hashlib
import hmac
import base64
import time
import os
import re
import json
import logging
from typing import Dict, List, Optional, Union, Any, Tuple
from dataclasses import dataclass
from urllib.parse import urlparse
import ipaddress
from datetime import datetime, timedelta, UTC
import bcrypt
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import validators
from email_validator import validate_email, EmailNotValidError

logger = logging.getLogger(__name__)

# Security constants
SECURE_TOKEN_LENGTH = 32
BCRYPT_ROUNDS = 12
PBKDF2_ITERATIONS = 100000
HMAC_KEY_LENGTH = 32
SESSION_TOKEN_LENGTH = 48
API_KEY_LENGTH = 64
NONCE_LENGTH = 16

# Patterns for sensitive data detection
SENSITIVE_PATTERNS = [
    r'(?i)api[_-]?key[\'"\s:=]+[A-Za-z0-9-_]{16,}',
    r'(?i)secret[\'"\s:=]+[A-Za-z0-9-_]{16,}',
    r'(?i)password[\'"\s:=]+[^\s\'"]+',
    r'(?i)token[\'"\s:=]+[A-Za-z0-9-_]{16,}',
    r'eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+',  # JWT
    r'(?:postgres|mysql|sqlite)://[^:\s]+:[^@\s]+@[^/\s]+',  # DB connection
]


@dataclass
class SecurityHeaders:
    """Security headers configuration."""
    strict_transport_security: str = "max-age=31536000; includeSubDomains; preload"
    content_security_policy: str = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    x_content_type_options: str = "nosniff"
    x_frame_options: str = "DENY"
    x_xss_protection: str = "1; mode=block"
    referrer_policy: str = "strict-origin-when-cross-origin"
    permissions_policy: str = "geolocation=(), camera=(), microphone=()"


class SecureTokenGenerator:
    """Secure token generation utilities."""
    
    @staticmethod
    def generate_api_key(length: int = API_KEY_LENGTH) -> str:
        """
        Generate cryptographically secure API key.
        
        Args:
            length: Length of the API key
            
        Returns:
            str: Base64-encoded API key
        """
        token_bytes = secrets.token_bytes(length)
        return base64.urlsafe_b64encode(token_bytes).decode('utf-8').rstrip('=')
    
    @staticmethod
    def generate_session_id(length: int = SESSION_TOKEN_LENGTH) -> str:
        """
        Generate secure session ID.
        
        Args:
            length: Length of the session ID
            
        Returns:
            str: URL-safe session ID
        """
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def generate_request_id() -> str:
        """
        Generate unique request ID.
        
        Returns:
            str: Unique request identifier
        """
        timestamp = int(time.time())
        random_part = secrets.token_hex(8)
        return f"req_{timestamp}_{random_part}"
    
    @staticmethod
    def generate_nonce(length: int = NONCE_LENGTH) -> str:
        """
        Generate cryptographic nonce.
        
        Args:
            length: Length of the nonce
            
        Returns:
            str: Base64-encoded nonce
        """
        nonce_bytes = secrets.token_bytes(length)
        return base64.b64encode(nonce_bytes).decode('utf-8')
    
    @staticmethod
    def generate_csrf_token() -> str:
        """
        Generate CSRF protection token.
        
        Returns:
            str: CSRF token
        """
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def generate_salt(length: int = 16) -> bytes:
        """
        Generate cryptographic salt.
        
        Args:
            length: Length of the salt in bytes
            
        Returns:
            bytes: Random salt
        """
        return secrets.token_bytes(length)


class SecureHasher:
    """Secure hashing and verification utilities."""
    
    @staticmethod
    def hash_password(password: str, rounds: int = BCRYPT_ROUNDS) -> str:
        """
        Hash password using bcrypt.
        
        Args:
            password: Password to hash
            rounds: Number of bcrypt rounds
            
        Returns:
            str: Hashed password
        """
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt(rounds=rounds)
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """
        Verify password against hash.
        
        Args:
            password: Password to verify
            hashed: Stored hash
            
        Returns:
            bool: True if password matches
        """
        try:
            password_bytes = password.encode('utf-8')
            hashed_bytes = hashed.encode('utf-8')
            return bcrypt.checkpw(password_bytes, hashed_bytes)
        except Exception:
            return False
    
    @staticmethod
    def derive_key(password: str, salt: bytes, length: int = 32, iterations: int = PBKDF2_ITERATIONS) -> bytes:
        """
        Derive key from password using PBKDF2.
        
        Args:
            password: Password to derive from
            salt: Salt bytes
            length: Key length in bytes
            iterations: Number of iterations
            
        Returns:
            bytes: Derived key
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=length,
            salt=salt,
            iterations=iterations,
            backend=default_backend()
        )
        return kdf.derive(password.encode('utf-8'))
    
    @staticmethod
    def hmac_sign(data: Union[str, bytes], key: Union[str, bytes]) -> str:
        """
        Sign data with HMAC-SHA256.
        
        Args:
            data: Data to sign
            key: HMAC key
            
        Returns:
            str: Base64-encoded signature
        """
        if isinstance(data, str):
            data = data.encode('utf-8')
        if isinstance(key, str):
            key = key.encode('utf-8')
        
        signature = hmac.new(key, data, hashlib.sha256).digest()
        return base64.b64encode(signature).decode('utf-8')
    
    @staticmethod
    def hmac_verify(data: Union[str, bytes], signature: str, key: Union[str, bytes]) -> bool:
        """
        Verify HMAC signature.
        
        Args:
            data: Original data
            signature: Signature to verify
            key: HMAC key
            
        Returns:
            bool: True if signature is valid
        """
        try:
            expected_signature = SecureHasher.hmac_sign(data, key)
            return hmac.compare_digest(signature, expected_signature)
        except Exception:
            return False
    
    @staticmethod
    def hash_data(data: Union[str, bytes], algorithm: str = 'sha256') -> str:
        """
        Hash data with specified algorithm.
        
        Args:
            data: Data to hash
            algorithm: Hash algorithm ('sha256', 'sha512', 'blake2b')
            
        Returns:
            str: Hex-encoded hash
        """
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        if algorithm == 'sha256':
            return hashlib.sha256(data).hexdigest()
        elif algorithm == 'sha512':
            return hashlib.sha512(data).hexdigest()
        elif algorithm == 'blake2b':
            return hashlib.blake2b(data).hexdigest()
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")


class SecureValidator:
    """Secure validation utilities."""
    
    @staticmethod
    def is_safe_filename(filename: str) -> bool:
        """
        Check if filename is safe.
        
        Args:
            filename: Filename to check
            
        Returns:
            bool: True if filename is safe
        """
        if not filename or len(filename) > 255:
            return False
        
        # Check for dangerous characters
        dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0']
        if any(char in filename for char in dangerous_chars):
            return False
        
        # Check for reserved names (Windows)
        reserved_names = [
            'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
            'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4',
            'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        ]
        
        name_without_ext = filename.split('.')[0].upper()
        if name_without_ext in reserved_names:
            return False
        
        # Check for hidden files or relative paths
        if filename.startswith('.') or '..' in filename:
            return False
        
        return True
    
    @staticmethod
    def is_safe_redirect_url(url: str, allowed_hosts: List[str]) -> bool:
        """
        Check if redirect URL is safe.
        
        Args:
            url: URL to check
            allowed_hosts: List of allowed hosts
            
        Returns:
            bool: True if URL is safe for redirect
        """
        try:
            parsed = urlparse(url)
            
            # Check for protocol
            if parsed.scheme not in ['http', 'https']:
                return False
            
            # Check for allowed hosts
            if parsed.netloc not in allowed_hosts:
                return False
            
            # Check for dangerous characters
            if any(char in url for char in ['<', '>', '"', "'", '`']):
                return False
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def sanitize_user_input(input_str: str, max_length: int = 1000) -> str:
        """
        Sanitize user input string.
        
        Args:
            input_str: Input string to sanitize
            max_length: Maximum allowed length
            
        Returns:
            str: Sanitized string
        """
        if not input_str:
            return ""
        
        # Remove null bytes
        sanitized = input_str.replace('\0', '')
        
        # Remove control characters except newlines and tabs
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', sanitized)
        
        # Limit length
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length]
        
        return sanitized.strip()
    
    @staticmethod
    def is_valid_email(email: str) -> bool:
        """
        Validate email address.
        
        Args:
            email: Email address to validate
            
        Returns:
            bool: True if email is valid
        """
        try:
            validate_email(email)
            return True
        except EmailNotValidError:
            return False
    
    @staticmethod
    def is_valid_ip_address(ip_str: str) -> bool:
        """
        Validate IP address.
        
        Args:
            ip_str: IP address string
            
        Returns:
            bool: True if IP is valid
        """
        try:
            ipaddress.ip_address(ip_str)
            return True
        except ValueError:
            return False
    
    @staticmethod
    def is_valid_url(url: str) -> bool:
        """
        Validate URL.
        
        Args:
            url: URL to validate
            
        Returns:
            bool: True if URL is valid
        """
        return validators.url(url) is True


class SecureConfig:
    """Secure configuration management."""
    
    def __init__(self):
        self.config_cache: Dict[str, Any] = {}
        self.sensitive_keys = [
            'SECRET_KEY', 'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET',
            'ENCRYPTION_KEY', 'API_KEY', 'PASSWORD', 'TOKEN'
        ]
    
    def get_env_var(self, key: str, default: Optional[str] = None, required: bool = False) -> str:
        """
        Get environment variable with validation.
        
        Args:
            key: Environment variable key
            default: Default value if not found
            required: Whether the variable is required
            
        Returns:
            str: Environment variable value
            
        Raises:
            ValueError: If required variable is missing
        """
        value = os.getenv(key, default)
        
        if required and value is None:
            raise ValueError(f"Required environment variable '{key}' is missing")
        
        # Cache non-sensitive values
        if not any(sensitive in key.upper() for sensitive in self.sensitive_keys):
            self.config_cache[key] = value
        
        return value
    
    def get_security_headers(self) -> Dict[str, str]:
        """
        Get security headers configuration.
        
        Returns:
            Dict[str, str]: Security headers
        """
        headers = SecurityHeaders()
        
        return {
            'Strict-Transport-Security': headers.strict_transport_security,
            'Content-Security-Policy': headers.content_security_policy,
            'X-Content-Type-Options': headers.x_content_type_options,
            'X-Frame-Options': headers.x_frame_options,
            'X-XSS-Protection': headers.x_xss_protection,
            'Referrer-Policy': headers.referrer_policy,
            'Permissions-Policy': headers.permissions_policy
        }
    
    def validate_config(self) -> List[str]:
        """
        Validate configuration for security issues.
        
        Returns:
            List[str]: List of validation errors
        """
        errors = []
        
        # Check for debug mode in production
        if self.get_env_var('DEBUG', 'false').lower() == 'true':
            if self.get_env_var('ENVIRONMENT', 'development') == 'production':
                errors.append("DEBUG mode is enabled in production")
        
        # Check for default secrets
        secret_key = self.get_env_var('SECRET_KEY', '')
        if secret_key in ['', 'change-me', 'default', 'secret']:
            errors.append("Using default or weak SECRET_KEY")
        
        # Check for HTTPS in production
        if self.get_env_var('ENVIRONMENT') == 'production':
            if not self.get_env_var('FORCE_HTTPS', 'false').lower() == 'true':
                errors.append("HTTPS not enforced in production")
        
        return errors
    
    def get_database_url(self) -> str:
        """
        Get database URL with validation.
        
        Returns:
            str: Database URL
        """
        db_url = self.get_env_var('DATABASE_URL', required=True)
        
        # Validate database URL format
        if not db_url.startswith(('postgresql://', 'postgres://', 'sqlite://')):
            raise ValueError("Invalid database URL format")
        
        return db_url


class SecureLogger:
    """Secure logging utilities."""
    
    def __init__(self, logger_name: str = __name__):
        self.logger = logging.getLogger(logger_name)
        self.sensitive_patterns = [re.compile(pattern) for pattern in SENSITIVE_PATTERNS]
    
    def create_audit_log_entry(
        self, 
        user_id: str, 
        action: str, 
        resource: str, 
        details: Dict[str, Any],
        success: bool = True,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create structured audit log entry.
        
        Args:
            user_id: User performing the action
            action: Action being performed
            resource: Resource being accessed
            details: Additional details
            success: Whether the action was successful
            ip_address: IP address of the user
            
        Returns:
            Dict[str, Any]: Structured audit log entry
        """
        log_entry = {
            'timestamp': datetime.now(UTC).isoformat(),
            'user_id': user_id,
            'action': action,
            'resource': resource,
            'success': success,
            'details': self._sanitize_log_data(details),
            'ip_address': ip_address,
            'session_id': self._get_current_session_id()
        }
        
        return log_entry
    
    def log_security_event(
        self, 
        event_type: str, 
        severity: str, 
        message: str, 
        details: Dict[str, Any],
        user_id: Optional[str] = None
    ):
        """
        Log security event.
        
        Args:
            event_type: Type of security event
            severity: Severity level (info, warning, error, critical)
            message: Event message
            details: Additional details
            user_id: User ID if applicable
        """
        log_entry = {
            'timestamp': datetime.now(UTC).isoformat(),
            'event_type': event_type,
            'severity': severity,
            'message': message,
            'details': self._sanitize_log_data(details),
            'user_id': user_id
        }
        
        log_message = f"Security Event: {event_type} - {message}"
        
        if severity == 'critical':
            self.logger.critical(log_message, extra={'security_event': log_entry})
        elif severity == 'error':
            self.logger.error(log_message, extra={'security_event': log_entry})
        elif severity == 'warning':
            self.logger.warning(log_message, extra={'security_event': log_entry})
        else:
            self.logger.info(log_message, extra={'security_event': log_entry})
    
    def _sanitize_log_data(self, data: Any) -> Any:
        """
        Sanitize data for logging by removing sensitive information.
        
        Args:
            data: Data to sanitize
            
        Returns:
            Any: Sanitized data
        """
        if isinstance(data, dict):
            return {
                key: self._sanitize_log_data(value)
                for key, value in data.items()
            }
        elif isinstance(data, list):
            return [self._sanitize_log_data(item) for item in data]
        elif isinstance(data, str):
            return self._sanitize_string(data)
        else:
            return data
    
    def _sanitize_string(self, text: str) -> str:
        """
        Sanitize string by removing sensitive patterns.
        
        Args:
            text: String to sanitize
            
        Returns:
            str: Sanitized string
        """
        sanitized = text
        
        for pattern in self.sensitive_patterns:
            sanitized = pattern.sub('[REDACTED]', sanitized)
        
        return sanitized
    
    def _get_current_session_id(self) -> Optional[str]:
        """
        Get current session ID from context.
        
        Returns:
            Optional[str]: Session ID if available
        """
        # This would be implemented to get session ID from request context
        # For now, return None
        return None


class SecureTimer:
    """Secure timing utilities."""
    
    @staticmethod
    def constant_time_delay(base_delay: float, variance: float = 0.1) -> float:
        """
        Generate constant-time delay with minimal variance.
        
        Args:
            base_delay: Base delay in seconds
            variance: Maximum variance as fraction of base delay
            
        Returns:
            float: Delay in seconds
        """
        max_variance = base_delay * variance
        random_variance = secrets.randbelow(int(max_variance * 1000)) / 1000
        return base_delay + random_variance - (max_variance / 2)
    
    @staticmethod
    def exponential_backoff(attempt: int, base_delay: float = 1.0, max_delay: float = 60.0) -> float:
        """
        Calculate exponential backoff delay.
        
        Args:
            attempt: Attempt number (0-based)
            base_delay: Base delay in seconds
            max_delay: Maximum delay in seconds
            
        Returns:
            float: Delay in seconds
        """
        delay = base_delay * (2 ** attempt)
        return min(delay, max_delay)
    
    @staticmethod
    def rate_limit_delay(requests_per_second: int) -> float:
        """
        Calculate rate limiting delay.
        
        Args:
            requests_per_second: Target requests per second
            
        Returns:
            float: Delay between requests in seconds
        """
        if requests_per_second <= 0:
            return 1.0
        
        return 1.0 / requests_per_second


# Global instances
token_generator = SecureTokenGenerator()
hasher = SecureHasher()
validator = SecureValidator()
config = SecureConfig()
secure_logger = SecureLogger()
timer = SecureTimer()


# Convenience functions
def generate_secure_token(length: int = SECURE_TOKEN_LENGTH) -> str:
    """Generate secure random token."""
    return token_generator.generate_session_id(length)


def hash_password(password: str) -> str:
    """Hash password securely."""
    return hasher.hash_password(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash."""
    return hasher.verify_password(password, hashed)


def sanitize_input(input_str: str, max_length: int = 1000) -> str:
    """Sanitize user input."""
    return validator.sanitize_user_input(input_str, max_length)


def is_valid_email(email: str) -> bool:
    """Validate email address."""
    return validator.is_valid_email(email)


def log_security_event(event_type: str, severity: str, message: str, details: Dict[str, Any]):
    """Log security event."""
    secure_logger.log_security_event(event_type, severity, message, details) 