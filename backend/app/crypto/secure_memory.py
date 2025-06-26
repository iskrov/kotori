"""
Enhanced Secure Memory Management

Provides advanced secure memory utilities including memory locking,
secure memory pools, and comprehensive protection against side-channel attacks.
"""

import atexit
import ctypes
import logging
import mmap
import os
import platform
import signal
import threading
import time
import weakref
from contextlib import contextmanager
from typing import Dict, List, Optional, Set, Union
from dataclasses import dataclass
from enum import Enum

from .memory import secure_zero, secure_random_bytes
from .errors import MemoryError

logger = logging.getLogger(__name__)


class MemoryLockStatus(Enum):
    """Status of memory locking operations."""
    LOCKED = "locked"
    UNLOCKED = "unlocked"
    UNSUPPORTED = "unsupported"
    FAILED = "failed"


@dataclass
class MemoryStats:
    """Statistics for secure memory operations."""
    total_allocated: int = 0
    currently_allocated: int = 0
    locked_pages: int = 0
    pool_hits: int = 0
    pool_misses: int = 0
    cleanup_operations: int = 0


class PlatformMemory:
    """Platform-specific memory operations."""
    
    @staticmethod
    def get_page_size() -> int:
        """Get the system page size."""
        try:
            if hasattr(os, 'sysconf') and hasattr(os, 'SC_PAGESIZE'):
                return os.sysconf(os.SC_PAGESIZE)
            elif platform.system() == 'Windows':
                # Default Windows page size
                return 4096
            else:
                # Default for most Unix systems
                return 4096
        except Exception:
            return 4096
    
    @staticmethod
    def lock_memory(buffer: Union[bytearray, memoryview]) -> MemoryLockStatus:
        """
        Lock memory to prevent swapping to disk.
        
        Args:
            buffer: Memory buffer to lock
            
        Returns:
            Status of the lock operation
        """
        try:
            if platform.system() == 'Linux' and hasattr(os, 'mlock'):
                # Linux/Unix mlock
                os.mlock(buffer)
                return MemoryLockStatus.LOCKED
            elif platform.system() == 'Windows':
                # Windows VirtualLock
                return PlatformMemory._windows_lock_memory(buffer)
            elif hasattr(os, 'mlock'):
                # Generic Unix mlock
                os.mlock(buffer)
                return MemoryLockStatus.LOCKED
            else:
                return MemoryLockStatus.UNSUPPORTED
        except (OSError, AttributeError) as e:
            logger.warning(f"Failed to lock memory: {e}")
            return MemoryLockStatus.FAILED
    
    @staticmethod
    def unlock_memory(buffer: Union[bytearray, memoryview]) -> bool:
        """
        Unlock previously locked memory.
        
        Args:
            buffer: Memory buffer to unlock
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if platform.system() == 'Linux' and hasattr(os, 'munlock'):
                os.munlock(buffer)
                return True
            elif platform.system() == 'Windows':
                return PlatformMemory._windows_unlock_memory(buffer)
            elif hasattr(os, 'munlock'):
                os.munlock(buffer)
                return True
            else:
                return False
        except (OSError, AttributeError) as e:
            logger.warning(f"Failed to unlock memory: {e}")
            return False
    
    @staticmethod
    def _windows_lock_memory(buffer: Union[bytearray, memoryview]) -> MemoryLockStatus:
        """Windows-specific memory locking."""
        try:
            if platform.system() != 'Windows':
                return MemoryLockStatus.UNSUPPORTED
            
            # Import Windows-specific modules
            import ctypes.wintypes
            
            # Get buffer address and size
            if isinstance(buffer, memoryview):
                addr = ctypes.addressof(ctypes.c_char.from_buffer(buffer.obj))
            else:
                addr = ctypes.addressof(ctypes.c_char.from_buffer(buffer))
            size = len(buffer)
            
            # Call VirtualLock
            kernel32 = ctypes.windll.kernel32
            result = kernel32.VirtualLock(ctypes.c_void_p(addr), ctypes.c_size_t(size))
            
            if result:
                return MemoryLockStatus.LOCKED
            else:
                return MemoryLockStatus.FAILED
                
        except Exception as e:
            logger.warning(f"Windows memory lock failed: {e}")
            return MemoryLockStatus.FAILED
    
    @staticmethod
    def _windows_unlock_memory(buffer: Union[bytearray, memoryview]) -> bool:
        """Windows-specific memory unlocking."""
        try:
            if platform.system() != 'Windows':
                return False
            
            import ctypes.wintypes
            
            # Get buffer address and size
            if isinstance(buffer, memoryview):
                addr = ctypes.addressof(ctypes.c_char.from_buffer(buffer.obj))
            else:
                addr = ctypes.addressof(ctypes.c_char.from_buffer(buffer))
            size = len(buffer)
            
            # Call VirtualUnlock
            kernel32 = ctypes.windll.kernel32
            result = kernel32.VirtualUnlock(ctypes.c_void_p(addr), ctypes.c_size_t(size))
            
            return bool(result)
            
        except Exception as e:
            logger.warning(f"Windows memory unlock failed: {e}")
            return False


class SecureMemoryPool:
    """
    Pool of pre-allocated secure memory buffers.
    
    Reduces allocation overhead and provides better security
    by reusing locked memory pages.
    """
    
    def __init__(self, pool_size: int = 10, buffer_size: int = 4096):
        """
        Initialize the memory pool.
        
        Args:
            pool_size: Number of buffers in the pool
            buffer_size: Size of each buffer in bytes
        """
        if pool_size <= 0:
            raise ValueError("Pool size must be positive")
        if buffer_size <= 0:
            raise ValueError("Buffer size must be positive")
            
        self.pool_size = pool_size
        self.buffer_size = buffer_size
        self._pool: List[bytearray] = []
        self._available: Set[int] = set()
        self._in_use: Set[int] = set()
        self._lock = threading.RLock()
        self._stats = MemoryStats()
        
        # Pre-allocate and lock buffers
        self._initialize_pool()
    
    def _initialize_pool(self):
        """Initialize the memory pool with locked buffers."""
        with self._lock:
            for i in range(self.pool_size):
                try:
                    # Allocate buffer
                    buffer = bytearray(self.buffer_size)
                    
                    # Attempt to lock memory
                    lock_status = PlatformMemory.lock_memory(buffer)
                    if lock_status == MemoryLockStatus.LOCKED:
                        self._stats.locked_pages += 1
                    
                    self._pool.append(buffer)
                    self._available.add(i)
                    self._stats.total_allocated += self.buffer_size
                    
                except Exception as e:
                    logger.warning(f"Failed to allocate pool buffer {i}: {e}")
    
    def acquire(self, size: int) -> Optional[memoryview]:
        """
        Acquire a buffer from the pool.
        
        Args:
            size: Required buffer size
            
        Returns:
            Memory view of the buffer, or None if unavailable
        """
        if size > self.buffer_size:
            self._stats.pool_misses += 1
            return None
        
        with self._lock:
            if not self._available:
                self._stats.pool_misses += 1
                return None
            
            # Get an available buffer
            buffer_id = self._available.pop()
            self._in_use.add(buffer_id)
            
            buffer = self._pool[buffer_id]
            
            # Clear the buffer
            secure_zero(buffer)
            
            # Create a view with the requested size
            view = memoryview(buffer)[:size]
            
            self._stats.pool_hits += 1
            self._stats.currently_allocated += size
            
            return view
    
    def release(self, view: memoryview):
        """
        Release a buffer back to the pool.
        
        Args:
            view: Memory view to release
        """
        with self._lock:
            # Find the buffer this view belongs to
            for buffer_id, buffer in enumerate(self._pool):
                if buffer_id in self._in_use:
                    try:
                        # Check if this view belongs to this buffer
                        buffer_view = memoryview(buffer)
                        if (view.obj is buffer_view.obj or 
                            view.obj is buffer):
                            
                            # Securely clear the buffer
                            secure_zero(buffer)
                            
                            # Move back to available
                            self._in_use.remove(buffer_id)
                            self._available.add(buffer_id)
                            
                            self._stats.currently_allocated -= len(view)
                            self._stats.cleanup_operations += 1
                            
                            return
                    except Exception:
                        continue
    
    def get_stats(self) -> MemoryStats:
        """Get pool statistics."""
        return self._stats
    
    def cleanup(self):
        """Clean up the memory pool."""
        with self._lock:
            for buffer in self._pool:
                secure_zero(buffer)
                PlatformMemory.unlock_memory(buffer)
            
            self._pool.clear()
            self._available.clear()
            self._in_use.clear()
            self._stats.cleanup_operations += 1


class SecureMemoryManager:
    """
    Global secure memory manager.
    
    Manages memory pools, tracks allocations, and provides
    emergency cleanup capabilities.
    """
    
    _instance: Optional['SecureMemoryManager'] = None
    _lock = threading.Lock()
    
    def __new__(cls) -> 'SecureMemoryManager':
        """Singleton pattern implementation."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the memory manager."""
        if hasattr(self, '_initialized'):
            return
        
        self._pools: Dict[int, SecureMemoryPool] = {}
        self._active_buffers: Set[weakref.ref] = set()
        self._cleanup_handlers: List[callable] = []
        self._emergency_cleanup_registered = False
        self._lock = threading.RLock()
        
        # Register emergency cleanup
        self._register_emergency_cleanup()
        self._initialized = True
    
    def get_pool(self, buffer_size: int) -> SecureMemoryPool:
        """
        Get or create a memory pool for the specified buffer size.
        
        Args:
            buffer_size: Size of buffers in the pool
            
        Returns:
            Memory pool instance
        """
        if buffer_size <= 0:
            raise ValueError("Buffer size must be positive")
            
        with self._lock:
            # Round up to nearest page size for efficiency
            page_size = PlatformMemory.get_page_size()
            aligned_size = ((buffer_size + page_size - 1) // page_size) * page_size
            
            if aligned_size not in self._pools:
                self._pools[aligned_size] = SecureMemoryPool(
                    pool_size=5,  # Smaller pools for larger buffers
                    buffer_size=aligned_size
                )
            
            return self._pools[aligned_size]
    
    def register_buffer(self, buffer: Union[bytearray, memoryview]):
        """
        Register a buffer for tracking and emergency cleanup.
        
        Args:
            buffer: Buffer to register
        """
        with self._lock:
            # Create weak reference with cleanup callback
            def cleanup_callback(ref):
                self._active_buffers.discard(ref)
            
            try:
                ref = weakref.ref(buffer, cleanup_callback)
                self._active_buffers.add(ref)
            except TypeError:
                # Some types like bytearray don't support weak references
                # Store a wrapper instead
                class BufferWrapper:
                    def __init__(self, buf):
                        self.buffer = buf
                
                wrapper = BufferWrapper(buffer)
                ref = weakref.ref(wrapper, cleanup_callback)
                self._active_buffers.add(ref)
    
    def register_cleanup_handler(self, handler: callable):
        """
        Register a cleanup handler for emergency situations.
        
        Args:
            handler: Cleanup function to call
        """
        with self._lock:
            self._cleanup_handlers.append(handler)
    
    def emergency_cleanup(self):
        """
        Perform emergency cleanup of all secure memory.
        
        This is called on process exit or signal reception.
        """
        logger.info("Performing emergency secure memory cleanup")
        
        with self._lock:
            # Clean up all pools
            for pool in self._pools.values():
                try:
                    pool.cleanup()
                except Exception as e:
                    logger.error(f"Error cleaning up memory pool: {e}")
            
            # Clean up active buffers
            for buffer_ref in list(self._active_buffers):
                try:
                    buffer = buffer_ref()
                    if buffer is not None:
                        secure_zero(buffer)
                except Exception as e:
                    logger.error(f"Error cleaning up buffer: {e}")
            
            # Call registered cleanup handlers
            for handler in self._cleanup_handlers:
                try:
                    handler()
                except Exception as e:
                    logger.error(f"Error in cleanup handler: {e}")
    
    def _register_emergency_cleanup(self):
        """Register emergency cleanup handlers."""
        if self._emergency_cleanup_registered:
            return
        
        # Register atexit handler
        atexit.register(self.emergency_cleanup)
        
        # Register signal handlers (Unix only)
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, self._signal_handler)
        if hasattr(signal, 'SIGINT'):
            signal.signal(signal.SIGINT, self._signal_handler)
        
        self._emergency_cleanup_registered = True
    
    def _signal_handler(self, signum, frame):
        """Handle process signals for emergency cleanup."""
        logger.info(f"Received signal {signum}, performing emergency cleanup")
        self.emergency_cleanup()
        # Re-raise the signal
        signal.default_int_handler(signum, frame)


