"""
Cryptographic Configuration Management

Provides configuration classes and utilities for managing cryptographic
parameters across different environments (development, mobile, production).
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional
import os


class Environment(Enum):
    """Target environment for cryptographic operations."""
    DEVELOPMENT = "development"
    MOBILE = "mobile"
    PRODUCTION = "production"


@dataclass(frozen=True)
class Argon2Config:
    """Configuration for Argon2id password hashing."""
    
    # Memory usage in bytes
    memory_cost: int
    
    # Number of iterations
    time_cost: int
    
    # Degree of parallelism
    parallelism: int
    
    # Output length in bytes
    hash_length: int = 32
    
    # Salt length in bytes
    salt_length: int = 16
    
    @classmethod
    def for_environment(cls, env: Environment) -> "Argon2Config":
        """Get Argon2 configuration for specific environment."""
        
        if env == Environment.DEVELOPMENT:
            # Fast parameters for development
            return cls(
                memory_cost=1024 * 16,  # 16 MiB
                time_cost=1,
                parallelism=1,
            )
        elif env == Environment.MOBILE:
            # Mobile-optimized parameters (RFC draft recommended for memory-constrained)
            return cls(
                memory_cost=1024 * 64,  # 64 MiB
                time_cost=1,
                parallelism=4,
            )
        elif env == Environment.PRODUCTION:
            # Production security parameters
            return cls(
                memory_cost=1024 * 64,  # 64 MiB
                time_cost=3,
                parallelism=4,
            )
        else:
            raise ValueError(f"Unknown environment: {env}")


@dataclass(frozen=True)
class CryptoConfig:
    """Overall cryptographic configuration."""
    
    # Argon2id configuration
    argon2: Argon2Config
    
    # HKDF output length in bytes
    hkdf_length: int = 32
    
    # BLAKE2s output length for TagID (16 bytes = 128 bits)
    tagid_length: int = 16
    
    # Environment this config is for
    environment: Environment = Environment.PRODUCTION
    
    @classmethod
    def for_environment(cls, env: Environment) -> "CryptoConfig":
        """Create crypto configuration for specific environment."""
        return cls(
            argon2=Argon2Config.for_environment(env),
            environment=env,
        )


# Global configuration instance
_crypto_config: Optional[CryptoConfig] = None


def get_crypto_config() -> CryptoConfig:
    """Get the current cryptographic configuration."""
    global _crypto_config
    
    if _crypto_config is None:
        # Determine environment from environment variable
        env_name = os.getenv("CRYPTO_ENVIRONMENT", "production").lower()
        
        try:
            env = Environment(env_name)
        except ValueError:
            # Default to production for unknown environments
            env = Environment.PRODUCTION
        
        _crypto_config = CryptoConfig.for_environment(env)
    
    return _crypto_config


def set_crypto_config(config: CryptoConfig) -> None:
    """Set the global cryptographic configuration."""
    global _crypto_config
    _crypto_config = config


def reset_crypto_config() -> None:
    """Reset the global cryptographic configuration."""
    global _crypto_config
    _crypto_config = None 