/**
 * Enhanced Session Manager
 * 
 * Orchestrates advanced session management features including persistence,
 * analytics, and cross-platform synchronization for OPAQUE sessions.
 */

import { voicePhraseDetector, VoicePhraseDetector } from './VoicePhraseDetector';
import { sessionStorageManager } from './SessionStorageManager';
import { OpaqueClient } from './crypto/OpaqueClient';
import logger from '../utils/logger';
import {
  SessionMetadata,
  SessionControlOptions,
  SessionEvent,
  SessionEventCallback,
  SessionManagerConfig,
  SessionOperationResult,
  SessionBatchOperation,
  SessionAnalyticsEvent,
  SessionStatistics,
  SessionSecurityMetrics,
  SessionRecoveryOptions
} from '../types/sessionTypes';

/**
 * Enhanced Session Manager
 */
export class SessionManager {
  private static instance: SessionManager;
  private voiceDetector: VoicePhraseDetector;
  private opaqueClient: OpaqueClient;
  private eventCallbacks: Set<SessionEventCallback> = new Set();
  private sessionMetadata: Map<string, SessionMetadata> = new Map();
  private config: SessionManagerConfig;
  private analyticsEvents: SessionAnalyticsEvent[] = [];
  private isInitialized = false;

  // Default configuration
  private static readonly DEFAULT_CONFIG: SessionManagerConfig = {
    defaultTimeout: 15 * 60 * 1000, // 15 minutes
    maxConcurrentSessions: 5,
    persistenceTTL: 24 * 60 * 60 * 1000, // 24 hours
    analyticsRetentionDays: 30,
    securityThresholds: {
      maxConcurrentDevices: 3,
      suspiciousActivityThreshold: 10,
      maxSessionExtensions: 5
    },
    enableCrossPlatformSync: false,
    enableSessionAnalytics: true,
    enableDeviceFingerprinting: true
  };

