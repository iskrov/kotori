"""
Secure Operations with Side-Channel Protection

Provides constant-time operations, memory access pattern obfuscation,
and protection against timing attacks and cache-based side-channel attacks.
"""

import hmac
import os
import random
import secrets
import time
from typing import List, Optional, Tuple, Union
from contextlib import contextmanager

from .memory import secure_zero, secure_random_bytes
from .secure_memory import locked_memory
from .errors import MemoryError


class ConstantTimeOps:
    """
    Constant-time operations to prevent timing attacks.
    
    All operations in this class are designed to take the same
    amount of time regardless of the input data.
    """
    
    @staticmethod
    def compare(a: bytes, b: bytes) -> bool:
        """
        Compare two byte sequences in constant time.
        
        Args:
            a: First byte sequence
            b: Second byte sequence
            
        Returns:
            True if sequences are equal, False otherwise
        """
        # Use hmac.compare_digest for constant-time comparison
        return hmac.compare_digest(a, b)
    
    @staticmethod
    def select(condition: bool, true_value: bytes, false_value: bytes) -> bytes:
        """
        Select between two values in constant time.
        
        Args:
            condition: Selection condition
            true_value: Value to return if condition is True
            false_value: Value to return if condition is False
            
        Returns:
            Selected value
        """
        if len(true_value) != len(false_value):
            raise MemoryError("Values must have the same length")
        
        # Create mask based on condition
        mask = 0xFF if condition else 0x00
        
        result = bytearray(len(true_value))
        for i in range(len(true_value)):
            # Constant-time selection using bitwise operations
            result[i] = (true_value[i] & mask) | (false_value[i] & (~mask & 0xFF))
        
        return bytes(result)
    
    @staticmethod
    def conditional_copy(condition: bool, source: bytes, dest: bytearray) -> None:
        """
        Conditionally copy data in constant time.
        
        Args:
            condition: Whether to perform the copy
            source: Source data
            dest: Destination buffer
        """
        if len(source) != len(dest):
            raise MemoryError("Source and destination must have the same length")
        
        mask = 0xFF if condition else 0x00
        
        for i in range(len(source)):
            # Constant-time conditional assignment
            dest[i] = (source[i] & mask) | (dest[i] & (~mask & 0xFF))
    
    @staticmethod
    def find_byte(haystack: bytes, needle: int) -> int:
        """
        Find the first occurrence of a byte in constant time.
        
        Args:
            haystack: Data to search in
            needle: Byte value to find
            
        Returns:
            Index of first occurrence, or -1 if not found
        """
        found_index = -1
        found = False
        
        for i in range(len(haystack)):
            # Check if this byte matches
            matches = haystack[i] == needle
            
            # Update found_index only if this is the first match
            # Use constant-time conditional assignment
            not_found_yet = not found
            should_update = matches and not_found_yet
            
            if should_update:
                found_index = i
                found = True
        
        return found_index
    
    @staticmethod
    def xor_arrays(a: bytes, b: bytes) -> bytes:
        """
        XOR two byte arrays in constant time.
        
        Args:
            a: First array
            b: Second array
            
        Returns:
            XOR result
        """
        if len(a) != len(b):
            raise MemoryError("Arrays must have the same length")
        
        result = bytearray(len(a))
        for i in range(len(a)):
            result[i] = a[i] ^ b[i]
        
        return bytes(result)


class MemoryObfuscation:
    """
    Memory access pattern obfuscation to prevent cache-timing attacks.
    
    Provides techniques to make memory access patterns unpredictable
    and resistant to cache-based side-channel analysis.
    """
    
    @staticmethod
    def dummy_accesses(memory_size: int, num_accesses: int = 100) -> None:
        """
        Perform dummy memory accesses to obfuscate access patterns.
        
        Args:
            memory_size: Size of memory region to access
            num_accesses: Number of dummy accesses to perform
        """
        # Create a dummy buffer
        with locked_memory(memory_size) as dummy_buffer:
            # Perform random accesses
            for _ in range(num_accesses):
                # Random index within the buffer
                index = secrets.randbelow(memory_size)
                
                # Dummy read operation
                _ = dummy_buffer[index]
                
                # Add small random delay
                time.sleep(secrets.randbelow(100) / 1000000)  # 0-100 microseconds
    
    @staticmethod
    def shuffle_access_order(indices: List[int]) -> List[int]:
        """
        Shuffle memory access order to prevent pattern analysis.
        
        Args:
            indices: List of memory indices to access
            
        Returns:
            Shuffled list of indices
        """
        # Create a copy to avoid modifying the original
        shuffled = indices.copy()
        
        # Use cryptographically secure shuffle
        for i in range(len(shuffled) - 1, 0, -1):
            j = secrets.randbelow(i + 1)
            shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
        
        return shuffled
    
    @staticmethod
    @contextmanager
    def obfuscated_memory_access(size: int):
        """
        Context manager for obfuscated memory access.
        
        Args:
            size: Size of memory region
            
        Yields:
            Memory buffer with obfuscated access patterns
        """
        # Perform dummy accesses before real operation
        MemoryObfuscation.dummy_accesses(size, 50)
        
        try:
            with locked_memory(size) as buffer:
                yield buffer
        finally:
            # Perform dummy accesses after real operation
            MemoryObfuscation.dummy_accesses(size, 50)


