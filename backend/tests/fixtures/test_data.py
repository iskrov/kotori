"""
Test Data Fixtures

This module provides comprehensive test data fixtures for all test scenarios
including users, phrases, journal entries, vault content, and security test data.
"""

import uuid
import secrets
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

# User Test Data
TEST_USERS = [
    {
        "email": "alice@example.com",
        "password": "AlicePassword123!",
        "full_name": "Alice Johnson"
    },
    {
        "email": "bob@example.com",
        "password": "BobPassword456!",
        "full_name": "Bob Smith"
    },
    {
        "email": "charlie@example.com",
        "password": "CharliePassword789!",
        "full_name": "Charlie Brown"
    },
    {
        "email": "diana@example.com",
        "password": "DianaPassword321!",
        "full_name": "Diana Prince"
    },
    {
        "email": "eve@example.com",
        "password": "EvePassword654!",
        "full_name": "Eve Adams"
    }
]

# Secret Phrase Test Data
SECRET_PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Waltz, bad nymph, for quick jigs vex",
    "Sphinx of black quartz, judge my vow",
    "The five boxing wizards jump quickly",
    "Jackdaws love my big sphinx of quartz",
    "Mr. Jock, TV quiz PhD, bags few lynx",
    "Glib jocks quiz nymph to vex dwarf",
    "Bright vixens jump; dozy fowl quack"
]

# Complex Secret Phrases for Advanced Testing
COMPLEX_PHRASES = [
    "In the depths of winter, I finally learned that there was in me an invincible summer",
    "The only way to do great work is to love what you do",
    "Life is what happens to you while you're busy making other plans",
    "The future belongs to those who believe in the beauty of their dreams",
    "It is during our darkest moments that we must focus to see the light"
]

# Multilingual Phrases for Internationalization Testing
MULTILINGUAL_PHRASES = [
    "Bonjour, comment allez-vous aujourd'hui?",  # French
    "Hola, ¿cómo estás hoy?",  # Spanish
    "Hallo, wie geht es dir heute?",  # German
    "Ciao, come stai oggi?",  # Italian
    "こんにちは、今日はいかがですか？",  # Japanese
    "Привет, как дела сегодня?",  # Russian
    "你好，你今天怎么样？",  # Chinese
    "안녕하세요, 오늘 어떻게 지내세요?",  # Korean
]

# Journal Entry Test Data
JOURNAL_ENTRIES = [
    "Today was a beautiful day. I went for a walk in the park and enjoyed the sunshine.",
    "Had an interesting conversation with a colleague about the future of AI technology.",
    "Cooked a delicious dinner tonight. The recipe turned out better than expected.",
    "Finished reading a fascinating book about quantum physics and its implications.",
    "Attended a virtual conference on sustainable technology innovations.",
    "Spent quality time with family playing board games and sharing stories.",
    "Worked on a challenging programming problem and finally found an elegant solution.",
    "Discovered a new coffee shop in the neighborhood with amazing espresso.",
    "Took some time for meditation and reflection on recent life changes.",
    "Watched a documentary about ocean conservation and felt inspired to make a difference."
]

# Encrypted Journal Entries with Secret Phrases
ENCRYPTED_JOURNAL_DATA = [
    {
        "content": "The quick brown fox jumps over the lazy dog. Today I learned something important about cryptography.",
        "phrase": "The quick brown fox jumps over the lazy dog",
        "expected_detection": True
    },
    {
        "content": "Pack my box with five dozen liquor jugs. This phrase reminds me of my grandfather's stories.",
        "phrase": "Pack my box with five dozen liquor jugs",
        "expected_detection": True
    },
    {
        "content": "How vexingly quick daft zebras jump when startled by unexpected sounds.",
        "phrase": "How vexingly quick daft zebras jump",
        "expected_detection": True
    },
    {
        "content": "This is a regular journal entry without any secret phrases embedded.",
        "phrase": "Waltz, bad nymph, for quick jigs vex",
        "expected_detection": False
    },
    {
        "content": "Sphinx of black quartz, judge my vow to keep these secrets safe forever.",
        "phrase": "Sphinx of black quartz, judge my vow",
        "expected_detection": True
    }
]

