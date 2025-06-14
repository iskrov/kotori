# Vibes - Voice Journal App

A modern, secure voice journaling application built with React Native and FastAPI, featuring zero-knowledge phrase-based encryption and AI-powered transcription.

## 🎯 Project Status: PRODUCTION READY

**Vibes** is a feature-complete voice journaling application with advanced security features, modern UI/UX design, and comprehensive functionality for personal voice note management.

### ✅ Core Features Implemented
- **Voice Recording & Transcription**: Google Cloud Speech-to-Text V2 integration with multi-language support
- **Zero-Knowledge Phrase-Based Encryption**: Client-side encryption with voice-activated secret tags and coercion resistance
- **Modern UI/UX**: Floating tab navigation, modern forms, and professional recording interface
- **Journal Management**: Full CRUD operations with tags, search, and calendar integration
- **Authentication**: Google Sign-in with secure session management
- **Settings System**: Comprehensive user preferences and app customization

### 🏗️ Architecture Overview

**Frontend**: React Native with TypeScript
- Cross-platform (iOS, Android, Web)
- Modern navigation with floating tabs
- Zero-knowledge encryption client with phrase detection
- Backend API integration for transcription

**Backend**: FastAPI with Python
- RESTful API design
- PostgreSQL database with encryption metadata
- Google Cloud Speech-to-Text API integration
- Production-ready deployment structure

**Security**: Zero-Knowledge Phrase-Based Architecture
- Client-side encryption with hardware-backed key storage
- Voice-activated secret tags with phrase detection
- Coercion resistance features
- No server-side decryption capability

## Backend API Integration

**Note**: This application uses a backend API for Google Cloud Speech-to-Text integration. The frontend no longer directly accesses Google Cloud APIs.

### API Configuration
- The backend handles all Google Cloud Speech-to-Text API communication
- Frontend sends audio data to `/api/speech/transcribe` endpoint
- No Google Cloud credentials needed in frontend environment
- Secure, centralized API management

### Environment Configuration
Copy `.env.example` to `.env` and configure:
```bash
# Frontend environment variables
EXPO_PUBLIC_API_URL=http://localhost:8001  # Backend API URL
# No Google Cloud credentials needed in frontend
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Backend API server running (see main README.md)
- Expo CLI for development

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Backend Dependency
The frontend requires the backend API to be running for:
- Speech-to-text transcription
- Journal entry storage and retrieval
- User authentication
- Secret tags management

Refer to the main project README.md for backend setup instructions.

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
- **Phrase-Based Encryption**: Voice-activated secret tags with real-time phrase detection

### Troubleshooting Common Issues

1. **Backend Connection Issues**
   - Ensure the backend API server is running on the configured URL
   - Verify `EXPO_PUBLIC_API_URL` is set correctly in `.env`
   - Check network connectivity between frontend and backend

2. **Speech Transcription Issues**
   - Verify backend has proper Google Cloud credentials configured
   - Check backend logs for Speech-to-Text API errors
   - Ensure microphone permissions are granted

3. **Authentication Issues**
   - Verify Google Sign-in configuration in backend
   - Check if authentication tokens are being properly stored
   - Clear app data and re-authenticate if needed

4. **UI Layout Issues**
   - Clear browser cache and restart development server
   - Verify React Native Web compatibility
   - Check for conflicting styles in floating navigation

## 🔒 Security Features

### Zero-Knowledge Phrase-Based Encryption
- All journal entries encrypted client-side before storage
- Server cannot decrypt user data even under compromise
- Hardware-backed key storage on supported devices
- Phrase-to-key derivation using Argon2 hashing

### Voice-Activated Secret Tags
- Real-time phrase detection during recording
- Automatic encryption with phrase-derived keys
- Coercion resistance with independent tag activation
- Progressive disclosure of private content

### Authentication
- Google Sign-in integration
- Secure session management
- Automatic logout and cleanup

## 📱 Platform Support

- **iOS**: Full native experience with platform-specific optimizations
- **Android**: Complete feature parity with iOS version
- **Web**: Progressive web app with desktop-friendly interface

## 🏆 Project Achievements

- **Production-Ready Security**: Zero-knowledge phrase-based architecture implemented
- **Modern UI/UX**: Contemporary design following mobile-first principles  
- **Cross-Platform**: Consistent experience across all platforms
- **Performance Optimized**: 60fps animations and efficient data handling
- **Accessibility Compliant**: WCAG 2.1 AA standards met
- **Comprehensive Testing**: Unit, integration, and security testing

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details. 