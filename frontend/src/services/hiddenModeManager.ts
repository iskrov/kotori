/**
 * Hidden Mode Manager
 * 
 * Manages hidden mode activation and hidden entry filtering entirely client-side.
 * No server-side hidden mode state - true zero-knowledge implementation.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { zeroKnowledgeEncryption } from './zeroKnowledgeEncryption';
import logger from '../utils/logger';

export interface CodePhrase {
  id: string;
  hash: string;         // PBKDF2 hash of the phrase
  salt: string;         // Salt for hashing
  type: 'unlock' | 'decoy' | 'panic';
  createdAt: number;
}

export interface HiddenModeConfig {
  timeoutMinutes: number;    // Auto-lock timeout
  allowQuickLock: boolean;   // Enable shake/gesture lock
  panicModeEnabled: boolean; // Enable panic deletion
  decoyModeEnabled: boolean; // Enable decoy entries
}

class HiddenModeManager {
  // Storage keys
  private static readonly CODE_PHRASES_KEY = 'hidden_code_phrases';
  private static readonly HIDDEN_CONFIG_KEY = 'hidden_mode_config';
  private static readonly DECOY_ENTRIES_KEY = 'decoy_entries';
  
  // Crypto constants
  private static readonly DEFAULT_ITERATIONS = 100000;
  private static readonly SALT_LENGTH = 32;

  // State
  private isHiddenModeActive = false;
  private hiddenModeTimeout: NodeJS.Timeout | null = null;
  private config: HiddenModeConfig = {
    timeoutMinutes: 2,
    allowQuickLock: true,
    panicModeEnabled: true,
    decoyModeEnabled: true
  };

  /**
   * Secure storage abstraction for web compatibility
   */
  private async getSecureItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    } else {
      return SecureStore.getItemAsync(key);
    }
  }

  private async setSecureItem(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value, options);
    }
  }

  private async deleteSecureItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }

  /**
   * Initialize hidden mode manager and load configuration
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      logger.info('Hidden mode manager initialized');
    } catch (error) {
      logger.error('Failed to initialize hidden mode manager:', error);
    }
  }

  /**
   * Load configuration from secure storage
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const configStr = await this.getSecureItem(HiddenModeManager.HIDDEN_CONFIG_KEY);
      if (configStr) {
        this.config = { ...this.config, ...JSON.parse(configStr) };
      }
    } catch (error) {
      logger.warn('Failed to load hidden mode config:', error);
    }
  }

  /**
   * Save configuration to secure storage
   */
  async saveConfiguration(config: Partial<HiddenModeConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await this.setSecureItem(
        HiddenModeManager.HIDDEN_CONFIG_KEY,
        JSON.stringify(this.config),
        {
          requireAuthentication: true,
          authenticationPrompt: 'Authenticate to modify hidden mode settings'
        }
      );
      logger.info('Hidden mode configuration saved');
    } catch (error) {
      logger.error('Failed to save hidden mode config:', error);
      throw error;
    }
  }

  /**
   * Add a new code phrase
   */
  async addCodePhrase(
    phrase: string, 
    type: 'unlock' | 'decoy' | 'panic'
  ): Promise<string> {
    try {
      // Normalize phrase
      const normalizedPhrase = this.normalizePhrase(phrase);
      
      // Generate salt and hash
      const salt = crypto.getRandomValues(new Uint8Array(HiddenModeManager.SALT_LENGTH));
      const hash = await this.hashPhrase(normalizedPhrase, salt);
      
      // Create code phrase object
      const codePhrase: CodePhrase = {
        id: crypto.randomUUID(),
        hash: this.arrayToBase64(hash),
        salt: this.arrayToBase64(salt),
        type,
        createdAt: Date.now()
      };

      // Load existing phrases
      const existingPhrases = await this.getCodePhrases();
      existingPhrases.push(codePhrase);

      // Save to secure storage
      await this.setSecureItem(
        HiddenModeManager.CODE_PHRASES_KEY,
        JSON.stringify(existingPhrases),
        {
          requireAuthentication: true,
          authenticationPrompt: 'Authenticate to manage code phrases'
        }
      );

      logger.info(`Code phrase added: type=${type}, id=${codePhrase.id}`);
      return codePhrase.id;
    } catch (error) {
      logger.error('Failed to add code phrase:', error);
      throw error;
    }
  }

  /**
   * Check if transcribed text contains any code phrases
   */
  async checkForCodePhrases(transcribedText: string): Promise<{
    found: boolean;
    type?: 'unlock' | 'decoy' | 'panic';
    phraseId?: string;
  }> {
    try {
      const normalizedText = this.normalizePhrase(transcribedText);
      const codePhrases = await this.getCodePhrases();

      for (const codePhrase of codePhrases) {
        const salt = this.base64ToArray(codePhrase.salt);
        const expectedHash = this.base64ToArray(codePhrase.hash);
        
        // Check if the transcribed text contains this phrase
        if (await this.containsPhrase(normalizedText, expectedHash, salt)) {
          logger.info(`Code phrase detected: type=${codePhrase.type}, id=${codePhrase.id}`);
          return {
            found: true,
            type: codePhrase.type,
            phraseId: codePhrase.id
          };
        }
      }

      return { found: false };
    } catch (error) {
      logger.error('Failed to check for code phrases:', error);
      return { found: false };
    }
  }

  /**
   * Activate hidden mode
   */
  activateHiddenMode(): void {
    this.isHiddenModeActive = true;
    this.startAutoLockTimer();
    logger.info('Hidden mode activated');
  }

  /**
   * Deactivate hidden mode
   */
  deactivateHiddenMode(): void {
    this.isHiddenModeActive = false;
    this.clearAutoLockTimer();
    logger.info('Hidden mode deactivated');
  }

  /**
   * Check if hidden mode is currently active
   */
  isActive(): boolean {
    return this.isHiddenModeActive;
  }

  /**
   * Extend hidden mode timeout (on user activity)
   */
  extendTimeout(): void {
    if (this.isHiddenModeActive) {
      this.startAutoLockTimer();
    }
  }

  /**
   * Start auto-lock timer
   */
  private startAutoLockTimer(): void {
    this.clearAutoLockTimer();
    
    this.hiddenModeTimeout = setTimeout(() => {
      this.deactivateHiddenMode();
      logger.info('Hidden mode auto-locked due to timeout');
    }, this.config.timeoutMinutes * 60 * 1000);
  }

  /**
   * Clear auto-lock timer
   */
  private clearAutoLockTimer(): void {
    if (this.hiddenModeTimeout) {
      clearTimeout(this.hiddenModeTimeout);
      this.hiddenModeTimeout = null;
    }
  }

  /**
   * Handle panic mode activation
   */
  async activatePanicMode(): Promise<void> {
    if (!this.config.panicModeEnabled) {
      return;
    }

    try {
      logger.warn('PANIC MODE ACTIVATED - Deleting sensitive data');
      
      // Clear all encryption keys and data
      await zeroKnowledgeEncryption.secureClearAllData();
      
      // Clear hidden mode data
      await this.clearAllHiddenData();
      
      // Deactivate hidden mode
      this.deactivateHiddenMode();
      
      logger.warn('Panic mode completed - All sensitive data deleted');
    } catch (error) {
      logger.error('Panic mode failed:', error);
      throw error;
    }
  }

  /**
   * Generate decoy entries for decoy mode
   */
  async generateDecoyEntries(): Promise<Array<{
    id: string;
    title: string;
    content: string;
    entry_date: string;
    created_at: string;
  }>> {
    if (!this.config.decoyModeEnabled) {
      return [];
    }

    // Sample decoy entries that look believable
    const decoyTemplates = [
      {
        title: "Morning Reflection",
        content: "Had a great workout this morning. Really feeling motivated to keep up with my fitness goals this year.",
        hoursAgo: 8
      },
      {
        title: "Work Update",
        content: "Team meeting went well today. We're making good progress on the quarterly objectives. Looking forward to the weekend.",
        hoursAgo: 24
      },
      {
        title: "Grocery List",
        content: "Need to pick up milk, bread, eggs, and some fresh vegetables. Also should grab something for dinner tomorrow.",
        hoursAgo: 72
      }
    ];

    return decoyTemplates.map((template, index) => {
      const entryDate = new Date(Date.now() - template.hoursAgo * 60 * 60 * 1000);
      return {
        id: `decoy_${index}_${Date.now()}`,
        title: template.title,
        content: template.content,
        entry_date: entryDate.toISOString(),
        created_at: entryDate.toISOString()
      };
    });
  }

  /**
   * Filter entries based on hidden mode state
   */
  filterEntries<T extends { is_hidden?: boolean }>(entries: T[]): T[] {
    if (this.isHiddenModeActive) {
      // Show all entries when hidden mode is active
      this.extendTimeout(); // Extend timeout on access
      return entries;
    } else {
      // Only show non-hidden entries when hidden mode is inactive
      return entries.filter(entry => !entry.is_hidden);
    }
  }

  /**
   * Determine if an entry should be hidden based on content
   */
  shouldHideEntry(content: string): boolean {
    // This could be enhanced with AI-based sensitive content detection
    // For now, just check if hidden mode is active
    return this.isHiddenModeActive;
  }

  /**
   * Get all configured code phrases (for management UI)
   */
  private async getCodePhrases(): Promise<CodePhrase[]> {
    try {
      const phrasesStr = await this.getSecureItem(HiddenModeManager.CODE_PHRASES_KEY);
      return phrasesStr ? JSON.parse(phrasesStr) : [];
    } catch (error) {
      logger.warn('Failed to load code phrases:', error);
      return [];
    }
  }

  /**
   * Remove a code phrase
   */
  async removeCodePhrase(phraseId: string): Promise<void> {
    try {
      const phrases = await this.getCodePhrases();
      const filteredPhrases = phrases.filter(p => p.id !== phraseId);
      
      await this.setSecureItem(
        HiddenModeManager.CODE_PHRASES_KEY,
        JSON.stringify(filteredPhrases),
        {
          requireAuthentication: true,
          authenticationPrompt: 'Authenticate to manage code phrases'
        }
      );
      
      logger.info(`Code phrase removed: ${phraseId}`);
    } catch (error) {
      logger.error('Failed to remove code phrase:', error);
      throw error;
    }
  }

  /**
   * Clear all hidden mode data (for panic mode)
   */
  private async clearAllHiddenData(): Promise<void> {
    try {
      await this.deleteSecureItem(HiddenModeManager.CODE_PHRASES_KEY);
      await this.deleteSecureItem(HiddenModeManager.HIDDEN_CONFIG_KEY);
      await this.deleteSecureItem(HiddenModeManager.DECOY_ENTRIES_KEY);
      logger.info('All hidden mode data cleared');
    } catch (error) {
      logger.error('Failed to clear hidden mode data:', error);
    }
  }

  /**
   * Normalize phrase for consistent comparison
   */
  private normalizePhrase(phrase: string): string {
    return phrase
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Hash phrase using PBKDF2
   */
  private async hashPhrase(phrase: string, salt: Uint8Array): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(phrase),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: HiddenModeManager.DEFAULT_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return new Uint8Array(bits);
  }

  /**
   * Check if text contains a phrase by comparing hashes
   */
  private async containsPhrase(
    text: string, 
    expectedHash: Uint8Array, 
    salt: Uint8Array
  ): Promise<boolean> {
    // Split text into potential phrases and check each
    const words = text.split(' ');
    
    // Check phrases of different lengths (2-8 words)
    for (let length = 2; length <= Math.min(8, words.length); length++) {
      for (let start = 0; start <= words.length - length; start++) {
        const candidatePhrase = words.slice(start, start + length).join(' ');
        const candidateHash = await this.hashPhrase(candidatePhrase, salt);
        
        if (this.constantTimeArrayEquals(candidateHash, expectedHash)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Constant-time array comparison to prevent timing attacks
   */
  private constantTimeArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }

  /**
   * Utility methods for base64 conversion
   */
  private arrayToBase64(array: Uint8Array): string {
    const binaryString = Array.from(array, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  }

  private base64ToArray(base64: string): Uint8Array {
    const binaryString = atob(base64);
    return new Uint8Array(binaryString.length).map((_, i) => binaryString.charCodeAt(i));
  }
}

// Export singleton instance
export const hiddenModeManager = new HiddenModeManager();
export default hiddenModeManager; 