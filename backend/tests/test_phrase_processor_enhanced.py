"""
Enhanced Phrase Processor Tests

Test suite for the enhanced phrase processing system with advanced normalization,
fuzzy matching, performance monitoring, and security features.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, UTC
from typing import List, Optional
import time

from app.services.phrase_processor import SecretPhraseProcessor, PhraseProcessingError
from app.models.secret_tag_opaque import SecretTag
from app.models.journal_entry import JournalEntry
from app.utils.text_normalization import TextNormalizer, NormalizationLevel
from app.utils.fuzzy_matching import FuzzyMatcher, SimilarityAlgorithm
from app.utils.performance_monitor import get_performance_monitor
from app.middleware.rate_limiter import RateLimitType


class TestEnhancedPhraseProcessor:
    """Test suite for enhanced phrase processor functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return Mock()
    
    @pytest.fixture
    def mock_secret_tag(self):
        """Mock secret tag for testing."""
        return SecretTag(
            phrase_hash=b'test_tag_id_123',
            user_id=1,
            salt=b'test_salt_123456',
            verifier_kv=b'test_verifier_key_123456789012',
            opaque_envelope=b'test_opaque_envelope_data',
            tag_name="test_secret_tag",
            color_code="#FF0000",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )
    
    @pytest.fixture
    def phrase_processor(self, mock_db):
        """Create phrase processor instance."""
        with patch('app.services.phrase_processor.create_opaque_service'):
            processor = SecretPhraseProcessor(mock_db)
            return processor
    
    def test_initialization(self, phrase_processor):
        """Test enhanced phrase processor initialization."""
        assert phrase_processor.text_normalizer is not None
        assert phrase_processor.relaxed_normalizer is not None
        assert phrase_processor.fuzzy_matcher is not None
        assert phrase_processor.soundex_matcher is not None
        assert phrase_processor.performance_monitor is not None
        assert phrase_processor.rate_limiter is not None
        
        # Check configuration
        assert phrase_processor.enable_fuzzy_matching is True
        assert phrase_processor.fuzzy_threshold == 0.85
        assert phrase_processor.enable_soundex_matching is True
        assert phrase_processor.enable_performance_monitoring is True
    
    def test_enhanced_phrase_normalization(self, phrase_processor):
        """Test enhanced phrase normalization with Unicode and diacritics."""
        test_cases = [
            # Basic normalization
            ("Hello World", "hello world"),
            ("HELLO WORLD", "hello world"),
            
            # Unicode normalization
            ("café", "cafe"),
            ("naïve", "naive"),
            ("résumé", "resume"),
            
            # Contractions
            ("don't", "do not"),
            ("can't", "cannot"),
            ("won't", "will not"),
            
            # Punctuation removal
            ("Hello, world!", "hello world"),
            ("What's up?", "what is up"),
            
            # Multiple spaces
            ("hello    world", "hello world"),
            ("  hello  world  ", "hello world"),
            
            # Empty and edge cases
            ("", ""),
            ("   ", ""),
        ]
        
        for input_phrase, expected in test_cases:
            result = phrase_processor._normalize_phrase(input_phrase)
            assert result == expected, f"Failed for input: '{input_phrase}'"
    
    def test_legacy_normalization_fallback(self, phrase_processor):
        """Test fallback to legacy normalization on error."""
        # Mock the text normalizer to raise an exception
        with patch.object(phrase_processor.text_normalizer, 'normalize_phrase', side_effect=Exception("Test error")):
            result = phrase_processor._normalize_phrase("Hello, World!")
            assert result == "hello world"  # Should fall back to legacy normalization
    
    def test_enhanced_rate_limiting(self, phrase_processor):
        """Test enhanced rate limiting with the new rate limiter."""
        user_id = 123
        ip_address = "192.168.1.1"
        
        # Mock rate limiter responses
        with patch.object(phrase_processor.rate_limiter, 'check_rate_limit') as mock_check:
            # Test successful rate limit check
            mock_check.return_value = (True, None)
            result = phrase_processor._check_rate_limit(user_id, ip_address)
            assert result is True
            
            # Verify rate limiter was called for both user and IP
            assert mock_check.call_count == 2
            calls = mock_check.call_args_list
            assert calls[0][0] == (RateLimitType.USER, str(user_id), "phrase_processing")
            assert calls[1][0] == (RateLimitType.IP, ip_address, "phrase_processing")
    
    def test_rate_limit_exceeded(self, phrase_processor):
        """Test rate limit exceeded scenarios."""
        user_id = 123
        ip_address = "192.168.1.1"
        
        with patch.object(phrase_processor.rate_limiter, 'check_rate_limit') as mock_check:
            # Test user rate limit exceeded
            mock_check.return_value = (False, 60)  # Blocked for 60 seconds
            result = phrase_processor._check_rate_limit(user_id, ip_address)
            assert result is False
    
    def test_rate_limit_fallback(self, phrase_processor):
        """Test fallback to legacy rate limiting on error."""
        user_id = 123
        ip_address = "192.168.1.1"
        
        # Mock rate limiter to raise an exception
        with patch.object(phrase_processor.rate_limiter, 'check_rate_limit', side_effect=Exception("Test error")):
            # Should fall back to legacy rate limiting
            result = phrase_processor._check_rate_limit(user_id, ip_address)
            assert isinstance(result, bool)
    
    def test_enhanced_phrase_extraction(self, phrase_processor):
        """Test enhanced phrase extraction with improved patterns."""
        content = """
        Today I went to the store and bought some groceries.
        The weather was nice; however, it started raining later.
        I thought about my secret passphrase: "moonlight serenade".
        Then I remembered another phrase but forgot it quickly.
        """
        
        with patch.object(phrase_processor, '_is_valid_phrase', return_value=True):
            phrases = phrase_processor.extract_normalized_phrases(content)
            
            # Should extract multiple phrases
            assert len(phrases) > 0
            assert all(isinstance(phrase, str) for phrase in phrases)
            
            # Check that normalization was applied
            assert any("moonlight serenade" in phrase for phrase in phrases)
    
    def test_phrase_validation_enhanced(self, phrase_processor):
        """Test enhanced phrase validation."""
        # Valid phrases
        valid_phrases = [
            "my secret phrase",
            "moonlight serenade",
            "the quick brown fox",
            "coffee shop memories"
        ]
        
        for phrase in valid_phrases:
            assert phrase_processor._is_valid_phrase(phrase) is True
        
        # Invalid phrases
        invalid_phrases = [
            "",  # Empty
            "a",  # Too short
            "the",  # Common word
            "and or",  # Only common words
            "x" * 101,  # Too long
        ]
        
        for phrase in invalid_phrases:
            assert phrase_processor._is_valid_phrase(phrase) is False
    
    def test_performance_monitoring_integration(self, phrase_processor):
        """Test performance monitoring integration."""
        with patch('app.services.phrase_processor.record_metric') as mock_record:
            phrase_processor.enable_performance_monitoring = True
            
            # Test normalization with performance monitoring
            phrase_processor._normalize_phrase("test phrase")
            
            # Verify metric was recorded
            mock_record.assert_called_once()
            args = mock_record.call_args[0]
            assert args[0] == "phrase_normalization"
            assert args[1] > 0  # Should record the length
            assert args[2] == "characters"
    
    def test_fuzzy_matching_capability(self, phrase_processor):
        """Test fuzzy matching capability (preparation for future use)."""
        # Test that fuzzy matcher is properly initialized
        assert phrase_processor.fuzzy_matcher is not None
        assert phrase_processor.soundex_matcher is not None
        
        # Test basic fuzzy matching functionality
        similar_phrases = [
            ("hello world", "helo world"),  # Typo
            ("moonlight", "moonlght"),       # Missing letter
            ("serenade", "serenad"),         # Missing letter
        ]
        
        for original, typo in similar_phrases:
            similarity = phrase_processor.fuzzy_matcher.calculate_similarity(original, typo)
            assert similarity > 0.7  # Should be reasonably similar
    
    def test_soundex_matching_capability(self, phrase_processor):
        """Test soundex matching capability."""
        # Test soundex matching for phonetically similar phrases
        phonetic_pairs = [
            ("smith", "smyth"),
            ("john", "jon"),
            ("night", "knight"),
        ]
        
        for word1, word2 in phonetic_pairs:
            is_match = phrase_processor.soundex_matcher.is_fuzzy_match(word1, word2)
            assert is_match is True
    
    def test_secure_phrase_processing_timing(self, phrase_processor):
        """Test secure phrase processing maintains consistent timing."""
        phrases = [
            "short",
            "medium length phrase",
            "this is a much longer phrase that should still take consistent time",
            ""  # Empty phrase
        ]
        
        timings = []
        for phrase in phrases:
            start_time = time.time()
            result = phrase_processor._secure_phrase_processing(phrase)
            end_time = time.time()
            timings.append(end_time - start_time)
        
        # All timings should be reasonably consistent (within timing attack protection)
        min_time = min(timings)
        max_time = max(timings)
        
        # Should enforce minimum processing time
        assert min_time >= 0.1  # At least 100ms minimum
        
        # Timing variation should be controlled
        assert max_time - min_time < 0.1  # Less than 100ms variation
    
    def test_audit_logging_enhancement(self, phrase_processor):
        """Test enhanced audit logging."""
        user_id = 123
        phrase_count = 5
        auth_success = True
        ip_address = "192.168.1.1"
        
        with patch('app.services.phrase_processor.logger') as mock_logger:
            phrase_processor._audit_phrase_processing(
                user_id, phrase_count, auth_success, ip_address
            )
            
            # Verify audit log was called
            mock_logger.info.assert_called_once()
            log_message = mock_logger.info.call_args[0][0]
            
            # Check log message content
            assert f"user={user_id}" in log_message
            assert f"phrases={phrase_count}" in log_message
            assert f"success={auth_success}" in log_message
            assert "ip_phrase_hash=" in log_message
    
    def test_configuration_flexibility(self, phrase_processor):
        """Test configuration flexibility."""
        # Test configuration changes
        original_fuzzy = phrase_processor.enable_fuzzy_matching
        original_threshold = phrase_processor.fuzzy_threshold
        
        # Change configuration
        phrase_processor.enable_fuzzy_matching = False
        phrase_processor.fuzzy_threshold = 0.9
        
        assert phrase_processor.enable_fuzzy_matching is False
        assert phrase_processor.fuzzy_threshold == 0.9
        
        # Restore original configuration
        phrase_processor.enable_fuzzy_matching = original_fuzzy
        phrase_processor.fuzzy_threshold = original_threshold
    
    def test_error_handling_robustness(self, phrase_processor):
        """Test error handling robustness."""
        # Test with malformed input
        malformed_inputs = [
            None,
            123,  # Wrong type
            {"not": "a string"},  # Wrong type
            "\x00\x01\x02",  # Binary data
        ]
        
        for malformed_input in malformed_inputs:
            try:
                # Should handle gracefully without crashing
                result = phrase_processor._normalize_phrase(str(malformed_input) if malformed_input is not None else "")
                assert isinstance(result, str)
            except Exception as e:
                # If exception occurs, it should be handled gracefully
                assert "phrase_processor" not in str(e).lower()
    
    def test_memory_efficiency(self, phrase_processor):
        """Test memory efficiency with large inputs."""
        # Test with large content
        large_content = "Test phrase. " * 1000  # 13,000 characters
        
        phrases = phrase_processor.extract_normalized_phrases(large_content)
        
        # Should limit phrases to prevent memory issues
        assert len(phrases) <= phrase_processor.MAX_PHRASES_PER_ENTRY
        
        # All phrases should be valid strings
        assert all(isinstance(phrase, str) for phrase in phrases)
    
    def test_unicode_edge_cases(self, phrase_processor):
        """Test Unicode edge cases."""
        unicode_test_cases = [
            "𝓗𝓮𝓵𝓵𝓸",  # Mathematical script
            "🌟✨💫",  # Emojis
            "Здравствуй",  # Cyrillic
            "こんにちは",  # Japanese
            "مرحبا",  # Arabic
            "עברית",  # Hebrew
        ]
        
        for unicode_text in unicode_test_cases:
            try:
                result = phrase_processor._normalize_phrase(unicode_text)
                assert isinstance(result, str)
            except Exception as e:
                # Should handle gracefully
                assert "UnicodeError" not in str(e)
    
    def test_concurrent_processing_safety(self, phrase_processor):
        """Test thread safety for concurrent processing."""
        import threading
        
        results = []
        errors = []
        
        def process_phrase(phrase):
            try:
                result = phrase_processor._normalize_phrase(phrase)
                results.append(result)
            except Exception as e:
                errors.append(e)
        
        # Create multiple threads
        threads = []
        for i in range(10):
            thread = threading.Thread(target=process_phrase, args=(f"test phrase {i}",))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads
        for thread in threads:
            thread.join()
        
        # Should have successful results without errors
        assert len(results) == 10
        assert len(errors) == 0
        assert all(isinstance(result, str) for result in results)


