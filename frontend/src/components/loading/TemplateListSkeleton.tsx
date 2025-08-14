import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { SkeletonRect, SkeletonItem, SkeletonCircle } from './SkeletonBase';

interface TemplateListSkeletonProps {
  itemCount?: number;
  layout?: 'list' | 'grid';
}

export const TemplateListSkeleton: React.FC<TemplateListSkeletonProps> = ({ 
  itemCount = 3,
  layout = 'list'
}) => {
  const { theme } = useAppTheme();
  const styles = getTemplateListSkeletonStyles(theme);

  if (layout === 'grid') {
    return (
      <View style={styles.gridContainer}>
        {Array.from({ length: itemCount }).map((_, index) => (
          <SkeletonItem key={index} style={styles.gridItem}>
            <View style={styles.gridItemContent}>
              <SkeletonCircle size={48} />
              <SkeletonRect width="80%" height={16} style={styles.gridTitle} />
              <SkeletonRect width="100%" height={12} style={styles.gridDescription} />
              <SkeletonRect width="60%" height={12} style={styles.gridDescription} />
            </View>
          </SkeletonItem>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <SkeletonItem key={index} style={styles.listItem}>
          <View style={styles.listItemContent}>
            <SkeletonCircle size={40} />
            <View style={styles.listItemText}>
              <SkeletonRect width="70%" height={16} />
              <SkeletonRect width="100%" height={12} style={styles.listDescription} />
              <SkeletonRect width="85%" height={12} style={styles.listDescription} />
            </View>
            <SkeletonRect width={24} height={24} borderRadius={12} />
          </View>
        </SkeletonItem>
      ))}
    </View>
  );
};

const getTemplateListSkeletonStyles = (theme: AppTheme) => StyleSheet.create({
  listContainer: {
    padding: theme.spacing.sm,
  },
  listItem: {
    marginBottom: theme.spacing.sm,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemText: {
    flex: 1,
    marginLeft: theme.spacing.md,
    marginRight: theme.spacing.md,
  },
  listDescription: {
    marginTop: theme.spacing.xs,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: theme.spacing.md,
  },
  gridItemContent: {
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  gridTitle: {
    marginTop: theme.spacing.md,
  },
  gridDescription: {
    marginTop: theme.spacing.xs,
  },
});

export default TemplateListSkeleton;