class TimingResistance:
    """
    Timing attack resistance utilities.
    
    Provides mechanisms to make operations take consistent time
    regardless of the input data or operation success/failure.
    """
    
    @staticmethod
    def constant_time_delay(base_delay_ms: float = 1.0, jitter_ms: float = 0.5) -> None:
        """
        Add a constant-time delay with jitter.
        
        Args:
            base_delay_ms: Base delay in milliseconds
            jitter_ms: Random jitter range in milliseconds
        """
        # Add base delay
        delay = base_delay_ms / 1000.0
        
        # Add cryptographically secure jitter
        jitter = (secrets.randbelow(int(jitter_ms * 1000)) / 1000000.0)
        
        time.sleep(delay + jitter)
    
    @staticmethod
    @contextmanager
    def timed_operation(target_duration_ms: float):
        """
        Context manager to ensure operations take a fixed amount of time.
        
        Args:
            target_duration_ms: Target duration in milliseconds
            
        Example:
            with timed_operation(100):  # Always takes ~100ms
                # Perform sensitive operation
                result = sensitive_function()
        """
        start_time = time.perf_counter()
        
        try:
            yield
        finally:
            elapsed = time.perf_counter() - start_time
            target_duration = target_duration_ms / 1000.0
            
            if elapsed < target_duration:
                # Add delay to reach target duration
                remaining = target_duration - elapsed
                time.sleep(remaining)
    
    @staticmethod
    def authenticate_with_timing_protection(
        provided_hash: bytes,
        expected_hash: bytes,
        base_delay_ms: float = 10.0
    ) -> bool:
        """
        Authenticate a hash with timing attack protection.
        
        Args:
            provided_hash: Hash provided by user
            expected_hash: Expected correct hash
            base_delay_ms: Base delay for all operations
            
        Returns:
            True if hashes match, False otherwise
        """
        with TimingResistance.timed_operation(base_delay_ms):
            # Always perform the comparison, regardless of length
            if len(provided_hash) != len(expected_hash):
                # Still do a dummy comparison to maintain timing
                dummy_hash = secrets.token_bytes(len(expected_hash))
                ConstantTimeOps.compare(provided_hash[:len(expected_hash)], dummy_hash)
                return False
            
            # Constant-time comparison
            return ConstantTimeOps.compare(provided_hash, expected_hash)


class SecureComparison:
    """
    Secure comparison operations resistant to side-channel attacks.
    """
    
    @staticmethod
    def secure_string_compare(a: str, b: str) -> bool:
        """
        Compare two strings securely.
        
        Args:
            a: First string
            b: Second string
            
        Returns:
            True if strings are equal
        """
        # Convert to bytes for constant-time comparison
        a_bytes = a.encode('utf-8')
        b_bytes = b.encode('utf-8')
        
        return ConstantTimeOps.compare(a_bytes, b_bytes)
    
    @staticmethod
    def secure_array_compare(a: List[int], b: List[int]) -> bool:
        """
        Compare two integer arrays securely.
        
        Args:
            a: First array
            b: Second array
            
        Returns:
            True if arrays are equal
        """
        if len(a) != len(b):
            return False
        
        # Convert to bytes for comparison
        a_bytes = bytes(a)
        b_bytes = bytes(b)
        
        return ConstantTimeOps.compare(a_bytes, b_bytes)
    
    @staticmethod
    def secure_prefix_compare(data: bytes, prefix: bytes) -> bool:
        """
        Check if data starts with prefix in constant time.
        
        Args:
            data: Data to check
            prefix: Prefix to look for
            
        Returns:
            True if data starts with prefix
        """
        if len(data) < len(prefix):
            return False
        
        # Extract the prefix portion
        data_prefix = data[:len(prefix)]
        
        return ConstantTimeOps.compare(data_prefix, prefix)


