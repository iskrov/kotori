# Kotori - Voice Journal App

A modern, secure voice journaling application built with React Native and FastAPI, featuring zero-knowledge phrase-based encryption and AI-powered transcription.

## 🎯 Project Status: PRODUCTION READY

**Kotori** is a feature-complete voice journaling application with advanced security features, modern UI/UX design, and comprehensive functionality for personal voice note management.
### Project Management Docs

- Backlog: `docs/delivery/backlog.md`
- TODO: `docs/todo.md`
- DONE: `docs/done.md`

### ✅ Core Features Implemented
- **Voice Recording & Transcription**: Google Cloud Speech-to-Text V2 integration with multi-language support
- **Zero-Knowledge Encryption**: Client-side per-user encryption
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

**Security**: Zero-Knowledge Architecture
- Client-side encryption with hardware-backed key storage
- Per-user encryption keys derived from OPAQUE
- Secret tags deprecated and disabled by default
- No server-side decryption capability

## Backend API Integration & Authentication

**Note**: This application uses a backend API for Google Cloud Speech-to-Text integration and supports dual authentication methods.

### Dual Authentication API Configuration

**Option 1: Google OAuth Authentication (Recommended for most users)**
```bash
# Quick sign-in with Google account
POST /api/v1/auth/google
# Response: { access_token, refresh_token }
```

**Option 2: OPAQUE Zero-Knowledge Authentication (Maximum security)**
```bash
# Registration flow
POST /api/v1/auth/register/start
POST /api/v1/auth/register/finish

# Login flow
POST /api/v1/auth/login/start
POST /api/v1/auth/login/finish
# Response: { access_token, refresh_token }
```

Note: Request field names for OPAQUE follow the schema in `backend/app/schemas/opaque_user.py` and use `userIdentifier`, not `email`.


### Key Benefits
- **OAuth users** get convenience without secret tags (removed in PBI-4 Stage 2)
- **OPAQUE users** get complete zero-knowledge protection for user auth
- Frontend sends audio data to `/api/v1/speech/transcribe` endpoint
- Secure, centralized API management with flexible authentication

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

### Zero-Knowledge Password-Based Encryption
- All journal entries encrypted client-side before storage
- Server cannot decrypt user data even under compromise
- Hardware-backed key storage on supported devices
- Password-to-key derivation using Argon2 hashing



### Dual Authentication System
- **Google Sign-in (OAuth)**: Quick and convenient user authentication via `/api/v1/auth/google`
- **OPAQUE Zero-Knowledge**: Password-based authentication with no server-side secrets via `/api/v1/auth/*`
- Secure session management with JWT tokens for both authentication types
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