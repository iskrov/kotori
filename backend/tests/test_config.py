"""
Test Configuration Settings

This module provides comprehensive configuration settings for all test environments
and scenarios including database settings, security parameters, performance limits,
and test execution parameters.
"""

import os
from datetime import timedelta
from typing import Dict, Any, List, Optional

# Database Configuration
DATABASE_CONFIG = {
    "test_url": "postgresql://postgres:password@localhost:5432/vibes_test",
    "pool_size": 5,
    "max_overflow": 10,
    "pool_timeout": 30,
    "pool_recycle": 3600,
    "echo": False,
    "echo_pool": False,
    "isolation_level": "READ_COMMITTED"
}

# Security Test Configuration
SECURITY_CONFIG = {
    "password_requirements": {
        "min_length": 8,
        "max_length": 128,
        "require_uppercase": True,
        "require_lowercase": True,
        "require_numbers": True,
        "require_special": True,
        "forbidden_patterns": ["password", "123456", "qwerty"]
    },
    "phrase_requirements": {
        "min_length": 10,
        "max_length": 200,
        "min_words": 3,
        "max_repeated_words": 2,
        "forbidden_patterns": ["test", "password", "phrase"]
    },
    "rate_limiting": {
        "registration": {"limit": 10, "window": 60},
        "authentication": {"limit": 20, "window": 60},
        "login": {"limit": 5, "window": 60},
        "password_reset": {"limit": 3, "window": 300}
    },
    "session_config": {
        "timeout": 3600,  # 1 hour
        "refresh_threshold": 300,  # 5 minutes
        "max_concurrent_sessions": 3
    },
    "encryption": {
        "key_size": 256,
        "iv_size": 96,
        "tag_size": 128,
        "pbkdf2_iterations": 100000,
        "scrypt_n": 32768,
        "scrypt_r": 8,
        "scrypt_p": 1
    }
}

# Performance Test Configuration
PERFORMANCE_CONFIG = {
    "response_time_limits": {
        "registration": 2.0,
        "authentication_init": 1.0,
        "authentication_finalize": 1.5,
        "phrase_detection": 0.5,
        "vault_upload": 3.0,
        "vault_download": 2.0,
        "journal_create": 1.0,
        "journal_retrieve": 0.5
    },
    "memory_limits": {
        "max_memory_per_operation": 50 * 1024 * 1024,  # 50MB
        "max_total_memory": 200 * 1024 * 1024,  # 200MB
        "memory_growth_threshold": 10 * 1024 * 1024  # 10MB
    },
    "concurrency_limits": {
        "max_concurrent_users": 100,
        "max_concurrent_operations": 500,
        "max_db_connections": 20
    },
    "load_test_parameters": {
        "users": 50,
        "ramp_up_time": 60,
        "test_duration": 300,
        "operations_per_user": 100
    }
}

# Vault Configuration
VAULT_CONFIG = {
    "storage_limits": {
        "max_blob_size": 10 * 1024 * 1024,  # 10MB
        "max_blobs_per_user": 1000,
        "max_storage_per_user": 1024 * 1024 * 1024,  # 1GB
        "max_filename_length": 255
    },
    "supported_content_types": [
        "text/plain",
        "text/markdown",
        "application/json",
        "application/xml",
        "application/octet-stream",
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf"
    ],
    "encryption_config": {
        "algorithm": "AES-256-GCM",
        "key_derivation": "PBKDF2",
        "compression": False,
        "integrity_checks": True
    }
}

# Audit and Monitoring Configuration
AUDIT_CONFIG = {
    "event_categories": [
        "AUTHENTICATION",
        "AUTHORIZATION", 
        "DATA_ACCESS",
        "SYSTEM_ADMIN",
        "SECURITY_VIOLATION",
        "PERFORMANCE_ISSUE"
    ],
    "severity_levels": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    "retention_period": 90,  # days
    "alert_thresholds": {
        "failed_logins": 5,
        "rate_limit_violations": 10,
        "suspicious_activity": 3,
        "system_errors": 20
    },
    "monitoring_intervals": {
        "health_check": 30,  # seconds
        "performance_metrics": 60,  # seconds
        "security_scan": 300,  # seconds
        "cleanup_check": 3600  # seconds
    }
}

