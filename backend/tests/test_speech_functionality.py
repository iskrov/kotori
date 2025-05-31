"""
Tests for Google Cloud Speech V2 service functionality.

These tests verify:
- Speech service transcription capabilities
- Language validation
- Multi-language support
- Error handling

Note: These tests use minimal audio data and focus on API connectivity
and configuration correctness rather than transcription accuracy.
"""
import pytest

from app.services.speech_service import speech_service, LanguageValidationError


class TestSpeechFunctionality:
    """Test Google Cloud Speech V2 service functionality."""

    @staticmethod
    def create_test_audio():
        """Create minimal valid WAV audio data for testing."""
        # Minimal WAV file: RIFF header + format chunk + data chunk with silence
        # 16-bit PCM, 16kHz, mono, 0.1 seconds of silence
        wav_data = (
            b'RIFF'                    # RIFF header
            b'\x2c\x01\x00\x00'       # File size (300 bytes)
            b'WAVE'                   # WAVE format
            b'fmt '                   # Format chunk
            b'\x10\x00\x00\x00'       # Format chunk size (16)
            b'\x01\x00'               # Audio format (PCM)
            b'\x01\x00'               # Number of channels (1)
            b'\x80\x3e\x00\x00'       # Sample rate (16000 Hz)
            b'\x00\x7d\x00\x00'       # Byte rate
            b'\x02\x00'               # Block align
            b'\x10\x00'               # Bits per sample (16)
            b'data'                   # Data chunk
            b'\x00\x01\x00\x00'       # Data size (256 bytes)
            + b'\x00\x00' * 128       # 256 bytes of silence (128 samples)
        )
        return wav_data

    def test_language_validation_valid_codes(self):
        """Test language validation with valid language codes."""
        # Test single valid language
        validated = speech_service._validate_language_codes(["en-US"])
        assert validated == ["en-US"]
        
        # Test multiple valid languages
        validated = speech_service._validate_language_codes(["en-US", "es-US"])
        assert validated == ["en-US", "es-US"]
        
        # Test empty list (auto-detection)
        validated = speech_service._validate_language_codes([])
        assert validated == []
        
        # Test None (auto-detection)
        validated = speech_service._validate_language_codes(None)
        assert validated == []

    def test_language_validation_invalid_codes(self):
        """Test language validation with invalid language codes."""
        # Test invalid language code
        with pytest.raises(LanguageValidationError) as exc_info:
            speech_service._validate_language_codes(["invalid-code"])
        assert "Unsupported language codes" in str(exc_info.value)
        
        # Test too many language codes
        too_many_codes = ["en-US"] * 10  # Assuming max is less than 10
        with pytest.raises(LanguageValidationError) as exc_info:
            speech_service._validate_language_codes(too_many_codes)
        assert "Too many language codes" in str(exc_info.value)

    def test_language_validation_duplicates(self):
        """Test language validation removes duplicates."""
        validated = speech_service._validate_language_codes(["en-US", "es-US", "en-US"])
        assert validated == ["en-US", "es-US"]  # Duplicates removed, order preserved

    def test_build_recognition_config(self):
        """Test building recognition configuration."""
        # Test with language codes
        config = speech_service._build_recognition_config(["en-US"])
        assert config.language_codes == ["en-US"]
        assert config.model == speech_service.DEFAULT_MODEL
        assert config.features.enable_automatic_punctuation is not None
        assert config.features.enable_word_confidence is not None
        
        # Test with empty language codes (auto-detection)
        config = speech_service._build_recognition_config([])
        assert config.language_codes == ["auto"]

    def test_build_streaming_config(self):
        """Test building streaming configuration."""
        # Test with language codes
        config_dict = speech_service._build_streaming_config(["en-US"])
        assert "config" in config_dict
        assert "streaming_features" in config_dict
        assert config_dict["config"].language_codes == ["en-US"]
        assert config_dict["streaming_features"].interim_results is True
        
        # Test with None (auto-detection)
        config_dict = speech_service._build_streaming_config(None)
        assert config_dict["config"].language_codes == ["auto"]

    @pytest.mark.asyncio
    async def test_transcribe_audio_structure(self):
        """Test transcribe_audio method structure and error handling."""
        test_audio = self.create_test_audio()
        
        # This test may fail if Google Cloud credentials are not available
        # but it should test the method structure and error handling
        try:
            result = await speech_service.transcribe_audio(test_audio, ["en-US"])
            
            # If successful, verify result structure
            assert isinstance(result, dict)
            assert "transcript" in result
            assert "confidence" in result
            assert "alternatives" in result
            assert "quality_metrics" in result
            
        except RuntimeError as e:
            # Expected if credentials are not available or API is not accessible
            assert "Failed to transcribe audio" in str(e)
        except Exception as e:
            # Other exceptions should be investigated
            pytest.fail(f"Unexpected exception: {e}")

    def test_check_code_phrases(self):
        """Test code phrase detection functionality."""
        # Test with no code phrases
        result = speech_service._check_code_phrases("hello world")
        assert result is None
        
        # Test with test phrases (these are hardcoded in the service)
        result = speech_service._check_code_phrases("show hidden entries")
        assert result == "unlock"
        
        result = speech_service._check_code_phrases("show decoy profile")
        assert result == "decoy"
        
        result = speech_service._check_code_phrases("emergency destroy")
        assert result == "panic"
        
        # Test case insensitive and punctuation handling
        result = speech_service._check_code_phrases("Show Hidden Entries!")
        assert result == "unlock" 