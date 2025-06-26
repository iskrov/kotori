/**
 * End-to-End OPAQUE Authentication Tests
 * 
 * These tests validate the complete OPAQUE authentication flow
 * across different platforms and environments.
 */

import { OpaqueAuthService } from '../opaqueAuth';
import { OpaqueKeyManager } from '../opaqueKeyManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage for testing
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Test constants
const TEST_BASE_URL = 'http://localhost:8000';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'test_password_123';

describe('OPAQUE Authentication E2E Tests', () => {
  let authService: OpaqueAuthService;
  let keyManager: OpaqueKeyManager;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new OpaqueAuthService(TEST_BASE_URL);
    keyManager = new OpaqueKeyManager();
    
    // Mock successful AsyncStorage operations
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Server Capability Detection', () => {
    it('should detect OPAQUE server support', async () => {
      // Mock server status response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          opaque_enabled: true,
          supported_features: {
            registration: true,
            login: true,
            key_derivation: true,
            session_management: true
          }
        })
      } as Response);

      const hasSupport = await authService.hasOpaqueSupport();
      
      expect(hasSupport).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/api/auth/opaque/status`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should handle server without OPAQUE support', async () => {
      // Mock server response without OPAQUE
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          opaque_enabled: false
        })
      } as Response);

      const hasSupport = await authService.hasOpaqueSupport();
      
      expect(hasSupport).toBe(false);
    });

    it('should handle server connection errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const hasSupport = await authService.hasOpaqueSupport();
      
      expect(hasSupport).toBe(false);
    });
  });

  describe('Complete Registration Flow', () => {
    it('should complete full registration flow', async () => {
      // Mock registration start response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          evaluated_element: 'bW9ja19ldmFsdWF0ZWRfZWxlbWVudA==', // base64 mock data
          server_public_key: 'bW9ja19zZXJ2ZXJfcHVibGljX2tleQ==',
          salt: 'bW9ja19zYWx0'
        })
      } as Response);

      // Mock registration finish response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'OPAQUE registration completed successfully'
        })
      } as Response);

      const result = await authService.register(TEST_USER_EMAIL, TEST_PASSWORD);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('registration completed successfully');
      
      // Verify API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Verify registration start call
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        `${TEST_BASE_URL}/api/auth/opaque/register/start`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining(TEST_USER_EMAIL)
        })
      );

      // Verify registration finish call
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        `${TEST_BASE_URL}/api/auth/opaque/register/finish`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should handle registration errors', async () => {
      // Mock registration start error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          detail: 'User already registered'
        })
      } as Response);

      const result = await authService.register(TEST_USER_EMAIL, TEST_PASSWORD);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('User already registered');
    });
  });

  describe('Complete Login Flow', () => {
    it('should complete full login flow', async () => {
      // Mock login start response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          evaluated_element: 'bW9ja19ldmFsdWF0ZWRfZWxlbWVudA==',
          server_public_key: 'bW9ja19zZXJ2ZXJfcHVibGljX2tleQ==',
          salt: 'bW9ja19zYWx0'
        })
      } as Response);

      // Mock login finish response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          access_token: 'mock_jwt_token',
          token_type: 'bearer',
          message: 'OPAQUE login completed successfully'
        })
      } as Response);

      const result = await authService.login(TEST_USER_EMAIL, TEST_PASSWORD);
      
      expect(result.success).toBe(true);
      expect(result.token).toBe('mock_jwt_token');
      expect(result.message).toContain('login completed successfully');
      
      // Verify API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle login with non-existent user', async () => {
      // Mock login start response for non-existent user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          evaluated_element: '',
          server_public_key: '',
          salt: ''
        })
      } as Response);

      const result = await authService.login('nonexistent@example.com', TEST_PASSWORD);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid credentials');
    });

    it('should handle network errors during login', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.login(TEST_USER_EMAIL, TEST_PASSWORD);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('Key Derivation Cross-Platform Consistency', () => {
    it('should derive consistent keys across calls', async () => {
      const exportKey = new Uint8Array(32);
      crypto.getRandomValues(exportKey);

      const userId = TEST_USER_EMAIL;
      const keyType = 'tagid';

      // Derive key multiple times
      const key1 = await keyManager.deriveKey(exportKey, userId, keyType);
      const key2 = await keyManager.deriveKey(exportKey, userId, keyType);
      const key3 = await keyManager.deriveKey(exportKey, userId, keyType);

      // All keys should be identical
      expect(key1).toEqual(key2);
      expect(key2).toEqual(key3);
      expect(key1.length).toBe(32); // 256 bits
    });

    it('should derive different keys for different types', async () => {
      const exportKey = new Uint8Array(32);
      crypto.getRandomValues(exportKey);

      const userId = TEST_USER_EMAIL;

      const tagIdKey = await keyManager.deriveKey(exportKey, userId, 'tagid');
      const encryptionKey = await keyManager.deriveKey(exportKey, userId, 'encryption');
      const vaultKey = await keyManager.deriveKey(exportKey, userId, 'vault');

      // All keys should be different
      expect(tagIdKey).not.toEqual(encryptionKey);
      expect(encryptionKey).not.toEqual(vaultKey);
      expect(vaultKey).not.toEqual(tagIdKey);

      // All keys should be 32 bytes
      expect(tagIdKey.length).toBe(32);
      expect(encryptionKey.length).toBe(32);
      expect(vaultKey.length).toBe(32);
    });

    it('should derive different keys for different users', async () => {
      const exportKey = new Uint8Array(32);
      crypto.getRandomValues(exportKey);

      const keyType = 'tagid';

      const user1Key = await keyManager.deriveKey(exportKey, 'user1@example.com', keyType);
      const user2Key = await keyManager.deriveKey(exportKey, 'user2@example.com', keyType);

      // Keys should be different for different users
      expect(user1Key).not.toEqual(user2Key);
    });
  });

  describe('State Management and Cleanup', () => {
    it('should clean up registration state on completion', async () => {
      // Mock successful registration
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            evaluated_element: 'bW9ja19ldmFsdWF0ZWRfZWxlbWVudA==',
            server_public_key: 'bW9ja19zZXJ2ZXJfcHVibGljX2tleQ==',
            salt: 'bW9ja19zYWx0'
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'OPAQUE registration completed successfully'
          })
        } as Response);

      await authService.register(TEST_USER_EMAIL, TEST_PASSWORD);

      // Verify cleanup was called
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('opaque_registration_state');
    });

    it('should clean up login state on completion', async () => {
      // Mock successful login
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            evaluated_element: 'bW9ja19ldmFsdWF0ZWRfZWxlbWVudA==',
            server_public_key: 'bW9ja19zZXJ2ZXJfcHVibGljX2tleQ==',
            salt: 'bW9ja19zYWx0'
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            access_token: 'mock_jwt_token',
            token_type: 'bearer',
            message: 'OPAQUE login completed successfully'
          })
        } as Response);

      await authService.login(TEST_USER_EMAIL, TEST_PASSWORD);

      // Verify cleanup was called
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('opaque_login_state');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      // Mock AsyncStorage error
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      // Mock successful server response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          evaluated_element: 'bW9ja19ldmFsdWF0ZWRfZWxlbWVudA==',
          server_public_key: 'bW9ja19zZXJ2ZXJfcHVibGljX2tleQ==',
          salt: 'bW9ja19zYWx0'
        })
      } as Response);

      // Should still attempt registration despite storage error
      const result = await authService.startRegistration(TEST_USER_EMAIL, TEST_PASSWORD);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to store registration state');
    });
  });

  describe('Security Properties', () => {
    it('should not expose passwords in any form', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock server responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            evaluated_element: 'bW9ja19ldmFsdWF0ZWRfZWxlbWVudA==',
            server_public_key: 'bW9ja19zZXJ2ZXJfcHVibGljX2tleQ==',
            salt: 'bW9ja19zYWx0'
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'OPAQUE registration completed successfully'
          })
        } as Response);

      await authService.register(TEST_USER_EMAIL, TEST_PASSWORD);

      // Check that password never appears in logs
      const allLogs = [
        ...consoleSpy.mock.calls.flat(),
        ...consoleErrorSpy.mock.calls.flat()
      ].join(' ');

      expect(allLogs).not.toContain(TEST_PASSWORD);

      // Check that password never appears in network requests
      const networkCalls = mockFetch.mock.calls;
      for (const call of networkCalls) {
        const requestBody = call[1]?.body as string;
        if (requestBody) {
          expect(requestBody).not.toContain(TEST_PASSWORD);
        }
      }

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should generate cryptographically secure random data', async () => {
      // Test that random data generation produces different results
      const data1 = crypto.getRandomValues(new Uint8Array(32));
      const data2 = crypto.getRandomValues(new Uint8Array(32));
      const data3 = crypto.getRandomValues(new Uint8Array(32));

      // Should be extremely unlikely to get identical random data
      expect(data1).not.toEqual(data2);
      expect(data2).not.toEqual(data3);
      expect(data1).not.toEqual(data3);

      // Should have proper entropy (no all-zero arrays)
      expect(data1.some(byte => byte !== 0)).toBe(true);
      expect(data2.some(byte => byte !== 0)).toBe(true);
      expect(data3.some(byte => byte !== 0)).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed server responses', async () => {
      // Mock malformed JSON response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      } as Response);

      const result = await authService.register(TEST_USER_EMAIL, TEST_PASSWORD);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid server response');
    });

    it('should handle HTTP error codes properly', async () => {
      // Mock HTTP 500 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          detail: 'Internal server error'
        })
      } as Response);

      const result = await authService.register(TEST_USER_EMAIL, TEST_PASSWORD);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Server error');
    });

    it('should timeout on slow network requests', async () => {
      // Mock slow response (this test would need actual timeout implementation)
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const result = await authService.register(TEST_USER_EMAIL, TEST_PASSWORD);
      
      // Should fail due to timeout (if timeout is implemented)
      expect(result.success).toBe(false);
    }, 1000); // 1 second timeout for test
  });
}); 