# Test Execution Configuration
TEST_EXECUTION_CONFIG = {
    "parallel_execution": {
        "max_workers": 4,
        "timeout": 300,
        "retry_attempts": 3,
        "retry_delay": 5
    },
    "test_categories": {
        "unit": {"timeout": 30, "max_memory": 10 * 1024 * 1024},
        "integration": {"timeout": 120, "max_memory": 50 * 1024 * 1024},
        "e2e": {"timeout": 300, "max_memory": 100 * 1024 * 1024},
        "performance": {"timeout": 600, "max_memory": 200 * 1024 * 1024},
        "security": {"timeout": 180, "max_memory": 30 * 1024 * 1024}
    },
    "report_generation": {
        "formats": ["html", "xml", "json"],
        "include_coverage": True,
        "include_performance": True,
        "include_security": True
    },
    "cleanup_policy": {
        "auto_cleanup": True,
        "cleanup_on_failure": True,
        "preserve_logs": True,
        "log_retention_days": 7
    }
}

# Environment-Specific Configuration
ENVIRONMENT_CONFIG = {
    "development": {
        "debug": True,
        "verbose_logging": True,
        "strict_ssl": False,
        "mock_external_services": True,
        "performance_monitoring": False
    },
    "testing": {
        "debug": False,
        "verbose_logging": False,
        "strict_ssl": True,
        "mock_external_services": False,
        "performance_monitoring": True
    },
    "ci": {
        "debug": False,
        "verbose_logging": False,
        "strict_ssl": True,
        "mock_external_services": True,
        "performance_monitoring": True,
        "fast_mode": True,
        "parallel_execution": True
    }
}

# Test Data Configuration
TEST_DATA_CONFIG = {
    "user_count": 100,
    "phrase_count": 500,
    "journal_entry_count": 1000,
    "vault_blob_count": 500,
    "concurrent_operation_count": 50,
    "data_generation_seed": 42,
    "cleanup_after_test": True,
    "preserve_test_data": False
}

# Error Simulation Configuration
ERROR_SIMULATION_CONFIG = {
    "database_errors": {
        "connection_failure": 0.01,
        "timeout": 0.005,
        "deadlock": 0.001,
        "constraint_violation": 0.02
    },
    "network_errors": {
        "timeout": 0.02,
        "connection_reset": 0.01,
        "dns_failure": 0.005
    },
    "system_errors": {
        "memory_error": 0.001,
        "disk_full": 0.001,
        "permission_denied": 0.005
    },
    "application_errors": {
        "validation_error": 0.05,
        "authentication_error": 0.02,
        "authorization_error": 0.01
    }
}

# Integration Test Configuration
INTEGRATION_CONFIG = {
    "external_services": {
        "google_cloud_speech": {
            "mock": True,
            "timeout": 30,
            "retry_attempts": 3
        },
        "email_service": {
            "mock": True,
            "timeout": 10,
            "retry_attempts": 2
        }
    },
    "service_dependencies": {
        "required_services": ["database", "redis", "vault"],
        "optional_services": ["email", "monitoring"],
        "health_check_interval": 30
    }
}


