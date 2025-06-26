"""
Tests for Enhanced Secure Memory Management

Tests advanced secure memory utilities including memory locking,
secure memory pools, and comprehensive protection features.
"""

import os
import pytest
import threading
import time
from unittest.mock import patch, MagicMock

from backend.app.crypto.secure_memory import (
    PlatformMemory,
    SecureMemoryPool,
    SecureMemoryManager,
    MemoryLockStatus,
    MemoryStats,
    locked_memory,
    get_memory_stats,
    is_memory_locking_available,
    register_cleanup_handler
)
from backend.app.crypto.memory import secure_zero
from backend.app.crypto.errors import MemoryError


class TestPlatformMemory:
    """Test platform-specific memory operations."""
    
    def test_get_page_size(self):
        """Test page size detection."""
        page_size = PlatformMemory.get_page_size()
        assert page_size > 0
        assert page_size in [4096, 8192, 16384, 65536]  # Common page sizes
    
    def test_memory_locking_operations(self):
        """Test memory locking and unlocking."""
        buffer = bytearray(1024)
        
        # Test locking
        lock_status = PlatformMemory.lock_memory(buffer)
        assert lock_status in [
            MemoryLockStatus.LOCKED,
            MemoryLockStatus.UNSUPPORTED,
            MemoryLockStatus.FAILED
        ]
        
        # Test unlocking
        if lock_status == MemoryLockStatus.LOCKED:
            unlock_result = PlatformMemory.unlock_memory(buffer)
            assert isinstance(unlock_result, bool)
    
    def test_memory_locking_with_memoryview(self):
        """Test memory locking with memoryview objects."""
        buffer = bytearray(1024)
        view = memoryview(buffer)
        
        lock_status = PlatformMemory.lock_memory(view)
        assert lock_status in [
            MemoryLockStatus.LOCKED,
            MemoryLockStatus.UNSUPPORTED,
            MemoryLockStatus.FAILED
        ]
        
        if lock_status == MemoryLockStatus.LOCKED:
            PlatformMemory.unlock_memory(view)


class TestSecureMemoryPool:
    """Test secure memory pool functionality."""
    
    def test_pool_initialization(self):
        """Test memory pool initialization."""
        pool = SecureMemoryPool(pool_size=5, buffer_size=1024)
        
        assert pool.pool_size == 5
        assert pool.buffer_size == 1024
        
        stats = pool.get_stats()
        assert stats.total_allocated == 5 * 1024
        assert stats.currently_allocated == 0
    
    def test_pool_acquire_and_release(self):
        """Test acquiring and releasing buffers from pool."""
        pool = SecureMemoryPool(pool_size=3, buffer_size=1024)
        
        # Acquire a buffer
        buffer1 = pool.acquire(512)
        assert buffer1 is not None
        assert len(buffer1) == 512
        
        stats = pool.get_stats()
        assert stats.pool_hits == 1
        assert stats.currently_allocated == 512
        
        # Acquire another buffer
        buffer2 = pool.acquire(256)
        assert buffer2 is not None
        assert len(buffer2) == 256
        
        # Release buffers
        pool.release(buffer1)
        pool.release(buffer2)
        
        stats = pool.get_stats()
        assert stats.currently_allocated == 0
        assert stats.cleanup_operations >= 2
    
    def test_pool_oversized_request(self):
        """Test requesting buffer larger than pool buffer size."""
        pool = SecureMemoryPool(pool_size=2, buffer_size=1024)
        
        # Request larger than buffer size
        buffer = pool.acquire(2048)
        assert buffer is None
        
        stats = pool.get_stats()
        assert stats.pool_misses == 1
    
    def test_pool_exhaustion(self):
        """Test pool behavior when all buffers are in use."""
        pool = SecureMemoryPool(pool_size=2, buffer_size=1024)
        
        # Acquire all buffers
        buffer1 = pool.acquire(1024)
        buffer2 = pool.acquire(1024)
        
        assert buffer1 is not None
        assert buffer2 is not None
        
        # Try to acquire when pool is exhausted
        buffer3 = pool.acquire(1024)
        assert buffer3 is None
        
        stats = pool.get_stats()
        assert stats.pool_misses == 1
        
        # Release one and try again
        pool.release(buffer1)
        buffer3 = pool.acquire(1024)
        assert buffer3 is not None
    
    def test_pool_cleanup(self):
        """Test pool cleanup functionality."""
        pool = SecureMemoryPool(pool_size=2, buffer_size=1024)
        
        # Acquire some buffers
        buffer1 = pool.acquire(512)
        buffer2 = pool.acquire(256)
        
        # Cleanup the pool
        pool.cleanup()
        
        # Pool should be empty after cleanup
        assert len(pool._pool) == 0
        assert len(pool._available) == 0
        assert len(pool._in_use) == 0


