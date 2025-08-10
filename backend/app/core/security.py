"""
Security utilities and audit logging

This module provides security-related utilities including:
- Security event audit logging
- Security context management
- Rate limiting helpers
- Authentication utilities

The audit logging functionality tracks security-relevant events
for monitoring and compliance purposes.
"""

import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from enum import Enum



logger = logging.getLogger(__name__)

class SecurityEventType(Enum):
    """Security event types for audit logging"""
    # Authentication events
    USER_LOGIN_SUCCESS = "user_login_success"
    USER_LOGIN_FAILURE = "user_login_failure"
    USER_LOGOUT = "user_logout"
    
    # OPAQUE authentication events
    OPAQUE_REGISTRATION = "opaque_registration"
    OPAQUE_AUTH_SUCCESS = "opaque_auth_success"
    OPAQUE_AUTH_FAILURE = "opaque_auth_failure"
    
    # Secret phrase events
    SECRET_PHRASE_DETECTION = "secret_phrase_detection"
    SECRET_PHRASE_AUTHENTICATION_SUCCESS = "secret_phrase_authentication_success"
    SECRET_PHRASE_AUTHENTICATION_FAILURE = "secret_phrase_authentication_failure"
    SECRET_PHRASE_AUTHENTICATION_ERROR = "secret_phrase_authentication_error"
    
    # Entry processing events
    ENTRY_PROCESSING_ERROR = "entry_processing_error"
    ENTRY_PROCESSING_RATE_LIMIT_EXCEEDED = "entry_processing_rate_limit_exceeded"
    SECRET_ENTRY_CREATED = "secret_entry_created"
    SECRET_ENTRY_CREATION_ERROR = "secret_entry_creation_error"
    REGULAR_ENTRY_CREATED = "regular_entry_created"
    REGULAR_ENTRY_CREATION_ERROR = "regular_entry_creation_error"
    
    # Encryption events
    CONTENT_ENCRYPTION = "content_encryption"
    CONTENT_DECRYPTION = "content_decryption"
    
    # Rate limiting events
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    RATE_LIMIT_VIOLATION = "rate_limit_violation"
    
    # System events
    SECURITY_POLICY_VIOLATION = "security_policy_violation"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    DATA_ACCESS_VIOLATION = "data_access_violation"

def audit_security_event(
    event_type: str,
    user_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    level: str = "INFO"
) -> None:
    """
    Log a security event for audit purposes.
    
    Args:
        event_type: Type of security event
        user_id: Optional user ID associated with the event
        details: Optional additional details about the event
        level: Log level (INFO, WARNING, ERROR, CRITICAL)
    """
    try:
        # Create audit log entry
        audit_entry = {
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "details": details or {},
            "source": "kotori_backend"
        }
        
        # Log at appropriate level
        log_level = getattr(logging, level.upper(), logging.INFO)
        logger.log(log_level, f"SECURITY_AUDIT: {event_type}", extra=audit_entry)
        
        # Could also send to external audit system here
        # e.g., send_to_audit_system(audit_entry)
        
    except Exception as e:
        # Never let audit logging failures break the application
        logger.error(f"Failed to log security audit event: {e}")

def audit_authentication_event(
    event_type: str,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None
) -> None:
    """
    Log an authentication-related security event.
    
    Args:
        event_type: Type of authentication event
        user_id: User ID (if available)
        ip_address: Client IP address
        user_agent: Client user agent string
        success: Whether the authentication was successful
        error_message: Error message if authentication failed
    """
    details = {
        "ip_address": ip_address,
        "user_agent": user_agent,
        "success": success,
        "error_message": error_message
    }
    
    level = "INFO" if success else "WARNING"
    audit_security_event(event_type, user_id, details, level)

def audit_data_access_event(
    event_type: str,
    user_id: int,
    resource_type: str,
    resource_id: Optional[str] = None,
    action: str = "read",
    ip_address: Optional[str] = None
) -> None:
    """
    Log a data access event.
    
    Args:
        event_type: Type of data access event
        user_id: User ID accessing the data
        resource_type: Type of resource being accessed
        resource_id: Specific resource identifier
        action: Action being performed (read, write, delete)
        ip_address: Client IP address
    """
    details = {
        "resource_type": resource_type,
        "resource_id": resource_id,
        "action": action,
        "ip_address": ip_address
    }
    
    audit_security_event(event_type, user_id, details)

