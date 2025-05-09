import asyncio
import logging
import json # Import json
from typing import Any, List, Optional # Import List, Optional

from fastapi import APIRouter
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from fastapi import status
from starlette.websockets import WebSocketState # Import WebSocketState
# from google.cloud.speech_v2.types import cloud_speech # Not needed directly here anymore
from jose import JWTError, jwt

from app.core.config import settings
# Remove V1 config import if speech_service handles V2 config now
# from app.services.speech_service import (
#     RecognitionConfig,
# )
from app.services.speech_service import ( # Import the updated service
    speech_service,
)

logger = logging.getLogger(__name__)
router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connected for user: {user_id}")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected for user: {user_id}")

    async def send_personal_message(self, message: dict[str, Any], user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send WebSocket message to user {user_id}: {e}", exc_info=True)
                # Consider disconnecting if send fails repeatedly
                self.disconnect(user_id)

manager = ConnectionManager()

async def get_token_and_config(websocket: WebSocket) -> tuple[str, Optional[List[str]]]:
    """
    Helper function to get the auth token and optional language config
    from the initial WS messages.
    Expects: 1. {"type": "auth", "token": "..."}
             2. (Optional) {"type": "config", "language_codes": [...] or null}
    Returns tuple (token, language_codes) or raises WebSocketDisconnect.
    """
    token = None
    language_codes: Optional[List[str]] = None

    try:
        # 1. Get Auth message
        auth_message = await websocket.receive_json()
        if auth_message.get("type") == "auth" and "token" in auth_message:
            token = auth_message["token"]
        else:
            logger.warning("First WebSocket message was not valid auth.")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Auth message expected first")
            raise WebSocketDisconnect("Auth message expected first")

        # 2. Optionally get Config message (with a timeout)
        try:
            config_message = await asyncio.wait_for(websocket.receive_json(), timeout=2.0)
            if config_message.get("type") == "config":
                codes = config_message.get("language_codes")
                if codes is None:
                    language_codes = None # Explicit null means auto-detect
                    logger.info(f"Received config: language_codes=auto-detect")
                elif isinstance(codes, list) and all(isinstance(c, str) for c in codes):
                    language_codes = codes
                    logger.info(f"Received config: language_codes={language_codes}")
                else:
                     logger.warning(f"Invalid language_codes format in config: {codes}")
                     # Don't fail the connection, just default to auto-detect
                     language_codes = None
            else:
                # If it's not a config message, maybe it's audio already?
                # Log it and assume default config (auto-detect)
                logger.info("Second message was not config type, proceeding with default config.")
                # We need to handle this message data if it wasn't config.
                # This simple example assumes config *must* be second if sent.
                # A more robust approach might be needed.
                language_codes = None # Default to auto-detect

        except asyncio.TimeoutError:
            logger.info("No config message received within timeout, proceeding with default config (auto-detect).")
            language_codes = None # Default to auto-detect
        except json.JSONDecodeError:
            logger.warning("Failed to decode second message as JSON, proceeding with default config.")
            language_codes = None # Default to auto-detect
        except Exception as e:
            logger.warning(f"Error receiving config message: {e}. Proceeding with default config.")
            language_codes = None # Default to auto-detect

        if not token:
            # Should not happen if first check passed, but defensive check
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Failed to process auth token.")
            raise WebSocketDisconnect("Failed to process auth token.")

        return token, language_codes

    except WebSocketDisconnect as wsd:
         raise wsd # Re-raise disconnect exceptions
    except Exception as e:
        logger.error(f"Error during initial WS handshake: {e}", exc_info=True)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason=f"Handshake error: {e}")
        raise WebSocketDisconnect(f"Handshake error: {e}") from e


