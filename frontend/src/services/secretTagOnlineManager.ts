/**
 * Secret Tag Online Manager
 * 
 * Server-side hash verification for maximum security.
 * 
 * Features:
 * - Server-only phrase verification using Argon2 hashes
 * - No persistent local storage of secrets
 * - Memory-only tag activation
 * - Used in "Online Mode" for travel and high-security scenarios
 * 
 * Security: Device appears completely normal when inspected.
 * No secret phrases or metadata stored locally.
 */

import { secretTagHashService } from './secretTagHashService';
import { SecretTag, SecretTagResponse } from '../types';
import logger from '../utils/logger';

export interface SecretTagV2 {
  id: string;                    // Server-generated UUID
  name: string;                  // User-defined tag name (e.g., "work private")
  colorCode: string;             // Hex color for UI (#007AFF)
  createdAt: string;             // Server timestamp
  isActive: boolean;             // Currently activated state (memory only)
}

export interface TagDetectionResult {
  found: boolean;
  tagId?: string;
  tagName?: string;
  action?: 'activate' | 'deactivate' | 'panic';
}

export interface SecretTagConfig {
  timeoutMinutes: number;        // Auto-deactivate timeout
  allowQuickLock: boolean;       // Enable gesture deactivation
  panicModeEnabled: boolean;     // Enable panic deletion
  maxActiveTags: number;         // Max simultaneously active tags
}

class SecretTagOnlineManager {
  // Memory-only state (never persisted)
  private activeTags: Set<string> = new Set(); // Active tag IDs
  private activeTagNames: Map<string, string> = new Map(); // tagId -> tagName
  private tagTimeout: NodeJS.Timeout | null = null;
  
  // Configuration (can be persisted)
  private config: SecretTagConfig = {
    timeoutMinutes: 5,
    allowQuickLock: true,
    panicModeEnabled: true,
    maxActiveTags: 3
  };

  /**
   * Initialize secret tag manager
   */
  async initialize(): Promise<void> {
    try {
      // No persistent state to load - everything is memory-only
      logger.info('Secret tag manager V2 initialized (server-side hash verification)');
    } catch (error) {
      logger.error('Failed to initialize secret tag manager V2:', error);
    }
  }

  /**
   * Create a new secret tag with server-side hash verification
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

      // Create tag on server with hash verification
      const serverTag = await secretTagHashService.createSecretTag(name.trim(), phrase, colorCode);

      logger.info(`Secret tag created with server-side verification: ${name} (${serverTag.id})`);
      return serverTag.id;
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
      logger.info(`[Secret Tag Detection V2] Checking phrase: "${normalizedText}"`);

      // Check for panic phrase first (highest priority)
      if (this.config.panicModeEnabled && normalizedText.includes('emergency delete everything')) {
        logger.warn('Panic phrase detected');
        return {
          found: true,
          action: 'panic'
        };
      }

      // Use server-side verification to check the phrase
      const verificationResult = await secretTagHashService.verifySecretPhrase(normalizedText);
      
      if (verificationResult.isValid && verificationResult.tagId) {
        logger.info(`Secret phrase verified for tag: ${verificationResult.tagName}`);
        
        // Check if tag is already active
        const isCurrentlyActive = this.isSecretTagActive(verificationResult.tagId);
        
        return {
          found: true,
          tagId: verificationResult.tagId,
          tagName: verificationResult.tagName,
          action: isCurrentlyActive ? 'deactivate' : 'activate'
        };
      }

      // No matching phrase found
      return { found: false };
    } catch (error) {
      logger.error('Error checking for secret tag phrases:', error);
      return { found: false };
    }
  }

  /**
   * Activate a secret tag (memory only)
   */
  async activateSecretTag(tagId: string): Promise<void> {
    try {
      // Check max active tags limit
      if (this.activeTags.size >= this.config.maxActiveTags) {
        throw new Error(`Maximum ${this.config.maxActiveTags} secret tags can be active simultaneously`);
      }

      // Get tag info from server
      const serverTagsResponse = await secretTagHashService.getSecretTags();
      const serverTags = serverTagsResponse.tags || [];
      const tag = serverTags.find(t => t.id === tagId);
      
      if (!tag) {
        throw new Error('Secret tag not found');
      }

      // Activate in memory only
      this.activeTags.add(tagId);
      this.activeTagNames.set(tagId, tag.tag_name);

      // Start auto-deactivate timer
      this.startAutoDeactivateTimer();

      logger.info(`Secret tag activated: ${tag.tag_name} (${tagId})`);
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
      const tagName = this.activeTagNames.get(tagId) || 'Unknown';
      
      // Remove from memory
      this.activeTags.delete(tagId);
      this.activeTagNames.delete(tagId);

      // Clear timer if no active tags
      if (this.activeTags.size === 0) {
        this.clearAutoDeactivateTimer();
      }

      logger.info(`Secret tag deactivated: ${tagName} (${tagId})`);
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
      const count = this.activeTags.size;
      
      // Clear all memory state
      this.activeTags.clear();
      this.activeTagNames.clear();
      this.clearAutoDeactivateTimer();

      logger.info(`Deactivated ${count} secret tags`);
    } catch (error) {
      logger.error('Failed to deactivate all secret tags:', error);
      throw error;
    }
  }