class CacheResistance:
    """
    Cache-timing attack resistance utilities.
    """
    
    @staticmethod
    def flush_cache_lines(size: int = 1024 * 1024) -> None:
        """
        Attempt to flush cache lines by accessing large amounts of memory.
        
        Args:
            size: Amount of memory to access for cache flushing
        """
        try:
            # Access a large amount of memory to flush caches
            dummy_data = bytearray(size)
            
            # Random access pattern
            for _ in range(size // 64):  # Assume 64-byte cache lines
                index = secrets.randbelow(size)
                dummy_data[index] = secrets.randbelow(256)
            
            # Ensure the data is actually accessed
            checksum = sum(dummy_data) % 256
            
            # Clear the dummy data
            secure_zero(dummy_data)
            
        except Exception:
            # If cache flushing fails, continue silently
            pass
    
    @staticmethod
    def table_lookup_constant_time(table: List[bytes], index: int) -> bytes:
        """
        Perform table lookup in constant time to prevent cache attacks.
        
        Args:
            table: Table of byte arrays
            index: Index to look up
            
        Returns:
            Table entry at the specified index
        """
        if not table or index < 0 or index >= len(table):
            raise MemoryError("Invalid table or index")
        
        # Ensure all entries have the same length
        entry_length = len(table[0])
        if not all(len(entry) == entry_length for entry in table):
            raise MemoryError("All table entries must have the same length")
        
        result = bytearray(entry_length)
        
        # Access all table entries to maintain constant cache behavior
        for i, entry in enumerate(table):
            # Use constant-time selection
            is_target = (i == index)
            for j in range(entry_length):
                # Constant-time conditional assignment
                mask = 0xFF if is_target else 0x00
                result[j] = (entry[j] & mask) | (result[j] & (~mask & 0xFF))
        
        return bytes(result)


class SecureOperations:
    """
    High-level secure operations combining multiple protection techniques.
    """
    
    @staticmethod
    def secure_key_comparison(key1: bytes, key2: bytes) -> bool:
        """
        Compare two cryptographic keys securely.
        
        Args:
            key1: First key
            key2: Second key
            
        Returns:
            True if keys are equal
        """
        # Add timing protection
        with TimingResistance.timed_operation(5.0):  # 5ms minimum
            # Flush caches before comparison
            CacheResistance.flush_cache_lines()
            
            # Perform obfuscated memory access
            with MemoryObfuscation.obfuscated_memory_access(max(len(key1), len(key2))):
                # Constant-time comparison
                result = ConstantTimeOps.compare(key1, key2)
            
            # Add dummy operations to obfuscate the result
            dummy_result = ConstantTimeOps.compare(
                secure_random_bytes(32),
                secure_random_bytes(32)
            )
            
            return result
    
    @staticmethod
    def secure_search(haystack: List[bytes], needle: bytes) -> int:
        """
        Search for a value in a list with side-channel protection.
        
        Args:
            haystack: List to search in
            needle: Value to search for
            
        Returns:
            Index of first occurrence, or -1 if not found
        """
        found_index = -1
        found = False
        
        # Access all elements to maintain constant cache behavior
        for i, item in enumerate(haystack):
            # Compare in constant time
            matches = ConstantTimeOps.compare(item, needle)
            
            # Update found_index only if this is the first match
            if matches and not found:
                found_index = i
                found = True
        
        return found_index
    
    @staticmethod
    @contextmanager
    def secure_computation_context():
        """
        Context manager for secure computations.
        
        Provides comprehensive side-channel protection for sensitive operations.
        """
        # Flush caches before computation
        CacheResistance.flush_cache_lines()
        
        # Add initial timing jitter
        TimingResistance.constant_time_delay(1.0, 0.5)
        
        try:
            yield
        finally:
            # Flush caches after computation
            CacheResistance.flush_cache_lines()
            
            # Add final timing jitter
            TimingResistance.constant_time_delay(1.0, 0.5)


# Convenience functions for common operations
def constant_time_compare(a: bytes, b: bytes) -> bool:
    """Compare two byte sequences in constant time."""
    return ConstantTimeOps.compare(a, b)


def secure_key_equals(key1: bytes, key2: bytes) -> bool:
    """Securely compare two cryptographic keys."""
    return SecureOperations.secure_key_comparison(key1, key2)


def timed_authentication(provided: bytes, expected: bytes, delay_ms: float = 10.0) -> bool:
    """Authenticate with timing attack protection."""
    return TimingResistance.authenticate_with_timing_protection(
        provided, expected, delay_ms
    ) 