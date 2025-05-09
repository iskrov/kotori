import logging
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
    Header,
)
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.dependencies import get_db
from app.models.user import User
from app.services.speech_service import SpeechService, speech_service
from app.core.config import settings
from app.services.user_service import user_service

router = APIRouter()
logger = logging.getLogger(__name__)

async def manual_get_user_from_header(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> User:
    if authorization is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        
    scheme, _, token = authorization.partition(' ')
    if not scheme or scheme.lower() != 'bearer' or not token:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            logger.warning("JWT token missing 'sub' claim.")
            raise credentials_exception
    except JWTError as e:
        logger.error(f"JWT decoding error: {e}", exc_info=True)
        raise credentials_exception from e
        
    try:
        user = user_service.get(db, id=int(user_id))
    except ValueError:
        logger.error(f"Invalid user ID format in token 'sub' claim: {user_id}")
        raise credentials_exception
        
    if user is None:
        logger.warning(f"User with ID {user_id} from token not found in DB.")
        raise credentials_exception
        
    if not user.is_active:
        logger.warning(f"Inactive user attempted access: {user.email}")
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user

# Input validation model for language codes (optional)
class TranscribeRequestParams(BaseModel):
    # Use Field to allow empty list or list of strings, default to None for auto-detect
    language_codes: Optional[List[str]] = Field(None)

@router.post("/transcribe", response_model=dict)
async def transcribe_audio_endpoint(
    # Use Form(...) for form fields alongside File(...)
    language_codes_json: Optional[str] = Form(None), # Receive as JSON string
    file: UploadFile = File(...),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
    speech_service_instance: SpeechService = Depends(lambda: speech_service),
):
    """
    Receives an audio file and optional language codes, transcribes it using the SpeechService,
    and returns the transcription.
    Defaults to automatic language detection if language_codes are not provided or empty.
    (Authentication handled manually within endpoint)
    """
    current_user = await manual_get_user_from_header(authorization, db)

    # --- Parse language codes --- 
    language_codes: Optional[List[str]] = None
    if language_codes_json:
        try:
            # Parse the JSON string into a list
            import json
            parsed_codes = json.loads(language_codes_json)
            # Basic validation: Ensure it's a list of strings
            if isinstance(parsed_codes, list) and all(isinstance(code, str) for code in parsed_codes):
                language_codes = parsed_codes
            elif parsed_codes is None:
                # Allow explicit null/None to trigger auto-detect
                 language_codes = None
            else:
                 logger.warning(f"Invalid format for language_codes received: {language_codes_json}")
                 raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid format for language_codes. Must be a JSON array of strings or null."
                )
        except json.JSONDecodeError:
            logger.warning(f"Failed to decode language_codes JSON: {language_codes_json}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid JSON format for language_codes."
            )
        except Exception as e: # Catch potential validation errors within Pydantic if used
            logger.warning(f"Error processing language_codes: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid language_codes provided: {e}"
            )

    # Use empty list [] to signal auto-detection to the service if language_codes is None
    effective_language_codes = language_codes # Pass None or the list to the service

    logger.info(
        f"Received audio file for transcription from user {current_user.email}. "
        f"Content-Type: {file.content_type}, "
        f"Requested Languages: {'auto' if effective_language_codes is None else effective_language_codes}"
    )

    # Basic validation for content type (adjust as needed)
    if not file.content_type or not file.content_type.startswith("audio/"):
        logger.warning(f"Invalid file content type received: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Please upload an audio file. Received: {file.content_type}",
        )

    try:
        audio_content = await file.read()
        logger.info(f"Read {len(audio_content)} bytes from uploaded audio file.")

        # Add more robust validation if necessary (e.g., file size limit)

        # Pass the language codes to the service
        transcription_data = await speech_service_instance.transcribe_audio(
            audio_content,
            language_codes=effective_language_codes # Pass None or the list
        )
        logger.info(
            f"Successfully transcribed audio for user {current_user.email}. "
            f"Transcript length: {len(transcription_data.get('transcript', ''))}, "
            f"Detected language: {transcription_data.get('detected_language_code')}"
        )

        return {
            "transcript": transcription_data.get("transcript", ""),
            "detected_language_code": transcription_data.get("detected_language_code")
        }

    except RuntimeError as e:
        logger.error(
            f"Runtime error during transcription for user {current_user.email}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {e}",
        ) from e
    except Exception as e:
        logger.exception(
            f"Unexpected error during transcription for user {current_user.email}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during transcription.",
        ) from e
    finally:
        await file.close()
