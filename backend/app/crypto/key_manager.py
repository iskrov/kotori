"""
Key Lifecycle Management

Provides secure key storage with automatic expiration, session-based isolation,
and comprehensive key lifecycle management for OPAQUE cryptographic operations.
"""

import logging
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional, Set, List, Any, Callable
from datetime import datetime, timedelta, timezone

from .memory import secure_zero, constant_time_compare
from .secure_memory import locked_memory, register_cleanup_handler
from .errors import MemoryError

logger = logging.getLogger(__name__)


class KeyType(Enum):
    """Types of cryptographic keys."""
    VERIFICATION = "verification"      # Kv - Server-side verification key
    ENCRYPTION = "encryption"         # Ke - Client-side encryption key
    OPAQUE_STATE = "opaque_state"     # OPAQUE protocol state
    SESSION = "session"               # Session-specific keys
    TEMPORARY = "temporary"           # Short-lived temporary keys


class KeyStatus(Enum):
    """Status of stored keys."""
    ACTIVE = "active"                 # Key is active and usable
    EXPIRED = "expired"               # Key has expired
    REVOKED = "revoked"               # Key has been revoked
    PENDING = "pending"               # Key is pending activation


@dataclass
class KeyMetadata:
    """Metadata for stored keys."""
    key_id: str
    key_type: KeyType
    status: KeyStatus
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_accessed: Optional[datetime] = None
    access_count: int = 0
    session_id: Optional[str] = None
    tags: Set[str] = field(default_factory=set)


