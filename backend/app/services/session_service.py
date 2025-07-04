"""
Session Management Service for OPAQUE Authentication

This module provides secure session management for OPAQUE zero-knowledge authentication,
including session token generation, validation, lifecycle management, and security features.
"""

import secrets
import hashlib
import base64
from datetime import datetime, timedelta, UTC
from typing import Optional, Dict, Any, Tuple
import logging
import json

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status

from app.models.secret_tag_opaque import OpaqueSession
from app.models.user import User
from app.core.config import settings

logger = logging.getLogger(__name__)


class SessionTokenError(Exception):
    """Base exception for session token operations"""
    pass


class SessionValidationError(SessionTokenError):
    """Exception raised when session validation fails"""
    pass


class SessionSecurityError(SessionTokenError):
    """Exception raised for session security violations"""
    pass


class SessionService:
    """Service for managing OPAQUE authentication sessions"""
    
    # Session configuration
    SESSION_TOKEN_LENGTH = 64  # 64 bytes = 512 bits of entropy
    SESSION_TOKEN_ENCODING = 'base64'
    
    # Session timeouts (configurable via settings)
    DEFAULT_SESSION_IDLE_TIMEOUT = timedelta(hours=24)  # 24 hours idle
    DEFAULT_SESSION_ABSOLUTE_TIMEOUT = timedelta(days=7)  # 7 days absolute
    
    # Security limits
    MAX_CONCURRENT_SESSIONS_PER_USER = 5
    MIN_RESPONSE_TIME_MS = 50  # Timing attack protection
    
    def __init__(self):
        """Initialize session service with configuration"""
        self.idle_timeout = getattr(settings, 'SESSION_IDLE_TIMEOUT', self.DEFAULT_SESSION_IDLE_TIMEOUT)
        self.absolute_timeout = getattr(settings, 'SESSION_ABSOLUTE_TIMEOUT', self.DEFAULT_SESSION_ABSOLUTE_TIMEOUT)
    
    def generate_session_token(self) -> str:
        """
        Generate a cryptographically secure session token
        
        Returns:
            str: Base64-encoded session token with high entropy
        """
        try:
            # Generate cryptographically secure random bytes
            token_bytes = secrets.token_bytes(self.SESSION_TOKEN_LENGTH)
            
            # Encode to base64 for safe transport
            token = base64.urlsafe_b64encode(token_bytes).decode('utf-8')
            
            logger.debug(f"Generated session token with {len(token_bytes)} bytes entropy")
            return token
            
        except Exception as e:
            logger.error(f"Error generating session token: {str(e)}")
            raise SessionTokenError(f"Failed to generate session token: {str(e)}")
    
    def hash_session_token(self, token: str) -> str:
        """
        Hash session token for secure storage
        
        Args:
            token: Raw session token
            
        Returns:
            str: SHA-256 hash of the token for database storage
        """
        try:
            # Hash the token for secure storage (we store hash, not raw token)
            token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
            return token_hash
        except Exception as e:
            logger.error(f"Error hashing session token: {str(e)}")
            raise SessionTokenError(f"Failed to hash session token: {str(e)}")
    
    def create_session_fingerprint(self, user_agent: str = "", ip_address: str = "") -> str:
        """
        Create session fingerprint for additional security
        
        Args:
            user_agent: Client user agent string
            ip_address: Client IP address
            
        Returns:
            str: Session fingerprint hash
        """
        try:
            # Create fingerprint from client characteristics
            fingerprint_data = f"{user_agent}:{ip_address}:{secrets.token_hex(16)}"
            fingerprint = hashlib.sha256(fingerprint_data.encode('utf-8')).hexdigest()
            return fingerprint
        except Exception as e:
            logger.error(f"Error creating session fingerprint: {str(e)}")
            return ""
    
    def create_session(
        self,
        db: Session,
        user_id: str,
        tag_id: Optional[bytes] = None,
        user_agent: str = "",
        ip_address: str = "",
        session_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, OpaqueSession]:
        """
        Create a new session after successful OPAQUE authentication
        
        Args:
            db: Database session
            user_id: User identifier
            tag_id: Optional secret tag ID for vault access
            user_agent: Client user agent
            ip_address: Client IP address
            session_data: Additional session data
            
        Returns:
            Tuple[str, OpaqueSession]: (session_token, session_object)
        """
        try:
            # Check concurrent session limit
            self._enforce_session_limits(db, user_id)
            
            # Generate session token
            session_token = self.generate_session_token()
            session_id = self.hash_session_token(session_token)
            
            # Create session fingerprint
            fingerprint = self.create_session_fingerprint(user_agent, ip_address)
            
            # Calculate expiration times
            now = datetime.now(UTC)
            expires_at = now + self.absolute_timeout
            
            # Prepare session data
            session_metadata = {
                "fingerprint": fingerprint,
                "user_agent": user_agent[:500],  # Limit length
                "ip_address": ip_address,
                "created_at": now.isoformat(),
                **(session_data or {})
            }
            
            # Create session record
            session = OpaqueSession(
                session_id=session_id,
                user_id=user_id,
                tag_id=tag_id,
                session_state='active',
                session_data=json.dumps(session_metadata).encode('utf-8'),
                created_at=now,
                expires_at=expires_at,
                last_activity=now
            )
            
            # Save to database
            db.add(session)
            db.commit()
            db.refresh(session)
            
            logger.info(f"Created session for user {user_id}, expires at {expires_at}")
            return session_token, session
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating session: {str(e)}")
            raise SessionTokenError(f"Failed to create session: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating session: {str(e)}")
            raise SessionTokenError(f"Failed to create session: {str(e)}")
    
    def validate_session_token(
        self,
        db: Session,
        token: str,
        user_agent: str = "",
        ip_address: str = ""
    ) -> Optional[OpaqueSession]:
        """
        Validate session token and return session if valid
        
        Args:
            db: Database session
            token: Session token to validate
            user_agent: Client user agent for fingerprint validation
            ip_address: Client IP address for fingerprint validation
            
        Returns:
            Optional[OpaqueSession]: Session object if valid, None otherwise
        """
        try:
            # Hash token for lookup
            session_id = self.hash_session_token(token)
            
            # Find session in database
            session = db.query(OpaqueSession).filter(
                OpaqueSession.session_id == session_id,
                OpaqueSession.session_state == 'active'
            ).first()
            
            if not session:
                logger.debug(f"Session not found for token hash: {session_id[:16]}...")
                return None
            
            # Check expiration
            now = datetime.now(UTC)
            if session.expires_at < now:
                logger.info(f"Session expired for user {session.user_id}")
                self._invalidate_session(db, session)
                return None
            
            # Check idle timeout
            idle_cutoff = now - self.idle_timeout
            if session.last_activity < idle_cutoff:
                logger.info(f"Session idle timeout for user {session.user_id}")
                self._invalidate_session(db, session)
                return None
            
            # Validate session fingerprint (optional security check)
            if not self._validate_session_fingerprint(session, user_agent, ip_address):
                logger.warning(f"Session fingerprint mismatch for user {session.user_id}")
                # Note: In production, you might want to invalidate the session here
                # For now, we'll log the warning but allow the session
            
            # Update last activity
            session.last_activity = now
            db.commit()
            
            logger.debug(f"Validated session for user {session.user_id}")
            return session
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error validating session: {str(e)}")
            raise SessionValidationError(f"Failed to validate session: {str(e)}")
        except Exception as e:
            logger.error(f"Error validating session: {str(e)}")
            raise SessionValidationError(f"Failed to validate session: {str(e)}")
    
    def refresh_session(
        self,
        db: Session,
        session: OpaqueSession
    ) -> OpaqueSession:
        """
        Refresh session expiration without re-authentication
        
        Args:
            db: Database session
            session: Session to refresh
            
        Returns:
            OpaqueSession: Updated session object
        """
        try:
            # Extend expiration time
            now = datetime.now(UTC)
            session.expires_at = now + self.absolute_timeout
            session.last_activity = now
            
            db.commit()
            db.refresh(session)
            
            logger.info(f"Refreshed session for user {session.user_id}")
            return session
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error refreshing session: {str(e)}")
            raise SessionTokenError(f"Failed to refresh session: {str(e)}")
    
    def invalidate_session(
        self,
        db: Session,
        session_token: str
    ) -> bool:
        """
        Invalidate a session by token
        
        Args:
            db: Database session
            session_token: Token of session to invalidate
            
        Returns:
            bool: True if session was invalidated, False if not found
        """
        try:
            session_id = self.hash_session_token(session_token)
            
            session = db.query(OpaqueSession).filter(
                OpaqueSession.session_id == session_id
            ).first()
            
            if session:
                return self._invalidate_session(db, session)
            
            return False
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error invalidating session: {str(e)}")
            raise SessionTokenError(f"Failed to invalidate session: {str(e)}")
    
    def invalidate_user_sessions(
        self,
        db: Session,
        user_id: str,
        exclude_session_id: Optional[str] = None
    ) -> int:
        """
        Invalidate all sessions for a user
        
        Args:
            db: Database session
            user_id: User ID whose sessions to invalidate
            exclude_session_id: Optional session ID to exclude from invalidation
            
        Returns:
            int: Number of sessions invalidated
        """
        try:
            query = db.query(OpaqueSession).filter(
                OpaqueSession.user_id == user_id,
                OpaqueSession.session_state == 'active'
            )
            
            if exclude_session_id:
                query = query.filter(OpaqueSession.session_id != exclude_session_id)
            
            sessions = query.all()
            count = 0
            
            for session in sessions:
                if self._invalidate_session(db, session, commit=False):
                    count += 1
            
            db.commit()
            logger.info(f"Invalidated {count} sessions for user {user_id}")
            return count
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error invalidating user sessions: {str(e)}")
            raise SessionTokenError(f"Failed to invalidate user sessions: {str(e)}")
    
    def cleanup_expired_sessions(self, db: Session) -> int:
        """
        Clean up expired sessions from database
        
        Args:
            db: Database session
            
        Returns:
            int: Number of sessions cleaned up
        """
        try:
            now = datetime.now(UTC)
            
            # Find expired sessions
            expired_sessions = db.query(OpaqueSession).filter(
                OpaqueSession.expires_at < now
            ).all()
            
            count = 0
            for session in expired_sessions:
                db.delete(session)
                count += 1
            
            db.commit()
            logger.info(f"Cleaned up {count} expired sessions")
            return count
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error cleaning up sessions: {str(e)}")
            raise SessionTokenError(f"Failed to cleanup sessions: {str(e)}")
    
    def get_user_sessions(
        self,
        db: Session,
        user_id: str,
        active_only: bool = True
    ) -> list[OpaqueSession]:
        """
        Get all sessions for a user
        
        Args:
            db: Database session
            user_id: User ID
            active_only: Whether to return only active sessions
            
        Returns:
            list[OpaqueSession]: List of user sessions
        """
        try:
            query = db.query(OpaqueSession).filter(
                OpaqueSession.user_id == user_id
            )
            
            if active_only:
                query = query.filter(OpaqueSession.session_state == 'active')
            
            sessions = query.order_by(OpaqueSession.last_activity.desc()).all()
            return sessions
            
        except SQLAlchemyError as e:
            logger.error(f"Database error getting user sessions: {str(e)}")
            raise SessionTokenError(f"Failed to get user sessions: {str(e)}")
    
    def _enforce_session_limits(self, db: Session, user_id: str) -> None:
        """
        Enforce concurrent session limits per user
        
        Args:
            db: Database session
            user_id: User ID to check
        """
        try:
            active_sessions = self.get_user_sessions(db, user_id, active_only=True)
            
            if len(active_sessions) >= self.MAX_CONCURRENT_SESSIONS_PER_USER:
                # Remove oldest session to make room
                oldest_session = min(active_sessions, key=lambda s: s.last_activity)
                self._invalidate_session(db, oldest_session, commit=False)
                logger.info(f"Removed oldest session for user {user_id} due to limit")
                
        except Exception as e:
            logger.error(f"Error enforcing session limits: {str(e)}")
            # Don't fail session creation due to cleanup issues
    
    def _invalidate_session(
        self,
        db: Session,
        session: OpaqueSession,
        commit: bool = True
    ) -> bool:
        """
        Internal method to invalidate a session
        
        Args:
            db: Database session
            session: Session to invalidate
            commit: Whether to commit the transaction
            
        Returns:
            bool: True if session was invalidated
        """
        try:
            session.session_state = 'invalidated'
            if commit:
                db.commit()
            
            logger.debug(f"Invalidated session for user {session.user_id}")
            return True
            
        except Exception as e:
            if commit:
                db.rollback()
            logger.error(f"Error invalidating session: {str(e)}")
            return False
    
    def _validate_session_fingerprint(
        self,
        session: OpaqueSession,
        user_agent: str,
        ip_address: str
    ) -> bool:
        """
        Validate session fingerprint for additional security
        
        Args:
            session: Session to validate
            user_agent: Current user agent
            ip_address: Current IP address
            
        Returns:
            bool: True if fingerprint matches
        """
        try:
            if not session.session_data:
                return True  # No fingerprint to validate
            
            session_metadata = json.loads(session.session_data.decode('utf-8'))
            stored_fingerprint = session_metadata.get('fingerprint', '')
            
            if not stored_fingerprint:
                return True  # No fingerprint stored
            
            # For now, we'll do basic validation
            # In production, you might want more sophisticated fingerprinting
            stored_user_agent = session_metadata.get('user_agent', '')
            stored_ip = session_metadata.get('ip_address', '')
            
            # Allow some flexibility in user agent (browser updates, etc.)
            # and IP address (mobile networks, etc.)
            user_agent_match = stored_user_agent[:50] == user_agent[:50]
            ip_match = stored_ip == ip_address
            
            return user_agent_match or ip_match  # Either should match
            
        except Exception as e:
            logger.error(f"Error validating session fingerprint: {str(e)}")
            return True  # Don't fail validation due to fingerprint issues


# Global session service instance
session_service = SessionService() 