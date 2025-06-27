/**
 * useSessionControls Hook
 * 
 * Provides session control operations for manual session management including
 * extension, deactivation, and bulk operations while maintaining security properties.
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { sessionManager } from '../services/SessionManager';
import { voicePhraseDetector } from '../services/VoicePhraseDetector';
import { SessionData, SessionStats, SessionEvent } from '../types/sessionTypes';
import logger from '../utils/logger';

export interface SessionControlState {
  isLoading: boolean;
  error: string | null;
  lastOperation: string | null;
  operationCount: number;
}

export interface SessionControlOperations {
  extendSession: (tagId: string, minutes?: number) => Promise<boolean>;
  deactivateSession: (tagId: string, confirm?: boolean) => Promise<boolean>;
  deactivateAllSessions: (confirm?: boolean) => Promise<boolean>;
  lockSession: (tagId: string) => Promise<boolean>;
  unlockSession: (tagId: string) => Promise<boolean>;
  refreshSessions: () => Promise<void>;
  getSessionInfo: (tagId: string) => SessionData | null;
}

export interface SessionControlHookReturn {
  state: SessionControlState;
  operations: SessionControlOperations;
  activeSessions: SessionData[];
  sessionStats: SessionStats | null;
  isSessionActive: (tagId: string) => boolean;
  getTimeRemaining: (tagId: string) => number;
}

/**
 * Hook for manual session control operations
 */
