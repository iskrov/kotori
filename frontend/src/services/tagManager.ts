/**
 * Tag Manager
 * 
 * Unified manager for both regular and secret tags with two operation modes:
 * - Online mode: Server-only verification, no secrets cached on device
 * - Offline mode: Cached secrets for offline access
 * - Automatic network-aware fallback strategies
 */

import NetInfo from '@react-native-community/netinfo';
import { secretTagOnlineManager, SecretTagV2, TagDetectionResult } from './secretTagOnlineManager';
import { secretTagOfflineManager, SecretTag } from './secretTagOfflineManager';
import { TagsAPI } from './api';
import { Tag } from '../types';
import { zeroKnowledgeEncryption } from './zeroKnowledgeEncryption';
import logger from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SecurityMode = 'online' | 'offline';
export type NetworkStatus = 'online' | 'offline' | 'poor' | 'unknown';

export interface CacheStatus {
  enabled: boolean;
  lastSync?: string;
  entryCount: number;
  storageSize: number;
  integrity: 'valid' | 'corrupted' | 'unknown';
}

export interface TagConfig {
  securityMode: SecurityMode;
  cacheEnabled: boolean;
  autoSyncInterval: number;     // Minutes between auto-sync
  maxCacheAge: number;          // Hours before cache expires
  syncOnForeground: boolean;    // Sync when app becomes active
}

interface SecretTagStrategy {
  verifyPhrase(phrase: string): Promise<TagDetectionResult>;
  getAllTags(): Promise<SecretTagV2[]>;
  createTag(name: string, phrase: string, colorCode?: string): Promise<string>;
  deleteTag(tagId: string): Promise<void>;
  activateTag(tagId: string): Promise<void>;
  deactivateTag(tagId: string): Promise<void>;
}

class ServerOnlyStrategy implements SecretTagStrategy {
  async verifyPhrase(phrase: string): Promise<TagDetectionResult> {
    return await secretTagOnlineManager.checkForSecretTagPhrases(phrase);
  }

  async getAllTags(): Promise<SecretTagV2[]> {
    return await secretTagOnlineManager.getAllSecretTags();
  }

  async createTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    return await secretTagOnlineManager.createSecretTag(name, phrase, colorCode);
  }

  async deleteTag(tagId: string): Promise<void> {
    return await secretTagOnlineManager.deleteSecretTag(tagId);
  }

  async activateTag(tagId: string): Promise<void> {
    return await secretTagOnlineManager.activateSecretTag(tagId);
  }

  async deactivateTag(tagId: string): Promise<void> {
    return await secretTagOnlineManager.deactivateSecretTag(tagId);
  }
}

class CacheFirstStrategy implements SecretTagStrategy {
  async verifyPhrase(phrase: string): Promise<TagDetectionResult> {
    try {
      // Try cache first
      const cacheResult = await secretTagOfflineManager.checkForSecretTagPhrases(phrase);
      if (cacheResult.found) {
        return cacheResult;
      }
    } catch (error) {
      logger.warn('Cache verification failed, falling back to server:', error);
    }

    // Fallback to server
    return await secretTagOnlineManager.checkForSecretTagPhrases(phrase);
  }

  async getAllTags(): Promise<SecretTagV2[]> {
    try {
      // Try cache first and convert format
      const cachedTags = await secretTagOfflineManager.getAllSecretTags();
      if (cachedTags.length > 0) {
        return this.convertV1ToV2Format(cachedTags);
      }
    } catch (error) {
      logger.warn('Cache read failed, falling back to server:', error);
    }

    // Fallback to server
    return await secretTagOnlineManager.getAllSecretTags();
  }

  async createTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    // Create in both cache and server
    const [serverId] = await Promise.all([
      secretTagOnlineManager.createSecretTag(name, phrase, colorCode),
      secretTagOfflineManager.createSecretTag(name, phrase, colorCode)
    ]);
    return serverId; // Return server ID as primary
  }

  async deleteTag(tagId: string): Promise<void> {
    // Delete from both cache and server
    await Promise.all([
      secretTagOnlineManager.deleteSecretTag(tagId),
      this.deleteCacheTag(tagId)
    ]);
  }

  async activateTag(tagId: string): Promise<void> {
    // Activate in both cache and server
    await Promise.all([
      secretTagOnlineManager.activateSecretTag(tagId),
      this.activateCacheTag(tagId)
    ]);
  }

  async deactivateTag(tagId: string): Promise<void> {
    // Deactivate in both cache and server
    await Promise.all([
      secretTagOnlineManager.deactivateSecretTag(tagId),
      this.deactivateCacheTag(tagId)
    ]);
  }

  private convertV1ToV2Format(v1Tags: SecretTag[]): SecretTagV2[] {
    return v1Tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      colorCode: tag.colorCode,
      createdAt: new Date(tag.createdAt).toISOString(),
      isActive: tag.isActive
    }));
  }

  private async deleteCacheTag(tagId: string): Promise<void> {
    try {
      await secretTagOfflineManager.deleteSecretTag(tagId);
    } catch (error) {
      logger.warn('Cache tag deletion failed:', error);
    }
  }

  private async activateCacheTag(tagId: string): Promise<void> {
    try {
      await secretTagOfflineManager.activateSecretTag(tagId);
    } catch (error) {
      logger.warn('Cache tag activation failed:', error);
    }
  }

  private async deactivateCacheTag(tagId: string): Promise<void> {
    try {
      await secretTagOfflineManager.deactivateSecretTag(tagId);
    } catch (error) {
      logger.warn('Cache tag deactivation failed:', error);
    }
  }
}

