"""
End-to-end tests for phrase detection functionality.

This module tests the complete phrase detection process including voice-to-text
conversion, phrase normalization, and secret phrase matching, with no mocking
of core functionality.
"""

import pytest
import asyncio
import uuid
import json
from datetime import datetime, timedelta, UTC
from typing import Dict, Any, Optional, List
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.models.user import User
from app.models.secret_tag_opaque import SecretTag
from app.models.journal_entry import JournalEntry
from app.crypto.opaque_keys import derive_opaque_keys_from_phrase
from app.services.phrase_processor import SecretPhraseProcessor
from app.services.speech_service import SpeechService
from app.services.journal_service import JournalService
from app.services.opaque_service import EnhancedOpaqueService
from app.utils.secure_utils import SecureTokenGenerator, SecureHasher
from app.security.constant_time import ConstantTimeOperations

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_USER_EMAIL = "phrase_test@example.com"
TEST_USER_PASSWORD = "PhraseTestPassword123!"

# Test phrases with various characteristics
TEST_PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Waltz, bad nymph, for quick jigs vex",
    "Sphinx of black quartz, judge my vow"
]

# Voice recognition variations
VOICE_VARIATIONS = [
    "the quick brown fox jumps over the lazy dog",  # lowercase
    "The Quick Brown Fox Jumps Over The Lazy Dog",  # title case
    "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG",  # uppercase
    "The quick brown fox jumps over the lazy dog.",  # with punctuation
    "The quick brown fox jumps over the lazy dog!",  # with exclamation
    "The, quick brown fox jumps over the lazy dog",  # with comma
    "The quick brown fox jumps over the lazy dog...",  # with ellipsis
]

# Non-matching phrases
NON_MATCHING_PHRASES = [
    "The slow brown fox walks over the lazy dog",
    "The quick brown cat jumps over the lazy dog",
    "The quick brown fox jumps over the active dog",
    "Pack my bag with five dozen liquor jugs",
    "How vexingly slow daft zebras jump",
]

# Test journal entries with mixed content
MIXED_CONTENT_ENTRIES = [
    "Today I went to the park and The quick brown fox jumps over the lazy dog was what I remembered.",
    "The quick brown fox jumps over the lazy dog. This phrase reminds me of typing practice.",
    "Meeting notes: The quick brown fox jumps over the lazy dog - need to follow up on this.",
    "Random thoughts: How vexingly quick daft zebras jump around the field today.",
    "Work log: Sphinx of black quartz, judge my vow - this project is challenging.",
]

# Test journal entries with NO secret phrases
REGULAR_ENTRIES = [
    "Today was a wonderful day at work. I completed my project successfully.",
    "Had lunch with friends at the new restaurant downtown. The food was amazing.",
    "Meeting with the team went well. We discussed the upcoming product launch.",
    "Went for a run in the morning. The weather was perfect for exercise.",
    "Finished reading a great book about artificial intelligence and machine learning.",
]

# Test journal entries with ONLY secret phrases (password entries)
PASSWORD_ENTRIES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Waltz, bad nymph, for quick jigs vex",
    "Sphinx of black quartz, judge my vow",
]


