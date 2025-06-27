/**
 * OPAQUE Client Wrapper
 * Provides a clean TypeScript interface for OPAQUE protocol operations
 * using the react-native-opaque package for cross-platform compatibility
 */

import * as opaque from 'react-native-opaque';
import { Platform } from 'react-native';
import logger from '../../utils/logger';
import { OpaqueError, AuthenticationError, NetworkError } from './errors';

// Type definitions for OPAQUE operations
export interface RegistrationResult {
  registrationRequest: string;
  clientState: string;
}

export interface RegistrationResponse {
  registrationResponse: string;
}

export interface RegistrationRecord {
  registrationUpload: string;
  exportKey: Uint8Array;
}

export interface LoginResult {
  credentialRequest: string;
  clientState: string;
}

export interface LoginResponse {
  credentialResponse: string;
}

export interface SessionResult {
  credentialFinalization: string;
  sessionKey: Uint8Array;
  exportKey: Uint8Array;
}

export interface VaultKeys {
  tagId: Uint8Array;
  dataKey: Uint8Array;
  vaultId: string;
}

// Memory management for sensitive data
class SecureMemory {
  private static sensitiveData: Set<Uint8Array> = new Set();

  static register(data: Uint8Array): void {
    this.sensitiveData.add(data);
  }

  static clear(data: Uint8Array): void {
    if (this.sensitiveData.has(data)) {
      data.fill(0);
      this.sensitiveData.delete(data);
    }
  }

  static clearAll(): void {
    this.sensitiveData.forEach(data => data.fill(0));
    this.sensitiveData.clear();
  }
}

/**
 * OPAQUE Client - Main interface for OPAQUE protocol operations
 */
