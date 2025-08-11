"""
Integration tests for Google Cloud Speech V2 using a real audio sample.

These tests are skipped by default and will only run if the environment
variable RUN_SPEECH_INTEGRATION is set to a truthy value.

They validate that:
- MP3 input works with AutoDetectDecodingConfig
- Providing an explicit English language code works
- Default language behavior remains 'auto' when not provided

Note: These tests make real calls to Google Cloud if enabled. Ensure that
Application Default Credentials (ADC) or GOOGLE_APPLICATION_CREDENTIALS are
configured and that GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION are set.
"""

from __future__ import annotations

import os
import pathlib
import pytest

from app.services.speech_service import SpeechService
from app.core.config import settings


def _should_run_integration() -> bool:
    flag = os.getenv("RUN_SPEECH_INTEGRATION", "")
    return flag.lower() in {"1", "true", "yes", "y", "on"}


integration = pytest.mark.skipif(
    not _should_run_integration(), reason="Set RUN_SPEECH_INTEGRATION=1 to run speech integration tests",
)


@integration
def test_transcribe_mp3_en_us():
    """Transcribe the bundled MP3 sample with explicit English code."""
    sample_path = pathlib.Path(__file__).parent / "samples" / "speech.mp3"
    assert sample_path.exists(), f"Sample not found: {sample_path}"

    audio_bytes = sample_path.read_bytes()
    assert len(audio_bytes) > 0, "Sample audio is empty"

    service = SpeechService()

    result = pytest.run(async_transcribe(service, audio_bytes, ["en-US"]))

    assert isinstance(result, dict)
    assert result.get("transcript") is not None
    assert len(result.get("transcript", "")) > 0, "Expected non-empty transcript for en-US"
    # When explicit language is provided we don't expect detected_language_code
    assert result.get("detected_language_code") in (None, "en-US", "en")


@integration
def test_transcribe_mp3_auto_default():
    """Transcribe the bundled MP3 sample without language codes to ensure auto works by default."""
    sample_path = pathlib.Path(__file__).parent / "samples" / "speech.mp3"
    assert sample_path.exists(), f"Sample not found: {sample_path}"

    audio_bytes = sample_path.read_bytes()
    assert len(audio_bytes) > 0, "Sample audio is empty"

    service = SpeechService()

    result = pytest.run(async_transcribe(service, audio_bytes, None))

    assert isinstance(result, dict)
    assert result.get("transcript") is not None
    assert len(result.get("transcript", "")) > 0, "Expected non-empty transcript with auto language"
    # With auto we expect Google to provide a detected language when speech is present
    assert result.get("detected_language_code") not in (None, "und"), "Expected a detected language code"


async def async_transcribe(service: SpeechService, audio_bytes: bytes, lang_codes: list[str] | None):
    # Sanity: verify settings present to avoid confusing failures
    assert settings.GOOGLE_CLOUD_PROJECT, "GOOGLE_CLOUD_PROJECT must be set"
    assert settings.GOOGLE_CLOUD_LOCATION, "GOOGLE_CLOUD_LOCATION must be set"

    return await service.transcribe_audio(audio_content=audio_bytes, language_codes=lang_codes)