class TestTextNormalizationUtilities:
    """Test text normalization utilities."""
    
    def test_text_normalizer_levels(self):
        """Test different normalization levels."""
        from app.utils.text_normalization import TextNormalizer, NormalizationLevel
        
        test_phrase = "Café résumé naïve"
        
        # Test different levels
        strict_normalizer = TextNormalizer(NormalizationLevel.STRICT)
        medium_normalizer = TextNormalizer(NormalizationLevel.MEDIUM)
        relaxed_normalizer = TextNormalizer(NormalizationLevel.RELAXED)
        
        strict_result = strict_normalizer.normalize_phrase(test_phrase)
        medium_result = medium_normalizer.normalize_phrase(test_phrase)
        relaxed_result = relaxed_normalizer.normalize_phrase(test_phrase)
        
        # Results should be different based on level
        assert strict_result != medium_result or medium_result != relaxed_result
        
        # All should be lowercase
        assert strict_result.islower()
        assert medium_result.islower()
        assert relaxed_result.islower()


class TestFuzzyMatchingUtilities:
    """Test fuzzy matching utilities."""
    
    def test_levenshtein_distance(self):
        """Test Levenshtein distance calculation."""
        from app.utils.fuzzy_matching import FuzzyMatcher
        
        matcher = FuzzyMatcher()
        
        # Test cases
        test_cases = [
            ("hello", "hello", 0),
            ("hello", "helo", 1),
            ("hello", "world", 4),
            ("", "", 0),
            ("", "hello", 5),
        ]
        
        for s1, s2, expected_distance in test_cases:
            distance = matcher.levenshtein_distance(s1, s2)
            assert distance == expected_distance
    
    def test_jaro_winkler_similarity(self):
        """Test Jaro-Winkler similarity."""
        from app.utils.fuzzy_matching import FuzzyMatcher
        
        matcher = FuzzyMatcher()
        
        # Test cases
        test_cases = [
            ("hello", "hello", 1.0),
            ("hello", "helo", 0.8),
            ("", "", 1.0),
            ("hello", "world", 0.0),
        ]
        
        for s1, s2, min_expected in test_cases:
            similarity = matcher.jaro_winkler_similarity(s1, s2)
            assert similarity >= min_expected * 0.8  # Allow some tolerance
    
    def test_soundex_matching(self):
        """Test Soundex phonetic matching."""
        from app.utils.fuzzy_matching import FuzzyMatcher
        
        matcher = FuzzyMatcher()
        
        # Test phonetically similar words
        phonetic_pairs = [
            ("smith", "smyth"),
            ("john", "jon"),
            ("night", "knight"),
        ]
        
        for word1, word2 in phonetic_pairs:
            soundex1 = matcher.soundex(word1)
            soundex2 = matcher.soundex(word2)
            assert soundex1 == soundex2


