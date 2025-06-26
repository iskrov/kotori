"""
Secure Memory Management Utilities

Provides utilities for secure handling of sensitive cryptographic data
including automatic cleanup and protection against memory dumps.
"""

import ctypes
import os
import secrets
from typing import Union, Optional
from contextlib import contextmanager

from .errors import MemoryError


def secure_zero(data: Union[bytearray, memoryview]) -> None:
    """
    Securely zero out memory containing sensitive data.
    
    This function attempts to prevent the compiler from optimizing away
    the memory clearing operation.
    
    Args:
        data: The memory buffer to clear
        
    Raises:
        MemoryError: If the memory cannot be cleared
    """
    if not isinstance(data, (bytearray, memoryview)):
        raise MemoryError(f"Cannot securely zero {type(data).__name__}")
    
    # Handle empty buffers
    if len(data) == 0:
        return
    
    try:
        # Fill with random data first, then zeros
        length = len(data)
        random_data = secrets.token_bytes(length)
        
        # Overwrite with random data
        for i in range(length):
            data[i] = random_data[i]
        
        # Then overwrite with zeros
        for i in range(length):
            data[i] = 0
            
        # Force memory barrier (platform-specific)
        if hasattr(ctypes, 'c_void_p'):
            # Create a volatile pointer to prevent optimization
            ptr = ctypes.cast(ctypes.addressof(ctypes.c_char.from_buffer(data)), ctypes.c_void_p)
            # Force memory access
            _ = ptr.value
            
    except Exception as e:
        raise MemoryError(f"Failed to securely zero memory: {e}")


class SecureMemory:
    """
    Context manager for secure memory handling.
    
    Automatically zeros out memory when the context exits to prevent
    sensitive data from remaining in memory.
    """
    
    def __init__(self, size: int):
        """
        Initialize secure memory buffer.
        
        Args:
            size: Size of the memory buffer in bytes
            
        Raises:
            MemoryError: If memory allocation fails
        """
        if size <= 0:
            raise MemoryError("Memory size must be positive")
        
        try:
            self._buffer = bytearray(size)
            self._size = size
            self._view: Optional[memoryview] = None
        except Exception as e:
            raise MemoryError(f"Failed to allocate secure memory: {e}")
    
    def __enter__(self) -> memoryview:
        """Enter the context and return a memory view."""
        if self._view is not None:
            raise MemoryError("SecureMemory is already in use")
        
        self._view = memoryview(self._buffer)
        return self._view
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit the context and securely clear memory."""
        if self._view is not None:
            self._view.release()
            self._view = None
        
        # Securely zero the buffer
        secure_zero(self._buffer)
    
    @property
    def size(self) -> int:
        """Get the size of the memory buffer."""
        return self._size
    
    def is_active(self) -> bool:
        """Check if the memory buffer is currently in use."""
        return self._view is not None


@contextmanager
def secure_buffer(size: int):
    """
    Context manager for creating a secure memory buffer.
    
    Args:
        size: Size of the buffer in bytes
        
    Yields:
        memoryview: A view of the secure memory buffer
        
    Example:
        with secure_buffer(32) as buf:
            # Use buf for sensitive operations
            buf[:] = sensitive_data
            # Buffer is automatically cleared when exiting
    """
    with SecureMemory(size) as buffer:
        yield buffer


def constant_time_compare(a: bytes, b: bytes) -> bool:
    """
    Compare two byte sequences in constant time.
    
    This prevents timing attacks by ensuring the comparison
    takes the same amount of time regardless of where the
    sequences differ.
    
    Args:
        a: First byte sequence
        b: Second byte sequence
        
    Returns:
        True if the sequences are equal, False otherwise
    """
    if len(a) != len(b):
        return False
    
    result = 0
    for x, y in zip(a, b):
        result |= x ^ y
    
    return result == 0


def secure_random_bytes(length: int) -> bytes:
    """
    Generate cryptographically secure random bytes.
    
    Args:
        length: Number of random bytes to generate
        
    Returns:
        Cryptographically secure random bytes
        
    Raises:
        MemoryError: If random generation fails
    """
    if length <= 0:
        raise MemoryError("Length must be positive")
    
    try:
        return secrets.token_bytes(length)
    except Exception as e:
        raise MemoryError(f"Failed to generate secure random bytes: {e}")


def is_memory_locked() -> bool:
    """
    Check if memory locking is available on this platform.
    
    Returns:
        True if memory can be locked, False otherwise
    """
    try:
        # Try to lock a small amount of memory
        test_data = bytearray(1024)
        if hasattr(os, 'mlock'):
            os.mlock(test_data)
            os.munlock(test_data)
            return True
    except (OSError, AttributeError):
        pass
    
    return False 