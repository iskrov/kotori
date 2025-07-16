"""
Speech API Schemas

Pydantic models for speech transcription and secret tag activation endpoints.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class SpeechTranscriptionRequest(BaseModel):
    """Request schema for speech transcription"""
    language_codes: Optional[List[str]] = Field(
        None, 
        description="List of language codes for transcription (e.g., ['en-US', 'es-ES'])"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "language_codes": ["en-US", "es-ES"]
            }
        }
    )


class SpeechTranscriptionResponse(BaseModel):
    """Response schema for speech transcription"""
    transcript: str = Field(..., description="Transcribed text from audio")
    detected_language_code: Optional[str] = Field(
        None, 
        description="Detected language code (e.g., 'en-US')"
    )
    code_phrase_detected: Optional[str] = Field(
        None, 
        description="Secret tag name if a code phrase was detected"
    )
    confidence: Optional[float] = Field(
        None, 
        description="Transcription confidence score (0.0 to 1.0)"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "transcript": "Hello, this is a test transcription",
                "detected_language_code": "en-US",
                "code_phrase_detected": "my secret tag",
                "confidence": 0.95
            }
        }
    )


class SecretTagActivationRequest(BaseModel):
    """Request schema for secret tag activation"""
    action: str = Field(..., description="Action to perform: 'activate' or 'deactivate'")
    tag_name: Optional[str] = Field(None, description="Name of the secret tag to activate")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "action": "activate",
                "tag_name": "my secret tag"
            }
        }
    )


class SecretTagActivationResponse(BaseModel):
    """Response schema for secret tag activation"""
    success: bool = Field(..., description="Whether the activation was successful")
    message: str = Field(..., description="Status message")
    tag_name: Optional[str] = Field(None, description="Name of the activated/deactivated tag")
    session_token: Optional[str] = Field(None, description="Session token for authenticated access")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Secret tag activated successfully",
                "tag_name": "my secret tag",
                "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }
    )


class SpeechErrorResponse(BaseModel):
    """Error response schema for speech operations"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict] = Field(None, description="Additional error details")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "error": "transcription_failed",
                "message": "Failed to transcribe audio file",
                "details": {"error_code": "AUDIO_FORMAT_UNSUPPORTED"}
            }
        }
    )


class SpeechHealthResponse(BaseModel):
    """Health check response for speech service"""
    status: str = Field(..., description="Service status")
    speech_service_available: bool = Field(..., description="Whether speech service is available")
    supported_languages: List[str] = Field(..., description="List of supported language codes")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "healthy",
                "speech_service_available": True,
                "supported_languages": ["en-US", "es-ES", "fr-FR", "de-DE"]
            }
        }
    ) 