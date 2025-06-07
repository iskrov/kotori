/**
 * Encrypted Journal Service
 * 
 * High-level service that integrates zero-knowledge encryption with journal operations.
 * Handles transparent encryption/decryption for hidden entries.
 */

import { JournalAPI } from './api';
import { zeroKnowledgeEncryption } from './zeroKnowledgeEncryption';
import { hiddenModeManager } from './hiddenModeManager';
import settingsService from './settingsService';
import logger from '../utils/logger';

export interface JournalEntryData {
  id?: number;
  title?: string;
  content: string;
  entry_date?: string;
  audio_url?: string;
  tags?: string[];
  is_hidden?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEntryOptions {
  forceHidden?: boolean;  // Force entry to be hidden regardless of hidden mode state
  regularEntry?: boolean; // Force entry to be regular (not hidden)
}

class EncryptedJournalService {
  /**
   * Create a journal entry, automatically encrypting based on user preferences and hidden mode
   */
  async createEntry(
    entryData: Omit<JournalEntryData, 'id'>,
    options: CreateEntryOptions = {}
  ): Promise<JournalEntryData> {
    const { forceHidden, regularEntry } = options;
    
    // Get user's default privacy setting
    const settings = await settingsService.getSettings();
    const defaultPrivacy = settings.defaultEntryPrivacy;
    
    // Determine if entry should be hidden based on:
    // 1. Explicit force options
    // 2. Hidden mode being active (overrides default privacy)
    // 3. User's default privacy setting
    let shouldHide = false;
    
    if (forceHidden) {
      shouldHide = true;
      logger.info('Creating hidden entry: forced by options');
    } else if (regularEntry) {
      shouldHide = false;
      logger.info('Creating regular entry: forced by options');
    } else if (hiddenModeManager.isActive()) {
      shouldHide = true;
      logger.info('Creating hidden entry: hidden mode is active');
    } else if (defaultPrivacy === 'hidden') {
      shouldHide = true;
      logger.info('Creating hidden entry: user default privacy is hidden');
    } else {
      shouldHide = false;
      logger.info('Creating regular entry: user default privacy is public');
    }
    
    if (shouldHide && zeroKnowledgeEncryption.isReady()) {
      return this.createHiddenEntry(entryData);
    } else {
      // Fall back to regular entry if encryption not ready
      if (shouldHide && !zeroKnowledgeEncryption.isReady()) {
        logger.warn('Entry should be hidden but encryption not ready, creating regular entry');
      }
      return this.createRegularEntry(entryData);
    }
  }

  /**
   * Create a regular (non-encrypted) journal entry
   */
  private async createRegularEntry(entryData: Omit<JournalEntryData, 'id'>): Promise<JournalEntryData> {
    try {
      const response = await JournalAPI.createEntry({
        title: entryData.title || '',
        content: entryData.content,
        entry_date: entryData.entry_date || new Date().toISOString(),
        audio_url: entryData.audio_url,
        tags: entryData.tags || [],
        is_hidden: false,
      });
      
      logger.info('Created regular journal entry');
      return response.data;
    } catch (error) {
      logger.error('Failed to create regular journal entry:', error);
      throw new Error('Failed to create journal entry');
    }
  }

  /**
   * Create a hidden (encrypted) journal entry
   */
  private async createHiddenEntry(entryData: Omit<JournalEntryData, 'id'>): Promise<JournalEntryData> {
    if (!zeroKnowledgeEncryption.isReady()) {
      throw new Error('Zero-knowledge encryption not initialized');
    }

    try {
      // Encrypt the content
      const encrypted = await zeroKnowledgeEncryption.encryptEntry(entryData.content);
      
      // Create the encrypted entry
      const response = await JournalAPI.createEncryptedEntry({
        title: entryData.title || '',
        encrypted_content: encrypted.encryptedContent,
        encrypted_key: encrypted.encryptedKey,
        iv: encrypted.iv,
        salt: encrypted.salt,
        algorithm: encrypted.algorithm,
        entry_date: entryData.entry_date || new Date().toISOString(),
        audio_url: entryData.audio_url,
        tags: entryData.tags || [],
        wrapIv: encrypted.wrapIv,
      });
      
      logger.info('Created hidden journal entry with zero-knowledge encryption');
      
      // Return with decrypted content for immediate use
      return {
        ...response.data,
        content: entryData.content, // Return original content for UI
        is_hidden: true,
      };
    } catch (error) {
      logger.error('Failed to create hidden journal entry:', error);
      throw new Error('Failed to create encrypted journal entry');
    }
  }

  /**
   * Get journal entries, automatically decrypting hidden entries if in hidden mode
   */
  async getEntries(options: {
    page?: number;
    limit?: number;
    tags?: string[];
    entry_date?: string;
    includeHidden?: boolean;
  } = {}): Promise<JournalEntryData[]> {
    try {
      // Always fetch both hidden and regular entries
      const response = await JournalAPI.getEntries({
        ...options,
        include_hidden: true,
      });
      
      const entries = response.data.entries || response.data;
      
      // Filter and decrypt entries based on hidden mode state
      return this.processEntries(entries);
    } catch (error) {
      logger.error('Failed to get journal entries:', error);
      throw new Error('Failed to retrieve journal entries');
    }
  }

