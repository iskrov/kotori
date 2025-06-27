/**
 * Session Storage Manager
 * 
 * Handles persistence of session metadata (not sensitive data) across app restarts.
 * Ensures no session keys or other sensitive information is stored persistently.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import logger from '../utils/logger';
import {
  SessionPersistenceData,
  SessionMetadata,
  SessionStorageAdapter,
  DeviceFingerprint,
  SessionRecoveryOptions
} from '../types/sessionTypes';

const STORAGE_KEYS = {
  SESSION_METADATA: 'opaque_session_metadata',
  DEVICE_FINGERPRINT: 'device_fingerprint',
  LAST_APP_STATE: 'last_app_state'
} as const;

/**
 * AsyncStorage implementation of SessionStorageAdapter
 */
class AsyncStorageAdapter implements SessionStorageAdapter {
  async store(key: string, data: SessionPersistenceData[]): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      await AsyncStorage.setItem(key, serialized);
    } catch (error) {
      logger.error(`Failed to store session data for key ${key}:`, error);
      throw error;
    }
  }

  async retrieve(key: string): Promise<SessionPersistenceData[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(key);
      if (!serialized) {
        return null;
      }
      return JSON.parse(serialized);
    } catch (error) {
      logger.error(`Failed to retrieve session data for key ${key}:`, error);
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logger.error(`Failed to remove session data for key ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      logger.error('Failed to clear session storage:', error);
      throw error;
    }
  }
}

/**
 * Session Storage Manager
 */
export class SessionStorageManager {
  private static instance: SessionStorageManager;
  private storageAdapter: SessionStorageAdapter;
  private deviceFingerprint: DeviceFingerprint | null = null;
  private isAppInBackground = false;
  private lastBackgroundTime: Date | null = null;

  private constructor() {
    this.storageAdapter = new AsyncStorageAdapter();
    this.setupAppStateHandling();
  }

  public static getInstance(): SessionStorageManager {
    if (!SessionStorageManager.instance) {
      SessionStorageManager.instance = new SessionStorageManager();
    }
    return SessionStorageManager.instance;
  }

  /**
   * Initialize the storage manager and device fingerprinting
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing SessionStorageManager');
      
      // Generate or retrieve device fingerprint
      await this.initializeDeviceFingerprint();
      
      // Clean up expired session metadata
      await this.cleanupExpiredSessions();
      
      logger.info('SessionStorageManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SessionStorageManager:', error);
      throw error;
    }
  }

  /**
   * Store session metadata for persistence
   */
  public async storeSessionMetadata(sessions: SessionMetadata[]): Promise<void> {
    try {
      const persistenceData: SessionPersistenceData[] = sessions.map(session => ({
        tagId: session.tagId,
        tagName: session.tagName,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        deviceFingerprint: session.deviceFingerprint,
        isLocked: session.isLocked,
        lastAccessed: session.lastAccessed.toISOString(),
        accessCount: session.accessCount,
        origin: session.origin
      }));

      await this.storageAdapter.store(STORAGE_KEYS.SESSION_METADATA, persistenceData);
      logger.info(`Stored metadata for ${persistenceData.length} sessions`);
    } catch (error) {
      logger.error('Failed to store session metadata:', error);
      throw error;
    }
  }

  /**
   * Retrieve session metadata for recovery
   */
  public async retrieveSessionMetadata(options: SessionRecoveryOptions = {
    requireReauth: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    allowPartialRecovery: true
  }): Promise<SessionMetadata[]> {
    try {
      const persistenceData = await this.storageAdapter.retrieve(STORAGE_KEYS.SESSION_METADATA);
      
      if (!persistenceData || persistenceData.length === 0) {
        logger.info('No session metadata found for recovery');
        return [];
      }

      const now = new Date();
      const maxAge = options.maxAge || 24 * 60 * 60 * 1000;
      const cutoffTime = new Date(now.getTime() - maxAge);

      const validSessions: SessionMetadata[] = [];

      for (const data of persistenceData) {
        try {
          const createdAt = new Date(data.createdAt);
          const expiresAt = new Date(data.expiresAt);
          const lastAccessed = new Date(data.lastAccessed);

          // Check if session is too old
          if (createdAt < cutoffTime) {
            logger.debug(`Session ${data.tagId} too old, skipping recovery`);
            continue;
          }

          // Check if session has expired
          if (expiresAt < now) {
            logger.debug(`Session ${data.tagId} expired, skipping recovery`);
            continue;
          }

          // Check device fingerprint match
          if (this.deviceFingerprint && data.deviceFingerprint !== this.deviceFingerprint.hash) {
            logger.warn(`Session ${data.tagId} device fingerprint mismatch, skipping recovery`);
            continue;
          }

          const sessionMetadata: SessionMetadata = {
            tagId: data.tagId,
            tagName: data.tagName,
            createdAt,
            expiresAt,
            deviceFingerprint: data.deviceFingerprint,
            isLocked: data.isLocked,
            lastAccessed,
            accessCount: data.accessCount,
            origin: data.origin
          };

          validSessions.push(sessionMetadata);
        } catch (error) {
          logger.warn(`Failed to parse session metadata for ${data.tagId}:`, error);
          if (!options.allowPartialRecovery) {
            throw error;
          }
        }
      }

      logger.info(`Retrieved ${validSessions.length} valid sessions for recovery`);
      return validSessions;
    } catch (error) {
      logger.error('Failed to retrieve session metadata:', error);
      if (options.allowPartialRecovery) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Remove specific session metadata
   */
  public async removeSessionMetadata(tagId: string): Promise<void> {
    try {
      const sessions = await this.retrieveSessionMetadata({ 
        requireReauth: true,
        maxAge: 24 * 60 * 60 * 1000,
        allowPartialRecovery: true 
      });
      const filteredSessions = sessions.filter(session => session.tagId !== tagId);
      await this.storeSessionMetadata(filteredSessions);
      logger.info(`Removed session metadata for tag ${tagId}`);
    } catch (error) {
      logger.error(`Failed to remove session metadata for tag ${tagId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all session metadata
   */
  public async clearSessionMetadata(): Promise<void> {
    try {
      await this.storageAdapter.remove(STORAGE_KEYS.SESSION_METADATA);
      logger.info('Cleared all session metadata');
    } catch (error) {
      logger.error('Failed to clear session metadata:', error);
      throw error;
    }
  }

  /**
   * Get current device fingerprint
   */
  public getDeviceFingerprint(): DeviceFingerprint | null {
    return this.deviceFingerprint;
  }

  /**
   * Check if app was recently backgrounded
   */
  public getBackgroundInfo(): { wasBackgrounded: boolean; duration: number | null } {
    if (!this.lastBackgroundTime) {
      return { wasBackgrounded: false, duration: null };
    }

    const now = new Date();
    const duration = now.getTime() - this.lastBackgroundTime.getTime();
    
    return {
      wasBackgrounded: true,
      duration
    };
  }

  /**
   * Initialize device fingerprinting
   */
  private async initializeDeviceFingerprint(): Promise<void> {
    try {
      // Try to retrieve existing fingerprint
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_FINGERPRINT);
      if (stored) {
        this.deviceFingerprint = JSON.parse(stored);
        logger.debug('Retrieved existing device fingerprint');
        return;
      }

      // Generate new fingerprint
      this.deviceFingerprint = await this.generateDeviceFingerprint();
      
      // Store for future use
      await AsyncStorage.setItem(
        STORAGE_KEYS.DEVICE_FINGERPRINT,
        JSON.stringify(this.deviceFingerprint)
      );
      
      logger.info('Generated new device fingerprint');
    } catch (error) {
      logger.error('Failed to initialize device fingerprint:', error);
      // Continue without fingerprinting if it fails
      this.deviceFingerprint = null;
    }
  }

  /**
   * Generate device fingerprint for session binding
   */
  private async generateDeviceFingerprint(): Promise<DeviceFingerprint> {
    try {
      const platform = Platform.OS;
      const version = Platform.Version.toString();
      
      // Get screen dimensions (if available)
      let screenDimensions = 'unknown';
      if (typeof window !== 'undefined' && window.screen) {
        screenDimensions = `${window.screen.width}x${window.screen.height}`;
      }

      // Get timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Get language
      const language = Intl.DateTimeFormat().resolvedOptions().locale;
      
      // Get user agent (web only)
      let userAgent: string | undefined;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        userAgent = navigator.userAgent;
      }

      // Create fingerprint data
      const fingerprintData = {
        platform,
        version,
        screenDimensions,
        timezone,
        language,
        userAgent
      };

      // Generate hash of fingerprint data
      const hash = await this.hashFingerprint(fingerprintData);

      return {
        ...fingerprintData,
        hash
      };
    } catch (error) {
      logger.error('Failed to generate device fingerprint:', error);
      throw error;
    }
  }

  /**
   * Hash fingerprint data for consistency
   */
  private async hashFingerprint(data: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(data);
      
      // Simple hash implementation for React Native
      let hash = 0;
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(16);
    } catch (error) {
      logger.error('Failed to hash fingerprint:', error);
      return 'unknown';
    }
  }

  /**
   * Setup app state handling for background detection
   */
  private setupAppStateHandling(): void {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        this.isAppInBackground = true;
        this.lastBackgroundTime = new Date();
        logger.debug('App moved to background');
      } else if (nextAppState === 'active' && this.isAppInBackground) {
        this.isAppInBackground = false;
        const backgroundDuration = this.lastBackgroundTime 
          ? new Date().getTime() - this.lastBackgroundTime.getTime()
          : 0;
        logger.debug(`App returned to foreground after ${backgroundDuration}ms`);
      }
    });
  }

  /**
   * Clean up expired session metadata
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const sessions = await this.retrieveSessionMetadata({ 
        requireReauth: true,
        maxAge: 24 * 60 * 60 * 1000,
        allowPartialRecovery: true 
      });
      const now = new Date();
      const validSessions = sessions.filter(session => session.expiresAt > now);
      
      if (validSessions.length < sessions.length) {
        await this.storeSessionMetadata(validSessions);
        logger.info(`Cleaned up ${sessions.length - validSessions.length} expired session metadata`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      // Don't throw - this is cleanup, not critical
    }
  }

  /**
   * Clear all storage data
   */
  public async clearAll(): Promise<void> {
    try {
      await this.storageAdapter.clear();
      this.deviceFingerprint = null;
      this.lastBackgroundTime = null;
      logger.info('Cleared all session storage data');
    } catch (error) {
      logger.error('Failed to clear session storage:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const sessionStorageManager = SessionStorageManager.getInstance(); 