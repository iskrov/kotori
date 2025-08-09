import asyncio
import logging
import os
from typing import Any, List, Optional

from google.api_core import exceptions as google_exceptions
from google.api_core.client_options import ClientOptions
from google.cloud import speech_v2 # Use V2 client library
from google.cloud.speech_v2.types import cloud_speech # Use V2 types
# from google.cloud import speech - Remove V1 imports if no longer needed
# from google.cloud.speech import RecognitionAudio
# from google.cloud.speech import RecognitionConfig
# from google.cloud.speech import StreamingRecognitionConfig
# from google.cloud.speech import StreamingRecognizeRequest
from google.oauth2 import service_account
from sqlalchemy.orm import Session

from ..core.config import settings
from .encryption_service import encryption_service
from .phrase_processor import SecretPhraseProcessor

logger = logging.getLogger(__name__)


# Custom exception for configuration errors
class ConfigurationError(Exception):
    """Custom exception for configuration-related errors."""
    pass


class LanguageValidationError(Exception):
    """Custom exception for language validation errors."""
    pass


class SpeechService:
    """
    Service for handling voice-to-text conversion using Google Cloud Speech-to-Text V2
    """
    DEFAULT_RECOGNIZER_ID = "_"
    CHIRP_2_MODEL = "chirp_2"  # Restored for us-central1 compatibility

    def __init__(self, db: Optional[Session] = None):
        self.client_options = None
        self.async_client = None
        self.sync_client = None
        self.db = db
        self.phrase_processor = SecretPhraseProcessor(db) if db else None
        
        try:
            self.client_options = self._get_client_options()
            # Initialize ONLY the sync client here.
            # Initializing the async client here can occur on a thread without an event loop (e.g., AnyIO worker),
            # which raises: "There is no current event loop in thread 'AnyIO worker thread'".
            if self.client_options:
                self.sync_client = self._initialize_client(speech_v2.SpeechClient, "Sync")
            else:  # Should not happen if _get_client_options raises ConfigurationError
                logger.error("ClientOptions are None after _get_client_options, clients not initialized.")
        except ConfigurationError as e:
            logger.error(f"Configuration error during SpeechService initialization: {e}")
            # Clients will remain None, methods using them should check

    def _get_client_options(self):
        """Returns client options, including the regional endpoint if specified."""
        project_id = settings.GOOGLE_CLOUD_PROJECT
        location = settings.GOOGLE_CLOUD_LOCATION
        logger.info(f"Read GOOGLE_CLOUD_PROJECT='{project_id}', GOOGLE_CLOUD_LOCATION='{location}' from settings.")

        if not project_id or not location:
             msg = "GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION must be set in settings for Speech V2 API."
             logger.error(msg)
             raise ConfigurationError(msg)

        # V2 API uses regional endpoints
        api_endpoint = f"{location}-speech.googleapis.com"
        logger.info(f"Using Speech V2 API endpoint: {api_endpoint}")
        return ClientOptions(api_endpoint=api_endpoint)

    def _get_credentials(self):
        """Loads credentials from file if specified, otherwise returns None for ADC."""
        if settings.GOOGLE_APPLICATION_CREDENTIALS:
            # Path is relative to the project root (vibes/)
            # __file__ is .../vibes/backend/app/services/speech_service.py
            # os.path.dirname(__file__) -> .../vibes/backend/app/services
            # os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) -> .../vibes/
            project_root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            credentials_path = os.path.join(
                project_root_dir,
                settings.GOOGLE_APPLICATION_CREDENTIALS,
            )
            credentials_path = os.path.abspath(credentials_path) # Normalize and make absolute
            logger.info(
                f"Attempting to load credentials from: {credentials_path}"
            )
            if not os.path.exists(credentials_path):
                logger.error(f"Credentials file not found at {credentials_path}")
                raise ConfigurationError(f"Specified GOOGLE_APPLICATION_CREDENTIALS file not found: {credentials_path}")
            return service_account.Credentials.from_service_account_file(credentials_path)
        logger.info("GOOGLE_APPLICATION_CREDENTIALS not set. Attempting to use Application Default Credentials (ADC).")
        return None

    def _initialize_client(self, client_class: Any, client_type_name: str):
        """Initializes a V2 Google Cloud Speech client (sync or async)."""
        if not self.client_options: # Should have been caught by __init__
            msg = f"Cannot initialize {client_type_name} client: ClientOptions not available (likely due to missing project/location)."
            logger.error(msg)
            raise ConfigurationError(msg)

        try:
            credentials = self._get_credentials()
            logger.info(f"Initializing {client_type_name} Speech V2 client.")
            if credentials:
                return client_class(credentials=credentials, client_options=self.client_options)
            else: # Using ADC
                return client_class(client_options=self.client_options)
        except Exception as e:
            logger.error(
                f"Failed to initialize {client_type_name} Google Cloud Speech V2 client: {e}", exc_info=True
            )
            # Wrap specific GCloud errors if desired, or keep generic RuntimeError
            raise RuntimeError(f"Could not initialize {client_type_name} Speech V2 client") from e

    async def _ensure_async_client(self):
        """
        Lazily initialize the Async Speech client within an active event loop.
        This avoids initialization on threads without an event loop.
        """
        if self.async_client is not None:
            return self.async_client
        # Initialize inside coroutine to guarantee an event loop exists
        self.async_client = self._initialize_client(speech_v2.SpeechAsyncClient, "Async")
        return self.async_client

    async def transcribe_audio(
        self, audio_content: bytes, language_codes: Optional[List[str]] = None
    ) -> dict:
        """
        Transcribes the given audio content using Google Cloud Speech API V2 (sync).
        Defaults to automatic language detection if language_codes is None or empty.
        Uses default model for compatibility.
        Returns a dictionary with 'transcript' and 'detected_language_code' (if any).
        """
        if not self.sync_client:
            logger.error("Sync Speech V2 client not initialized. Cannot transcribe audio.")
            raise RuntimeError("Sync Speech V2 client is not available. Check configuration.")

        recognizer_name = f"projects/{settings.GOOGLE_CLOUD_PROJECT}/locations/{settings.GOOGLE_CLOUD_LOCATION}/recognizers/{self.DEFAULT_RECOGNIZER_ID}"

        # For V2 API: use ["auto"] for auto-detection, not empty list
        config_language_codes = language_codes if language_codes else ["auto"]
        is_auto_detect = "auto" in config_language_codes

        config = cloud_speech.RecognitionConfig(
            auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
            model=self.CHIRP_2_MODEL,  # Use chirp_2 model
            features=cloud_speech.RecognitionFeatures(
                enable_automatic_punctuation=True,
            ),
            language_codes=config_language_codes
        )

        request = cloud_speech.RecognizeRequest(
            recognizer=recognizer_name,
            config=config,
            content=audio_content,
        )

        transcription_result = {"transcript": "", "detected_language_code": None}

        try:
            logger.info(
                f"Sending audio for transcription (languages: {'auto-detect' if is_auto_detect else ', '.join(config_language_codes)}, model: {self.CHIRP_2_MODEL})..."
            )
            response = self.sync_client.recognize(request=request)
            logger.info("Transcription received from Google Cloud Speech V2 API.")

            transcript_parts = []
            detected_lang_from_response = None

            for result in response.results:
                if result.alternatives:
                    transcript_parts.append(result.alternatives[0].transcript)
                    # Capture the language code from the first result that has one, if auto-detecting
                    if is_auto_detect and not detected_lang_from_response and result.language_code:
                        detected_lang_from_response = result.language_code
            
            transcription_result["transcript"] = "".join(transcript_parts)
            
            if detected_lang_from_response:
                transcription_result["detected_language_code"] = detected_lang_from_response
                logger.info(f"Detected language: {detected_lang_from_response}")

            # Note: Code phrase detection requires user context
            # Use transcribe_audio_with_user_context() for secret phrase detection
            transcription_result["code_phrase_detected"] = None

            return transcription_result

        except Exception as e:
            logger.error(f"Google Cloud Speech V2 API error: {e}", exc_info=True)
            # Still return the dict structure on error, possibly with empty transcript
            # Or re-raise and let the caller handle the structure if preferred.
            # For now, let's re-raise, as the endpoint expects a successful transcription or HTTP error.
            raise RuntimeError(
                "Failed to transcribe audio via Google Cloud Speech V2 API"
            ) from e

    def _check_code_phrases(self, transcript: str, user_id: Optional[int] = None) -> Optional[str]:
        """
        Check if the transcript contains any secret phrases for the user.
        Returns the secret tag name if a phrase is detected, None otherwise.
        
        This method integrates with the database to:
        1. Fetch user's stored secret tags from database
        2. Check against user-specific phrases using OPAQUE authentication
        3. Return the secret tag name if authentication succeeds
        """
        if not transcript or not user_id:
            return None
            
        if not self.phrase_processor:
            logger.warning("Phrase processor not initialized - database integration not available")
            return None
            
        try:
            # Use the phrase processor to check for secret phrases
            # This will handle normalization, database lookup, and OPAQUE authentication
            success, secret_tag, encrypted_entries, encryption_key = self.phrase_processor.process_entry_for_secret_phrases(
                content=transcript,
                user_id=user_id
            )
            
            if success and secret_tag:
                logger.info(f"Secret phrase detected for user {user_id}: tag '{secret_tag.tag_name}'")
                return secret_tag.tag_name
            else:
                logger.debug(f"No secret phrase detected in transcript for user {user_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error checking secret phrases for user {user_id}: {e}")
            return None

    async def transcribe_audio_with_user_context(
        self, 
        audio_content: bytes, 
        user_id: str,
        language_codes: Optional[List[str]] = None
    ) -> dict:
        """
        Enhanced transcription method that includes user-specific code phrase checking.
        """
        result = await self.transcribe_audio(audio_content, language_codes)

        # When secret tags are globally disabled, skip any server-side phrase checks
        if not settings.ENABLE_SECRET_TAGS:
            result["code_phrase_detected"] = None
            return result

        # Enhanced code phrase checking with user context
        transcript_text = result.get("transcript", "").strip()
        if transcript_text:
            code_phrase_type = self._check_code_phrases(transcript_text, user_id)
            result["code_phrase_detected"] = code_phrase_type
        return result

    def _build_streaming_config(self, language_codes: Optional[List[str]] = None) -> dict:
        """Builds the streaming configuration dictionary for V2 API."""
        # For V2 API: use ["auto"] for auto-detection, not empty list
        config_language_codes = language_codes if language_codes else ["auto"]
        
        recognition_config = cloud_speech.RecognitionConfig(
            auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
            model=self.CHIRP_2_MODEL,  # Use chirp_2 model
            features=cloud_speech.RecognitionFeatures(
                enable_automatic_punctuation=True,
            ),
            language_codes=config_language_codes
        )
        
        streaming_features = cloud_speech.StreamingRecognitionFeatures(
            enable_voice_activity_events=True,
            interim_results=True # Re-enabled as per original
        )
        return {
            "config": recognition_config,
            "streaming_features": streaming_features,
        }

    async def _generate_streaming_requests(
        self,
        audio_queue: asyncio.Queue[bytes | None],
        recognizer_name: str,
        streaming_config_dict: dict,
        user_id: str,
        lang_display: str # Changed from List[str] to str for display purposes
    ):
        """Async generator yielding requests to Google API for streaming."""
        try:
            yield cloud_speech.StreamingRecognizeRequest(
                recognizer=recognizer_name,
                streaming_config=streaming_config_dict
            )
            logger.info(f"[{user_id}] Sent streaming config (languages: {lang_display}, model: {self.CHIRP_2_MODEL}) to Google V2")

            while True:
                chunk = await audio_queue.get()
                if chunk is None:
                    logger.info(f"[{user_id}] Audio queue finished.")
                    break
                yield cloud_speech.StreamingRecognizeRequest(audio=chunk)
                audio_queue.task_done()
            logger.info(f"[{user_id}] Request generator finished.")
        except asyncio.CancelledError:
            logger.info(f"[{user_id}] Request generator cancelled.")
            raise
        except Exception as e:
            logger.error(f"[{user_id}] Error in request generator: {e}", exc_info=True)
            # Error will be propagated and handled by the calling function's finally block or main exception handler
            raise


    async def _handle_streaming_responses(
        self,
        stream: Any, # Type hint for Google's Awaitable رئIterator[StreamingRecognizeResponse]
        manager: Any,
        user_id: str,
        is_auto_language: bool # To know if we should log detected language
    ):
        """Processes responses from Google streaming API and sends messages to client."""
        async for response in stream:
            if response.error:
                logger.error(f"[{user_id}] Google API error in stream: {response.error.message}")
                await manager.send_personal_message({"type": "error", "message": f"Transcription API error: {response.error.message}"}, user_id)
                break

            # Log detected language on the first final result if auto-detecting
            if is_auto_language and response.results:
                 first_result = next((res for res in response.results if res.is_final), None)
                 if first_result and first_result.language_code:
                     logger.info(f"[{user_id}] Detected language in stream: {first_result.language_code}")
                     # Consider sending detected language back to client
                     # await manager.send_personal_message({"type": "language_detected", "code": first_result.language_code}, user_id)
                     is_auto_language = False # Log only once

            for result in response.results:
                if not result.alternatives:
                    continue

                transcript = result.alternatives[0].transcript
                is_final = result.is_final

                message_type = "final_transcript" if is_final else "interim_transcript"
                await manager.send_personal_message({
                    "type": message_type,
                    "text": transcript,
                }, user_id)

                if is_final:
                    logger.info(f"[{user_id}] Received final transcript segment: '{transcript[:50]}...'")
                    
                    # Check for secret phrases in final transcripts
                    if self.phrase_processor:
                        try:
                            # Convert user_id to int for database lookup
                            user_id_int = int(user_id) if user_id.isdigit() else None
                            if user_id_int:
                                secret_tag_name = self._check_code_phrases(transcript, user_id_int)
                                if secret_tag_name:
                                    await manager.send_personal_message({
                                        "type": "secret_phrase_detected",
                                        "tag_name": secret_tag_name,
                                        "transcript": transcript,
                                    }, user_id)
                                    logger.info(f"[{user_id}] Secret phrase detected in streaming: {secret_tag_name}")
                        except Exception as e:
                            logger.error(f"[{user_id}] Error checking secret phrases in streaming: {e}")


    async def process_audio_stream(
        self,
        audio_queue: asyncio.Queue[bytes | None],
        manager: Any, # Keep manager for sending messages back via WebSocket
        user_id: str,
        language_codes: Optional[List[str]] = None # Accept optional language codes
    ):
        """
        Handles the bidirectional streaming to Google Cloud Speech API V2 using AsyncClient.
        Defaults to automatic language detection if language_codes is None or empty.
        Uses the chirp_2 model for us-central1 compatibility.
        """
        # Ensure async client is initialized within the event loop
        try:
            await self._ensure_async_client()
        except Exception as e:
            logger.error(f"Failed to initialize Async Speech V2 client in streaming context: {e}")
            await manager.send_personal_message({"type": "error", "message": "Speech client unavailable. Check server configuration."}, user_id)
            return

        # Project ID and Location are validated during client initialization
        recognizer_name = f"projects/{settings.GOOGLE_CLOUD_PROJECT}/locations/{settings.GOOGLE_CLOUD_LOCATION}/recognizers/{self.DEFAULT_RECOGNIZER_ID}"
        logger.info(f"[{user_id}] Using V2 recognizer: {recognizer_name}")

        # For V2 API: handle auto-detection properly
        is_auto_language_detect = not language_codes or (len(language_codes) == 1 and language_codes[0] == "auto")

        try:
            streaming_config_dict = self._build_streaming_config(language_codes)

            # For logging purposes
            lang_display = "auto-detect" if is_auto_language_detect else ", ".join(language_codes)
            
            request_gen = self._generate_streaming_requests(
                audio_queue, recognizer_name, streaming_config_dict, user_id, lang_display
            )

            logger.info(f"[{user_id}] Initiating Google streaming_recognize (v2)")
            stream = await self.async_client.streaming_recognize(requests=request_gen)

            await self._handle_streaming_responses(stream, manager, user_id, is_auto_language_detect)

        except asyncio.CancelledError:
             logger.info(f"[{user_id}] Google streaming recognize task cancelled for user {user_id}.")
             # Don't send error message on cancellation, it's expected during disconnect
        except google_exceptions.Cancelled as e: # Specific Google API cancellation
            logger.warning(f"[{user_id}] Google stream cancelled by API: {e}")
            # Usually due to client closing connection or timeout on Google's side.
        except google_exceptions.DeadlineExceeded as e:
            logger.error(f"[{user_id}] Google stream deadline exceeded: {e}", exc_info=True)
            await manager.send_personal_message({"type": "error", "message": "Transcription timed out."}, user_id)
        except Exception as e:
            logger.error(f"[{user_id}] Error during Google streaming: {e}", exc_info=True)
            if not isinstance(e, (asyncio.CancelledError, google_exceptions.Cancelled)):
                 await manager.send_personal_message({"type": "error", "message": f"Streaming error: {type(e).__name__}. Please try again."}, user_id)
        finally:
             logger.info(f"Google streaming recognize task finished or terminated for user {user_id}")


# Factory function to create SpeechService with database session
def create_speech_service(db: Optional[Session] = None) -> SpeechService:
    """
    Create a SpeechService instance with optional database integration.
    
    Args:
        db: Optional database session for secret phrase integration
        
    Returns:
        SpeechService instance with database integration if provided
    """
    return SpeechService(db)

# Default instance without database integration (for backward compatibility)
speech_service = SpeechService()
