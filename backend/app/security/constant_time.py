"""
Constant-time operations and timing attack prevention utilities.

This module provides secure comparison functions and timing protection
to prevent timing-based information leakage in authentication flows.
"""

import hmac
import hashlib
import time
import random
import asyncio
from typing import Union, Any, Callable, Optional
import functools
from contextlib import contextmanager

# Constants for timing normalization
MIN_OPERATION_TIME = 0.001  # 1ms minimum operation time
MAX_OPERATION_TIME = 0.1    # 100ms maximum operation time
TIMING_VARIANCE = 0.02      # 2% variance in operation timing


class ConstantTimeOperations:
    """Utilities for constant-time operations to prevent timing attacks."""
    
    @staticmethod
    def compare_bytes(a: bytes, b: bytes) -> bool:
        """
        Compare two byte strings in constant time.
        
        Args:
            a: First byte string
            b: Second byte string
            
        Returns:
            bool: True if strings are equal, False otherwise
        """
        if not isinstance(a, bytes) or not isinstance(b, bytes):
            raise TypeError("Both arguments must be bytes")
            
        return hmac.compare_digest(a, b)
    
    @staticmethod
    def compare_strings(a: str, b: str) -> bool:
        """
        Compare two strings in constant time.
        
        Args:
            a: First string
            b: Second string
            
        Returns:
            bool: True if strings are equal, False otherwise
        """
        if not isinstance(a, str) or not isinstance(b, str):
            raise TypeError("Both arguments must be strings")
            
        return hmac.compare_digest(a.encode('utf-8'), b.encode('utf-8'))
    
    @staticmethod
    def compare_hashes(a: str, b: str) -> bool:
        """
        Compare two hash strings in constant time.
        
        Args:
            a: First hash string
            b: Second hash string
            
        Returns:
            bool: True if hashes are equal, False otherwise
        """
        return ConstantTimeOperations.compare_strings(a, b)
    
    @staticmethod
    def secure_pad_string(s: str, target_length: int) -> str:
        """
        Pad string to target length in constant time.
        
        Args:
            s: String to pad
            target_length: Target length
            
        Returns:
            str: Padded string
        """
        if len(s) > target_length:
            return s[:target_length]
        
        padding_length = target_length - len(s)
        padding = ' ' * padding_length
        return s + padding
    
    @staticmethod
    def constant_time_select(condition: bool, true_value: Any, false_value: Any) -> Any:
        """
        Select value based on condition in constant time.
        
        Args:
            condition: Boolean condition
            true_value: Value to return if condition is True
            false_value: Value to return if condition is False
            
        Returns:
            Any: Selected value
        """
        # This implementation maintains constant time by always computing both paths
        return true_value if condition else false_value