class SecureKeyStore:
    """
    Secure storage for cryptographic keys with automatic expiration.
    
    Keys are stored in locked memory and automatically cleaned up
    when they expire or when the store is destroyed.
    """
    
    def __init__(self, default_ttl: int = 3600):
        """
        Initialize the key store.
        
        Args:
            default_ttl: Default time-to-live for keys in seconds
        """
        self.default_ttl = default_ttl
        self._keys: Dict[str, bytes] = {}
        self._metadata: Dict[str, KeyMetadata] = {}
        self._lock = threading.RLock()
        self._cleanup_thread: Optional[threading.Thread] = None
        self._shutdown_event = threading.Event()
        
        # Start cleanup thread
        self._start_cleanup_thread()
        
        # Register emergency cleanup
        register_cleanup_handler(self.emergency_cleanup)
    
    def store_key(
        self,
        key_data: bytes,
        key_type: KeyType,
        ttl: Optional[int] = None,
        session_id: Optional[str] = None,
        tags: Optional[Set[str]] = None
    ) -> str:
        """
        Store a key securely.
        
        Args:
            key_data: The key material to store
            key_type: Type of the key
            ttl: Time-to-live in seconds (uses default if None)
            session_id: Associated session ID
            tags: Optional tags for the key
            
        Returns:
            Unique key ID for retrieval
            
        Raises:
            MemoryError: If key storage fails
        """
        if not key_data:
            raise MemoryError("Key data cannot be empty")
        
        key_id = str(uuid.uuid4())
        ttl = ttl or self.default_ttl
        tags = tags or set()
        
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl) if ttl > 0 else None
        
        metadata = KeyMetadata(
            key_id=key_id,
            key_type=key_type,
            status=KeyStatus.ACTIVE,
            created_at=now,
            expires_at=expires_at,
            session_id=session_id,
            tags=tags
        )
        
        with self._lock:
            try:
                # Store key in locked memory
                with locked_memory(len(key_data)) as secure_buffer:
                    secure_buffer[:] = key_data
                    
                    # Copy to our storage (this will be in locked memory pool)
                    key_copy = bytes(secure_buffer)
                    self._keys[key_id] = key_copy
                    self._metadata[key_id] = metadata
                
                logger.debug(f"Stored key {key_id} of type {key_type.value}")
                return key_id
                
            except Exception as e:
                raise MemoryError(f"Failed to store key: {e}")
    
    def retrieve_key(self, key_id: str) -> Optional[bytes]:
        """
        Retrieve a key by ID.
        
        Args:
            key_id: The key ID to retrieve
            
        Returns:
            Key data if found and valid, None otherwise
        """
        with self._lock:
            if key_id not in self._keys:
                return None
            
            metadata = self._metadata[key_id]
            
            # Check if key has expired
            if self._is_expired(metadata):
                self._remove_key(key_id)
                return None
            
            # Check if key is active
            if metadata.status != KeyStatus.ACTIVE:
                return None
            
            # Update access information
            metadata.last_accessed = datetime.now(timezone.utc)
            metadata.access_count += 1
            
            # Return copy of key data
            key_data = self._keys[key_id]
            return bytes(key_data)
    
    def revoke_key(self, key_id: str) -> bool:
        """
        Revoke a key, making it unusable.
        
        Args:
            key_id: The key ID to revoke
            
        Returns:
            True if key was revoked, False if not found
        """
        with self._lock:
            if key_id not in self._metadata:
                return False
            
            self._metadata[key_id].status = KeyStatus.REVOKED
            logger.debug(f"Revoked key {key_id}")
            return True
    
    def remove_key(self, key_id: str) -> bool:
        """
        Remove a key from storage.
        
        Args:
            key_id: The key ID to remove
            
        Returns:
            True if key was removed, False if not found
        """
        with self._lock:
            return self._remove_key(key_id)
    
    def list_keys(
        self,
        key_type: Optional[KeyType] = None,
        session_id: Optional[str] = None,
        tags: Optional[Set[str]] = None
    ) -> List[KeyMetadata]:
        """
        List keys matching the specified criteria.
        
        Args:
            key_type: Filter by key type
            session_id: Filter by session ID
            tags: Filter by tags (all must match)
            
        Returns:
            List of matching key metadata
        """
        with self._lock:
            results = []
            
            for metadata in self._metadata.values():
                # Skip expired keys
                if self._is_expired(metadata):
                    continue
                
                # Apply filters
                if key_type and metadata.key_type != key_type:
                    continue
                
                if session_id and metadata.session_id != session_id:
                    continue
                
                if tags and not tags.issubset(metadata.tags):
                    continue
                
                results.append(metadata)
            
            return results
    
    def cleanup_expired(self) -> int:
        """
        Clean up expired keys.
        
        Returns:
            Number of keys removed
        """
        with self._lock:
            expired_keys = []
            
            for key_id, metadata in self._metadata.items():
                if self._is_expired(metadata):
                    expired_keys.append(key_id)
            
            for key_id in expired_keys:
                self._remove_key(key_id)
            
            if expired_keys:
                logger.debug(f"Cleaned up {len(expired_keys)} expired keys")
            
            return len(expired_keys)
    
    def cleanup_session(self, session_id: str) -> int:
        """
        Clean up all keys for a session.
        
        Args:
            session_id: Session ID to clean up
            
        Returns:
            Number of keys removed
        """
        with self._lock:
            session_keys = []
            
            for key_id, metadata in self._metadata.items():
                if metadata.session_id == session_id:
                    session_keys.append(key_id)
            
            for key_id in session_keys:
                self._remove_key(key_id)
            
            if session_keys:
                logger.debug(f"Cleaned up {len(session_keys)} keys for session {session_id}")
            
            return len(session_keys)
    
    def emergency_cleanup(self):
        """Emergency cleanup of all keys."""
        try:
            logger.info("Performing emergency key store cleanup")
        except (ValueError, OSError):
            # Logging system may be shut down, continue silently
            pass
        
        with self._lock:
            # Stop cleanup thread
            if self._cleanup_thread and self._cleanup_thread.is_alive():
                self._shutdown_event.set()
                self._cleanup_thread.join(timeout=1.0)
            
            # Securely clear all keys
            for key_id in list(self._keys.keys()):
                self._remove_key(key_id)
    
    def _is_expired(self, metadata: KeyMetadata) -> bool:
        """Check if a key has expired."""
        if metadata.expires_at is None:
            return False
        return datetime.now(timezone.utc) > metadata.expires_at
    
    def _remove_key(self, key_id: str) -> bool:
        """Internal method to remove a key."""
        if key_id not in self._keys:
            return False
        
        # Securely clear key data
        key_data = self._keys[key_id]
        if isinstance(key_data, (bytearray, memoryview)):
            secure_zero(key_data)
        
        # Remove from storage
        del self._keys[key_id]
        del self._metadata[key_id]
        
        return True
    
    def _start_cleanup_thread(self):
        """Start the background cleanup thread."""
        def cleanup_worker():
            while not self._shutdown_event.wait(60):  # Check every minute
                try:
                    self.cleanup_expired()
                except Exception as e:
                    logger.error(f"Error in cleanup thread: {e}")
        
        self._cleanup_thread = threading.Thread(
            target=cleanup_worker,
            name="KeyStoreCleanup",
            daemon=True
        )
        self._cleanup_thread.start()


