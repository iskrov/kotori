# app/core/config.py
#
# ⚠️  SECURITY WARNING ⚠️
# 
# This configuration file MUST NOT contain any hardcoded sensitive values!
# ALL sensitive configuration values MUST be stored in the .env file.
# 
# PROHIBITED:
# - Hardcoded passwords, API keys, secrets
# - Hardcoded database URLs with credentials
# - Hardcoded encryption keys or salts
# - Hardcoded JWT secrets
# - Hardcoded production URLs or endpoints
#
# ALLOWED:
# - Non-sensitive defaults (like port numbers, debug flags)
# - Development-only fallbacks that are clearly marked
# - Public configuration values
#
# This file is used to load the environment variables from the .env file
# and make them available to the application.

import os
import sys
from typing import Optional, List

from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from pydantic import ConfigDict

# Get the absolute path to the backend directory
BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

# Load environment variables from .env file located in the backend directory
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
else:
    print(f"WARNING: .env file not found at {ENV_PATH}")
    print("Please create a .env file with all required environment variables.")


def get_required_env(key: str) -> str:
    """Get required environment variable or exit with error."""
    value = os.getenv(key)
    if not value:
        print(f"ERROR: Required environment variable '{key}' is not set in .env file")
        sys.exit(1)
    return value


def get_required_env_int(key: str) -> int:
    """Get required integer environment variable or exit with error."""
    value = os.getenv(key)
    if not value:
        print(f"ERROR: Required environment variable '{key}' is not set in .env file")
        sys.exit(1)
    try:
        return int(value)
    except ValueError:
        print(f"ERROR: Environment variable '{key}' must be a valid integer")
        sys.exit(1)


class Settings(BaseSettings):
    # App settings (non-sensitive defaults allowed)
    APP_NAME: str = os.getenv("APP_NAME", "Kotori API")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8001"))

    # Database settings - REQUIRED in .env
    DATABASE_URL: str = get_required_env("DATABASE_URL")

    # JWT settings - REQUIRED in .env
    SECRET_KEY: str = get_required_env("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # Google Cloud settings - REQUIRED in .env
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_SPEECH_API_KEY: Optional[str] = os.getenv("GOOGLE_SPEECH_API_KEY")
    GOOGLE_CLOUD_PROJECT: str = get_required_env("GOOGLE_CLOUD_PROJECT")
    GOOGLE_CLOUD_LOCATION: str = get_required_env("GOOGLE_CLOUD_LOCATION")
    
    # Google OAuth settings - REQUIRED for Google Sign-In
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET")
    
    # Gemini API settings - REQUIRED for sharing features
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")

    # Google Cloud Speech V2 Settings (with safe defaults)
    SPEECH_MAX_ALTERNATIVES: int = int(os.getenv("SPEECH_MAX_ALTERNATIVES", "3"))
    SPEECH_ENABLE_WORD_CONFIDENCE: bool = os.getenv("SPEECH_ENABLE_WORD_CONFIDENCE", "true").lower() == "true"
    SPEECH_ENABLE_AUTOMATIC_PUNCTUATION: bool = os.getenv("SPEECH_ENABLE_AUTOMATIC_PUNCTUATION", "true").lower() == "true"
    SPEECH_ENABLE_VOICE_ACTIVITY_DETECTION: bool = os.getenv("SPEECH_ENABLE_VOICE_ACTIVITY_DETECTION", "true").lower() == "true"
    SPEECH_MODEL: str = os.getenv("SPEECH_MODEL", "chirp_2")
    SPEECH_MIN_CONFIDENCE_THRESHOLD: float = float(os.getenv("SPEECH_MIN_CONFIDENCE_THRESHOLD", "0.7"))

    # Encryption settings - REQUIRED in .env
    ENCRYPTION_MASTER_SALT: str = get_required_env("ENCRYPTION_MASTER_SALT")
    HIDDEN_MODE_TIMEOUT_MINUTES: int = int(os.getenv("HIDDEN_MODE_TIMEOUT_MINUTES", "2"))

    # Feature flags
    ENABLE_SECRET_TAGS: bool = os.getenv("ENABLE_SECRET_TAGS", "false").lower() == "true"

    model_config = ConfigDict(case_sensitive=True)

    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Parse CORS_ORIGINS from comma-separated string in environment."""
        cors_env = os.getenv("CORS_ORIGINS", "")
        if cors_env:
            return [origin.strip() for origin in cors_env.split(",") if origin.strip()]
        return []


# Create settings instance
try:
    settings = Settings()
except SystemExit:
    print("\nConfiguration failed. Please check your .env file and ensure all required variables are set.")
    raise

# Optional: Print loaded settings during startup for debugging (if DEBUG is True)
# if settings.DEBUG:
#     print("--- Loaded Settings ---")
#     print(f"Environment: {settings.ENVIRONMENT}")
#     print(f"Debug Mode: {settings.DEBUG}")
#     print(f"Database URL: {settings.DATABASE_URL[:15]}...") # Avoid logging full sensitive URL
#     print(f"CORS Origins: {settings.CORS_ORIGINS}")
#     print("-----------------------")
