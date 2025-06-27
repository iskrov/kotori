/**
 * useSessionTimer Hook
 * 
 * Provides real-time countdown timers for session expiration with
 * visual indicators and automatic updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { voicePhraseDetector } from '../services/VoicePhraseDetector';

export interface SessionTimerState {
  timeRemaining: number; // milliseconds
  isExpired: boolean;
  isWarning: boolean; // true if < 5 minutes remaining
  isCritical: boolean; // true if < 1 minute remaining
  formattedTime: string;
  percentage: number; // 0-100, for progress bars
}

export interface SessionTimerHookReturn {
  getTimerState: (tagId: string) => SessionTimerState;
  formatDuration: (milliseconds: number) => string;
  getExpirationColor: (state: SessionTimerState) => string;
  refreshTimer: () => void;
}

/**
 * Hook for session countdown timers
 */
export const useSessionTimer = (): SessionTimerHookReturn => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Format duration in milliseconds to human-readable string
   */
  const formatDuration = useCallback((milliseconds: number): string => {
    if (milliseconds <= 0) return '00:00';

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, []);

  /**
   * Get timer state for a session
   */
  const getTimerState = useCallback((tagId: string): SessionTimerState => {
    const session = voicePhraseDetector.getActiveSession(tagId);
    
    if (!session) {
      return {
        timeRemaining: 0,
        isExpired: true,
        isWarning: false,
        isCritical: false,
        formattedTime: '00:00',
        percentage: 0
      };
    }

    const timeRemaining = Math.max(0, session.expiresAt.getTime() - currentTime);
    const totalDuration = session.expiresAt.getTime() - session.createdAt.getTime();
    const percentage = totalDuration > 0 ? Math.max(0, (timeRemaining / totalDuration) * 100) : 0;

    const isExpired = timeRemaining <= 0;
    const isWarning = timeRemaining <= 5 * 60 * 1000; // 5 minutes
    const isCritical = timeRemaining <= 1 * 60 * 1000; // 1 minute

    return {
      timeRemaining,
      isExpired,
      isWarning,
      isCritical,
      formattedTime: formatDuration(timeRemaining),
      percentage
    };
  }, [currentTime, formatDuration]);

  /**
   * Get appropriate color for timer state
   */
  const getExpirationColor = useCallback((state: SessionTimerState): string => {
    if (state.isExpired) return '#FF3B30'; // Red
    if (state.isCritical) return '#FF9500'; // Orange
    if (state.isWarning) return '#FFCC00'; // Yellow
    return '#34C759'; // Green
  }, []);

  /**
   * Force refresh timer (useful after session operations)
   */
  const refreshTimer = useCallback(() => {
    setCurrentTime(Date.now());
  }, []);

  return {
    getTimerState,
    formatDuration,
    getExpirationColor,
    refreshTimer
  };
}; 