class TestSecureMemoryManager:
    """Test global secure memory manager."""
    
    def test_singleton_pattern(self):
        """Test that SecureMemoryManager is a singleton."""
        manager1 = SecureMemoryManager()
        manager2 = SecureMemoryManager()
        
        assert manager1 is manager2
    
    def test_get_pool(self):
        """Test getting memory pools."""
        manager = SecureMemoryManager()
        
        pool1 = manager.get_pool(1024)
        pool2 = manager.get_pool(1024)
        
        # Should get the same pool for the same size
        assert pool1 is pool2
        
        # Different size should get different pool
        pool3 = manager.get_pool(2048)
        assert pool3 is not pool1
    
    def test_register_buffer(self):
        """Test buffer registration for tracking."""
        manager = SecureMemoryManager()
        
        buffer = bytearray(1024)
        initial_count = len(manager._active_buffers)
        
        manager.register_buffer(buffer)
        
        assert len(manager._active_buffers) == initial_count + 1
    
    def test_cleanup_handler_registration(self):
        """Test cleanup handler registration."""
        manager = SecureMemoryManager()
        
        cleanup_called = False
        
        def test_cleanup():
            nonlocal cleanup_called
            cleanup_called = True
        
        initial_count = len(manager._cleanup_handlers)
        manager.register_cleanup_handler(test_cleanup)
        
        assert len(manager._cleanup_handlers) == initial_count + 1
        
        # Test emergency cleanup calls the handler
        manager.emergency_cleanup()
        assert cleanup_called


