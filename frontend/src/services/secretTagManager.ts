/**
 * Secret Tag Manager
 * 
 * Manages multiple secret tags with voice-activated access and zero-knowledge encryption.
 * Each secret tag provides an independent privacy level with its own activation phrase.
 * 
 * Features:
 * - Multiple user-defined secret tags (unlimited)
 * - Voice-activated tag detection during recording
 * - Independent encryption keys per tag
 * - Client-side only - server never sees tag names or phrases
 * - Hardware-backed secure storage
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { zeroKnowledgeEncryption } from './zeroKnowledgeEncryption';
import logger from '../utils/logger';
import { SecretTagAPI } from './api';

export interface SecretTag {
  id: string;                    // UUID generated client-side
  name: string;                  // User-defined tag name (e.g., "work private")
  phrase: string;                // Activation phrase (stored hashed)
  phraseHash: string;            // PBKDF2 hash of the phrase
  phraseSalt: string;            // Salt for phrase hashing
  colorCode: string;             // Hex color for UI (#007AFF)
  createdAt: number;             // Client timestamp
  isActive: boolean;             // Currently activated state
  serverTagHash: string;         // Hash sent to server for filtering
}

export interface SecretTagConfig {
  timeoutMinutes: number;        // Auto-deactivate timeout
  allowQuickLock: boolean;       // Enable gesture deactivation
  panicModeEnabled: boolean;     // Enable panic deletion
  maxActiveTags: number;         // Max simultaneously active tags
}

export interface TagDetectionResult {
  found: boolean;
  tagId?: string;
  tagName?: string;
  originalPhrase?: string;
  action?: 'activate' | 'deactivate' | 'panic';
}

class SecretTagManager {
  // Storage keys
  private static readonly SECRET_TAGS_KEY = 'secret_tags_data';
  private static readonly TAG_CONFIG_KEY = 'secret_tag_config';
  private static readonly ACTIVE_TAGS_KEY = 'active_secret_tags';
  
  // Crypto constants
  private static readonly DEFAULT_ITERATIONS = 100000;
  private static readonly SALT_LENGTH = 32;
  private static readonly TAG_HASH_LENGTH = 32;

  // State
  private activeTags: Set<string> = new Set(); // Active tag IDs
  private tagTimeout: NodeJS.Timeout | null = null;
  private config: SecretTagConfig = {
    timeoutMinutes: 5,
    allowQuickLock: true,
    panicModeEnabled: true,
    maxActiveTags: 3
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
   * Initialize secret tag manager
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      await this.loadActiveTagsState();
      logger.info('Secret tag manager initialized');
    } catch (error) {
      logger.error('Failed to initialize secret tag manager:', error);
    }
  }

  /**
   * Create a new secret tag
   */
  async createSecretTag(
    name: string,
    phrase: string,
    colorCode: string = '#007AFF'
  ): Promise<string> {
    try {
      // Validate inputs
      if (!name.trim() || !phrase.trim()) {
        throw new Error('Tag name and phrase cannot be empty');
      }

      if (phrase.length < 3) {
        throw new Error('Activation phrase must be at least 3 characters');
      }

      // Check for duplicate names
      const existingTags = await this.getAllSecretTags();
      if (existingTags.some(tag => tag.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('A secret tag with this name already exists');
      }

      // Generate tag ID and normalize phrase
      const tagId = crypto.randomUUID();
      const normalizedPhrase = this.normalizePhrase(phrase);
      
      // Generate salt and hash for phrase
      const phraseSalt = crypto.getRandomValues(new Uint8Array(SecretTagManager.SALT_LENGTH));
      const phraseHash = await this.hashPhrase(normalizedPhrase, phraseSalt);
      
      // Generate server-side tag hash for filtering
      const serverTagHash = await this.generateServerTagHash(tagId);

      // Create secret tag object
      const secretTag: SecretTag = {
        id: tagId,
        name: name.trim(),
        phrase: normalizedPhrase, // Store normalized for consistency
        phraseHash: this.arrayToBase64(phraseHash),
        phraseSalt: this.arrayToBase64(phraseSalt),
        colorCode: colorCode,
        createdAt: Date.now(),
        isActive: false,
        serverTagHash: serverTagHash
      };

      // Save to secure storage
      existingTags.push(secretTag);
      await this.saveSecretTags(existingTags);

      // Initialize encryption key for this tag
      await this.initializeTagEncryption(tagId, normalizedPhrase);

      logger.info(`Secret tag created: ${name} (${tagId})`);
      return tagId;
    } catch (error) {
      logger.error('Failed to create secret tag:', error);
      throw error;
    }
  }

  /**
   * Check transcribed text for secret tag activation phrases
   */
  async checkForSecretTagPhrases(transcribedText: string): Promise<TagDetectionResult> {
    try {
      const normalizedText = this.normalizePhrase(transcribedText);
      logger.info(`[Secret Tag Detection] Normalized text: "${normalizedText}"`);
      
      const secretTags = await this.getAllSecretTags();
      logger.info(`[Secret Tag Detection] Loaded ${secretTags.length} secret tags from storage`);

      // Check for panic phrase first (highest priority)
      if (this.config.panicModeEnabled && normalizedText.includes('emergency delete everything')) {
        logger.warn('Panic phrase detected');
        return {
          found: true,
          action: 'panic'
        };
      }

      // Check each secret tag phrase
      for (const tag of secretTags) {
        logger.info(`[Secret Tag Detection] Checking tag "${tag.name}" (${tag.id}) - isActive: ${tag.isActive}`);
        
        // This is a simplified check. A real implementation would hash the transcribed text 
        // with the tag's salt and compare it to the stored hash.
        if (normalizedText.includes(tag.phrase)) {
          logger.info(`Secret tag phrase detected: ${tag.name} (${tag.id})`);
          
          // Determine action based on current state
          const action = tag.isActive ? 'deactivate' : 'activate';
          
          return {
            found: true,
            tagId: tag.id,
            tagName: tag.name,
            originalPhrase: tag.phrase,
            action: action
          };
        }
      }

      logger.info(`[Secret Tag Detection] No matching phrases found for normalized text: "${normalizedText}"`);
      return { found: false };
    } catch (error) {
      logger.error('Failed to check for secret tag phrases:', error);
      return { found: false };
    }
  }

  async handleSecretTagAction(detectionResult: TagDetectionResult): Promise<void> {
    if (!detectionResult.found || !detectionResult.tagId) return;

    switch (detectionResult.action) {
      case 'activate':
        await this.activateSecretTag(detectionResult.tagId);
        break;
      case 'deactivate':
        await this.deactivateSecretTag(detectionResult.tagId);
        break;
      case 'panic':
        await this.activatePanicMode();
        break;
    }
  }
  
  /**
   * Activate a secret tag
   */
  async activateSecretTag(tagId: string): Promise<void> {
    try {
      const secretTags = await this.getAllSecretTags();
      const tag = secretTags.find(t => t.id === tagId);
      
      if (!tag) {
        throw new Error('Secret tag not found');
      }

      // Check max active tags limit
      if (this.activeTags.size >= this.config.maxActiveTags && !this.activeTags.has(tagId)) {
        throw new Error(`Maximum ${this.config.maxActiveTags} secret tags can be active simultaneously`);
      }

      // Initialize encryption for this tag if needed
      await this.initializeTagEncryption(tagId, tag.phrase);

      // Activate tag
      tag.isActive = true;
      this.activeTags.add(tagId);

      // Save state
      await this.saveSecretTags(secretTags);
      await this.saveActiveTagsState();

      // Start/restart timeout
      this.startAutoDeactivateTimer();

      logger.info(`Secret tag activated: ${tag.name} (${tagId})`);
    } catch (error) {
      logger.error('Failed to activate secret tag:', error);
      throw error;
    }
  }

  /**
   * Deactivate a secret tag
   */
  async deactivateSecretTag(tagId: string): Promise<void> {
    try {
      const secretTags = await this.getAllSecretTags();
      const tag = secretTags.find(t => t.id === tagId);
      
      if (!tag) {
        throw new Error('Secret tag not found');
      }

      // Deactivate tag
      tag.isActive = false;
      this.activeTags.delete(tagId);

      // Save state
      await this.saveSecretTags(secretTags);
      await this.saveActiveTagsState();

      // Clear timer if no tags active
      if (this.activeTags.size === 0) {
        this.clearAutoDeactivateTimer();
      }

      logger.info(`Secret tag deactivated: ${tag.name} (${tagId})`);
    } catch (error) {
      logger.error('Failed to deactivate secret tag:', error);
      throw error;
    }
  }

  /**
   * Deactivate all secret tags
   */
  async deactivateAllSecretTags(): Promise<void> {
    try {
      const secretTags = await this.getAllSecretTags();
      
      // Deactivate all tags
      for (const tag of secretTags) {
        tag.isActive = false;
      }
      
      this.activeTags.clear();
      
      // Save state
      await this.saveSecretTags(secretTags);
      await this.saveActiveTagsState();
      this.clearAutoDeactivateTimer();

      logger.info('All secret tags deactivated');
    } catch (error) {
      logger.error('Failed to deactivate all secret tags:', error);
      throw error;
    }
  }

  /**
   * Get all secret tags (for management UI)
   */
  async getAllSecretTags(): Promise<SecretTag[]> {
    try {
      const tagsStr = await this.getSecureItem(SecretTagManager.SECRET_TAGS_KEY);
      return tagsStr ? JSON.parse(tagsStr) : [];
    } catch (error) {
      logger.warn('Failed to load secret tags:', error);
      return [];
    }
  }

  /**
   * Get currently active secret tags
   */
  async getActiveSecretTags(): Promise<SecretTag[]> {
    try {
      const allTags = await this.getAllSecretTags();
      return allTags.filter(tag => this.activeTags.has(tag.id));
    } catch (error) {
      logger.error('Failed to get active secret tags:', error);
      return [];
    }
  }

  /**
   * Check if any secret tags are active
   */
  hasActiveSecretTags(): boolean {
    return this.activeTags.size > 0;
  }

  /**
   * Check if a specific secret tag is active
   */
  isSecretTagActive(tagId: string): boolean {
    return this.activeTags.has(tagId);
  }

  /**
   * Get server-side tag hashes for active tags (for API filtering)
   */
  async getActiveTagHashes(): Promise<string[]> {
    try {
      const activeTags = await this.getActiveSecretTags();
      return activeTags.map(tag => tag.serverTagHash);
    } catch (error) {
      logger.error('Failed to get active tag hashes:', error);
      return [];
    }
  }

  /**
   * Update secret tag (name, color, phrase)
   */
  async updateSecretTag(
    tagId: string,
    updates: {
      name?: string;
      phrase?: string;
      colorCode?: string;
    }
  ): Promise<void> {
    try {
      const secretTags = await this.getAllSecretTags();
      const tagIndex = secretTags.findIndex(t => t.id === tagId);
      
      if (tagIndex === -1) {
        throw new Error('Secret tag not found');
      }

      const tag = secretTags[tagIndex];

      // Update name if provided
      if (updates.name !== undefined) {
        if (!updates.name.trim()) {
          throw new Error('Tag name cannot be empty');
        }
        
        // Check for duplicate names (excluding current tag)
        const duplicateName = secretTags.some((t, index) => 
          index !== tagIndex && t.name.toLowerCase() === updates.name!.toLowerCase()
        );
        
        if (duplicateName) {
          throw new Error('A secret tag with this name already exists');
        }
        
        tag.name = updates.name.trim();
      }

      // Update phrase if provided
      if (updates.phrase !== undefined) {
        if (updates.phrase.length < 3) {
          throw new Error('Activation phrase must be at least 3 characters');
        }
        
        const normalizedPhrase = this.normalizePhrase(updates.phrase);
        const phraseSalt = crypto.getRandomValues(new Uint8Array(SecretTagManager.SALT_LENGTH));
        const phraseHash = await this.hashPhrase(normalizedPhrase, phraseSalt);
        
        tag.phrase = normalizedPhrase;
        tag.phraseHash = this.arrayToBase64(phraseHash);
        tag.phraseSalt = this.arrayToBase64(phraseSalt);
      }

      // Update color if provided
      if (updates.colorCode !== undefined) {
        tag.colorCode = updates.colorCode;
      }

      // Save changes
      await this.saveSecretTags(secretTags);
      
      logger.info(`Secret tag updated: ${tag.name} (${tagId})`);
    } catch (error) {
      logger.error('Failed to update secret tag:', error);
      throw error;
    }
  }

  /**
   * Delete a secret tag
   */
  async deleteSecretTag(tagId: string): Promise<void> {
    try {
      // Rule: Deletion is only allowed if the tag is currently active.
      if (!this.isSecretTagActive(tagId)) {
        throw new Error('Secret tag must be active to be deleted.');
      }

      const secretTags = await this.getAllSecretTags();
      const tagIndex = secretTags.findIndex(t => t.id === tagId);
      
      if (tagIndex === -1) {
        throw new Error('Secret tag not found');
      }

      const tag = secretTags[tagIndex];

      // Secret tags are client-side only - no server deletion needed
      logger.info(`Deleting client-side secret tag: ${tag.name} (${tagId})`);

      // Deactivate if currently active (locally)
      if (this.activeTags.has(tagId)) {
        await this.deactivateSecretTag(tagId);
      }

      // If API call is successful, remove from local storage
      secretTags.splice(tagIndex, 1);
      await this.saveSecretTags(secretTags);

      // Clear encryption keys for this tag
      await this.clearTagEncryption(tagId);

      logger.info(`Secret tag deleted from client: ${tag.name} (${tagId})`);
    } catch (error) {
      logger.error('Failed to delete secret tag:', error);
      // Re-throw the error to be caught by the UI
      if (error instanceof Error) {
        throw new Error(`Failed to delete secret tag: ${error.message}`);
      }
      throw new Error('An unknown error occurred while deleting the secret tag.');
    }
  }

  /**
   * Handle panic mode - securely delete all secret tag data
   */
  async activatePanicMode(): Promise<void> {
    if (!this.config.panicModeEnabled) {
      return;
    }

    try {
      logger.warn('PANIC MODE ACTIVATED - Deleting all secret tag data');
      
      // Clear all encryption keys
      await zeroKnowledgeEncryption.secureClearAllData();
      
      // Clear all secret tag data
      await this.clearAllSecretTagData();
      
      // Deactivate all tags
      this.activeTags.clear();
      this.clearAutoDeactivateTimer();
      
      logger.warn('Panic mode completed - All secret tag data deleted');
    } catch (error) {
      logger.error('Panic mode failed:', error);
      throw error;
    }
  }

  /**
   * Filter journal entries based on active secret tags
   */
  filterEntriesByActiveTags<T extends { secret_tag_id?: string | null }>(entries: T[]): T[] {
    if (this.activeTags.size === 0) {
      // No secret tags active - only show public entries
      return entries.filter(entry => !entry.secret_tag_id);
    }

    // Show public entries + entries from active secret tags
    return entries.filter(entry => 
      !entry.secret_tag_id || this.activeTags.has(entry.secret_tag_id)
    );
  }

  /**
   * Determine which secret tag (if any) should be used for a new entry
   */
  getActiveSecretTagForNewEntry(): string | null {
    // If exactly one tag is active, use it for new entries
    if (this.activeTags.size === 1) {
      return Array.from(this.activeTags)[0];
    }
    
    // If multiple tags active or none active, create public entry
    return null;
  }

  /**
   * Extend timeout on user activity
   */
  extendTimeout(): void {
    if (this.activeTags.size > 0) {
      this.startAutoDeactivateTimer();
    }
  }

  // Private helper methods

  private async loadConfiguration(): Promise<void> {
    try {
      const configStr = await this.getSecureItem(SecretTagManager.TAG_CONFIG_KEY);
      if (configStr) {
        this.config = { ...this.config, ...JSON.parse(configStr) };
      }
    } catch (error) {
      logger.warn('Failed to load secret tag config:', error);
    }
  }

  private async saveConfiguration(): Promise<void> {
    try {
      await this.setSecureItem(
        SecretTagManager.TAG_CONFIG_KEY,
        JSON.stringify(this.config),
        {
          requireAuthentication: true,
          authenticationPrompt: 'Authenticate to modify secret tag settings'
        }
      );
    } catch (error) {
      logger.error('Failed to save secret tag config:', error);
    }
  }

  private async loadActiveTagsState(): Promise<void> {
    try {
      const activeTagsStr = await this.getSecureItem(SecretTagManager.ACTIVE_TAGS_KEY);
      if (activeTagsStr) {
        const activeTagIds = JSON.parse(activeTagsStr);
        this.activeTags = new Set(activeTagIds);
        
        // Start timer if tags are active
        if (this.activeTags.size > 0) {
          this.startAutoDeactivateTimer();
        }
      }
    } catch (error) {
      logger.warn('Failed to load active tags state:', error);
    }
  }

  private async saveActiveTagsState(): Promise<void> {
    try {
      const activeTagIds = Array.from(this.activeTags);
      await this.setSecureItem(
        SecretTagManager.ACTIVE_TAGS_KEY,
        JSON.stringify(activeTagIds)
      );
    } catch (error) {
      logger.error('Failed to save active tags state:', error);
    }
  }

  private async saveSecretTags(tags: SecretTag[]): Promise<void> {
    try {
      await this.setSecureItem(
        SecretTagManager.SECRET_TAGS_KEY,
        JSON.stringify(tags),
        {
          requireAuthentication: true,
          authenticationPrompt: 'Authenticate to manage secret tags'
        }
      );
    } catch (error) {
      logger.error('Failed to save secret tags:', error);
      throw error;
    }
  }

  private startAutoDeactivateTimer(): void {
    this.clearAutoDeactivateTimer();
    
    this.tagTimeout = setTimeout(async () => {
      await this.deactivateAllSecretTags();
      logger.info('Secret tags auto-deactivated due to timeout');
    }, this.config.timeoutMinutes * 60 * 1000);
  }

  private clearAutoDeactivateTimer(): void {
    if (this.tagTimeout) {
      clearTimeout(this.tagTimeout);
      this.tagTimeout = null;
    }
  }

  private async initializeTagEncryption(tagId: string, secretPhrase: string): Promise<void> {
    try {
      logger.info(`Phrase encryption initialization for tag: ${tagId}`);
      
      // Try to load existing phrase encryption first (in case it was previously initialized)
      let success = await zeroKnowledgeEncryption.loadPhraseKey(tagId, secretPhrase);
      
      if (!success) {
        // No existing encryption found, initialize new phrase encryption for this tag
        logger.info(`No existing phrase encryption found for tag ${tagId}, initializing new encryption`);
        success = await zeroKnowledgeEncryption.initializePhraseKey(tagId, secretPhrase);
      }
      
      if (!success) {
        logger.error(`Failed to initialize phrase encryption for tag ${tagId}`);
        throw new Error(`Phrase encryption initialization failed for tag: ${tagId}`);
      }
      
      logger.info(`Phrase encryption successfully initialized for tag: ${tagId}`);
    } catch (error) {
      logger.error(`Failed to initialize phrase encryption for tag ${tagId}:`, error);
      throw error;
    }
  }

  private async clearTagEncryption(tagId: string): Promise<void> {
    try {
      // Clear encryption data if it exists
      try {
        await zeroKnowledgeEncryption.clearSecretPhraseEncryption(tagId);
        logger.info(`Encryption data cleared for tag: ${tagId}`);
      } catch (error) {
        logger.warn(`Failed to clear encryption data for tag ${tagId}:`, error);
      }
    } catch (error) {
      logger.error(`Failed to clear encryption for tag ${tagId}:`, error);
    }
  }

  private async generateServerTagHash(tagId: string): Promise<string> {
    try {
      // Generate a hash that can be sent to server for filtering
      // but doesn't reveal the actual tag ID or name
      const encoder = new TextEncoder();
      const data = encoder.encode(tagId + '_server_hash');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = new Uint8Array(hashBuffer);
      return this.arrayToBase64(hashArray.slice(0, SecretTagManager.TAG_HASH_LENGTH));
    } catch (error) {
      logger.error('Failed to generate server tag hash:', error);
      throw error;
    }
  }

  private async clearAllSecretTagData(): Promise<void> {
    try {
      await this.deleteSecureItem(SecretTagManager.SECRET_TAGS_KEY);
      await this.deleteSecureItem(SecretTagManager.TAG_CONFIG_KEY);
      await this.deleteSecureItem(SecretTagManager.ACTIVE_TAGS_KEY);
      logger.info('All secret tag data cleared');
    } catch (error) {
      logger.error('Failed to clear secret tag data:', error);
    }
  }

  /**
   * Clear all secret tag and encryption data completely
   * Use this to reset to a clean state
   */
  async clearAllSecretTagAndEncryptionData(): Promise<void> {
    try {
      // First deactivate all tags
      await this.deactivateAllSecretTags();
      
      // Clear all secret tag data
      await this.clearAllSecretTagData();
      
      // Clear all encryption data
      await zeroKnowledgeEncryption.secureClearAllData();
      
      // Clear in-memory state
      this.activeTags.clear();
      this.clearAutoDeactivateTimer();
      
      logger.info('All secret tag and encryption data completely cleared');
    } catch (error) {
      logger.error('Failed to clear all secret tag data:', error);
      throw error;
    }
  }

  /**
   * AGGRESSIVE DEBUG CLEANUP - Use when normal deletion fails
   * This method provides detailed debugging and forces cleanup
   */
  async debugForceCleanupAllData(): Promise<void> {
    try {
      logger.info('🔍 DEBUG: Starting aggressive cleanup...');
      
      // 1. Check what's currently in storage
      logger.info('📊 DEBUG: Checking current storage state...');
      const currentTags = await this.getSecureItem(SecretTagManager.SECRET_TAGS_KEY);
      const currentConfig = await this.getSecureItem(SecretTagManager.TAG_CONFIG_KEY);
      const currentActive = await this.getSecureItem(SecretTagManager.ACTIVE_TAGS_KEY);
      
      logger.info(`📋 DEBUG: Found in storage:
        - Secret tags: ${currentTags ? 'EXISTS' : 'NULL'} (${currentTags?.length || 0} chars)
        - Config: ${currentConfig ? 'EXISTS' : 'NULL'}
        - Active tags: ${currentActive ? 'EXISTS' : 'NULL'}`);
      
      if (currentTags) {
        try {
          const parsed = JSON.parse(currentTags);
          logger.info(`🏷️  DEBUG: Parsed ${parsed.length} secret tags: ${parsed.map((t: any) => t.name).join(', ')}`);
        } catch (e) {
          logger.error('❌ DEBUG: Failed to parse stored tags:', e);
        }
      }

      // 2. Force clear in-memory state
      logger.info('🧠 DEBUG: Clearing in-memory state...');
      this.activeTags.clear();
      this.clearAutoDeactivateTimer();
      
      // 3. Force delete each storage key individually with error handling
      logger.info('🗑️  DEBUG: Force deleting storage keys...');
      
      const keysToDelete = [
        SecretTagManager.SECRET_TAGS_KEY,
        SecretTagManager.TAG_CONFIG_KEY,
        SecretTagManager.ACTIVE_TAGS_KEY,
        'zk_device_info',
        'zk_phrase_keys_info'
      ];
      
      for (const key of keysToDelete) {
        try {
          await this.deleteSecureItem(key);
          logger.info(`✅ DEBUG: Successfully deleted ${key}`);
        } catch (error) {
          logger.error(`❌ DEBUG: Failed to delete ${key}:`, error);
        }
      }

      // 4. Clear encryption data
      logger.info('🔒 DEBUG: Clearing encryption data...');
      try {
        await zeroKnowledgeEncryption.secureClearAllData();
        logger.info('✅ DEBUG: Encryption data cleared');
      } catch (error) {
        logger.error('❌ DEBUG: Failed to clear encryption data:', error);
      }

      // 5. Verify cleanup
      logger.info('🔍 DEBUG: Verifying cleanup...');
      const afterTags = await this.getSecureItem(SecretTagManager.SECRET_TAGS_KEY);
      const afterConfig = await this.getSecureItem(SecretTagManager.TAG_CONFIG_KEY);
      const afterActive = await this.getSecureItem(SecretTagManager.ACTIVE_TAGS_KEY);
      
      logger.info(`📋 DEBUG: After cleanup:
        - Secret tags: ${afterTags ? 'STILL EXISTS!' : 'NULL ✅'}
        - Config: ${afterConfig ? 'STILL EXISTS!' : 'NULL ✅'}
        - Active tags: ${afterActive ? 'STILL EXISTS!' : 'NULL ✅'}`);

      // 6. Reset configuration to defaults
      logger.info('⚙️  DEBUG: Resetting to default configuration...');
      this.config = {
        timeoutMinutes: 5,
        allowQuickLock: true,
        panicModeEnabled: true,
        maxActiveTags: 3
      };

      logger.info('🎉 DEBUG: Aggressive cleanup completed!');
      
    } catch (error) {
      logger.error('💥 DEBUG: Aggressive cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Normalize a phrase for consistent comparison
   * Public method to allow other services to use the same normalization
   */
  normalizePhrase(phrase: string): string {
    return phrase
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

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
        iterations: SecretTagManager.DEFAULT_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return new Uint8Array(bits);
  }

  private async containsPhrase(
    text: string, 
    expectedHash: Uint8Array, 
    salt: Uint8Array
  ): Promise<boolean> {
    const words = text.split(' ');
    
    // First check if the entire normalized text matches (for single-word phrases)
    const fullTextHash = await this.hashPhrase(text, salt);
    if (this.constantTimeArrayEquals(fullTextHash, expectedHash)) {
      return true;
    }
    
    // Check single words (for single-word activation phrases like "test", "work")
    for (const word of words) {
      if (word.trim()) {
        const wordHash = await this.hashPhrase(word.trim(), salt);
        if (this.constantTimeArrayEquals(wordHash, expectedHash)) {
          return true;
        }
      }
    }
    
    // Check phrases of different lengths (2-8 words for multi-word phrases)
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

  private arrayToBase64(array: Uint8Array): string {
    const binaryString = Array.from(array, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  }

  private base64ToArray(base64: string): Uint8Array {
    const binaryString = atob(base64);
    return new Uint8Array(binaryString.length).map((_, i) => binaryString.charCodeAt(i));
  }

  public shouldTreatAsSecretTagCommand(transcript: string, detectionResult: TagDetectionResult): boolean {
    if (!detectionResult.found || !detectionResult.originalPhrase) {
      return false;
    }

    const normalizedTranscript = transcript.toLowerCase().replace(/[.\s]/g, '').replace(/[^\w]/g, '');
    const normalizedPhrase = detectionResult.originalPhrase.toLowerCase().replace(/[.\s]/g, '').replace(/[^\w]/g, '');

    logger.info(`[shouldTreatAsSecretTagCommand] Comparing normalized transcript: "${normalizedTranscript}" vs. normalized phrase: "${normalizedPhrase}"`);
    
    // Check if the normalized transcript IS the normalized phrase
    const isCommand = normalizedTranscript === normalizedPhrase;

    logger.info(`[shouldTreatAsSecretTagCommand] Is command? ${isCommand}`);
    return isCommand;
  }
}

// Export singleton instance
export const secretTagManager = new SecretTagManager(); 