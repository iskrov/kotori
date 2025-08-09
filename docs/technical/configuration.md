# Configuration Guide (Kotori)

This document lists required environment variables for backend and frontend. Do not commit real secrets. Use Secret Manager (prod) and local `.env` files (dev) that are git-ignored.

## Backend (.env)

- APP_NAME=Kotori API
- ENVIRONMENT=development
- DEBUG=True
- HOST=0.0.0.0
- PORT=8001
- DATABASE_URL=postgresql://postgres:password@localhost:5432/kotori_dev
- SECRET_KEY=change-me-in-prod
- ALGORITHM=HS256
- ACCESS_TOKEN_EXPIRE_MINUTES=60
- GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/gcp-service-account.json
- GOOGLE_SPEECH_API_KEY=
- GOOGLE_CLOUD_PROJECT=kotori-io
- GOOGLE_CLOUD_LOCATION=global
- SPEECH_MAX_ALTERNATIVES=3
- SPEECH_ENABLE_WORD_CONFIDENCE=true
- SPEECH_ENABLE_AUTOMATIC_PUNCTUATION=true
- SPEECH_ENABLE_VOICE_ACTIVITY_DETECTION=true
- SPEECH_MODEL=chirp_2
- SPEECH_MIN_CONFIDENCE_THRESHOLD=0.7
- ENCRYPTION_MASTER_SALT=<random-hex>
- HIDDEN_MODE_TIMEOUT_MINUTES=2
- CORS_ORIGINS=http://localhost:19006,http://localhost:19000,http://localhost:5173

## Frontend (.env)

- API_URL=http://localhost:8001
- GOOGLE_CLIENT_ID=
- GOOGLE_CLOUD_PROJECT_ID=kotori-io
- GOOGLE_SPEECH_API_KEY=

Notes:
- Production API base URL is `https://api.kotori.io` and is configured per environment; frontend default is local.
- Prefer ADC (Application Default Credentials) via `GOOGLE_APPLICATION_CREDENTIALS` for dev and Workload Identity in prod.