@router.websocket("/transcribe")
async def websocket_endpoint(
    websocket: WebSocket,
):
    """
    WebSocket endpoint for real-time speech transcription.
    Authentication and optional language config happens via initial messages.
    Defaults to automatic language detection.
    """
    user_id_str = "unknown_user"
    google_process_task = None
    audio_queue = asyncio.Queue[bytes | None]() # Type hint the queue

    try:
        await websocket.accept()

        # 1. Authenticate and get config
        token, language_codes = await get_token_and_config(websocket)

        # 2. Validate token and get user ID
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id_str = payload.get("sub")
            if not user_id_str:
                raise ValueError("Token missing 'sub' claim")
            # Add DB check here in production!
            logger.info(f"WebSocket authenticated for user: {user_id_str}, Languages: {'auto' if language_codes is None else language_codes}")
        except (JWTError, ValueError) as auth_error:
            logger.warning(f"WebSocket auth failed after handshake: {auth_error}")
            # get_token_and_config should ideally close on auth failure, but double-check
            if websocket.client_state != WebSocketState.DISCONNECTED:
                 await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=f"Authentication Failed: {auth_error}")
            return # Exit if auth fails

        await manager.connect(websocket, user_id_str)

        # 3. Start the background streaming task with language codes
        google_process_task = asyncio.create_task(
            speech_service.process_audio_stream(
                audio_queue=audio_queue,
                manager=manager,
                user_id=user_id_str,
                language_codes=language_codes # Pass the received codes (or None)
            )
        )

        logger.info(f"Starting V2 transcription stream task for user {user_id_str}...")

        # --- Receive audio chunks from client and put in queue ---
        while True:
            # Check if the task has already finished (e.g., due to an error)
            if google_process_task and google_process_task.done():
                 # Check for exceptions in the task
                exc = google_process_task.exception()
                if exc:
                    logger.error(f"Google process task finished prematurely with error: {exc}")
                    # Error message should have been sent by process_audio_stream
                else:
                    logger.info(f"Google process task finished prematurely without error for user {user_id_str}.")
                break # Stop receiving audio if the backend task is done

            try:
                data = await websocket.receive_bytes()
                # Client might send empty bytes to signal end or keepalive? Handle as needed.
                # For now, assume empty bytes means end like None.
                if not data:
                    logger.info(f"Empty data received from {user_id_str}, closing stream.")
                    await audio_queue.put(None) # Signal end to the processing task
                    break

                # logger.debug(f"Received audio chunk ({len(data)} bytes) from {user_id_str}, putting in queue.")
                await audio_queue.put(data)

            except WebSocketDisconnect as e:
                 logger.info(f"WebSocket client disconnected during audio receive for {user_id_str}: {e.code}")
                 # Signal Google task to end
                 await audio_queue.put(None)
                 # No need to break here, the disconnect exception will be caught below
                 raise e # Re-raise to be caught by the outer handler
            except Exception as e:
                 logger.error(f"Error receiving audio data from {user_id_str}: {e}", exc_info=True)
                 await audio_queue.put(None) # Signal end on error
                 await manager.send_personal_message({"type": "error", "message": f"Server error receiving audio: {e}"}, user_id_str)
                 # Consider breaking or closing the connection here
                 break


        # Wait for the processing task to finish *after* client stops sending or disconnects
        if google_process_task and not google_process_task.done():
            logger.info(f"Waiting for Google processing task to complete for user {user_id_str}.")
            try:
                 await google_process_task
                 logger.info(f"Google processing task completed normally for user {user_id_str}.")
            except asyncio.CancelledError:
                 logger.info(f"Google processing task was cancelled for user {user_id_str}.")
            except Exception as task_exc:
                 logger.error(f"Google processing task failed for user {user_id_str}: {task_exc}", exc_info=True)


    except WebSocketDisconnect as e:
        logger.info(f"WebSocket disconnected for user {user_id_str}: {e.code} {e.reason}")
        # Ensure Google task is cancelled if client disconnects
        if google_process_task and not google_process_task.done():
             logger.info(f"Cancelling Google processing task due to disconnect for user {user_id_str}.")
             # Ensure queue is signaled if not already done
             # Putting None might raise if queue is full or task is closing, use cancel
             google_process_task.cancel()
             try:
                 await asyncio.wait_for(audio_queue.put(None), timeout=1.0) # Attempt to signal gracefully
             except (asyncio.TimeoutError, asyncio.QueueFull):
                 logger.warning(f"Could not signal audio queue termination for {user_id_str} during disconnect cleanup.")

    except Exception as e:
        logger.error(f"Unexpected error in WebSocket connection for user {user_id_str}: {e}", exc_info=True)
        # Attempt to send error to client if connection is still managed
        await manager.send_personal_message({"type": "error", "message": f"Unexpected server error: {e}"}, user_id_str)
        # Ensure Google task is cancelled on unexpected errors
        if google_process_task and not google_process_task.done():
             logger.info(f"Cancelling Google processing task due to error for user {user_id_str}.")
             google_process_task.cancel()
             try:
                 await asyncio.wait_for(audio_queue.put(None), timeout=1.0)
             except (asyncio.TimeoutError, asyncio.QueueFull):
                 logger.warning(f"Could not signal audio queue termination for {user_id_str} during error cleanup.")

    finally:
        # Ensure task is awaited/cancelled even if errors occurred before task wait block
        if google_process_task and not google_process_task.done():
            logger.warning(f"WebSocket endpoint for {user_id_str} exiting but Google task still running. Cancelling.")
            google_process_task.cancel()
            try:
                # Give cancellation a moment to propagate
                await asyncio.wait_for(google_process_task, timeout=2.0)
            except asyncio.CancelledError:
                 logger.info(f"Google task successfully cancelled during final cleanup for {user_id_str}.")
            except asyncio.TimeoutError:
                 logger.error(f"Timeout waiting for Google task cancellation for {user_id_str}.")
            except Exception as final_task_exc:
                 logger.error(f"Error awaiting cancelled Google task for {user_id_str}: {final_task_exc}", exc_info=True)

        manager.disconnect(user_id_str)
        logger.info(f"Cleaned up WebSocket connection for user {user_id_str}")