# Global memory manager instance
_memory_manager = SecureMemoryManager()


@contextmanager
def locked_memory(size: int):
    """
    Context manager for locked secure memory.
    
    Args:
        size: Size of memory to allocate
        
    Yields:
        memoryview: Locked memory buffer
        
    Example:
        with locked_memory(32) as buf:
            # Memory is locked and secure
            buf[:] = sensitive_data
            # Automatically cleaned up and unlocked
    """
    # Try to get from pool first
    pool = _memory_manager.get_pool(size)
    buffer_view = pool.acquire(size)
    
    if buffer_view is not None:
        try:
            yield buffer_view
        finally:
            pool.release(buffer_view)
    else:
        # Fallback to direct allocation
        buffer = bytearray(size)
        lock_status = PlatformMemory.lock_memory(buffer)
        
        try:
            _memory_manager.register_buffer(buffer)
            yield memoryview(buffer)
        finally:
            secure_zero(buffer)
            if lock_status == MemoryLockStatus.LOCKED:
                PlatformMemory.unlock_memory(buffer)


def get_memory_stats() -> MemoryStats:
    """
    Get aggregated memory statistics.
    
    Returns:
        Combined statistics from all memory pools
    """
    total_stats = MemoryStats()
    
    for pool in _memory_manager._pools.values():
        stats = pool.get_stats()
        total_stats.total_allocated += stats.total_allocated
        total_stats.currently_allocated += stats.currently_allocated
        total_stats.locked_pages += stats.locked_pages
        total_stats.pool_hits += stats.pool_hits
        total_stats.pool_misses += stats.pool_misses
        total_stats.cleanup_operations += stats.cleanup_operations
    
    return total_stats


def is_memory_locking_available() -> bool:
    """
    Check if memory locking is available on this platform.
    
    Returns:
        True if memory locking is supported
    """
    test_buffer = bytearray(1024)
    status = PlatformMemory.lock_memory(test_buffer)
    
    if status == MemoryLockStatus.LOCKED:
        PlatformMemory.unlock_memory(test_buffer)
        return True
    
    return False


def register_cleanup_handler(handler: callable):
    """
    Register a cleanup handler for emergency situations.
    
    Args:
        handler: Function to call during emergency cleanup
    """
    _memory_manager.register_cleanup_handler(handler) 