# Gemini Authentication Configuration

This document describes the authentication methods available for Google's Gemini API integration in the Kotori application.

## Overview

The Gemini service (`backend/app/services/gemini_service.py`) supports two authentication methods:

1. **Application Default Credentials (ADC)** (Production - recommended)
2. **API Key** (Fallback method)

The service automatically uses ADC when available, then falls back to API key if needed.

## Authentication Methods

### 1. Application Default Credentials (ADC) - Production

**Recommended for Cloud Run production deployments.** The application automatically uses the Cloud Run service account without requiring explicit credentials.

#### Setup

1. **Service Account**: `kotori-api@kotori-io.iam.gserviceaccount.com`
2. **Required Permissions**: `roles/aiplatform.user`
3. **No Configuration Needed**: Cloud Run automatically provides credentials

#### Benefits
- ✅ Most secure - no credential files to manage
- ✅ Automatic credential rotation
- ✅ No secrets to store or rotate
- ✅ Built-in to Google Cloud services

### 2. Service Account File (Development)

For local development, you can use a service account key file.

#### Setup

1. **Download Service Account Key**:
   ```bash
   gcloud iam service-accounts keys create ./local-dev-key.json \
     --iam-account=kotori-api@kotori-io.iam.gserviceaccount.com
   ```

2. **Configure Environment**:
   ```bash
   # In your .env file (development only)
   GOOGLE_APPLICATION_CREDENTIALS=./local-dev-key.json
   ```

⚠️ **Important**: Delete the key file after development to maintain security.

#### Benefits
- ✅ Enables local development and testing
- ✅ Same permissions as production service account
- ✅ No need for separate API keys
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

1. **Application Default Credentials** (Cloud Run service account)
2. **Service Account File** (`GOOGLE_APPLICATION_CREDENTIALS`)
3. **API Key** (`GEMINI_API_KEY`)
4. **Disabled** (None configured)

## Implementation Details

### Code Structure

```python
class GeminiService:
    def initialize_client(self):
        # Try Application Default Credentials first (Cloud Run)
        try:
            # ADC automatically used when available
            genai.configure()
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        except Exception:
            # Fallback to explicit credentials or API key
            credentials = self._get_credentials()
            if credentials:
                genai.configure(credentials=credentials)
            elif settings.GEMINI_API_KEY:
                genai.configure(api_key=settings.GEMINI_API_KEY)
            else:
                # Service disabled
                return
```

### Service Account Permissions

The `kotori-api@kotori-io.iam.gserviceaccount.com` service account has these IAM roles:
- `roles/aiplatform.user` - Vertex AI Gemini model access
- `roles/speech.client` - Speech-to-Text API access  
- `roles/cloudsql.client` - Database connectivity
- `roles/secretmanager.secretAccessor` - Configuration access
- `roles/logging.logWriter` - Application logging
- `roles/monitoring.metricWriter` - Metrics collection

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

**Production (ADC)**:
```
INFO: Vertex AI initialized successfully with Application Default Credentials
INFO: Gemini client initialized successfully with gemini-2.5-flash model
```

**Development (Service Account File)**:
```
INFO: Gemini client initialized with service account credentials
INFO: Service account credentials loaded successfully for Gemini
```

**Fallback (API Key)**:
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

**Production (Cloud Run - No configuration needed)**:
```bash
# No environment variables required
# Cloud Run automatically provides Application Default Credentials
```

**Development (Local)**:
```bash
# Option 1: Service Account File
GOOGLE_APPLICATION_CREDENTIALS=./local-dev-key.json

# Option 2: API Key (fallback)
GEMINI_API_KEY=your-api-key-here
```

The service automatically detects the available authentication method.