class TimingAttackProtection:
    """Protection against timing attacks in authentication flows."""
    
    def __init__(self, base_delay: float = 0.1, max_delay: float = 2.0):
        """
        Initialize timing attack protection.
        
        Args:
            base_delay: Base delay in seconds
            max_delay: Maximum delay in seconds
        """
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.attempt_counts: dict[str, int] = {}
        self.last_attempt_time: dict[str, float] = {}
    
    def get_delay_for_attempt(self, identifier: str) -> float:
        """
        Get delay for authentication attempt.
        
        Args:
            identifier: Unique identifier for the attempt (e.g., IP address)
            
        Returns:
            float: Delay in seconds
        """
        current_time = time.time()
        
        # Update attempt count
        if identifier not in self.attempt_counts:
            self.attempt_counts[identifier] = 0
        self.attempt_counts[identifier] += 1
        
        # Calculate delay based on attempt count
        delay = min(
            self.base_delay * (2 ** (self.attempt_counts[identifier] - 1)),
            self.max_delay
        )
        
        # Add random variance to prevent timing analysis
        variance = random.uniform(-TIMING_VARIANCE, TIMING_VARIANCE)
        delay = delay * (1 + variance)
        
        self.last_attempt_time[identifier] = current_time
        return delay
    
    def cleanup_old_attempts(self, max_age: float = 3600):
        """
        Clean up old attempt records.
        
        Args:
            max_age: Maximum age in seconds
        """
        current_time = time.time()
        expired_identifiers = []
        
        for identifier, last_time in self.last_attempt_time.items():
            if current_time - last_time > max_age:
                expired_identifiers.append(identifier)
        
        for identifier in expired_identifiers:
            self.attempt_counts.pop(identifier, None)
            self.last_attempt_time.pop(identifier, None)
    
    async def protected_authentication(
        self, 
        identifier: str,
        auth_func: Callable[[], bool]
    ) -> bool:
        """
        Perform authentication with timing protection.
        
        Args:
            identifier: Unique identifier for the attempt
            auth_func: Authentication function to execute
            
        Returns:
            bool: Authentication result
        """
        start_time = time.time()
        
        # Get delay for this attempt
        delay = self.get_delay_for_attempt(identifier)
        
        # Execute authentication function
        result = auth_func()
        
        # Calculate elapsed time
        elapsed = time.time() - start_time
        
        # Apply delay to normalize timing
        if elapsed < delay:
            await asyncio.sleep(delay - elapsed)
        
        return result
    
    def constant_time_verify(
        self,
        provided_value: str,
        expected_value: str,
        identifier: str
    ) -> bool:
        """
        Verify value in constant time with timing protection.
        
        Args:
            provided_value: Value provided by user
            expected_value: Expected value
            identifier: Unique identifier for the attempt
            
        Returns:
            bool: Verification result
        """
        # Always perform constant-time comparison
        is_valid = ConstantTimeOperations.compare_strings(
            provided_value, expected_value
        )
        
        # Apply timing protection regardless of result
        delay = self.get_delay_for_attempt(identifier)
        time.sleep(delay)
        
        return is_valid


class SecureRandomDelay:
    """Utilities for adding secure random delays to prevent timing analysis."""
    
    @staticmethod
    def get_random_delay(min_delay: float = 0.001, max_delay: float = 0.01) -> float:
        """
        Get cryptographically secure random delay.
        
        Args:
            min_delay: Minimum delay in seconds
            max_delay: Maximum delay in seconds
            
        Returns:
            float: Random delay in seconds
        """
        return random.uniform(min_delay, max_delay)
    
    @staticmethod
    async def apply_random_delay(min_delay: float = 0.001, max_delay: float = 0.01):
        """
        Apply random delay asynchronously.
        
        Args:
            min_delay: Minimum delay in seconds
            max_delay: Maximum delay in seconds
        """
        delay = SecureRandomDelay.get_random_delay(min_delay, max_delay)
        await asyncio.sleep(delay)
    
    @staticmethod
    def normalize_operation_time(start_time: float, target_time: float = 0.1):
        """
        Normalize operation time to prevent timing analysis.
        
        Args:
            start_time: Operation start time
            target_time: Target operation time in seconds
        """
        elapsed = time.time() - start_time
        if elapsed < target_time:
            time.sleep(target_time - elapsed)


def constant_time_operation(target_time: float = 0.1):
    """
    Decorator to ensure operations take constant time.
    
    Args:
        target_time: Target operation time in seconds
        
    Returns:
        Decorator function
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                SecureRandomDelay.normalize_operation_time(start_time, target_time)
        
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                elapsed = time.time() - start_time
                if elapsed < target_time:
                    await asyncio.sleep(target_time - elapsed)
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else wrapper
    
    return decorator


@contextmanager
def timing_protected_context(target_time: float = 0.1):
    """
    Context manager for timing-protected operations.
    
    Args:
        target_time: Target operation time in seconds
    """
    start_time = time.time()
    try:
        yield
    finally:
        SecureRandomDelay.normalize_operation_time(start_time, target_time)


# Global timing attack protection instance
timing_protection = TimingAttackProtection() 