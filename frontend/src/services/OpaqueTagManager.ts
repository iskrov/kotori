/**
 * OPAQUE Tag Manager
 * 
 * Service for managing OPAQUE-based secret tags with enhanced security
 * features while maintaining compatibility with existing tag systems.
 */

import { OpaqueClient } from './crypto/OpaqueClient';
import { sessionManager } from './SessionManager';
import { voicePhraseDetector } from './VoicePhraseDetector';
import { sessionStorageManager } from './SessionStorageManager';
import logger from '../utils/logger';
import {
  OpaqueSecretTag,
  OpaqueTagCreationRequest,
  OpaqueTagCreationResponse,
  OpaqueTagAuthRequest,
  OpaqueTagAuthResponse,
  OpaqueTagMigration,
  OpaqueTagSettings,
  OpaqueTagAnalyticsEvent
} from '../types/opaqueTypes';
import { SecretTag } from '../types';

/**
 * OPAQUE Tag Manager Service
 */
export class OpaqueTagManager {
  private static instance: OpaqueTagManager;
  private opaqueClient: OpaqueClient;
  private isInitialized = false;
  private analyticsEvents: OpaqueTagAnalyticsEvent[] = [];
  
  // Default settings
  private defaultSettings: OpaqueTagSettings = {
    enableDeviceBinding: true,
    requirePhraseConfirmation: true,
    sessionTimeout: 15, // minutes
    maxSessionExtensions: 5,
    enableAnalytics: true,
    securityLevel: 'standard'
  };

  private constructor() {
    this.opaqueClient = OpaqueClient.getInstance();
  }

  public static getInstance(): OpaqueTagManager {
    if (!OpaqueTagManager.instance) {
      OpaqueTagManager.instance = new OpaqueTagManager();
    }
    return OpaqueTagManager.instance;
  }

