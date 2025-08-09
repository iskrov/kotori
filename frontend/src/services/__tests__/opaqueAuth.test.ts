import { opaqueAuth, OpaqueAuthService } from '../opaqueAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

// Mock dependencies (do not mock @serenity-kit/opaque; tests should exercise real client API shape)
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../api');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockApi = api as jest.Mocked<typeof api>;

describe('OpaqueAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = OpaqueAuthService.getInstance();
      const instance2 = OpaqueAuthService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('startRegistration', () => {
    it('should start OPAQUE registration and store state', async () => {
      const mockOpaque = require('@serenity-kit/opaque');
      jest.spyOn(mockOpaque.client, 'startRegistration').mockReturnValue({
        clientRegistrationState: 'mock-state',
        registrationRequest: 'mock-request',
      });

      const result = await opaqueAuth.startRegistration('password123', 'test@example.com');

      expect(mockOpaque.client.startRegistration).toHaveBeenCalledWith({
        password: 'password123',
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'opaque_reg_state_test@example.com',
        JSON.stringify({
          clientRegistrationState: 'mock-state',
          password: 'password123',
          userIdentifier: 'test@example.com',
        })
      );

      expect(result).toEqual({
        registrationRequest: 'mock-request',
        clientRegistrationState: 'mock-state',
      });
    });

    it('should handle registration start errors', async () => {
      const mockOpaque = require('@serenity-kit/opaque');
      jest.spyOn(mockOpaque.client, 'startRegistration').mockImplementation(() => {
        throw new Error('OPAQUE error');
      });

      await expect(
        opaqueAuth.startRegistration('password123', 'test@example.com')
      ).rejects.toThrow('Failed to start OPAQUE registration');
    });
  });

  describe('finishRegistration', () => {
    it('should complete OPAQUE registration and store record', async () => {
      const mockOpaque = require('@serenity-kit/opaque');
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          clientRegistrationState: 'mock-state',
          password: 'password123',
          userIdentifier: 'test@example.com',
        })
      );
      jest.spyOn(mockOpaque.client, 'finishRegistration').mockReturnValue({
        registrationRecord: 'mock-record',
      });

      const result = await opaqueAuth.finishRegistration(
        'test@example.com',
        'mock-response'
      );

      expect(mockOpaque.client.finishRegistration).toHaveBeenCalledWith({
        clientRegistrationState: 'mock-state',
        registrationResponse: 'mock-response',
        password: 'password123',
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'opaque_registration_record',
        'mock-record'
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'opaque_user_identifier',
        'test@example.com'
      );

      expect(result).toBe('mock-record');
    });

    it('should handle missing registration state', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(
        opaqueAuth.finishRegistration('test@example.com', 'mock-response')
      ).rejects.toThrow('Failed to complete OPAQUE registration');
    });
  });

  describe('startLogin', () => {
    it('should start OPAQUE login and store state', async () => {
      const mockOpaque = require('@serenity-kit/opaque');
      jest.spyOn(mockOpaque.client, 'startLogin').mockReturnValue({
        clientLoginState: 'mock-login-state',
        loginRequest: 'mock-login-request',
      });

      const result = await opaqueAuth.startLogin('password123', 'test@example.com');

      expect(mockOpaque.client.startLogin).toHaveBeenCalledWith({
        password: 'password123',
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'opaque_login_state_test@example.com',
        JSON.stringify({
          clientLoginState: 'mock-login-state',
          password: 'password123',
          userIdentifier: 'test@example.com',
        })
      );

      expect(result).toEqual({
        loginRequest: 'mock-login-request',
        clientLoginState: 'mock-login-state',
      });
    });
  });

  describe('finishLogin', () => {
    it('should complete OPAQUE login and return session keys', async () => {
      const mockOpaque = require('@serenity-kit/opaque');
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          clientLoginState: 'mock-login-state',
          password: 'password123',
          userIdentifier: 'test@example.com',
        })
      );

      const mockSessionKey = new Uint8Array([1, 2, 3, 4]);
      const mockExportKey = new Uint8Array([5, 6, 7, 8]);
      
      jest.spyOn(mockOpaque.client, 'finishLogin').mockReturnValue({
        sessionKey: mockSessionKey,
        exportKey: mockExportKey,
      });

      const result = await opaqueAuth.finishLogin('test@example.com', 'mock-response');

      expect(mockOpaque.client.finishLogin).toHaveBeenCalledWith({
        clientLoginState: 'mock-login-state',
        loginResponse: 'mock-response',
        password: 'password123',
      });

      expect(result).toEqual({
        sessionKey: mockSessionKey,
        exportKey: mockExportKey,
      });
    });

    it('should handle failed login', async () => {
      const mockOpaque = require('@serenity-kit/opaque');
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          clientLoginState: 'mock-login-state',
          password: 'password123',
          userIdentifier: 'test@example.com',
        })
      );
      jest.spyOn(mockOpaque.client, 'finishLogin').mockReturnValue(null);

      await expect(
        opaqueAuth.finishLogin('test@example.com', 'mock-response')
      ).rejects.toThrow('Failed to complete OPAQUE login');
    });
  });

  describe('register', () => {
    it('should complete full OPAQUE registration flow', async () => {
      const mockOpaque = require('@serenity-kit/opaque');
      
      // Mock registration start
      mockOpaque.client.startRegistration.mockReturnValue({
        clientRegistrationState: 'mock-state',
        registrationRequest: 'mock-request',
      });

      // Mock server responses
      mockApi.post
        .mockResolvedValueOnce({
          data: { registrationResponse: 'mock-response' },
        })
        .mockResolvedValueOnce({
          data: { success: true },
        });

      // Mock registration finish
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          clientRegistrationState: 'mock-state',
          password: 'password123',
          userIdentifier: 'test@example.com',
        })
      );
      mockOpaque.client.finishRegistration.mockReturnValue({
        registrationRecord: 'mock-record',
      });

      await opaqueAuth.register('Test User', 'test@example.com', 'password123');

      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/auth/register/start', {
        userIdentifier: 'test@example.com',
        opaque_registration_request: 'mock-request',
        name: 'Test User',
      });

      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/auth/register/finish', {
        userIdentifier: 'test@example.com',
        opaque_registration_record: 'mock-record',
      });
    });
  });

  describe('clearOpaqueData', () => {
    it('should clear all OPAQUE data from storage', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([
        'opaque_registration_record',
        'opaque_user_identifier',
        'opaque_reg_state_test@example.com',
        'opaque_login_state_test@example.com',
        'other_key',
      ]);

      await opaqueAuth.clearOpaqueData();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        'opaque_registration_record',
        'opaque_user_identifier',
      ]);

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        'opaque_reg_state_test@example.com',
        'opaque_login_state_test@example.com',
      ]);
    });
  });
}); 