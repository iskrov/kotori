/**
 * Comprehensive tests for OpaqueClient
 * Tests all functionality including error handling, memory management, and cross-platform behavior
 */

import { Platform } from 'react-native';
import { OpaqueClient, opaqueClient } from '../crypto/OpaqueClient';
import { OpaqueError, AuthenticationError, NetworkError } from '../crypto/errors';

// Mock react-native-opaque
jest.mock('react-native-opaque', () => ({
  ready: Promise.resolve(),
  client: {
    startRegistration: jest.fn(),
    finishRegistration: jest.fn(),
    startLogin: jest.fn(),
    finishLogin: jest.fn(),
  },
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios', // Default to iOS for testing
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockOpaque = require('react-native-opaque');

describe('OpaqueClient', () => {
  let client: OpaqueClient;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset client state
    client = OpaqueClient.getInstance();
    
    // Reset the client's initialization state for testing
    (client as any).isInitialized = false;
    
    // Reset mock implementations
    mockOpaque.ready = Promise.resolve();
    mockOpaque.client.startRegistration.mockClear();
    mockOpaque.client.finishRegistration.mockClear();
    mockOpaque.client.startLogin.mockClear();
    mockOpaque.client.finishLogin.mockClear();
  });

  afterEach(() => {
    // Clean up memory after each test
    client.clearMemory();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = OpaqueClient.getInstance();
      const instance2 = OpaqueClient.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export singleton instance', () => {
      expect(opaqueClient).toBeInstanceOf(OpaqueClient);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully on iOS/Android', async () => {
      (Platform as any).OS = 'ios';
      
      await expect(client.initialize()).resolves.not.toThrow();
      expect(client.getInitializationStatus()).toBe(true);
    });

    it('should initialize successfully on Web after WASM loads', async () => {
      (Platform as any).OS = 'web';
      
      await expect(client.initialize()).resolves.not.toThrow();
      expect(client.getInitializationStatus()).toBe(true);
    });

    it('should handle WASM loading failure on Web', async () => {
      (Platform as any).OS = 'web';
      
      // Create a rejected promise that will cause initialization to fail
      mockOpaque.ready = Promise.reject(new Error('WASM failed to load'));
      
      await expect(client.initialize()).rejects.toThrow(OpaqueError);
      expect(client.getInitializationStatus()).toBe(false);
    });

    it('should throw error when using uninitialized client', async () => {
      const uninitializedClient = OpaqueClient.getInstance();
      
      await expect(
        uninitializedClient.startRegistration('password123')
      ).rejects.toThrow('OPAQUE client not initialized');
    });
  });

  describe('Registration Flow', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should start registration successfully', async () => {
      const mockResult = {
        clientRegistrationState: 'mock-client-state',
        registrationRequest: 'mock-registration-request',
      };
      
      mockOpaque.client.startRegistration.mockReturnValue(mockResult);
      
      const result = await client.startRegistration('password123');
      
      expect(result).toEqual({
        registrationRequest: 'mock-registration-request',
        clientState: 'mock-client-state',
      });
      expect(mockOpaque.client.startRegistration).toHaveBeenCalledWith({
        password: 'password123',
      });
    });

    it('should handle registration start failure', async () => {
      mockOpaque.client.startRegistration.mockImplementation(() => {
        throw new Error('Registration failed');
      });
      
      await expect(
        client.startRegistration('password123')
      ).rejects.toThrow(OpaqueError);
    });

    it('should finish registration successfully', async () => {
      const mockResult = {
        registrationUpload: 'mock-upload',
        exportKey: new Uint8Array([1, 2, 3, 4]),
      };
      
      mockOpaque.client.finishRegistration.mockReturnValue(mockResult);
      
      const result = await client.finishRegistration(
        'password123',
        'mock-client-state',
        { registrationResponse: 'mock-response' }
      );
      
      expect(result).toEqual({
        registrationUpload: 'mock-upload',
        exportKey: new Uint8Array([1, 2, 3, 4]),
      });
    });

    it('should handle invalid registration finish result', async () => {
      mockOpaque.client.finishRegistration.mockReturnValue(null);
      
      await expect(
        client.finishRegistration(
          'password123',
          'mock-client-state',
          { registrationResponse: 'mock-response' }
        )
      ).rejects.toThrow(OpaqueError);
    });
  });

  describe('Login Flow', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should start login successfully', async () => {
      const mockResult = {
        clientLoginState: 'mock-login-state',
        credentialRequest: 'mock-credential-request',
      };
      
      mockOpaque.client.startLogin.mockReturnValue(mockResult);
      
      const result = await client.startLogin('password123');
      
      expect(result).toEqual({
        credentialRequest: 'mock-credential-request',
        clientState: 'mock-login-state',
      });
    });

    it('should finish login successfully', async () => {
      const mockResult = {
        credentialFinalization: 'mock-finalization',
        sessionKey: new Uint8Array([1, 2, 3, 4]),
        exportKey: new Uint8Array([5, 6, 7, 8]),
      };
      
      mockOpaque.client.finishLogin.mockReturnValue(mockResult);
      
      const result = await client.finishLogin(
        'password123',
        'mock-login-state',
        { credentialResponse: 'mock-response' }
      );
      
      expect(result).toEqual({
        credentialFinalization: 'mock-finalization',
        sessionKey: new Uint8Array([1, 2, 3, 4]),
        exportKey: new Uint8Array([5, 6, 7, 8]),
      });
    });

    it('should handle authentication failure', async () => {
      mockOpaque.client.finishLogin.mockReturnValue(null);
      
      await expect(
        client.finishLogin(
          'wrong-password',
          'mock-login-state',
          { credentialResponse: 'mock-response' }
        )
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Key Derivation', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should derive vault keys successfully', async () => {
      const exportKey = new Uint8Array(32).fill(1);
      const secretPhrase = 'my secret phrase';
      
      // Mock crypto.subtle for testing
      const mockDigest = jest.fn().mockResolvedValue(new ArrayBuffer(32));
      const mockImportKey = jest.fn().mockResolvedValue({});
      const mockDeriveBits = jest.fn().mockResolvedValue(new ArrayBuffer(32));
      
      global.crypto = {
        subtle: {
          digest: mockDigest,
          importKey: mockImportKey,
          deriveBits: mockDeriveBits,
        },
      } as any;
      
      const result = await client.deriveVaultKeys(exportKey, secretPhrase);
      
      expect(result).toHaveProperty('tagId');
      expect(result).toHaveProperty('dataKey');
      expect(result).toHaveProperty('vaultId');
      expect(result.tagId).toBeInstanceOf(Uint8Array);
      expect(result.dataKey).toBeInstanceOf(Uint8Array);
      expect(typeof result.vaultId).toBe('string');
    });

    it('should handle key derivation errors', async () => {
      const exportKey = new Uint8Array(32).fill(1);
      const secretPhrase = 'my secret phrase';
      
      // Mock crypto.subtle to throw error
      global.crypto = {
        subtle: {
          digest: jest.fn().mockRejectedValue(new Error('Crypto error')),
        },
      } as any;
      
      await expect(
        client.deriveVaultKeys(exportKey, secretPhrase)
      ).rejects.toThrow(OpaqueError);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should clear memory without errors', () => {
      expect(() => client.clearMemory()).not.toThrow();
    });

    it('should register and clear sensitive data', async () => {
      const mockResult = {
        registrationUpload: 'mock-upload',
        exportKey: new Uint8Array([1, 2, 3, 4]),
      };
      
      mockOpaque.client.finishRegistration.mockReturnValue(mockResult);
      
      await client.finishRegistration(
        'password123',
        'mock-client-state',
        { registrationResponse: 'mock-response' }
      );
      
      // Verify that memory can be cleared
      expect(() => client.clearMemory()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should wrap unknown errors in OpaqueError', async () => {
      mockOpaque.client.startRegistration.mockImplementation(() => {
        throw new Error('Unknown error');
      });
      
      try {
        await client.startRegistration('password123');
        fail('Expected OpaqueError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OpaqueError);
        expect((error as OpaqueError).message).toContain('Failed to start OPAQUE registration');
      }
    });

    it('should preserve specific error types', async () => {
      const authError = new AuthenticationError('Auth failed');
      mockOpaque.client.finishLogin.mockImplementation(() => {
        throw authError;
      });
      
      try {
        await client.finishLogin(
          'password123',
          'mock-state',
          { credentialResponse: 'mock-response' }
        );
        fail('Expected AuthenticationError to be thrown');
      } catch (error) {
        expect(error).toBe(authError);
      }
    });
  });

  describe('Cross-Platform Behavior', () => {
    it('should handle iOS initialization', async () => {
      (Platform as any).OS = 'ios';
      
      await client.initialize();
      expect(client.getInitializationStatus()).toBe(true);
    });

    it('should handle Android initialization', async () => {
      (Platform as any).OS = 'android';
      
      await client.initialize();
      expect(client.getInitializationStatus()).toBe(true);
    });

    it('should handle Web initialization with WASM', async () => {
      (Platform as any).OS = 'web';
      let resolveReady: () => void;
      mockOpaque.ready = new Promise(resolve => {
        resolveReady = resolve;
      });
      
      const initPromise = client.initialize();
      
      // Simulate WASM loading
      setTimeout(() => resolveReady(), 100);
      
      await expect(initPromise).resolves.not.toThrow();
      expect(client.getInitializationStatus()).toBe(true);
    });
  });

  describe('Security and Performance', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should complete registration within reasonable time', async () => {
      const mockResult = {
        clientRegistrationState: 'mock-state',
        registrationRequest: 'mock-request',
      };
      
      mockOpaque.client.startRegistration.mockReturnValue(mockResult);
      
      const startTime = Date.now();
      await client.startRegistration('password123');
      const endTime = Date.now();
      
      // Should complete within 1 second
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should complete authentication within reasonable time', async () => {
      const mockResult = {
        clientLoginState: 'mock-state',
        credentialRequest: 'mock-request',
      };
      
      mockOpaque.client.startLogin.mockReturnValue(mockResult);
      
      const startTime = Date.now();
      await client.startLogin('password123');
      const endTime = Date.now();
      
      // Should complete within 500ms as per requirements
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should handle concurrent operations safely', async () => {
      const mockResult = {
        clientRegistrationState: 'mock-state',
        registrationRequest: 'mock-request',
      };
      
      mockOpaque.client.startRegistration.mockReturnValue(mockResult);
      
      // Run multiple operations concurrently
      const promises = Array.from({ length: 5 }, () =>
        client.startRegistration('password123')
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.registrationRequest).toBe('mock-request');
        expect(result.clientState).toBe('mock-state');
      });
    });
  });
}); 