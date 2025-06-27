# OPAQUE Package Guide for Task 3-1

**Date:** 2025-01-20  
**Task:** 3-1 Create OPAQUE Client Wrapper  
**Original Documentation:** https://opaque-auth.com/docs/react-native  

## Overview

This guide documents the `react-native-opaque` package by Serenity Kit for implementing OPAQUE (Oblivious Pseudorandom Function) authentication in React Native applications. The package provides secure password-based client-server authentication without the server ever obtaining knowledge of the password.

## Package Details

- **Package:** `react-native-opaque`
- **Repository:** https://github.com/serenity-kit/react-native-opaque
- **Documentation:** https://opaque-auth.com/docs/react-native
- **License:** MIT
- **Current Version:** 0.3.1+ (as of research date)

## Key Benefits

1. **Zero-Knowledge Authentication**: Server never learns the password
2. **Cross-Platform**: Works on iOS, Android, and Web
3. **Security**: Prevents pre-computation attacks upon server compromise
4. **Forward Secrecy**: Session keys are ephemeral
5. **Foundation for E2E**: Can be used for encrypted backups and end-to-end encryption

## Installation

```bash
npm install react-native-opaque
```

## Core API

### Basic Registration Flow

```typescript
import * as opaque from 'react-native-opaque';

// 1. Client starts registration
const password = 'user-password-123';
const { clientRegistrationState, registrationRequest } = 
  opaque.client.startRegistration({ password });

// 2. Send registrationRequest to server
// Server processes and returns registrationResponse

// 3. Client finalizes registration
const { registrationUpload, exportKey } = 
  opaque.client.finishRegistration({
    password,
    registrationResponse, // from server
    clientRegistrationState
  });

// 4. Send registrationUpload to server for storage
```

### Basic Authentication Flow

```typescript
// 1. Client starts login
const { clientLoginState, credentialRequest } = 
  opaque.client.startLogin({ password });

// 2. Send credentialRequest to server
// Server processes and returns credentialResponse

// 3. Client finalizes login
const { credentialFinalization, sessionKey, exportKey } = 
  opaque.client.finishLogin({
    password,
    credentialResponse, // from server
    clientLoginState
  });

// 4. Send credentialFinalization to server for verification
```

### Server-Side API

```typescript
// Registration
const { registrationResponse, serverRegistrationState } = 
  opaque.server.startRegistration({
    registrationRequest, // from client
    serverPublicKey
  });

const { passwordFile } = 
  opaque.server.finishRegistration({
    registrationUpload, // from client
    serverRegistrationState
  });

// Login
const { credentialResponse, serverLoginState } = 
  opaque.server.startLogin({
    credentialRequest, // from client
    passwordFile, // stored from registration
    serverPrivateKey
  });

const { sessionKey } = 
  opaque.server.finishLogin({
    credentialFinalization, // from client
    serverLoginState
  });
```

## Web/Browser Considerations

For React Native Web, the package uses WebAssembly that needs to be loaded asynchronously:

```typescript
import * as opaque from 'react-native-opaque';

// Wait for module to be ready
await opaque.ready;

// Now safe to use OPAQUE functions
const { clientRegistrationState, registrationRequest } = 
  opaque.client.startRegistration({ password });
```

### Loading Component Pattern

```typescript
export default function LoadingApp() {
  const [opaqueStatus, setOpaqueStatus] = React.useState<
    'loading' | 'failed' | 'loaded'
  >('loading');

  React.useEffect(() => {
    async function waitForOpaque() {
      try {
        await opaque.ready;
        setOpaqueStatus('loaded');
      } catch (e) {
        console.warn(e);
        setOpaqueStatus('failed');
      }
    }
    waitForOpaque();
  }, []);

  if (opaqueStatus === 'loading') return <Loading />;
  if (opaqueStatus === 'failed') return <Error />;
  
  return <App />;
}
```

## Security Properties

1. **Password Hiding**: Server never sees the actual password
2. **Pre-computation Resistance**: Prevents rainbow table attacks
3. **Forward Secrecy**: Past sessions remain secure even if long-term keys are compromised
4. **Mutual Authentication**: Both client and server authenticate each other
5. **Export Keys**: Additional keys available for client-side encryption