  /**
   * Get all secret tags from server (for UI display)
   */
  async getAllSecretTags(): Promise<SecretTagV2[]> {
    try {
      const serverTagsResponse = await secretTagHashService.getSecretTags();
      const serverTags = serverTagsResponse.tags || [];
      
      logger.info('Debug: Raw server tags response:', serverTags);
      
      // Convert to UI format with active state
      const convertedTags = serverTags.map((tag: SecretTag) => {
        const converted = {
          id: tag.id,
          name: tag.tag_name,
          colorCode: tag.color_code, // Use actual color from server
          createdAt: tag.created_at,
          isActive: this.isSecretTagActive(tag.id)
        };
        logger.info(`Debug: Converting tag ${tag.tag_name}: color_code=${tag.color_code} -> colorCode=${converted.colorCode}`);
        return converted;
      });
      
      logger.info('Debug: Converted tags for UI:', convertedTags);
      return convertedTags;
    } catch (error) {
      logger.error('Failed to get secret tags:', error);
      return [];
    }
  }

  /**
   * Get currently active secret tags
   */
  async getActiveSecretTags(): Promise<SecretTagV2[]> {
    const allTags = await this.getAllSecretTags();
    return allTags.filter(tag => tag.isActive);
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
   * Get active tag IDs for journal entry filtering
   */
  getActiveTagIds(): string[] {
    return Array.from(this.activeTags);
  }

  /**
   * Delete a secret tag from server
   */
  async deleteSecretTag(tagId: string): Promise<void> {
    try {
      // Deactivate if currently active
      if (this.isSecretTagActive(tagId)) {
        await this.deactivateSecretTag(tagId);
      }

      // Delete from server
      await secretTagHashService.deleteSecretTag(tagId);

      logger.info(`Secret tag deleted: ${tagId}`);
    } catch (error) {
      logger.error('Failed to delete secret tag:', error);
      throw error;
    }
  }

  /**
   * Panic mode - delete all secret tags and data
   */
  async activatePanicMode(): Promise<void> {
    try {
      logger.warn('Activating panic mode - deleting all secret tags');

      // Get all tags and delete them
      const allTagsResponse = await secretTagHashService.getSecretTags();
      const allTags = allTagsResponse.tags || [];
      
      for (const tag of allTags) {
        try {
          await secretTagHashService.deleteSecretTag(tag.id);
        } catch (error) {
          logger.error(`Failed to delete tag ${tag.id} during panic mode:`, error);
        }
      }

      // Clear all memory state
      this.activeTags.clear();
      this.activeTagNames.clear();
      this.clearAutoDeactivateTimer();

      logger.warn('Panic mode completed - all secret tags deleted');
    } catch (error) {
      logger.error('Failed to complete panic mode:', error);
      throw error;
    }
  }

  /**
   * Filter journal entries by active tags (for UI compatibility)
   */
  filterEntriesByActiveTags<T extends { secret_tag_id?: string | null }>(entries: T[]): T[] {
    if (!this.hasActiveSecretTags()) {
      // No active tags - return only public entries
      return entries.filter(entry => !entry.secret_tag_id);
    }

    // Return entries that match active tags or are public
    const activeTagIds = this.getActiveTagIds();
    return entries.filter(entry => 
      !entry.secret_tag_id || activeTagIds.includes(entry.secret_tag_id)
    );
  }

  /**
   * Get active secret tag for new entries (returns first active tag)
   */
  getActiveSecretTagForNewEntry(): string | null {
    const activeTagIds = this.getActiveTagIds();
    return activeTagIds.length > 0 ? activeTagIds[0] : null;
  }

  /**
   * Extend the auto-deactivate timeout
   */
  extendTimeout(): void {
    if (this.hasActiveSecretTags()) {
      this.startAutoDeactivateTimer();
    }
  }

  /**
   * Start auto-deactivate timer
   */
  private startAutoDeactivateTimer(): void {
    this.clearAutoDeactivateTimer();
    
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000;
    this.tagTimeout = setTimeout(async () => {
      logger.info('Auto-deactivating secret tags due to timeout');
      await this.deactivateAllSecretTags();
    }, timeoutMs);
  }

  /**
   * Clear auto-deactivate timer
   */
  private clearAutoDeactivateTimer(): void {
    if (this.tagTimeout) {
      clearTimeout(this.tagTimeout);
      this.tagTimeout = null;
    }
  }

  /**
   * Normalize phrase for consistent comparison
   */
  private normalizePhrase(phrase: string): string {
    return phrase.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<SecretTagConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    logger.info('Secret tag configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): SecretTagConfig {
    return { ...this.config };
  }

  /**
   * Deletes all secret tags from the server.
   * This is a sensitive operation and should be used with care.
   */
  async deleteAllSecretTags(): Promise<void> {
    try {
      const serverTagsResponse = await secretTagHashService.getSecretTags();
      const serverTags = serverTagsResponse.tags || [];
      
      const deletionPromises = serverTags.map(tag =>
        secretTagHashService.deleteSecretTag(tag.id)
      );
      
      await Promise.all(deletionPromises);
      logger.info(`Deleted ${serverTags.length} secret tags from the server.`);
      
    } catch (error) {
      logger.error('Failed to delete all secret tags:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const secretTagOnlineManager = new SecretTagOnlineManager(); 