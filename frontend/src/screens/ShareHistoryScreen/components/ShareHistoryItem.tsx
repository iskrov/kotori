import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { AppTheme } from '../../../config/theme';
import { ShareHistoryItem as ShareHistoryItemType } from '../../../hooks/useShareHistory';

interface ShareHistoryItemProps {
  share: ShareHistoryItemType;
  onPress: () => void;
  onDelete: () => void;
  onReshare: () => void;
  isLast: boolean;
}

export const ShareHistoryItem: React.FC<ShareHistoryItemProps> = ({
  share,
  onPress,
  onDelete,
  onReshare,
  isLast,
}) => {
  const { theme } = useAppTheme();
  const styles = getShareHistoryItemStyles(theme);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return theme.colors.success;
      case 'expired':
        return theme.colors.error;
      case 'revoked':
        return theme.colors.textMuted;
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'active':
        return 'checkmark-circle';
      case 'expired':
        return 'time';
      case 'revoked':
        return 'ban';
      default:
        return 'help-circle';
    }
  };

  const getStatusText = (share: ShareHistoryItemType) => {
    if (share.status === 'expired') {
      return 'Expired';
    }
    if (share.status === 'revoked') {
      return 'Revoked';
    }
    if (share.days_until_expiry <= 1) {
      return 'Expires today';
    }
    if (share.days_until_expiry <= 7) {
      return `Expires in ${share.days_until_expiry} days`;
    }
    return 'Active';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface },
        !isLast && styles.containerBorder,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
              {share.title}
            </Text>
            <Text style={[styles.template, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {share.template_name}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            <Ionicons
              name={getStatusIcon(share.status)}
              size={16}
              color={getStatusColor(share.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(share.status) }]}>
              {getStatusText(share)}
            </Text>
          </View>
        </View>

        <View style={styles.metadata}>
          <View style={styles.metadataItem}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
            <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
              Created {formatDate(share.created_at || '')}
            </Text>
          </View>

          {share.access_count !== undefined && (
            <View style={styles.metadataItem}>
              <Ionicons name="eye-outline" size={14} color={theme.colors.textMuted} />
              <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
                {share.access_count} {share.access_count === 1 ? 'view' : 'views'}
              </Text>
            </View>
          )}

          <View style={styles.metadataItem}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
            <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
              {formatTime(share.created_at || '')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {share.status === 'active' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary + '20' }]}
            onPress={(e) => {
              e.stopPropagation();
              onReshare();
            }}
          >
            <Ionicons name="share-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.error + '20' }]}
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const getShareHistoryItemStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
  },
  containerBorder: {
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    borderRadius: 0,
  },
  content: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  titleContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    lineHeight: 20,
    marginBottom: theme.spacing.xs,
  },
  template: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metadataText: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ShareHistoryItem;
