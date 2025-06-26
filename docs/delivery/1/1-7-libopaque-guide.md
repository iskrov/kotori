# libopaque Python Library Guide

**Date**: 2025-01-19  
**Task**: 1-7 OPAQUE Server Integration  
**Source**: https://github.com/stef/libopaque  

## Overview

`libopaque` is a mature C implementation of the OPAQUE protocol with Python bindings. It implements the IRTF CFRG draft specification and provides comprehensive server-side OPAQUE functionality.

## Key Features

- **Full OPAQUE Protocol**: Implements both registration and authentication flows
- **Python Bindings**: Native Python interface to C library
- **IRTF CFRG Compliant**: Follows the official OPAQUE specification
- **Production Ready**: Well-tested with demos and examples
- **Cryptographic Foundation**: Built on libsodium for security

## Dependencies

### System Dependencies
```bash
# Ubuntu/Debian
sudo apt-get install libsodium-dev pkgconf

# macOS
brew install libsodium pkg-config
```

### Python Dependencies
- libsodium1
- liboprf2 (included as submodule)

## Installation

```bash
# Clone with submodules
git clone --recursive https://github.com/stef/libopaque.git
cd libopaque

# Build the C library
cd src
make

# Install Python bindings
cd ../python
python setup.py install
```

## Core API Functions

### Registration Flow (4-step protocol)

#### Step 1: Client Registration Request
```python
import opaque

# Client side - create registration request
sec, req = opaque.CreateRegistrationRequest(password)
# sec: sensitive client context (keep secret)
# req: request to send to server
```

#### Step 2: Server Registration Response
```python
# Server side - process registration request
ssec, resp = opaque.CreateRegistrationResponse(req, server_private_key=None)
# ssec: sensitive server context (keep secret until step 4)
# resp: response to send back to client
```

#### Step 3: Client Finalize Request
```python
# Client side - finalize registration
rec_stub, export_key = opaque.FinalizeRequest(sec, resp, ids)
# rec_stub: record stub to send to server
# export_key: key for encrypting additional client data
```

#### Step 4: Server Store Record
```python
# Server side - complete and store user record
record = opaque.StoreUserRecord(ssec, rec_stub)
# record: complete user record to store in database
```

### Authentication Flow (3-step protocol)

#### Step 1: Client Credential Request
```python
# Client side - initiate authentication
sec, req = opaque.CreateCredentialRequest(password)
# sec: sensitive client context (keep secret until step 3)
# req: credential request to send to server
```

#### Step 2: Server Credential Response
```python
# Server side - process credential request
resp, shared_key, ssec = opaque.CreateCredentialResponse(
    req, stored_record, ids, context
)
# resp: response to send to client
# shared_key: server's copy of the shared secret
# ssec: sensitive context for optional step 4
```

#### Step 3: Client Recover Credentials
```python
# Client side - recover credentials and shared key
shared_key, auth_token, export_key, ids = opaque.RecoverCredentials(
    resp, sec, context, ids
)
# shared_key: client's copy of shared secret (must match server's)
# auth_token: optional authentication token for explicit client auth
# export_key: key for decrypting additional client data
```

#### Step 4: Optional Server User Authentication
```python
# Server side - explicit client authentication (optional)
is_authentic = opaque.UserAuth(ssec, auth_token)
# Returns True if client authentication is valid
```

## Data Structures and Types

### IDs Structure
```python
ids = {
    'client_id': b'client_identifier',
    'server_id': b'server_identifier'
}
```

### Context String
- Used for domain separation
- Should be unique per application/protocol instance
- Example: b'MyApp-OPAQUE-v1'

### Server Private Key
- Optional long-term server private key
- If None, generates user-specific keypair
- 32 bytes for ristretto255 curve

## Cryptographic Parameters

### Curve
- **ristretto255**: Based on libsodium's ristretto25519
- **Key Size**: 32 bytes
- **Security Level**: ~128-bit

### Password Hashing
- **Algorithm**: Argon2id
- **Parameters**: 
  - `crypto_pwhash_OPSLIMIT_INTERACTIVE`
  - `crypto_pwhash_MEMLIMIT_INTERACTIVE`

### Random Number Generation
- Uses OS cryptographic random source
- `randombytes` from libsodium

## Error Handling

```python
try:
    # OPAQUE operations
    result = opaque.CreateRegistrationRequest(password)
except Exception as e:
    # Handle OPAQUE-specific errors
    print(f"OPAQUE error: {e}")
```

## Security Considerations

### Server-Side Security
1. **Never log passwords**: Server never sees plaintext passwords
2. **Protect contexts**: Keep `ssec` and `sec` contexts secure
3. **Secure storage**: Store user records securely in database
4. **Timing attacks**: Use constant-time operations where possible

