/**
 * SessionListView Component
 * 
 * Displays a list of active sessions with search, filtering, and bulk operations.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { SessionData } from '../types/sessionTypes';
import SessionControlPanel from './SessionControlPanel';
import logger from '../utils/logger';

interface SessionListViewProps {
  sessions: SessionData[];
  onExtendSession?: (tagId: string, minutes: number) => Promise<boolean>;
  onDeactivateSession?: (tagId: string) => Promise<boolean>;
  onLockSession?: (tagId: string) => Promise<boolean>;
  onUnlockSession?: (tagId: string) => Promise<boolean>;
  onDeactivateAll?: () => Promise<boolean>;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
  showBulkControls?: boolean;
  showSearch?: boolean;
}

type SessionFilter = 'all' | 'active' | 'expiring' | 'locked';

const SessionListView: React.FC<SessionListViewProps> = ({
  sessions,
  onExtendSession,
  onDeactivateSession,
  onLockSession,
  onUnlockSession,
  onDeactivateAll,
  onRefresh,
  isLoading = false,
  showBulkControls = true,
  showSearch = true,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<SessionFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  /**
   * Filter sessions based on search and filter criteria
   */
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(session =>
        session.tagName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    switch (selectedFilter) {
      case 'active':
        filtered = filtered.filter(session => {
          const timeRemaining = session.expiresAt.getTime() - Date.now();
          return timeRemaining > 5 * 60 * 1000 && !session.isLocked; // More than 5 minutes and not locked
        });
        break;
      case 'expiring':
        filtered = filtered.filter(session => {
          const timeRemaining = session.expiresAt.getTime() - Date.now();
          return timeRemaining <= 5 * 60 * 1000 && timeRemaining > 0; // Less than 5 minutes but not expired
        });
        break;
      case 'locked':
        filtered = filtered.filter(session => session.isLocked);
        break;
      case 'all':
      default:
        // No additional filtering
        break;
    }

    return filtered;
  }, [sessions, searchQuery, selectedFilter]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      logger.info('[SessionListView] Sessions refreshed');
    } catch (error) {
      logger.error('[SessionListView] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  /**
   * Handle bulk deactivation
   */
  const handleDeactivateAll = useCallback(async () => {
    if (!onDeactivateAll || bulkLoading || sessions.length === 0) return;

    setBulkLoading(true);
    try {
      const success = await onDeactivateAll();
      if (success) {
        logger.info('[SessionListView] All sessions deactivated');
      }
    } catch (error) {
      logger.error('[SessionListView] Bulk deactivation failed:', error);
    } finally {
      setBulkLoading(false);
    }
  }, [onDeactivateAll, bulkLoading, sessions.length]);

  /**
   * Show bulk deactivation confirmation
   */
  const showBulkDeactivationConfirm = useCallback(() => {
    if (sessions.length === 0) {
      Alert.alert('No Sessions', 'There are no active sessions to deactivate.');
      return;
    }

    Alert.alert(
      'Deactivate All Sessions?',
      `This will immediately deactivate all ${sessions.length} active session(s) and clear all encryption keys from memory.\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate All',
          style: 'destructive',
          onPress: handleDeactivateAll
        }
      ]
    );
  }, [sessions.length, handleDeactivateAll]);

  /**
   * Render filter button
   */
  const renderFilterButton = (filter: SessionFilter, label: string, count: number) => {
    const isSelected = selectedFilter === filter;
    return (
      <TouchableOpacity
        key={filter}
        style={[
          styles.filterButton,
          isSelected && styles.filterButtonSelected
        ]}
        onPress={() => setSelectedFilter(filter)}
      >
        <Text style={[
          styles.filterButtonText,
          isSelected && styles.filterButtonTextSelected
        ]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  /**
   * Get filter counts
   */
  const getFilterCounts = () => {
    const now = Date.now();
    return {
      all: sessions.length,
      active: sessions.filter(s => {
        const timeRemaining = s.expiresAt.getTime() - now;
        return timeRemaining > 5 * 60 * 1000 && !s.isLocked;
      }).length,
      expiring: sessions.filter(s => {
        const timeRemaining = s.expiresAt.getTime() - now;
        return timeRemaining <= 5 * 60 * 1000 && timeRemaining > 0;
      }).length,
      locked: sessions.filter(s => s.isLocked).length,
    };
  };

  const filterCounts = getFilterCounts();

  /**
   * Render session item
   */
  const renderSessionItem = ({ item }: { item: SessionData }) => (
    <SessionControlPanel
      session={item}
      onExtend={onExtendSession}
      onDeactivate={onDeactivateSession}
      onLock={onLockSession}
      onUnlock={onUnlockSession}
      disabled={isLoading || bulkLoading}
    />
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="time-outline" size={48} color={theme.colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>No Active Sessions</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery.trim() ? 
          'No sessions match your search criteria.' :
          'Voice authenticate with a secret phrase to create an active session.'
        }
      </Text>
    </View>
  );

  /**
   * Render header
   */
  const renderHeader = () => (
    <View style={styles.header}>
      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sessions..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', filterCounts.all)}
        {renderFilterButton('active', 'Active', filterCounts.active)}
        {renderFilterButton('expiring', 'Expiring', filterCounts.expiring)}
        {renderFilterButton('locked', 'Locked', filterCounts.locked)}
      </View>

      {/* Bulk Controls */}
      {showBulkControls && sessions.length > 0 && (
        <View style={styles.bulkControls}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={isRefreshing || bulkLoading}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="refresh" size={16} color={theme.colors.primary} />
            )}
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deactivateAllButton}
            onPress={showBulkDeactivationConfirm}
            disabled={bulkLoading || isRefreshing}
          >
            {bulkLoading ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <Ionicons name="power" size={16} color={theme.colors.error} />
            )}
            <Text style={styles.deactivateAllButtonText}>End All</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredSessions}
        renderItem={renderSessionItem}
        keyExtractor={(item) => item.tagId}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 8,
    marginRight: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  filterButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  filterButtonTextSelected: {
    color: theme.colors.onPrimary,
  },
  bulkControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.chipBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  deactivateAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.error + '20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error,
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  deactivateAllButtonText: {
    color: theme.colors.error,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
});

export default SessionListView; 