## Error Handling

The package can throw various errors during operation:

```typescript
try {
  const result = opaque.client.startRegistration({ password });
} catch (error) {
  // Handle registration errors
  console.error('Registration failed:', error);
}
```

Common error scenarios:
- Invalid password format
- Network communication errors
- Cryptographic operation failures
- WebAssembly loading failures (Web only)

## Integration with Voice Processing

For our voice-to-text use case, OPAQUE authentication can be integrated as follows:

```typescript
// Voice phrase detection with OPAQUE
async function checkForSecretPhrase(transcribedText: string): Promise<AuthResult> {
  try {
    // Use transcribed text as password for OPAQUE authentication
    const { clientLoginState, credentialRequest } = 
      opaque.client.startLogin({ password: transcribedText });
    
    // Send to server for authentication
    const credentialResponse = await sendToServer(credentialRequest);
    
    const { sessionKey, exportKey } = 
      opaque.client.finishLogin({
        password: transcribedText,
        credentialResponse,
        clientLoginState
      });
    
    return { 
      authenticated: true, 
      sessionKey, 
      exportKey,
      tagId: deriveTagId(transcribedText)
    };
  } catch (error) {
    // Authentication failed - treat as regular text
    return { authenticated: false, content: transcribedText };
  }
}
```

## Performance Considerations

- **Registration**: ~1-2 seconds (includes key stretching)
- **Authentication**: ~500ms-1s (network dependent)
- **Memory**: Moderate due to cryptographic operations
- **CPU**: Higher during key derivation phases

## Platform-Specific Notes

### iOS
- Requires iOS 11+ (should work with our iOS 14+ target)
- Uses native cryptographic libraries for performance
- Integrates with iOS Keychain for secure storage

### Android
- Requires Android API 21+ (Android 5.0+)
- Uses native libraries via JNI
- Integrates with Android Keystore

### Web
- Uses WebAssembly for cryptographic operations
- Requires modern browser with WASM support
- Async initialization required

## Security Best Practices

1. **Key Stretching**: Use appropriate parameters for production
2. **Secure Storage**: Store registration data securely
3. **Network Security**: Use TLS for all communications
4. **Error Handling**: Don't leak information through error messages
5. **Session Management**: Implement proper session timeouts
6. **Memory Management**: Clear sensitive data from memory when done

## Testing

```typescript
// Mock OPAQUE for testing
jest.mock('react-native-opaque', () => ({
  client: {
    startRegistration: jest.fn(),
    finishRegistration: jest.fn(),
    startLogin: jest.fn(),
    finishLogin: jest.fn(),
  },
  server: {
    startRegistration: jest.fn(),
    finishRegistration: jest.fn(),
    startLogin: jest.fn(),
    finishLogin: jest.fn(),
  },
  ready: Promise.resolve(),
}));
```

## Migration from Legacy Authentication

When replacing existing authentication:

1. Run OPAQUE registration for existing users during next login
2. Maintain dual authentication during transition period
3. Gradually migrate all users to OPAQUE
4. Remove legacy authentication code after full migration

## Troubleshooting

### Common Issues

1. **WebAssembly Loading Failures**
   - Ensure network connectivity
   - Check browser WASM support
   - Verify correct async initialization

2. **Native Module Issues**
   - Rebuild native modules
   - Check platform-specific dependencies
   - Verify correct React Native version

3. **Authentication Failures**
   - Verify password consistency
   - Check server-side implementation
   - Ensure proper error handling

### Debug Mode

```typescript
// Enable debug logging (if available)
opaque.setDebugMode(true);
```

## Alternative Packages

Research showed other OPAQUE implementations:
- `@cloudflare/opaque-ts`: TypeScript implementation
- `opaque-ke`: Rust implementation
- Custom implementations using WebAssembly

The `react-native-opaque` package was selected as it's specifically designed for React Native with proper native module integration.

## Conclusion

The `react-native-opaque` package provides a robust, secure implementation of the OPAQUE protocol suitable for our voice-activated secret tag authentication system. It offers the security properties we need while maintaining compatibility across all target platforms. 