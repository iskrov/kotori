"""
Tests for Google Cloud Speech V2 service functionality.

These tests verify the public API of the SpeechService, ensuring that it
correctly constructs requests to the Google Cloud Speech API and processes
the responses, without making actual network calls.
"""
import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock

from app.services.speech_service import SpeechService
from app.core.config import settings
from google.cloud.speech_v2.types import cloud_speech

# A mock audio content for testing purposes
MOCK_AUDIO_CONTENT = b"mock_audio_data"

@pytest.fixture
def mock_speech_client():
    """Provides a mock for the Google Cloud Speech V2 client."""
    with patch("app.services.speech_service.speech_v2.SpeechClient") as mock_client_constructor:
        mock_client_instance = MagicMock()

        # Mock the response from the recognize method
        mock_response = cloud_speech.RecognizeResponse()
        mock_result = mock_response.results.add()
        mock_alt = mock_result.alternatives.add()
        mock_alt.transcript = "This is a test transcript."
        mock_result.language_code = "en-US"
        
        mock_client_instance.recognize.return_value = mock_response
        
        # The constructor returns our mocked instance
        mock_client_constructor.return_value = mock_client_instance
        yield mock_client_instance

@pytest.fixture
def speech_service_instance(mock_speech_client):
    """
    Provides an instance of SpeechService with a mocked sync_client.
    We patch the initializer to inject the mock.
    """
    with patch.object(SpeechService, "_initialize_client") as mock_init:
        # We need to initialize async_client as well to avoid errors on init
        mock_init.side_effect = [AsyncMock(), mock_speech_client]
        service = SpeechService()
        # Manually set the sync client to our mock since the patcher is complex
        service.sync_client = mock_speech_client
        yield service

class TestSpeechFunctionality:
    """Test the functionality of the SpeechService."""

    @pytest.mark.asyncio
    async def test_transcribe_audio_with_language_code(self, speech_service_instance, mock_speech_client):
        """
        Test that transcribe_audio correctly calls the speech client with a specified language
        and processes the response.
        """
        # Call the method under test
        result = await speech_service_instance.transcribe_audio(
            audio_content=MOCK_AUDIO_CONTENT,
            language_codes=["en-GB"]
        )

        # Assertions
        mock_speech_client.recognize.assert_called_once()
        
        # Verify the request payload sent to the mock
        sent_request = mock_speech_client.recognize.call_args[1]['request']
        assert sent_request.content == MOCK_AUDIO_CONTENT
        assert sent_request.config.language_codes == ["en-GB"]
        assert sent_request.config.model == speech_service_instance.CHIRP_2_MODEL
        assert f"projects/{settings.GOOGLE_CLOUD_PROJECT}/locations/{settings.GOOGLE_CLOUD_LOCATION}" in sent_request.recognizer

        # Verify the processed result
        assert result["transcript"] == "This is a test transcript."
        assert result["detected_language_code"] is None # Not auto-detected

    @pytest.mark.asyncio
    async def test_transcribe_audio_auto_detect_language(self, speech_service_instance, mock_speech_client):
        """
        Test that transcribe_audio correctly uses 'auto' for language detection
        when no language code is provided.
        """
        # Call the method under test without language_codes
        result = await speech_service_instance.transcribe_audio(
            audio_content=MOCK_AUDIO_CONTENT
        )

        # Assertions
        mock_speech_client.recognize.assert_called_once()
        
        # Verify the request payload sent to the mock
        sent_request = mock_speech_client.recognize.call_args[1]['request']
        assert sent_request.config.language_codes == ["auto"]

        # Verify the processed result
        assert result["transcript"] == "This is a test transcript."
        assert result["detected_language_code"] == "en-US" 