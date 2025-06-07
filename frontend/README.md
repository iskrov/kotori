# Vibes - Voice Journal App

A modern, secure voice journaling application built with React Native and FastAPI, featuring zero-knowledge encryption and AI-powered transcription.

## 🎯 Project Status: PRODUCTION READY

**Vibes** is a feature-complete voice journaling application with advanced security features, modern UI/UX design, and comprehensive functionality for personal voice note management.

### ✅ Core Features Implemented
- **Voice Recording & Transcription**: Google Cloud Speech-to-Text V2 integration with multi-language support
- **Zero-Knowledge Encryption**: Client-side encryption with hidden mode and coercion resistance
- **Modern UI/UX**: Floating tab navigation, modern forms, and professional recording interface
- **Journal Management**: Full CRUD operations with tags, search, and calendar integration
- **Authentication**: Google Sign-in with secure session management
- **Settings System**: Comprehensive user preferences and app customization

### 🏗️ Architecture Overview

**Frontend**: React Native with TypeScript
- Cross-platform (iOS, Android, Web)
- Modern navigation with floating tabs
- Zero-knowledge encryption client
- Google Speech-to-Text integration

**Backend**: FastAPI with Python
- RESTful API design
- PostgreSQL database with encryption metadata
- Secure environment configuration
- Production-ready deployment structure

**Security**: Zero-Knowledge Architecture
- Client-side encryption with hardware-backed key storage
- Hidden mode with voice activation
- Coercion resistance features
- No server-side decryption capability

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

The application supports multiple languages for voice transcription with automatic language detection capabilities.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8+
- PostgreSQL
- Google Cloud Project with Speech-to-Text API enabled

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

### Environment Configuration
Copy `.env.example` to `.env` and configure:
- Google Cloud credentials
- Database connection strings
- JWT secrets and encryption keys

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

## 🔧 Recent Updates (January 2025)

### ✅ UI/UX Improvements
- **Fixed Save/Discard Buttons Issue**: Resolved layout conflicts with floating tab bar
- **Enhanced Settings Page**: Comprehensive user preferences with modern component library
- **Improved Recording Interface**: Professional modal design with better feedback
- **Modern Component Library**: Consistent design patterns across the application

### ✅ Core Functionality
- **Calendar Integration**: Proper date selection and entry creation
- **Enhanced Journal Management**: Improved list navigation and search capabilities
- **Audio Recording Stability**: Fixed transcript display and save functionality
- **Navigation Architecture**: Modal-based recording screen with proper flow

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

4. **UI Layout Issues**
   - Clear browser cache and restart development server
   - Verify React Native Web compatibility
   - Check for conflicting styles in floating navigation

## 🔒 Security Features

### Zero-Knowledge Encryption
- All journal entries encrypted client-side before storage
- Server cannot decrypt user data even under compromise
- Hardware-backed key storage on supported devices

### Hidden Mode
- Voice-activated hidden journal entries
- Coercion resistance with decoy entries
- Panic mode for secure key deletion

### Authentication
- Google Sign-in integration
- Secure session management
- Automatic logout and cleanup

## 📱 Platform Support

- **iOS**: Full native experience with platform-specific optimizations
- **Android**: Complete feature parity with iOS version
- **Web**: Progressive web app with desktop-friendly interface

## 🏆 Project Achievements

- **Production-Ready Security**: Zero-knowledge architecture implemented
- **Modern UI/UX**: Contemporary design following mobile-first principles  
- **Cross-Platform**: Consistent experience across all platforms
- **Performance Optimized**: 60fps animations and efficient data handling
- **Accessibility Compliant**: WCAG 2.1 AA standards met
- **Comprehensive Testing**: Unit, integration, and security testing

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details. 