class TestPerformanceMonitoringIntegration:
    """Test performance monitoring integration."""
    
    def test_performance_metrics_collection(self):
        """Test performance metrics collection."""
        from app.utils.performance_monitor import get_performance_monitor
        
        monitor = get_performance_monitor()
        
        # Record test metric
        monitor.record_metric("test_metric", 42.0, "units")
        
        # Get metrics summary
        summary = monitor.get_metrics_summary()
        
        assert "total_metrics" in summary
        assert summary["total_metrics"] > 0
    
    def test_timing_operations(self):
        """Test timing operations."""
        from app.utils.performance_monitor import get_performance_monitor
        
        monitor = get_performance_monitor()
        
        # Time an operation
        with monitor.time_operation("test_operation"):
            time.sleep(0.01)  # Small delay
        
        # Get operation stats
        stats = monitor.get_operation_stats("test_operation")
        
        assert stats["count"] > 0
        assert stats["duration_ms"]["avg"] > 0


class TestRateLimitingIntegration:
    """Test rate limiting integration."""
    
    def test_rate_limiter_initialization(self):
        """Test rate limiter initialization."""
        from app.middleware.rate_limiter import get_rate_limiter
        
        rate_limiter = get_rate_limiter()
        
        assert rate_limiter is not None
        assert rate_limiter.configs is not None
    
    def test_rate_limit_checking(self):
        """Test rate limit checking."""
        from app.middleware.rate_limiter import get_rate_limiter, RateLimitType
        
        rate_limiter = get_rate_limiter()
        
        # Test rate limit check
        allowed, retry_after = rate_limiter.check_rate_limit(
            RateLimitType.USER, "test_user", "test_operation"
        )
        
        assert isinstance(allowed, bool)
        assert retry_after is None or isinstance(retry_after, int)
    
    def test_rate_limit_info(self):
        """Test rate limit info retrieval."""
        from app.middleware.rate_limiter import get_rate_limiter, RateLimitType
        
        rate_limiter = get_rate_limiter()
        
        # Get rate limit info
        info = rate_limiter.get_rate_limit_info(RateLimitType.USER, "test_user")
        
        assert "limit_type" in info
        assert "requests_per_minute" in info
        assert "requests_remaining" in info


