import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { SkeletonRect, SkeletonItem, SkeletonCircle } from './SkeletonBase';

interface ShareListSkeletonProps {
  itemCount?: number;
  showSearch?: boolean;
}

export const ShareListSkeleton: React.FC<ShareListSkeletonProps> = ({ 
  itemCount = 5,
  showSearch = false 
}) => {
  const { theme } = useAppTheme();
  const styles = getShareListSkeletonStyles(theme);

  return (
    <View style={styles.container}>
      {showSearch && (
        <View style={styles.searchContainer} testID="search-skeleton">
          <SkeletonRect width="100%" height={40} borderRadius={20} />
        </View>
      )}
      
      {Array.from({ length: itemCount }).map((_, index) => (
        <SkeletonItem key={index} style={styles.shareItem}>
          <View style={styles.shareHeader} testID="skeleton-header">
            <View style={styles.shareTitle}>
              <SkeletonRect width="60%" height={18} />
              <SkeletonRect width="40%" height={14} style={styles.shareSubtitle} />
            </View>
            <SkeletonCircle size={24} />
          </View>
          
          <View style={styles.shareContent} testID="skeleton-content">
            <SkeletonRect width="100%" height={12} />
            <SkeletonRect width="80%" height={12} style={styles.contentLine} />
            <SkeletonRect width="65%" height={12} style={styles.contentLine} />
          </View>
          
          <View style={styles.shareFooter} testID="skeleton-footer">
            <SkeletonRect width="30%" height={12} />
            <SkeletonRect width="25%" height={12} />
            <SkeletonRect width="35%" height={12} />
          </View>
        </SkeletonItem>
      ))}
    </View>
  );
};

const getShareListSkeletonStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  searchContainer: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  shareItem: {
    marginBottom: theme.spacing.md,
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  shareTitle: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  shareSubtitle: {
    marginTop: theme.spacing.xs,
  },
  shareContent: {
    marginBottom: theme.spacing.sm,
  },
  contentLine: {
    marginTop: theme.spacing.xs,
  },
  shareFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default ShareListSkeleton;
