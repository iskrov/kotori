# OPAQUE Authentication Workflow

## Overview

The Vibes application uses the OPAQUE (Oblivious Pseudorandom Functions) protocol for zero-knowledge user authentication. This ensures that the server never sees or stores user passwords in plain text, while still being able to verify user authentication.

## Key Components

### Backend Infrastructure
- **OPAQUE Library**: `@serenity-kit/opaque` Node.js implementation
- **Server Setup**: 171-character base64-encoded server configuration
- **Database Storage**: PostgreSQL with specialized schema for OPAQUE records
- **Session Management**: Temporary session storage for multi-step authentication flows

### Database Schema
- **Users Table**: Standard user information with OPAQUE registration record
- **OPAQUE Sessions Table**: Temporary storage for authentication state
- **Key Fields**:
  - `users.hashed_password`: OPAQUE registration record (up to 500 characters)
  - `opaque_sessions.session_data`: Temporary cryptographic state
  - `opaque_sessions.session_state`: Current phase ('registration_started', 'login_started')

## User Registration Flow

### Phase 1: Registration Start
1. **Frontend**: User enters email and password
2. **Client OPAQUE**: Generate registration request
   ```javascript
   const { clientRegistrationState, registrationRequest } = 
     opaque.client.startRegistration({ password });
   ```
3. **API Call**: `POST /api/auth/opaque/register/start`
   - **Request**: `{ userIdentifier, registrationRequest, name }`
   - **Server Process**:
     - Validates user doesn't exist
     - Calls OPAQUE server to create registration response
     - Stores temporary session with user's name and temporary UUID (since real user doesn't exist yet)
     - Uses `temp_user_id` to satisfy database constraints during registration phase
   - **Response**: `{ registrationResponse }`

### Phase 2: Registration Finish
1. **Client OPAQUE**: Complete registration
   ```javascript
   const { registrationRecord } = opaque.client.finishRegistration({
     clientRegistrationState, registrationResponse, password
   });
   ```
2. **API Call**: `POST /api/auth/opaque/register/finish`
   - **Request**: `{ userIdentifier, registrationRecord }`
   - **Server Process**:
     - Finds temporary session by matching email in session data (since temp_user_id was used)
     - Creates new user record with real UUID
     - Stores OPAQUE registration record as "hashed_password"
     - Cleans up temporary session
   - **Response**: `{ success: true, message: "User registered successfully" }`

## User Authentication Flow

### Phase 1: Login Start
1. **Frontend**: User enters email and password
2. **Client OPAQUE**: Generate login request
   ```javascript
   const { clientLoginState, startLoginRequest } = 
     opaque.client.startLogin({ password });
   ```
3. **API Call**: `POST /api/auth/opaque/login/start`
   - **Request**: `{ userIdentifier, loginRequest }`
   - **Server Process**:
     - Retrieves user's OPAQUE registration record
     - Calls OPAQUE server to start login process
     - Stores temporary server login state
   - **Response**: `{ loginResponse }`

### Phase 2: Login Finish
1. **Client OPAQUE**: Complete login
   ```javascript
   const clientResult = opaque.client.finishLogin({
     clientLoginState, loginResponse, password
   });
   // Returns: { finishLoginRequest, sessionKey, exportKey, serverStaticPublicKey }
   ```
2. **API Call**: `POST /api/auth/opaque/login/finish`
   - **Request**: `{ userIdentifier, finishLoginRequest }`
   - **Server Process**:
     - Retrieves stored server login state
     - Calls OPAQUE server to finish login verification
     - Generates JWT access token
     - Cleans up temporary session
   - **Response**: 
     ```json
     {
       "success": true,
       "user": { "id", "email", "full_name", ... },
       "token": "jwt_access_token",
       "token_type": "bearer",
       "sessionKey": "server_derived_session_key",
       "exportKey": null,
       "message": "Login successful"
     }
     ```

## Key Security Properties

### Zero-Knowledge Authentication
- **Server Never Sees Password**: Only cryptographic challenges are exchanged
- **Registration Record**: Stored as opaque blob, not reversible to password
- **Session Keys**: Both client and server derive identical session keys without sharing them