  /**
   * Get a specific journal entry by ID
   */
  async getEntry(id: string): Promise<JournalEntryData | null> {
    try {
      const response = await JournalAPI.getEntry(id);
      const entry = response.data;
      
      if (!entry) return null;
      
      const processedEntries = await this.processEntries([entry]);
      return processedEntries.length > 0 ? processedEntries[0] : null;
    } catch (error) {
      logger.error(`Failed to get journal entry ${id}:`, error);
      throw new Error('Failed to retrieve journal entry');
    }
  }

  /**
   * Process entries: filter based on hidden mode and decrypt if necessary
   */
  private async processEntries(entries: any[]): Promise<JournalEntryData[]> {
    // Filter entries based on hidden mode state
    const filteredEntries = hiddenModeManager.filterEntries(entries);
    
    // Decrypt hidden entries if we're in hidden mode
    const processedEntries = await Promise.all(
      filteredEntries.map(async (entry) => {
        if (entry.is_hidden && hiddenModeManager.isActive()) {
          return this.decryptEntry(entry);
        }
        return entry;
      })
    );
    
    return processedEntries.filter(entry => entry !== null) as JournalEntryData[];
  }

  /**
   * Decrypt a hidden journal entry
   */
  private async decryptEntry(entry: any): Promise<JournalEntryData | null> {
    if (!zeroKnowledgeEncryption.isReady()) {
      logger.warn('Cannot decrypt entry: zero-knowledge encryption not initialized');
      return null;
    }

    try {
      // Check if we have the necessary encryption fields
      if (!entry.encrypted_content || !entry.encryption_iv || !entry.encryption_salt) {
        logger.warn('Entry missing encryption fields, cannot decrypt');
        return null;
      }

      const encrypted = {
        encryptedContent: entry.encrypted_content,
        encryptedKey: entry.encrypted_key || '', // Handle missing key field
        iv: entry.encryption_iv,
        salt: entry.encryption_salt,
        algorithm: entry.encryption_algorithm || 'AES-GCM',
        wrapIv: entry.encryption_wrap_iv || entry.encryption_iv, // Fallback for backward compatibility
      };

      const decryptedContent = await zeroKnowledgeEncryption.decryptEntry(encrypted);
      
      return {
        ...entry,
        content: decryptedContent,
      };
    } catch (error) {
      logger.error('Failed to decrypt journal entry:', error);
      // Return entry with encrypted content as fallback
      return {
        ...entry,
        content: '[Encrypted Content - Unable to Decrypt]',
      };
    }
  }

  /**
   * Search journal entries
   */
  async searchEntries(query: string): Promise<JournalEntryData[]> {
    try {
      // Include hidden entries if in hidden mode
      const includeHidden = hiddenModeManager.isActive();
      const response = await JournalAPI.searchEntries(query, includeHidden);
      
      const entries = response.data.entries || response.data;
      return this.processEntries(entries);
    } catch (error) {
      logger.error('Failed to search journal entries:', error);
      throw new Error('Failed to search journal entries');
    }
  }

  /**
   * Update a journal entry
   */
  async updateEntry(id: string, updates: Partial<JournalEntryData>): Promise<JournalEntryData> {
    try {
      // For now, use the regular update API
      // TODO: Add support for updating encrypted content
      const response = await JournalAPI.updateEntry(id, updates);
      return response.data;
    } catch (error) {
      logger.error(`Failed to update journal entry ${id}:`, error);
      throw new Error('Failed to update journal entry');
    }
  }

  /**
   * Delete a journal entry
   */
  async deleteEntry(id: string): Promise<void> {
    try {
      await JournalAPI.deleteEntry(id);
      logger.info(`Deleted journal entry ${id}`);
    } catch (error) {
      logger.error(`Failed to delete journal entry ${id}:`, error);
      throw new Error('Failed to delete journal entry');
    }
  }

  /**
   * Check if zero-knowledge encryption is available
   */
  isEncryptionReady(): boolean {
    return zeroKnowledgeEncryption.isReady();
  }

  /**
   * Initialize zero-knowledge encryption with user credentials
   */
  async initializeEncryption(userSecret: string): Promise<boolean> {
    try {
      const success = await zeroKnowledgeEncryption.initializeMasterKey({
        userSecret,
        iterations: 100000,
        keyLength: 256,
      });
      
      if (success) {
        logger.info('Zero-knowledge encryption initialized successfully');
      } else {
        logger.error('Failed to initialize zero-knowledge encryption');
      }
      
      return success;
    } catch (error) {
      logger.error('Error initializing zero-knowledge encryption:', error);
      return false;
    }
  }

  /**
   * Load existing encryption keys with user credentials
   */
  async loadEncryption(userSecret: string): Promise<boolean> {
    try {
      const success = await zeroKnowledgeEncryption.loadMasterKey(userSecret);
      
      if (success) {
        logger.info('Zero-knowledge encryption keys loaded successfully');
      } else {
        logger.warn('No existing encryption keys found or failed to load');
      }
      
      return success;
    } catch (error) {
      logger.error('Error loading zero-knowledge encryption:', error);
      return false;
    }
  }
}

// Export singleton instance
export const encryptedJournalService = new EncryptedJournalService();
export default encryptedJournalService; 