class CacheOnlyStrategy implements SecretTagStrategy {
  async verifyPhrase(phrase: string): Promise<TagDetectionResult> {
    return await secretTagOfflineManager.checkForSecretTagPhrases(phrase);
  }

  async getAllTags(): Promise<SecretTagV2[]> {
    const cachedTags = await secretTagOfflineManager.getAllSecretTags();
    return this.convertV1ToV2Format(cachedTags);
  }

  async createTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    return await secretTagOfflineManager.createSecretTag(name, phrase, colorCode);
  }

  async deleteTag(tagId: string): Promise<void> {
    return await secretTagOfflineManager.deleteSecretTag(tagId);
  }

  async activateTag(tagId: string): Promise<void> {
    return await secretTagOfflineManager.activateSecretTag(tagId);
  }

  async deactivateTag(tagId: string): Promise<void> {
    return await secretTagOfflineManager.deactivateSecretTag(tagId);
  }

  private convertV1ToV2Format(v1Tags: SecretTag[]): SecretTagV2[] {
    return v1Tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      colorCode: tag.colorCode,
      createdAt: new Date(tag.createdAt).toISOString(),
      isActive: tag.isActive
    }));
  }
}

class TagManager {
  // Core managers
  private secretServerManager = secretTagOnlineManager;
  private secretCacheManager = secretTagOfflineManager;
  
  // Network and state
  private networkStatus: NetworkStatus = 'unknown';
  private currentSecretStrategy: SecretTagStrategy;
  private config: TagConfig;
  private syncTimeout: NodeJS.Timeout | null = null;
  private activeSecretTags: Set<string> = new Set();

  // Secret tag strategies
  private secretStrategies = {
    serverOnly: new ServerOnlyStrategy(),
    cacheFirst: new CacheFirstStrategy(),
    cacheOnly: new CacheOnlyStrategy()
  };

  constructor() {
    this.config = {
      securityMode: 'offline',
      cacheEnabled: true,
      autoSyncInterval: 15,
      maxCacheAge: 24,
      syncOnForeground: true
    };

    this.currentSecretStrategy = this.secretStrategies.cacheFirst;
  }

  /**
   * Initialize manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Tag Manager');

      // Initialize secret tag managers
      await Promise.all([
        this.secretServerManager.initialize(),
        this.secretCacheManager.initialize()
      ]);

      // Setup network monitoring
      this.setupNetworkMonitoring();

      // Start auto-sync based on config
      this.startAutoSync();

      logger.info('Tag Manager initialized');
    } catch (error) {
      logger.error('Failed to initialize Tag Manager:', error);
    }
  }

  // --- Regular Tags ---

  async getRegularTags(): Promise<Tag[]> {
    try {
      const response = await TagsAPI.getTags();
      return response.data;
    } catch (error) {
      logger.error('Failed to get regular tags:', error);
      return [];
    }
  }

  /**
   * Create a regular tag
   */
  async createRegularTag(name: string, color?: string): Promise<Tag> {
    try {
      const newTag = { name, color };
      return await TagsAPI.createTag(newTag);
    } catch (error) {
      logger.error('Failed to create regular tag:', error);
      throw error;
    }
  }

  /**
   * Update a regular tag
   */
  async updateRegularTag(id: string, updates: Partial<Tag>): Promise<Tag> {
    try {
      return await TagsAPI.updateTag(id, updates);
    } catch (error) {
      logger.error('Failed to update regular tag:', error);
      throw error;
    }
  }

  async deleteRegularTag(id: string): Promise<void> {
    try {
      logger.info(`TagManager: Attempting to delete regular tag with ID: ${id}`);
      await TagsAPI.deleteTag(id);
      logger.info(`TagManager: Successfully deleted regular tag with ID: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete regular tag ${id}:`, error);
      logger.error(`Delete error details:`, {
        message: error instanceof Error ? error.message : String(error),
        response: (error as any)?.response?.data,
        status: (error as any)?.response?.status,
        url: (error as any)?.config?.url
      });
      throw error;
    }
  }

