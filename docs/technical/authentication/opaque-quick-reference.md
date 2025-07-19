# OPAQUE Authentication Quick Reference

## API Endpoints

### Registration
```bash
# Start Registration
POST /api/auth/opaque/register/start
{
  "userIdentifier": "user@example.com",
  "registrationRequest": "base64_encoded_request",
  "name": "User Full Name"
}

# Finish Registration  
POST /api/auth/opaque/register/finish
{
  "userIdentifier": "user@example.com",
  "registrationRecord": "base64_encoded_record"
}
```

### Authentication
```bash
# Start Login
POST /api/auth/opaque/login/start
{
  "userIdentifier": "user@example.com", 
  "loginRequest": "base64_encoded_request"
}

# Finish Login
POST /api/auth/opaque/login/finish
{
  "userIdentifier": "user@example.com",
  "finishLoginRequest": "base64_encoded_request"
}
```

### Status Check
```bash
GET /api/auth/opaque/status
# Returns: {"opaque_enabled": true, "supported_features": {...}}
```

## Client-Side OPAQUE Operations

### Registration Flow
```javascript
// 1. Start registration
const { clientRegistrationState, registrationRequest } = 
  opaque.client.startRegistration({ password });

// 2. Send registrationRequest to server, get registrationResponse

// 3. Finish registration
const { registrationRecord } = opaque.client.finishRegistration({
  clientRegistrationState,
  registrationResponse, 
  password
});

// 4. Send registrationRecord to server
```

### Login Flow
```javascript
// 1. Start login
const { clientLoginState, startLoginRequest } = 
  opaque.client.startLogin({ password });

// 2. Send startLoginRequest to server, get loginResponse

// 3. Finish login
const clientResult = opaque.client.finishLogin({
  clientLoginState,
  loginResponse,
  password
});

// clientResult contains:
// - finishLoginRequest (send to server)
// - sessionKey (86 chars, matches server)
// - exportKey (86 chars, client-only)
// - serverStaticPublicKey

// 4. Send finishLoginRequest to server, get JWT token
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  hashed_password VARCHAR(500) NOT NULL,  -- OPAQUE registration record
  is_active BOOLEAN DEFAULT true,
  is_superuser BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### OPAQUE Sessions Table
```sql
CREATE TABLE opaque_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),  -- Temporary UUID during registration
  session_data BYTEA,    -- Encrypted session state
  session_state VARCHAR(50) NOT NULL,  -- 'registration_started' | 'login_started'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Common Error Codes

| Error | Cause | Solution |
|-------|--------|----------|
| `User already exists` | Email already registered | Use different email or login instead |
| `Invalid credentials` | User doesn't exist or wrong password | Check email/password |
| `No active login session` | Session expired or missing | Restart login flow |
| `base64 decoding failed` | Invalid OPAQUE data format | Check client OPAQUE library usage |
| `value too long for type` | Database field too small | Ensure hashed_password is VARCHAR(500) |
| `OPAQUE server did not return sessionKey` | Server OPAQUE operation failed | Check server setup and logs |

## Testing Commands

### Complete Flow Test
```bash
# Test with curl (replace base64 data with real OPAQUE output)
curl -X POST http://localhost:8001/api/auth/opaque/register/start \
  -H "Content-Type: application/json" \
  -d '{"userIdentifier":"test@example.com","registrationRequest":"dGVzdA==","name":"Test User"}'
```

### Database Verification
```sql
-- Check user creation
SELECT email, length(hashed_password), created_at FROM users WHERE email = 'test@example.com';

-- Check active sessions
SELECT session_state, expires_at FROM opaque_sessions WHERE expires_at > NOW();

-- Clean up test data
DELETE FROM users WHERE email LIKE 'test%@example.com';
DELETE FROM opaque_sessions WHERE expires_at < NOW();
```

## Environment Variables

```bash
# Required
OPAQUE_SERVER_SETUP=<171_character_base64_string>

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vibes_db

# JWT
JWT_SECRET_KEY=<your_secret_key>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

## Key Security Notes

1. **Never log passwords or OPAQUE intermediate states**
2. **Always use HTTPS in production**
3. **Session keys match verification**: `clientSessionKey === serverSessionKey`
4. **Export key is client-only**: Server never has access to exportKey
5. **Registration record is opaque**: Cannot be reversed to get password
6. **Session expiration**: Temporary sessions expire after 24 hours 