# Vault Test Data
VAULT_TEST_DATA = [
    {
        "content": "This is a test document stored in the vault",
        "content_type": "text/plain",
        "size": 44
    },
    {
        "content": '{"type": "structured_data", "value": "test_value", "timestamp": "2025-01-01T00:00:00Z"}',
        "content_type": "application/json",
        "size": 82
    },
    {
        "content": "# Test Document\n\nThis is a **markdown** document with *formatting*.",
        "content_type": "text/markdown",
        "size": 67
    },
    {
        "content": "Binary content with special characters: åäöÅÄÖ",
        "content_type": "application/octet-stream",
        "size": 48
    },
    {
        "content": "<?xml version='1.0'?><root><item>test</item></root>",
        "content_type": "application/xml",
        "size": 51
    }
]

# Performance Test Data
PERFORMANCE_TEST_DATA = {
    "small_content": "Small test content",
    "medium_content": "Medium test content " * 100,
    "large_content": "Large test content " * 1000,
    "binary_data": secrets.token_bytes(1024),
    "json_data": json.dumps([{"key": "value"} for i in range(100)])
}

# Security Test Data
SECURITY_TEST_DATA = {
    "sql_injection_attempts": [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin'--",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' UNION SELECT * FROM users --"
    ],
    "xss_attempts": [
        "<script>alert('XSS')</script>",
        "javascript:alert('XSS')",
        "<img src=x onerror=alert('XSS')>",
        "';alert('XSS');//",
        "<svg onload=alert('XSS')>"
    ],
    "timing_attack_phrases": [
        "correct_phrase",
        "incorrect_phrase",
        "correct_phras",  # One character off
        "correct_phrass",  # Different character
        "wrong_phrase_entirely"
    ],
    "rate_limiting_test_data": {
        "registration_requests": 15,
        "authentication_requests": 25,
        "login_requests": 10,
        "password_reset_requests": 5
    }
}

# Error Test Data
ERROR_TEST_DATA = {
    "invalid_user_data": [
        {"email": "", "password": "ValidPassword123!"},
        {"email": "invalid-email", "password": "ValidPassword123!"},
        {"email": "valid@email.com", "password": ""},
        {"email": "valid@email.com", "password": "short"},
        {"email": "valid@email.com", "password": "nouppercase123!"},
        {"email": "valid@email.com", "password": "NOLOWERCASE123!"},
        {"email": "valid@email.com", "password": "NoNumbers!"},
        {"email": "valid@email.com", "password": "NoSpecialChars123"}
    ],
    "invalid_phrases": [
        "",  # Empty phrase
        "a",  # Too short
        "a" * 201,  # Too long
        "123456789",  # No words
        "test test test",  # Repeated words
        "!@#$%^&*()",  # Only special characters
        "   ",  # Only whitespace
    ],
    "invalid_journal_entries": [
        "",  # Empty content
        "a" * 10001,  # Too long
        None,  # None content
    ],
    "invalid_vault_data": [
        {"content": "", "content_type": "text/plain"},
        {"content": "valid", "content_type": ""},
        {"content": "valid", "content_type": "invalid/type"},
        {"content": None, "content_type": "text/plain"},
    ]
}

# Load Test Data
LOAD_TEST_DATA = {
    "concurrent_users": 10,
    "operations_per_user": 50,
    "test_duration_seconds": 300,
    "ramp_up_time_seconds": 60
}

