/**
 * OPAQUE Authentication Service
 * 
 * This service handles OPAQUE-based authentication providing zero-knowledge password proof.
 * It works in conjunction with the backend's OPAQUE server implementation.
 */

import * as opaque from '@serenity-kit/opaque';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import logger from '../utils/logger';

// Initialize OPAQUE library
let opaqueReady = false;

async function ensureOpaqueReady() {
  if (!opaqueReady) {
    if (opaque.ready) {
      await opaque.ready;
    }
    opaqueReady = true;
    logger.info('OPAQUE library initialized');
  }
}

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
  sessionKey: string;
  exportKey: string;
  finishLoginRequest: string;
}

export interface OpaqueLoginResult {
  success: boolean;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    is_superuser: boolean;
    created_at: string | null;
    updated_at: string | null;
  };
  token: string;
  sessionKey: string;
  exportKey: string;
}

// Storage keys for OPAQUE data
const STORAGE_KEYS = {
  REGISTRATION_RECORD: 'opaque_registration_record',
  USER_IDENTIFIER: 'opaque_user_identifier',
  DEVICE_FINGERPRINT: 'opaque_device_fingerprint',
  SESSION_DATA: 'opaque_session_data',
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
   * @param userIdentifier User identifier (email)
   * @returns Registration request and client state
   */
  public async startRegistration(password: string, userIdentifier: string): Promise<{
    registrationRequest: string;
    clientRegistrationState: string;
  }> {
    try {
      await ensureOpaqueReady();
      logger.info('Starting OPAQUE registration', { userIdentifier });

      // Start registration with OPAQUE client
      const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({
        password,
      });

      if (!clientRegistrationState || !registrationRequest) {
        throw new Error('Failed to generate OPAQUE registration request');
      }

      // Store the client state temporarily for finishing registration
      await AsyncStorage.setItem(
        `opaque_registration_state_${userIdentifier}`, 
        JSON.stringify({
          clientRegistrationState,
          password,
          userIdentifier
        })
      );

      logger.info('OPAQUE registration started successfully', { 
        registrationRequestLength: registrationRequest.length,
        clientRegistrationStateLength: clientRegistrationState.length 
      });

      return {
        registrationRequest,  // Send raw Base64URL to backend
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
   * @returns Registration record
   */
  public async finishRegistration(
    userIdentifier: string,
    registrationResponse: string
  ): Promise<string> {
    try {
      await ensureOpaqueReady();
      logger.info('Finishing OPAQUE registration', { userIdentifier });

      // Retrieve stored registration state
      const storedState = await AsyncStorage.getItem(`opaque_registration_state_${userIdentifier}`);
      if (!storedState) {
        throw new Error('Registration state not found');
      }

      const { clientRegistrationState, password } = JSON.parse(storedState);

      // Add detailed logging for debugging
      logger.info('Retrieved stored registration state', { 
        userIdentifier,
        clientRegistrationStateLength: clientRegistrationState?.length,
        registrationResponseLength: registrationResponse?.length,
        passwordLength: password?.length
      });

      // Complete registration
      const { registrationRecord } = opaque.client.finishRegistration({
        clientRegistrationState,
        registrationResponse,
        password,
      });

      if (!registrationRecord) {
        throw new Error('Failed to finish registration');
      }

      // Clean up stored state
      await AsyncStorage.removeItem(`opaque_registration_state_${userIdentifier}`);

      logger.info('OPAQUE registration finished successfully', { userIdentifier });

      return registrationRecord;  // Return raw Base64URL to backend
    } catch (error) {
      logger.error('Failed to finish OPAQUE registration', { userIdentifier, error });
      throw new Error(`OPAQUE registration finish failed: ${error}`);
    }
  }

  /**
   * Start OPAQUE login process with user credentials
   * @param password User's password
   * @param userIdentifier User identifier (email)
   * @returns Login request and client state
   */
  public async startLogin(password: string, userIdentifier: string): Promise<{
    loginRequest: string;
    clientLoginState: string;
  }> {
    try {
      await ensureOpaqueReady();
      logger.info('Starting OPAQUE login', { userIdentifier });

      // Start login with OPAQUE client
      const result = opaque.client.startLogin({ password });

      if (!result || !result.clientLoginState || !result.startLoginRequest) {
        throw new Error('Failed to generate OPAQUE login request');
      }

      // Store the client state temporarily for finishing login
      await AsyncStorage.setItem(
        `opaque_login_state_${userIdentifier}`, 
        JSON.stringify({
          clientLoginState: result.clientLoginState,
          password,
          userIdentifier
        })
      );

      logger.info('OPAQUE login started successfully', { 
        startLoginRequestLength: result.startLoginRequest.length,
        clientLoginStateLength: result.clientLoginState.length 
      });
      
      return {
        loginRequest: result.startLoginRequest,  // Send raw Base64URL to backend
        clientLoginState: result.clientLoginState
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
      await ensureOpaqueReady();
      logger.info('Finishing OPAQUE login', { userIdentifier });

      // Retrieve stored login state
      const storedState = await AsyncStorage.getItem(`opaque_login_state_${userIdentifier}`);
      if (!storedState) {
        throw new Error('Login state not found');
      }

      const { clientLoginState, password } = JSON.parse(storedState);

      // Add detailed logging for debugging
      logger.info('Retrieved stored login state', { 
        userIdentifier,
        clientLoginStateLength: clientLoginState?.length,
        loginResponseLength: loginResponse?.length,
        passwordLength: password?.length
      });

      // Complete login
      const loginResult = opaque.client.finishLogin({
        clientLoginState,
        loginResponse,
        password,
      });

      logger.info('OPAQUE finishLogin result', { 
        userIdentifier,
        success: loginResult !== null,
        resultType: typeof loginResult,
        resultKeys: loginResult ? Object.keys(loginResult) : null
      });

      if (!loginResult) {
        throw new Error('Failed to finish login');
      }

      const { finishLoginRequest, sessionKey, exportKey } = loginResult;

      // Clean up stored state
      await AsyncStorage.removeItem(`opaque_login_state_${userIdentifier}`);

      logger.info('OPAQUE login finished successfully', { userIdentifier });

      return { 
        sessionKey, 
        exportKey, 
        finishLoginRequest
      };
    } catch (error) {
      logger.error('Failed to finish OPAQUE login', { userIdentifier, error });
      throw new Error(`OPAQUE login finish failed: ${error}`);
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
      const response = await api.post('/api/v1/auth/register/start', {
        userIdentifier: email,
        opaque_registration_request: registrationRequest,
        name
      });

      const { opaque_registration_response: registrationResponse } = response.data;

      // Step 3: Finish registration
      const registrationRecord = await this.finishRegistration(email, registrationResponse);

      // Step 4: Send registration record to server
      await api.post('/api/v1/auth/register/finish', {
        session_id: response.data.session_id,
        userIdentifier: email,
        opaque_registration_record: registrationRecord
      });

      logger.info('Registration record sent to server', { 
        email, 
        registrationRecordLength: registrationRecord.length,
        registrationRecordSample: registrationRecord.substring(0, 50) + '...'
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
   * @returns Complete login result with JWT token and session keys
   */
  public async login(email: string, password: string): Promise<OpaqueLoginResult> {
    try {
      logger.info('Starting OPAQUE login', { email });

      // Start login process
      const startResult = await this.startLogin(password, email);
      const loginResponse = await api.post('/api/v1/auth/login/start', {
        userIdentifier: email,
        client_credential_request: startResult.loginRequest,
      });

      if (!loginResponse.data?.server_credential_response) {
        throw new Error('Invalid login response from server');
      }

      // Finish login process
      const sessionResult = await this.finishLogin(email, loginResponse.data.server_credential_response);
      
      // Send finish login request to server
      const finishResponse = await api.post('/api/v1/auth/login/finish', {
        session_id: loginResponse.data.session_id,
        userIdentifier: email,
        client_credential_finalization: sessionResult.finishLoginRequest,
      });

      if (!finishResponse.data?.access_token) {
        throw new Error('Invalid finish login response from server');
      }

      logger.info('OPAQUE login completed successfully', { email });

      return {
        success: true,
        user: finishResponse.data.user,
        token: finishResponse.data.access_token,
        sessionKey: sessionResult.sessionKey,
        exportKey: sessionResult.exportKey,
      };
    } catch (error) {
      logger.error('OPAQUE login failed', { email, error });
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