### Zero-Knowledge Properties
1. **Password privacy**: Server learns nothing about client password
2. **Salt privacy**: Per-user salt never transmitted in clear
3. **Pre-computation resistance**: Resistant to offline dictionary attacks

## Integration Patterns

### FastAPI Integration Example
```python
from fastapi import FastAPI, HTTPException
import opaque
import base64

app = FastAPI()

# In-memory storage (use database in production)
user_records = {}
pending_registrations = {}

@app.post("/auth/opaque/register/start")
async def start_registration(request: dict):
    username = request["username"]
    reg_request = base64.b64decode(request["request"])
    
    # Step 2: Create registration response
    ssec, resp = opaque.CreateRegistrationResponse(reg_request)
    
    # Store server context temporarily
    pending_registrations[username] = ssec
    
    return {
        "response": base64.b64encode(resp).decode()
    }

@app.post("/auth/opaque/register/finish")
async def finish_registration(request: dict):
    username = request["username"]
    rec_stub = base64.b64decode(request["record"])
    
    # Get stored server context
    ssec = pending_registrations.pop(username)
    
    # Step 4: Store user record
    record = opaque.StoreUserRecord(ssec, rec_stub)
    user_records[username] = record
    
    return {"success": True}

@app.post("/auth/opaque/login/start")
async def start_login(request: dict):
    username = request["username"]
    cred_request = base64.b64decode(request["request"])
    
    if username not in user_records:
        raise HTTPException(404, "User not found")
    
    # Step 2: Create credential response
    ids = {
        'client_id': username.encode(),
        'server_id': b'myserver'
    }
    context = b'MyApp-OPAQUE-v1'
    
    resp, shared_key, ssec = opaque.CreateCredentialResponse(
        cred_request, user_records[username], ids, context
    )
    
    # Store for session management
    session_id = generate_session_id()
    store_session(session_id, shared_key, ssec)
    
    return {
        "response": base64.b64encode(resp).decode(),
        "session_id": session_id
    }
```

### Database Schema
```sql
-- User OPAQUE records table
CREATE TABLE opaque_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    opaque_record BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Temporary registration contexts
CREATE TABLE opaque_registrations (
    username VARCHAR(255) PRIMARY KEY,
    server_context BYTEA NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

-- Active sessions
CREATE TABLE opaque_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    shared_key BYTEA NOT NULL,
    server_context BYTEA,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);
```

## Testing and Debugging

### Debug Mode
```bash
# Build with debugging enabled
make DEFINES='-DTRACE -DNORANDOM' clean libopaque.so tests
```

### Test Vectors
- Library includes comprehensive test vectors
- Located in `src/tests/opaque-test.c`
- Python tests in `python/test/`

## Performance Considerations

### Optimization Tips
1. **Async Operations**: Use async/await for I/O operations
2. **Connection Pooling**: Pool database connections
3. **Caching**: Cache frequently accessed user records
4. **Memory Management**: Clear sensitive contexts after use

### Benchmarking
- Registration: ~50-100ms per operation
- Authentication: ~30-50ms per operation
- Memory usage: ~1-2MB per concurrent operation

## Migration from Traditional Auth

### Gradual Migration Strategy
```python
async def authenticate_user(username: str, password: str):
    # Try OPAQUE first
    if has_opaque_record(username):
        return await opaque_authenticate(username, password)
    
    # Fallback to traditional auth
    if verify_traditional_password(username, password):
        # Optionally migrate to OPAQUE
        await migrate_to_opaque(username, password)
        return True
    
    return False
```

## Production Deployment

### Security Checklist
- [ ] Use HTTPS for all OPAQUE endpoints
- [ ] Implement rate limiting on auth endpoints
- [ ] Use secure random number generation
- [ ] Protect server private keys
- [ ] Clear sensitive contexts after use
- [ ] Monitor for timing attacks
- [ ] Regular security audits

### Monitoring
- Track authentication success/failure rates
- Monitor response times for performance
- Log security-relevant events (without passwords)
- Alert on unusual authentication patterns

## Additional Resources

- **IRTF CFRG Draft**: https://github.com/cfrg/draft-irtf-cfrg-opaque
- **Original Paper**: https://eprint.iacr.org/2018/163.pdf
- **Live Demo**: Available in libopaque repository
- **Blog Posts**: Multiple explanatory posts linked in README

## Version Compatibility

- **libopaque**: Latest stable version
- **Python**: 3.7+ recommended
- **libsodium**: 1.0.18+ required
- **OPAQUE Draft**: Implements latest IRTF CFRG specification 