"""
Session service for managing hidden mode state and timeouts.
Handles secure session management for hidden entry access.
"""

import logging
import time
from typing import Dict, Optional
import threading

from ..core.config import settings

logger = logging.getLogger(__name__)


class SessionService:
    """
    Service for managing user sessions and hidden mode state.
    Maintains in-memory session state with automatic timeout.
    """

    def __init__(self):
        self._sessions: Dict[int, Dict] = {}  # user_id -> session_data
        self._session_lock = threading.Lock()
        self._timeout_minutes = settings.HIDDEN_MODE_TIMEOUT_MINUTES

    def activate_hidden_mode(self, user_id: int) -> None:
        """
        Activate hidden mode for a user session.
        Sets expiration based on configured timeout.
        """
        with self._session_lock:
            current_time = time.time()
            expiry_time = current_time + (self._timeout_minutes * 60)
            
            self._sessions[user_id] = {
                'hidden_mode_active': True,
                'activated_at': current_time,
                'expires_at': expiry_time
            }
            
            logger.info(f"Hidden mode activated for user {user_id}, expires at {expiry_time}")

    def deactivate_hidden_mode(self, user_id: int) -> None:
        """
        Manually deactivate hidden mode for a user session.
        """
        with self._session_lock:
            if user_id in self._sessions:
                del self._sessions[user_id]
                logger.info(f"Hidden mode manually deactivated for user {user_id}")

    def is_hidden_mode_active(self, user_id: int) -> bool:
        """
        Check if hidden mode is currently active for a user.
        Automatically expires sessions that have timed out.
        """
        with self._session_lock:
            if user_id not in self._sessions:
                return False
            
            session = self._sessions[user_id]
            current_time = time.time()
            
            # Check if session has expired
            if current_time >= session['expires_at']:
                del self._sessions[user_id]
                logger.info(f"Hidden mode session expired for user {user_id}")
                return False
            
            return session.get('hidden_mode_active', False)

    def extend_hidden_mode_session(self, user_id: int) -> bool:
        """
        Extend the hidden mode session timeout.
        Returns True if session was extended, False if no active session.
        """
        with self._session_lock:
            if user_id not in self._sessions:
                return False
            
            current_time = time.time()
            session = self._sessions[user_id]
            
            # Check if session hasn't expired
            if current_time >= session['expires_at']:
                del self._sessions[user_id]
                logger.info(f"Cannot extend expired session for user {user_id}")
                return False
            
            # Extend the session
            new_expiry = current_time + (self._timeout_minutes * 60)
            session['expires_at'] = new_expiry
            
            logger.debug(f"Extended hidden mode session for user {user_id} until {new_expiry}")
            return True

    def get_session_info(self, user_id: int) -> Optional[Dict]:
        """
        Get session information for debugging/monitoring.
        Returns None if no active session.
        """
        with self._session_lock:
            if user_id not in self._sessions:
                return None
            
            session = self._sessions[user_id]
            current_time = time.time()
            
            # Check if session has expired
            if current_time >= session['expires_at']:
                del self._sessions[user_id]
                return None
            
            return {
                'hidden_mode_active': session['hidden_mode_active'],
                'activated_at': session['activated_at'],
                'expires_at': session['expires_at'],
                'remaining_seconds': int(session['expires_at'] - current_time)
            }

    def cleanup_expired_sessions(self) -> int:
        """
        Manually cleanup expired sessions.
        Returns the number of sessions cleaned up.
        """
        with self._session_lock:
            current_time = time.time()
            expired_users = []
            
            for user_id, session in self._sessions.items():
                if current_time >= session['expires_at']:
                    expired_users.append(user_id)
            
            for user_id in expired_users:
                del self._sessions[user_id]
            
            if expired_users:
                logger.info(f"Cleaned up {len(expired_users)} expired sessions: {expired_users}")
            
            return len(expired_users)

    def get_active_sessions_count(self) -> int:
        """
        Get the number of currently active hidden mode sessions.
        """
        with self._session_lock:
            return len(self._sessions)


# Singleton instance
session_service = SessionService() 