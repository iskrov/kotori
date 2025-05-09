# app/core/config.py
# This file is used to load the environment variables from the .env file
# and make them available to the application.
import os

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Get the absolute path to the backend directory
BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

# Load environment variables from .env file located in the backend directory
# Ensure this path is correct relative to your project structure
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
else:
    print(f"Warning: .env file not found at {ENV_PATH}")


class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "Vibes API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8001")) # Default port if not overridden

    # CORS settings - ensure these match your frontend origins
    CORS_ORIGINS: list[str] = [
        origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()
    ] or [ # Default if CORS_ORIGINS is empty or not set in .env
        "http://localhost:3000",  # React dev server
        "http://localhost:19000", # Expo on Android/iOS simulator
        "http://localhost:19001",
        "http://localhost:19002",
        "http://localhost:19003",
        "http://localhost:19004", 
        "http://localhost:19005",
        "http://localhost:19006", # Expo web
        "http://127.0.0.1:19000",
        "http://127.0.0.1:19006",
        "capacitor://localhost", # Capacitor
        "http://localhost",
        "http://localhost:8080",  # Alternative dev server
    ]


    # Database settings
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://user:password@db:5432/vibes_dev_db" # Example placeholder
    )

    # JWT settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "a_very_secret_key_that_should_be_in_env") # Replace default
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60") # e.g., 60 minutes
    )

    # Google Cloud settings (ensure these are set in .env or environment)
    GOOGLE_APPLICATION_CREDENTIALS: str | None = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_SPEECH_API_KEY: str | None = os.getenv("GOOGLE_SPEECH_API_KEY")
    GOOGLE_CLOUD_PROJECT: str | None = os.getenv("GOOGLE_CLOUD_PROJECT")
    GOOGLE_CLOUD_LOCATION: str = os.getenv("GOOGLE_CLOUD_LOCATION", "global") # 'global' often used for Speech-to-Text v1


    class Config:
        # Pydantic V2 uses model_config
        # env_file = ENV_PATH # env_file loading is handled by load_dotenv now
        # env_file_encoding = "utf-8"
        case_sensitive = True # Environment variable names are case-sensitive


# Create settings instance to be imported by other modules
settings = Settings()

# Optional: Print loaded settings during startup for debugging (if DEBUG is True)
# if settings.DEBUG:
#     print("--- Loaded Settings ---")
#     print(f"Environment: {settings.ENVIRONMENT}")
#     print(f"Debug Mode: {settings.DEBUG}")
#     print(f"Database URL: {settings.DATABASE_URL[:15]}...") # Avoid logging full sensitive URL
#     print(f"CORS Origins: {settings.CORS_ORIGINS}")
#     print("-----------------------")
