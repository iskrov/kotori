/**
 * Voice Phrase Detector Service
 * 
 * Integrates OPAQUE zero-knowledge authentication with voice phrase detection.
 * Replaces the legacy tag manager phrase detection with secure OPAQUE protocol.
 * 
 * Features:
 * - OPAQUE-based authentication for voice phrases
 * - Automatic session management for successful authentications  
 * - Secure memory management with automatic cleanup
 * - Performance-optimized for voice processing pipeline
 */

import { OpaqueClient } from './crypto/OpaqueClient';
import { OpaqueError, AuthenticationError, NetworkError } from './crypto/errors';
import { SecretTag, SessionData, AuthenticationResult } from './crypto/types';
import logger from '../utils/logger';

export interface VoiceAuthenticationResult {
  success: boolean;
  tagId?: string;
  tagName?: string;
  sessionKey?: Uint8Array;
  vaultKey?: Uint8Array;
  error?: string;
}

export interface PhraseDetectionResult {
  found: boolean;
  tagId?: string;
  tagName?: string;
  action?: 'activate' | 'deactivate' | 'panic';
}

/**
 * Service for detecting and authenticating voice phrases using OPAQUE protocol
 */
export class VoicePhraseDetector {
  private static instance: VoicePhraseDetector;
  private opaqueClient: OpaqueClient;
  private activeSessions: Map<string, SessionData> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // Configuration
  private readonly SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_AUTHENTICATION_TIME_MS = 2000; // 2 seconds max
  private readonly PHRASE_NORMALIZATION_REGEX = /[^a-zA-Z0-9\s]/g;

  private constructor() {
    this.opaqueClient = OpaqueClient.getInstance();
  }

  public static getInstance(): VoicePhraseDetector {
    if (!VoicePhraseDetector.instance) {
      VoicePhraseDetector.instance = new VoicePhraseDetector();
    }
    return VoicePhraseDetector.instance;
  }

  /**
   * Main entry point: Check if transcribed voice contains secret phrases
   * and authenticate using OPAQUE protocol
   */
  public async checkForSecretPhrase(transcribedText: string): Promise<PhraseDetectionResult> {
    if (!transcribedText?.trim()) {
      return { found: false };
    }

    try {
      logger.info(`[VoicePhraseDetector] Checking phrase: "${transcribedText}"`);
      
      // Normalize the transcribed text for consistent matching
      const normalizedPhrase = this.normalizePhrase(transcribedText);
      
      // Check for panic phrase first (highest priority)
      if (this.isPanicPhrase(normalizedPhrase)) {
        logger.warn('[VoicePhraseDetector] Panic phrase detected');
        await this.handlePanicMode();
        return {
          found: true,
          action: 'panic'
        };
      }

      // Attempt OPAQUE authentication with the normalized phrase
      const authResult = await this.authenticateWithOPAQUE(normalizedPhrase);
      
      if (authResult.success && authResult.tagId) {
        // Check if tag is currently active
        const isActive = this.isSessionActive(authResult.tagId);
        const action = isActive ? 'deactivate' : 'activate';
        
        if (action === 'activate') {
          // Create new session for successful authentication
          await this.createSession(authResult.tagId, authResult.tagName!, authResult.sessionKey!, authResult.vaultKey!);
        } else {
          // Deactivate existing session
          await this.deactivateSession(authResult.tagId);
        }

        logger.info(`[VoicePhraseDetector] Authentication successful: ${authResult.tagName} (${action})`);
        
        return {
          found: true,
          tagId: authResult.tagId,
          tagName: authResult.tagName,
          action
        };
      }

      // No authentication successful
      logger.info('[VoicePhraseDetector] No secret phrase detected');
      return { found: false };

    } catch (error) {
      logger.error('[VoicePhraseDetector] Error during phrase detection:', error);
      return { found: false };
    }
  }

  /**
   * Authenticate a phrase using OPAQUE protocol
   */
  private async authenticateWithOPAQUE(phrase: string): Promise<VoiceAuthenticationResult> {
    const startTime = Date.now();
    
    try {
      // Get all available secret tags (server will return tag metadata without secrets)
      const availableTags = await this.getAvailableSecretTags();
      
      if (availableTags.length === 0) {
        return { success: false, error: 'No secret tags configured' };
      }

      // Try to authenticate with each tag using OPAQUE
      for (const tag of availableTags) {
        try {
          // Check timeout constraint
          if (Date.now() - startTime > this.MAX_AUTHENTICATION_TIME_MS) {
            logger.warn('[VoicePhraseDetector] Authentication timeout reached');
            break;
          }

          // Attempt OPAQUE authentication with tag ID and phrase
          const authResult = await this.opaqueClient.authenticate(tag.id, phrase);
          
          if (authResult.success) {
            // Derive vault key from session key
            const vaultKey = await this.opaqueClient.deriveVaultKey(authResult.sessionKey!, tag.id);
            
            return {
              success: true,
              tagId: tag.id,
              tagName: tag.name,
              sessionKey: authResult.sessionKey,
              vaultKey
            };
          }
        } catch (error) {
          // Continue trying other tags - don't fail immediately
          if (error instanceof AuthenticationError) {
            logger.debug(`[VoicePhraseDetector] Authentication failed for tag ${tag.id}: ${error.message}`);
          } else {
            logger.warn(`[VoicePhraseDetector] Unexpected error for tag ${tag.id}:`, error);
          }
          continue;
        }
      }

      // No successful authentication
      const elapsedTime = Date.now() - startTime;
      logger.info(`[VoicePhraseDetector] Authentication failed for all tags (${elapsedTime}ms)`);
      
      return { success: false, error: 'Authentication failed' };

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      logger.error(`[VoicePhraseDetector] OPAQUE authentication error (${elapsedTime}ms):`, error);
      
      if (error instanceof NetworkError) {
        return { success: false, error: 'Network error during authentication' };
      } else if (error instanceof OpaqueError) {
        return { success: false, error: 'Authentication protocol error' };
      }
      
      return { success: false, error: 'Unknown authentication error' };
    }
  }

