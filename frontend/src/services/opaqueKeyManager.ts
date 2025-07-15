import { OpaqueSessionResult } from './opaqueAuth';
import logger from '../utils/logger';

// Key derivation constants (must match backend)
const KEY_DERIVATION_INFO = {
  TAG_ID_KEY: 'TagID',
  ENCRYPTION_KEY: 'Encryption',
  VAULT_KEY: 'VaultKey'
} as const;

/**
 * Derives cryptographic keys from OPAQUE export key using HKDF
 * This integrates with the backend key derivation system
 */
export class OpaqueKeyManager {
  private sessionKey: Uint8Array | null = null;
  private exportKey: Uint8Array | null = null;
  private derivedKeys: Map<string, Uint8Array> = new Map();

  /**
   * Initialize the key manager with OPAQUE session result
   * @param sessionResult Result from successful OPAQUE login
   */
  public initialize(sessionResult: OpaqueSessionResult): void {
    this.sessionKey = sessionResult.sessionKey;
    this.exportKey = sessionResult.exportKey;
    this.derivedKeys.clear();
    
    logger.info('OPAQUE key manager initialized', {
      sessionKeyType: typeof this.sessionKey,
      sessionKeyConstructor: this.sessionKey?.constructor?.name,
      exportKeyType: typeof this.exportKey,
      exportKeyConstructor: this.exportKey?.constructor?.name
    });
  }

  /**
   * Derive TagID key for deterministic tag generation
   * @param salt Optional salt for key derivation
   * @returns TagID key as Uint8Array
   */
  public async deriveTagIdKey(salt?: Uint8Array): Promise<Uint8Array> {
    if (!this.exportKey) {
      throw new Error('OPAQUE key manager not initialized');
    }

    const cacheKey = `tagid_${salt ? Array.from(salt).join(',') : 'default'}`;
    
    if (this.derivedKeys.has(cacheKey)) {
      return this.derivedKeys.get(cacheKey)!;
    }

    try {
      const tagIdKey = await this.deriveKey(
        this.exportKey,
        KEY_DERIVATION_INFO.TAG_ID_KEY,
        32, // 256-bit key
        salt
      );

      this.derivedKeys.set(cacheKey, tagIdKey);
      logger.debug('TagID key derived successfully');
      return tagIdKey;
    } catch (error) {
      logger.error('Failed to derive TagID key', error);
      throw new Error('TagID key derivation failed');
    }
  }

  /**
   * Derive encryption key for vault data protection
   * @param salt Optional salt for key derivation
   * @returns Encryption key as Uint8Array
   */
  public async deriveEncryptionKey(salt?: Uint8Array): Promise<Uint8Array> {
    if (!this.exportKey) {
      throw new Error('OPAQUE key manager not initialized');
    }

    const cacheKey = `encryption_${salt ? Array.from(salt).join(',') : 'default'}`;
    
    if (this.derivedKeys.has(cacheKey)) {
      return this.derivedKeys.get(cacheKey)!;
    }

    try {
      const encryptionKey = await this.deriveKey(
        this.exportKey,
        KEY_DERIVATION_INFO.ENCRYPTION_KEY,
        32, // 256-bit key for AES-256
        salt
      );

      this.derivedKeys.set(cacheKey, encryptionKey);
      logger.debug('Encryption key derived successfully');
      return encryptionKey;
    } catch (error) {
      logger.error('Failed to derive encryption key', error);
      throw new Error('Encryption key derivation failed');
    }
  }

  /**
   * Derive vault key for journal data encryption
   * @param salt Optional salt for key derivation
   * @returns Vault key as Uint8Array
   */
  public async deriveVaultKey(salt?: Uint8Array): Promise<Uint8Array> {
    if (!this.exportKey) {
      throw new Error('OPAQUE key manager not initialized');
    }

    const cacheKey = `vault_${salt ? Array.from(salt).join(',') : 'default'}`;
    
    if (this.derivedKeys.has(cacheKey)) {
      return this.derivedKeys.get(cacheKey)!;
    }

    try {
      const vaultKey = await this.deriveKey(
        this.exportKey,
        KEY_DERIVATION_INFO.VAULT_KEY,
        32, // 256-bit key
        salt
      );

      this.derivedKeys.set(cacheKey, vaultKey);
      logger.debug('Vault key derived successfully');
      return vaultKey;
    } catch (error) {
      logger.error('Failed to derive vault key', error);
      throw new Error('Vault key derivation failed');
    }
  }

  /**
   * Get the session key for API authentication
   * @returns Session key as Uint8Array
   */
  public getSessionKey(): Uint8Array {
    if (!this.sessionKey) {
      throw new Error('OPAQUE key manager not initialized');
    }
    return this.sessionKey;
  }

  /**
   * Get the export key for additional key derivation
   * @returns Export key as Uint8Array
   */
  public getExportKey(): Uint8Array {
    if (!this.exportKey) {
      throw new Error('OPAQUE key manager not initialized');
    }
    return this.exportKey;
  }

  /**
   * Check if the key manager is initialized
   * @returns True if initialized with valid keys
   */
  public isInitialized(): boolean {
    return this.sessionKey !== null && this.exportKey !== null;
  }

  /**
   * Clear all derived keys and session data
   */
  public clear(): void {
    // Securely zero out keys if possible
    if (this.sessionKey) {
      // Check if it's a Uint8Array before calling fill
      if (this.sessionKey instanceof Uint8Array) {
        this.sessionKey.fill(0);
      }
      this.sessionKey = null;
    }
    
    if (this.exportKey) {
      // Check if it's a Uint8Array before calling fill
      if (this.exportKey instanceof Uint8Array) {
        this.exportKey.fill(0);
      }
      this.exportKey = null;
    }

    // Clear derived keys
    for (const key of this.derivedKeys.values()) {
      if (key instanceof Uint8Array) {
        key.fill(0);
      }
    }
    this.derivedKeys.clear();

    logger.info('OPAQUE key manager cleared');
  }

  /**
   * Internal HKDF key derivation function
   * Uses Web Crypto API for HKDF-SHA256
   */
  private async deriveKey(
    ikm: Uint8Array,
    info: string,
    length: number,
    salt?: Uint8Array
  ): Promise<Uint8Array> {
    try {
      // Import the input key material
      const key = await crypto.subtle.importKey(
        'raw',
        ikm,
        'HKDF',
        false,
        ['deriveKey', 'deriveBits']
      );

      // Derive the key using HKDF-SHA256
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: salt || new Uint8Array(32), // Default to 32-byte zero salt
          info: new TextEncoder().encode(info)
        },
        key,
        length * 8 // Convert bytes to bits
      );

      return new Uint8Array(derivedBits);
    } catch (error) {
      logger.error('HKDF key derivation failed', error);
      throw new Error('Key derivation failed');
    }
  }
}

// Export singleton instance
export const opaqueKeyManager = new OpaqueKeyManager(); 