# Gemini Authentication Configuration

This document describes the authentication methods available for Google's Gemini API integration in the Kotori application.

## Overview

The Gemini service (`backend/app/services/gemini_service.py`) supports two authentication methods:

1. **Service Account Credentials** (Recommended for production)
2. **API Key** (Fallback method)

The service automatically tries service account authentication first, then falls back to API key if unavailable.

## Authentication Methods

### 1. Service Account Authentication (Recommended)

Service account authentication is more secure and recommended for production environments.

#### Setup

1. **Create Service Account** in Google Cloud Console:
   - Go to IAM & Admin > Service Accounts
   - Create a new service account
   - Grant the "Generative Language User" role
   - Download the JSON key file

2. **Configure Environment**:
   ```bash
   # In your .env file
   GOOGLE_APPLICATION_CREDENTIALS=../.keys/kotori-gemini-keys.json
   ```

3. **File Structure**:
   ```
   kotori/
   ├── .keys/
   │   └── kotori-gemini-keys.json    # Service account key file
   ├── backend/
   └── frontend/
   ```

#### Benefits
- ✅ More secure than API keys
- ✅ Better for production environments
- ✅ Supports fine-grained IAM permissions
- ✅ Can be rotated without code changes
- ✅ Audit trail in Google Cloud Console

### 2. API Key Authentication (Fallback)

API key authentication is simpler but less secure.

#### Setup

1. **Get API Key** from Google AI Studio:
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Create a new API key
   - Copy the key value

2. **Configure Environment**:
   ```bash
   # In your .env file
   GEMINI_API_KEY=your-api-key-here
   ```

#### Limitations
- ⚠️ Less secure than service accounts
- ⚠️ Harder to rotate and manage
- ⚠️ No fine-grained permissions
- ⚠️ Limited audit capabilities

## Configuration Priority

The Gemini service tries authentication methods in this order:

1. **Service Account** (`GOOGLE_APPLICATION_CREDENTIALS`)
2. **API Key** (`GEMINI_API_KEY`)
3. **Disabled** (Neither configured)

## Implementation Details

### Code Structure

```python
class GeminiService:
    def initialize_client(self):
        # Try service account first
        credentials = self._get_credentials()
        if credentials:
            genai.configure(credentials=credentials)
        elif settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
        else:
            # Service disabled
            return
```

### Service Account Scopes

The service account requires the following OAuth 2.0 scope:
- `https://www.googleapis.com/auth/generative-language`

### Error Handling

- **File Not Found**: Falls back to API key authentication
- **Invalid Credentials**: Falls back to API key authentication
- **No Authentication**: Service is disabled with warning log
- **Gemini API Errors**: Raises `GeminiError` exception

## Current Usage

The Gemini service is actively used for:

1. **Share Generation** (`ShareService`):
   - Mapping journal entries to template questions
   - Generating structured Q&A pairs for PDF reports
   - Multi-language translation support

2. **Template Import** (`TemplateImportService`):
   - Extracting questions from uploaded PDF/DOCX files
   - Converting documents to structured templates

3. **PDF Report Generation**:
   - Creating structured summaries from journal entries
   - Formatting content for healthcare providers
   - Supporting multiple languages

## Model Configuration

- **Model**: `gemini-2.5-flash`
- **Features**: Structured output, multi-language support
- **Rate Limiting**: Built-in rate limiter for API calls
- **Caching**: LRU cache for frequently used operations

## Logging

The service provides detailed logging for troubleshooting:

```
INFO: Gemini client initialized with service account credentials
INFO: Service account credentials loaded successfully for Gemini
INFO: Gemini client initialized successfully with gemini-2.5-flash model
```

Or for fallback:

```
DEBUG: GOOGLE_APPLICATION_CREDENTIALS not set, will try API key authentication
INFO: Gemini client initialized with API key
```

## Security Best Practices

1. **Use Service Accounts** in production
2. **Store credentials securely** outside the repository
3. **Rotate credentials regularly**
4. **Monitor API usage** in Google Cloud Console
5. **Use least-privilege permissions**
6. **Never commit credentials** to version control

## Troubleshooting

### Common Issues

1. **"Credentials file not found"**:
   - Check the path in `GOOGLE_APPLICATION_CREDENTIALS`
   - Ensure the file exists relative to project root

2. **"Invalid credentials"**:
   - Verify the service account has correct permissions
   - Check if the key file is corrupted

3. **"Gemini service not available"**:
   - Verify either `GOOGLE_APPLICATION_CREDENTIALS` or `GEMINI_API_KEY` is set
   - Check the application logs for initialization errors

### Debug Commands

```bash
# Check if credentials file exists
ls -la .keys/kotori-gemini-keys.json

# Test service account permissions
gcloud auth activate-service-account --key-file=.keys/kotori-gemini-keys.json
gcloud auth list

# Validate API key (if using)
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1/models
```

## Migration Guide

### From API Key to Service Account

1. Create service account in Google Cloud Console
2. Download JSON key file to `.keys/` directory
3. Add `GOOGLE_APPLICATION_CREDENTIALS` to `.env`
4. Remove or comment out `GEMINI_API_KEY`
5. Restart the backend service
6. Verify logs show service account authentication

### Environment Variables

```bash
# Before (API Key)
GEMINI_API_KEY=your-api-key-here

# After (Service Account)
GOOGLE_APPLICATION_CREDENTIALS=../.keys/kotori-gemini-keys.json
# GEMINI_API_KEY=your-api-key-here  # Keep as fallback if desired
```

The service will automatically use the service account when available, providing a seamless transition.