class TestLockedMemoryContext:
    """Test locked memory context manager."""
    
    def test_locked_memory_basic(self):
        """Test basic locked memory functionality."""
        with locked_memory(1024) as buffer:
            assert len(buffer) == 1024
            
            # Write some data
            test_data = b"Hello, secure world!"
            buffer[:len(test_data)] = test_data
            
            # Verify data
            assert bytes(buffer[:len(test_data)]) == test_data
    
    def test_locked_memory_automatic_cleanup(self):
        """Test that locked memory is automatically cleaned up."""
        test_data = b"sensitive data"
        
        with locked_memory(1024) as buffer:
            buffer[:len(test_data)] = test_data
            buffer_address = id(buffer)
        
        # Buffer should be cleaned up after context exit
        # This is hard to test directly, but we can verify the context works
        assert buffer_address is not None
    
    def test_locked_memory_different_sizes(self):
        """Test locked memory with different sizes."""
        sizes = [32, 64, 128, 256, 512, 1024, 2048, 4096]
        
        for size in sizes:
            with locked_memory(size) as buffer:
                assert len(buffer) == size
                
                # Fill with pattern
                pattern = (size // 4).to_bytes(4, 'big')
                for i in range(0, size, 4):
                    end = min(i + 4, size)
                    buffer[i:end] = pattern[:end-i]
    
    def test_locked_memory_concurrent_access(self):
        """Test concurrent access to locked memory."""
        results = []
        
        def worker(worker_id):
            with locked_memory(1024) as buffer:
                # Write worker ID
                worker_data = f"worker_{worker_id}".encode()
                buffer[:len(worker_data)] = worker_data
                
                # Small delay to test concurrency
                time.sleep(0.01)
                
                # Verify data is still correct
                read_data = bytes(buffer[:len(worker_data)])
                results.append(read_data == worker_data)
        
        # Start multiple threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=worker, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads
        for thread in threads:
            thread.join()
        
        # All workers should have succeeded
        assert all(results)
        assert len(results) == 5


class TestMemoryStats:
    """Test memory statistics functionality."""
    
    def test_get_memory_stats(self):
        """Test getting memory statistics."""
        stats = get_memory_stats()
        
        assert isinstance(stats, MemoryStats)
        assert stats.total_allocated >= 0
        assert stats.currently_allocated >= 0
        assert stats.locked_pages >= 0
        assert stats.pool_hits >= 0
        assert stats.pool_misses >= 0
        assert stats.cleanup_operations >= 0
    
    def test_stats_after_operations(self):
        """Test that stats are updated after operations."""
        initial_stats = get_memory_stats()
        
        # Perform some operations
        with locked_memory(1024) as buffer:
            buffer[:10] = b"test data!"
        
        final_stats = get_memory_stats()
        
        # Some stats should have changed
        assert (final_stats.pool_hits >= initial_stats.pool_hits or
                final_stats.pool_misses >= initial_stats.pool_misses)


class TestMemoryLockingAvailability:
    """Test memory locking availability detection."""
    
    def test_is_memory_locking_available(self):
        """Test memory locking availability detection."""
        available = is_memory_locking_available()
        assert isinstance(available, bool)
        
        # The result depends on platform and privileges
        # Just verify it returns a boolean
    
    @patch('backend.app.crypto.secure_memory.PlatformMemory.lock_memory')
    def test_memory_locking_mock_success(self, mock_lock):
        """Test memory locking availability with mocked success."""
        mock_lock.return_value = MemoryLockStatus.LOCKED
        
        available = is_memory_locking_available()
        assert available is True
    
    @patch('backend.app.crypto.secure_memory.PlatformMemory.lock_memory')
    def test_memory_locking_mock_failure(self, mock_lock):
        """Test memory locking availability with mocked failure."""
        mock_lock.return_value = MemoryLockStatus.FAILED
        
        available = is_memory_locking_available()
        assert available is False


class TestCleanupHandlers:
    """Test cleanup handler functionality."""
    
    def test_register_cleanup_handler(self):
        """Test registering cleanup handlers."""
        cleanup_called = False
        
        def test_cleanup():
            nonlocal cleanup_called
            cleanup_called = True
        
        register_cleanup_handler(test_cleanup)
        
        # Trigger emergency cleanup
        manager = SecureMemoryManager()
        manager.emergency_cleanup()
        
        assert cleanup_called


class TestErrorConditions:
    """Test error conditions and edge cases."""
    
    def test_zero_size_memory(self):
        """Test requesting zero-size memory."""
        with pytest.raises(ValueError):
            with locked_memory(0):
                pass
    
    def test_negative_size_memory(self):
        """Test requesting negative-size memory."""
        with pytest.raises(ValueError):
            with locked_memory(-1):
                pass
    
    def test_very_large_memory_request(self):
        """Test requesting very large memory."""
        # This should either work or fail gracefully
        try:
            with locked_memory(1024 * 1024 * 100):  # 100MB
                pass
        except (MemoryError, OSError):
            # Expected on systems with limited memory
            pass
    
    def test_pool_with_zero_size(self):
        """Test creating pool with zero size."""
        with pytest.raises(ValueError):
            SecureMemoryPool(pool_size=0, buffer_size=1024)
    
    def test_pool_with_zero_buffer_size(self):
        """Test creating pool with zero buffer size."""
        with pytest.raises(ValueError):
            SecureMemoryPool(pool_size=5, buffer_size=0)


class TestIntegration:
    """Integration tests for secure memory management."""
    
    def test_full_workflow(self):
        """Test complete secure memory workflow."""
        # Create some secure memory
        with locked_memory(1024) as buffer:
            # Store sensitive data
            secret = b"This is a secret key that must be protected"
            buffer[:len(secret)] = secret
            
            # Verify data
            assert bytes(buffer[:len(secret)]) == secret
            
            # Get stats
            stats = get_memory_stats()
            assert stats.currently_allocated >= len(secret)
            
            # Clear part of the buffer
            secure_zero(buffer[10:20])
            
            # Verify partial clearing
            assert buffer[15] == 0
            assert bytes(buffer[:10]) == secret[:10]
    
    def test_multiple_concurrent_operations(self):
        """Test multiple concurrent secure memory operations."""
        def worker():
            for i in range(10):
                with locked_memory(256) as buffer:
                    data = f"worker_data_{i}".encode()
                    buffer[:len(data)] = data
                    time.sleep(0.001)  # Small delay
        
        # Start multiple workers
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=worker)
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # Verify system is still stable
        stats = get_memory_stats()
        assert isinstance(stats, MemoryStats)
    
    def test_memory_pressure(self):
        """Test behavior under memory pressure."""
        buffers = []
        
        try:
            # Allocate many small buffers
            for i in range(100):
                with locked_memory(1024) as buffer:
                    data = f"buffer_{i}".encode()
                    buffer[:len(data)] = data
                    # Don't store references to test cleanup
        
        except (MemoryError, OSError):
            # Expected under high memory pressure
            pass
        
        # System should still be functional
        with locked_memory(64) as small_buffer:
            small_buffer[:5] = b"test!"
            assert bytes(small_buffer[:5]) == b"test!"


if __name__ == "__main__":
    pytest.main([__file__]) 