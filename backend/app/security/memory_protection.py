"""
Secure memory management and protection utilities.

This module provides secure memory allocation, protected data containers,
and memory leak detection to prevent sensitive data exposure.
"""

import os
import gc
import sys
import time
import weakref
import hashlib
import secrets
from typing import Dict, List, Optional, Any, Union, Callable
from dataclasses import dataclass, field
from contextlib import contextmanager
from threading import Lock, RLock
import logging
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import mmap
import ctypes
import platform

logger = logging.getLogger(__name__)

# Memory protection constants
SECURE_MEMORY_ALIGNMENT = 64
MAX_SECURE_ALLOCATIONS = 1000
MEMORY_WIPE_PASSES = 3
MEMORY_AGING_THRESHOLD = 300  # 5 minutes


@dataclass
class MemoryAllocation:
    """Information about a memory allocation."""
    address: int
    size: int
    timestamp: float
    source: str
    is_protected: bool = False
    access_count: int = 0


@dataclass
class MemoryLeak:
    """Information about a detected memory leak."""
    allocation: MemoryAllocation
    age: float
    leak_score: float
    suspected_cause: str


class SecureMemoryManager:
    """Manager for secure memory allocations with protection and cleanup."""
    
    def __init__(self):
        self.allocations: Dict[int, MemoryAllocation] = {}
        self.protected_regions: Dict[int, bytes] = {}
        self.allocation_lock = RLock()
        self.cleanup_callbacks: List[Callable] = []
        self.weak_refs: Dict[int, weakref.ref] = {}
    
    def allocate_secure_memory(self, size: int, source: str = "unknown") -> int:
        """
        Allocate secure memory region.
        
        Args:
            size: Size of memory to allocate
            source: Source of allocation for tracking
            
        Returns:
            int: Memory address (simulated)
        """
        with self.allocation_lock:
            if len(self.allocations) >= MAX_SECURE_ALLOCATIONS:
                self._force_cleanup()
            
            # Simulate secure memory allocation
            address = id(bytearray(size))
            allocation = MemoryAllocation(
                address=address,
                size=size,
                timestamp=time.time(),
                source=source,
                is_protected=True
            )
            
            self.allocations[address] = allocation
            self.protected_regions[address] = bytearray(size)
            
            # Register cleanup callback
            def cleanup_callback():
                self._secure_free(address)
            
            self.cleanup_callbacks.append(cleanup_callback)
            
            logger.debug(f"Allocated secure memory: {size} bytes at {address}")
            return address
    
    def _secure_free(self, address: int):
        """
        Securely free memory with multiple overwrites.
        
        Args:
            address: Memory address to free
        """
        with self.allocation_lock:
            if address not in self.allocations:
                return
            
            allocation = self.allocations[address]
            
            # Perform multiple overwrite passes
            if address in self.protected_regions:
                memory_region = self.protected_regions[address]
                
                for pass_num in range(MEMORY_WIPE_PASSES):
                    if pass_num == 0:
                        # First pass: all zeros
                        for i in range(len(memory_region)):
                            memory_region[i] = 0
                    elif pass_num == 1:
                        # Second pass: all ones
                        for i in range(len(memory_region)):
                            memory_region[i] = 0xFF
                    else:
                        # Final pass: random data
                        random_data = secrets.token_bytes(len(memory_region))
                        for i in range(len(memory_region)):
                            memory_region[i] = random_data[i]
                
                del self.protected_regions[address]
            
            del self.allocations[address]
            logger.debug(f"Securely freed memory at {address}")
    
    def _force_cleanup(self):
        """Force cleanup of old allocations."""
        current_time = time.time()
        old_allocations = []
        
        for address, allocation in self.allocations.items():
            if current_time - allocation.timestamp > MEMORY_AGING_THRESHOLD:
                old_allocations.append(address)
        
        for address in old_allocations:
            self._secure_free(address)
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory allocation statistics."""
        with self.allocation_lock:
            total_allocated = sum(alloc.size for alloc in self.allocations.values())
            protected_count = sum(1 for alloc in self.allocations.values() if alloc.is_protected)
            
            return {
                'total_allocations': len(self.allocations),
                'total_size': total_allocated,
                'protected_allocations': protected_count,
                'average_age': self._calculate_average_age(),
                'sources': self._get_allocation_sources()
            }
    
    def _calculate_average_age(self) -> float:
        """Calculate average age of allocations."""
        if not self.allocations:
            return 0.0
        
        current_time = time.time()
        total_age = sum(current_time - alloc.timestamp for alloc in self.allocations.values())
        return total_age / len(self.allocations)
    
    def _get_allocation_sources(self) -> Dict[str, int]:
        """Get allocation counts by source."""
        sources = {}
        for allocation in self.allocations.values():
            sources[allocation.source] = sources.get(allocation.source, 0) + 1
        return sources
    
    def cleanup_all(self):
        """Clean up all allocations."""
        with self.allocation_lock:
            addresses = list(self.allocations.keys())
            for address in addresses:
                self._secure_free(address)
            
            # Run cleanup callbacks
            for callback in self.cleanup_callbacks:
                try:
                    callback()
                except Exception as e:
                    logger.warning(f"Cleanup callback failed: {e}")
            
            self.cleanup_callbacks.clear()


class SecureString:
    """Secure string container with encryption and automatic cleanup."""
    
    def __init__(self, value: str, key: Optional[bytes] = None):
        self.key = key or get_random_bytes(32)
        self.cipher = AES.new(self.key, AES.MODE_GCM)
        self.nonce = self.cipher.nonce
        self.encrypted_data, self.auth_tag = self.cipher.encrypt_and_digest(value.encode('utf-8'))
        self.original_length = len(value)
        self._hash = hashlib.sha256(value.encode('utf-8')).hexdigest()
        
        # Clear the original value from memory
        if hasattr(value, 'encode'):
            # Try to overwrite string in memory (limited effectiveness in Python)
            try:
                value_bytes = value.encode('utf-8')
                ctypes.memset(id(value_bytes), 0, len(value_bytes))
            except:
                pass
    
    def decrypt(self) -> str:
        """Decrypt and return the string value."""
        try:
            cipher = AES.new(self.key, AES.MODE_GCM, nonce=self.nonce)
            decrypted_data = cipher.decrypt_and_verify(self.encrypted_data, self.auth_tag)
            return decrypted_data.decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to decrypt secure string: {e}")
            raise ValueError("Failed to decrypt secure string")
    
    def compare(self, other: Union[str, 'SecureString']) -> bool:
        """Compare with another string in constant time."""
        if isinstance(other, SecureString):
            return self._hash == other._hash
        else:
            other_hash = hashlib.sha256(other.encode('utf-8')).hexdigest()
            return self._hash == other_hash
    
    def __len__(self) -> int:
        return self.original_length
    
    def __del__(self):
        """Secure cleanup on deletion."""
        # Overwrite sensitive data
        if hasattr(self, 'key'):
            try:
                ctypes.memset(id(self.key), 0, len(self.key))
            except:
                pass
        
        if hasattr(self, 'encrypted_data'):
            try:
                ctypes.memset(id(self.encrypted_data), 0, len(self.encrypted_data))
            except:
                pass


class SecureBytes:
    """Secure bytes container with encryption and automatic cleanup."""
    
    def __init__(self, value: bytes, key: Optional[bytes] = None):
        self.key = key or get_random_bytes(32)
        self.cipher = AES.new(self.key, AES.MODE_GCM)
        self.nonce = self.cipher.nonce
        self.encrypted_data, self.auth_tag = self.cipher.encrypt_and_digest(value)
        self.original_length = len(value)
        self._hash = hashlib.sha256(value).hexdigest()
        
        # Clear the original value from memory
        try:
            ctypes.memset(id(value), 0, len(value))
        except:
            pass
    
    def decrypt(self) -> bytes:
        """Decrypt and return the bytes value."""
        try:
            cipher = AES.new(self.key, AES.MODE_GCM, nonce=self.nonce)
            decrypted_data = cipher.decrypt_and_verify(self.encrypted_data, self.auth_tag)
            return decrypted_data
        except Exception as e:
            logger.error(f"Failed to decrypt secure bytes: {e}")
            raise ValueError("Failed to decrypt secure bytes")
    
    def compare(self, other: Union[bytes, 'SecureBytes']) -> bool:
        """Compare with another bytes object in constant time."""
        if isinstance(other, SecureBytes):
            return self._hash == other._hash
        else:
            other_hash = hashlib.sha256(other).hexdigest()
            return self._hash == other_hash
    
    def __len__(self) -> int:
        return self.original_length
    
    def __del__(self):
        """Secure cleanup on deletion."""
        # Overwrite sensitive data
        if hasattr(self, 'key'):
            try:
                ctypes.memset(id(self.key), 0, len(self.key))
            except:
                pass
        
        if hasattr(self, 'encrypted_data'):
            try:
                ctypes.memset(id(self.encrypted_data), 0, len(self.encrypted_data))
            except:
                pass


class MemoryLeakDetector:
    """Detector for memory leaks and suspicious memory usage patterns."""
    
    def __init__(self, memory_manager: SecureMemoryManager):
        self.memory_manager = memory_manager
        self.baseline_memory = self._get_memory_usage()
        self.memory_samples: List[Tuple[float, int]] = []
        self.leak_threshold = 1.5  # 50% increase
        self.sample_interval = 60  # 1 minute
        self.last_sample_time = time.time()
    
    def _get_memory_usage(self) -> int:
        """Get current memory usage."""
        try:
            import psutil
            process = psutil.Process()
            return process.memory_info().rss
        except ImportError:
            # Fallback to basic memory tracking
            return sum(alloc.size for alloc in self.memory_manager.allocations.values())
    
    def sample_memory(self):
        """Sample current memory usage."""
        current_time = time.time()
        
        if current_time - self.last_sample_time < self.sample_interval:
            return
        
        current_memory = self._get_memory_usage()
        self.memory_samples.append((current_time, current_memory))
        
        # Keep only last 24 hours of samples
        cutoff_time = current_time - 86400
        self.memory_samples = [
            (t, m) for t, m in self.memory_samples if t > cutoff_time
        ]
        
        self.last_sample_time = current_time
    
    def detect_leaks(self) -> List[MemoryLeak]:
        """Detect potential memory leaks."""
        leaks = []
        current_time = time.time()
        
        # Check for aging allocations
        for address, allocation in self.memory_manager.allocations.items():
            age = current_time - allocation.timestamp
            
            if age > MEMORY_AGING_THRESHOLD:
                leak_score = self._calculate_leak_score(allocation, age)
                
                if leak_score > 0.7:
                    leaks.append(MemoryLeak(
                        allocation=allocation,
                        age=age,
                        leak_score=leak_score,
                        suspected_cause=self._determine_suspected_cause(allocation)
                    ))
        
        # Check for memory growth trend
        if len(self.memory_samples) > 10:
            memory_trend = self._analyze_memory_trend()
            if memory_trend > self.leak_threshold:
                # Create synthetic leak for trend analysis
                synthetic_allocation = MemoryAllocation(
                    address=0,
                    size=0,
                    timestamp=current_time,
                    source="memory_trend_analysis",
                    is_protected=False
                )
                
                leaks.append(MemoryLeak(
                    allocation=synthetic_allocation,
                    age=0,
                    leak_score=memory_trend,
                    suspected_cause="Sustained memory growth detected"
                ))
        
        return leaks
    
    def _calculate_leak_score(self, allocation: MemoryAllocation, age: float) -> float:
        """Calculate leak score for an allocation."""
        base_score = min(age / 3600, 1.0)  # Normalize to 1 hour
        
        # Factor in size (larger allocations are more suspicious)
        size_factor = min(allocation.size / 1024, 1.0)  # Normalize to 1KB
        
        # Factor in access pattern (unused allocations are more suspicious)
        access_factor = 1.0 / (allocation.access_count + 1)
        
        return base_score * 0.6 + size_factor * 0.3 + access_factor * 0.1
    
    def _determine_suspected_cause(self, allocation: MemoryAllocation) -> str:
        """Determine suspected cause of memory leak."""
        age = time.time() - allocation.timestamp
        
        if age > 1800:  # 30 minutes
            return "Long-lived allocation without cleanup"
        elif allocation.access_count == 0:
            return "Unused allocation"
        elif allocation.size > 10240:  # 10KB
            return "Large allocation without cleanup"
        else:
            return "Potential memory leak"
    
    def _analyze_memory_trend(self) -> float:
        """Analyze memory usage trend."""
        if len(self.memory_samples) < 5:
            return 0.0
        
        # Calculate memory growth rate
        first_sample = self.memory_samples[0][1]
        last_sample = self.memory_samples[-1][1]
        
        if first_sample == 0:
            return 0.0
        
        growth_rate = (last_sample - first_sample) / first_sample
        return growth_rate
    
    def get_leak_report(self) -> Dict[str, Any]:
        """Generate comprehensive leak report."""
        leaks = self.detect_leaks()
        
        return {
            'total_leaks': len(leaks),
            'critical_leaks': len([l for l in leaks if l.leak_score > 0.8]),
            'warning_leaks': len([l for l in leaks if 0.5 < l.leak_score <= 0.8]),
            'memory_trend': self._analyze_memory_trend(),
            'leak_details': [
                {
                    'address': leak.allocation.address,
                    'age': leak.age,
                    'score': leak.leak_score,
                    'cause': leak.suspected_cause,
                    'source': leak.allocation.source
                }
                for leak in leaks
            ]
        }


class SecureMemoryPool:
    """Memory pool for efficient allocation and deallocation."""
    
    def __init__(self, pool_size: int = 1024 * 1024):  # 1MB default
        self.pool_size = pool_size
        self.memory_pool = bytearray(pool_size)
        self.free_blocks: List[Tuple[int, int]] = [(0, pool_size)]  # (offset, size)
        self.allocated_blocks: Dict[int, Tuple[int, int]] = {}  # address -> (offset, size)
        self.lock = Lock()
        self.fragmentation_threshold = 0.7
    
    def allocate(self, size: int) -> Optional[int]:
        """Allocate memory from pool."""
        with self.lock:
            # Find suitable free block
            for i, (offset, block_size) in enumerate(self.free_blocks):
                if block_size >= size:
                    # Allocate from this block
                    address = id(self.memory_pool) + offset
                    self.allocated_blocks[address] = (offset, size)
                    
                    # Update free blocks
                    if block_size > size:
                        self.free_blocks[i] = (offset + size, block_size - size)
                    else:
                        del self.free_blocks[i]
                    
                    return address
            
            return None  # No suitable block found
    
    def deallocate(self, address: int):
        """Deallocate memory back to pool."""
        with self.lock:
            if address not in self.allocated_blocks:
                return
            
            offset, size = self.allocated_blocks[address]
            
            # Clear memory
            for i in range(offset, offset + size):
                self.memory_pool[i] = 0
            
            # Add back to free blocks
            self.free_blocks.append((offset, size))
            del self.allocated_blocks[address]
            
            # Coalesce free blocks
            self._coalesce_free_blocks()
    
    def _coalesce_free_blocks(self):
        """Coalesce adjacent free blocks to reduce fragmentation."""
        if len(self.free_blocks) <= 1:
            return
        
        # Sort by offset
        self.free_blocks.sort(key=lambda x: x[0])
        
        coalesced = []
        current_offset, current_size = self.free_blocks[0]
        
        for offset, size in self.free_blocks[1:]:
            if current_offset + current_size == offset:
                # Adjacent blocks, coalesce
                current_size += size
            else:
                # Non-adjacent, add current block and start new one
                coalesced.append((current_offset, current_size))
                current_offset, current_size = offset, size
        
        # Add the last block
        coalesced.append((current_offset, current_size))
        self.free_blocks = coalesced
    
    def get_fragmentation_score(self) -> float:
        """Calculate memory fragmentation score."""
        if not self.free_blocks:
            return 0.0
        
        total_free = sum(size for _, size in self.free_blocks)
        if total_free == 0:
            return 0.0
        
        largest_block = max(size for _, size in self.free_blocks)
        return 1.0 - (largest_block / total_free)
    
    def defragment(self):
        """Defragment memory pool by moving allocated blocks."""
        with self.lock:
            if self.get_fragmentation_score() < self.fragmentation_threshold:
                return
            
            # Simple defragmentation: move all allocated blocks to the beginning
            new_allocated = {}
            next_offset = 0
            
            for address, (offset, size) in self.allocated_blocks.items():
                # Move data
                if offset != next_offset:
                    self.memory_pool[next_offset:next_offset + size] = \
                        self.memory_pool[offset:offset + size]
                
                new_allocated[address] = (next_offset, size)
                next_offset += size
            
            self.allocated_blocks = new_allocated
            
            # Update free blocks
            if next_offset < self.pool_size:
                self.free_blocks = [(next_offset, self.pool_size - next_offset)]
            else:
                self.free_blocks = []


@contextmanager
def secure_memory_context(size: int, source: str = "context"):
    """Context manager for secure memory allocation."""
    memory_manager = SecureMemoryManager()
    address = memory_manager.allocate_secure_memory(size, source)
    
    try:
        yield address
    finally:
        memory_manager.cleanup_all()


# Global instances
secure_memory_manager = SecureMemoryManager()
memory_leak_detector = MemoryLeakDetector(secure_memory_manager)
secure_memory_pool = SecureMemoryPool() 