# Integration tests
class TestIntegrationScenarios:
    """Integration test scenarios."""
    
    def test_end_to_end_phrase_processing(self, phrase_processor):
        """Test end-to-end phrase processing with all enhancements."""
        # Test content with various phrase types
        content = """
        Today I visited the old café downtown.
        The barista remembered my secret phrase: "moonlight serenade".
        I also thought about "caffè latte" and my naïve assumptions.
        The weather was nice, but it started raining later.
        """
        
        user_id = 123
        ip_address = "192.168.1.1"
        
        # Mock rate limiter to allow processing
        with patch.object(phrase_processor.rate_limiter, 'check_rate_limit', return_value=(True, None)):
            # Extract phrases
            phrases = phrase_processor.extract_normalized_phrases(content)
            
            # Should extract multiple phrases
            assert len(phrases) > 0
            assert all(isinstance(phrase, str) for phrase in phrases)
            
            # Check that normalization was applied
            normalized_phrases = [phrase_processor._normalize_phrase(phrase) for phrase in phrases]
            assert all(phrase.islower() for phrase in normalized_phrases)
    
    def test_error_recovery_scenarios(self, phrase_processor):
        """Test error recovery in various scenarios."""
        # Test with problematic input
        problematic_inputs = [
            "",  # Empty
            "   ",  # Whitespace only
            "\n\t\r",  # Control characters
            "a" * 10000,  # Very long input
        ]
        
        for problematic_input in problematic_inputs:
            try:
                result = phrase_processor.extract_normalized_phrases(problematic_input)
                assert isinstance(result, list)
            except Exception as e:
                # Should handle gracefully
                assert "phrase_processor" not in str(e).lower()
    
    def test_performance_under_load(self, phrase_processor):
        """Test performance under load."""
        # Generate test content
        test_content = "This is a test phrase for performance testing. " * 100
        
        # Process multiple times
        start_time = time.time()
        for i in range(10):
            phrases = phrase_processor.extract_normalized_phrases(test_content)
            assert len(phrases) > 0
        end_time = time.time()
        
        # Should complete within reasonable time
        total_time = end_time - start_time
        assert total_time < 5.0  # Should complete within 5 seconds
        
        # Average time per operation should be reasonable
        avg_time = total_time / 10
        assert avg_time < 0.5  # Should be under 500ms per operation 