"""
OPAQUE Zero-Knowledge Cryptographic Utilities

This module provides the core cryptographic functions required for the OPAQUE
zero-knowledge authentication system, including:

- Argon2id memory-hard password stretching
- HKDF-SHA-256 key derivation 
- BLAKE2s fast hashing for TagID generation
- Secure memory management utilities
"""

from .argon2 import argon2id_hash, Argon2Config
from .hkdf import hkdf_expand, hkdf_extract_and_expand
from .blake2 import blake2s_hash
from .config import CryptoConfig, get_crypto_config
from .errors import (
    CryptoError,
    InvalidInputError,
    KeyDerivationError,
    HashingError,
    MemoryError
)
from .memory import SecureMemory, secure_zero, constant_time_compare
from .secure_memory import (
    locked_memory,
    get_memory_stats,
    is_memory_locking_available,
    register_cleanup_handler,
    MemoryStats,
    MemoryLockStatus
)
from .key_manager import (
    KeyType,
    KeyStatus,
    KeyMetadata,
    SecureKeyStore,
    SessionKeyManager,
    secure_key_context,
    store_key,
    get_key,
    revoke_key,
    create_session,
    store_session_key,
    get_session_key,
    end_session
)
from .secure_ops import (
    ConstantTimeOps,
    MemoryObfuscation,
    TimingResistance,
    SecureComparison,
    CacheResistance,
    SecureOperations,
    secure_key_equals,
    timed_authentication
)
from .key_derivation import (
    OpaqueKeys,
    derive_opaque_keys_from_phrase,
    derive_opaque_keys_with_known_salt,
    verify_tag_id_matches_phrase,
    benchmark_key_derivation,
    validate_opaque_keys
)
from .opaque_keys import (
    SecretTag,
    create_secret_tag,
    authenticate_secret_phrase,
    find_matching_tag_id,
    validate_secret_tag,
    export_secret_tag_for_backup,
    import_secret_tag_from_backup,
    get_performance_profile
)
from .aes_kw import (
    AESKeyWrap,
    AESKeyWrapError,
    wrap_key,
    unwrap_key,
    generate_data_key,
    validate_wrapped_key,
    get_unwrapped_key_size
)
from .vault_keys import (
    VaultKeyError,
    WrappedVaultKey,
    VaultKeyManager,
    create_vault_key_for_phrase,
    unwrap_vault_key_with_phrase,
    vault_key_context
)

__all__ = [
    # Core functions
    "argon2id_hash",
    "hkdf_expand", 
    "hkdf_extract_and_expand",
    "blake2s_hash",
    
    # Key derivation
    "OpaqueKeys",
    "derive_opaque_keys_from_phrase",
    "derive_opaque_keys_with_known_salt", 
    "verify_tag_id_matches_phrase",
    "benchmark_key_derivation",
    "validate_opaque_keys",
    
    # High-level interface
    "SecretTag",
    "create_secret_tag",
    "authenticate_secret_phrase",
    "find_matching_tag_id",
    "validate_secret_tag",
    "export_secret_tag_for_backup",
    "import_secret_tag_from_backup",
    "get_performance_profile",
    
    # Configuration
    "Argon2Config",
    "CryptoConfig",
    "get_crypto_config",
    
    # Memory management
    "SecureMemory",
    "secure_zero",
    "constant_time_compare",
    
    # Advanced secure memory
    "locked_memory",
    "get_memory_stats",
    "is_memory_locking_available",
    "register_cleanup_handler",
    "MemoryStats",
    "MemoryLockStatus",
    
    # Key lifecycle management
    "KeyType",
    "KeyStatus", 
    "KeyMetadata",
    "SecureKeyStore",
    "SessionKeyManager",
    "secure_key_context",
    "store_key",
    "get_key",
    "revoke_key",
    "create_session",
    "store_session_key",
    "get_session_key",
    "end_session",
    
    # Secure operations
    "ConstantTimeOps",
    "MemoryObfuscation",
    "TimingResistance",
    "SecureComparison",
    "CacheResistance", 
    "SecureOperations",
    "secure_key_equals",
    "timed_authentication",
    
    # AES Key Wrap
    "AESKeyWrap",
    "AESKeyWrapError",
    "wrap_key",
    "unwrap_key",
    "generate_data_key",
    "validate_wrapped_key",
    "get_unwrapped_key_size",
    
    # Vault Key Management
    "VaultKeyError",
    "WrappedVaultKey",
    "VaultKeyManager",
    "create_vault_key_for_phrase",
    "unwrap_vault_key_with_phrase",
    "vault_key_context",
    
    # Errors
    "CryptoError",
    "InvalidInputError", 
    "KeyDerivationError",
    "HashingError",
    "MemoryError",
] 