### Session Key Derivation
- **Client Side**: Derives `sessionKey` (86 chars) and `exportKey` (86 chars)
- **Server Side**: Derives matching `sessionKey` (86 chars), no `exportKey`
- **Verification**: `clientSessionKey === serverSessionKey` confirms successful authentication

### Cryptographic Guarantees
- **Forward Secrecy**: Session keys are unique per login session
- **Server Compromise Resistance**: Stolen server data cannot reveal passwords
- **Offline Attack Protection**: No password hashes available for cracking

## Troubleshooting Guide

### Common Issues

#### Registration Failures
1. **"User already exists"**: Email already registered
2. **"Validation error: name field required"**: Missing name in registration start
3. **"base64 decoding failed"**: Invalid OPAQUE data format
4. **"value too long for type"**: Database field length insufficient (check `hashed_password` field)

#### Login Failures
1. **"Invalid credentials"**: User doesn't exist or wrong password
2. **"No active login session"**: Session expired or missing
3. **"Client login failed"**: Password mismatch or corrupted server response
4. **"OPAQUE server did not return sessionKey"**: Server-side OPAQUE operation failed

### Diagnostic Steps

#### Verify OPAQUE Server Setup
```bash
curl http://localhost:8001/api/auth/opaque/status
# Should return: {"opaque_enabled": true, "supported_features": {...}}
```

#### Check Database Schema
```sql
-- Verify user table structure
\d users;
-- Check hashed_password field length (should be VARCHAR(500))

-- Check active sessions
SELECT session_state, expires_at FROM opaque_sessions 
WHERE expires_at > NOW();
```

#### Test Complete Flow
```bash
# 1. Test registration start
curl -X POST http://localhost:8001/api/auth/opaque/register/start \
  -H "Content-Type: application/json" \
  -d '{"userIdentifier":"test@example.com","registrationRequest":"test","name":"Test User"}'

# 2. Test login start (after registration)
curl -X POST http://localhost:8001/api/auth/opaque/login/start \
  -H "Content-Type: application/json" \
  -d '{"userIdentifier":"test@example.com","loginRequest":"test"}'
```

### Session Management

#### Session Cleanup
- **Registration Sessions**: Automatically cleaned up after successful registration
- **Login Sessions**: Automatically cleaned up after successful login
- **Expired Sessions**: Cleaned up by session expiration (24 hours default)

#### Session State Tracking
- `registration_started`: User began registration, awaiting finish
- `login_started`: User began login, awaiting finish
- Sessions expire after 24 hours to prevent stale state

## Integration Points

### Frontend Integration
- **React Native**: Uses OPAQUE client library for cryptographic operations
- **State Management**: Manages client-side cryptographic state between API calls
- **Token Storage**: Stores JWT token for authenticated API requests

### Backend Integration
- **FastAPI Endpoints**: RESTful API following OPAQUE protocol phases
- **Database Persistence**: User records with OPAQUE registration data
- **JWT Authentication**: Standard JWT tokens for post-authentication API access

### Security Considerations
- **HTTPS Required**: All OPAQUE exchanges must use encrypted transport
- **Session Expiration**: Temporary sessions have built-in expiration
- **Input Validation**: All OPAQUE data validated for proper base64 encoding
- **Error Handling**: Generic error messages to prevent user enumeration

## Performance Characteristics

### Computational Overhead
- **Registration**: ~1-3 seconds (includes Argon2 key stretching)
- **Login**: ~1-3 seconds (includes Argon2 key stretching)
- **Memory Usage**: Moderate due to cryptographic operations

### Scaling Considerations
- **Stateless Design**: Each phase is independent, supports horizontal scaling
- **Database Load**: Standard user table queries, no special indexing needed
- **Session Storage**: Temporary sessions have minimal storage impact

## Monitoring and Logging

### Key Metrics
- Registration success/failure rates
- Login success/failure rates  
- Session timeout rates
- OPAQUE server operation latency

### Log Entries
- User registration attempts and completions
- Login attempts and completions
- Session creation and cleanup
- OPAQUE server operation errors

### Health Checks
- OPAQUE server status endpoint
- Database connectivity for session storage
- JWT token generation capability 