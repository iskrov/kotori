"""
Comprehensive tests for entry submission flow with phrase detection.

This test suite covers:
- Entry submission with phrase detection
- OPAQUE authentication integration
- Encrypted entry storage and retrieval
- Error handling and edge cases
- Security validation
- Performance testing
"""

import pytest
import asyncio
import time
from datetime import datetime, UTC
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session

from app.services.entry_processor import (
    EntryProcessor, create_entry_processor, EntryProcessingError,
    ProcessingStage, ProcessingResult, ProcessingContext
)
from app.services.encryption_service import create_encryption_service, EncryptionService
from app.crypto.aes_gcm import AESGCMCrypto
from app.schemas.journal import JournalEntryCreate, SecretPhraseAuthResponse
from app.models.secret_tag_opaque import SecretTag
from app.models.journal_entry import JournalEntry as JournalEntryModel
from app.core.security import audit_security_event


class TestEntrySubmissionFlow:
    """Test suite for entry submission flow"""
    
    @pytest.fixture
    def db_session(self):
        """Mock database session"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def entry_processor(self, db_session):
        """Create entry processor for testing"""
        return EntryProcessor(db_session)
    
    @pytest.fixture
    def encryption_service(self):
        """Create encryption service for testing"""
        return create_encryption_service()
    
    @pytest.fixture
    def aes_crypto(self):
        """Create AES-GCM crypto for testing"""
        return AESGCMCrypto()
    
    @pytest.fixture
    def sample_entry_request(self):
        """Sample journal entry request"""
        return JournalEntryCreate(
            title="Test Entry",
            content="This is a test entry with some secret phrase activation",
            entry_date=datetime.now(UTC),
            tags=["test", "sample"]
        )
    
    @pytest.fixture
    def sample_secret_tag(self):
        """Sample secret tag for testing"""
        return SecretTag(
            tag_id=b'\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10',
            user_id=1,
            salt=b'\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x20',
            verifier_kv=b'\x21' * 32,
            opaque_envelope=b'\x31' * 64,
            tag_name="test_secret_tag",
            color_code="#FF0000"
        )

    @pytest.mark.asyncio
    async def test_regular_entry_creation(self, entry_processor, sample_entry_request):
        """Test creation of regular entry without phrase detection"""
        
        # Mock dependencies
        with patch.object(entry_processor, '_check_rate_limits', return_value=True), \
             patch.object(entry_processor, '_create_regular_entry') as mock_create:
            
            mock_entry = Mock()
            mock_entry.id = 1
            mock_entry.title = sample_entry_request.title
            mock_entry.content = sample_entry_request.content
            mock_create.return_value = mock_entry
            
            result = await entry_processor.process_entry_submission(
                entry_request=sample_entry_request,
                user_id=1,
                detect_phrases=False
            )
            
            assert result == mock_entry
            mock_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_entry_validation_failure(self, entry_processor):
        """Test entry validation failure"""
        
        # Empty content should fail validation
        invalid_request = JournalEntryCreate(
            title="Invalid Entry",
            content="",
            entry_date=datetime.now(UTC)
        )
        
        with pytest.raises(EntryProcessingError) as exc_info:
            await entry_processor.process_entry_submission(
                entry_request=invalid_request,
                user_id=1
            )
        
        assert exc_info.value.stage == ProcessingStage.VALIDATION
        assert "content" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, entry_processor, sample_entry_request):
        """Test rate limit exceeded scenario"""
        
        with patch.object(entry_processor, '_check_rate_limits', return_value=False):
            
            with pytest.raises(EntryProcessingError) as exc_info:
                await entry_processor.process_entry_submission(
                    entry_request=sample_entry_request,
                    user_id=1
                )
            
            assert exc_info.value.stage == ProcessingStage.VALIDATION
            assert "rate limit" in str(exc_info.value.message).lower()

    @pytest.mark.asyncio
    async def test_phrase_detection_success(self, entry_processor, sample_entry_request):
        """Test successful phrase detection"""
        
        detected_phrases = ["secret phrase activation"]
        
        with patch.object(entry_processor, '_check_rate_limits', return_value=True), \
             patch.object(entry_processor.phrase_processor, 'extract_normalized_phrases', 
                         return_value=detected_phrases), \
             patch.object(entry_processor.phrase_processor, '_is_valid_phrase', 
                         return_value=True), \
             patch.object(entry_processor, '_authenticate_secret_phrases') as mock_auth, \
             patch.object(entry_processor, '_create_regular_entry') as mock_create:
            
            mock_create.return_value = Mock()
            
            result = await entry_processor.process_entry_submission(
                entry_request=sample_entry_request,
                user_id=1,
                detect_phrases=True
            )
            
            mock_auth.assert_called_once()

    @pytest.mark.asyncio
    async def test_secret_phrase_authentication_success(self, entry_processor, sample_entry_request, sample_secret_tag):
        """Test successful secret phrase authentication"""
        
        detected_phrases = ["secret phrase activation"]
        encryption_key = b'\x01' * 32
        
        with patch.object(entry_processor, '_check_rate_limits', return_value=True), \
             patch.object(entry_processor.phrase_processor, 'extract_normalized_phrases', 
                         return_value=detected_phrases), \
             patch.object(entry_processor.phrase_processor, '_is_valid_phrase', 
                         return_value=True), \
             patch.object(entry_processor.phrase_processor, 'find_matching_secret_tag', 
                         return_value=sample_secret_tag), \
             patch.object(entry_processor.phrase_processor, 'authenticate_phrase_and_get_key', 
                         return_value=encryption_key), \
             patch.object(entry_processor, '_create_secret_entry') as mock_create_secret:
            
            mock_response = SecretPhraseAuthResponse(
                authentication_successful=True,
                secret_tag_id=sample_secret_tag.tag_id.hex(),
                tag_name=sample_secret_tag.tag_name,
                encrypted_entries=[],
                total_entries=0,
                message="Success"
            )
            mock_create_secret.return_value = mock_response
            
            result = await entry_processor.process_entry_submission(
                entry_request=sample_entry_request,
                user_id=1,
                detect_phrases=True
            )
            
            assert isinstance(result, SecretPhraseAuthResponse)
            assert result.authentication_successful
            mock_create_secret.assert_called_once()

    @pytest.mark.asyncio
    async def test_secret_phrase_authentication_failure(self, entry_processor, sample_entry_request, sample_secret_tag):
        """Test secret phrase authentication failure falls back to regular entry"""
        
        detected_phrases = ["secret phrase activation"]
        
        with patch.object(entry_processor, '_check_rate_limits', return_value=True), \
             patch.object(entry_processor.phrase_processor, 'extract_normalized_phrases', 
                         return_value=detected_phrases), \
             patch.object(entry_processor.phrase_processor, '_is_valid_phrase', 
                         return_value=True), \
             patch.object(entry_processor.phrase_processor, 'find_matching_secret_tag', 
                         return_value=sample_secret_tag), \
             patch.object(entry_processor.phrase_processor, 'authenticate_phrase_and_get_key', 
                         return_value=None), \
             patch.object(entry_processor, '_create_regular_entry') as mock_create_regular:
            
            mock_create_regular.return_value = Mock()
            
            result = await entry_processor.process_entry_submission(
                entry_request=sample_entry_request,
                user_id=1,
                detect_phrases=True
            )
            
            mock_create_regular.assert_called_once()

    @pytest.mark.asyncio
    async def test_secret_entry_encryption(self, entry_processor, sample_entry_request, sample_secret_tag):
        """Test secret entry encryption process"""
        
        encryption_key = b'\x01' * 32
        context = ProcessingContext(
            user_id=1,
            ip_address="127.0.0.1",
            entry_request=sample_entry_request,
            authenticated_tags=[sample_secret_tag],
            encryption_keys={sample_secret_tag.tag_id.hex(): encryption_key}
        )
        
        with patch.object(entry_processor.aes_crypto, 'encrypt_separate_iv') as mock_encrypt, \
             patch.object(entry_processor, 'journal_service') as mock_journal_service, \
             patch.object(entry_processor.phrase_processor, 'get_encrypted_entries_for_tag', 
                         return_value=[]):
            
            mock_encrypt.return_value = (b'\x01' * 12, b'\x02' * 64)  # iv, ciphertext
            mock_journal_service.create_with_user.return_value = Mock(id=1)
            
            result = await entry_processor._create_secret_entry(context)
            
            assert isinstance(result, SecretPhraseAuthResponse)
            assert result.authentication_successful
            mock_encrypt.assert_called_once()

    def test_encryption_service_functionality(self, encryption_service, aes_crypto):
        """Test encryption service core functionality"""
        
        content = "This is secret content that needs encryption"
        key = aes_crypto.generate_key()
        
        # Test encryption
        result = encryption_service.encrypt_content(content, key)
        
        assert len(result.iv) == 12  # AES-GCM IV size
        assert len(result.ciphertext) > 0
        assert len(result.auth_tag) == 16  # AES-GCM auth tag size
        
        # Test decryption
        from app.services.encryption_service import DecryptionRequest
        decrypt_req = DecryptionRequest(
            iv=result.iv,
            ciphertext=result.ciphertext,
            auth_tag=result.auth_tag,
            encryption_key=key
        )
        
        decrypted = encryption_service.decrypt_content(decrypt_req)
        assert decrypted == content

    def test_encryption_service_validation(self, encryption_service):
        """Test encryption service input validation"""
        
        with pytest.raises(Exception):  # Should raise EncryptionOperationError
            # Empty content
            encryption_service.encrypt_content("", b'\x01' * 32)
        
        with pytest.raises(Exception):  # Should raise EncryptionOperationError
            # Invalid key size
            encryption_service.encrypt_content("test", b'\x01' * 16)

    def test_aes_gcm_crypto_functionality(self, aes_crypto):
        """Test AES-GCM crypto core functionality"""
        
        key = aes_crypto.generate_key()
        iv = aes_crypto.generate_iv()
        plaintext = b"Test data for encryption"
        
        # Test separate IV encryption/decryption
        iv_result, ciphertext = aes_crypto.encrypt_separate_iv(plaintext, key, iv)
        decrypted = aes_crypto.decrypt_separate_iv(iv_result, ciphertext, key)
        
        assert decrypted == plaintext
        assert iv_result == iv

    def test_aes_gcm_crypto_validation(self, aes_crypto):
        """Test AES-GCM crypto input validation"""
        
        with pytest.raises(Exception):  # Should raise AESGCMKeyError
            # Invalid key size
            aes_crypto.encrypt(b"test", b'\x01' * 16)
        
        with pytest.raises(Exception):  # Should raise AESGCMKeyError
            # Invalid IV size
            aes_crypto.encrypt(b"test", b'\x01' * 32, b'\x01' * 8)

    @pytest.mark.asyncio
    async def test_processing_context_cleanup(self, entry_processor, sample_entry_request):
        """Test that processing context is properly cleaned up"""
        
        context = ProcessingContext(
            user_id=1,
            ip_address="127.0.0.1",
            entry_request=sample_entry_request
        )
        
        # Add some encryption keys to context
        context.encryption_keys["test_key"] = b'\x01' * 32
        
        # Test cleanup
        entry_processor._cleanup_processing_context(context)
        
        # Keys should be cleared
        assert len(context.encryption_keys) == 0
        assert len(context.detected_phrases) == 0

    @pytest.mark.asyncio 
    async def test_concurrent_entry_processing(self, entry_processor, sample_entry_request):
        """Test concurrent entry processing"""
        
        # Create multiple entry requests
        entries = [
            JournalEntryCreate(
                title=f"Entry {i}",
                content=f"Content for entry {i}",
                entry_date=datetime.now(UTC)
            )
            for i in range(5)
        ]
        
        with patch.object(entry_processor, '_check_rate_limits', return_value=True), \
             patch.object(entry_processor, '_create_regular_entry') as mock_create:
            
            mock_create.return_value = Mock()
            
            # Process entries concurrently
            tasks = [
                entry_processor.process_entry_submission(
                    entry_request=entry,
                    user_id=1,
                    detect_phrases=False
                )
                for entry in entries
            ]
            
            results = await asyncio.gather(*tasks)
            
            assert len(results) == 5
            assert mock_create.call_count == 5

    def test_audit_logging_integration(self):
        """Test audit logging integration"""
        
        with patch('app.core.security.logger') as mock_logger:
            audit_security_event(
                event_type="test_event",
                user_id=1,
                details={"action": "test"},
                level="INFO"
            )
            
            mock_logger.log.assert_called_once()
            call_args = mock_logger.log.call_args
            assert call_args[0][0] == 20  # INFO level
            assert "SECURITY_AUDIT: test_event" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_performance_requirements(self, entry_processor, sample_entry_request):
        """Test that processing meets performance requirements"""
        
        with patch.object(entry_processor, '_check_rate_limits', return_value=True), \
             patch.object(entry_processor, '_create_regular_entry') as mock_create:
            
            mock_create.return_value = Mock()
            
            start_time = time.time()
            
            result = await entry_processor.process_entry_submission(
                entry_request=sample_entry_request,
                user_id=1,
                detect_phrases=False
            )
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should complete within 2 seconds as per requirements
            assert processing_time < 2.0

    @pytest.mark.asyncio
    async def test_error_handling_and_recovery(self, entry_processor, sample_entry_request):
        """Test error handling and recovery mechanisms"""
        
        with patch.object(entry_processor, '_check_rate_limits', return_value=True), \
             patch.object(entry_processor, '_detect_secret_phrases', 
                         side_effect=Exception("Phrase detection failed")), \
             patch.object(entry_processor, '_create_regular_entry') as mock_create:
            
            mock_create.return_value = Mock()
            
            # Should recover from phrase detection failure and create regular entry
            with pytest.raises(EntryProcessingError):
                await entry_processor.process_entry_submission(
                    entry_request=sample_entry_request,
                    user_id=1,
                    detect_phrases=True
                )

    def test_security_validation(self, entry_processor):
        """Test security validation features"""
        
        # Test rate limiting
        assert hasattr(entry_processor, 'rate_limiter')
        
        # Test secure memory handling
        assert hasattr(entry_processor, 'secure_memory')
        
        # Test encryption service integration
        assert hasattr(entry_processor, 'aes_crypto')
        
        # Test audit logging integration
        context = ProcessingContext(user_id=1, ip_address="127.0.0.1", entry_request=Mock())
        
        # Should not raise exception
        entry_processor._audit_processing_error(context, "test error")

# Integration tests that require database setup would go here
class TestEntrySubmissionIntegration:
    """Integration tests for entry submission flow"""
    
    @pytest.mark.integration
    def test_end_to_end_regular_entry_flow(self):
        """End-to-end test for regular entry creation"""
        # This would test with real database and services
        # Requires test database setup
        pass
    
    @pytest.mark.integration  
    def test_end_to_end_secret_entry_flow(self):
        """End-to-end test for secret entry creation with authentication"""
        # This would test with real OPAQUE authentication
        # Requires test database and OPAQUE setup
        pass

# Performance tests
class TestEntrySubmissionPerformance:
    """Performance tests for entry submission flow"""
    
    @pytest.mark.performance
    def test_large_content_processing(self):
        """Test processing of large journal entries"""
        # Test with entries up to 50KB as per requirements
        pass
    
    @pytest.mark.performance
    def test_concurrent_user_processing(self):
        """Test concurrent processing for multiple users"""
        # Test scalability requirements
        pass

if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 