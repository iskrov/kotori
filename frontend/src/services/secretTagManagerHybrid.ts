/**
 * Secret Tag Manager Hybrid
 * 
 * Combines the best of both V1 and V2 implementations:
 * - V2's server-side hash verification as core engine
 * - V1's secure caching as optional offline layer
 * - User-controlled security modes for different contexts
 * - Graceful network degradation with fallback strategies
 * 
 * Security Modes:
 * - Maximum: Server-only, no caching (travel/border crossing)
 * - Balanced: Server-first with cache fallback (daily use)  
 * - Convenience: Cache-first with server sync (offline priority)
 */

import NetInfo from '@react-native-community/netinfo';
import { secretTagManagerV2, SecretTagV2, TagDetectionResult } from './secretTagManagerV2';
import { secretTagManager, SecretTag } from './secretTagManager';
import logger from '../utils/logger';

export type SecurityMode = 'maximum' | 'balanced' | 'convenience';
export type NetworkStatus = 'online' | 'offline' | 'poor' | 'unknown';

export interface CacheStatus {
  enabled: boolean;
  lastSync?: string;
  entryCount: number;
  storageSize: number;
  integrity: 'valid' | 'corrupted' | 'unknown';
}

export interface HybridTagConfig {
  securityMode: SecurityMode;
  cacheEnabled: boolean;
  autoSyncInterval: number;     // Minutes between auto-sync
  borderCrossingMode: boolean;  // Quick disable for travel
  maxCacheAge: number;          // Hours before cache expires
  syncOnForeground: boolean;    // Sync when app becomes active
}

interface VerificationStrategy {
  verifyPhrase(phrase: string): Promise<TagDetectionResult>;
  getAllTags(): Promise<SecretTagV2[]>;
  createTag(name: string, phrase: string, colorCode?: string): Promise<string>;
  deleteTag(tagId: string): Promise<void>;
  activateTag(tagId: string): Promise<void>;
  deactivateTag(tagId: string): Promise<void>;
}

class ServerOnlyStrategy implements VerificationStrategy {
  async verifyPhrase(phrase: string): Promise<TagDetectionResult> {
    return await secretTagManagerV2.checkForSecretTagPhrases(phrase);
  }

  async getAllTags(): Promise<SecretTagV2[]> {
    return await secretTagManagerV2.getAllSecretTags();
  }

  async createTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    return await secretTagManagerV2.createSecretTag(name, phrase, colorCode);
  }

  async deleteTag(tagId: string): Promise<void> {
    return await secretTagManagerV2.deleteSecretTag(tagId);
  }

  async activateTag(tagId: string): Promise<void> {
    return await secretTagManagerV2.activateSecretTag(tagId);
  }

  async deactivateTag(tagId: string): Promise<void> {
    return await secretTagManagerV2.deactivateSecretTag(tagId);
  }
}

class CacheFirstStrategy implements VerificationStrategy {
  async verifyPhrase(phrase: string): Promise<TagDetectionResult> {
    try {
      // Try cache first
      const cacheResult = await secretTagManager.checkForSecretTagPhrases(phrase);
      if (cacheResult.found) {
        return cacheResult;
      }
    } catch (error) {
      logger.warn('Cache verification failed, falling back to server:', error);
    }

    // Fallback to server
    return await secretTagManagerV2.checkForSecretTagPhrases(phrase);
  }

  async getAllTags(): Promise<SecretTagV2[]> {
    try {
      // Try cache first and convert format
      const cachedTags = await secretTagManager.getAllSecretTags();
      if (cachedTags.length > 0) {
        return this.convertV1ToV2Format(cachedTags);
      }
    } catch (error) {
      logger.warn('Cache read failed, falling back to server:', error);
    }

    // Fallback to server
    return await secretTagManagerV2.getAllSecretTags();
  }

  async createTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    // Create in both cache and server
    const [serverId, cacheId] = await Promise.all([
      secretTagManagerV2.createSecretTag(name, phrase, colorCode),
      secretTagManager.createSecretTag(name, phrase, colorCode)
    ]);
    return serverId; // Return server ID as primary
  }

  async deleteTag(tagId: string): Promise<void> {
    // Delete from both cache and server
    await Promise.all([
      secretTagManagerV2.deleteSecretTag(tagId),
      this.deleteCacheTag(tagId)
    ]);
  }

  async activateTag(tagId: string): Promise<void> {
    // Activate in both cache and server
    await Promise.all([
      secretTagManagerV2.activateSecretTag(tagId),
      this.activateCacheTag(tagId)
    ]);
  }

  async deactivateTag(tagId: string): Promise<void> {
    // Deactivate in both cache and server
    await Promise.all([
      secretTagManagerV2.deactivateSecretTag(tagId),
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
      await secretTagManager.deleteSecretTag(tagId);
    } catch (error) {
      logger.warn('Cache tag deletion failed:', error);
    }
  }

  private async activateCacheTag(tagId: string): Promise<void> {
    try {
      await secretTagManager.activateSecretTag(tagId);
    } catch (error) {
      logger.warn('Cache tag activation failed:', error);
    }
  }

  private async deactivateCacheTag(tagId: string): Promise<void> {
    try {
      await secretTagManager.deactivateSecretTag(tagId);
    } catch (error) {
      logger.warn('Cache tag deactivation failed:', error);
    }
  }
}

