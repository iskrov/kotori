/**
 * Secret Tag Offline Manager
 * 
 * Client-side secret tag management for offline access and caching.
 * 
 * Features:
 * - Local AsyncStorage persistence
 * - Offline phrase verification
 * - No server dependency once cached
 * - Used in "Offline Mode" for convenient daily use
 * 
 * Security Note: Stores secret phrases and metadata locally.
 * Not recommended for high-security scenarios or travel.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { secretTagOnlineManager, SecretTagV2, TagDetectionResult } from './secretTagOnlineManager';
import logger from '../utils/logger';

export interface SecretTag {
  id: string;
  name: string;
  phrase: string;
  phraseHash: string;
  phraseSalt: string;
  serverTagHash: string;
  colorCode: string;
  isActive: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'secretTags';

class SecretTagOfflineManager {
  private tags: SecretTag[] = [];
  private initialized = false;

  /**
   * Initialize the manager by loading tags from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.tags = JSON.parse(stored);
        logger.info(`Loaded ${this.tags.length} secret tags from storage`);
      }
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize secret tag manager:', error);
      throw error;
    }
  }

  /**
   * Save tags to storage
   */
  private async saveTags(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.tags));
    } catch (error) {
      logger.error('Failed to save secret tags:', error);
      throw error;
    }
  }

  /**
   * Check for secret tag phrases in transcribed text
   */
  async checkForSecretTagPhrases(transcribedText: string): Promise<TagDetectionResult> {
    try {
      const lowercaseText = transcribedText.toLowerCase();
      
      for (const tag of this.tags) {
        if (!tag.isActive) continue;
        
        const lowercasePhrase = tag.phrase.toLowerCase();
        if (lowercaseText.includes(lowercasePhrase)) {
          logger.info(`Secret tag detected: ${tag.name}`);
                     return {
             found: true,
             tagId: tag.id,
             tagName: tag.name
           };
        }
      }
      
      return { found: false };
    } catch (error) {
      logger.error('Error checking for secret tag phrases:', error);
      return { found: false };
    }
  }

  /**
   * Get all secret tags
   */
  async getAllSecretTags(): Promise<SecretTag[]> {
    return [...this.tags];
  }

  /**
   * Get active secret tags
   */
  async getActiveSecretTags(): Promise<SecretTag[]> {
    return this.tags.filter(tag => tag.isActive);
  }

  /**
   * Create a new secret tag
   */
  async createSecretTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    const tagId = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTag: SecretTag = {
      id: tagId,
      name,
      phrase,
      phraseHash: '', // Not needed for client-side storage
      phraseSalt: '', // Not needed for client-side storage
      serverTagHash: '', // Not needed for client-side storage
      colorCode,
      isActive: true,
      createdAt: Date.now()
    };
    
    this.tags.push(newTag);
    await this.saveTags();
    
    logger.info(`Created secret tag: ${name}`);
    return tagId;
  }

  /**
   * Delete a secret tag
   */
  async deleteSecretTag(tagId: string): Promise<void> {
    const initialLength = this.tags.length;
    this.tags = this.tags.filter(tag => tag.id !== tagId);
    
    if (this.tags.length < initialLength) {
      await this.saveTags();
      logger.info(`Deleted secret tag: ${tagId}`);
    } else {
      logger.warn(`Secret tag not found for deletion: ${tagId}`);
    }
  }

  /**
   * Activate a secret tag
   */
  async activateSecretTag(tagId: string): Promise<void> {
    const tag = this.tags.find(t => t.id === tagId);
    if (tag) {
      tag.isActive = true;
      await this.saveTags();
      logger.info(`Activated secret tag: ${tagId}`);
    } else {
      logger.warn(`Secret tag not found for activation: ${tagId}`);
    }
  }

  /**
   * Deactivate a secret tag
   */
  async deactivateSecretTag(tagId: string): Promise<void> {
    const tag = this.tags.find(t => t.id === tagId);
    if (tag) {
      tag.isActive = false;
      await this.saveTags();
      logger.info(`Deactivated secret tag: ${tagId}`);
    } else {
      logger.warn(`Secret tag not found for deactivation: ${tagId}`);
    }
  }

  /**
   * Deactivate all secret tags
   */
  async deactivateAllSecretTags(): Promise<void> {
    let changed = false;
    for (const tag of this.tags) {
      if (tag.isActive) {
        tag.isActive = false;
        changed = true;
      }
    }
    
    if (changed) {
      await this.saveTags();
      logger.info('Deactivated all secret tags');
    }
  }

  /**
   * Clear all secret tags (for security)
   */
  async clearAllSecretTags(): Promise<void> {
    this.tags = [];
    await this.saveTags();
    logger.info('Cleared all secret tags');
  }
}

// Export singleton instance
export const secretTagOfflineManager = new SecretTagOfflineManager(); 