  private constructor() {
    this.voiceDetector = voicePhraseDetector;
    this.opaqueClient = OpaqueClient.getInstance();
    this.config = { ...SessionManager.DEFAULT_CONFIG };
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initialize the enhanced session manager
   */
  public async initialize(config?: Partial<SessionManagerConfig>): Promise<void> {
    if (this.isInitialized) {
      logger.debug('SessionManager already initialized');
      return;
    }

    try {
      logger.info('Initializing enhanced SessionManager');

      // Merge provided config with defaults
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Initialize dependencies
      await sessionStorageManager.initialize();
      await this.opaqueClient.initialize();

      // Attempt session recovery
      await this.recoverSessions();

      this.isInitialized = true;
      logger.info('Enhanced SessionManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SessionManager:', error);
      throw error;
    }
  }

  /**
   * Manually extend a session's timeout
   */
  public async extendSession(
    tagId: string, 
    options: SessionControlOptions = {}
  ): Promise<SessionOperationResult> {
    try {
      const extendBy = options.extendBy || this.config.defaultTimeout;
      const previousState = this.sessionMetadata.get(tagId);

      if (!previousState) {
        return {
          success: false,
          tagId,
          operation: 'extend',
          error: 'Session not found'
        };
      }

      if (previousState.isLocked && !options.force) {
        return {
          success: false,
          tagId,
          operation: 'extend',
          error: 'Session is locked'
        };
      }

      // Update session metadata
      const now = new Date();
      const newState: SessionMetadata = {
        ...previousState,
        expiresAt: new Date(previousState.expiresAt.getTime() + extendBy),
        lastAccessed: now,
        accessCount: previousState.accessCount + 1
      };

      this.sessionMetadata.set(tagId, newState);
      await this.persistSessionMetadata();

      // Record analytics
      await this.recordAnalyticsEvent({
        type: 'extended',
        tagId,
        timestamp: now,
        deviceFingerprint: newState.deviceFingerprint,
        metadata: { extendBy, reason: options.reason || 'manual_extension' }
      });

      // Emit event
      this.emitEvent({
        type: 'session-extended',
        tagId,
        timestamp: now,
        data: { extendBy, newExpiresAt: newState.expiresAt }
      });

      logger.info(`Session extended for tag ${tagId} by ${extendBy}ms`);

      return {
        success: true,
        tagId,
        operation: 'extend',
        previousState,
        newState
      };
    } catch (error) {
      logger.error(`Failed to extend session for tag ${tagId}:`, error);
      return {
        success: false,
        tagId,
        operation: 'extend',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Lock a session to prevent access
   */
  public async lockSession(
    tagId: string, 
    options: SessionControlOptions = {}
  ): Promise<SessionOperationResult> {
    try {
      const previousState = this.sessionMetadata.get(tagId);

      if (!previousState) {
        return {
          success: false,
          tagId,
          operation: 'lock',
          error: 'Session not found'
        };
      }

      if (previousState.isLocked) {
        return {
          success: false,
          tagId,
          operation: 'lock',
          error: 'Session already locked'
        };
      }

      // Update session metadata
      const now = new Date();
      const newState: SessionMetadata = {
        ...previousState,
        isLocked: true,
        lastAccessed: now
      };

      this.sessionMetadata.set(tagId, newState);
      await this.persistSessionMetadata();

      // Record analytics and emit event
      await this.recordAnalyticsEvent({
        type: 'locked',
        tagId,
        timestamp: now,
        deviceFingerprint: newState.deviceFingerprint,
        metadata: { reason: options.reason || 'manual_lock' }
      });

      this.emitEvent({
        type: 'session-locked',
        tagId,
        timestamp: now,
        data: { reason: options.reason }
      });

      logger.info(`Session locked for tag ${tagId}`);

      return {
        success: true,
        tagId,
        operation: 'lock',
        previousState,
        newState
      };
    } catch (error) {
      logger.error(`Failed to lock session for tag ${tagId}:`, error);
      return {
        success: false,
        tagId,
        operation: 'lock',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unlock a session to allow access
   */
  public async unlockSession(
    tagId: string, 
    options: SessionControlOptions = {}
  ): Promise<SessionOperationResult> {
    try {
      const previousState = this.sessionMetadata.get(tagId);

      if (!previousState) {
        return {
          success: false,
          tagId,
          operation: 'unlock',
          error: 'Session not found'
        };
      }

      if (!previousState.isLocked) {
        return {
          success: false,
          tagId,
          operation: 'unlock',
          error: 'Session not locked'
        };
      }

      // Update session metadata
      const now = new Date();
      const newState: SessionMetadata = {
        ...previousState,
        isLocked: false,
        lastAccessed: now
      };

      this.sessionMetadata.set(tagId, newState);
      await this.persistSessionMetadata();

      // Record analytics and emit event
      await this.recordAnalyticsEvent({
        type: 'unlocked',
        tagId,
        timestamp: now,
        deviceFingerprint: newState.deviceFingerprint,
        metadata: { reason: options.reason || 'manual_unlock' }
      });

      this.emitEvent({
        type: 'session-unlocked',
        tagId,
        timestamp: now,
        data: { reason: options.reason }
      });

      logger.info(`Session unlocked for tag ${tagId}`);

      return {
        success: true,
        tagId,
        operation: 'unlock',
        previousState,
        newState
      };
    } catch (error) {
      logger.error(`Failed to unlock session for tag ${tagId}:`, error);
      return {
        success: false,
        tagId,
        operation: 'unlock',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get session statistics
   */
  public getSessionStatistics(): SessionStatistics {
    const activeSessions = Array.from(this.sessionMetadata.values());
    const now = new Date();
    
    // Count sessions by origin
    const sessionsByOrigin = activeSessions.reduce((acc, session) => {
      acc[session.origin] = (acc[session.origin] || 0) + 1;
      return acc;
    }, {} as Record<'voice' | 'manual' | 'recovery', number>);

    // Most used tags
    const tagUsage = this.analyticsEvents.reduce((acc, event) => {
      if (event.type === 'accessed') {
        const existing = acc.find(item => item.tagId === event.tagId);
        if (existing) {
          existing.count++;
        } else {
          const session = this.sessionMetadata.get(event.tagId);
          acc.push({
            tagId: event.tagId,
            tagName: session?.tagName || 'Unknown',
            count: 1
          });
        }
      }
      return acc;
    }, [] as Array<{ tagId: string; tagName: string; count: number }>);

    tagUsage.sort((a, b) => b.count - a.count);

    return {
      totalSessions: this.analyticsEvents.filter(e => e.type === 'created').length,
      activeSessions: activeSessions.length,
      averageSessionDuration: 15 * 60 * 1000, // Simplified calculation
      mostUsedTags: tagUsage.slice(0, 10),
      sessionsByOrigin,
      dailySessionCount: this.analyticsEvents.filter(e => 
        e.type === 'created' && 
        e.timestamp >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
      ).length,
      weeklySessionCount: this.analyticsEvents.filter(e => 
        e.type === 'created' && 
        e.timestamp >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      ).length
    };
  }

  /**
   * Get security metrics
   */
  public getSecurityMetrics(): SessionSecurityMetrics {
    const activeSessions = Array.from(this.sessionMetadata.values());
    const deviceFingerprints = [...new Set(activeSessions.map(s => s.deviceFingerprint))];
    
    const suspiciousActivityDetected = 
      deviceFingerprints.length > this.config.securityThresholds.maxConcurrentDevices ||
      activeSessions.length > this.config.maxConcurrentSessions;

    const securityEvents = this.analyticsEvents.filter(e => 
      e.metadata?.security === true
    );
    const lastSecurityEvent = securityEvents.length > 0 
      ? new Date(Math.max(...securityEvents.map(e => e.timestamp.getTime())))
      : null;

    let securityScore = 100;
    if (suspiciousActivityDetected) securityScore -= 30;
    if (deviceFingerprints.length > 2) securityScore -= 20;
    
    return {
      suspiciousActivityDetected,
      concurrentSessionCount: activeSessions.length,
      deviceFingerprints,
      lastSecurityEvent,
      securityScore: Math.max(0, securityScore)
    };
  }

  /**
   * Add event listener
   */
  public addEventListener(callback: SessionEventCallback): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(callback: SessionEventCallback): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * Get current configuration
   */
  public getConfig(): SessionManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<SessionManagerConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('SessionManager configuration updated');
  }

  /**
   * Recover sessions from persistent storage
   */
  private async recoverSessions(options?: SessionRecoveryOptions): Promise<void> {
    try {
      logger.info('Attempting session recovery');

      const recoveredMetadata = await sessionStorageManager.retrieveSessionMetadata(options);
      
      if (recoveredMetadata.length === 0) {
        logger.info('No sessions found for recovery');
        return;
      }

      // Update our metadata map
      recoveredMetadata.forEach(metadata => {
        this.sessionMetadata.set(metadata.tagId, metadata);
      });

      logger.info(`Recovered ${recoveredMetadata.length} session metadata objects`);
    } catch (error) {
      logger.error('Session recovery failed:', error);
    }
  }

  /**
   * Persist session metadata
   */
  private async persistSessionMetadata(): Promise<void> {
    try {
      const sessions = Array.from(this.sessionMetadata.values());
      await sessionStorageManager.storeSessionMetadata(sessions);
    } catch (error) {
      logger.error('Failed to persist session metadata:', error);
    }
  }

  /**
   * Record analytics event
   */
  private async recordAnalyticsEvent(event: SessionAnalyticsEvent): Promise<void> {
    if (!this.config.enableSessionAnalytics) {
      return;
    }

    try {
      this.analyticsEvents.push(event);

      // Cleanup old events
      const cutoff = new Date(Date.now() - this.config.analyticsRetentionDays * 24 * 60 * 60 * 1000);
      this.analyticsEvents = this.analyticsEvents.filter(e => e.timestamp > cutoff);

      logger.debug(`Recorded analytics event: ${event.type} for tag ${event.tagId}`);
    } catch (error) {
      logger.error('Failed to record analytics event:', error);
    }
  }

  /**
   * Emit session event to listeners
   */
  private emitEvent(event: SessionEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        logger.error('Error in session event callback:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up SessionManager');

      this.sessionMetadata.clear();
      this.analyticsEvents = [];
      this.eventCallbacks.clear();

      await this.voiceDetector.cleanup();

      this.isInitialized = false;
      logger.info('SessionManager cleanup complete');
    } catch (error) {
      logger.error('Error during SessionManager cleanup:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance(); 