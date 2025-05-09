## Google Cloud Speech-to-Text Setup

This application uses Google Cloud Speech-to-Text API for transcribing voice recordings. Follow these steps to set up the required credentials:

1. **Create a Google Cloud Project**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Note your Project ID

2. **Enable the Speech-to-Text API**:
   - In the Cloud Console, go to "APIs & Services" > "Library"
   - Search for "Speech-to-Text API" and enable it for your project

3. **Create API Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create credentials" and select "API key"
   - Copy your new API key

4. **Configure the Application**:
   - Copy the `.env.example` file to `.env`
   - Replace the placeholder values with your actual Project ID and API key:
     ```
     GOOGLE_CLOUD_PROJECT_ID=your-actual-project-id
     GOOGLE_SPEECH_API_KEY=your-actual-api-key
     ```
   - These credentials will be used for all users of the application

5. **Security Best Practices**:
   - Never commit your `.env` file to version control
   - Restrict your API key in the Google Cloud Console to only the necessary APIs
   - Consider setting up API key restrictions based on IP, HTTP referrers, etc.
   - For production, use more secure authentication methods like service accounts

The application now supports multiple languages for voice transcription, automatically detecting the language used (up to 3 languages can be selected).

## Testing the Speech-to-Text API

To verify that your Google Cloud Speech-to-Text API configuration is working correctly, you can use the included test script:

```bash
# From the frontend directory
node scripts/test-speech-api.js
```

This script will:
1. Check if your API key and project ID are configured
2. Attempt to connect to the Google Cloud Speech-to-Text API
3. Report whether the connection was successful
4. Provide troubleshooting steps if the connection failed

If the test fails, the app will automatically fall back to text-only input and inform users that voice recording is temporarily unavailable.

### Troubleshooting Common Issues

1. **API Key Issues**
   - Ensure your `GOOGLE_SPEECH_API_KEY` is set correctly in `.env`
   - Verify that the API key has the correct permissions
   - Check if the API key has any restrictions (IP, referrers, etc.)

2. **Project Configuration**
   - Confirm that the Speech-to-Text API is enabled for your project
   - Verify that your `GOOGLE_CLOUD_PROJECT_ID` is correct in `.env`
   - Check if your project has billing enabled (required for the Speech-to-Text API)

3. **Network Issues**
   - Ensure your device has internet connectivity
   - Check if any firewalls or proxies might be blocking requests
   - Try running the test from a different network 