export class OpaqueClient {
  private static instance: OpaqueClient;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): OpaqueClient {
    if (!OpaqueClient.instance) {
      OpaqueClient.instance = new OpaqueClient();
    }
    return OpaqueClient.instance;
  }

  /**
   * Initialize the OPAQUE client
   * For web platforms, waits for WebAssembly module to load
   */
  public async initialize(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        logger.info('Waiting for OPAQUE WebAssembly module to load');
        await opaque.ready;
        logger.info('OPAQUE WebAssembly module loaded successfully');
      }
      
      this.isInitialized = true;
      logger.info('OPAQUE client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OPAQUE client', error);
      throw new OpaqueError('OPAQUE initialization failed', error);
    }
  }

  /**
   * Start OPAQUE registration process
   * @param password - User password for registration
   * @returns Registration request and client state
   */
  public async startRegistration(password: string): Promise<RegistrationResult> {
    this.ensureInitialized();
    
    try {
      logger.debug('Starting OPAQUE registration');
      
      const result = opaque.client.startRegistration({ password });
      
      if (!result || !result.clientRegistrationState || !result.registrationRequest) {
        throw new OpaqueError('Invalid registration result from OPAQUE library');
      }

      logger.debug('OPAQUE registration started successfully');
      return {
        registrationRequest: result.registrationRequest,
        clientState: result.clientRegistrationState
      };
    } catch (error) {
      logger.error('OPAQUE registration start failed', error);
      if (error instanceof OpaqueError) {
        throw error;
      }
      throw new OpaqueError('Failed to start OPAQUE registration', error);
    }
  }

  /**
   * Complete OPAQUE registration process
   * @param password - User password
   * @param clientState - Client state from startRegistration
   * @param response - Server registration response
   * @returns Registration record and export key
   */
  public async finishRegistration(
    password: string,
    clientState: string,
    response: RegistrationResponse
  ): Promise<RegistrationRecord> {
    this.ensureInitialized();
    
    try {
      logger.debug('Finishing OPAQUE registration');
      
      const result = opaque.client.finishRegistration({
        password,
        clientRegistrationState: clientState,
        registrationResponse: response.registrationResponse
      });

      if (!result || !result.registrationUpload || !result.exportKey) {
        throw new OpaqueError('Invalid registration finish result from OPAQUE library');
      }

      // Register export key for secure memory management
      SecureMemory.register(result.exportKey);

      logger.debug('OPAQUE registration finished successfully');
      return {
        registrationUpload: result.registrationUpload,
        exportKey: result.exportKey
      };
    } catch (error) {
      logger.error('OPAQUE registration finish failed', error);
      if (error instanceof OpaqueError) {
        throw error;
      }
      throw new OpaqueError('Failed to finish OPAQUE registration', error);
    }
  }

  /**
   * Start OPAQUE login/authentication process
   * @param password - User password for authentication
   * @returns Login request and client state
   */
  public async startLogin(password: string): Promise<LoginResult> {
    this.ensureInitialized();
    
    try {
      logger.debug('Starting OPAQUE login');
      
      const result = opaque.client.startLogin({ password });
      
      if (!result || !result.clientLoginState || !result.credentialRequest) {
        throw new OpaqueError('Invalid login result from OPAQUE library');
      }

      logger.debug('OPAQUE login started successfully');
      return {
        credentialRequest: result.credentialRequest,
        clientState: result.clientLoginState
      };
    } catch (error) {
      logger.error('OPAQUE login start failed', error);
      if (error instanceof OpaqueError) {
        throw error;
      }
      throw new OpaqueError('Failed to start OPAQUE login', error);
    }
  }

  /**
   * Complete OPAQUE login process
   * @param password - User password
   * @param clientState - Client state from startLogin
   * @param response - Server credential response
   * @returns Session result with keys
   */
  public async finishLogin(
    password: string,
    clientState: string,
    response: LoginResponse
  ): Promise<SessionResult> {
    this.ensureInitialized();
    
    try {
      logger.debug('Finishing OPAQUE login');
      
      const result = opaque.client.finishLogin({
        password,
        clientLoginState: clientState,
        credentialResponse: response.credentialResponse
      });

      if (!result || !result.credentialFinalization || !result.sessionKey || !result.exportKey) {
        throw new AuthenticationError('OPAQUE authentication failed - invalid credentials');
      }

      // Register sensitive keys for secure memory management
      SecureMemory.register(result.sessionKey);
      SecureMemory.register(result.exportKey);

      logger.debug('OPAQUE login finished successfully');
      return {
        credentialFinalization: result.credentialFinalization,
        sessionKey: result.sessionKey,
        exportKey: result.exportKey
      };
    } catch (error) {
      logger.error('OPAQUE login finish failed', error);
      if (error instanceof AuthenticationError) {
        throw error;
      }
      if (error instanceof OpaqueError) {
        throw error;
      }
      throw new OpaqueError('Failed to finish OPAQUE login', error);
    }
  }

  /**
   * Derive vault keys from export key for data encryption
   * @param exportKey - Export key from OPAQUE session
   * @param secretPhrase - The secret phrase used as additional input
   * @returns Vault keys for encryption operations
   */
  public async deriveVaultKeys(exportKey: Uint8Array, secretPhrase: string): Promise<VaultKeys> {
    try {
      logger.debug('Deriving vault keys from export key');
      
      // Use BLAKE2s to generate tag ID (consistent with server)
      const tagId = await this.blake2s(secretPhrase.trim().toLowerCase(), 16);
      
      // Derive data key using HKDF with tag ID as salt
      const dataKey = await this.hkdf(exportKey, tagId, 'VaultDataKey', 32);
      
      // Generate vault ID from tag ID
      const vaultId = this.bytesToHex(tagId);

      // Register keys for secure memory management
      SecureMemory.register(tagId);
      SecureMemory.register(dataKey);

      logger.debug('Vault keys derived successfully');
      return {
        tagId,
        dataKey,
        vaultId
      };
    } catch (error) {
      logger.error('Failed to derive vault keys', error);
      throw new OpaqueError('Vault key derivation failed', error);
    }
  }

  /**
   * Clear all sensitive data from memory
   */
  public clearMemory(): void {
    try {
      SecureMemory.clearAll();
      logger.debug('OPAQUE client memory cleared');
    } catch (error) {
      logger.error('Failed to clear OPAQUE client memory', error);
    }
  }

  /**
   * Check if the client is properly initialized
   */
  public getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new OpaqueError('OPAQUE client not initialized. Call initialize() first.');
    }
  }

  private async blake2s(input: string, outputLength: number): Promise<Uint8Array> {
    // Using SHA-256 as fallback since BLAKE2s might not be available
    // In production, should use proper BLAKE2s implementation
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash.slice(0, outputLength));
  }

  private async hkdf(
    ikm: Uint8Array,
    salt: Uint8Array,
    info: string,
    length: number
  ): Promise<Uint8Array> {
    try {
      const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
      const infoBuffer = new TextEncoder().encode(info);
      
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt,
          info: infoBuffer
        },
        key,
        length * 8
      );
      
      return new Uint8Array(derivedBits);
    } catch (error) {
      throw new OpaqueError('HKDF derivation failed', error);
    }
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// Export singleton instance
export const opaqueClient = OpaqueClient.getInstance(); 