export const useSessionControls = (): SessionControlHookReturn => {
  const [state, setState] = useState<SessionControlState>({
    isLoading: false,
    error: null,
    lastOperation: null,
    operationCount: 0
  });

  const [activeSessions, setActiveSessions] = useState<SessionData[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

  /**
   * Update loading state
   */
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  /**
   * Set error state
   */
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  /**
   * Record successful operation
   */
  const recordOperation = useCallback((operation: string) => {
    setState(prev => ({
      ...prev,
      lastOperation: operation,
      operationCount: prev.operationCount + 1,
      error: null
    }));
  }, []);

  /**
   * Refresh active sessions and stats
   */
  const refreshSessions = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get active sessions from VoicePhraseDetector
      const sessions = voicePhraseDetector.getActiveSessions();
      setActiveSessions(sessions);

      // Get session statistics from SessionManager
      const stats = sessionManager.getSessionStats();
      setSessionStats(stats);

      logger.info(`[useSessionControls] Refreshed ${sessions.length} active sessions`);
    } catch (error) {
      logger.error('[useSessionControls] Failed to refresh sessions:', error);
      setError('Failed to refresh session data');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Extend session timeout
   */
  const extendSession = useCallback(async (
    tagId: string, 
    minutes: number = 15
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Validate session exists and is active
      if (!voicePhraseDetector.isSessionActive(tagId)) {
        throw new Error('Session is not active or has expired');
      }

      // Use SessionManager to extend session
      const success = await sessionManager.extendSession(tagId, minutes);
      
      if (success) {
        recordOperation(`Extended session by ${minutes} minutes`);
        await refreshSessions(); // Refresh to show updated expiration
        logger.info(`[useSessionControls] Extended session ${tagId} by ${minutes} minutes`);
        return true;
      } else {
        throw new Error('Session extension failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to extend session';
      logger.error('[useSessionControls] Session extension failed:', error);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, recordOperation, refreshSessions]);

  /**
   * Deactivate a single session
   */
  const deactivateSession = useCallback(async (
    tagId: string, 
    confirm: boolean = true
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Get session info for confirmation
      const session = voicePhraseDetector.getActiveSession(tagId);
      if (!session) {
        throw new Error('Session not found or already inactive');
      }

      // Show confirmation dialog if requested
      if (confirm) {
        return new Promise((resolve) => {
          Alert.alert(
            'Deactivate Session?',
            `This will immediately deactivate the session for "${session.tagName}" and clear all associated encryption keys from memory.\n\nThis action cannot be undone.`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setLoading(false);
                  resolve(false);
                }
              },
              {
                text: 'Deactivate',
                style: 'destructive',
                onPress: async () => {
                  const result = await deactivateSession(tagId, false);
                  resolve(result);
                }
              }
            ]
          );
        });
      }

      // Perform deactivation using SessionManager
      const success = await sessionManager.deactivateSession(tagId);
      
      if (success) {
        recordOperation(`Deactivated session: ${session.tagName}`);
        await refreshSessions(); // Refresh to remove from active list
        logger.info(`[useSessionControls] Deactivated session ${tagId}`);
        return true;
      } else {
        throw new Error('Session deactivation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate session';
      logger.error('[useSessionControls] Session deactivation failed:', error);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, recordOperation, refreshSessions]);

  /**
   * Deactivate all active sessions
   */
  const deactivateAllSessions = useCallback(async (
    confirm: boolean = true
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const sessions = voicePhraseDetector.getActiveSessions();
      if (sessions.length === 0) {
        setError('No active sessions to deactivate');
        return false;
      }

      // Show confirmation dialog if requested
      if (confirm) {
        return new Promise((resolve) => {
          Alert.alert(
            'Deactivate All Sessions?',
            `This will immediately deactivate all ${sessions.length} active session(s) and clear all encryption keys from memory.\n\nActive sessions:\n${sessions.map(s => `• ${s.tagName}`).join('\n')}\n\nThis action cannot be undone.`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setLoading(false);
                  resolve(false);
                }
              },
              {
                text: 'Deactivate All',
                style: 'destructive',
                onPress: async () => {
                  const result = await deactivateAllSessions(false);
                  resolve(result);
                }
              }
            ]
          );
        });
      }

      // Deactivate all sessions using SessionManager
      const success = await sessionManager.deactivateAllSessions();
      
      if (success) {
        recordOperation(`Deactivated all ${sessions.length} sessions`);
        await refreshSessions(); // Refresh to clear active list
        logger.info(`[useSessionControls] Deactivated all ${sessions.length} sessions`);
        return true;
      } else {
        throw new Error('Bulk session deactivation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate all sessions';
      logger.error('[useSessionControls] Bulk deactivation failed:', error);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, recordOperation, refreshSessions]);

  /**
   * Lock a session (require re-authentication for access)
   */
  const lockSession = useCallback(async (tagId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const session = voicePhraseDetector.getActiveSession(tagId);
      if (!session) {
        throw new Error('Session not found or already inactive');
      }

      // Use SessionManager to lock session
      const success = await sessionManager.lockSession(tagId);
      
      if (success) {
        recordOperation(`Locked session: ${session.tagName}`);
        await refreshSessions(); // Refresh to show locked status
        logger.info(`[useSessionControls] Locked session ${tagId}`);
        return true;
      } else {
        throw new Error('Session lock failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to lock session';
      logger.error('[useSessionControls] Session lock failed:', error);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, recordOperation, refreshSessions]);

  /**
   * Unlock a session (allow access without re-authentication)
   */
  const unlockSession = useCallback(async (tagId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const session = voicePhraseDetector.getActiveSession(tagId);
      if (!session) {
        throw new Error('Session not found or already inactive');
      }

      // Use SessionManager to unlock session
      const success = await sessionManager.unlockSession(tagId);
      
      if (success) {
        recordOperation(`Unlocked session: ${session.tagName}`);
        await refreshSessions(); // Refresh to show unlocked status
        logger.info(`[useSessionControls] Unlocked session ${tagId}`);
        return true;
      } else {
        throw new Error('Session unlock failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unlock session';
      logger.error('[useSessionControls] Session unlock failed:', error);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, recordOperation, refreshSessions]);

  /**
   * Get session information
   */
  const getSessionInfo = useCallback((tagId: string): SessionData | null => {
    return voicePhraseDetector.getActiveSession(tagId);
  }, []);

  /**
   * Check if session is active
   */
  const isSessionActive = useCallback((tagId: string): boolean => {
    return voicePhraseDetector.isSessionActive(tagId);
  }, []);

  /**
   * Get time remaining for session (in milliseconds)
   */
  const getTimeRemaining = useCallback((tagId: string): number => {
    const session = voicePhraseDetector.getActiveSession(tagId);
    if (!session) return 0;

    const now = new Date();
    const remaining = session.expiresAt.getTime() - now.getTime();
    return Math.max(0, remaining);
  }, []);

  // Initialize and set up periodic refresh
  useEffect(() => {
    refreshSessions();

    // Set up periodic refresh every 30 seconds
    const interval = setInterval(refreshSessions, 30000);

    return () => clearInterval(interval);
  }, [refreshSessions]);

  // Listen for session events from SessionManager
  useEffect(() => {
    const handleSessionEvent = (event: SessionEvent) => {
      logger.info(`[useSessionControls] Session event: ${event.type} for ${event.tagId}`);
      
      // Refresh sessions when events occur
      refreshSessions();
    };

    // Subscribe to session events (if SessionManager supports it)
    const unsubscribe = sessionManager.subscribe?.(handleSessionEvent);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [refreshSessions]);

  return {
    state,
    operations: {
      extendSession,
      deactivateSession,
      deactivateAllSessions,
      lockSession,
      unlockSession,
      refreshSessions,
      getSessionInfo
    },
    activeSessions,
    sessionStats,
    isSessionActive,
    getTimeRemaining
  };
}; 