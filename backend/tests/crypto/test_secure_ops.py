"""
Tests for Secure Operations with Side-Channel Protection

Tests constant-time operations, memory access pattern obfuscation,
timing attack resistance, and comprehensive side-channel protection.
"""

import pytest
import time
from unittest.mock import patch, MagicMock

from backend.app.crypto.secure_ops import (
    ConstantTimeOps,
    MemoryObfuscation,
    TimingResistance,
    SecureComparison,
    CacheResistance,
    SecureOperations,
    constant_time_compare,
    secure_key_equals,
    timed_authentication
)
from backend.app.crypto.memory import secure_random_bytes
from backend.app.crypto.errors import MemoryError


class TestConstantTimeOps:
    """Test constant-time operations."""
    
    def test_constant_time_compare_equal(self):
        """Test constant-time comparison with equal data."""
        data1 = b"Hello, World!"
        data2 = b"Hello, World!"
        
        result = ConstantTimeOps.compare(data1, data2)
        assert result is True
    
    def test_constant_time_compare_different(self):
        """Test constant-time comparison with different data."""
        data1 = b"Hello, World!"
        data2 = b"Hello, world!"  # Different case
        
        result = ConstantTimeOps.compare(data1, data2)
        assert result is False
    
    def test_constant_time_compare_different_lengths(self):
        """Test constant-time comparison with different lengths."""
        data1 = b"Hello"
        data2 = b"Hello, World!"
        
        result = ConstantTimeOps.compare(data1, data2)
        assert result is False
    
    def test_constant_time_compare_empty(self):
        """Test constant-time comparison with empty data."""
        data1 = b""
        data2 = b""
        
        result = ConstantTimeOps.compare(data1, data2)
        assert result is True
    
    def test_constant_time_select(self):
        """Test constant-time selection between values."""
        true_value = b"secret_key_1"
        false_value = b"secret_key_2"
        
        # Select true value
        result = ConstantTimeOps.select(True, true_value, false_value)
        assert result == true_value
        
        # Select false value
        result = ConstantTimeOps.select(False, true_value, false_value)
        assert result == false_value
    
    def test_constant_time_select_different_lengths(self):
        """Test constant-time selection with different length values."""
        true_value = b"short"
        false_value = b"much_longer_value"
        
        with pytest.raises(MemoryError):
            ConstantTimeOps.select(True, true_value, false_value)
    
    def test_conditional_copy(self):
        """Test conditional copy operation."""
        source = b"new_data"
        dest = bytearray(b"old_data")
        
        # Copy when condition is True
        ConstantTimeOps.conditional_copy(True, source, dest)
        assert bytes(dest) == source
        
        # Reset destination
        dest[:] = b"old_data"
        
        # Don't copy when condition is False
        ConstantTimeOps.conditional_copy(False, source, dest)
        assert bytes(dest) == b"old_data"
    
    def test_conditional_copy_different_lengths(self):
        """Test conditional copy with different lengths."""
        source = b"short"
        dest = bytearray(b"much_longer")
        
        with pytest.raises(MemoryError):
            ConstantTimeOps.conditional_copy(True, source, dest)
    
    def test_find_byte(self):
        """Test constant-time byte finding."""
        haystack = b"Hello, World!"
        
        # Find existing byte
        index = ConstantTimeOps.find_byte(haystack, ord('W'))
        assert index == 7
        
        # Find first occurrence
        index = ConstantTimeOps.find_byte(haystack, ord('l'))
        assert index == 2  # First 'l' in "Hello"
        
        # Find non-existing byte
        index = ConstantTimeOps.find_byte(haystack, ord('z'))
        assert index == -1
    
    def test_xor_arrays(self):
        """Test constant-time XOR operation."""
        array1 = b"\x01\x02\x03\x04"
        array2 = b"\x05\x06\x07\x08"
        expected = bytes([0x01^0x05, 0x02^0x06, 0x03^0x07, 0x04^0x08])
        
        result = ConstantTimeOps.xor_arrays(array1, array2)
        assert result == expected
    
    def test_xor_arrays_different_lengths(self):
        """Test XOR with different length arrays."""
        array1 = b"\x01\x02"
        array2 = b"\x05\x06\x07\x08"
        
        with pytest.raises(MemoryError):
            ConstantTimeOps.xor_arrays(array1, array2)


