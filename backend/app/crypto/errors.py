"""
Cryptographic Error Classes

Custom exception classes for cryptographic operations to provide
clear error handling and debugging information.
"""

from typing import Optional


class CryptoError(Exception):
    """Base exception for all cryptographic operations."""
    
    def __init__(self, message: str, operation: Optional[str] = None):
        self.operation = operation
        super().__init__(message)
    
    def __str__(self) -> str:
        if self.operation:
            return f"Crypto error in {self.operation}: {super().__str__()}"
        return super().__str__()


class InvalidInputError(CryptoError):
    """Raised when cryptographic function receives invalid input."""
    
    def __init__(self, message: str, parameter: Optional[str] = None):
        self.parameter = parameter
        operation = f"input validation ({parameter})" if parameter else "input validation"
        super().__init__(message, operation)


class KeyDerivationError(CryptoError):
    """Raised when key derivation operations fail."""
    
    def __init__(self, message: str, algorithm: Optional[str] = None):
        operation = f"key derivation ({algorithm})" if algorithm else "key derivation"
        super().__init__(message, operation)


class HashingError(CryptoError):
    """Raised when hashing operations fail."""
    
    def __init__(self, message: str, algorithm: Optional[str] = None):
        operation = f"hashing ({algorithm})" if algorithm else "hashing"
        super().__init__(message, operation)


class MemoryError(CryptoError):
    """Raised when secure memory operations fail."""
    
    def __init__(self, message: str):
        super().__init__(message, "memory management") 