def audit_rate_limit_event(
    limit_type: str,
    identifier: str,
    current_count: int,
    limit: int,
    window_seconds: int,
    ip_address: Optional[str] = None
) -> None:
    """
    Log a rate limiting event.
    
    Args:
        limit_type: Type of rate limit (user, ip, global)
        identifier: Identifier for the rate limit (user_id, ip, etc.)
        current_count: Current request count in window
        limit: Maximum allowed requests in window
        window_seconds: Time window in seconds
        ip_address: Client IP address
    """
    details = {
        "limit_type": limit_type,
        "identifier": identifier,
        "current_count": current_count,
        "limit": limit,
        "window_seconds": window_seconds,
        "ip_address": ip_address
    }
    
    audit_security_event(
        SecurityEventType.RATE_LIMIT_EXCEEDED.value,
        details=details,
        level="WARNING"
    )

def get_security_context() -> Dict[str, Any]:
    """
    Get current security context information.
    
    Returns:
        Dictionary with security context data
    """
    return {
        "timestamp": time.time(),
        "timezone": "timezone.utc",
        "audit_version": "1.0"
    }

def validate_security_policy(
    operation: str,
    user_id: Optional[int] = None,
    resource_type: Optional[str] = None
) -> bool:
    """
    Validate an operation against security policies.
    
    Args:
        operation: Operation being performed
        user_id: User ID performing the operation
        resource_type: Type of resource being accessed
        
    Returns:
        True if operation is allowed, False otherwise
    """
    # Implementation would check against security policies
    # For now, just return True (allow all operations)
    # In production, this would check against:
    # - User permissions
    # - Resource access policies
    # - Rate limits
    # - Time-based restrictions
    # - etc.
    
    return True

def create_security_token(user_id: int, permissions: list) -> str:
    """
    Create a security token for a user with specific permissions.
    
    Args:
        user_id: User ID
        permissions: List of permissions
        
    Returns:
        Security token string
    """
    # This would implement proper JWT or similar token creation
    # For now, return a simple placeholder
    return f"security_token_{user_id}_{int(time.time())}"

def validate_security_token(token: str) -> Dict[str, Any]:
    """
    Validate a security token and extract claims.
    
    Args:
        token: Security token to validate
        
    Returns:
        Dictionary with token claims if valid, empty dict if invalid
    """
    # This would implement proper token validation
    # For now, return empty dict (invalid token)
    return {}

# Security configuration
SECURITY_CONFIG = {
    "audit_log_level": "INFO",
    "audit_log_retention_days": 365,
    "rate_limit_enabled": True,
    "max_login_attempts": 5,
    "login_attempt_window_minutes": 15,
    "session_timeout_minutes": 60,
    "require_2fa": False,
    "password_complexity_enabled": True
}


def create_access_token(subject: str, expires_delta: timedelta = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        subject: The user ID to encode in the token (string)
        expires_delta: Optional expiration time delta
    
    Returns:
        Encoded JWT token string
    """
    from datetime import datetime, timedelta, timezone
    from jose import jwt
    from ..core.config import settings
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),  # Ensure it's a string
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def create_refresh_token(subject: str, expires_delta: timedelta = None) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        subject: The user ID to encode in the token (string)
        expires_delta: Optional expiration time delta
    
    Returns:
        Encoded JWT refresh token string
    """
    from datetime import datetime, timedelta, timezone
    from jose import jwt
    from ..core.config import settings
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)  # Default 7 days for refresh tokens
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),  # Ensure it's a string
        "type": "refresh"
    }
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: The plain text password
        hashed_password: The hashed password to verify against
    
    Returns:
        True if password is correct, False otherwise
    """
    import warnings
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=DeprecationWarning, module="passlib.*")
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password.
    
    Args:
        password: The plain text password to hash
    
    Returns:
        The hashed password
    """
    import warnings
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=DeprecationWarning, module="passlib.*")
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.hash(password)