class TestMemoryObfuscation:
    """Test memory access pattern obfuscation."""
    
    def test_dummy_accesses(self):
        """Test dummy memory accesses."""
        # This should complete without error
        MemoryObfuscation.dummy_accesses(1024, 10)
    
    def test_shuffle_access_order(self):
        """Test access order shuffling."""
        indices = list(range(100))
        original = indices.copy()
        
        shuffled = MemoryObfuscation.shuffle_access_order(indices)
        
        # Original should be unchanged
        assert indices == original
        
        # Shuffled should have same elements but different order
        assert set(shuffled) == set(original)
        assert len(shuffled) == len(original)
        
        # Should be shuffled (very unlikely to be same order)
        assert shuffled != original
    
    def test_shuffle_empty_list(self):
        """Test shuffling empty list."""
        indices = []
        shuffled = MemoryObfuscation.shuffle_access_order(indices)
        assert shuffled == []
    
    def test_shuffle_single_element(self):
        """Test shuffling single element list."""
        indices = [42]
        shuffled = MemoryObfuscation.shuffle_access_order(indices)
        assert shuffled == [42]
    
    def test_obfuscated_memory_access(self):
        """Test obfuscated memory access context manager."""
        with MemoryObfuscation.obfuscated_memory_access(1024) as buffer:
            assert len(buffer) == 1024
            
            # Write some data
            test_data = b"sensitive_data"
            buffer[:len(test_data)] = test_data
            
            # Verify data
            assert bytes(buffer[:len(test_data)]) == test_data


class TestTimingResistance:
    """Test timing attack resistance."""
    
    def test_constant_time_delay(self):
        """Test constant-time delay."""
        start_time = time.perf_counter()
        
        TimingResistance.constant_time_delay(10.0, 1.0)  # 10ms ± 1ms
        
        elapsed = time.perf_counter() - start_time
        
        # Should take at least 10ms
        assert elapsed >= 0.009  # Allow for small timing variations
        
        # Should not take too long (10ms + 1ms jitter + overhead)
        assert elapsed <= 0.020
    
    def test_timed_operation(self):
        """Test timed operation context manager."""
        target_duration = 50.0  # 50ms
        
        start_time = time.perf_counter()
        
        with TimingResistance.timed_operation(target_duration):
            # Do some quick work
            _ = sum(range(1000))
        
        elapsed = time.perf_counter() - start_time
        
        # Should take at least the target duration
        assert elapsed >= (target_duration / 1000.0) - 0.005  # Allow for timing variations
    
    def test_timed_operation_with_slow_work(self):
        """Test timed operation with work that takes longer than target."""
        target_duration = 10.0  # 10ms
        
        start_time = time.perf_counter()
        
        with TimingResistance.timed_operation(target_duration):
            # Do work that takes longer than target
            time.sleep(0.020)  # 20ms
        
        elapsed = time.perf_counter() - start_time
        
        # Should take at least the work time (20ms)
        assert elapsed >= 0.018
    
    def test_authenticate_with_timing_protection(self):
        """Test authentication with timing protection."""
        correct_phrase_hash= secure_random_bytes(32)
        wrong_phrase_hash= secure_random_bytes(32)
        
        # Correct authentication
        start_time = time.perf_counter()
        result = TimingResistance.authenticate_with_timing_protection(
            correct_hash, correct_hash, base_delay_ms=10.0
        )
        elapsed1 = time.perf_counter() - start_time
        
        assert result is True
        assert elapsed1 >= 0.008  # Should take at least the base delay
        
        # Incorrect authentication
        start_time = time.perf_counter()
        result = TimingResistance.authenticate_with_timing_protection(
            wrong_hash, correct_hash, base_delay_ms=10.0
        )
        elapsed2 = time.perf_counter() - start_time
        
        assert result is False
        assert elapsed2 >= 0.008  # Should take at least the base delay
        
        # Timing should be similar for both cases
        time_diff = abs(elapsed1 - elapsed2)
        assert time_diff < 0.005  # Should be within 5ms of each other
    
    def test_authenticate_different_lengths(self):
        """Test authentication with different length hashes."""
        correct_phrase_hash= secure_random_bytes(32)
        wrong_length_phrase_hash= secure_random_bytes(16)
        
        result = TimingResistance.authenticate_with_timing_protection(
            wrong_length_hash, correct_hash, base_delay_ms=10.0
        )
        
        assert result is False


