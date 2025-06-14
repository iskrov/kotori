/**
 * Encrypted Journal Service
 * 
 * High-level service that integrates phrase-based zero-knowledge encryption with journal operations.
 * Handles transparent encryption/decryption for secret tag entries using secret phrases directly as keys.
 */

import { JournalAPI } from './api';
import { zeroKnowledgeEncryption } from './zeroKnowledgeEncryption';
import { secretTagManager } from './secretTagManager';
import logger from '../utils/logger';

export interface JournalEntryData {
  id?: number;
  title?: string;
  content: string;
  entry_date?: string;
  audio_url?: string;
  tags?: string[];
  secret_tag_id?: string | null;  // Secret tag ID (if any)
  created_at?: string;
  updated_at?: string;
}

export interface CreateEntryOptions {
  secretTagId?: string;    // Specific secret tag to use
  forcePublic?: boolean;   // Force entry to be public (no secret tag)
  detectedTagId?: string;  // Tag detected from voice activation
}

class EncryptedJournalService {
  /**
   * Create a journal entry, automatically encrypting based on active secret tags
   */
  async createEntry(
    entryData: Omit<JournalEntryData, 'id'>,
    options: CreateEntryOptions = {}
  ): Promise<JournalEntryData> {
    const { secretTagId, forcePublic, detectedTagId } = options;
    
    // Check for manual secret tag activation in content before creating entry
    let manuallyDetectedTagId: string | null = null;
    if (!forcePublic && !secretTagId && !detectedTagId && entryData.content) {
      try {
        const detection = await secretTagManager.checkForSecretTagPhrases(entryData.content);
        if (detection.found && detection.tagId && detection.action === 'activate') {
          logger.info(`Manual secret tag activation detected in content: ${detection.tagName} (${detection.tagId})`);
          
          // Activate the detected tag
          await secretTagManager.activateSecretTag(detection.tagId);
          manuallyDetectedTagId = detection.tagId;
          
          // Remove the activation phrase from content to keep it private
          const normalizedContent = secretTagManager.normalizePhrase(entryData.content);
          const normalizedPhrase = secretTagManager.normalizePhrase(detection.tagName || '');
          
          // For single-word phrases, be more careful about removal to avoid removing legitimate content
          let cleanedContent = entryData.content;
          
          // If the entire content (normalized) is just the activation phrase, replace it
          if (normalizedContent === normalizedPhrase) {
            cleanedContent = 'Secret tag activated via voice command.';
          } else {
            // Otherwise, try to remove just the activation phrase while preserving other content
            // Use word boundaries for single words to avoid partial matches
            const phrasePattern = new RegExp(`\\b${detection.tagName?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            cleanedContent = entryData.content
              .replace(phrasePattern, '')
              .trim()
              .replace(/^\s*[,.!?;:]*\s*/, '') // Remove leading punctuation/space
              .replace(/\s*[,.!?;:]*\s*$/, '') // Remove trailing punctuation/space
              .replace(/\s+/g, ' '); // Normalize whitespace
          }
          
          if (cleanedContent.length > 0) {
            entryData.content = cleanedContent;
          } else {
            // If content is just the activation phrase, use a default message
            entryData.content = 'Secret tag activated via voice command.';
          }
        }
      } catch (error) {
        logger.error('Error during manual secret tag detection:', error);
        // Continue with normal entry creation if detection fails
      }
    }
    
    // Try to use secret tag if one is currently active
    const targetSecretTagId = secretTagManager.getActiveSecretTagForNewEntry();
    
    if (targetSecretTagId && zeroKnowledgeEncryption.isPhraseKeyLoaded(targetSecretTagId)) {
      return this.createSecretTagEntry(entryData, targetSecretTagId);
    } else {
      if (targetSecretTagId && !zeroKnowledgeEncryption.isPhraseKeyLoaded(targetSecretTagId)) {
        logger.warn(`Entry should use secret tag ${targetSecretTagId} but phrase encryption not ready, creating public entry`);
      }
      // Fall back to public entry
      return this.createPublicEntry(entryData);
    }
  }

  /**
   * Create a public (non-encrypted) journal entry
   */
  private async createPublicEntry(entryData: Omit<JournalEntryData, 'id'>): Promise<JournalEntryData> {
    try {
      const response = await JournalAPI.createEntry({
        title: entryData.title || '',
        content: entryData.content,
        entry_date: entryData.entry_date || new Date().toISOString(),
        audio_url: entryData.audio_url,
        tags: entryData.tags || [],
        secret_tag_id: null,
        secret_tag_hash: null,
      });
      
      logger.info('Created public journal entry');
      return response.data;
    } catch (error) {
      logger.error('Failed to create public journal entry:', error);
      throw new Error('Failed to create journal entry');
    }
  }

  /**
   * Create a secret tag (encrypted) journal entry
   */
  private async createSecretTagEntry(
    entryData: Omit<JournalEntryData, 'id'>, 
    secretTagId: string
  ): Promise<JournalEntryData> {
    if (!zeroKnowledgeEncryption.isPhraseKeyLoaded(secretTagId)) {
      throw new Error(`Secret tag encryption not loaded for tag: ${secretTagId}`);
    }

    try {
      // Encrypt the content with tag-specific key
      const encrypted = await zeroKnowledgeEncryption.encryptEntryWithSecretPhrase(
        entryData.content, 
        secretTagId
      );
      
      // Get server-side tag hashes for this tag
      const activeTagHashes = await secretTagManager.getActiveTagHashes();
      const secretTags = await secretTagManager.getAllSecretTags();
      const targetTag = secretTags.find(tag => tag.id === secretTagId);
      
      if (!targetTag) {
        throw new Error(`Secret tag not found: ${secretTagId}`);
      }
      
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
        secret_tag_id: secretTagId,
        secret_tag_hash: targetTag.serverTagHash,
      });
      
      logger.info(`Created secret tag journal entry with tag: ${secretTagId}`);
      
      // Return with decrypted content for immediate use
      return {
        ...response.data,
        content: entryData.content, // Return original content for UI
        secret_tag_id: secretTagId,
      };
    } catch (error) {
      logger.error('Failed to create secret tag journal entry:', error);
      throw new Error('Failed to create encrypted journal entry');
    }
  }

  /**
   * Create a secret tag entry without encryption (when encryption keys not ready)
   */
  private async createSecretTagEntryUnencrypted(
    entryData: Omit<JournalEntryData, 'id'>, 
    secretTagId: string
  ): Promise<JournalEntryData> {
    try {
      // Get server-side tag hashes for this tag
      const secretTags = await secretTagManager.getAllSecretTags();
      const targetTag = secretTags.find(tag => tag.id === secretTagId);
      
      if (!targetTag) {
        throw new Error(`Secret tag not found: ${secretTagId}`);
      }
      
      // Create the entry with secret tag metadata but unencrypted content
      const response = await JournalAPI.createEntry({
        title: entryData.title || '',
        content: entryData.content, // Store unencrypted for now
        entry_date: entryData.entry_date || new Date().toISOString(),
        audio_url: entryData.audio_url,
        tags: entryData.tags || [],
        secret_tag_id: secretTagId,
        secret_tag_hash: targetTag.serverTagHash,
      });
      
      logger.info(`Created secret tag journal entry (unencrypted) with tag: ${secretTagId}`);
      
      return {
        ...response.data,
        secret_tag_id: secretTagId,
      };
    } catch (error) {
      logger.error('Failed to create secret tag journal entry (unencrypted):', error);
      throw new Error('Failed to create journal entry with secret tag');
    }
  }

  /**
   * Get journal entries, automatically filtering and decrypting based on active secret tags
   */
  async getEntries(options: {
    page?: number;
    limit?: number;
    tags?: string[];
    entry_date?: string;
    includeAllSecretTags?: boolean;
  } = {}): Promise<JournalEntryData[]> {
    try {
      // Get active tag hashes for server-side filtering
      const activeTagHashes = await secretTagManager.getActiveTagHashes();
      
      // Fetch entries with secret tag filtering
      const response = await JournalAPI.getEntries({
        ...options,
        secret_tag_hashes: activeTagHashes,
        include_public: true, // Always include public entries
      });
      
      const entries = response.data.entries || response.data;
      
      // Filter and decrypt entries based on active secret tags
      return this.processEntries(entries);
    } catch (error) {
      logger.error('Failed to get journal entries:', error);
      throw new Error('Failed to retrieve journal entries');
    }
  }

  /**
   * Get a specific journal entry by ID, automatically decrypting if it's a secret tag entry
   */
  async getEntry(id: number): Promise<JournalEntryData | null> {
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
   * Process entries: filter based on active secret tags and decrypt if necessary
   */
  private async processEntries(entries: any[]): Promise<JournalEntryData[]> {
    // Filter entries based on active secret tags
    const filteredEntries = secretTagManager.filterEntriesByActiveTags(entries);
    
    // Decrypt secret tag entries if we have the keys loaded
    const processedEntries = await Promise.all(
      filteredEntries.map(async (entry) => {
        if (entry.secret_tag_id && secretTagManager.isSecretTagActive(entry.secret_tag_id)) {
          return this.decryptSecretTagEntry(entry);
        }
        return entry;
      })
    );
    
    return processedEntries.filter(entry => entry !== null) as JournalEntryData[];
  }

  /**
   * Decrypt a secret tag journal entry
   */
  private async decryptSecretTagEntry(entry: any): Promise<JournalEntryData | null> {
    const secretTagId = entry.secret_tag_id;
    
    if (!secretTagId) {
      logger.warn('Entry has no secret tag ID, cannot decrypt');
      return null;
    }

    if (!zeroKnowledgeEncryption.isPhraseKeyLoaded(secretTagId)) {
      logger.warn(`Cannot decrypt entry: secret tag key not loaded for ${secretTagId}`);
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
        encryptedKey: entry.encrypted_key || '',
        iv: entry.encryption_iv,
        salt: entry.encryption_salt,
        algorithm: entry.encryption_algorithm || 'AES-GCM',
        wrapIv: entry.encryption_wrap_iv || entry.encryption_iv,
      };

      const decryptedContent = await zeroKnowledgeEncryption.decryptEntryWithSecretPhrase(
        encrypted, 
        secretTagId
      );
      
      return {
        ...entry,
        content: decryptedContent,
      };
    } catch (error) {
      logger.error('Failed to decrypt secret tag journal entry:', error);
      // Return entry with encrypted content as fallback
      return {
        ...entry,
        content: '[Encrypted Content - Unable to Decrypt]',
      };
    }
  }

  /**
   * Search journal entries (only in accessible entries)
   */
  async searchEntries(query: string): Promise<JournalEntryData[]> {
    try {
      // Get active tag hashes for filtering
      const activeTagHashes = await secretTagManager.getActiveTagHashes();
      
      const response = await JournalAPI.searchEntries(query, {
        secret_tag_hashes: activeTagHashes,
        include_public: true,
      });
      
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
  async updateEntry(id: number, updates: Partial<JournalEntryData>): Promise<JournalEntryData> {
    try {
      // For now, use the regular update API
      // TODO: Add support for updating encrypted content and changing secret tags
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
  async deleteEntry(id: number): Promise<void> {
    try {
      await JournalAPI.deleteEntry(id);
      logger.info(`Deleted journal entry ${id}`);
    } catch (error) {
      logger.error(`Failed to delete journal entry ${id}:`, error);
      throw new Error('Failed to delete journal entry');
    }
  }
}

// Export singleton instance
export const encryptedJournalService = new EncryptedJournalService();
export default encryptedJournalService; 