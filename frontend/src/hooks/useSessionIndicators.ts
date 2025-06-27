/**
 * React hook for OPAQUE session indicator management
 * 
 * Provides real-time session status updates, health monitoring,
 * and interactive session controls for UI components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { 
  UseSessionIndicatorsOptions, 
  UseSessionIndicatorsReturn, 
  SessionStatus, 
  SessionHealth,
  SessionHealthIssue,
  SessionIndicatorError
} from '../types/sessionIndicatorTypes';
import { SessionManager } from '../services/SessionManager';
import { VoicePhraseDetector, voicePhraseDetector } from '../services/VoicePhraseDetector';
import { SessionEvent, SessionData } from '../types/sessionTypes';

const DEFAULT_UPDATE_INTERVAL = 1000; // 1 second
const DEFAULT_WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CRITICAL_THRESHOLD = 1 * 60 * 1000; // 1 minute

export function useSessionIndicators(
  options: UseSessionIndicatorsOptions = {}
): UseSessionIndicatorsReturn {
  const {
    updateInterval = DEFAULT_UPDATE_INTERVAL,
    enableBackgroundUpdates = true,
    warningThresholdMs = DEFAULT_WARNING_THRESHOLD,
    criticalThresholdMs = DEFAULT_CRITICAL_THRESHOLD
  } = options;

  // State
  const [sessions, setSessions] = useState<SessionStatus[]>([]);
  const [sessionHealth, setSessionHealth] = useState<Record<string, SessionHealth>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup and background updates
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionManagerRef = useRef<SessionManager | null>(null);
  const voiceDetectorRef = useRef<VoicePhraseDetector | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Initialize session manager
  useEffect(() => {
    sessionManagerRef.current = SessionManager.getInstance();
    voiceDetectorRef.current = voicePhraseDetector;
    loadInitialSessions();

    // Listen to session events via SessionManager
    sessionManagerRef.current.addEventListener(handleSessionEvent);

    return () => {
      sessionManagerRef.current?.removeEventListener(handleSessionEvent);
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  // Handle app state changes for background updates
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;
      
      if (nextAppState === 'active' && enableBackgroundUpdates) {
        // Refresh sessions when app becomes active
        refreshSessions();
        startRealTimeUpdates();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Stop updates when app goes to background
        stopRealTimeUpdates();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [enableBackgroundUpdates]);

  // Start real-time updates
  useEffect(() => {
    if (sessions.length > 0) {
      startRealTimeUpdates();
    }
    return () => stopRealTimeUpdates();
  }, [sessions.length, updateInterval]);

  // Load initial sessions
  const loadInitialSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!voiceDetectorRef.current) {
        throw new Error('Voice detector not initialized');
      }

      const activeSessions = voiceDetectorRef.current.getActiveSessions();
      const sessionStatuses = await Promise.all(
        activeSessions.map((session: SessionData) => convertToSessionStatus(session))
      );
      
      setSessions(sessionStatuses);
      
      // Calculate health for each session
      const healthData: Record<string, SessionHealth> = {};
      for (const status of sessionStatuses) {
        healthData[status.sessionId] = calculateSessionHealth(status);
      }
      setSessionHealth(healthData);
      
    } catch (err) {
      const error: SessionIndicatorError = {
        code: 'SESSION_LOAD_FAILED',
        message: err instanceof Error ? err.message : 'Failed to load sessions',
        timestamp: new Date(),
        recoverable: true
      };
      setError(error.message);
      console.error('Failed to load initial sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle session events
  const handleSessionEvent = useCallback((event: SessionEvent) => {
    switch (event.type) {
      case 'session-created':
      case 'session-extended':
      case 'session-locked':
      case 'session-unlocked':
        refreshSessions();
        break;
      case 'session-expired':
      case 'session-invalidated':
        setSessions(prev => prev.filter(s => s.sessionId !== event.tagId));
        setSessionHealth(prev => {
          const newHealth = { ...prev };
          delete newHealth[event.tagId];
          return newHealth;
        });
        break;
      case 'security-alert':
        // Handle security alerts
        refreshSessions();
        break;
    }
  }, []);

  // Start real-time updates
  const startRealTimeUpdates = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    updateIntervalRef.current = setInterval(() => {
      if (appStateRef.current === 'active' || enableBackgroundUpdates) {
        updateSessionTimers();
      }
    }, updateInterval);
  }, [updateInterval, enableBackgroundUpdates]);

  // Stop real-time updates
  const stopRealTimeUpdates = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  // Update session timers and health
  const updateSessionTimers = useCallback(() => {
    const now = Date.now();
    
    setSessions(prev => {
      const updated = prev.map(session => {
        const remainingTimeMs = Math.max(0, session.expiresAt.getTime() - now);
        return {
          ...session,
          remainingTimeMs,
          isActive: remainingTimeMs > 0
        };
      }).filter(session => session.isActive); // Remove expired sessions

      return updated;
    });

    // Update health scores
    setSessionHealth(prev => {
      const updated: Record<string, SessionHealth> = {};
      sessions.forEach(session => {
        updated[session.sessionId] = calculateSessionHealth(session);
      });
      return updated;
    });
  }, [sessions]);

  // Convert session to status format
  const convertToSessionStatus = async (session: any): Promise<SessionStatus> => {
    const now = Date.now();
    const expiresAt = new Date(session.expiresAt);
    const remainingTimeMs = Math.max(0, expiresAt.getTime() - now);

    return {
      sessionId: session.sessionId,
      tagName: session.tagName,
      isActive: remainingTimeMs > 0,
      isLocked: session.isLocked || false,
      expiresAt,
      createdAt: new Date(session.createdAt),
      lastActivityAt: new Date(session.lastActivityAt || session.createdAt),
      deviceFingerprint: session.deviceFingerprint || 'unknown',
      securityLevel: session.securityLevel || 'standard',
      remainingTimeMs,
      healthScore: 100 // Will be calculated by calculateSessionHealth
    };
  };

  // Calculate session health
  const calculateSessionHealth = (session: SessionStatus): SessionHealth => {
    const issues: SessionHealthIssue[] = [];
    let score = 100;

    // Check timeout warnings
    if (session.remainingTimeMs <= criticalThresholdMs) {
      issues.push({
        type: 'timeout_warning',
        severity: 'critical',
        message: 'Session expires in less than 1 minute',
        timestamp: new Date()
      });
      score -= 50;
    } else if (session.remainingTimeMs <= warningThresholdMs) {
      issues.push({
        type: 'timeout_warning',
        severity: 'medium',
        message: 'Session expires in less than 5 minutes',
        timestamp: new Date()
      });
      score -= 20;
    }

    // Check for security issues
    if (session.deviceFingerprint === 'unknown') {
      issues.push({
        type: 'security_risk',
        severity: 'medium',
        message: 'Device fingerprint not available',
        timestamp: new Date()
      });
      score -= 15;
    }

    // Check session age
    const sessionAgeMs = Date.now() - session.createdAt.getTime();
    const maxSessionAge = 2 * 60 * 60 * 1000; // 2 hours
    if (sessionAgeMs > maxSessionAge) {
      issues.push({
        type: 'security_risk',
        severity: 'low',
        message: 'Long-running session detected',
        timestamp: new Date()
      });
      score -= 10;
    }

    // Determine status
    let status: SessionHealth['status'];
    if (score >= 90) status = 'excellent';
    else if (score >= 70) status = 'good';
    else if (score >= 50) status = 'warning';
    else status = 'critical';

    // Generate recommendations
    const recommendations: string[] = [];
    if (session.remainingTimeMs <= warningThresholdMs) {
      recommendations.push('Consider extending session if still needed');
    }
    if (session.deviceFingerprint === 'unknown') {
      recommendations.push('Restart app to improve security');
    }
    if (issues.length === 0) {
      recommendations.push('Session is healthy and secure');
    }

    return {
      score: Math.max(0, score),
      status,
      issues,
      recommendations
    };
  };

  // Public methods
  const refreshSessions = useCallback(async () => {
    await loadInitialSessions();
  }, []);

  const extendSession = useCallback(async (sessionId: string, durationMs?: number) => {
    try {
      if (!sessionManagerRef.current) {
        throw new Error('Session manager not available');
      }

      await sessionManagerRef.current.extendSession(sessionId, { extendBy: durationMs });
      await refreshSessions();
    } catch (err) {
      const error: SessionIndicatorError = {
        code: 'ACTION_FAILED',
        message: err instanceof Error ? err.message : 'Failed to extend session',
        sessionId,
        actionType: 'extend',
        timestamp: new Date(),
        recoverable: true
      };
      setError(error.message);
      console.error('Failed to extend session:', error);
      throw err;
    }
  }, [refreshSessions]);

  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      if (!sessionManagerRef.current) {
        throw new Error('Session manager not available');
      }

      await sessionManagerRef.current.terminateSession(sessionId);
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      setSessionHealth(prev => {
        const newHealth = { ...prev };
        delete newHealth[sessionId];
        return newHealth;
      });
    } catch (err) {
      const error: SessionIndicatorError = {
        code: 'ACTION_FAILED',
        message: err instanceof Error ? err.message : 'Failed to terminate session',
        sessionId,
        actionType: 'terminate',
        timestamp: new Date(),
        recoverable: true
      };
      setError(error.message);
      console.error('Failed to terminate session:', error);
      throw err;
    }
  }, []);

  const lockSession = useCallback(async (sessionId: string) => {
    try {
      if (!sessionManagerRef.current) {
        throw new Error('Session manager not available');
      }

      await sessionManagerRef.current.lockSession(sessionId);
      await refreshSessions();
    } catch (err) {
      const error: SessionIndicatorError = {
        code: 'ACTION_FAILED',
        message: err instanceof Error ? err.message : 'Failed to lock session',
        sessionId,
        actionType: 'lock',
        timestamp: new Date(),
        recoverable: true
      };
      setError(error.message);
      console.error('Failed to lock session:', error);
      throw err;
    }
  }, [refreshSessions]);

  const unlockSession = useCallback(async (sessionId: string) => {
    try {
      if (!sessionManagerRef.current) {
        throw new Error('Session manager not available');
      }

      await sessionManagerRef.current.unlockSession(sessionId);
      await refreshSessions();
    } catch (err) {
      const error: SessionIndicatorError = {
        code: 'ACTION_FAILED',
        message: err instanceof Error ? err.message : 'Failed to unlock session',
        sessionId,
        actionType: 'unlock',
        timestamp: new Date(),
        recoverable: true
      };
      setError(error.message);
      console.error('Failed to unlock session:', error);
      throw err;
    }
  }, [refreshSessions]);

  const triggerPanicMode = useCallback(async () => {
    try {
      if (!sessionManagerRef.current) {
        throw new Error('Session manager not available');
      }

      await sessionManagerRef.current.triggerPanicMode();
      setSessions([]);
      setSessionHealth({});
    } catch (err) {
      const error: SessionIndicatorError = {
        code: 'ACTION_FAILED',
        message: err instanceof Error ? err.message : 'Failed to trigger panic mode',
        actionType: 'panic_mode',
        timestamp: new Date(),
        recoverable: false
      };
      setError(error.message);
      console.error('Failed to trigger panic mode:', error);
      throw err;
    }
  }, []);

  // Computed values
  const activeSessions = sessions.filter(s => s.isActive);
  const expiringSessions = sessions.filter(s => 
    s.isActive && s.remainingTimeMs <= warningThresholdMs
  );

  return {
    sessions,
    activeSessions,
    expiringSessions,
    sessionHealth,
    isLoading,
    error,
    refreshSessions,
    extendSession,
    terminateSession,
    lockSession,
    unlockSession,
    triggerPanicMode
  };
} 