class TestSecureComparison:
    """Test secure comparison operations."""
    
    def test_secure_string_compare(self):
        """Test secure string comparison."""
        string1 = "Hello, World!"
        string2 = "Hello, World!"
        string3 = "Hello, world!"
        
        assert SecureComparison.secure_string_compare(string1, string2) is True
        assert SecureComparison.secure_string_compare(string1, string3) is False
    
    def test_secure_string_compare_unicode(self):
        """Test secure string comparison with Unicode."""
        string1 = "Héllo, Wörld! 🌍"
        string2 = "Héllo, Wörld! 🌍"
        string3 = "Hello, World!"
        
        assert SecureComparison.secure_string_compare(string1, string2) is True
        assert SecureComparison.secure_string_compare(string1, string3) is False
    
    def test_secure_array_compare(self):
        """Test secure array comparison."""
        array1 = [1, 2, 3, 4, 5]
        array2 = [1, 2, 3, 4, 5]
        array3 = [1, 2, 3, 4, 6]
        array4 = [1, 2, 3, 4]  # Different length
        
        assert SecureComparison.secure_array_compare(array1, array2) is True
        assert SecureComparison.secure_array_compare(array1, array3) is False
        assert SecureComparison.secure_array_compare(array1, array4) is False
    
    def test_secure_prefix_compare(self):
        """Test secure prefix comparison."""
        data = b"Hello, World! This is a test."
        prefix1 = b"Hello"
        prefix2 = b"World"
        prefix3 = b"Hello, World! This is a test. And more."
        
        assert SecureComparison.secure_prefix_compare(data, prefix1) is True
        assert SecureComparison.secure_prefix_compare(data, prefix2) is False
        assert SecureComparison.secure_prefix_compare(data, prefix3) is False


class TestCacheResistance:
    """Test cache-timing attack resistance."""
    
    def test_flush_cache_lines(self):
        """Test cache line flushing."""
        # This should complete without error
        CacheResistance.flush_cache_lines(1024)
        CacheResistance.flush_cache_lines(1024 * 1024)
    
    def test_table_lookup_constant_time(self):
        """Test constant-time table lookup."""
        table = [
            b"entry_0",
            b"entry_1", 
            b"entry_2",
            b"entry_3"
        ]
        
        # Test valid lookups
        for i in range(len(table)):
            result = CacheResistance.table_lookup_constant_time(table, i)
            assert result == table[i]
    
    def test_table_lookup_invalid_index(self):
        """Test table lookup with invalid index."""
        table = [b"entry_0", b"entry_1"]
        
        with pytest.raises(MemoryError):
            CacheResistance.table_lookup_constant_time(table, -1)
        
        with pytest.raises(MemoryError):
            CacheResistance.table_lookup_constant_time(table, 2)
    
    def test_table_lookup_empty_table(self):
        """Test table lookup with empty table."""
        table = []
        
        with pytest.raises(MemoryError):
            CacheResistance.table_lookup_constant_time(table, 0)
    
    def test_table_lookup_inconsistent_lengths(self):
        """Test table lookup with inconsistent entry lengths."""
        table = [
            b"short",
            b"much_longer_entry"
        ]
        
        with pytest.raises(MemoryError):
            CacheResistance.table_lookup_constant_time(table, 0)


class TestSecureOperations:
    """Test high-level secure operations."""
    
    def test_secure_key_comparison(self):
        """Test secure key comparison."""
        key1 = secure_random_bytes(32)
        key2 = secure_random_bytes(32)
        key3 = key1  # Same reference
        
        # Same key should be equal
        assert SecureOperations.secure_key_comparison(key1, key3) is True
        
        # Different keys should not be equal
        assert SecureOperations.secure_key_comparison(key1, key2) is False
    
    def test_secure_key_comparison_timing(self):
        """Test that secure key comparison has consistent timing."""
        key1 = secure_random_bytes(32)
        key2 = secure_random_bytes(32)
        key3 = key1
        
        # Time equal comparison
        start_time = time.perf_counter()
        result1 = SecureOperations.secure_key_comparison(key1, key3)
        elapsed1 = time.perf_counter() - start_time
        
        # Time unequal comparison
        start_time = time.perf_counter()
        result2 = SecureOperations.secure_key_comparison(key1, key2)
        elapsed2 = time.perf_counter() - start_time
        
        assert result1 is True
        assert result2 is False
        
        # Both should take at least 5ms (the minimum timing)
        assert elapsed1 >= 0.004
        assert elapsed2 >= 0.004
    
    def test_secure_search(self):
        """Test secure search in list."""
        haystack = [
            b"item_0",
            b"item_1",
            b"target",
            b"item_3"
        ]
        
        # Find existing item
        index = SecureOperations.secure_search(haystack, b"target")
        assert index == 2
        
        # Find first occurrence
        haystack_with_duplicates = [
            b"item_0",
            b"duplicate",
            b"item_2", 
            b"duplicate"
        ]
        index = SecureOperations.secure_search(haystack_with_duplicates, b"duplicate")
        assert index == 1
        
        # Item not found
        index = SecureOperations.secure_search(haystack, b"not_found")
        assert index == -1
    
    def test_secure_computation_context(self):
        """Test secure computation context manager."""
        result = None
        
        with SecureOperations.secure_computation_context():
            # Perform some computation
            result = sum(range(1000))
        
        assert result == sum(range(1000))