  /**
   * Get available secret tags from server (metadata only, no secrets)
   */
  private async getAvailableSecretTags(): Promise<SecretTag[]> {
    try {
      // This would call the backend API to get user's secret tag metadata
      // Implementation would depend on the existing API structure
      // For now, return empty array - this will be implemented in subsequent tasks
      logger.info('[VoicePhraseDetector] Getting available secret tags from server');
      return [];
    } catch (error) {
      logger.error('[VoicePhraseDetector] Failed to get available secret tags:', error);
      return [];
    }
  }

  /**
   * Create a new active session for successful authentication
   */
  private async createSession(tagId: string, tagName: string, sessionKey: Uint8Array, vaultKey: Uint8Array): Promise<void> {
    try {
      // Clear any existing session for this tag
      await this.deactivateSession(tagId);

      // Create new session
      const sessionData: SessionData = {
        tagId,
        tagName,
        sessionKey,
        vaultKey,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT_MS)
      };

      this.activeSessions.set(tagId, sessionData);

      // Set automatic cleanup timeout
      const timeoutId = setTimeout(() => {
        this.deactivateSession(tagId);
      }, this.SESSION_TIMEOUT_MS);

      this.sessionTimeouts.set(tagId, timeoutId);

      logger.info(`[VoicePhraseDetector] Session created for tag: ${tagName} (expires in ${this.SESSION_TIMEOUT_MS / 1000}s)`);
    } catch (error) {
      logger.error('[VoicePhraseDetector] Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Deactivate an active session and clean up memory
   */
  private async deactivateSession(tagId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(tagId);
      if (session) {
        // Clear sensitive data from memory
        session.sessionKey.fill(0);
        session.vaultKey.fill(0);
        
        this.activeSessions.delete(tagId);
        logger.info(`[VoicePhraseDetector] Session deactivated for tag: ${session.tagName}`);
      }

      // Clear timeout if exists
      const timeoutId = this.sessionTimeouts.get(tagId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.sessionTimeouts.delete(tagId);
      }
    } catch (error) {
      logger.error('[VoicePhraseDetector] Error deactivating session:', error);
    }
  }

  /**
   * Check if a session is currently active for a tag
   */
  public isSessionActive(tagId: string): boolean {
    const session = this.activeSessions.get(tagId);
    if (!session) {
      return false;
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      this.deactivateSession(tagId);
      return false;
    }

    return true;
  }

  /**
   * Get active session data for a tag
   */
  public getActiveSession(tagId: string): SessionData | null {
    if (!this.isSessionActive(tagId)) {
      return null;
    }
    return this.activeSessions.get(tagId) || null;
  }

  /**
   * Get all currently active sessions
   */
  public getActiveSessions(): SessionData[] {
    const activeSessions: SessionData[] = [];
    
    for (const [tagId, session] of this.activeSessions) {
      if (this.isSessionActive(tagId)) {
        activeSessions.push(session);
      }
    }
    
    return activeSessions;
  }

  /**
   * Handle panic mode - clear all sessions and sensitive data
   */
  private async handlePanicMode(): Promise<void> {
    try {
      logger.warn('[VoicePhraseDetector] Entering panic mode - clearing all sessions');

      // Deactivate all sessions
      const tagIds = Array.from(this.activeSessions.keys());
      for (const tagId of tagIds) {
        await this.deactivateSession(tagId);
      }

      // Clear OPAQUE client memory
      await this.opaqueClient.clearMemory();

      logger.info('[VoicePhraseDetector] Panic mode complete - all sensitive data cleared');
    } catch (error) {
      logger.error('[VoicePhraseDetector] Error during panic mode:', error);
    }
  }

  /**
   * Normalize phrase for consistent matching
   */
  private normalizePhrase(phrase: string): string {
    return phrase
      .toLowerCase()
      .trim()
      .replace(this.PHRASE_NORMALIZATION_REGEX, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Check if phrase is a panic phrase
   */
  private isPanicPhrase(normalizedPhrase: string): boolean {
    const panicPhrases = [
      'emergency delete everything',
      'panic mode now',
      'destroy all data'
    ];

    return panicPhrases.some(panic => normalizedPhrase.includes(panic));
  }

  /**
   * Clean up all resources
   */
  public async cleanup(): Promise<void> {
    try {
      logger.info('[VoicePhraseDetector] Cleaning up resources');

      // Deactivate all sessions
      const tagIds = Array.from(this.activeSessions.keys());
      for (const tagId of tagIds) {
        await this.deactivateSession(tagId);
      }

      // Clear all timeouts
      for (const timeoutId of this.sessionTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this.sessionTimeouts.clear();

      logger.info('[VoicePhraseDetector] Cleanup complete');
    } catch (error) {
      logger.error('[VoicePhraseDetector] Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const voicePhraseDetector = VoicePhraseDetector.getInstance(); 