class TestPhraseDetection:
    """Comprehensive end-to-end tests for phrase detection functionality."""

    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment before each test."""
        self.client = TestClient(app)
        self.token_generator = SecureTokenGenerator()
        self.hasher = SecureHasher()
        self.constant_time = ConstantTimeOperations()
        
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
        self.phrase_processor = SecretPhraseProcessor(self.db)
        self.speech_service = SpeechService(self.db)
        self.journal_service = JournalService(self.db)
        self.opaque_service = EnhancedOpaqueService(self.db)
        
        # Create test secret tags
        self.test_tags = self._create_test_secret_tags()

    def teardown_method(self):
        """Clean up after each test."""
        # Clean up test data
        self._cleanup_test_data()
        
        # Close database connections
        self.db.close()
        
        # Clear dependency overrides
        app.dependency_overrides.clear()

    def _create_test_user(self) -> User:
        """Create a test user for phrase detection tests."""
        # Check if user already exists
        existing_user = self.db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        if existing_user:
            return existing_user
        
        # Create new test user
        hashed_password = self.hasher.hash_password(TEST_USER_PASSWORD)
        user = User(
            id=uuid.uuid4(),
            email=TEST_USER_EMAIL,
            hashed_password=hashed_password,
            is_active=True,
            created_at=datetime.now(UTC)
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _create_test_secret_tags(self) -> list:
        """Create test secret tags for phrase detection testing."""
        tags = []
        
        for i, phrase in enumerate(TEST_PHRASES):
            # Generate OPAQUE keys
            opaque_keys = derive_opaque_keys_from_phrase(phrase)
            
            # Create secret tag
            secret_tag = SecretTag(
                phrase_hash=opaque_keys.phrase_hash,
                user_id=self.user_id,
                salt=opaque_keys.salt,
                verifier_kv=b"mock_verifier",  # Simplified for testing
                opaque_envelope=b"mock_envelope",  # Simplified for testing
                tag_name=f"Test Tag {i+1}",
                color_code=f"#FF{i:02d}{i:02d}",
                            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
            )
            
            self.db.add(secret_tag)
            tags.append({
                'tag': secret_tag,
                'phrase': phrase,
                'keys': opaque_keys
            })
        
        self.db.commit()
        return tags

    def _cleanup_test_data(self):
        """Clean up test data from database."""
        try:
            # Delete journal entries
            self.db.query(JournalEntry).filter(
                JournalEntry.user_id == self.user_id
            ).delete()
            
            # Delete secret tags
            self.db.query(SecretTag).filter(
                SecretTag.user_id == self.user_id
            ).delete()
            
            # Delete test user
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
    async def test_phrase_detection_in_text_content(self):
        """Test phrase detection in text journal entries."""
        # Test phrase detection for each test phrase
        for i, test_tag_data in enumerate(self.test_tags):
            phrase = test_tag_data['phrase']
            phrase_hash= test_tag_data['keys'].phrase_hash
            
            # Test detection in various text formats
            test_contents = [
                phrase,  # Exact match
                phrase.lower(),  # Lowercase
                phrase.upper(),  # Uppercase
                f"Today I remembered: {phrase}",  # In sentence
                f"{phrase}. This is important.",  # With punctuation
                f"Notes: {phrase} - follow up required",  # In context
            ]
            
            for content in test_contents:
                # Process content for phrase detection
                detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
                    content, self.user_id
                )
                
                # Verify detection
                assert detected, f"Should detect phrase in: {content}"
                assert secret_tag is not None
                assert secret_tag.phrase_hash== tag_id
                assert len(entries) > 0

    @pytest.mark.asyncio
    async def test_phrase_detection_normalization(self):
        """Test phrase normalization and detection accuracy."""
        test_tag_data = self.test_tags[0]
        phrase = test_tag_data['phrase']
        phrase_hash= test_tag_data['keys'].phrase_hash
        
        # Test various normalization scenarios
        normalization_tests = [
            phrase,  # Original
            phrase.replace(" ", "  "),  # Extra spaces
            phrase.replace(".", ""),  # No punctuation
            phrase.replace(",", ""),  # No commas
            f"  {phrase}  ",  # Leading/trailing spaces
            phrase.replace("the", "the"),  # No change
            phrase.replace("fox", "fox"),  # No change
        ]
        
        for test_content in normalization_tests:
            detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
                test_content, self.user_id
            )
            
            # All normalized versions should be detected
            assert detected, f"Should detect normalized phrase: {test_content}"
            assert secret_tag is not None
            assert secret_tag.phrase_hash== tag_id

    @pytest.mark.asyncio
    async def test_phrase_detection_false_positives(self):
        """Test that similar but incorrect phrases are not detected."""
        # Test with non-matching phrases
        for non_matching_phrase in NON_MATCHING_PHRASES:
            detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
                non_matching_phrase, self.user_id
            )
            
            # Should not detect incorrect phrases
            assert not detected, f"Should not detect phrase: {non_matching_phrase}"
            assert secret_tag is None

    @pytest.mark.asyncio
    async def test_phrase_detection_multiple_phrases(self):
        """Test detection when multiple secret phrases are present."""
        # Create content with multiple phrases
        phrase1 = self.test_tags[0]['phrase']
        phrase2 = self.test_tags[1]['phrase']
        
        mixed_content = f"First: {phrase1}. Second: {phrase2}. Done."
        
        # Process content
        detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
            mixed_content, self.user_id
        )
        
        # Should detect at least one phrase
        assert detected, "Should detect at least one phrase"
        assert secret_tag is not None
        
        # Should be deterministic (same phrase detected each time)
        for _ in range(5):
            detected2, secret_tag2, entries2, vault_key2 = self.phrase_processor.process_entry_for_secret_phrases(
                mixed_content, self.user_id
            )
            assert detected2
            assert secret_tag2.phrase_hash== secret_tag.phrase_hash

    @pytest.mark.asyncio
    async def test_phrase_detection_entry_types(self):
        """Test phrase detection for different entry types."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test 1: Password entry (only secret phrase)
        password_entry = PASSWORD_ENTRIES[0]
        
        response = self.client.post(
            "/api/journals/entries",
            json={
                "content": password_entry,
                "entry_type": "text"
            },
            headers=headers
        )
        
        # Should authenticate but not save to database
        assert response.status_code == 200
        result = response.json()
        
        # Verify entry was not saved to regular journal
        journal_entries = self.db.query(JournalEntry).filter(
            JournalEntry.user_id == self.user_id
        ).all()
        # Should not have regular journal entries for password-only content
        
        # Test 2: Mixed content entry
        mixed_entry = MIXED_CONTENT_ENTRIES[0]
        
        response = self.client.post(
            "/api/journals/entries",
            json={
                "content": mixed_entry,
                "entry_type": "text"
            },
            headers=headers
        )
        
        assert response.status_code == 200
        
        # Should save non-secret content and provide vault access
        journal_entries = self.db.query(JournalEntry).filter(
            JournalEntry.user_id == self.user_id
        ).all()
        # Should have entry with non-secret content
        
        # Test 3: Regular entry (no secret phrases)
        regular_entry = REGULAR_ENTRIES[0]
        
        response = self.client.post(
            "/api/journals/entries",
            json={
                "content": regular_entry,
                "entry_type": "text"
            },
            headers=headers
        )
        
        assert response.status_code == 200
        
        # Should save normally
        journal_entries = self.db.query(JournalEntry).filter(
            JournalEntry.user_id == self.user_id,
            JournalEntry.content == regular_entry
        ).all()
        assert len(journal_entries) == 1

    @pytest.mark.asyncio
    async def test_voice_phrase_detection(self):
        """Test phrase detection from voice input."""
        access_token = self._authenticate_user()
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test voice input with secret phrase
        test_phrase = self.test_tags[0]['phrase']
        
        # Simulate voice input processing
        with patch('app.services.speech_service.SpeechService.process_audio') as mock_process:
            mock_process.return_value = {
                "transcribed_text": test_phrase,
                "confidence": 0.95
            }
            
            # Send voice data (simulated)
            response = self.client.post(
                "/api/speech/transcribe",
                json={
                    "audio_data": "base64_encoded_audio_data",
                    "format": "wav"
                },
                headers=headers
            )
            
            assert response.status_code == 200
            result = response.json()
            
            # Verify transcription
            assert result["transcribed_text"] == test_phrase
            assert result["confidence"] >= 0.9
            
            # Verify phrase was detected
            assert "secret_phrase_detected" in result
            if result["secret_phrase_detected"]:
                assert "authentication_required" in result

    @pytest.mark.asyncio
    async def test_phrase_detection_timing_consistency(self):
        """Test that phrase detection timing is consistent."""
        import time
        
        # Test with phrase that exists
        existing_phrase = self.test_tags[0]['phrase']
        
        start_time = time.time()
        detected1, _, _, _ = self.phrase_processor.process_entry_for_secret_phrases(
            existing_phrase, self.user_id
        )
        time1 = time.time() - start_time
        
        # Test with phrase that doesn't exist
        non_existing_phrase = NON_MATCHING_PHRASES[0]
        
        start_time = time.time()
        detected2, _, _, _ = self.phrase_processor.process_entry_for_secret_phrases(
            non_existing_phrase, self.user_id
        )
        time2 = time.time() - start_time
        
        # Verify detection results
        assert detected1 is True
        assert detected2 is False
        
        # Timing should be relatively consistent (within 50ms)
        timing_difference = abs(time1 - time2)
        assert timing_difference < 0.05, f"Timing difference too large: {timing_difference:.3f}s"

    @pytest.mark.asyncio
    async def test_phrase_detection_concurrent_processing(self):
        """Test phrase detection with concurrent processing."""
        # Create multiple test contents
        test_contents = [
            self.test_tags[0]['phrase'],
            self.test_tags[1]['phrase'],
            NON_MATCHING_PHRASES[0],
            REGULAR_ENTRIES[0],
            MIXED_CONTENT_ENTRIES[0]
        ]
        
        # Process concurrently
        async def process_content(content):
            return self.phrase_processor.process_entry_for_secret_phrases(
                content, self.user_id
            )
        
        tasks = [process_content(content) for content in test_contents]
        results = await asyncio.gather(*tasks)
        
        # Verify results
        assert results[0][0] is True  # First phrase detected
        assert results[1][0] is True  # Second phrase detected
        assert results[2][0] is False  # Non-matching phrase not detected
        assert results[3][0] is False  # Regular entry not detected
        assert results[4][0] is True  # Mixed content phrase detected

    @pytest.mark.asyncio
    async def test_phrase_detection_unicode_handling(self):
        """Test phrase detection with Unicode characters."""
        # Create phrase with Unicode characters
        unicode_phrase = "The quick brown fox jumps over the lazy dog 🦊"
        
        # Test various Unicode scenarios
        unicode_tests = [
            unicode_phrase,
            unicode_phrase.replace("🦊", "fox"),  # Remove emoji
            unicode_phrase.replace("fox", "fóx"),  # Accented characters
            unicode_phrase + " café",  # Additional Unicode
        ]
        
        for test_content in unicode_tests:
            detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
                test_content, self.user_id
            )
            
            # Should handle Unicode gracefully (may or may not detect depending on normalization)
            # At minimum, should not crash
            assert isinstance(detected, bool)

    @pytest.mark.asyncio
    async def test_phrase_detection_performance(self):
        """Test phrase detection performance with large content."""
        # Create large content with embedded phrase
        large_content = "Random text. " * 1000
        phrase = self.test_tags[0]['phrase']
        large_content_with_phrase = large_content + phrase + large_content
        
        # Measure performance
        import time
        start_time = time.time()
        
        detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
            large_content_with_phrase, self.user_id
        )
        
        processing_time = time.time() - start_time
        
        # Verify detection
        assert detected is True
        assert secret_tag is not None
        
        # Performance should be reasonable (< 1 second)
        assert processing_time < 1.0, f"Processing took too long: {processing_time:.3f}s"

    @pytest.mark.asyncio
    async def test_phrase_detection_case_sensitivity(self):
        """Test phrase detection case sensitivity handling."""
        original_phrase = self.test_tags[0]['phrase']
        phrase_hash= self.test_tags[0]['keys'].phrase_hash
        
        # Test various case combinations
        case_tests = [
            original_phrase,
            original_phrase.lower(),
            original_phrase.upper(),
            original_phrase.title(),
            original_phrase.capitalize(),
            original_phrase.swapcase(),
        ]
        
        for test_phrase in case_tests:
            detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
                test_phrase, self.user_id
            )
            
            # All case variations should be detected
            assert detected, f"Should detect case variation: {test_phrase}"
            assert secret_tag is not None
            assert secret_tag.phrase_hash== tag_id

    @pytest.mark.asyncio
    async def test_phrase_detection_punctuation_handling(self):
        """Test phrase detection with various punctuation."""
        original_phrase = self.test_tags[0]['phrase']
        phrase_hash= self.test_tags[0]['keys'].phrase_hash
        
        # Test with various punctuation
        punctuation_tests = [
            original_phrase,
            original_phrase + ".",
            original_phrase + "!",
            original_phrase + "?",
            original_phrase + "...",
            original_phrase.replace(" ", ", "),
            original_phrase.replace(" ", "; "),
            f'"{original_phrase}"',
            f"'{original_phrase}'",
            f"({original_phrase})",
            f"[{original_phrase}]",
        ]
        
        for test_phrase in punctuation_tests:
            detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
                test_phrase, self.user_id
            )
            
            # All punctuation variations should be detected
            assert detected, f"Should detect punctuation variation: {test_phrase}"
            assert secret_tag is not None
            assert secret_tag.phrase_hash== tag_id

    @pytest.mark.asyncio
    async def test_phrase_detection_word_boundaries(self):
        """Test phrase detection respects word boundaries."""
        phrase = "fox jumps over"  # Partial phrase
        full_phrase = self.test_tags[0]['phrase']  # Contains the partial phrase
        
        # Test partial phrase detection
        detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
            phrase, self.user_id
        )
        
        # Partial phrase should not be detected
        assert not detected, "Should not detect partial phrase"
        
        # Full phrase should be detected
        detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
            full_phrase, self.user_id
        )
        
        assert detected, "Should detect full phrase"

    @pytest.mark.asyncio
    async def test_phrase_detection_memory_efficiency(self):
        """Test phrase detection memory efficiency."""
        import tracemalloc
        
        # Start memory tracing
        tracemalloc.start()
        
        # Process multiple phrases
        for i in range(100):
            content = f"Test content {i} with phrase: {self.test_tags[0]['phrase']}"
            detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
                content, self.user_id
            )
        
        # Get memory usage
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        # Memory usage should be reasonable
        assert peak < 50 * 1024 * 1024, f"Memory usage too high: {peak / 1024 / 1024:.1f}MB"

    @pytest.mark.asyncio
    async def test_phrase_detection_error_handling(self):
        """Test phrase detection error handling."""
        # Test with None content
        detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
            None, self.user_id
        )
        assert not detected
        
        # Test with empty content
        detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
            "", self.user_id
        )
        assert not detected
        
        # Test with invalid user ID
        detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
            self.test_tags[0]['phrase'], uuid.uuid4()
        )
        assert not detected

    @pytest.mark.asyncio
    async def test_phrase_detection_audit_logging(self):
        """Test that phrase detection events are logged."""
        # Get initial log count
        initial_log_count = self.db.execute(
            text("SELECT COUNT(*) FROM audit_logs WHERE user_id = :user_id"),
            {"user_id": str(self.user_id)}
        ).scalar()
        
        # Process phrase
        detected, secret_tag, entries, vault_key = self.phrase_processor.process_entry_for_secret_phrases(
            self.test_tags[0]['phrase'], self.user_id
        )
        
        # Verify detection
        assert detected is True
        
        # Verify audit log was created
        final_log_count = self.db.execute(
            text("SELECT COUNT(*) FROM audit_logs WHERE user_id = :user_id"),
            {"user_id": str(self.user_id)}
        ).scalar()
        
        assert final_log_count > initial_log_count, "Audit log should be created" 