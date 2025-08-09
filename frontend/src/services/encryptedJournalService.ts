/**
 * Encrypted Journal Service
 * 
 * High-level service that integrates phrase-based zero-knowledge encryption with journal operations.
 * Handles transparent encryption/decryption for secret tag entries using secret phrases directly as keys.
 */

import { JournalAPI } from './api';
import { zeroKnowledgeEncryption } from './zeroKnowledgeEncryption';
import { tagManager } from './tagManager';
import logger from '../utils/logger';
import { clientEncryption } from './clientEncryption';
import { areSecretTagsEnabled } from '../config/featureFlags';

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
   * Reusable logic to detect and handle secret tag phrases in content.
   * This can be called from both create and update operations.
   * @returns {Promise<{
   *   processedContent: string;
   *   detectedTagId: string | null;
   * }>}
   */
  private async detectAndProcessSecretPhrase(
    content: string,
    existingTagId: string | null = null
  ): Promise<{ processedContent: string; detectedTagId: string | null }> {
    if (!content) {
      return { processedContent: content, detectedTagId: existingTagId };
    }

    try {
      const detection = await tagManager.checkForSecretTagPhrases(content);
      if (detection.found && detection.tagId && detection.action === 'activate') {
        logger.info(`Secret tag activation phrase detected in content for tag: ${detection.tagName} (${detection.tagId})`);
        
        // Activate the tag
        await tagManager.activateSecretTag(detection.tagId);
        
        // Clean the activation phrase from the content
        let cleanedContent = content;
        if (detection.tagName) {
          // Create a regex to find the phrase (case-insensitive) and remove it
          const phraseRegex = new RegExp(detection.tagName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
          cleanedContent = content.replace(phraseRegex, '').trim();
        }
        
        return {
          processedContent: cleanedContent,
          detectedTagId: detection.tagId,
        };
      }
    } catch (error) {
      logger.error('Error during secret phrase detection, proceeding with original content.', error);
    }

    // If no phrase is detected, return original content and tag ID
    return { processedContent: content, detectedTagId: existingTagId };
  }

  /**
   * Create a journal entry, automatically encrypting based on active secret tags
   */
  async createEntry(
    entryData: Omit<JournalEntryData, 'id'>,
    options: CreateEntryOptions = {}
  ): Promise<JournalEntryData> {
    const { secretTagId, forcePublic, detectedTagId: optionDetectedTagId } = options;
    
    // Process content for secret phrases unless forced public
    const { processedContent, detectedTagId: manuallyDetectedTagId } = forcePublic
      ? { processedContent: entryData.content, detectedTagId: null }
      : await this.detectAndProcessSecretPhrase(entryData.content, null);

    const finalEntryData = {
      ...entryData,
      content: processedContent,
    };
    
    // Determine the final secret tag to use for this entry
    const targetSecretTagId = secretTagId || optionDetectedTagId || manuallyDetectedTagId;

    // If secret tags feature is disabled, use per-user encryption path
    if (!areSecretTagsEnabled()) {
      return this.createPerUserEncryptedEntry(finalEntryData);
    }

    if (targetSecretTagId && zeroKnowledgeEncryption.isPhraseKeyLoaded(targetSecretTagId)) {
      return this.createSecretTagEntry(finalEntryData, targetSecretTagId);
    }

    if (targetSecretTagId && !zeroKnowledgeEncryption.isPhraseKeyLoaded(targetSecretTagId)) {
      logger.warn(`Entry should use secret tag ${targetSecretTagId} but phrase encryption not ready, creating public entry`);
    }
    // Fall back to public entry
    return this.createPublicEntry(finalEntryData);
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
        // Remove secret tag references in per-user encryption mode
      });
      
      logger.info('Created public journal entry');
      return response.data;
    } catch (error) {
      logger.error('Failed to create public journal entry:', error);
      throw new Error('Failed to create journal entry');
    }
  }

  /**
   * Create a per-user encrypted journal entry (no secret tags)
   */
  private async createPerUserEncryptedEntry(entryData: Omit<JournalEntryData, 'id'>): Promise<JournalEntryData> {
    try {
      const enc = await clientEncryption.encryptPerUser(entryData.content);
      const response = await JournalAPI.createEntry({
        title: entryData.title || '',
        content: '',
        entry_date: entryData.entry_date || new Date().toISOString(),
        audio_url: entryData.audio_url,
        tags: entryData.tags || [],
        encrypted_content: enc.encryptedContent,
        encryption_iv: enc.iv,
        encrypted_key: enc.wrappedKey,
        encryption_wrap_iv: enc.wrapIv,
        encryption_algorithm: enc.algorithm || 'AES-GCM',
      } as any);
      logger.info('Created per-user encrypted journal entry');
      return {
        ...response.data,
        content: entryData.content,
      };
    } catch (error) {
      logger.error('Failed to create per-user encrypted journal entry:', error);
      throw new Error('Failed to create encrypted journal entry');
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
      const activeTagHashes = await tagManager.getActiveSecretTags();
      const secretTags = await tagManager.getSecretTags();
      const targetTag = secretTags.find((tag: any) => tag.id === secretTagId);
      
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
        secret_tag_hash: targetTag.id,
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
      const secretTags = await tagManager.getSecretTags();
      const targetTag = secretTags.find((tag: any) => tag.id === secretTagId);
      
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
        secret_tag_hash: targetTag.id,
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
      // Get active secret tags for server-side filtering
      const activeTags = await tagManager.getActiveSecretTags();
      const activeTagHashes = activeTags.map((tag: any) => tag.id);
      
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
    // Filter entries based on active secret tags - for now just return all entries
    // TODO: Implement filtering logic in tagManager
    const filteredEntries = entries;
    
    // Decrypt secret tag entries if we have the keys loaded
    const activeTags = await tagManager.getActiveSecretTags();
    const activeTagIds = activeTags.map((tag: any) => tag.id);
    
    const processedEntries = await Promise.all(
      filteredEntries.map(async (entry: any) => {
        if (entry.secret_tag_id && activeTagIds.includes(entry.secret_tag_id)) {
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
      const activeTags = await tagManager.getActiveSecretTags();
      const activeTagHashes = activeTags.map((tag: any) => tag.id);
      
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
      // If content is being updated, check it for secret phrases
      if (typeof updates.content === 'string') {
        const { processedContent, detectedTagId } = await this.detectAndProcessSecretPhrase(updates.content);
        
        // Update the content with the cleaned version
        updates.content = processedContent;

        // Secret tags path if enabled
        if (areSecretTagsEnabled() && detectedTagId && zeroKnowledgeEncryption.isPhraseKeyLoaded(detectedTagId)) {
          logger.info(`Secret phrase detected during update. Encrypting entry ${id} with tag ${detectedTagId}.`);
          
          const encrypted = await zeroKnowledgeEncryption.encryptEntryWithSecretPhrase(processedContent, detectedTagId);
          const secretTags = await tagManager.getSecretTags();
          const targetTag = secretTags.find((tag: any) => tag.id === detectedTagId);

          if (!targetTag) {
            throw new Error(`Secret tag not found: ${detectedTagId}`);
          }
          
          const encryptedUpdatePayload = {
            ...updates,
            content: "", // Clear plaintext content for the backend
            encrypted_content: encrypted.encryptedContent,
            encrypted_key: encrypted.encryptedKey,
            iv: encrypted.iv,
            salt: encrypted.salt,
            algorithm: encrypted.algorithm,
            wrapIv: encrypted.wrapIv,
            secret_tag_id: detectedTagId,
            secret_tag_hash: targetTag.id,
          };
          
          const response = await JournalAPI.updateEntry(id, encryptedUpdatePayload);
          return {
            ...response.data,
            content: processedContent, // Return decrypted content for UI
          };
        }

        // Per-user encryption path when secret tags disabled
        if (!areSecretTagsEnabled()) {
          logger.info(`Updating entry ${id} with per-user encryption.`);
          const enc = await clientEncryption.encryptPerUser(processedContent);
          const encryptedUpdatePayload: any = {
            ...updates,
            content: '',
            encrypted_content: enc.encryptedContent,
            encryption_iv: enc.iv,
            encrypted_key: enc.wrappedKey,
            encryption_wrap_iv: enc.wrapIv,
            encryption_algorithm: enc.algorithm || 'AES-GCM',
          };
          const response = await JournalAPI.updateEntry(id, encryptedUpdatePayload);
          return { ...response.data, content: processedContent };
        }
      }
      
      // If no secret phrase was detected or encryption is not ready, perform a standard public update
      logger.info(`Updating public journal entry ${id}.`);
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
      await JournalAPI.deleteEntry(String(id));
      logger.info(`Deleted journal entry ${String(id)}`);
    } catch (error) {
      logger.error(`Failed to delete journal entry ${id}:`, error);
      throw new Error('Failed to delete journal entry');
    }
  }
}

// Export singleton instance
export const encryptedJournalService = new EncryptedJournalService();
export default encryptedJournalService; 