  /**
   * Initialize the OPAQUE tag manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('OpaqueTagManager already initialized');
      return;
    }

    try {
      logger.info('Initializing OpaqueTagManager');

      // Initialize dependencies
      await this.opaqueClient.initialize();
      await sessionManager.initialize();

      // Load existing analytics events
      await this.loadAnalyticsEvents();

      this.isInitialized = true;
      logger.info('OpaqueTagManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpaqueTagManager:', error);
      throw error;
    }
  }

  /**
   * Create a new OPAQUE-based secret tag
   */
  public async createOpaqueTag(request: OpaqueTagCreationRequest): Promise<OpaqueTagCreationResponse> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`Creating OPAQUE tag: ${request.tag_name}`);

      // Get device fingerprint
      const deviceFingerprint = sessionStorageManager.getDeviceFingerprint();
      if (!deviceFingerprint) {
        throw new Error('Device fingerprinting required for OPAQUE tags');
      }

      // Validate request
      this.validateTagCreationRequest(request);

      // Generate unique tag ID
      const tagId = this.generateTagId();

      // Perform OPAQUE registration
      const registrationResult = await this.opaqueClient.register(
        tagId,
        request.activation_phrase
      );

      if (!registrationResult.success) {
        throw new Error(registrationResult.error || 'OPAQUE registration failed');
      }

      // Create OPAQUE secret tag
      const opaqueTag: OpaqueSecretTag = {
        id: tagId,
        tag_name: request.tag_name,
        color_code: request.color_code,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 1, // TODO: Get from auth context
        
        // OPAQUE-specific fields
        opaque_server_public_key: registrationResult.serverPublicKey,
        auth_method: 'opaque',
        device_fingerprint: deviceFingerprint.hash,
        
        // Enhanced security fields
        security_level: request.security_level,
        last_authentication: new Date().toISOString(),
        authentication_count: 0
      };

      // Store tag locally (encrypted)
      await this.storeOpaqueTag(opaqueTag);

      // Create initial session
      const sessionData = await this.createInitialSession(tagId, request.activation_phrase);

      // Record analytics event
      await this.recordAnalyticsEvent({
        type: 'creation',
        tagId,
        timestamp: new Date(),
        deviceFingerprint: deviceFingerprint.hash,
        securityLevel: request.security_level,
        metadata: {
          tagName: request.tag_name,
          authMethod: 'manual'
        }
      });

      logger.info(`OPAQUE tag created successfully: ${tagId}`);

      return {
        success: true,
        tag: opaqueTag,
        session_data: sessionData
      };
    } catch (error) {
      logger.error('Failed to create OPAQUE tag:', error);
      
      // Record error event
      await this.recordAnalyticsEvent({
        type: 'error',
        tagId: request.tag_name, // Use tag name as fallback
        timestamp: new Date(),
        deviceFingerprint: request.device_fingerprint,
        securityLevel: request.security_level,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'creation'
        }
      });

      return {
        success: false,
        tag: {} as OpaqueSecretTag,
        error: error instanceof Error ? error.message : 'Failed to create OPAQUE tag'
      };
    }
  }

  /**
   * Authenticate with an OPAQUE tag
   */
  public async authenticateOpaqueTag(request: OpaqueTagAuthRequest): Promise<OpaqueTagAuthResponse> {
    try {
      logger.info(`Authenticating OPAQUE tag: ${request.tag_id}`);

      // Get device fingerprint
      const deviceFingerprint = sessionStorageManager.getDeviceFingerprint();
      if (!deviceFingerprint) {
        throw new Error('Device fingerprinting required for OPAQUE authentication');
      }

      // Verify device fingerprint matches
      const tag = await this.getOpaqueTag(request.tag_id);
      if (tag && tag.device_fingerprint !== deviceFingerprint.hash) {
        throw new Error('Device fingerprint mismatch');
      }

      // Perform OPAQUE authentication
      const authResult = await this.opaqueClient.authenticate(
        request.tag_id,
        request.activation_phrase
      );

      if (!authResult.success) {
        throw new Error(authResult.error || 'OPAQUE authentication failed');
      }

      // Update tag authentication info
      if (tag) {
        tag.last_authentication = new Date().toISOString();
        tag.authentication_count = (tag.authentication_count || 0) + 1;
        await this.updateOpaqueTag(tag);
      }

      // Create session data
      const sessionData = {
        session_key: authResult.sessionKey!,
        vault_key: authResult.vaultKey!,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
      };

      // Record analytics event
      await this.recordAnalyticsEvent({
        type: 'authentication',
        tagId: request.tag_id,
        timestamp: new Date(),
        deviceFingerprint: deviceFingerprint.hash,
        authMethod: 'manual',
        securityLevel: tag?.security_level || 'standard',
        metadata: {
          authenticationCount: tag?.authentication_count || 1
        }
      });

      logger.info(`OPAQUE tag authenticated successfully: ${request.tag_id}`);

      return {
        success: true,
        session_data: sessionData
      };
    } catch (error) {
      logger.error('Failed to authenticate OPAQUE tag:', error);
      
      // Record error event
      await this.recordAnalyticsEvent({
        type: 'error',
        tagId: request.tag_id,
        timestamp: new Date(),
        deviceFingerprint: request.device_fingerprint,
        securityLevel: 'standard',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'authentication'
        }
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Migrate a legacy secret tag to OPAQUE
   */
  public async migrateToOpaque(
    legacyTag: SecretTag,
    newActivationPhrase: string
  ): Promise<OpaqueTagCreationResponse> {
    try {
      logger.info(`Migrating legacy tag to OPAQUE: ${legacyTag.id}`);

      // Get device fingerprint
      const deviceFingerprint = sessionStorageManager.getDeviceFingerprint();
      if (!deviceFingerprint) {
        throw new Error('Device fingerprinting required for migration');
      }

      // Create migration request
      const migrationRequest: OpaqueTagCreationRequest = {
        tag_name: legacyTag.tag_name,
        activation_phrase: newActivationPhrase,
        color_code: legacyTag.color_code,
        device_fingerprint: deviceFingerprint.hash,
        security_level: 'standard'
      };

      // Create new OPAQUE tag
      const result = await this.createOpaqueTag(migrationRequest);

      if (result.success && result.tag) {
        // Mark as migrated
        result.tag.migrated_from = legacyTag.id;
        result.tag.migration_date = new Date().toISOString();
        await this.updateOpaqueTag(result.tag);

        // Record migration event
        await this.recordAnalyticsEvent({
          type: 'migration',
          tagId: result.tag.id,
          timestamp: new Date(),
          deviceFingerprint: deviceFingerprint.hash,
          securityLevel: 'standard',
          metadata: {
            legacyTagId: legacyTag.id,
            migrationSuccess: true
          }
        });

        logger.info(`Migration completed successfully: ${legacyTag.id} -> ${result.tag.id}`);
      }

      return result;
    } catch (error) {
      logger.error('Failed to migrate to OPAQUE:', error);
      return {
        success: false,
        tag: {} as OpaqueSecretTag,
        error: error instanceof Error ? error.message : 'Migration failed'
      };
    }
  }

  /**
   * Get migration information for a legacy tag
   */
  public getMigrationInfo(legacyTag: SecretTag): OpaqueTagMigration {
    const securityBenefits = [
      'Zero-knowledge authentication',
      'Device binding protection',
      'Enhanced session management',
      'Advanced security analytics',
      'Protection against server breaches'
    ];

    const risks = [
      'New activation phrase required',
      'Cannot recover if phrase is forgotten',
      'Requires device re-authentication'
    ];

    return {
      canMigrate: true,
      legacyTag,
      estimatedTime: 30, // seconds
      securityBenefits,
      risks,
      requiresReAuth: true
    };
  }

  /**
   * Get all OPAQUE tags for current user
   */
  public async getOpaqueTags(): Promise<OpaqueSecretTag[]> {
    try {
      // TODO: Implement storage retrieval
      logger.debug('Retrieving OPAQUE tags');
      return [];
    } catch (error) {
      logger.error('Failed to retrieve OPAQUE tags:', error);
      return [];
    }
  }

  /**
   * Delete an OPAQUE tag
   */
  public async deleteOpaqueTag(tagId: string): Promise<boolean> {
    try {
      logger.info(`Deleting OPAQUE tag: ${tagId}`);

      // Deactivate any active sessions
      if (await voicePhraseDetector.isSessionActive(tagId)) {
        await voicePhraseDetector.deactivateSession(tagId);
      }

      // Remove from OPAQUE client
      await this.opaqueClient.cleanup();

      // Remove from local storage
      await this.removeOpaqueTag(tagId);

      logger.info(`OPAQUE tag deleted successfully: ${tagId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete OPAQUE tag:', error);
      return false;
    }
  }

  /**
   * Get analytics events
   */
  public getAnalyticsEvents(): OpaqueTagAnalyticsEvent[] {
    return [...this.analyticsEvents];
  }

  /**
   * Validate tag creation request
   */
  private validateTagCreationRequest(request: OpaqueTagCreationRequest): void {
    if (!request.tag_name || request.tag_name.trim().length < 2) {
      throw new Error('Tag name must be at least 2 characters');
    }

    if (!request.activation_phrase || request.activation_phrase.trim().length < 3) {
      throw new Error('Activation phrase must be at least 3 characters');
    }

    if (!request.color_code || !request.color_code.match(/^#[0-9A-Fa-f]{6}$/)) {
      throw new Error('Invalid color code');
    }

    if (!request.device_fingerprint) {
      throw new Error('Device fingerprint required');
    }
  }

  /**
   * Generate unique tag ID
   */
  private generateTagId(): string {
    return `opaque_tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create initial session after tag creation
   */
  private async createInitialSession(tagId: string, phrase: string) {
    const authResult = await this.opaqueClient.authenticate(tagId, phrase);
    
    if (!authResult.success) {
      throw new Error('Failed to create initial session');
    }

    return {
      session_key: authResult.sessionKey!,
      vault_key: authResult.vaultKey!,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  }

  /**
   * Store OPAQUE tag locally
   */
  private async storeOpaqueTag(tag: OpaqueSecretTag): Promise<void> {
    // TODO: Implement encrypted local storage
    logger.debug(`Storing OPAQUE tag: ${tag.id}`);
  }

  /**
   * Get OPAQUE tag by ID
   */
  private async getOpaqueTag(tagId: string): Promise<OpaqueSecretTag | null> {
    // TODO: Implement storage retrieval
    logger.debug(`Retrieving OPAQUE tag: ${tagId}`);
    return null;
  }

  /**
   * Update OPAQUE tag
   */
  private async updateOpaqueTag(tag: OpaqueSecretTag): Promise<void> {
    tag.updated_at = new Date().toISOString();
    // TODO: Implement storage update
    logger.debug(`Updating OPAQUE tag: ${tag.id}`);
  }

  /**
   * Remove OPAQUE tag from storage
   */
  private async removeOpaqueTag(tagId: string): Promise<void> {
    // TODO: Implement storage removal
    logger.debug(`Removing OPAQUE tag: ${tagId}`);
  }

  /**
   * Record analytics event
   */
  private async recordAnalyticsEvent(event: OpaqueTagAnalyticsEvent): Promise<void> {
    try {
      this.analyticsEvents.push(event);
      
      // Keep only last 1000 events
      if (this.analyticsEvents.length > 1000) {
        this.analyticsEvents = this.analyticsEvents.slice(-1000);
      }

      // TODO: Persist to storage
      logger.debug(`Recorded analytics event: ${event.type} for tag ${event.tagId}`);
    } catch (error) {
      logger.error('Failed to record analytics event:', error);
    }
  }

  /**
   * Load analytics events from storage
   */
  private async loadAnalyticsEvents(): Promise<void> {
    try {
      // TODO: Load from storage
      logger.debug('Loading analytics events');
    } catch (error) {
      logger.error('Failed to load analytics events:', error);
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up OpaqueTagManager');
      
      this.analyticsEvents = [];
      this.isInitialized = false;
      
      logger.info('OpaqueTagManager cleanup complete');
    } catch (error) {
      logger.error('Error during OpaqueTagManager cleanup:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const opaqueTagManager = OpaqueTagManager.getInstance(); 