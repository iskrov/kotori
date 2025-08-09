# OPAQUE Authentication Workflow (Dual Authentication System)

## Overview

The Kotori application uses a **dual authentication system** supporting both OAuth (Google Sign-in) and OPAQUE (Oblivious Pseudorandom Functions) for zero-knowledge user authentication. This ensures maximum flexibility while maintaining strong security guarantees.

## Key Components

### Backend Infrastructure
- **OPAQUE Library**: `@serenity-kit/opaque` Node.js implementation
- **Server Setup**: Persistent OPAQUE server configuration
- **Database Storage**: PostgreSQL with dual authentication schema
- **Session Management**: Temporary session storage for multi-step authentication flows

### Database Schema
- **Users Table**: Dual authentication with `google_id` (OAuth) and `opaque_envelope` (OPAQUE)
- **Tag Sessions Table**: Ephemeral storage for secret tag authentication
- **Key Fields**:
  - `users.google_id`: OAuth user identifier (NULL for OPAQUE users)
  - `users.opaque_envelope`: OPAQUE registration record (NULL for OAuth users)
  - `tag_sessions.server_ephemeral`: Temporary OPAQUE authentication state

## User Authentication (Dual Methods)

### OAuth Authentication (Google Sign-in)

**Single-Step Flow**:
1. **Frontend**: User clicks "Sign in with Google"
2. **Google OAuth**: Standard OAuth 2.0 flow
3. **API Call**: `POST /api/v1/auth/google`
   - **Request**: `{ token: "google_id_token" }`
   - **Server Process**:
     - Validates Google ID token
     - Creates/updates user with `google_id`, `opaque_envelope=NULL`
     - Generates JWT access and refresh tokens
   - **Response**: `{ access_token, refresh_token, user, token_type: "bearer" }`

### OPAQUE User Authentication

#### User Registration Flow

**Phase 1: Registration Start**
1. **Frontend**: User enters email and password
2. **Client OPAQUE**: Generate registration request
   ```javascript
   const { clientRegistrationState, registrationRequest } = 
     opaque.client.startRegistration({ password });
   ```
3. **API Call**: `POST /api/v1/auth/register/start`
   - **Request**: `{ email, opaque_registration_request }`
   - **Server Process**:
     - Validates email doesn't exist
     - Calls OPAQUE server to create registration response
     - Stores temporary session state
   - **Response**: `{ opaque_registration_response, session_id }`

**Phase 2: Registration Finish**
1. **Client OPAQUE**: Complete registration
   ```javascript
   const { registrationRecord } = opaque.client.finishRegistration({
     clientRegistrationState, registrationResponse, password
   });
   ```
2. **API Call**: `POST /api/v1/auth/register/finish`
   - **Request**: `{ email, opaque_registration_record }`
   - **Server Process**:
     - Creates user with `opaque_envelope`, `google_id=NULL`
     - Stores OPAQUE registration record
     - Generates JWT tokens
   - **Response**: `{ access_token, refresh_token, user, token_type: "bearer" }`

#### User Login Flow

**Phase 1: Login Start**
1. **Frontend**: User enters email and password
2. **Client OPAQUE**: Generate credential request
   ```javascript
   const { clientLoginState, startLoginRequest } = 
     opaque.client.startLogin({ password });
   ```
3. **API Call**: `POST /api/v1/auth/login/start`
   - **Request**: `{ email, client_credential_request }`
   - **Server Process**:
     - Looks up user by email
     - Calls OPAQUE server with stored envelope
     - Creates temporary session
   - **Response**: `{ server_credential_response, session_id }`

**Phase 2: Login Finish**
1. **Client OPAQUE**: Complete authentication
   ```javascript
   const finishLoginRequest = opaque.client.finishLogin({
     clientLoginState, loginResponse, password
   });
   ```
2. **API Call**: `POST /api/v1/auth/login/finish`
   - **Request**: `{ session_id, client_credential_response }`
   - **Server Process**:
     - Validates OPAQUE authentication
     - Generates JWT tokens
     - Cleans up temporary session
   - **Response**: `{ access_token, refresh_token, user, token_type: "bearer" }`

## Secret Tag Authentication (Always OPAQUE)

**Key Principle**: Secret tags use OPAQUE authentication regardless of whether the user authenticated via OAuth or OPAQUE.

### Secret Tag Registration

