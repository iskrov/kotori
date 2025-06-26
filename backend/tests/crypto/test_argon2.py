"""
Unit tests for Argon2id password hashing implementation.
"""

import pytest
from app.crypto.argon2 import argon2id_hash, verify_argon2id_hash, benchmark_argon2id
from app.crypto.config import Argon2Config, Environment
from app.crypto.errors import InvalidInputError, KeyDerivationError


class TestArgon2idHash:
    """Test cases for Argon2id hashing function."""
    
    def test_basic_hashing(self):
        """Test basic password hashing functionality."""
        password = b"test_password"
        hash_value, salt = argon2id_hash(password)
        
        # Verify output properties
        assert len(hash_value) == 32  # Default hash length
        assert len(salt) == 16  # Default salt length
        assert isinstance(hash_value, bytes)
        assert isinstance(salt, bytes)
    
    def test_deterministic_with_same_salt(self):
        """Test that same password and salt produce same hash."""
        password = b"test_password"
        salt = b"fixed_salt_16byt"
        
        hash1, _ = argon2id_hash(password, salt)
        hash2, _ = argon2id_hash(password, salt)
        
        assert hash1 == hash2
    
    def test_different_passwords_different_hashes(self):
        """Test that different passwords produce different hashes."""
        salt = b"fixed_salt_16byt"
        
        hash1, _ = argon2id_hash(b"password1", salt)
        hash2, _ = argon2id_hash(b"password2", salt)
        
        assert hash1 != hash2
    
    def test_different_salts_different_hashes(self):
        """Test that different salts produce different hashes."""
        password = b"test_password"
        
        hash1, salt1 = argon2id_hash(password)
        hash2, salt2 = argon2id_hash(password)
        
        # Random salts should be different
        assert salt1 != salt2
        assert hash1 != hash2
    
    def test_custom_config(self):
        """Test hashing with custom configuration."""
        config = Argon2Config.for_environment(Environment.DEVELOPMENT)
        password = b"test_password"
        
        hash_value, salt = argon2id_hash(password, config=config)
        
        assert len(hash_value) == config.hash_length
        assert len(salt) == config.salt_length
    
    def test_invalid_password_type(self):
        """Test error handling for invalid password type."""
        with pytest.raises(InvalidInputError) as exc_info:
            argon2id_hash("string_password")  # Should be bytes
        
        assert "Password must be bytes" in str(exc_info.value)
    
    def test_empty_password(self):
        """Test error handling for empty password."""
        with pytest.raises(InvalidInputError) as exc_info:
            argon2id_hash(b"")
        
        assert "Password cannot be empty" in str(exc_info.value)
    
    def test_password_too_long(self):
        """Test error handling for overly long password."""
        long_password = b"x" * (1024 * 1024 + 1)  # > 1MB
        
        with pytest.raises(InvalidInputError) as exc_info:
            argon2id_hash(long_password)
        
        assert "Password too long" in str(exc_info.value)
    
    def test_invalid_salt_type(self):
        """Test error handling for invalid salt type."""
        with pytest.raises(InvalidInputError) as exc_info:
            argon2id_hash(b"password", salt="string_salt")
        
        assert "Salt must be bytes" in str(exc_info.value)
    
    def test_empty_salt(self):
        """Test error handling for empty salt."""
        with pytest.raises(InvalidInputError) as exc_info:
            argon2id_hash(b"password", salt=b"")
        
        assert "Salt cannot be empty" in str(exc_info.value)


class TestArgon2idVerify:
    """Test cases for Argon2id hash verification."""
    
    def test_successful_verification(self):
        """Test successful password verification."""
        password = b"test_password"
        hash_value, salt = argon2id_hash(password)
        
        result = verify_argon2id_hash(password, hash_value, salt)
        assert result is True
    
    def test_failed_verification_wrong_password(self):
        """Test failed verification with wrong password."""
        password = b"test_password"
        wrong_password = b"wrong_password"
        hash_value, salt = argon2id_hash(password)
        
        result = verify_argon2id_hash(wrong_password, hash_value, salt)
        assert result is False
    
    def test_failed_verification_wrong_salt(self):
        """Test failed verification with wrong salt."""
        password = b"test_password"
        hash_value, _ = argon2id_hash(password)
        wrong_salt = b"wrong_salt_16byt"
        
        result = verify_argon2id_hash(password, hash_value, wrong_salt)
        assert result is False
    
    def test_verification_with_custom_config(self):
        """Test verification with custom configuration."""
        config = Argon2Config.for_environment(Environment.DEVELOPMENT)
        password = b"test_password"
        hash_value, salt = argon2id_hash(password, config=config)
        
        result = verify_argon2id_hash(password, hash_value, salt, config)
        assert result is True


class TestArgon2idBenchmark:
    """Test cases for Argon2id benchmarking."""
    
    def test_benchmark_basic(self):
        """Test basic benchmarking functionality."""
        config = Argon2Config.for_environment(Environment.DEVELOPMENT)
        
        avg_time = benchmark_argon2id(config, iterations=3)
        
        assert isinstance(avg_time, float)
        assert avg_time > 0
    
    def test_benchmark_invalid_iterations(self):
        """Test benchmark with invalid iterations."""
        config = Argon2Config.for_environment(Environment.DEVELOPMENT)
        
        with pytest.raises(InvalidInputError) as exc_info:
            benchmark_argon2id(config, iterations=0)
        
        assert "Iterations must be positive" in str(exc_info.value)


class TestArgon2idConfig:
    """Test cases for Argon2id configuration."""
    
    def test_development_config(self):
        """Test development environment configuration."""
        config = Argon2Config.for_environment(Environment.DEVELOPMENT)
        
        assert config.memory_cost == 1024 * 16  # 16 MiB
        assert config.time_cost == 1
        assert config.parallelism == 1
        assert config.hash_length == 32
        assert config.salt_length == 16
    
    def test_mobile_config(self):
        """Test mobile environment configuration."""
        config = Argon2Config.for_environment(Environment.MOBILE)
        
        assert config.memory_cost == 1024 * 64  # 64 MiB
        assert config.time_cost == 1
        assert config.parallelism == 4
    
    def test_production_config(self):
        """Test production environment configuration."""
        config = Argon2Config.for_environment(Environment.PRODUCTION)
        
        assert config.memory_cost == 1024 * 64  # 64 MiB
        assert config.time_cost == 3
        assert config.parallelism == 4 