class TestConfig:
    """Test configuration class with environment-specific settings."""
    
    def __init__(self, environment: str = "testing"):
        self.environment = environment
        self.database = DATABASE_CONFIG
        self.security = SECURITY_CONFIG
        self.performance = PERFORMANCE_CONFIG
        self.vault = VAULT_CONFIG
        self.audit = AUDIT_CONFIG
        self.execution = TEST_EXECUTION_CONFIG
        self.test_data = TEST_DATA_CONFIG
        self.error_simulation = ERROR_SIMULATION_CONFIG
        self.integration = INTEGRATION_CONFIG
        
        # Apply environment-specific overrides
        env_config = ENVIRONMENT_CONFIG.get(environment, {})
        self._apply_environment_config(env_config)
    
    def _apply_environment_config(self, env_config: Dict[str, Any]):
        """Apply environment-specific configuration overrides."""
        for key, value in env_config.items():
            if hasattr(self, key):
                setattr(self, key, value)
    
    def get_database_url(self) -> str:
        """Get database URL with environment-specific modifications."""
        url = self.database["test_url"]
        if self.environment == "ci":
            # Use in-memory database for CI
            url = "sqlite:///:memory:"
        return url
    
    def get_timeout_for_category(self, category: str) -> int:
        """Get timeout for specific test category."""
        return self.execution["test_categories"].get(category, {}).get("timeout", 300)
    
    def get_memory_limit_for_category(self, category: str) -> int:
        """Get memory limit for specific test category."""
        return self.execution["test_categories"].get(category, {}).get("max_memory", 50 * 1024 * 1024)
    
    def is_mock_enabled(self, service: str) -> bool:
        """Check if mocking is enabled for a service."""
        return self.integration["external_services"].get(service, {}).get("mock", False)
    
    def get_performance_limit(self, operation: str) -> float:
        """Get performance limit for specific operation."""
        return self.performance["response_time_limits"].get(operation, 2.0)
    
    def get_rate_limit(self, endpoint: str) -> Dict[str, int]:
        """Get rate limit configuration for endpoint."""
        return self.security["rate_limiting"].get(endpoint, {"limit": 10, "window": 60})
    
    def should_cleanup_after_test(self) -> bool:
        """Check if cleanup should be performed after test."""
        return self.execution["cleanup_policy"]["auto_cleanup"]
    
    def get_test_data_count(self, data_type: str) -> int:
        """Get test data count for specific type."""
        return self.test_data.get(f"{data_type}_count", 10)


# Global test configuration instance
test_config = TestConfig()

# Environment variable overrides
if os.environ.get("TEST_ENV"):
    test_config = TestConfig(os.environ["TEST_ENV"])

# Configuration validation
def validate_config():
    """Validate test configuration."""
    errors = []
    
    # Validate database configuration
    if not test_config.database["test_url"]:
        errors.append("Database URL is required")
    
    # Validate performance limits
    for operation, limit in test_config.performance["response_time_limits"].items():
        if limit <= 0:
            errors.append(f"Performance limit for {operation} must be positive")
    
    # Validate memory limits
    for category, config in test_config.execution["test_categories"].items():
        if config.get("max_memory", 0) <= 0:
            errors.append(f"Memory limit for {category} must be positive")
    
    # Validate security configuration
    if test_config.security["password_requirements"]["min_length"] < 8:
        errors.append("Password minimum length must be at least 8")
    
    if test_config.security["phrase_requirements"]["min_length"] < 10:
        errors.append("Phrase minimum length must be at least 10")
    
    if errors:
        raise ValueError("Configuration validation failed:\n" + "\n".join(errors))

# Validate configuration on import
validate_config()

# Export commonly used configurations
DATABASE_URL = test_config.get_database_url()
PERFORMANCE_LIMITS = test_config.performance["response_time_limits"]
SECURITY_REQUIREMENTS = test_config.security
VAULT_SETTINGS = test_config.vault
AUDIT_SETTINGS = test_config.audit 

"""
Test configuration module for handling database types and test-specific settings.

This module provides configurations that allow tests to run with SQLite while 
maintaining compatibility with the production PostgreSQL UUID types.
"""

import uuid
from sqlalchemy import TypeDecorator, CHAR, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.engine import Engine
from sqlalchemy import event


class SQLiteUUID(TypeDecorator):
    """
    Platform-independent UUID type for SQLite testing.
    
    Uses CHAR(36) storage on SQLite, and native UUID on PostgreSQL.
    """
    
    impl = CHAR
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'sqlite':
            return dialect.type_descriptor(CHAR(36))
        elif dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID())
        else:
            return dialect.type_descriptor(CHAR(36))
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'sqlite':
            return str(value)
        elif dialect.name == 'postgresql':
            return value
        else:
            return str(value)
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
            return value


