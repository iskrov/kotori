# Serenity-Kit OPAQUE Library Guide

**Date:** 2025-01-19  
**Original Documentation:** [opaque-auth.com](https://opaque-auth.com)  
**Repository:** [github.com/serenity-kit/opaque](https://github.com/serenity-kit/opaque)

## Overview

Serenity-Kit OPAQUE is a production-ready JavaScript implementation of the OPAQUE protocol. It provides secure password-based authentication without the server ever learning the password, making it ideal for zero-knowledge authentication systems.

### Key Features

- **Production Ready**: Used by WhatsApp and Messenger for encrypted features
- **Security Audited**: Penetration tested by 7ASecurity through OTF's Red Team Lab
- **Full OPAQUE Protocol**: Complete implementation with all security guarantees
- **Cross-Platform**: Works in browsers, Node.js, and React Native
- **TypeScript Support**: Full TypeScript definitions included
- **Well Documented**: Comprehensive documentation and examples

## Installation

### Node.js/Backend Usage

```bash
npm install @serenity-kit/opaque
```

### Browser/Frontend Usage

```bash
npm install @serenity-kit/opaque
```

For React Native:
```bash
npm install @serenity-kit/opaque react-native-opaque
```

## Core API

### Registration Flow (4 Steps)

#### Step 1: Client Registration Start

```javascript
import { client } from '@serenity-kit/opaque';

const password = 'user-password';
const { registrationRequest, clientRegistrationState } = 
  client.startRegistration({ password });

// Send registrationRequest to server
```

#### Step 2: Server Registration Response

```javascript
import { server } from '@serenity-kit/opaque';

const { registrationResponse, serverRegistrationState } = 
  server.createRegistrationResponse({
    registrationRequest,
    serverPublicKey, // Your server's public key
  });

// Send registrationResponse back to client
```

#### Step 3: Client Registration Finalization

```javascript
const { registrationRecord, exportKey } = 
  client.finishRegistration({
    clientRegistrationState,
    registrationResponse,
    clientIdentity: 'user@example.com', // Optional
    serverIdentity: 'example.com',      // Optional
  });

// Send registrationRecord to server for storage
```

#### Step 4: Server Registration Storage

```javascript
const finalRegistrationRecord = 
  server.finishRegistration({
    serverRegistrationState,
    registrationRecord,
  });

// Store finalRegistrationRecord in database
```

### Authentication Flow (3 Steps)

#### Step 1: Client Authentication Start

```javascript
const password = 'user-password';
const { credentialRequest, clientLoginState } = 
  client.startLogin({ password });

// Send credentialRequest to server
```

#### Step 2: Server Authentication Response

```javascript
const { credentialResponse, serverLoginState } = 
  server.startLogin({
    credentialRequest,
    serverPrivateKey,
    registrationRecord, // From database
    clientIdentity: 'user@example.com', // Optional
    serverIdentity: 'example.com',      // Optional
  });

// Send credentialResponse back to client
```

#### Step 3: Client Authentication Finalization

```javascript
const { finishLoginResult } = 
  client.finishLogin({
    clientLoginState,
    credentialResponse,
    clientIdentity: 'user@example.com', // Must match registration
    serverIdentity: 'example.com',      // Must match registration
  });

const { sessionKey, exportKey } = finishLoginResult;

// Generate final authentication proof
const { message: authenticationMessage } = 
  client.createAuthenticationMessage({
    finishLoginResult,
  });

// Send authenticationMessage to server for verification
```

#### Step 4: Server Authentication Verification

```javascript
const { sessionKey } = 
  server.finishLogin({
    serverLoginState,
    authenticationMessage,
  });

// Authentication successful - sessionKey matches client's sessionKey
```

## Python Integration Strategies

### Option 1: Subprocess Bridge

Create a Node.js script that can be called from Python:

**opaque_bridge.js:**
```javascript
#!/usr/bin/env node
const { client, server } = require('@serenity-kit/opaque');

const operation = process.argv[2];
const input = JSON.parse(process.argv[3]);

async function main() {
  try {
    let result;
    
    switch (operation) {
      case 'start_registration':
        result = client.startRegistration({ password: input.password });
        break;
      
      case 'create_registration_response':
        result = server.createRegistrationResponse({
          registrationRequest: input.registrationRequest,
          serverPublicKey: input.serverPublicKey,
        });
        break;
      
      case 'finish_registration':
        result = client.finishRegistration({
          clientRegistrationState: input.clientRegistrationState,
          registrationResponse: input.registrationResponse,
          clientIdentity: input.clientIdentity,
          serverIdentity: input.serverIdentity,
        });
        break;
      
      // Add other operations...
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    console.log(JSON.stringify({ success: true, result }));
  } catch (error) {
    console.log(JSON.stringify({ success: false, error: error.message }));
  }
}

main();
```

**Python wrapper:**
```python
import subprocess
import json
from typing import Dict, Any

class OpaqueJSBridge:
    def __init__(self, bridge_script_path: str):
        self.bridge_script_path = bridge_script_path
    
    def _call_js(self, operation: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Call JavaScript bridge and return result"""
        try:
            result = subprocess.run([
                'node', self.bridge_script_path, 
                operation, 
                json.dumps(input_data)
            ], capture_output=True, text=True, check=True)
            
            response = json.loads(result.stdout)
            if not response['success']:
                raise Exception(f"JS Bridge Error: {response['error']}")
            
            return response['result']
        except subprocess.CalledProcessError as e:
            raise Exception(f"Bridge call failed: {e.stderr}")
    
    def start_registration(self, password: str) -> Dict[str, Any]:
        return self._call_js('start_registration', {'password': password})
    
    def create_registration_response(self, registration_request: Dict[str, Any], 
                                   server_public_key: str) -> Dict[str, Any]:
        return self._call_js('create_registration_response', {
            'registrationRequest': registration_request,
            'serverPublicKey': server_public_key
        })
    
    # Add other methods...
```

### Option 2: HTTP Microservice

Create a simple Express.js microservice:

**opaque_service.js:**
```javascript
const express = require('express');
const { client, server } = require('@serenity-kit/opaque');

const app = express();
app.use(express.json());

app.post('/start-registration', (req, res) => {
  try {
    const { password } = req.body;
    const result = client.startRegistration({ password });
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/create-registration-response', (req, res) => {
  try {
    const { registrationRequest, serverPublicKey } = req.body;
    const result = server.createRegistrationResponse({
      registrationRequest,
      serverPublicKey,
    });
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Add other endpoints...

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`OPAQUE service running on port ${PORT}`);
});
```

**Python client:**
```python
import requests
from typing import Dict, Any

class OpaqueHTTPClient:
    def __init__(self, base_url: str = 'http://localhost:3001'):
        self.base_url = base_url
    
    def start_registration(self, password: str) -> Dict[str, Any]:
        response = requests.post(f'{self.base_url}/start-registration', 
                               json={'password': password})
        response.raise_for_status()
        result = response.json()
        if not result['success']:
            raise Exception(result['error'])
        return result['result']
    
    # Add other methods...
```

### Option 3: PyExecJS Integration

Using PyExecJS for direct JavaScript execution:

```python
import execjs
import json

class OpaqueJSEngine:
    def __init__(self):
        # Load the OPAQUE library
        with open('node_modules/@serenity-kit/opaque/dist/index.js', 'r') as f:
            opaque_js = f.read()
        
        self.ctx = execjs.compile(f"""
            {opaque_js}
            
            function startRegistration(password) {{
                return client.startRegistration({{ password: password }});
            }}
            
            function createRegistrationResponse(registrationRequest, serverPublicKey) {{
                return server.createRegistrationResponse({{
                    registrationRequest: registrationRequest,
                    serverPublicKey: serverPublicKey
                }});
            }}
            
            // Add other wrapper functions...
        """)
    
    def start_registration(self, password: str) -> Dict[str, Any]:
        return self.ctx.call('startRegistration', password)
    
    # Add other methods...
```

## Security Considerations

### Key Management

- **Server Keys**: Generate and securely store server public/private key pairs
- **Session Keys**: Use derived session keys for application-level encryption
- **Export Keys**: Use export keys for additional application-specific encryption

### Memory Security

- Clear sensitive data from memory after use
- Use secure string handling for passwords
- Implement proper cleanup in error cases

### Validation

- Always validate inputs before processing
- Check message authenticity and integrity
- Implement proper error handling

### Network Security

- Use HTTPS for all communications
- Implement proper CSRF protection
- Validate all incoming requests

## Error Handling

Common error scenarios and handling:

```javascript
try {
  const result = client.startRegistration({ password });
  // Handle success
} catch (error) {
  if (error.message.includes('Invalid password')) {
    // Handle invalid password
  } else if (error.message.includes('Protocol error')) {
    // Handle protocol errors
  } else {
    // Handle other errors
  }
}
```

## Performance Considerations

- **Client-Side**: OPAQUE offloads password hashing to the client
- **Caching**: Cache registration records securely on server
- **Concurrency**: Handle multiple authentication requests efficiently
- **Memory**: Monitor memory usage for long-running services

## Testing

### Unit Testing Example

```javascript
const { client, server } = require('@serenity-kit/opaque');

describe('OPAQUE Registration', () => {
  test('should complete registration flow', async () => {
    const password = 'test-password';
    const serverKeyPair = server.generateKeyPair();
    
    // Step 1: Client starts registration
    const { registrationRequest, clientRegistrationState } = 
      client.startRegistration({ password });
    
    // Step 2: Server creates response
    const { registrationResponse, serverRegistrationState } = 
      server.createRegistrationResponse({
        registrationRequest,
        serverPublicKey: serverKeyPair.publicKey,
      });
    
    // Step 3: Client finishes registration
    const { registrationRecord } = 
      client.finishRegistration({
        clientRegistrationState,
        registrationResponse,
      });
    
    // Step 4: Server finalizes
    const finalRecord = 
      server.finishRegistration({
        serverRegistrationState,
        registrationRecord,
      });
    
    expect(finalRecord).toBeDefined();
  });
});
```

## Compatibility with Existing Frontend

The serenity-kit/opaque library is the same library used by the frontend client, ensuring perfect compatibility. The client-side implementation in `speechToText.ts` and `VoicePhraseDetector.ts` already uses this library.

## Migration from Current Implementation

1. **Replace OPAQUE Server**: Replace `opaque_server.py` with JavaScript bridge
2. **Update Service Layer**: Modify `EnhancedOpaqueService` to use bridge
3. **Maintain API**: Keep existing Python API for seamless integration
4. **Add Tests**: Comprehensive testing for bridge implementation
5. **Documentation**: Update all relevant documentation

This approach provides the security guarantees of the OPAQUE protocol while maintaining compatibility with the existing Python backend architecture. 