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
import logger from '../utils/logger';

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

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Update strategy based on current config
      this.updateStrategy();

      // Start auto-sync if enabled
      if (this.config.cacheEnabled && this.config.autoSyncInterval > 0) {
        this.startAutoSync();
      }

      logger.info(`Tag Manager initialized with ${this.config.securityMode} mode`);
    } catch (error) {
      logger.error('Failed to initialize tag manager:', error);
      throw error;
    }
  }

  // Regular Tags API
  async getRegularTags(): Promise<Tag[]> {
    try {
      const response = await TagsAPI.getTags();
      return response.data;
    } catch (error) {
      logger.error('Failed to get regular tags:', error);
      throw error;
    }
  }

  async createRegularTag(name: string, color?: string): Promise<Tag> {
    try {
      const response = await TagsAPI.createTag({ name, color });
      return response.data;
    } catch (error) {
      logger.error('Failed to create regular tag:', error);
      throw error;
    }
  }

  async updateRegularTag(id: string, updates: Partial<Tag>): Promise<Tag> {
    try {
      const response = await TagsAPI.updateTag(id, updates);
      return response.data;
    } catch (error) {
      logger.error('Failed to update regular tag:', error);
      throw error;
    }
  }

  async deleteRegularTag(id: string): Promise<void> {
    try {
      await TagsAPI.deleteTag(id);
    } catch (error) {
      logger.error('Failed to delete regular tag:', error);
      throw error;
    }
  }

  // Secret Tags API
  async setSecurityMode(mode: SecurityMode): Promise<void> {
    logger.info(`Switching to ${mode} mode`);
    
    this.config.securityMode = mode;
    
    // Disable cache for online mode
    if (mode === 'online') {
      this.config.cacheEnabled = false;
      await this.clearSecretCache();
    } else {
      this.config.cacheEnabled = true;
    }

    this.updateStrategy();
    await this.saveConfig();
  }

  async checkForSecretTagPhrases(transcribedText: string): Promise<TagDetectionResult> {
    try {
      const result = await this.currentSecretStrategy.verifyPhrase(transcribedText);
      
      if (result.found) {
        logger.info(`Secret tag detected: ${result.tagName}`);
      }

      return result;
    } catch (error) {
      logger.error('Error in phrase verification:', error);
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
    const tagId = await this.currentSecretStrategy.createTag(name, phrase, colorCode);
    
    // Trigger sync if in offline mode
    if (this.config.securityMode === 'offline') {
      this.scheduleSync();
    }
    
    return tagId;
  }

  async deleteSecretTag(tagId: string): Promise<void> {
    await this.currentSecretStrategy.deleteTag(tagId);
    
    // Trigger sync if in offline mode
    if (this.config.securityMode === 'offline') {
      this.scheduleSync();
    }
  }

  async activateSecretTag(tagId: string): Promise<void> {
    await this.currentSecretStrategy.activateTag(tagId);
  }

  async deactivateSecretTag(tagId: string): Promise<void> {
    await this.currentSecretStrategy.deactivateTag(tagId);
  }

  async deactivateAllSecretTags(): Promise<void> {
    const activeTags = await this.getActiveSecretTags();
    await Promise.all(activeTags.map(tag => this.deactivateSecretTag(tag.id)));
  }

  // Cache and Status API
  async getCacheStatus(): Promise<CacheStatus> {
    if (!this.config.cacheEnabled) {
      return {
        enabled: false,
        entryCount: 0,
        storageSize: 0,
        integrity: 'unknown'
      };
    }

    try {
      const cachedTags = await this.secretCacheManager.getAllSecretTags();
      return {
        enabled: true,
        lastSync: new Date().toISOString(),
        entryCount: cachedTags.length,
        storageSize: JSON.stringify(cachedTags).length,
        integrity: 'valid'
      };
    } catch (error) {
      return {
        enabled: true,
        entryCount: 0,
        storageSize: 0,
        integrity: 'corrupted'
      };
    }
  }

  async clearSecretCache(): Promise<void> {
    try {
      logger.info('Clearing secret tag cache');
      const cachedTags = await this.secretCacheManager.getAllSecretTags();
      
      for (const tag of cachedTags) {
        try {
          await this.secretCacheManager.deleteSecretTag(tag.id);
        } catch (error) {
          logger.warn(`Failed to delete cached tag ${tag.id}:`, error);
        }
      }
      
      logger.info('Cache cleared successfully');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  async syncWithServer(): Promise<void> {
    if (!this.config.cacheEnabled || this.networkStatus === 'offline') {
      return;
    }

    try {
      logger.info('Syncing cache with server');
      
      const [serverTags, cachedTags] = await Promise.all([
        this.secretServerManager.getAllSecretTags(),
        this.secretCacheManager.getAllSecretTags()
      ]);

      logger.info(`Server has ${serverTags.length} tags, cache has ${cachedTags.length} tags`);
      
    } catch (error) {
      logger.error('Failed to sync with server:', error);
    }
  }

  getConfig(): TagConfig {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<TagConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    this.updateStrategy();
    await this.saveConfig();
  }

  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  private updateStrategy(): void {
    const { securityMode, cacheEnabled } = this.config;

    if (securityMode === 'online' || !cacheEnabled) {
      this.currentSecretStrategy = this.secretStrategies.serverOnly;
    } else if (this.networkStatus === 'offline') {
      this.currentSecretStrategy = this.secretStrategies.cacheOnly;
    } else {
      this.currentSecretStrategy = this.secretStrategies.cacheFirst;
    }

    logger.debug(`Strategy updated to: ${this.getStrategyName()}`);
  }

  private getStrategyName(): string {
    if (this.currentSecretStrategy === this.secretStrategies.serverOnly) return 'server-only';
    if (this.currentSecretStrategy === this.secretStrategies.cacheFirst) return 'cache-first';
    if (this.currentSecretStrategy === this.secretStrategies.cacheOnly) return 'cache-only';
    return 'unknown';
  }

  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = this.networkStatus === 'offline';
      
      if (!state.isConnected) {
        this.networkStatus = 'offline';
      } else if (state.details && 'strength' in state.details) {
        const strength = state.details.strength as number;
        this.networkStatus = strength < 2 ? 'poor' : 'online';
      } else {
        this.networkStatus = 'online';
      }

      this.updateStrategy();

      if (wasOffline && this.networkStatus === 'online' && this.config.syncOnForeground) {
        this.scheduleSync();
      }

      logger.debug(`Network status changed to: ${this.networkStatus}`);
    });
  }

  private scheduleSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.syncWithServer();
    }, 5000);
  }

  private startAutoSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    const intervalMs = this.config.autoSyncInterval * 60 * 1000;
    this.syncTimeout = setInterval(() => {
      this.syncWithServer();
    }, intervalMs);
  }

  private async saveConfig(): Promise<void> {
    try {
      logger.debug('Configuration saved');
    } catch (error) {
      logger.error('Failed to save configuration:', error);
    }
  }
}

// Export singleton instance
export const tagManager = new TagManager(); 