class SessionKeyManager:
    """
    Session-based key management with isolation between sessions.
    
    Provides session-scoped key storage and automatic cleanup
    when sessions end.
    """
    
    def __init__(self, default_session_ttl: int = 7200):
        """
        Initialize the session key manager.
        
        Args:
            default_session_ttl: Default session TTL in seconds
        """
        self.default_session_ttl = default_session_ttl
        self._key_store = SecureKeyStore()
        self._sessions: Dict[str, datetime] = {}
        self._lock = threading.RLock()
    
    def create_session(self, session_ttl: Optional[int] = None) -> str:
        """
        Create a new session.
        
        Args:
            session_ttl: Session TTL in seconds
            
        Returns:
            Session ID
        """
        session_id = str(uuid.uuid4())
        ttl = session_ttl or self.default_session_ttl
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        
        with self._lock:
            self._sessions[session_id] = expires_at
        
        logger.debug(f"Created session {session_id} with TTL {ttl}s")
        return session_id
    
    def store_session_key(
        self,
        session_id: str,
        key_data: bytes,
        key_type: KeyType,
        ttl: Optional[int] = None,
        tags: Optional[Set[str]] = None
    ) -> str:
        """
        Store a key in a session.
        
        Args:
            session_id: Session ID
            key_data: Key material
            key_type: Type of key
            ttl: Key TTL (defaults to session TTL)
            tags: Optional tags
            
        Returns:
            Key ID
            
        Raises:
            MemoryError: If session is invalid or key storage fails
        """
        with self._lock:
            if not self._is_session_valid(session_id):
                raise MemoryError(f"Invalid or expired session: {session_id}")
            
            # Use session TTL if no specific TTL provided
            if ttl is None:
                session_expires = self._sessions[session_id]
                ttl = int((session_expires - datetime.now(timezone.utc)).total_seconds())
                ttl = max(ttl, 0)  # Ensure non-negative
            
            return self._key_store.store_key(
                key_data=key_data,
                key_type=key_type,
                ttl=ttl,
                session_id=session_id,
                tags=tags
            )
    
    def retrieve_session_key(self, session_id: str, key_id: str) -> Optional[bytes]:
        """
        Retrieve a key from a session.
        
        Args:
            session_id: Session ID
            key_id: Key ID
            
        Returns:
            Key data if found and valid
        """
        with self._lock:
            if not self._is_session_valid(session_id):
                return None
            
            key_data = self._key_store.retrieve_key(key_id)
            if key_data is None:
                return None
            
            # Verify key belongs to this session
            metadata = self._key_store._metadata.get(key_id)
            if metadata and metadata.session_id == session_id:
                return key_data
            
            return None
    
    def end_session(self, session_id: str) -> int:
        """
        End a session and clean up all associated keys.
        
        Args:
            session_id: Session ID to end
            
        Returns:
            Number of keys cleaned up
        """
        with self._lock:
            if session_id not in self._sessions:
                return 0
            
            # Clean up all session keys
            keys_removed = self._key_store.cleanup_session(session_id)
            
            # Remove session
            del self._sessions[session_id]
            
            logger.debug(f"Ended session {session_id}, removed {keys_removed} keys")
            return keys_removed
    
    def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions.
        
        Returns:
            Number of sessions cleaned up
        """
        with self._lock:
            now = datetime.now(timezone.utc)
            expired_sessions = []
            
            for session_id, expires_at in self._sessions.items():
                if now > expires_at:
                    expired_sessions.append(session_id)
            
            total_keys_removed = 0
            for session_id in expired_sessions:
                total_keys_removed += self.end_session(session_id)
            
            if expired_sessions:
                logger.debug(f"Cleaned up {len(expired_sessions)} expired sessions")
            
            return len(expired_sessions)
    
    def list_session_keys(self, session_id: str) -> List[KeyMetadata]:
        """
        List all keys in a session.
        
        Args:
            session_id: Session ID
            
        Returns:
            List of key metadata for the session
        """
        with self._lock:
            if not self._is_session_valid(session_id):
                return []
            
            return self._key_store.list_keys(session_id=session_id)
    
    def _is_session_valid(self, session_id: str) -> bool:
        """Check if a session is valid and not expired."""
        if session_id not in self._sessions:
            return False
        
        expires_at = self._sessions[session_id]
        return datetime.now(timezone.utc) <= expires_at


# Global key store and session manager instances
_global_key_store = SecureKeyStore()
_global_session_manager = SessionKeyManager()


@contextmanager
def secure_key_context(
    key_data: bytes,
    key_type: KeyType = KeyType.TEMPORARY,
    ttl: int = 300  # 5 minutes default
):
    """
    Context manager for temporary secure key storage.
    
    Args:
        key_data: Key material to store
        key_type: Type of key
        ttl: Time-to-live in seconds
        
    Yields:
        Key ID for the stored key
        
    Example:
        with secure_key_context(encryption_key) as key_id:
            # Use key_id to retrieve the key
            key = get_key(key_id)
            # Key is automatically cleaned up when exiting
    """
    key_id = _global_key_store.store_key(key_data, key_type, ttl)
    try:
        yield key_id
    finally:
        _global_key_store.remove_key(key_id)


def store_key(
    key_data: bytes,
    key_type: KeyType,
    ttl: Optional[int] = None,
    tags: Optional[Set[str]] = None
) -> str:
    """
    Store a key in the global key store.
    
    Args:
        key_data: Key material
        key_type: Type of key
        ttl: Time-to-live in seconds
        tags: Optional tags
        
    Returns:
        Key ID
    """
    return _global_key_store.store_key(key_data, key_type, ttl, tags=tags)


def get_key(key_id: str) -> Optional[bytes]:
    """
    Retrieve a key from the global key store.
    
    Args:
        key_id: Key ID
        
    Returns:
        Key data if found and valid
    """
    return _global_key_store.retrieve_key(key_id)


def revoke_key(key_id: str) -> bool:
    """
    Revoke a key in the global key store.
    
    Args:
        key_id: Key ID to revoke
        
    Returns:
        True if successful
    """
    return _global_key_store.revoke_key(key_id)


def create_session(session_ttl: Optional[int] = None) -> str:
    """
    Create a new session.
    
    Args:
        session_ttl: Session TTL in seconds
        
    Returns:
        Session ID
    """
    return _global_session_manager.create_session(session_ttl)


def store_session_key(
    session_id: str,
    key_data: bytes,
    key_type: KeyType,
    ttl: Optional[int] = None,
    tags: Optional[Set[str]] = None
) -> str:
    """
    Store a key in a session.
    
    Args:
        session_id: Session ID
        key_data: Key material
        key_type: Type of key
        ttl: Key TTL
        tags: Optional tags
        
    Returns:
        Key ID
    """
    return _global_session_manager.store_session_key(
        session_id, key_data, key_type, ttl, tags
    )


def get_session_key(session_id: str, key_id: str) -> Optional[bytes]:
    """
    Retrieve a key from a session.
    
    Args:
        session_id: Session ID
        key_id: Key ID
        
    Returns:
        Key data if found and valid
    """
    return _global_session_manager.retrieve_session_key(session_id, key_id)


def end_session(session_id: str) -> int:
    """
    End a session and clean up keys.
    
    Args:
        session_id: Session ID
        
    Returns:
        Number of keys cleaned up
    """
    return _global_session_manager.end_session(session_id) 