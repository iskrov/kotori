/**
 * Legacy Tag Manager Service
 * 
 * This service provides backward compatibility for the legacy tag management system
 * while redirecting to the new OPAQUE-based system.
 */

import { Tag } from '../types';
import { TagsAPI } from './api';
import { opaqueTagManager } from './OpaqueTagManager';
import { voicePhraseDetector } from './VoicePhraseDetector';
import logger from '../utils/logger';

export interface TagManagerInterface {
  getAllTags(): Promise<Tag[]>;
  createTag(name: string, color?: string): Promise<Tag>;
  updateTag(id: string, updates: Partial<Tag>): Promise<Tag>;
  deleteTag(id: string): Promise<void>;
  getTagById(id: string): Promise<Tag | null>;
  getTagsByIds(ids: string[]): Promise<Tag[]>;
  // OPAQUE-specific methods
  getActiveSecretTags(): Promise<any[]>;
  checkForSecretTagPhrases(content: string): Promise<{ found: boolean; tagId?: string; tagName?: string; action?: string }>;
  getSecretTags(): Promise<any[]>;
  activateSecretTag(tagId: string): Promise<void>;
}

/**
 * Legacy Tag Manager Implementation
 * 
 * This implementation provides compatibility with the old tag management system
 * while delegating to the new OPAQUE-based system where appropriate.
 */
class LegacyTagManager implements TagManagerInterface {
  /**
   * Get all tags (regular tags only, not secret tags)
   */
  async getAllTags(): Promise<Tag[]> {
    try {
      logger.info('Legacy tagManager: Getting all regular tags from API');
      const response = await TagsAPI.getTags();
      const tags = response.data || [];
      logger.info(`Legacy tagManager: Found ${tags.length} regular tags`);
      return tags;
    } catch (error) {
      logger.error('Failed to get all tags:', error);
      throw error;
    }
  }

  /**
   * Create a new regular tag
   */
  async createTag(name: string, color?: string): Promise<Tag> {
    try {
      logger.info('Legacy tagManager: Creating regular tag:', { name, color });
      
      const newTag = await TagsAPI.createTag({
        name: name.trim(),
        color: color || '#007AFF'
      });

      logger.info('Legacy tagManager: Created regular tag:', newTag);
      return newTag;
    } catch (error) {
      logger.error('Failed to create tag:', error);
      throw error;
    }
  }

  /**
   * Update an existing tag
   */
  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag> {
    try {
      logger.info('Legacy tagManager: Updating tag:', { id, updates });
      
      const updatedTag = await TagsAPI.updateTag(id, updates);
      logger.info('Legacy tagManager: Updated tag:', updatedTag);
      return updatedTag;
    } catch (error) {
      logger.error('Failed to update tag:', error);
      throw error;
    }
  }

  /**
   * Delete a tag
   */
  async deleteTag(id: string): Promise<void> {
    try {
      logger.info('Legacy tagManager: Deleting tag:', { id });
      
      await TagsAPI.deleteTag(id);
      logger.info('Legacy tagManager: Deleted tag successfully');
    } catch (error) {
      logger.error('Failed to delete tag:', error);
      throw error;
    }
  }

  /**
   * Get a tag by ID
   */
  async getTagById(id: string): Promise<Tag | null> {
    try {
      logger.info('Legacy tagManager: Getting tag by ID:', { id });
      
      const allTags = await this.getAllTags();
      const tag = allTags.find(t => String(t.id) === id) || null;
      
      logger.info('Legacy tagManager: Found tag:', tag);
      return tag;
    } catch (error) {
      logger.error('Failed to get tag by ID:', error);
      throw error;
    }
  }

  /**
   * Get tags by IDs
   */
  async getTagsByIds(ids: string[]): Promise<Tag[]> {
    try {
      logger.info('Legacy tagManager: Getting tags by IDs:', { ids });
      
      const allTags = await this.getAllTags();
      const tags = allTags.filter(t => ids.includes(String(t.id)));
      
      logger.info(`Legacy tagManager: Found ${tags.length} tags`);
      return tags;
    } catch (error) {
      logger.error('Failed to get tags by IDs:', error);
      throw error;
    }
  }

  /**
   * Get active secret tags (OPAQUE-based)
   */
  async getActiveSecretTags(): Promise<any[]> {
    try {
      logger.info('Legacy tagManager: Getting active secret tags');
      
      // Use the OPAQUE manager to get active tags
      const activeTags = await opaqueTagManager.getActiveTags();
      
      logger.info(`Legacy tagManager: Found ${activeTags.length} active secret tags`);
      return activeTags;
    } catch (error) {
      logger.error('Failed to get active secret tags:', error);
      throw error;
    }
  }

  /**
   * Check for secret tag phrases in content
   */
  async checkForSecretTagPhrases(content: string): Promise<{ found: boolean; tagId?: string; tagName?: string; action?: string }> {
    try {
      logger.info('Legacy tagManager: Checking for secret tag phrases');
      
      // Use the voice phrase detector to check for phrases
      const result = await voicePhraseDetector.checkForPhrases(content);
      
      if (result.found) {
        logger.info('Legacy tagManager: Found secret tag phrase', result);
        return {
          found: true,
          tagId: result.tagId,
          tagName: result.tagName,
          action: result.action
        };
      }
      
      return { found: false };
    } catch (error) {
      logger.error('Failed to check for secret tag phrases:', error);
      return { found: false };
    }
  }

  /**
   * Get all secret tags (OPAQUE-based)
   */
  async getSecretTags(): Promise<any[]> {
    try {
      logger.info('Legacy tagManager: Getting all secret tags');
      
      // Use the OPAQUE manager to get all tags
      const secretTags = await opaqueTagManager.getAllTags();
      
      logger.info(`Legacy tagManager: Found ${secretTags.length} secret tags`);
      return secretTags;
    } catch (error) {
      logger.error('Failed to get secret tags:', error);
      throw error;
    }
  }

  /**
   * Activate a secret tag
   */
  async activateSecretTag(tagId: string): Promise<void> {
    try {
      logger.info('Legacy tagManager: Activating secret tag:', { tagId });
      
      // Use the OPAQUE manager to activate the tag
      await opaqueTagManager.activateTag(tagId);
      
      logger.info('Legacy tagManager: Activated secret tag successfully');
    } catch (error) {
      logger.error('Failed to activate secret tag:', error);
      throw error;
    }
  }
}

// Export the legacy tag manager instance
export const tagManager = new LegacyTagManager();

// Export default for compatibility
export default tagManager; 