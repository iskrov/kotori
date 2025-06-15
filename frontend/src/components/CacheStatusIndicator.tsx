/**
 * Cache Status Indicator Component
 * 
 * Shows cache status, network connectivity, and sync information
 * for secret tags.
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
import {
  CacheStatus,
  NetworkStatus,
  tagManager
} from '../services/tagManager';
import logger from '../utils/logger';

interface CacheStatusIndicatorProps {
  cacheStatus: CacheStatus;
  networkStatus: NetworkStatus;
  onRefresh?: () => Promise<void>;
  onClearCache?: () => Promise<void>;
  onSync?: () => Promise<void>;
  disabled?: boolean;
}

const CacheStatusIndicator: React.FC<CacheStatusIndicatorProps> = ({
  cacheStatus,
  networkStatus,
  onRefresh,
  onClearCache,
  onSync,
  disabled = false
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Get network status display info
   */
  const getNetworkInfo = () => {
    switch (networkStatus) {
      case 'online':
        return {
          icon: 'wifi' as const,
          color: theme.colors.success,
          text: 'Online',
          description: 'Connected to internet'
        };
      case 'poor':
        return {
          icon: 'wifi-outline' as const,
          color: theme.colors.warning,
          text: 'Poor Connection',
          description: 'Slow or unstable connection'
        };
      case 'offline':
        return {
          icon: 'cloud-offline' as const,
          color: theme.colors.error,
          text: 'Offline',
          description: 'No internet connection'
        };
      default:
        return {
          icon: 'help-circle-outline' as const,
          color: theme.colors.textSecondary,
          text: 'Unknown',
          description: 'Connection status unknown'
        };
    }
  };

  /**
   * Get cache status display info
   */
  const getCacheInfo = () => {
    if (!cacheStatus.enabled) {
      return {
        icon: 'cloud-outline' as const,
        color: theme.colors.textSecondary,
        text: 'Server Only',
        description: 'No local caching'
      };
    }

    switch (cacheStatus.integrity) {
      case 'valid':
        return {
          icon: 'checkmark-circle' as const,
          color: theme.colors.success,
          text: 'Cache Valid',
          description: `${cacheStatus.entryCount} tags cached`
        };
      case 'corrupted':
        return {
          icon: 'warning' as const,
          color: theme.colors.error,
          text: 'Cache Corrupted',
          description: 'Cache needs clearing'
        };
      default:
        return {
          icon: 'help-circle-outline' as const,
          color: theme.colors.textSecondary,
          text: 'Cache Unknown',
          description: 'Status unavailable'
        };
    }
  };

  /**
   * Format storage size
   */
  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  /**
   * Format last sync time
   */
  const formatLastSync = (lastSync?: string): string => {
    if (!lastSync) return 'Never';
    
    const syncDate = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  /**
   * Handle refresh action
   */
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || disabled || isLoading) return;

    setIsLoading(true);
    try {
      await onRefresh();
      logger.info('Cache status refreshed');
    } catch (error) {
      logger.error('Failed to refresh cache status:', error);
      Alert.alert('Error', 'Failed to refresh status');
    } finally {
      setIsLoading(false);
    }
  }, [onRefresh, disabled, isLoading]);

  /**
   * Handle clear cache action
   */
  const handleClearCache = useCallback(async () => {
    if (!onClearCache || disabled || isLoading) return;

    Alert.alert(
      'Clear Cache?',
      'This will remove all locally stored tag data. You\'ll need an internet connection to access tags afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await onClearCache();
              logger.info('Cache cleared');
              Alert.alert('Cache Cleared', 'All local tag data has been removed.');
            } catch (error) {
              logger.error('Failed to clear cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  }, [onClearCache, disabled, isLoading]);

  /**
   * Handle sync action
   */
  const handleSync = useCallback(async () => {
    if (!onSync || disabled || isLoading || networkStatus === 'offline') return;

    setIsLoading(true);
    try {
      await onSync();
      logger.info('Manual sync completed');
    } catch (error) {
      logger.error('Failed to sync:', error);
      Alert.alert('Sync Failed', 'Could not sync with server');
    } finally {
      setIsLoading(false);
    }
  }, [onSync, disabled, isLoading, networkStatus]);

  const networkInfo = getNetworkInfo();
  const cacheInfo = getCacheInfo();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>System Status</Text>
        <TouchableOpacity
          style={[styles.refreshButton, (disabled || isLoading) && styles.disabledButton]}
          onPress={handleRefresh}
          disabled={disabled || isLoading}
          accessibilityLabel="Refresh status"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="refresh" size={16} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Status Cards */}
      <View style={styles.statusCards}>
        {/* Network Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons name={networkInfo.icon} size={20} color={networkInfo.color} />
            <Text style={styles.statusTitle}>Network</Text>
          </View>
          <Text style={[styles.statusValue, { color: networkInfo.color }]}>
            {networkInfo.text}
          </Text>
          <Text style={styles.statusDescription}>
            {networkInfo.description}
          </Text>
        </View>

        {/* Cache Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons name={cacheInfo.icon} size={20} color={cacheInfo.color} />
            <Text style={styles.statusTitle}>Cache</Text>
          </View>
          <Text style={[styles.statusValue, { color: cacheInfo.color }]}>
            {cacheInfo.text}
          </Text>
          <Text style={styles.statusDescription}>
            {cacheInfo.description}
          </Text>
        </View>
      </View>

      {/* Cache Details */}
      {cacheStatus.enabled && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Cache Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Entries:</Text>
            <Text style={styles.detailValue}>{cacheStatus.entryCount}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Storage:</Text>
            <Text style={styles.detailValue}>
              {formatStorageSize(cacheStatus.storageSize)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Sync:</Text>
            <Text style={styles.detailValue}>
              {formatLastSync(cacheStatus.lastSync)}
            </Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {networkStatus !== 'offline' && onSync && (
          <TouchableOpacity
            style={[styles.actionButton, styles.syncButton, (disabled || isLoading) && styles.disabledButton]}
            onPress={handleSync}
            disabled={disabled || isLoading}
            accessibilityLabel="Sync with server"
            accessibilityRole="button"
          >
            <Ionicons name="sync" size={16} color={theme.colors.primary} />
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        )}

        {cacheStatus.enabled && onClearCache && (
          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton, (disabled || isLoading) && styles.disabledButton]}
            onPress={handleClearCache}
            disabled={disabled || isLoading}
            accessibilityLabel="Clear cache"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
            <Text style={styles.clearButtonText}>Clear Cache</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Status Cards
  statusCards: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statusCard: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  statusTitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
    marginLeft: theme.spacing.xs,
  },
  statusValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.xs,
  },
  statusDescription: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  
  // Details
  detailsContainer: {
    marginBottom: theme.spacing.lg,
  },
  detailsTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  detailLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  detailValue: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  
  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
  },
  syncButton: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  syncButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '500',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.medium,
    marginLeft: theme.spacing.xs,
  },
  clearButton: {
    backgroundColor: theme.colors.error + '20',
    borderColor: theme.colors.error,
  },
  clearButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '500',
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamilies.medium,
    marginLeft: theme.spacing.xs,
  },
  
  // Disabled state
  disabledButton: {
    opacity: 0.5,
  },
});

export default CacheStatusIndicator; 