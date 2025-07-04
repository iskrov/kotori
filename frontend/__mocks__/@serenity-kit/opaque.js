// Mock for @serenity-kit/opaque module
module.exports = {
  client: {
    startRegistration: jest.fn(() => ({
      clientRegistrationState: 'mock-client-state',
      registrationRequest: 'mock-registration-request',
    })),
    finishRegistration: jest.fn(() => ({
      registrationUpload: 'mock-upload',
      exportKey: new Uint8Array([1, 2, 3, 4]),
    })),
    startLogin: jest.fn(() => ({
      clientLoginState: 'mock-login-state',
      credentialRequest: 'mock-credential-request',
    })),
    finishLogin: jest.fn(() => ({
      credentialFinalization: 'mock-finalization',
      sessionKey: new Uint8Array([1, 2, 3, 4]),
      exportKey: new Uint8Array([5, 6, 7, 8]),
    })),
  },
}; 