# Mock Response Data
MOCK_RESPONSES = {
    "opaque_registration": {
        "success": True,
        "registration_id": str(uuid.uuid4()),
        "server_public_key": secrets.token_bytes(32).hex(),
        "message": "Registration successful"
    },
    "opaque_auth_init": {
        "success": True,
        "challenge": secrets.token_bytes(32).hex(),
        "server_public_key": secrets.token_bytes(32).hex(),
        "session_id": str(uuid.uuid4())
    },
    "opaque_auth_finalize": {
        "success": True,
        "session_token": secrets.token_bytes(32).hex(),
        "vault_key": secrets.token_bytes(32).hex(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    },
    "vault_upload": {
        "success": True,
        "blob_id": str(uuid.uuid4()),
        "size": 1024,
        "checksum": secrets.token_bytes(32).hex()
    },
    "vault_download": {
        "success": True,
        "content": b"mock_content",
        "content_type": "text/plain",
        "size": 12
    }
}

# Test Configuration Data
TEST_CONFIG = {
    "database": {
        "url": "postgresql://postgres:password@localhost:5432/vibes_test",
        "pool_size": 5,
        "max_overflow": 10,
        "pool_timeout": 30
    },
    "security": {
        "password_min_length": 8,
        "password_require_uppercase": True,
        "password_require_lowercase": True,
        "password_require_numbers": True,
        "password_require_special": True,
        "phrase_min_length": 10,
        "phrase_max_length": 200,
        "rate_limit_window": 60,
        "max_attempts": 5
    },
    "performance": {
        "max_response_time": 1.0,
        "max_memory_usage": 100 * 1024 * 1024,  # 100MB
        "max_concurrent_requests": 100
    },
    "vault": {
        "max_blob_size": 10 * 1024 * 1024,  # 10MB
        "max_blobs_per_user": 1000,
        "max_storage_per_user": 1024 * 1024 * 1024,  # 1GB
        "supported_content_types": [
            "text/plain",
            "application/json",
            "text/markdown",
            "application/octet-stream",
            "application/xml"
        ]
    }
}


@dataclass
class TestScenario:
    """Test scenario data structure."""
    name: str
    description: str
    users: List[Dict[str, str]]
    phrases: List[str]
    journal_entries: List[str]
    vault_data: List[Dict[str, Any]]
    expected_results: Dict[str, Any]
    setup_requirements: List[str] = field(default_factory=list)
    cleanup_requirements: List[str] = field(default_factory=list)


# Predefined Test Scenarios
TEST_SCENARIOS = {
    "basic_registration": TestScenario(
        name="Basic Registration",
        description="Test basic user registration with secret phrases",
        users=[TEST_USERS[0]],
        phrases=SECRET_PHRASES[:3],
        journal_entries=JOURNAL_ENTRIES[:3],
        vault_data=VAULT_TEST_DATA[:2],
        expected_results={
            "users_created": 1,
            "phrases_registered": 3,
            "entries_created": 3,
            "blobs_stored": 2
        }
    ),
    
    "multi_user_isolation": TestScenario(
        name="Multi-User Isolation",
        description="Test data isolation between multiple users",
        users=TEST_USERS[:3],
        phrases=SECRET_PHRASES[:5],
        journal_entries=JOURNAL_ENTRIES[:5],
        vault_data=VAULT_TEST_DATA[:3],
        expected_results={
            "users_created": 3,
            "phrases_per_user": 5,
            "entries_per_user": 5,
            "blobs_per_user": 3,
            "isolation_verified": True
        }
    ),
    
    "performance_stress": TestScenario(
        name="Performance Stress Test",
        description="Test system performance under load",
        users=TEST_USERS,
        phrases=SECRET_PHRASES + COMPLEX_PHRASES,
        journal_entries=JOURNAL_ENTRIES * 10,
        vault_data=VAULT_TEST_DATA * 20,
        expected_results={
            "max_response_time": 1.0,
            "max_memory_usage": 200 * 1024 * 1024,
            "success_rate": 0.99
        }
    ),
    
    "security_validation": TestScenario(
        name="Security Validation",
        description="Test security measures and attack resistance",
        users=[TEST_USERS[0]],
        phrases=SECRET_PHRASES[:3],
        journal_entries=JOURNAL_ENTRIES[:3],
        vault_data=VAULT_TEST_DATA[:2],
        expected_results={
            "timing_attack_resistance": True,
            "rate_limiting_effective": True,
            "input_validation_secure": True,
            "encryption_verified": True
        }
    ),
    
    "error_handling": TestScenario(
        name="Error Handling",
        description="Test error handling and recovery",
        users=[TEST_USERS[0]],
        phrases=SECRET_PHRASES[:2],
        journal_entries=JOURNAL_ENTRIES[:2],
        vault_data=VAULT_TEST_DATA[:2],
        expected_results={
            "invalid_inputs_rejected": True,
            "errors_handled_gracefully": True,
            "recovery_successful": True,
            "audit_logs_created": True
        }
    )
}


class TestDataFactory:
    """Factory class for generating test data."""
    
    @staticmethod
    def create_user_data(count: int) -> List[Dict[str, str]]:
        """Create user test data."""
        users = []
        for i in range(count):
            users.append({
                "email": f"test_user_{i}@example.com",
                "password": f"TestPassword{i}!",
                "full_name": f"Test User {i}"
            })
        return users
    
    @staticmethod
    def create_phrase_data(count: int) -> List[str]:
        """Create phrase test data."""
        phrases = SECRET_PHRASES.copy()
        while len(phrases) < count:
            phrases.append(f"Generated test phrase number {len(phrases)}")
        return phrases[:count]
    
    @staticmethod
    def create_journal_data(count: int) -> List[str]:
        """Create journal entry test data."""
        entries = JOURNAL_ENTRIES.copy()
        while len(entries) < count:
            entries.append(f"Generated journal entry number {len(entries)}")
        return entries[:count]
    
    @staticmethod
    def create_vault_data(count: int) -> List[Dict[str, Any]]:
        """Create vault test data."""
        vault_data = VAULT_TEST_DATA.copy()
        while len(vault_data) < count:
            vault_data.append({
                "content": f"Generated vault content number {len(vault_data)}",
                "content_type": "text/plain",
                "size": 50
            })
        return vault_data[:count]
    
    @staticmethod
    def create_performance_data(size: str) -> str:
        """Create performance test data of specified size."""
        if size == "small":
            return PERFORMANCE_TEST_DATA["small_content"]
        elif size == "medium":
            return PERFORMANCE_TEST_DATA["medium_content"]
        elif size == "large":
            return PERFORMANCE_TEST_DATA["large_content"]
        else:
            return "Default test content"
    
    @staticmethod
    def create_security_test_data(attack_type: str) -> List[str]:
        """Create security test data for specified attack type."""
        if attack_type == "sql_injection":
            return SECURITY_TEST_DATA["sql_injection_attempts"]
        elif attack_type == "xss":
            return SECURITY_TEST_DATA["xss_attempts"]
        elif attack_type == "timing":
            return SECURITY_TEST_DATA["timing_attack_phrases"]
        else:
            return ["default_test_input"]
    
    @staticmethod
    def create_error_test_data(error_type: str) -> List[Dict[str, Any]]:
        """Create error test data for specified error type."""
        if error_type == "invalid_user":
            return ERROR_TEST_DATA["invalid_user_data"]
        elif error_type == "invalid_phrase":
            return ERROR_TEST_DATA["invalid_phrases"]
        elif error_type == "invalid_journal":
            return ERROR_TEST_DATA["invalid_journal_entries"]
        elif error_type == "invalid_vault":
            return ERROR_TEST_DATA["invalid_vault_data"]
        else:
            return [{"error": "unknown_error_type"}]


def get_test_scenario(name: str) -> TestScenario:
    """Get a predefined test scenario."""
    return TEST_SCENARIOS.get(name)


def get_test_user(index: int = 0) -> Dict[str, str]:
    """Get a test user by index."""
    return TEST_USERS[index % len(TEST_USERS)]


def get_test_phrase(index: int = 0) -> str:
    """Get a test phrase by index."""
    return SECRET_PHRASES[index % len(SECRET_PHRASES)]


def get_test_journal_entry(index: int = 0) -> str:
    """Get a test journal entry by index."""
    return JOURNAL_ENTRIES[index % len(JOURNAL_ENTRIES)]


def get_test_vault_data(index: int = 0) -> Dict[str, Any]:
    """Get test vault data by index."""
    return VAULT_TEST_DATA[index % len(VAULT_TEST_DATA)]


def get_mock_response(response_type: str) -> Dict[str, Any]:
    """Get a mock response by type."""
    return MOCK_RESPONSES.get(response_type, {})


def get_test_config(section: str = None) -> Dict[str, Any]:
    """Get test configuration."""
    if section:
        return TEST_CONFIG.get(section, {})
    return TEST_CONFIG 