/**
 * useSessionManager Hook
 * 
 * React hook that provides access to enhanced session management features
 * including session state, analytics, and control operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { sessionManager } from '../services/SessionManager';
import {
  SessionEvent,
  SessionEventCallback,
  SessionStatistics,
  SessionSecurityMetrics,
  SessionOperationResult,
  SessionControlOptions,
  SessionManagerConfig
} from '../types/sessionTypes';

export interface UseSessionManagerReturn {
  // State
  isInitialized: boolean;
  sessionCount: number;
  statistics: SessionStatistics | null;
  securityMetrics: SessionSecurityMetrics | null;
  lastEvent: SessionEvent | null;
  
  // Operations
  extendSession: (tagId: string, options?: SessionControlOptions) => Promise<SessionOperationResult>;
  lockSession: (tagId: string, options?: SessionControlOptions) => Promise<SessionOperationResult>;
  unlockSession: (tagId: string, options?: SessionControlOptions) => Promise<SessionOperationResult>;
  refreshStatistics: () => void;
  refreshSecurityMetrics: () => void;
  
  // Configuration
  getConfig: () => SessionManagerConfig;
  updateConfig: (updates: Partial<SessionManagerConfig>) => void;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for managing OPAQUE sessions with enhanced features
 */
export function useSessionManager(autoRefresh: boolean = true): UseSessionManagerReturn {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [statistics, setStatistics] = useState<SessionStatistics | null>(null);
  const [securityMetrics, setSecurityMetrics] = useState<SessionSecurityMetrics | null>(null);
  const [lastEvent, setLastEvent] = useState<SessionEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup
  const eventCallbackRef = useRef<SessionEventCallback | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize session manager
   */
  const initialize = useCallback(async () => {
    try {
      await sessionManager.initialize();
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session manager';
      setError(errorMessage);
      setIsInitialized(false);
    }
  }, []);

  /**
   * Refresh statistics from session manager
   */
  const refreshStatistics = useCallback(() => {
    try {
      const stats = sessionManager.getSessionStatistics();
      setStatistics(stats);
      setSessionCount(stats.activeSessions);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh statistics';
      setError(errorMessage);
    }
  }, []);

  /**
   * Refresh security metrics from session manager
   */
  const refreshSecurityMetrics = useCallback(() => {
    try {
      const metrics = sessionManager.getSecurityMetrics();
      setSecurityMetrics(metrics);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh security metrics';
      setError(errorMessage);
    }
  }, []);

  /**
   * Handle session events
   */
  const handleSessionEvent = useCallback((event: SessionEvent) => {
    setLastEvent(event);
    
    // Update counts and metrics based on event type
    switch (event.type) {
      case 'session-created':
      case 'session-extended':
      case 'session-locked':
      case 'session-unlocked':
      case 'session-expired':
      case 'session-invalidated':
        // Refresh statistics when session state changes
        refreshStatistics();
        refreshSecurityMetrics();
        break;
      case 'security-alert':
        // Immediately refresh security metrics on security events
        refreshSecurityMetrics();
        break;
    }
  }, [refreshStatistics, refreshSecurityMetrics]);

  /**
   * Session operation wrappers with error handling
   */
  const extendSession = useCallback(async (
    tagId: string, 
    options?: SessionControlOptions
  ): Promise<SessionOperationResult> => {
    try {
      const result = await sessionManager.extendSession(tagId, options);
      if (!result.success) {
        setError(`Failed to extend session: ${result.error}`);
      } else {
        setError(null);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during session extension';
      setError(errorMessage);
      return {
        success: false,
        tagId,
        operation: 'extend',
        error: errorMessage
      };
    }
  }, []);

  const lockSession = useCallback(async (
    tagId: string, 
    options?: SessionControlOptions
  ): Promise<SessionOperationResult> => {
    try {
      const result = await sessionManager.lockSession(tagId, options);
      if (!result.success) {
        setError(`Failed to lock session: ${result.error}`);
      } else {
        setError(null);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during session lock';
      setError(errorMessage);
      return {
        success: false,
        tagId,
        operation: 'lock',
        error: errorMessage
      };
    }
  }, []);

  const unlockSession = useCallback(async (
    tagId: string, 
    options?: SessionControlOptions
  ): Promise<SessionOperationResult> => {
    try {
      const result = await sessionManager.unlockSession(tagId, options);
      if (!result.success) {
        setError(`Failed to unlock session: ${result.error}`);
      } else {
        setError(null);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during session unlock';
      setError(errorMessage);
      return {
        success: false,
        tagId,
        operation: 'unlock',
        error: errorMessage
      };
    }
  }, []);

  /**
   * Configuration management
   */
  const getConfig = useCallback((): SessionManagerConfig => {
    return sessionManager.getConfig();
  }, []);

  const updateConfig = useCallback((updates: Partial<SessionManagerConfig>) => {
    try {
      sessionManager.updateConfig(updates);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
      setError(errorMessage);
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Setup and cleanup effects
   */
  useEffect(() => {
    // Initialize on mount
    initialize();

    // Setup event listener
    eventCallbackRef.current = handleSessionEvent;
    sessionManager.addEventListener(eventCallbackRef.current);

    // Setup auto-refresh if enabled
    if (autoRefresh) {
      refreshStatistics();
      refreshSecurityMetrics();
      
      refreshIntervalRef.current = setInterval(() => {
        refreshStatistics();
        refreshSecurityMetrics();
      }, 30000); // Refresh every 30 seconds
    }

    // Cleanup on unmount
    return () => {
      if (eventCallbackRef.current) {
        sessionManager.removeEventListener(eventCallbackRef.current);
      }
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [initialize, handleSessionEvent, autoRefresh, refreshStatistics, refreshSecurityMetrics]);

  /**
   * Effect to refresh data when initialization state changes
   */
  useEffect(() => {
    if (isInitialized) {
      refreshStatistics();
      refreshSecurityMetrics();
    }
  }, [isInitialized, refreshStatistics, refreshSecurityMetrics]);

  return {
    // State
    isInitialized,
    sessionCount,
    statistics,
    securityMetrics,
    lastEvent,
    
    // Operations
    extendSession,
    lockSession,
    unlockSession,
    refreshStatistics,
    refreshSecurityMetrics,
    
    // Configuration
    getConfig,
    updateConfig,
    
    // Error handling
    error,
    clearError
  };
}

/**
 * Simplified hook for basic session information
 */
export function useSessionCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const stats = sessionManager.getSessionStatistics();
        setCount(stats.activeSessions);
      } catch {
        setCount(0);
      }
    };

    // Initial count
    updateCount();

    // Listen for session events
    const handleEvent = (event: SessionEvent) => {
      if (['session-created', 'session-expired', 'session-invalidated'].includes(event.type)) {
        updateCount();
      }
    };

    sessionManager.addEventListener(handleEvent);

    return () => {
      sessionManager.removeEventListener(handleEvent);
    };
  }, []);

  return count;
}

/**
 * Hook for monitoring security status
 */
export function useSessionSecurity(): {
  isSecure: boolean;
  score: number;
  alerts: number;
} {
  const [securityState, setSecurityState] = useState({
    isSecure: true,
    score: 100,
    alerts: 0
  });

  useEffect(() => {
    const updateSecurity = () => {
      try {
        const metrics = sessionManager.getSecurityMetrics();
        setSecurityState({
          isSecure: !metrics.suspiciousActivityDetected,
          score: metrics.securityScore,
          alerts: metrics.suspiciousActivityDetected ? 1 : 0
        });
      } catch {
        setSecurityState({
          isSecure: false,
          score: 0,
          alerts: 1
        });
      }
    };

    // Initial check
    updateSecurity();

    // Listen for security events
    const handleEvent = (event: SessionEvent) => {
      if (event.type === 'security-alert') {
        updateSecurity();
      }
    };

    sessionManager.addEventListener(handleEvent);

    return () => {
      sessionManager.removeEventListener(handleEvent);
    };
  }, []);

  return securityState;
} 