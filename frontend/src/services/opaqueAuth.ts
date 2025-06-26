import * as opaque from '@serenity-kit/opaque';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import logger from '../utils/logger';

// OPAQUE client types and interfaces
export interface OpaqueRegistrationState {
  clientRegistrationState: string;
  password: string;
}

export interface OpaqueLoginState {
  clientLoginState: string;
  password: string;
}

export interface OpaqueRegistrationResponse {
  registrationResponse: string;
  userIdentifier: string;
}

export interface OpaqueLoginResponse {
  loginResponse: string;
}

export interface OpaqueSessionResult {
  sessionKey: Uint8Array;
  exportKey: Uint8Array;
}

// Storage keys for OPAQUE data
const STORAGE_KEYS = {
  REGISTRATION_RECORD: 'opaque_registration_record',
  USER_IDENTIFIER: 'opaque_user_identifier',
} as const;

/**
 * OPAQUE Authentication Service
 * Provides client-side OPAQUE protocol implementation for zero-knowledge authentication
 */
export class OpaqueAuthService {
  private static instance: OpaqueAuthService;

  private constructor() {}

  public static getInstance(): OpaqueAuthService {
    if (!OpaqueAuthService.instance) {
      OpaqueAuthService.instance = new OpaqueAuthService();
    }
    return OpaqueAuthService.instance;
  }

  /**
   * Start OPAQUE registration process
   * @param password User's password
   * @param userIdentifier Unique user identifier (email)
   * @returns Registration request to send to server
   */
  public async startRegistration(password: string, userIdentifier: string): Promise<{
    registrationRequest: string;
    clientRegistrationState: string;
  }> {
    try {
      logger.info('Starting OPAQUE registration', { userIdentifier });
      
      const { clientRegistrationState, registrationRequest } = 
        opaque.client.startRegistration({ password });

      // Store the client state temporarily for finishing registration
      await AsyncStorage.setItem(
        `opaque_reg_state_${userIdentifier}`, 
        JSON.stringify({
          clientRegistrationState,
          password,
          userIdentifier
        })
      );

      logger.info('OPAQUE registration started successfully');
      return {
        registrationRequest,
        clientRegistrationState
      };
    } catch (error) {
      logger.error('OPAQUE registration start failed', error);
      throw new Error('Failed to start OPAQUE registration');
    }
  }

