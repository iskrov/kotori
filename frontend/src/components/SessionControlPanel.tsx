/**
 * SessionControlPanel Component
 * 
 * Individual session control panel with extension, deactivation, and status display.
 * Provides manual controls for OPAQUE session management.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { SessionData } from '../types/sessionTypes';
import { useSessionTimer } from '../hooks/useSessionTimer';
import logger from '../utils/logger';

interface SessionControlPanelProps {
  session: SessionData;
  onExtend?: (tagId: string, minutes: number) => Promise<boolean>;
  onDeactivate?: (tagId: string) => Promise<boolean>;
  onLock?: (tagId: string) => Promise<boolean>;
  onUnlock?: (tagId: string) => Promise<boolean>;
  disabled?: boolean;
  showAdvancedControls?: boolean;
}

const SessionControlPanel: React.FC<SessionControlPanelProps> = ({
  session,
  onExtend,
  onDeactivate,
  onLock,
  onUnlock,
  disabled = false,
  showAdvancedControls = true,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { getTimerState, getExpirationColor } = useSessionTimer();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingOperation, setLoadingOperation] = useState<string | null>(null);

  // Get timer state for this session
  const timerState = getTimerState(session.tagId);
  const expirationColor = getExpirationColor(timerState);

  /**
   * Handle session extension
   */
  const handleExtend = useCallback(async (minutes: number) => {
    if (!onExtend || disabled || isLoading) return;

    setIsLoading(true);
    setLoadingOperation('extend');

    try {
      const success = await onExtend(session.tagId, minutes);
      if (success) {
        logger.info(`[SessionControlPanel] Extended session ${session.tagName} by ${minutes} minutes`);
      }
    } catch (error) {
      logger.error('[SessionControlPanel] Extension failed:', error);
    } finally {
      setIsLoading(false);
      setLoadingOperation(null);
    }
  }, [onExtend, session.tagId, session.tagName, disabled, isLoading]);

  /**
   * Show extension options
   */
  const showExtensionOptions = useCallback(() => {
    Alert.alert(
      'Extend Session',
      `Extend the session for "${session.tagName}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '15 minutes', onPress: () => handleExtend(15) },
        { text: '30 minutes', onPress: () => handleExtend(30) },
        { text: '1 hour', onPress: () => handleExtend(60) },
      ]
    );
  }, [session.tagName, handleExtend]);

  /**
   * Handle session deactivation
   */
  const handleDeactivate = useCallback(async () => {
    if (!onDeactivate || disabled || isLoading) return;

    setIsLoading(true);
    setLoadingOperation('deactivate');

    try {
      const success = await onDeactivate(session.tagId);
      if (success) {
        logger.info(`[SessionControlPanel] Deactivated session ${session.tagName}`);
      }
    } catch (error) {
      logger.error('[SessionControlPanel] Deactivation failed:', error);
    } finally {
      setIsLoading(false);
      setLoadingOperation(null);
    }
  }, [onDeactivate, session.tagId, session.tagName, disabled, isLoading]);

  /**
   * Handle session lock/unlock
   */
  const handleLockToggle = useCallback(async () => {
    if (disabled || isLoading) return;

    const isLocked = session.isLocked || false;
    const operation = isLocked ? onUnlock : onLock;
    const operationName = isLocked ? 'unlock' : 'lock';

    if (!operation) return;

    setIsLoading(true);
    setLoadingOperation(operationName);

    try {
      const success = await operation(session.tagId);
      if (success) {
        logger.info(`[SessionControlPanel] ${operationName}ed session ${session.tagName}`);
      }
    } catch (error) {
      logger.error(`[SessionControlPanel] ${operationName} failed:`, error);
    } finally {
      setIsLoading(false);
      setLoadingOperation(null);
    }
  }, [session.tagId, session.tagName, session.isLocked, onLock, onUnlock, disabled, isLoading]);

  /**
   * Get session status icon and color
   */
  const getSessionStatus = () => {
    if (timerState.isExpired) {
      return { icon: 'time-outline', color: theme.colors.error, text: 'Expired' };
    }
    if (session.isLocked) {
      return { icon: 'lock-closed', color: theme.colors.warning, text: 'Locked' };
    }
    if (timerState.isCritical) {
      return { icon: 'warning', color: theme.colors.warning, text: 'Expiring Soon' };
    }
    if (timerState.isWarning) {
      return { icon: 'time', color: theme.colors.warning, text: 'Expiring' };
    }
    return { icon: 'checkmark-circle', color: theme.colors.success, text: 'Active' };
  };

  const sessionStatus = getSessionStatus();

  return (
    <View style={[styles.container, disabled && styles.disabledContainer]}>
      {/* Session Header */}
      <View style={styles.header}>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionName} numberOfLines={1}>
            {session.tagName}
          </Text>
          <View style={styles.statusRow}>
            <Ionicons 
              name={sessionStatus.icon as any} 
              size={14} 
              color={sessionStatus.color} 
            />
            <Text style={[styles.statusText, { color: sessionStatus.color }]}>
              {sessionStatus.text}
            </Text>
          </View>
        </View>
        
        <View style={styles.timerContainer}>
          <Text style={[styles.timerText, { color: expirationColor }]}>
            {timerState.formattedTime}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${timerState.percentage}%`,
                  backgroundColor: expirationColor 
                }
              ]} 
            />
          </View>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        {/* Extend Button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.extendButton,
            (disabled || isLoading || timerState.isExpired) && styles.disabledButton
          ]}
          onPress={showExtensionOptions}
          disabled={disabled || isLoading || timerState.isExpired}
        >
          {isLoading && loadingOperation === 'extend' ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
          )}
          <Text style={[styles.controlButtonText, styles.extendButtonText]}>
            Extend
          </Text>
        </TouchableOpacity>

        {/* Lock/Unlock Button (Advanced Controls) */}
        {showAdvancedControls && (
          <TouchableOpacity
            style={[
              styles.controlButton,
              styles.lockButton,
              (disabled || isLoading || timerState.isExpired) && styles.disabledButton
            ]}
            onPress={handleLockToggle}
            disabled={disabled || isLoading || timerState.isExpired}
          >
            {isLoading && (loadingOperation === 'lock' || loadingOperation === 'unlock') ? (
              <ActivityIndicator size="small" color={theme.colors.warning} />
            ) : (
              <Ionicons 
                name={session.isLocked ? "lock-open-outline" : "lock-closed-outline"} 
                size={16} 
                color={theme.colors.warning} 
              />
            )}
            <Text style={[styles.controlButtonText, styles.lockButtonText]}>
              {session.isLocked ? 'Unlock' : 'Lock'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Deactivate Button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.deactivateButton,
            (disabled || isLoading) && styles.disabledButton
          ]}
          onPress={handleDeactivate}
          disabled={disabled || isLoading}
        >
          {isLoading && loadingOperation === 'deactivate' ? (
            <ActivityIndicator size="small" color={theme.colors.error} />
          ) : (
            <Ionicons name="power" size={16} color={theme.colors.error} />
          )}
          <Text style={[styles.controlButtonText, styles.deactivateButtonText]}>
            End
          </Text>
        </TouchableOpacity>
      </View>

      {/* Session Details (Expandable) */}
      <View style={styles.details}>
        <Text style={styles.detailText}>
          Created: {session.createdAt.toLocaleTimeString()}
        </Text>
        <Text style={styles.detailText}>
          Expires: {session.expiresAt.toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  timerContainer: {
    alignItems: 'flex-end',
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  progressBar: {
    width: 80,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  extendButton: {
    backgroundColor: theme.colors.chipBackground,
    borderColor: theme.colors.primary,
  },
  lockButton: {
    backgroundColor: '#FFF3E0',
    borderColor: theme.colors.warning,
  },
  deactivateButton: {
    backgroundColor: theme.colors.error + '20',
    borderColor: theme.colors.error,
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  extendButtonText: {
    color: theme.colors.primary,
  },
  lockButtonText: {
    color: theme.colors.warning,
  },
  deactivateButtonText: {
    color: theme.colors.error,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  detailText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
});

export default SessionControlPanel; 