# Monkey patch the UUID type for SQLite testing
def configure_sqlite_uuid():
    """Configure SQLite to handle UUID types properly in tests."""
    import sqlalchemy.dialects.postgresql
    
    # Replace PostgreSQL UUID with our SQLiteUUID for testing
    original_uuid = sqlalchemy.dialects.postgresql.UUID
    sqlalchemy.dialects.postgresql.UUID = SQLiteUUID

    # Also patch the generic UUID import
    import sqlalchemy.dialects.postgresql as pg_module
    pg_module.UUID = SQLiteUUID


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Set SQLite pragmas for better testing performance and foreign key support."""
    if 'sqlite' in str(dbapi_connection):
        cursor = dbapi_connection.cursor()
        # Enable foreign key constraints
        cursor.execute("PRAGMA foreign_keys=ON")
        # Set journal mode for better performance
        cursor.execute("PRAGMA journal_mode=WAL")
        # Set synchronous mode for faster testing
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


# Test database configuration
TEST_DATABASE_CONFIGS = {
    'sqlite_memory': {
        'url': 'sqlite:///:memory:',
        'echo': False,
        'pool_pre_ping': True,
    },
    'sqlite_file': {
        'url': 'sqlite:///./test.db',
        'echo': False,
        'pool_pre_ping': True,
    },
    'postgresql_test': {
        'url': 'postgresql://test:test@localhost:5432/test_vibes',
        'echo': False,
        'pool_pre_ping': True,
    }
}


def get_test_database_url():
    """Get the appropriate test database URL based on environment."""
    import os
    
    # Check for test database preference
    db_type = os.getenv('TEST_DB_TYPE', 'sqlite_memory')
    
    if db_type in TEST_DATABASE_CONFIGS:
        return TEST_DATABASE_CONFIGS[db_type]['url']
    else:
        # Default to SQLite in-memory
        return TEST_DATABASE_CONFIGS['sqlite_memory']['url']


def setup_test_database():
    """Setup test database configuration including UUID handling."""
    # Configure SQLite UUID handling
    configure_sqlite_uuid()
    
    return get_test_database_url()


# Test data factories and fixtures
class TestDataFactory:
    """Factory class for creating test data with proper UUID handling."""
    
    @staticmethod
    def create_test_uuid():
        """Create a test UUID that works across database backends."""
        return uuid.uuid4()
    
    @staticmethod
    def create_user_data(email_suffix="test"):
        """Create test user data with proper UUID."""
        return {
            'id': TestDataFactory.create_test_uuid(),
            'email': f'{email_suffix}@example.com',
            'full_name': f'Test User {email_suffix.title()}',
            'hashed_password': 'hashed_password',
            'is_active': True,
            'is_superuser': False,
        }
    
    @staticmethod
    def create_journal_entry_data(user_id, title_suffix="entry"):
        """Create test journal entry data with proper UUID foreign key."""
        from datetime import datetime, UTC
        
        return {
            'title': f'Test Entry {title_suffix.title()}',
            'content': f'Test content for {title_suffix}',
            'user_id': user_id,
            'entry_date': datetime.now(UTC),
        }
    
    @staticmethod
    def create_reminder_data(user_id, title_suffix="reminder"):
        """Create test reminder data with proper UUID foreign key."""
        from datetime import datetime, UTC
        from app.schemas.reminder import ReminderFrequency
        
        return {
            'title': f'Test Reminder {title_suffix.title()}',
            'message': f'Test message for {title_suffix}',
            'frequency': ReminderFrequency.DAILY,
            'time': datetime.now(UTC),
            'user_id': user_id,
            'is_active': True,
        }


# Test assertion helpers
class TestAssertions:
    """Helper methods for test assertions with UUID support."""
    
    @staticmethod
    def assert_uuid_field(obj, field_name):
        """Assert that a field contains a valid UUID."""
        value = getattr(obj, field_name, None)
        assert value is not None, f"Field {field_name} should not be None"
        assert isinstance(value, uuid.UUID), f"Field {field_name} should be a UUID, got {type(value)}"
    
    @staticmethod
    def assert_uuid_string(value):
        """Assert that a string value is a valid UUID."""
        assert value is not None, "UUID string should not be None"
        try:
            uuid.UUID(value)
        except (ValueError, TypeError):
            assert False, f"Value {value} is not a valid UUID string"
    
    @staticmethod
    def assert_foreign_key_relationship(child_obj, parent_obj, fk_field='user_id'):
        """Assert that foreign key relationship is correctly established."""
        child_fk_value = getattr(child_obj, fk_field, None)
        parent_pk_value = getattr(parent_obj, 'id', None)
        
        assert child_fk_value is not None, f"Child {fk_field} should not be None"
        assert parent_pk_value is not None, f"Parent id should not be None"
        assert child_fk_value == parent_pk_value, f"Foreign key {fk_field} should match parent id"


# Performance testing utilities
class PerformanceTestHelpers:
    """Utilities for performance testing of the optimized schema."""
    
    @staticmethod
    def create_bulk_test_data(db_session, num_users=100, entries_per_user=50):
        """Create bulk test data for performance testing."""
        from app.models.user import User
        from app.models.journal_entry import JournalEntry
        
        users = []
        entries = []
        
        # Create users
        for i in range(num_users):
            user_data = TestDataFactory.create_user_data(f"perf_user_{i}")
            user = User(**user_data)
            users.append(user)
        
        db_session.add_all(users)
        db_session.commit()
        
        # Create journal entries
        for user in users:
            for j in range(entries_per_user):
                entry_data = TestDataFactory.create_journal_entry_data(
                    user.id, f"entry_{j}"
                )
                entry = JournalEntry(**entry_data)
                entries.append(entry)
        
        db_session.add_all(entries)
        db_session.commit()
        
        return users, entries
    
    @staticmethod
    def measure_query_performance(db_session, query_func, iterations=100):
        """Measure query performance over multiple iterations."""
        import time
        
        times = []
        for _ in range(iterations):
            start_time = time.time()
            result = query_func(db_session)
            end_time = time.time()
            times.append(end_time - start_time)
        
        return {
            'min_time': min(times),
            'max_time': max(times),
            'avg_time': sum(times) / len(times),
            'total_time': sum(times),
            'iterations': iterations
        }


# Schema validation utilities
class SchemaValidationHelpers:
    """Utilities for validating database schema integrity."""
    
    @staticmethod
    def validate_table_constraints(db_session, table_name):
        """Validate that table constraints are properly created."""
        from sqlalchemy import text
        
        # Check foreign key constraints
        result = db_session.execute(text(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_tag_display_tag_display_name=:table_name"
        ), {"table_name": table_name})
        
        indexes = [row[0] for row in result.fetchall()]
        return indexes
    
    @staticmethod
    def validate_uuid_columns(db_session):
        """Validate that UUID columns are properly handled."""
        from app.models.user import User
        from app.models.journal_entry import JournalEntry
        
        # Test creating and retrieving objects with UUID fields
        user_data = TestDataFactory.create_user_data("validation")
        user = User(**user_data)
        db_session.add(user)
        db_session.commit()
        
        # Retrieve and validate
        retrieved_user = db_session.query(User).filter(User.id == user.id).first()
        assert retrieved_user is not None
        TestAssertions.assert_uuid_field(retrieved_user, 'id')
        
        # Test foreign key relationship
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "validation")
        entry = JournalEntry(**entry_data)
        db_session.add(entry)
        db_session.commit()
        
        retrieved_entry = db_session.query(JournalEntry).filter(
            JournalEntry.id == entry.id
        ).first()
        assert retrieved_entry is not None
        TestAssertions.assert_uuid_field(retrieved_entry, 'user_id')
        TestAssertions.assert_foreign_key_relationship(retrieved_entry, retrieved_user)
        
        return True


# Test environment setup
def setup_test_environment():
    """Setup the complete test environment with proper configurations."""
    
    # Configure database
    db_url = setup_test_database()
    
    # Setup logging for tests
    import logging
    logging.basicConfig(level=logging.WARNING)
    
    # Disable specific loggers that are too verbose in tests
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
    
    return {
        'database_url': db_url,
        'test_factory': TestDataFactory,
        'assertions': TestAssertions,
        'performance': PerformanceTestHelpers,
        'validation': SchemaValidationHelpers,
    }


# Export commonly used components
__all__ = [
    'SQLiteUUID',
    'configure_sqlite_uuid',
    'setup_test_database',
    'TestDataFactory',
    'TestAssertions',
    'PerformanceTestHelpers',
    'SchemaValidationHelpers',
    'setup_test_environment',
] 