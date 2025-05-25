/**
 * Client-Side Zero-Knowledge Encryption Service
 * 
 * This service ensures that encryption keys are derived from user secrets
 * and never leave the user's device. The server cannot decrypt user data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import logger from '../utils/logger';

interface EncryptionResult {
  encryptedContent: string;  // Base64 encoded encrypted data
  iv: string;               // Base64 encoded initialization vector
  salt: string;             // Base64 encoded salt used for key derivation
}

interface KeyDerivationParams {
  userSecret: string;       // User's secret phrase or biometric-derived data
  salt?: Uint8Array;        // Optional salt for key derivation
  iterations?: number;      // PBKDF2 iterations
}

class ClientEncryptionService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly SALT_LENGTH = 32; // 256 bits
  private static readonly DEFAULT_ITERATIONS = 100000;
  
  // Secure storage keys
  private static readonly USER_SALT_KEY = 'user_encryption_salt';
  private static readonly KEY_DERIVATION_PARAMS_KEY = 'key_derivation_params';

  /**
   * Check if Web Crypto API is available
   */
  private isWebCryptoAvailable(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.subtle.deriveKey === 'function';
  }

  /**
   * Get or create a user-specific salt for key derivation
   */
  private async getUserSalt(): Promise<Uint8Array> {
    try {
      // Try to get existing salt from secure storage
      let saltBase64: string | null = null;
      
      if (Platform.OS === 'web') {
        saltBase64 = localStorage.getItem(ClientEncryptionService.USER_SALT_KEY);
      } else {
        // Use AsyncStorage for mobile platforms (Note: consider upgrading to expo-secure-store for production)
        saltBase64 = await AsyncStorage.getItem(ClientEncryptionService.USER_SALT_KEY);
      }

      if (saltBase64) {
        // Convert base64 back to Uint8Array
        const binaryString = atob(saltBase64);
        const salt = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          salt[i] = binaryString.charCodeAt(i);
        }
        return salt;
      }

      // Generate new salt if none exists
      const newSalt = crypto.getRandomValues(new Uint8Array(ClientEncryptionService.SALT_LENGTH));
      
      // Convert to base64 for storage
      const saltArray = Array.from(newSalt);
      const saltBase64New = btoa(String.fromCharCode(...saltArray));

      // Store securely
      if (Platform.OS === 'web') {
        localStorage.setItem(ClientEncryptionService.USER_SALT_KEY, saltBase64New);
      } else {
        await AsyncStorage.setItem(ClientEncryptionService.USER_SALT_KEY, saltBase64New);
      }

      logger.info('Generated new user salt for encryption');
      return newSalt;
    } catch (error) {
      logger.error('Failed to get or create user salt:', error);
      throw new Error('Failed to initialize encryption salt');
    }
  }

  /**
   * Derive encryption key from user secret using PBKDF2
   */
  private async deriveKeyFromSecret(params: KeyDerivationParams): Promise<CryptoKey> {
    if (!this.isWebCryptoAvailable()) {
      throw new Error('Web Crypto API not available');
    }

    const { userSecret, salt, iterations = ClientEncryptionService.DEFAULT_ITERATIONS } = params;
    
    try {
      // Convert user secret to key material
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(userSecret),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // Use provided salt or get user-specific salt
      const derivationSalt = salt || await this.getUserSalt();

      // Derive the actual encryption key
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: derivationSalt,
          iterations: iterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        {
          name: ClientEncryptionService.ALGORITHM,
          length: ClientEncryptionService.KEY_LENGTH
        },
        false, // Key is not extractable
        ['encrypt', 'decrypt']
      );

      return key;
    } catch (error) {
      logger.error('Failed to derive encryption key:', error);
      throw new Error('Key derivation failed');
    }
  }

  /**
   * Encrypt content using user-derived key
   */
  async encryptContent(content: string, userSecret: string): Promise<EncryptionResult> {
    if (!this.isWebCryptoAvailable()) {
      throw new Error('Encryption not available on this platform');
    }

    try {
      // Get user-specific salt
      const salt = await this.getUserSalt();
      
      // Derive encryption key from user secret
      const key = await this.deriveKeyFromSecret({ userSecret, salt });

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(ClientEncryptionService.IV_LENGTH));

      // Encrypt the content
      const encoder = new TextEncoder();
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: ClientEncryptionService.ALGORITHM,
          iv: iv
        },
        key,
        encoder.encode(content)
      );

      // Convert to base64 for storage/transmission
      const encryptedArray = new Uint8Array(encryptedData);
      const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
      const ivBase64 = btoa(String.fromCharCode(...iv));
      const saltBase64 = btoa(String.fromCharCode(...salt));

      logger.info('Content encrypted successfully');
      
      return {
        encryptedContent: encryptedBase64,
        iv: ivBase64,
        salt: saltBase64
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt content');
    }
  }

  /**
   * Decrypt content using user-derived key
   */
  async decryptContent(
    encryptedContent: string, 
    iv: string, 
    userSecret: string,
    salt?: string
  ): Promise<string> {
    if (!this.isWebCryptoAvailable()) {
      throw new Error('Decryption not available on this platform');
    }

    try {
      // Convert base64 back to Uint8Array
      const encryptedData = new Uint8Array(
        atob(encryptedContent).split('').map(char => char.charCodeAt(0))
      );
      const ivArray = new Uint8Array(
        atob(iv).split('').map(char => char.charCodeAt(0))
      );
      
      // Use provided salt or get stored salt
      let saltArray: Uint8Array;
      if (salt) {
        saltArray = new Uint8Array(
          atob(salt).split('').map(char => char.charCodeAt(0))
        );
      } else {
        saltArray = await this.getUserSalt();
      }

      // Derive the same key used for encryption
      const key = await this.deriveKeyFromSecret({ userSecret, salt: saltArray });

      // Decrypt the content
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: ClientEncryptionService.ALGORITHM,
          iv: ivArray
        },
        key,
        encryptedData
      );

      // Convert back to string
      const decoder = new TextDecoder();
      const decryptedContent = decoder.decode(decryptedData);

      logger.info('Content decrypted successfully');
      return decryptedContent;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt content - invalid key or corrupted data');
    }
  }

  /**
   * Verify if a user secret can decrypt a given encrypted content
   */
  async verifyUserSecret(
    encryptedContent: string,
    iv: string,
    userSecret: string,
    salt?: string
  ): Promise<boolean> {
    try {
      await this.decryptContent(encryptedContent, iv, userSecret, salt);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear stored encryption data (for logout/reset)
   */
  async clearEncryptionData(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(ClientEncryptionService.USER_SALT_KEY);
        localStorage.removeItem(ClientEncryptionService.KEY_DERIVATION_PARAMS_KEY);
      } else {
        await AsyncStorage.removeItem(ClientEncryptionService.USER_SALT_KEY);
        await AsyncStorage.removeItem(ClientEncryptionService.KEY_DERIVATION_PARAMS_KEY);
      }
      logger.info('Encryption data cleared');
    } catch (error) {
      logger.error('Failed to clear encryption data:', error);
    }
  }

  /**
   * Generate a strong random secret for initial setup
   */
  generateRandomSecret(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const randomBytes = crypto.getRandomValues(new Uint8Array(length));
    
    return Array.from(randomBytes)
      .map(byte => charset[byte % charset.length])
      .join('');
  }

  /**
   * Test encryption/decryption functionality
   */
  async testEncryption(): Promise<boolean> {
    try {
      const testContent = 'This is a test message for encryption verification';
      const testSecret = 'test-user-secret-phrase-123';
      
      const encrypted = await this.encryptContent(testContent, testSecret);
      const decrypted = await this.decryptContent(
        encrypted.encryptedContent,
        encrypted.iv,
        testSecret,
        encrypted.salt
      );
      
      const success = decrypted === testContent;
      logger.info('Encryption test:', success ? 'PASSED' : 'FAILED');
      return success;
    } catch (error) {
      logger.error('Encryption test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const clientEncryption = new ClientEncryptionService();
export default clientEncryption; 