  /**
   * Complete OPAQUE registration process
   * @param userIdentifier User identifier
   * @param registrationResponse Server's registration response
   * @returns Registration record for storage
   */
  public async finishRegistration(
    userIdentifier: string,
    registrationResponse: string
  ): Promise<string> {
    try {
      logger.info('Finishing OPAQUE registration', { userIdentifier });

      // Retrieve stored registration state
      const storedState = await AsyncStorage.getItem(`opaque_reg_state_${userIdentifier}`);
      if (!storedState) {
        throw new Error('Registration state not found');
      }

      const { clientRegistrationState, password } = JSON.parse(storedState);

      // Complete registration
      const { registrationRecord } = opaque.client.finishRegistration({
        clientRegistrationState,
        registrationResponse,
        password
      });

      // Store registration record and user identifier
      await AsyncStorage.setItem(STORAGE_KEYS.REGISTRATION_RECORD, registrationRecord);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_IDENTIFIER, userIdentifier);

      // Clean up temporary state
      await AsyncStorage.removeItem(`opaque_reg_state_${userIdentifier}`);

      logger.info('OPAQUE registration completed successfully');
      return registrationRecord;
    } catch (error) {
      logger.error('OPAQUE registration finish failed', error);
      throw new Error('Failed to complete OPAQUE registration');
    }
  }

  /**
   * Start OPAQUE login process
   * @param password User's password
   * @param userIdentifier User identifier (email)
   * @returns Login request to send to server
   */
  public async startLogin(password: string, userIdentifier: string): Promise<{
    loginRequest: string;
    clientLoginState: string;
  }> {
    try {
      logger.info('Starting OPAQUE login', { userIdentifier });

      const { clientLoginState, loginRequest } = 
        opaque.client.startLogin({ password });

      // Store the client state temporarily for finishing login
      await AsyncStorage.setItem(
        `opaque_login_state_${userIdentifier}`, 
        JSON.stringify({
          clientLoginState,
          password,
          userIdentifier
        })
      );

      logger.info('OPAQUE login started successfully');
      return {
        loginRequest,
        clientLoginState
      };
    } catch (error) {
      logger.error('OPAQUE login start failed', error);
      throw new Error('Failed to start OPAQUE login');
    }
  }

  /**
   * Complete OPAQUE login process and derive session keys
   * @param userIdentifier User identifier
   * @param loginResponse Server's login response
   * @returns Session and export keys
   */
  public async finishLogin(
    userIdentifier: string,
    loginResponse: string
  ): Promise<OpaqueSessionResult> {
    try {
      logger.info('Finishing OPAQUE login', { userIdentifier });

      // Retrieve stored login state
      const storedState = await AsyncStorage.getItem(`opaque_login_state_${userIdentifier}`);
      if (!storedState) {
        throw new Error('Login state not found');
      }

      const { clientLoginState, password } = JSON.parse(storedState);

      // Complete login
      const loginResult = opaque.client.finishLogin({
        clientLoginState,
        loginResponse,
        password
      });

      if (!loginResult) {
        throw new Error('OPAQUE login failed - invalid credentials');
      }

      const { sessionKey, exportKey } = loginResult;

      // Clean up temporary state
      await AsyncStorage.removeItem(`opaque_login_state_${userIdentifier}`);

      logger.info('OPAQUE login completed successfully');
      return { sessionKey, exportKey };
    } catch (error) {
      logger.error('OPAQUE login finish failed', error);
      throw new Error('Failed to complete OPAQUE login');
    }
  }

  /**
   * Register user with OPAQUE protocol
   * @param name User's display name
   * @param email User's email address
   * @param password User's password
   */
  public async register(name: string, email: string, password: string): Promise<void> {
    try {
      logger.info('Starting OPAQUE registration flow', { email });

      // Step 1: Start registration
      const { registrationRequest } = await this.startRegistration(password, email);

      // Step 2: Send registration request to server
      const response = await api.post('/api/auth/opaque/register/start', {
        userIdentifier: email,
        registrationRequest,
        name
      });

      const { registrationResponse } = response.data;

      // Step 3: Finish registration
      const registrationRecord = await this.finishRegistration(email, registrationResponse);

      // Step 4: Send registration record to server
      await api.post('/api/auth/opaque/register/finish', {
        userIdentifier: email,
        registrationRecord
      });

      logger.info('OPAQUE registration flow completed successfully');
    } catch (error) {
      logger.error('OPAQUE registration flow failed', error);
      throw error;
    }
  }

  /**
   * Login user with OPAQUE protocol
   * @param email User's email address
   * @param password User's password
   * @returns Session and export keys for key derivation
   */
  public async login(email: string, password: string): Promise<OpaqueSessionResult> {
    try {
      logger.info('Starting OPAQUE login flow', { email });

      // Step 1: Start login
      const { loginRequest } = await this.startLogin(password, email);

      // Step 2: Send login request to server
      const response = await api.post('/api/auth/opaque/login/start', {
        userIdentifier: email,
        loginRequest
      });

      const { loginResponse } = response.data;

      // Step 3: Finish login and get session keys
      const sessionResult = await this.finishLogin(email, loginResponse);

      logger.info('OPAQUE login flow completed successfully');
      return sessionResult;
    } catch (error) {
      logger.error('OPAQUE login flow failed', error);
      throw error;
    }
  }

  /**
   * Check if user has OPAQUE registration record stored locally
   * @returns True if registration record exists
   */
  public async hasRegistrationRecord(): Promise<boolean> {
    try {
      const record = await AsyncStorage.getItem(STORAGE_KEYS.REGISTRATION_RECORD);
      return record !== null;
    } catch (error) {
      logger.error('Failed to check registration record', error);
      return false;
    }
  }

  /**
   * Get stored user identifier
   * @returns User identifier or null if not found
   */
  public async getUserIdentifier(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_IDENTIFIER);
    } catch (error) {
      logger.error('Failed to get user identifier', error);
      return null;
    }
  }

  /**
   * Clear all OPAQUE data from storage
   */
  public async clearOpaqueData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.REGISTRATION_RECORD,
        STORAGE_KEYS.USER_IDENTIFIER
      ]);

      // Also clear any temporary states
      const keys = await AsyncStorage.getAllKeys();
      const tempKeys = keys.filter(key => 
        key.startsWith('opaque_reg_state_') || 
        key.startsWith('opaque_login_state_')
      );
      
      if (tempKeys.length > 0) {
        await AsyncStorage.multiRemove(tempKeys);
      }

      logger.info('OPAQUE data cleared successfully');
    } catch (error) {
      logger.error('Failed to clear OPAQUE data', error);
    }
  }
}

// Export singleton instance
export const opaqueAuth = OpaqueAuthService.getInstance(); 