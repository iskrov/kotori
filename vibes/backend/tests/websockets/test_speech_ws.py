import pytest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock

from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Assuming your TestClient setup is in tests/conftest.py or similar
# You need a fixture that provides the TestClient instance, e.g., 'client'
# You also need a valid user and a way to generate a token for them

# Mock data and tokens (replace with actual token generation)
TEST_USER_EMAIL = "test@example.com"
VALID_TOKEN = "mock.valid.token" # Replace with actual generated token for tests
INVALID_TOKEN = "invalid.token"

# Test for successful connection, auth, and mock streaming
@patch("app.websockets.speech.jwt.decode", return_value={"sub": TEST_USER_EMAIL})
@patch("app.services.speech_service.SpeechService.process_audio_stream", new_callable=AsyncMock)
async def test_websocket_transcribe_success(
    mock_process_stream: AsyncMock, mock_jwt_decode: MagicMock, client: TestClient
):
    """Test successful WebSocket connection, authentication, and mock streaming."""
    
    # Simulate sending results from the mocked service
    async def mock_stream_behavior(audio_generator, config, manager, user_id):
        await asyncio.sleep(0.1) # Simulate initial processing
        await manager.send_personal_message({"type": "interim_transcript", "text": "Hello "}, user_id)
        await asyncio.sleep(0.1)
        await manager.send_personal_message({"type": "final_transcript", "text": "Hello world"}, user_id)
        # Simulate consumption of audio queue items (important for task completion)
        while True:
            item = await audio_generator.get()
            if item is None:
                audio_generator.task_done()
                break
            audio_generator.task_done()
            
    mock_process_stream.side_effect = mock_stream_behavior

    with client.websocket_connect("/ws/transcribe") as websocket:
        # Send auth immediately after connecting
        websocket.send_json({"type": "auth", "token": VALID_TOKEN})

        # Now, receive expected messages
        response1 = websocket.receive_json()
        assert response1 == {"type": "interim_transcript", "text": "Hello "}

        response2 = websocket.receive_json()
        assert response2 == {"type": "final_transcript", "text": "Hello world"}

        # Simulate client sending some audio data then closing
        websocket.send_bytes(b'audio_chunk_1')
        websocket.send_bytes(b'audio_chunk_2')
        # No explicit close needed from client in this test setup,
        # the 'with' block handles it, triggering server cleanup.

    # Assert that the mocked stream processing function was called
    mock_process_stream.assert_awaited_once()
    # Additional assertions could check arguments passed to mock_process_stream
    args, kwargs = mock_process_stream.call_args
    assert "audio_generator" in kwargs # Check if the key exists
    assert "config" in kwargs
    assert "manager" in kwargs
    assert kwargs["user_id"] == TEST_USER_EMAIL

    # Verify JWT decode was called
    mock_jwt_decode.assert_called_once_with(VALID_TOKEN, "development-secret-key", algorithms=["HS256"])

# Test for authentication failure
async def test_websocket_transcribe_auth_fail_bad_token(client: TestClient):
    """Test WebSocket connection rejection with invalid token."""
    with pytest.raises(Exception): # Check for disconnect exception
         with client.websocket_connect("/ws/transcribe") as websocket:
            # Send bad auth
            websocket.send_json({"type": "auth", "token": INVALID_TOKEN})
            # Should disconnect shortly after 
            await asyncio.sleep(0.1) 
            websocket.receive_json() # This should raise an error on disconnect

# Test for authentication failure - no token
async def test_websocket_transcribe_auth_fail_no_token(client: TestClient):
    """Test WebSocket connection rejection with no initial token message."""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/transcribe") as websocket:
            # Send non-auth message first
            websocket.send_json({"type": "config", "lang": "en-US"})
            await asyncio.sleep(0.1)
            websocket.receive_json() 