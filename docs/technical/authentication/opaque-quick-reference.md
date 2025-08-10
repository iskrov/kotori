# OPAQUE Authentication Quick Reference (Dual Authentication System)

## API Endpoints

### User Authentication (Dual Methods)

#### OAuth Authentication (Google Sign-in)
```bash
# Google OAuth Login
POST /api/v1/auth/google
{
  "token": "google_id_token"
}
```

#### OPAQUE User Authentication
```bash
# Start User Registration
POST /api/v1/auth/register/start
{
  "userIdentifier": "user@example.com",
  "opaque_registration_request": "base64_encoded_request",
  "name": "John Doe"
}

# Finish User Registration  
POST /api/v1/auth/register/finish
{
  "userIdentifier": "user@example.com",
  "opaque_registration_record": "base64_encoded_record",
  "session_id": "opaque_session_id"
}

# Start User Login
POST /api/v1/auth/login/start
{
  "userIdentifier": "user@example.com", 
  "client_credential_request": "base64_encoded_request"
}

# Finish User Login
POST /api/v1/auth/login/finish
{
  "session_id": "session_uuid",
  "client_credential_response": "base64_encoded_response",
  "userIdentifier": "user@example.com"
}
```

### Secret Tag Authentication (Always OPAQUE)
```bash
# Start Secret Tag Registration
POST /api/v1/secret-tags/register/start
Authorization: Bearer ${access_token}
{
  "tag_handle": [1,2,3,...32 bytes],
  "tag_name": "My Secret Tag",
  "color": "#FF5733",
  "opaque_registration_request": "base64_encoded_request"
}

# Finish Secret Tag Registration
POST /api/v1/secret-tags/register/finish
Authorization: Bearer ${access_token}
{
  "session_id": "session_uuid",
  "opaque_registration_record": "base64_encoded_record"
}

# Start Secret Tag Authentication
POST /api/v1/secret-tags/{tag_id}/auth/start
Authorization: Bearer ${access_token}
{
  "client_credential_request": "base64_encoded_request"
}

# Finish Secret Tag Authentication
POST /api/v1/secret-tags/{tag_id}/auth/finish
Authorization: Bearer ${access_token}
{
  "session_id": "session_uuid",
  "client_credential_response": "base64_encoded_response"
}
```

### Token Management
```bash
# Refresh Access Token
POST /api/v1/auth/refresh
Authorization: Bearer ${refresh_token}

# Logout
POST /api/v1/auth/logout
Authorization: Bearer ${access_token}
```

### Health Check
```bash
GET /health/opaque
# Returns: {"opaque_enabled": true, "supported_features": {...}}
```

## Client-Side OPAQUE Operations

### User Registration Flow
```javascript
// 1. Start registration
const { clientRegistrationState, registrationRequest } = 
  opaque.client.startRegistration({ password: userPassword });

const startResponse = await fetch('/api/v1/auth/register/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: userEmail,
    opaque_registration_request: registrationRequest
  })
});

// 2. Complete registration
const { registrationRecord } = opaque.client.finishRegistration({
  clientRegistrationState,
  registrationResponse: startResponse.opaque_registration_response,
  password: userPassword
});

const finishResponse = await fetch('/api/v1/auth/register/finish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: userEmail,
    opaque_registration_record: registrationRecord
  })
});
```

### User Login Flow
```javascript
// 1. Start login
const { clientLoginState, startLoginRequest } = 
  opaque.client.startLogin({ password: userPassword });

const startResponse = await fetch('/api/v1/auth/login/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: userEmail,
    client_credential_request: startLoginRequest
  })
});

// 2. Complete login
const finishLoginRequest = opaque.client.finishLogin({
  clientLoginState,
  loginResponse: startResponse.server_credential_response,
  password: userPassword
});

const finishResponse = await fetch('/api/v1/auth/login/finish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: startResponse.session_id,
    client_credential_response: finishLoginRequest
  })
});
```

### Secret Tag Operations
```javascript
// Secret tag registration
const tagHandle = crypto.getRandomValues(new Uint8Array(32));
const { clientRegistrationState, registrationRequest } = 
  opaque.client.startRegistration({ password: secretPhrase });

const startResponse = await fetch('/api/v1/secret-tags/register/start', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tag_handle: Array.from(tagHandle),
    tag_name: "My Secret Tag",
    color: "#FF5733",
    opaque_registration_request: registrationRequest
  })
});

// Secret tag authentication
const { clientLoginState, startLoginRequest } = 
  opaque.client.startLogin({ password: secretPhrase });

const authResponse = await fetch(`/api/v1/secret-tags/${tagId}/auth/start`, {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    client_credential_request: startLoginRequest
  })
});
```

## Database Schema

### Users Table (Dual Authentication)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    
    -- OAuth authentication
    google_id TEXT UNIQUE NULL,
    
    -- OPAQUE authentication  
    opaque_envelope BYTEA NULL,
    
    -- Secret tag preferences
    show_secret_tag_names BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: exactly one authentication method
    CONSTRAINT user_auth_method CHECK (
        (google_id IS NOT NULL AND opaque_envelope IS NULL) OR
        (google_id IS NULL AND opaque_envelope IS NOT NULL)
    )
);
```

### Secret Tags Table
```sql
CREATE TABLE secret_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_handle BYTEA(32) UNIQUE NOT NULL,
    opaque_envelope BYTEA NOT NULL,
    tag_name TEXT NOT NULL,
    color TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `400 Bad Request` | Invalid OPAQUE request format | Check base64 encoding and client library |
| `401 Unauthorized` | Authentication failed | Verify credentials and token validity |
| `409 Conflict` | User/tag already exists | Use different email or tag name |
| `422 Unprocessable Entity` | Invalid input format | Validate email format and required fields |

## Testing Commands

```bash
# Test OPAQUE service health
curl http://localhost:8001/health/opaque

# Test user registration
curl -X POST http://localhost:8001/api/v1/auth/register/start \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","opaque_registration_request":"dGVzdA=="}'

# Test OAuth authentication
curl -X POST http://localhost:8001/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"token":"google_id_token_here"}'

# Test secret tag creation
curl -X POST http://localhost:8001/api/v1/secret-tags/register/start \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tag_handle":[1,2,3],"tag_name":"Test Tag","opaque_registration_request":"dGVzdA=="}'
```

## Database Queries

```sql
-- Check user authentication methods
SELECT email, 
       CASE 
         WHEN google_id IS NOT NULL THEN 'OAuth'
         WHEN opaque_envelope IS NOT NULL THEN 'OPAQUE'
         ELSE 'Invalid'
       END as auth_method,
       created_at 
FROM users;

-- Check secret tags
SELECT u.email, st.tag_name, st.color, 
       encode(st.tag_handle, 'hex') as tag_handle_hex
FROM secret_tags st
JOIN users u ON st.user_id = u.id;

-- Check active sessions
SELECT ts.id, u.email, st.tag_name, ts.created_at
FROM tag_sessions ts
JOIN users u ON ts.user_id = u.id  
JOIN secret_tags st ON ts.tag_id = st.id
WHERE ts.created_at > NOW() - INTERVAL '15 minutes';
``` 