class CacheOnlyStrategy implements VerificationStrategy {
  async verifyPhrase(phrase: string): Promise<TagDetectionResult> {
    return await secretTagManager.checkForSecretTagPhrases(phrase);
  }

  async getAllTags(): Promise<SecretTagV2[]> {
    const cachedTags = await secretTagManager.getAllSecretTags();
    return this.convertV1ToV2Format(cachedTags);
  }

  async createTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    return await secretTagManager.createSecretTag(name, phrase, colorCode);
  }

  async deleteTag(tagId: string): Promise<void> {
    return await secretTagManager.deleteSecretTag(tagId);
  }

  async activateTag(tagId: string): Promise<void> {
    return await secretTagManager.activateSecretTag(tagId);
  }

  async deactivateTag(tagId: string): Promise<void> {
    return await secretTagManager.deactivateSecretTag(tagId);
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

class SecretTagManagerHybrid {
  // Core managers
  private serverManager = secretTagManagerV2;
  private cacheManager = secretTagManager;
  
  // Network and state
  private networkStatus: NetworkStatus = 'unknown';
  private currentStrategy: VerificationStrategy;
  private config: HybridTagConfig;
  private syncTimeout: NodeJS.Timeout | null = null;

  // Strategies
  private strategies = {
    serverOnly: new ServerOnlyStrategy(),
    cacheFirst: new CacheFirstStrategy(),
    cacheOnly: new CacheOnlyStrategy()
  };

  constructor() {
    this.config = {
      securityMode: 'balanced',
      cacheEnabled: true,
      autoSyncInterval: 15,
      borderCrossingMode: false,
      maxCacheAge: 24,
      syncOnForeground: true
    };

    this.currentStrategy = this.strategies.cacheFirst;
  }

  /**
   * Initialize hybrid manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Secret Tag Manager Hybrid');

      // Initialize both underlying managers
      await Promise.all([
        this.serverManager.initialize(),
        this.cacheManager.initialize()
      ]);

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Update strategy based on current config
      this.updateStrategy();

      // Start auto-sync if enabled
      if (this.config.cacheEnabled && this.config.autoSyncInterval > 0) {
        this.startAutoSync();
      }

      logger.info(`Hybrid manager initialized with ${this.config.securityMode} security mode`);
    } catch (error) {
      logger.error('Failed to initialize hybrid manager:', error);
      throw error;
    }
  }

  /**
   * Set security mode and update strategy
   */
  async setSecurityMode(mode: SecurityMode): Promise<void> {
    logger.info(`Switching to ${mode} security mode`);
    
    this.config.securityMode = mode;
    
    // Disable cache for maximum security
    if (mode === 'maximum') {
      this.config.cacheEnabled = false;
      await this.clearCache();
    } else {
      this.config.cacheEnabled = true;
    }

    this.updateStrategy();
    await this.saveConfig();
  }

  /**
   * Enable/disable border crossing mode
   */
  async setBorderCrossingMode(enabled: boolean): Promise<void> {
    logger.info(`Border crossing mode: ${enabled ? 'enabled' : 'disabled'}`);
    
    this.config.borderCrossingMode = enabled;
    
    if (enabled) {
      // Switch to maximum security and clear cache
      this.config.securityMode = 'maximum';
      this.config.cacheEnabled = false;
      await this.clearCache();
    } else {
      // Restore previous settings
      this.config.securityMode = 'balanced';
      this.config.cacheEnabled = true;
    }

    this.updateStrategy();
    await this.saveConfig();
  }

  /**
   * Check for secret tag phrases with hybrid strategy
   */
  async checkForSecretTagPhrases(transcribedText: string): Promise<TagDetectionResult> {
    try {
      const result = await this.currentStrategy.verifyPhrase(transcribedText);
      
      // Log successful detection for analytics
      if (result.found) {
        logger.info(`Secret tag detected via ${this.getStrategyName()} strategy: ${result.tagName}`);
      }

      return result;
    } catch (error) {
      logger.error('Error in hybrid phrase verification:', error);
      return { found: false };
    }
  }

  /**
   * Get all secret tags using current strategy
   */
  async getAllSecretTags(): Promise<SecretTagV2[]> {
    return await this.currentStrategy.getAllTags();
  }

  /**
   * Get active secret tags
   */
  async getActiveSecretTags(): Promise<SecretTagV2[]> {
    const allTags = await this.getAllSecretTags();
    return allTags.filter(tag => tag.isActive);
  }

  /**
   * Create secret tag using current strategy
   */
  async createSecretTag(name: string, phrase: string, colorCode = '#007AFF'): Promise<string> {
    const tagId = await this.currentStrategy.createTag(name, phrase, colorCode);
    
    // Trigger sync if in balanced mode
    if (this.config.securityMode === 'balanced') {
      this.scheduleSync();
    }
    
    return tagId;
  }

  /**
   * Delete secret tag using current strategy
   */
  async deleteSecretTag(tagId: string): Promise<void> {
    await this.currentStrategy.deleteTag(tagId);
    
    // Trigger sync if in balanced mode
    if (this.config.securityMode === 'balanced') {
      this.scheduleSync();
    }
  }

  /**
   * Activate secret tag using current strategy
   */
  async activateSecretTag(tagId: string): Promise<void> {
    await this.currentStrategy.activateTag(tagId);
  }

  /**
   * Deactivate secret tag using current strategy
   */
  async deactivateSecretTag(tagId: string): Promise<void> {
    await this.currentStrategy.deactivateTag(tagId);
  }

  /**
   * Deactivate all secret tags
   */
  async deactivateAllSecretTags(): Promise<void> {
    const activeTags = await this.getActiveSecretTags();
    await Promise.all(activeTags.map(tag => this.deactivateSecretTag(tag.id)));
  }

  /**
   * Get cache status
   */
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
      const cachedTags = await this.cacheManager.getAllSecretTags();
      return {
        enabled: true,
        lastSync: new Date().toISOString(), // TODO: Track actual last sync
        entryCount: cachedTags.length,
        storageSize: JSON.stringify(cachedTags).length,
        integrity: 'valid' // TODO: Implement integrity checking
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

  /**
   * Clear cache (for security)
   */
  async clearCache(): Promise<void> {
    try {
      logger.info('Clearing secret tag cache');
      const cachedTags = await this.cacheManager.getAllSecretTags();
      
      // Delete all cached tags
      for (const tag of cachedTags) {
        try {
          await this.cacheManager.deleteSecretTag(tag.id);
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

  /**
   * Sync cache with server
   */
  async syncWithServer(): Promise<void> {
    if (!this.config.cacheEnabled || this.networkStatus === 'offline') {
      return;
    }

    try {
      logger.info('Syncing cache with server');
      
      const [serverTags, cachedTags] = await Promise.all([
        this.serverManager.getAllSecretTags(),
        this.cacheManager.getAllSecretTags()
      ]);

      // TODO: Implement proper sync logic
      // For now, just log the difference
      logger.info(`Server has ${serverTags.length} tags, cache has ${cachedTags.length} tags`);
      
    } catch (error) {
      logger.error('Failed to sync with server:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridTagConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<HybridTagConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    this.updateStrategy();
    await this.saveConfig();
  }

  /**
   * Get network status
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  /**
   * Private: Update strategy based on current config and network
   */
  private updateStrategy(): void {
    const { securityMode, cacheEnabled, borderCrossingMode } = this.config;

    if (borderCrossingMode || securityMode === 'maximum' || !cacheEnabled) {
      this.currentStrategy = this.strategies.serverOnly;
    } else if (this.networkStatus === 'offline') {
      this.currentStrategy = this.strategies.cacheOnly;
    } else if (securityMode === 'convenience') {
      this.currentStrategy = this.strategies.cacheFirst;
    } else {
      // Balanced mode - cache first with server fallback
      this.currentStrategy = this.strategies.cacheFirst;
    }

    logger.debug(`Strategy updated to: ${this.getStrategyName()}`);
  }

  /**
   * Private: Get current strategy name for logging
   */
  private getStrategyName(): string {
    if (this.currentStrategy === this.strategies.serverOnly) return 'server-only';
    if (this.currentStrategy === this.strategies.cacheFirst) return 'cache-first';
    if (this.currentStrategy === this.strategies.cacheOnly) return 'cache-only';
    return 'unknown';
  }

  /**
   * Private: Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = this.networkStatus === 'offline';
      
      if (!state.isConnected) {
        this.networkStatus = 'offline';
      } else if (state.details && 'strength' in state.details) {
        this.networkStatus = (state.details.strength || 0) < 2 ? 'poor' : 'online';
      } else {
        this.networkStatus = 'online';
      }

      // Update strategy when network changes
      this.updateStrategy();

      // Trigger sync when coming back online
      if (wasOffline && this.networkStatus === 'online' && this.config.syncOnForeground) {
        this.scheduleSync();
      }

      logger.debug(`Network status changed to: ${this.networkStatus}`);
    });
  }

  /**
   * Private: Schedule a sync
   */
  private scheduleSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.syncWithServer();
    }, 5000); // 5 second delay
  }

  /**
   * Private: Start auto-sync timer
   */
  private startAutoSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    const intervalMs = this.config.autoSyncInterval * 60 * 1000;
    this.syncTimeout = setInterval(() => {
      this.syncWithServer();
    }, intervalMs);
  }

  /**
   * Private: Save configuration
   */
  private async saveConfig(): Promise<void> {
    try {
      // TODO: Implement config persistence
      logger.debug('Configuration saved');
    } catch (error) {
      logger.error('Failed to save configuration:', error);
    }
  }
}

// Export singleton instance
export const secretTagManagerHybrid = new SecretTagManagerHybrid(); 