**Phase 1: Registration Start**
1. **Client**: Generate random 32-byte tag handle
2. **Client OPAQUE**: Start registration with secret phrase
3. **API Call**: `POST /api/v1/secret-tags/register/start`
   - **Headers**: `Authorization: Bearer ${access_token}`
   - **Request**: `{ tag_handle, tag_name, color, opaque_registration_request }`
   - **Response**: `{ opaque_registration_response, session_id }`

**Phase 2: Registration Finish**
1. **Client OPAQUE**: Complete registration
2. **API Call**: `POST /api/v1/secret-tags/register/finish`
   - **Headers**: `Authorization: Bearer ${access_token}`
   - **Request**: `{ session_id, opaque_registration_record }`
   - **Response**: `{ success: true, tag: { id, tag_handle, tag_name, color } }`

### Secret Tag Authentication

**Phase 1: Authentication Start**
1. **Client OPAQUE**: Start login with secret phrase
2. **API Call**: `POST /api/v1/secret-tags/{tag_id}/auth/start`
   - **Headers**: `Authorization: Bearer ${access_token}`
   - **Request**: `{ client_credential_request }`
   - **Response**: `{ server_credential_response, session_id }`

**Phase 2: Authentication Finish**
1. **Client OPAQUE**: Complete authentication
2. **API Call**: `POST /api/v1/secret-tags/{tag_id}/auth/finish`
   - **Headers**: `Authorization: Bearer ${access_token}`
   - **Request**: `{ session_id, client_credential_response }`
   - **Response**: `{ success: true, tag_access_token }`

## Token Management

### Token Refresh
```bash
POST /api/v1/auth/refresh
Authorization: Bearer ${refresh_token}
# Returns: { access_token, token_type: "bearer" }
```

### Logout
```bash
POST /api/v1/auth/logout
Authorization: Bearer ${access_token}
# Returns: { message: "Logged out successfully" }
```

## Error Handling

### Common Error Responses

| Error Code | Scenario | Solution |
|------------|----------|----------|
| `400 Bad Request` | Invalid OPAQUE request | Check client library usage |
| `401 Unauthorized` | Authentication failed | Verify credentials |
| `409 Conflict` | User already exists | Use login instead of registration |
| `422 Unprocessable Entity` | Invalid email format | Validate input format |

### Debugging Commands

```bash
# Check OPAQUE service status
curl http://localhost:8001/health/opaque

# Test user registration
curl -X POST http://localhost:8001/api/v1/auth/register/start \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","opaque_registration_request":"..."}'

# Test secret tag authentication
curl -X POST http://localhost:8001/api/v1/secret-tags/register/start \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tag_handle":[...],"tag_name":"Test Tag","opaque_registration_request":"..."}'
```

## Database Queries

```sql
-- Check user authentication method
SELECT email, 
       CASE 
         WHEN google_id IS NOT NULL THEN 'OAuth'
         WHEN opaque_envelope IS NOT NULL THEN 'OPAQUE'
         ELSE 'Invalid'
       END as auth_method,
       created_at 
FROM users 
WHERE email = 'test@example.com';

-- Check secret tags for user
SELECT st.tag_name, st.color, st.created_at,
       encode(st.tag_handle, 'hex') as tag_handle_hex
FROM secret_tags st
JOIN users u ON st.user_id = u.id
WHERE u.email = 'test@example.com';

-- Check active tag sessions
SELECT ts.id, u.email, st.tag_name, ts.created_at
FROM tag_sessions ts
JOIN users u ON ts.user_id = u.id
JOIN secret_tags st ON ts.tag_id = st.id
WHERE ts.created_at > NOW() - INTERVAL '15 minutes';
```

## Security Considerations

### Zero-Knowledge Properties
- **OAuth users**: Can create OPAQUE-protected secret tags
- **OPAQUE users**: Full zero-knowledge for both user auth and secret tags
- **Server storage**: Only OPAQUE envelopes, never passwords or phrases

### Session Management
- **User sessions**: 30-minute access tokens, 30-day refresh tokens
- **Tag sessions**: 5-minute tag access tokens for encrypted content
- **Ephemeral storage**: Tag authentication sessions cleaned up automatically

### Timing Attack Prevention
- **Constant timing**: 100ms minimum response time on all OPAQUE endpoints
- **Consistent flows**: Same response patterns for success/failure 