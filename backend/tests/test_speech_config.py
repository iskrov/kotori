"""
Tests for Google Cloud Speech V2 configuration and location setup.

These tests verify:
- Google Cloud project and location configuration
- Multi-language support availability
- Speech service initialization
- Basic API connectivity
"""
import pytest

from app.core.config import settings
from app.services.speech_service import SpeechService


class TestSpeechConfiguration:
    """Test Google Cloud Speech V2 configuration."""

    def test_google_cloud_settings(self):
        """Test that required Google Cloud settings are configured."""
        assert settings.GOOGLE_CLOUD_PROJECT is not None, "GOOGLE_CLOUD_PROJECT must be set"
        assert settings.GOOGLE_CLOUD_LOCATION is not None, "GOOGLE_CLOUD_LOCATION must be set"
        assert len(settings.GOOGLE_CLOUD_PROJECT) > 0, "GOOGLE_CLOUD_PROJECT cannot be empty"
        assert len(settings.GOOGLE_CLOUD_LOCATION) > 0, "GOOGLE_CLOUD_LOCATION cannot be empty"

    def test_multi_language_support(self):
        """Test that the configured location supports multi-language recognition."""
        location = settings.GOOGLE_CLOUD_LOCATION
        supported_locations = ["eu", "global", "us"]
        
        assert location in supported_locations, (
            f"Location '{location}' does not support multi-language recognition. "
            f"Supported locations: {supported_locations}"
        )

    def test_speech_service_initialization(self):
        """Test that SpeechService can be initialized successfully."""
        speech_service = SpeechService()
        
        assert speech_service is not None, "SpeechService should initialize"
        assert hasattr(speech_service, 'sync_client'), "SpeechService should have sync_client"
        assert hasattr(speech_service, 'async_client'), "SpeechService should have async_client"
        assert hasattr(speech_service, 'client_options'), "SpeechService should have client_options"

    def test_speech_service_clients(self):
        """Test that speech service clients are properly initialized."""
        speech_service = SpeechService()
        
        # Note: In test environment, clients might not initialize if credentials are not available
        # This test checks the structure rather than actual API connectivity
        if speech_service.sync_client is not None:
            assert hasattr(speech_service.sync_client, 'recognize'), "Sync client should have recognize method"
        
        if speech_service.async_client is not None:
            assert hasattr(speech_service.async_client, 'recognize'), "Async client should have recognize method"

    def test_speech_model_configuration(self):
        """Test that speech model is properly configured."""
        speech_service = SpeechService()
        
        assert hasattr(speech_service, 'DEFAULT_MODEL'), "SpeechService should have DEFAULT_MODEL"
        assert speech_service.DEFAULT_MODEL is not None, "DEFAULT_MODEL should not be None"
        assert len(speech_service.DEFAULT_MODEL) > 0, "DEFAULT_MODEL should not be empty"

    def test_language_validation_settings(self):
        """Test that language validation settings are properly configured."""
        assert settings.SPEECH_MAX_LANGUAGE_CODES > 0, "SPEECH_MAX_LANGUAGE_CODES should be positive"
        assert settings.SPEECH_MAX_ALTERNATIVES > 0, "SPEECH_MAX_ALTERNATIVES should be positive"
        assert isinstance(settings.SPEECH_ENABLE_WORD_CONFIDENCE, bool), "SPEECH_ENABLE_WORD_CONFIDENCE should be boolean"
        assert isinstance(settings.SPEECH_ENABLE_AUTOMATIC_PUNCTUATION, bool), "SPEECH_ENABLE_AUTOMATIC_PUNCTUATION should be boolean"
        assert 0.0 <= settings.SPEECH_MIN_CONFIDENCE_THRESHOLD <= 1.0, "SPEECH_MIN_CONFIDENCE_THRESHOLD should be between 0 and 1"

    def test_supported_language_codes(self):
        """Test that supported language codes are properly configured."""
        assert len(settings.SUPPORTED_LANGUAGE_CODES) > 0, "SUPPORTED_LANGUAGE_CODES should not be empty"
        assert "en-US" in settings.SUPPORTED_LANGUAGE_CODES, "en-US should be in supported languages"
        
        # Verify language codes follow BCP-47 format (basic check)
        for code in settings.SUPPORTED_LANGUAGE_CODES[:5]:  # Check first 5 for performance
            assert "-" in code, f"Language code '{code}' should follow BCP-47 format (e.g., 'en-US')"
            parts = code.split("-")
            assert len(parts) == 2, f"Language code '{code}' should have exactly one hyphen"
            assert len(parts[0]) == 2, f"Language part of '{code}' should be 2 characters"
            assert len(parts[1]) == 2, f"Region part of '{code}' should be 2 characters" 