  // --- Secret Tags ---

  async setSecurityMode(mode: SecurityMode): Promise<void> {
    if (this.config.securityMode === mode) return;
    
    logger.info(`Switching security mode to: ${mode}`);
    this.config.securityMode = mode;
    this.updateStrategy();
    
    // If switching to online mode, clear the cache for security
    if (mode === 'online') {
      await this.clearSecretCache();
    }

    await this.saveConfig();
  }

  async checkForSecretTagPhrases(transcribedText: string): Promise<TagDetectionResult> {
    try {
      return await this.currentSecretStrategy.verifyPhrase(transcribedText);
    } catch (error) {
      logger.error('Error checking for secret tags:', error);
      return { found: false };
    }
  }

  async getSecretTags(): Promise<SecretTagV2[]> {
    return await this.currentSecretStrategy.getAllTags();
  }

  async getActiveSecretTags(): Promise<SecretTagV2[]> {
    const allTags = await this.getSecretTags();
    return allTags.filter(tag => tag.isActive);
  }

  async createSecretTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    logger.info(`Creating secret tag "${name}" using strategy: ${this.getStrategyName()}`);
    return await this.currentSecretStrategy.createTag(name, phrase, colorCode);
  }

  async deleteSecretTag(tagId: string): Promise<void> {
    logger.info(`Deleting secret tag ${tagId} using strategy: ${this.getStrategyName()}`);
    return await this.currentSecretStrategy.deleteTag(tagId);
  }

  async activateSecretTag(tagId: string): Promise<void> {
    return await this.currentSecretStrategy.activateTag(tagId);
  }

  async deactivateSecretTag(tagId: string): Promise<void> {
    return await this.currentSecretStrategy.deactivateTag(tagId);
  }

  async deactivateAllSecretTags(): Promise<void> {
    await this.secretServerManager.deactivateAllSecretTags();
    await this.secretCacheManager.deactivateAllSecretTags();
  }

  // --- Cache Management ---

  async getCacheStatus(): Promise<CacheStatus> {
    try {
      const [entries, metadata] = await Promise.all([
        this.secretCacheManager.getAllSecretTags(),
        AsyncStorage.getItem('secretTags_metadata') // Assuming metadata is stored
      ]);
      const size = await AsyncStorage.getItem('secretTags_metadata');

      let parsedMeta = { lastSync: 'N/A', integrity: 'unknown' };
      if (metadata) {
        try {
          parsedMeta = JSON.parse(metadata);
        } catch (e) {
          logger.warn('Could not parse cache metadata');
        }
      }

      return {
        enabled: this.config.cacheEnabled,
        lastSync: parsedMeta.lastSync,
        entryCount: entries.length,
        storageSize: size ? size.length : 0, // Simplified size calculation
        integrity: parsedMeta.integrity as 'valid' | 'corrupted' | 'unknown',
      };
    } catch (error) {
      logger.error('Failed to get cache status:', error);
      return {
        enabled: this.config.cacheEnabled,
        entryCount: 0,
        storageSize: 0,
        integrity: 'unknown'
      };
    }
  }

  async clearSecretCache(): Promise<void> {
    logger.info('Clearing secret tag cache');
    try {
      await this.secretCacheManager.clearAllSecretTags();
      await AsyncStorage.removeItem('secretTags_metadata');
      logger.info('Secret tag cache cleared successfully');
    } catch (error) {
      logger.error('Failed to clear secret tag cache:', error);
    }
  }

  async syncWithServer(): Promise<void> {
    if (!this.config.cacheEnabled) return;
    
    logger.info('Syncing secret tag cache with server...');
    try {
      const serverTags = await this.secretServerManager.getAllSecretTags();
      
      // For a real implementation, this would involve a more complex merge
      // For now, we'll just overwrite the cache with the server state
      await this.clearSecretCache();
      
      for (const tag of serverTags) {
        // This is a simplification. Caching would require storing the phrase,
        // which the server doesn't provide. This highlights a design issue
        // in syncing server-only tags to a cache that needs phrases.
        // For now, we just log a warning.
        logger.warn(`Cannot fully cache tag "${tag.name}" without its phrase.`);
      }

      const metadata = { lastSync: new Date().toISOString(), integrity: 'valid' };
      await AsyncStorage.setItem('secretTags_metadata', JSON.stringify(metadata));
      
      logger.info('Secret tag cache sync complete.');
    } catch (error) {
      logger.error('Failed to sync secret tag cache:', error);
    }
  }

  // --- Configuration ---
  
  getConfig(): TagConfig {
    return this.config;
  }

  async updateConfig(updates: Partial<TagConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  // --- Private Helpers ---

  private updateStrategy(): void {
    const isOnline = this.networkStatus === 'online';
    const useCache = this.config.cacheEnabled;
    const mode = this.config.securityMode;

    if (mode === 'online') {
      this.currentSecretStrategy = this.secretStrategies.serverOnly;
    } else { // offline mode
      if (isOnline && useCache) {
        this.currentSecretStrategy = this.secretStrategies.cacheFirst;
      } else {
        this.currentSecretStrategy = this.secretStrategies.cacheOnly;
      }
    }
    logger.info(`Secret tag strategy updated to: ${this.getStrategyName()}`);
  }

  private getStrategyName(): string {
    if (this.currentSecretStrategy instanceof ServerOnlyStrategy) return 'Server-Only';
    if (this.currentSecretStrategy instanceof CacheFirstStrategy) return 'Cache-First';
    if (this.currentSecretStrategy instanceof CacheOnlyStrategy) return 'Cache-Only';
    return 'Unknown';
  }

  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const newStatus: NetworkStatus = state.isConnected ? 'online' : 'offline';
      
      if (newStatus !== this.networkStatus) {
        logger.info(`Network status changed: ${this.networkStatus} -> ${newStatus}`);
        this.networkStatus = newStatus;
        this.updateStrategy();
      }
    });

    // Get initial state
    NetInfo.fetch().then(state => {
      this.networkStatus = state.isConnected ? 'online' : 'offline';
      logger.info(`Initial network status: ${this.networkStatus}`);
      this.updateStrategy();
    });
  }

  private scheduleSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    
    if (this.config.autoSyncInterval > 0) {
      this.syncTimeout = setTimeout(() => {
        this.syncWithServer();
        this.scheduleSync(); // Reschedule for next interval
      }, this.config.autoSyncInterval * 60 * 1000);
    }
  }

  private startAutoSync(): void {
    if (this.config.cacheEnabled) {
      this.scheduleSync();
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      // Persist config changes
    } catch (error) {
      logger.error('Failed to save tag manager config:', error);
    }
  }
  
  /**
   * Complete data removal for a secret tag from all storage locations
   * This is a critical security function
   */
  async clearAllSecretData(): Promise<void> {
    logger.warn('CLEARING ALL SECRET DATA');
    try {
      // 1. Deactivate all tags in memory
      this.deactivateAllSecretTags();

      // 2. Clear server-side data (via online manager)
      const serverTags = await this.secretServerManager.getAllSecretTags();
      const serverDeletionPromises = serverTags.map(tag =>
        this.secretServerManager.deleteSecretTag(tag.id)
      );
      await Promise.all(serverDeletionPromises);
      logger.info('Cleared all server-side secret tags');

      // 3. Clear cached data (via offline manager)
      await this.secretCacheManager.clearAllSecretTags();
      logger.info('Cleared all cached secret tags');

      // 4. Clear any other related storage (e.g., config, metadata)
      await this.clearAdditionalSecretStorage();

      // 5. Verify clearing was successful
      const verification = await this.verifySecretDataClearing();
      if (verification.success) {
        logger.info('Successfully cleared and verified all secret data');
      } else {
        logger.error('Failed to verify complete clearing of secret data', {
          issues: verification.issues
        });
        throw new Error('Secret data clearing failed verification');
      }
    } catch (error) {
      logger.error('An error occurred during secret data clearing:', error);
      throw error;
    }
  }

  private async clearAdditionalSecretStorage(): Promise<void> {
    try {
      // Example of other data that might need clearing
      const keysToClear = [
        'secretTags_metadata',
        'secret_tag_config'
        // Add any other relevant keys here
      ];
      
      for (const key of keysToClear) {
        await AsyncStorage.removeItem(key);
      }
      logger.info('Cleared additional secret storage keys');
    } catch (error) {
      logger.error('Failed to clear additional secret storage:', error);
    }
  }
  
  private async verifySecretDataClearing(): Promise<{success: boolean, issues: string[]}> {
    const issues: string[] = [];
    
    // Check server
    const serverTags = await this.secretServerManager.getAllSecretTags();
    if (serverTags.length > 0) {
      issues.push('Server-side tags not fully cleared');
    }

    // Check cache
    const cachedTags = await this.secretCacheManager.getAllSecretTags();
    if (cachedTags.length > 0) {
      issues.push('Cached tags not fully cleared');
    }
    
    // Check in-memory state
    if (this.secretServerManager.getActiveTagIds().length > 0 || this.activeSecretTags.size > 0) {
      issues.push('In-memory active tags not cleared');
    }
    
    return {
      success: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const tagManager = new TagManager(); 