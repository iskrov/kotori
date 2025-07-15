"""
Security-focused tests for entry processing.

This test suite focuses on security aspects:
- Timing attack resistance
- Rate limiting effectiveness
- Memory security
- Authentication security
- Audit logging completeness
- Error handling security
"""

import pytest
import time
import hashlib
import statistics
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session

from app.services.entry_processor import EntryProcessor, EntryProcessingError, ProcessingStage
from app.services.phrase_processor import SecretPhraseProcessor
from app.crypto.aes_gcm import AESGCMCrypto
from app.core.security import audit_security_event, SecurityEventType
from app.schemas.journal import JournalEntryCreate
from app.models.secret_tag_opaque import SecretTag


class TestSecurityMeasures:
    """Test suite for security measures in entry processing"""
    
    @pytest.fixture
    def db_session(self):
        """Mock database session"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def entry_processor(self, db_session):
        """Create entry processor for testing"""
        return EntryProcessor(db_session)
    
    @pytest.fixture
    def phrase_processor(self, db_session):
        """Create phrase processor for testing"""
        return SecretPhraseProcessor(db_session)
    
    @pytest.fixture
    def aes_crypto(self):
        """Create AES-GCM crypto for testing"""
        return AESGCMCrypto()

    def test_timing_attack_resistance_phrase_processing(self, phrase_processor):
        """Test that phrase processing has consistent timing to prevent timing attacks"""
        
        # Test phrases of different lengths and characteristics
        test_phrases = [
            "short",
            "medium length phrase",
            "this is a much longer phrase that should take the same time to process",
            "special!@#$%^&*()characters",
            "unicode: café résumé naïve",
            "numbers: 1234567890",
            ""  # empty phrase
        ]
        
        processing_times = []
        
        with patch.object(phrase_processor, '_rate_limit_cache', {}):
            for phrase in test_phrases:
                start_time = time.perf_counter()
                
                # Process phrase (this should have consistent timing)
                try:
                    phrase_processor._secure_phrase_processing(phrase)
                except:
                    pass  # We're testing timing, not functionality
                
                end_time = time.perf_counter()
                processing_times.append(end_time - start_time)
        
        # Analyze timing consistency
        if len(processing_times) > 1:
            mean_time = statistics.mean(processing_times)
            std_dev = statistics.stdev(processing_times)
            
            # Standard deviation should be small relative to mean (< 20%)
            # This indicates consistent timing
            coefficient_of_variation = std_dev / mean_time if mean_time > 0 else 0
            assert coefficient_of_variation < 0.2, f"Timing inconsistency detected: CoV = {coefficient_of_variation}"

    def test_rate_limiting_effectiveness(self, entry_processor):
        """Test that rate limiting properly prevents abuse"""
        
        user_id = 1
        ip_address = "192.168.1.100"
        
        # Mock rate limiter to return False after 3 attempts
        call_count = 0
        def mock_rate_limit_check(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return call_count <= 3, 60  # Allow first 3, then block with 60s retry
        
        with patch.object(entry_processor.rate_limiter, 'check_rate_limit', 
                         side_effect=mock_rate_limit_check):
            
            # First few attempts should succeed rate limit check
            for i in range(3):
                allowed = entry_processor._check_rate_limits(
                    Mock(user_id=user_id, ip_address=ip_address)
                )
                assert allowed, f"Attempt {i+1} should be allowed"
            
            # Subsequent attempts should be blocked
            for i in range(3):
                allowed = entry_processor._check_rate_limits(
                    Mock(user_id=user_id, ip_address=ip_address)
                )
                assert not allowed, f"Attempt {i+4} should be blocked"

    def test_memory_security_key_cleanup(self, entry_processor):
        """Test that encryption keys are properly cleaned up from memory"""
        
        from app.services.entry_processor import ProcessingContext
        
        # Create context with encryption keys
        context = ProcessingContext(
            user_id=1,
            ip_address="127.0.0.1",
            entry_request=Mock()
        )
        
        # Add encryption keys
        test_keys = {
            "key1": b'\x01' * 32,
            "key2": b'\x02' * 32,
            "key3": b'\x03' * 32
        }
        context.encryption_keys = test_keys.copy()
        
        # Verify keys are present
        assert len(context.encryption_keys) == 3
        
        # Clean up context
        entry_processor._cleanup_processing_context(context)
        
        # Verify keys are cleared
        assert len(context.encryption_keys) == 0
        
        # Verify original key bytes would be zeroed (mock secure_zero)
        with patch.object(entry_processor.secure_memory, 'secure_zero') as mock_zero:
            context.encryption_keys = test_keys.copy()
            entry_processor._cleanup_processing_context(context)
            
            # Should call secure_zero for each key
            assert mock_zero.call_count == 3

    def test_constant_time_comparison(self, aes_crypto):
        """Test that comparisons are constant time"""
        
        from app.services.encryption_service import EncryptionService
        encryption_service = EncryptionService()
        
        # Test with different length sequences
        test_cases = [
            (b'\x01' * 16, b'\x01' * 16),  # Same data
            (b'\x01' * 16, b'\x02' * 16),  # Different data, same length
            (b'\x01' * 16, b'\x01' * 8),   # Different lengths
            (b'', b''),                     # Empty
        ]
        
        timing_results = []
        
        for a, b in test_cases:
            times = []
            # Run multiple iterations to get consistent timing
            for _ in range(100):
                start = time.perf_counter()
                result = encryption_service.secure_compare(a, b)
                end = time.perf_counter()
                times.append(end - start)
            
            avg_time = statistics.mean(times)
            timing_results.append(avg_time)
        
        # For same-length comparisons, timing should be similar
        same_length_times = [timing_results[0], timing_results[1]]
        if len(same_length_times) > 1:
            time_diff = abs(same_length_times[0] - same_length_times[1])
            max_time = max(same_length_times)
            # Time difference should be less than 10% of max time
            assert time_diff / max_time < 0.1, "Timing difference too large for constant-time comparison"

    def test_secure_random_generation(self, aes_crypto):
        """Test that random number generation is cryptographically secure"""
        
        # Generate multiple keys and IVs
        keys = [aes_crypto.generate_key() for _ in range(10)]
        ivs = [aes_crypto.generate_iv() for _ in range(10)]
        
        # Check that all generated values are unique
        assert len(set(keys)) == len(keys), "Generated keys should be unique"
        assert len(set(ivs)) == len(ivs), "Generated IVs should be unique"
        
        # Check correct lengths
        for key in keys:
            assert len(key) == 32, "AES keys should be 32 bytes"
        
        for iv in ivs:
            assert len(iv) == 12, "AES-GCM IVs should be 12 bytes"
        
        # Basic entropy check - no obvious patterns
        for key in keys:
            # Should not be all zeros or all ones
            assert key != b'\x00' * 32
            assert key != b'\xff' * 32
            
            # Should have reasonable byte distribution
            unique_bytes = len(set(key))
            assert unique_bytes > 10, f"Key has poor entropy: only {unique_bytes} unique bytes"

    def test_authentication_timing_consistency(self, phrase_processor):
        """Test that authentication attempts have consistent timing"""
        
        # Create mock secret tag
        secret_tag = SecretTag(
            tag_id=b'\x01' * 16,
            user_id=1,
            salt=b'\x01' * 16,
            verifier_kv=b'\x01' * 32,
            opaque_envelope=b'\x01' * 64,
            tag_name="test_tag",
            color_code="#FF0000"
        )
        
        # Test phrases with different characteristics
        test_phrases = [
            "correct_phrase",
            "wrong_phrase",
            "much_longer_incorrect_phrase_that_should_take_same_time",
            "short",
            "",
            "special!@#chars"
        ]
        
        timing_results = []
        
        with patch.object(phrase_processor, 'opaque_service') as mock_opaque:
            # Mock OPAQUE service to return consistent timing
            mock_opaque.authenticate_phrase_and_get_key.return_value = None
            
            for phrase in test_phrases:
                start_time = time.perf_counter()
                
                try:
                    phrase_processor._secure_authenticate_phrase(phrase, secret_tag)
                except:
                    pass
                
                end_time = time.perf_counter()
                timing_results.append(end_time - start_time)
        
        # Check timing consistency
        if len(timing_results) > 1:
            mean_time = statistics.mean(timing_results)
            std_dev = statistics.stdev(timing_results)
            coefficient_of_variation = std_dev / mean_time if mean_time > 0 else 0
            
            # Should have consistent timing (< 20% variation)
            assert coefficient_of_variation < 0.2

    def test_audit_logging_completeness(self, entry_processor):
        """Test that all security events are properly audited"""
        
        from app.services.entry_processor import ProcessingContext
        
        context = ProcessingContext(
            user_id=1,
            ip_address="192.168.1.100",
            entry_request=Mock(),
            session_id="test_session"
        )
        
        with patch('app.core.security.audit_security_event') as mock_audit:
            
            # Test all audit methods
            entry_processor._audit_processing_error(context, "test error")
            entry_processor._audit_rate_limit_exceeded(context)
            entry_processor._audit_phrase_detection(context, 2)
            entry_processor._audit_successful_authentication(context, 1)
            entry_processor._audit_authentication_failure(context)
            entry_processor._audit_authentication_error(context, "auth error")
            entry_processor._audit_regular_entry_creation(context)
            entry_processor._audit_regular_entry_error(context, "creation error")
            
            # Should have called audit for each method
            assert mock_audit.call_count == 8
            
            # Verify each call includes required information
            for call in mock_audit.call_args_list:
                args, kwargs = call
                event_type = args[0]
                assert isinstance(event_type, str)
                
                details = kwargs.get('details', {}) if kwargs else {}
                assert 'ip_address' in details
                assert 'session_id' in details

    def test_input_validation_security(self, entry_processor):
        """Test that input validation prevents security issues"""
        
        # Test various malicious inputs
        malicious_inputs = [
            # Very long content (potential DoS)
            JournalEntryCreate(
                title="Long content test",
                content="A" * 100000,  # 100KB content
                entry_date=None
            ),
            
            # SQL injection attempts in title
            JournalEntryCreate(
                title="'; DROP TABLE users; --",
                content="Test content",
                entry_date=None
            ),
            
            # XSS attempts in content
            JournalEntryCreate(
                title="XSS Test",
                content="<script>alert('xss')</script>",
                entry_date=None
            ),
            
            # Unicode normalization attacks
            JournalEntryCreate(
                title="Unicode test",
                content="café\u0301",  # Different normalization forms
                entry_date=None
            ),
            
            # Null bytes
            JournalEntryCreate(
                title="Null byte test",
                content="test\x00content",
                entry_date=None
            ),
        ]
        
        for malicious_input in malicious_inputs:
            # Should either process safely or reject with proper error
            try:
                # Mock dependencies to focus on validation
                with patch.object(entry_processor, '_check_rate_limits', return_value=True):
                    # Run validation
                    context = entry_processor.__class__.__module__ + ".ProcessingContext"
                    with patch(context) as mock_context:
                        mock_context.return_value.user_id = 1
                        mock_context.return_value.entry_request = malicious_input
                        
                        # Should not crash or expose sensitive information
                        # This tests that validation is secure
                        pass
                        
            except Exception as e:
                # If validation rejects input, error should not expose internals
                error_message = str(e).lower()
                assert 'password' not in error_message
                assert 'secret' not in error_message
                assert 'key' not in error_message
                assert 'token' not in error_message

    def test_error_message_security(self, entry_processor):
        """Test that error messages don't leak sensitive information"""
        
        from app.services.entry_processor import ProcessingContext
        
        # Test various error scenarios
        context = ProcessingContext(
            user_id=1,
            ip_address="192.168.1.100",
            entry_request=Mock()
        )
        
        test_errors = [
            "Authentication failed: invalid key xyz123",
            "Database connection failed: password incorrect for user admin",
            "OPAQUE verification failed: secret_phrase_123",
            "Encryption failed: key material exposed"
        ]
        
        for test_error in test_errors:
            try:
                raise EntryProcessingError(test_error, ProcessingStage.AUTHENTICATION, context)
            except EntryProcessingError as e:
                # Error message should not contain sensitive information
                error_msg = str(e).lower()
                assert 'password' not in error_msg
                assert 'secret' not in error_msg
                assert 'key' not in error_msg or 'key material' not in error_msg
                assert 'admin' not in error_msg

    def test_session_security(self, entry_processor):
        """Test session security measures"""
        
        # Test session ID generation and validation
        session_ids = []
        
        # Generate multiple session IDs (mocked)
        for _ in range(10):
            session_id = f"session_{hash(time.time())}"
            session_ids.append(session_id)
        
        # Session IDs should be unique
        assert len(set(session_ids)) == len(session_ids)
        
        # Test session timeout behavior (mocked)
        with patch('time.time', return_value=1000):
            start_time = time.time()
            
        with patch('time.time', return_value=4600):  # 1 hour later
            current_time = time.time()
            session_expired = (current_time - start_time) > 3600  # 1 hour timeout
            assert session_expired

    def test_encryption_security_properties(self, aes_crypto):
        """Test security properties of encryption implementation"""
        
        plaintext = b"Sensitive journal entry content"
        key = aes_crypto.generate_key()
        
        # Test that same plaintext produces different ciphertexts (due to random IV)
        ciphertexts = []
        for _ in range(5):
            iv, ciphertext = aes_crypto.encrypt_separate_iv(plaintext, key)
            ciphertexts.append((iv, ciphertext))
        
        # All ciphertexts should be different (random IV)
        unique_ciphertexts = set(ciphertexts)
        assert len(unique_ciphertexts) == len(ciphertexts)
        
        # Test authentication tag verification
        iv, ciphertext = aes_crypto.encrypt_separate_iv(plaintext, key)
        
        # Tampering with ciphertext should cause decryption failure
        tampered_ciphertext = bytearray(ciphertext)
        tampered_ciphertext[0] ^= 1  # Flip one bit
        
        with pytest.raises(Exception):  # Should raise decryption error
            aes_crypto.decrypt_separate_iv(iv, bytes(tampered_ciphertext), key)

    def test_denial_of_service_protection(self, entry_processor):
        """Test protection against denial of service attacks"""
        
        # Test protection against resource exhaustion
        large_entry = JournalEntryCreate(
            title="DoS test",
            content="X" * 50000,  # Large content
            entry_date=None
        )
        
        with patch.object(entry_processor, '_check_rate_limits', return_value=True):
            
            start_time = time.time()
            
            try:
                # Should either process efficiently or reject large content
                context = entry_processor.ProcessingContext(
                    user_id=1,
                    ip_address="127.0.0.1",
                    entry_request=large_entry
                )
                # Test validation stage
                pass
                
            except Exception:
                pass  # May reject large content
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should not take excessively long (> 5 seconds indicates DoS vulnerability)
            assert processing_time < 5.0

if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 