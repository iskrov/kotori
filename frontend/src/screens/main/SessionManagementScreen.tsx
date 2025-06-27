/**
 * Session Management Screen
 * 
 * Main screen for managing active OPAQUE sessions with manual controls.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { MainStackParamList } from '../../types/navigation';
import SessionListView from '../../components/SessionListView';
import { sessionManager } from '../../services/SessionManager';
import { voicePhraseDetector } from '../../services/VoicePhraseDetector';
import { SessionData, SessionStats } from '../../types/sessionTypes';
import logger from '../../utils/logger';

type SessionManagementScreenNavigationProp = StackNavigationProp<MainStackParamList, 'SessionManagement'>;

const SessionManagementScreen: React.FC = () => {
  const navigation = useNavigation<SessionManagementScreenNavigationProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load session data
   */
  const loadSessionData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      // Get active sessions from VoicePhraseDetector
      const activeSessions = voicePhraseDetector.getActiveSessions();
      setSessions(activeSessions);

      // Get session statistics from SessionManager
      const stats = sessionManager.getSessionStats();
      setSessionStats(stats);

      logger.info(`[SessionManagementScreen] Loaded ${activeSessions.length} active sessions`);
    } catch (error) {
      logger.error('[SessionManagementScreen] Failed to load session data:', error);
      setError('Failed to load session data');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Handle session refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadSessionData(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSessionData]);

  /**
   * Handle session extension
   */
  const handleExtendSession = useCallback(async (tagId: string, minutes: number): Promise<boolean> => {
    try {
      const success = await sessionManager.extendSession(tagId, minutes);
      if (success) {
        await loadSessionData(false); // Refresh to show updated expiration
        logger.info(`[SessionManagementScreen] Extended session ${tagId} by ${minutes} minutes`);
      }
      return success;
    } catch (error) {
      logger.error('[SessionManagementScreen] Session extension failed:', error);
      Alert.alert('Extension Failed', 'Failed to extend the session. Please try again.');
      return false;
    }
  }, [loadSessionData]);

  /**
   * Handle session deactivation
   */
  const handleDeactivateSession = useCallback(async (tagId: string): Promise<boolean> => {
    try {
      const session = voicePhraseDetector.getActiveSession(tagId);
      if (!session) {
        Alert.alert('Error', 'Session not found or already inactive.');
        return false;
      }

      // Show confirmation
      return new Promise((resolve) => {
        Alert.alert(
          'Deactivate Session?',
          `This will immediately deactivate the session for "${session.tagName}" and clear all associated encryption keys from memory.\n\nThis action cannot be undone.`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false)
            },
            {
              text: 'Deactivate',
              style: 'destructive',
              onPress: async () => {
                try {
                  const success = await sessionManager.deactivateSession(tagId);
                  if (success) {
                    await loadSessionData(false); // Refresh to remove from list
                    logger.info(`[SessionManagementScreen] Deactivated session ${tagId}`);
                  }
                  resolve(success);
                } catch (error) {
                  logger.error('[SessionManagementScreen] Session deactivation failed:', error);
                  Alert.alert('Deactivation Failed', 'Failed to deactivate the session. Please try again.');
                  resolve(false);
                }
              }
            }
          ]
        );
      });
    } catch (error) {
      logger.error('[SessionManagementScreen] Session deactivation failed:', error);
      Alert.alert('Deactivation Failed', 'Failed to deactivate the session. Please try again.');
      return false;
    }
  }, [loadSessionData]);

  /**
   * Handle lock session
   */
  const handleLockSession = useCallback(async (tagId: string): Promise<boolean> => {
    try {
      const success = await sessionManager.lockSession(tagId);
      if (success) {
        await loadSessionData(false); // Refresh to show locked status
        logger.info(`[SessionManagementScreen] Locked session ${tagId}`);
      }
      return success;
    } catch (error) {
      logger.error('[SessionManagementScreen] Session lock failed:', error);
      Alert.alert('Lock Failed', 'Failed to lock the session. Please try again.');
      return false;
    }
  }, [loadSessionData]);

  /**
   * Handle unlock session
   */
  const handleUnlockSession = useCallback(async (tagId: string): Promise<boolean> => {
    try {
      const success = await sessionManager.unlockSession(tagId);
      if (success) {
        await loadSessionData(false); // Refresh to show unlocked status
        logger.info(`[SessionManagementScreen] Unlocked session ${tagId}`);
      }
      return success;
    } catch (error) {
      logger.error('[SessionManagementScreen] Session unlock failed:', error);
      Alert.alert('Unlock Failed', 'Failed to unlock the session. Please try again.');
      return false;
    }
  }, [loadSessionData]);

  /**
   * Handle deactivate all sessions
   */
  const handleDeactivateAll = useCallback(async (): Promise<boolean> => {
    try {
      if (sessions.length === 0) {
        Alert.alert('No Sessions', 'There are no active sessions to deactivate.');
        return false;
      }

      const success = await sessionManager.deactivateAllSessions();
      if (success) {
        await loadSessionData(false); // Refresh to clear list
        logger.info(`[SessionManagementScreen] Deactivated all ${sessions.length} sessions`);
      }
      return success;
    } catch (error) {
      logger.error('[SessionManagementScreen] Bulk deactivation failed:', error);
      Alert.alert('Deactivation Failed', 'Failed to deactivate all sessions. Please try again.');
      return false;
    }
  }, [sessions.length, loadSessionData]);

  // Load data on mount
  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  // Set up navigation header
  useEffect(() => {
    navigation.setOptions({
      title: 'Active Sessions',
      headerStyle: {
        backgroundColor: theme.colors.surface,
      },
      headerTintColor: theme.colors.text,
      headerTitleStyle: {
        fontWeight: '600',
      },
    });
  }, [navigation, theme]);

  /**
   * Render session statistics
   */
  const renderSessionStats = () => {
    if (!sessionStats) return null;

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Session Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{sessionStats.totalSessions}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{sessionStats.activeSessions}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{sessionStats.expiringSessions}</Text>
            <Text style={styles.statLabel}>Expiring</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{sessionStats.lockedSessions || 0}</Text>
            <Text style={styles.statLabel}>Locked</Text>
          </View>
        </View>
      </View>
    );
  };

  /**
   * Render error state
   */
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="warning-outline" size={48} color="#FF3B30" />
      <Text style={styles.errorTitle}>Failed to Load Sessions</Text>
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );

  if (error && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {renderError()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Session Statistics */}
        {renderSessionStats()}

        {/* Session List */}
        <View style={styles.sessionListContainer}>
          <SessionListView
            sessions={sessions}
            onExtendSession={handleExtendSession}
            onDeactivateSession={handleDeactivateSession}
            onLockSession={handleLockSession}
            onUnlockSession={handleUnlockSession}
            onDeactivateAll={handleDeactivateAll}
            onRefresh={handleRefresh}
            isLoading={isLoading}
            showBulkControls={true}
            showSearch={true}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  statsContainer: {
    backgroundColor: theme.colors.surface,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  sessionListContainer: {
    flex: 1,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SessionManagementScreen; 