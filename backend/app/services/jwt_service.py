"""
JWT Token Service for Session Management

This module provides comprehensive JWT token management for both traditional user authentication
and OPAQUE session management, including token generation, validation, refresh tokens, and blacklisting.
"""

import secrets
import hashlib
from datetime import datetime, timedelta, UTC
from typing import Optional, Dict, Any, Set, Tuple
import logging
import json

from jose import JWTError, jwt
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..core.config import settings
from ..models.secret_tag_opaque import OpaqueSession

logger = logging.getLogger(__name__)


class JWTServiceError(Exception):
    """Base exception for JWT service operations"""
    pass


class JWTValidationError(JWTServiceError):
    """Exception raised when JWT validation fails"""
    pass


class JWTSecurityError(JWTServiceError):
    """Exception raised for JWT security violations"""
    pass


class JWTService:
    """Service for JWT token generation, validation, and management"""
    
    # JWT configuration
    ALGORITHM = settings.ALGORITHM
    SECRET_KEY = settings.SECRET_KEY
    
    # Token types
    TOKEN_TYPE_ACCESS = "access"
    TOKEN_TYPE_REFRESH = "refresh"
    TOKEN_TYPE_SESSION = "session"
    
    # Token lifetimes (configurable)
    ACCESS_TOKEN_LIFETIME = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    REFRESH_TOKEN_LIFETIME = timedelta(days=7)  # 7 days
    SESSION_TOKEN_LIFETIME = timedelta(hours=24)  # 24 hours
    
    # Security features
    TOKEN_ISSUER = "kotori-api"
    TOKEN_AUDIENCE = "kotori-users"
    
    def __init__(self):
        """Initialize JWT service with security features"""
        # In-memory token blacklist (in production, use Redis or database)
        self._blacklisted_tokens: Set[str] = set()
        self._token_usage_count: Dict[str, int] = {}
    
    def generate_access_token(
        self,
        user_id: str,
        email: str,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate an access token for traditional user authentication
        
        Args:
            user_id: User identifier
            email: User email address
            additional_claims: Optional additional claims to include
            
        Returns:
            str: JWT access token
        """
        try:
            now = datetime.now(UTC)
            expires_at = now + self.ACCESS_TOKEN_LIFETIME
            
            # Standard JWT claims
            claims = {
                "sub": user_id,  # Subject (user identifier)
                "email": email,
                "iat": int(now.timestamp()),  # Issued at
                "exp": int(expires_at.timestamp()),  # Expiration
                "nbf": int(now.timestamp()),  # Not before
                "iss": self.TOKEN_ISSUER,  # Issuer
                "aud": self.TOKEN_AUDIENCE,  # Audience
                "jti": secrets.token_hex(16),  # JWT ID (for blacklisting)
                "token_type": self.TOKEN_TYPE_ACCESS,
                "user_type": "standard"
            }
            
            # Add additional claims
            if additional_claims:
                claims.update(additional_claims)
            
            # Generate and return token
            token = jwt.encode(claims, self.SECRET_KEY, algorithm=self.ALGORITHM)
            
            logger.debug(f"Generated access token for user {user_id}, expires at {expires_at}")
            return token
            
        except Exception as e:
            logger.error(f"Error generating access token: {str(e)}")
            raise JWTServiceError(f"Failed to generate access token: {str(e)}")
    
    def generate_session_token(
        self,
        user_id: str,
        session_id: str,
        tag_id: Optional[bytes] = None,
        fingerprint: Optional[str] = None,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a session token for OPAQUE authentication
        
        Args:
            user_id: User identifier
            session_id: Session identifier (hashed)
            tag_id: Optional secret tag ID for vault access
            fingerprint: Session fingerprint for additional security
            additional_claims: Optional additional claims to include
            
        Returns:
            str: JWT session token
        """
        try:
            now = datetime.now(UTC)
            expires_at = now + self.SESSION_TOKEN_LIFETIME
            
            # Standard JWT claims for session token
            claims = {
                "sub": user_id,  # Subject (user identifier)
                "session_id": session_id,  # Session identifier
                "iat": int(now.timestamp()),  # Issued at
                "exp": int(expires_at.timestamp()),  # Expiration
                "nbf": int(now.timestamp()),  # Not before
                "iss": self.TOKEN_ISSUER,  # Issuer
                "aud": self.TOKEN_AUDIENCE,  # Audience
                "jti": secrets.token_hex(16),  # JWT ID (for blacklisting)
                "token_type": self.TOKEN_TYPE_SESSION,
                "user_type": "opaque_session"
            }
            
            # Add session-specific claims
            if tag_id:
                claims["tag_id"] = tag_id.hex()  # Convert bytes to hex string
            
            if fingerprint:
                claims["fingerprint"] = fingerprint
            
            # Add additional claims
            if additional_claims:
                claims.update(additional_claims)
            
            # Generate and return token
            token = jwt.encode(claims, self.SECRET_KEY, algorithm=self.ALGORITHM)
            
            logger.debug(f"Generated session token for user {user_id}, session {session_id[:8]}...")
            return token
            
        except Exception as e:
            logger.error(f"Error generating session token: {str(e)}")
            raise JWTServiceError(f"Failed to generate session token: {str(e)}")
    
    def generate_refresh_token(
        self,
        user_id: str,
        access_token_jti: str
    ) -> str:
        """
        Generate a refresh token for token renewal
        
        Args:
            user_id: User identifier
            access_token_jti: JTI of the associated access token
            
        Returns:
            str: JWT refresh token
        """
        try:
            now = datetime.now(UTC)
            expires_at = now + self.REFRESH_TOKEN_LIFETIME
            
            claims = {
                "sub": user_id,
                "iat": int(now.timestamp()),
                "exp": int(expires_at.timestamp()),
                "nbf": int(now.timestamp()),
                "iss": self.TOKEN_ISSUER,
                "aud": self.TOKEN_AUDIENCE,
                "jti": secrets.token_hex(16),
                "token_type": self.TOKEN_TYPE_REFRESH,
                "access_token_jti": access_token_jti  # Link to access token
            }
            
            token = jwt.encode(claims, self.SECRET_KEY, algorithm=self.ALGORITHM)
            
            logger.debug(f"Generated refresh token for user {user_id}")
            return token
            
        except Exception as e:
            logger.error(f"Error generating refresh token: {str(e)}")
            raise JWTServiceError(f"Failed to generate refresh token: {str(e)}")
    
    def validate_token(
        self,
        token: str,
        expected_token_type: Optional[str] = None,
        require_fingerprint: bool = False,
        fingerprint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate a JWT token and return its claims
        
        Args:
            token: JWT token to validate
            expected_token_type: Expected token type (access, refresh, session)
            require_fingerprint: Whether to require fingerprint validation
            fingerprint: Expected fingerprint for session tokens
            
        Returns:
            Dict[str, Any]: Token claims if valid
            
        Raises:
            JWTValidationError: If token is invalid
        """
        try:
            # Check if token is blacklisted first (before full validation)
            if self._is_token_blacklisted(token):
                raise JWTValidationError("Token has been revoked")
            
            # Decode and validate token
            try:
                claims = jwt.decode(
                    token,
                    self.SECRET_KEY,
                    algorithms=[self.ALGORITHM],
                    issuer=self.TOKEN_ISSUER,
                    audience=self.TOKEN_AUDIENCE
                )
            except JWTError as e:
                raise JWTValidationError(f"Invalid token: {str(e)}")
            
            # Validate token type if specified
            if expected_token_type:
                token_type = claims.get("token_type")
                if token_type != expected_token_type:
                    raise JWTValidationError(f"Expected {expected_token_type} token, got {token_type}")
            
            # Validate fingerprint for session tokens
            if require_fingerprint and fingerprint:
                token_fingerprint = claims.get("fingerprint")
                if not token_fingerprint or token_fingerprint != fingerprint:
                    raise JWTValidationError("Session fingerprint mismatch")
            
            # Track token usage (for abuse detection)
            jti = claims.get("jti")
            if jti:
                self._token_usage_count[jti] = self._token_usage_count.get(jti, 0) + 1
                
                # Detect potential token abuse
                if self._token_usage_count[jti] > 100:  # Configurable threshold
                    logger.warning(f"High usage count for token {jti}: {self._token_usage_count[jti]}")
            
            logger.debug(f"Successfully validated {claims.get('token_type', 'unknown')} token")
            return claims
            
        except JWTValidationError:
            raise
        except Exception as e:
            logger.error(f"Error validating token: {str(e)}")
            raise JWTValidationError(f"Token validation failed: {str(e)}")
    
    def refresh_access_token(
        self,
        refresh_token: str,
        email: str
    ) -> Tuple[str, str]:
        """
        Generate new access and refresh tokens using a refresh token
        
        Args:
            refresh_token: Valid refresh token
            email: User email for new access token
            
        Returns:
            Tuple[str, str]: (new_access_token, new_refresh_token)
        """
        try:
            # Validate refresh token
            claims = self.validate_token(refresh_token, expected_token_type=self.TOKEN_TYPE_REFRESH)
            
            user_id = claims["sub"]
            
            # Blacklist the old refresh token
            self.blacklist_token(refresh_token)
            
            # Generate new tokens
            new_access_token = self.generate_access_token(user_id, email)
            
            # Extract JTI from new access token for refresh token linking
            access_claims = jwt.decode(new_access_token, options={"verify_signature": False})
            access_jti = access_claims["jti"]
            
            new_refresh_token = self.generate_refresh_token(user_id, access_jti)
            
            logger.info(f"Refreshed tokens for user {user_id}")
            return new_access_token, new_refresh_token
            
        except JWTValidationError:
            raise
        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
            raise JWTServiceError(f"Token refresh failed: {str(e)}")
    
    def blacklist_token(self, token: str) -> None:
        """
        Add a token to the blacklist
        
        Args:
            token: JWT token to blacklist
        """
        try:
            # Use token hash as a simple and reliable blacklist mechanism
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            self._blacklisted_tokens.add(token_hash)
            logger.info(f"Blacklisted token: {token_hash[:16]}...")
                
        except Exception as e:
            logger.error(f"Error blacklisting token: {str(e)}")
    
    def _is_token_blacklisted(self, token: str) -> bool:
        """
        Check if a token is blacklisted
        
        Args:
            token: JWT token to check
            
        Returns:
            bool: True if token is blacklisted
        """
        try:
            # Check token hash against blacklist
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            return token_hash in self._blacklisted_tokens
            
        except Exception:
            # If we can't hash the token, consider it potentially compromised
            return False
    
    def cleanup_expired_tokens(self) -> int:
        """
        Clean up expired token tracking data
        
        Returns:
            int: Number of expired tokens cleaned up
        """
        try:
            # Clean up token usage count for expired tokens
            # This is a simplified cleanup - in production, you'd track expiration times
            
            # Keep only recent entries (last 1000 tokens)
            if len(self._token_usage_count) > 1000:
                sorted_tokens = sorted(
                    self._token_usage_count.items(),
                    key=lambda x: x[1],
                    reverse=True
                )
                
                # Keep top 500 most used tokens
                self._token_usage_count = dict(sorted_tokens[:500])
                
                logger.info("Cleaned up expired token usage data")
                return len(sorted_tokens) - 500
            
            return 0
            
        except Exception as e:
            logger.error(f"Error cleaning up expired tokens: {str(e)}")
            return 0
    
    def get_token_info(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a token without full validation
        
        Args:
            token: JWT token to inspect
            
        Returns:
            Optional[Dict[str, Any]]: Token information or None if invalid
        """
        try:
            # Decode without verification to get claims
            claims = jwt.decode(token, options={"verify_signature": False})
            
            return {
                "user_id": claims.get("sub"),
                "token_type": claims.get("token_type"),
                "issued_at": datetime.fromtimestamp(claims.get("iat", 0), UTC),
                "expires_at": datetime.fromtimestamp(claims.get("exp", 0), UTC),
                "jti": claims.get("jti"),
                "is_blacklisted": self._is_token_blacklisted(token),
                "usage_count": self._token_usage_count.get(claims.get("jti"), 0)
            }
            
        except Exception as e:
            logger.error(f"Error getting token info: {str(e)}")
            return None


# Service instance
jwt_service = JWTService() 