class TestConvenienceFunctions:
    """Test convenience functions."""
    
    def test_constant_time_compare_function(self):
        """Test global constant_time_compare function."""
        data1 = b"test_data"
        data2 = b"test_data"
        data3 = b"different"
        
        assert constant_time_compare(data1, data2) is True
        assert constant_time_compare(data1, data3) is False
    
    def test_secure_key_equals_function(self):
        """Test global secure_key_equals function."""
        key1 = secure_random_bytes(32)
        key2 = secure_random_bytes(32)
        key3 = key1
        
        assert secure_key_equals(key1, key3) is True
        assert secure_key_equals(key1, key2) is False
    
    def test_timed_authentication_function(self):
        """Test global timed_authentication function."""
        correct_phrase_hash= secure_random_bytes(32)
        wrong_phrase_hash= secure_random_bytes(32)
        
        # Test correct authentication
        start_time = time.perf_counter()
        result = timed_authentication(correct_hash, correct_hash, delay_ms=10.0)
        elapsed = time.perf_counter() - start_time
        
        assert result is True
        assert elapsed >= 0.008  # Should take at least the delay
        
        # Test incorrect authentication
        result = timed_authentication(wrong_hash, correct_hash, delay_ms=10.0)
        assert result is False


class TestErrorConditions:
    """Test error conditions and edge cases."""
    
    def test_empty_data_operations(self):
        """Test operations with empty data."""
        empty = b""
        data = b"test"
        
        # Empty data comparisons should work
        assert ConstantTimeOps.compare(empty, empty) is True
        assert ConstantTimeOps.compare(empty, data) is False
        
        # XOR with empty should fail
        with pytest.raises(MemoryError):
            ConstantTimeOps.xor_arrays(empty, data)
    
    def test_large_data_operations(self):
        """Test operations with large data."""
        large_data1 = secure_random_bytes(1024 * 1024)  # 1MB
        large_data2 = secure_random_bytes(1024 * 1024)  # 1MB
        
        # Should handle large data without issues
        result = ConstantTimeOps.compare(large_data1, large_data1)
        assert result is True
        
        result = ConstantTimeOps.compare(large_data1, large_data2)
        assert result is False
    
    def test_timing_edge_cases(self):
        """Test timing operations with edge cases."""
        # Zero delay should still work
        TimingResistance.constant_time_delay(0.0, 0.0)
        
        # Very small delay
        start_time = time.perf_counter()
        TimingResistance.constant_time_delay(0.1, 0.0)
        elapsed = time.perf_counter() - start_time
        
        # Should take at least the requested time
        assert elapsed >= 0.0001


class TestIntegration:
    """Integration tests for secure operations."""
    
    def test_full_secure_workflow(self):
        """Test complete secure operations workflow."""
        # Generate test keys
        key1 = secure_random_bytes(32)
        key2 = secure_random_bytes(32)
        
        with SecureOperations.secure_computation_context():
            # Perform secure comparison
            result1 = secure_key_equals(key1, key1)
            result2 = secure_key_equals(key1, key2)
            
            # Perform timed authentication
            auth_result = timed_authentication(key1, key1, delay_ms=5.0)
            
            # Perform constant-time operations
            xor_result = ConstantTimeOps.xor_arrays(key1, key2)
            
            # Verify results
            assert result1 is True
            assert result2 is False
            assert auth_result is True
            assert len(xor_result) == 32
    
    def test_concurrent_secure_operations(self):
        """Test concurrent secure operations."""
        import threading
        
        results = []
        
        def worker():
            key1 = secure_random_bytes(32)
            key2 = secure_random_bytes(32)
            
            # Perform secure operations
            result = secure_key_equals(key1, key1)
            results.append(result)
            
            # Perform timed authentication
            auth_result = timed_authentication(key1, key1, delay_ms=1.0)
            results.append(auth_result)
        
        # Start multiple workers
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=worker)
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # All operations should succeed
        assert all(results)
        assert len(results) == 10  # 2 results per worker × 5 workers


if __name__ == "__main__":
    pytest.main([__file__]) 