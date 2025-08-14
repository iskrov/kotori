import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { SkeletonRect, SkeletonItem } from './SkeletonBase';

interface SharePreviewSkeletonProps {
  questionCount?: number;
  showHeader?: boolean;
  showActions?: boolean;
}

export const SharePreviewSkeleton: React.FC<SharePreviewSkeletonProps> = ({ 
  questionCount = 4,
  showHeader = true,
  showActions = true 
}) => {
  const { theme } = useAppTheme();
  const styles = getSharePreviewSkeletonStyles(theme);

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <SkeletonRect width="40%" height={24} />
          <SkeletonRect width="60%" height={16} style={styles.subtitle} />
          <SkeletonRect width="50%" height={14} style={styles.dateRange} />
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {Array.from({ length: questionCount }).map((_, index) => (
          <SkeletonItem key={index} style={styles.questionItem}>
            <View style={styles.questionHeader}>
              <SkeletonRect width="80%" height={16} />
              <SkeletonRect width="15%" height={12} style={styles.confidence} />
            </View>
            
            <View style={styles.answerContent}>
              <SkeletonRect width="100%" height={14} />
              <SkeletonRect width="95%" height={14} style={styles.answerLine} />
              <SkeletonRect width="85%" height={14} style={styles.answerLine} />
              <SkeletonRect width="70%" height={14} style={styles.answerLine} />
            </View>
          </SkeletonItem>
        ))}
      </ScrollView>

      {showActions && (
        <View style={styles.actions}>
          <SkeletonRect width="100%" height={48} borderRadius={24} />
        </View>
      )}
    </View>
  );
};

const getSharePreviewSkeletonStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
  },
  dateRange: {
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  questionItem: {
    marginBottom: theme.spacing.lg,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  confidence: {
    marginLeft: theme.spacing.md,
  },
  answerContent: {
    paddingLeft: theme.spacing.sm,
  },
  answerLine: {
    marginTop: theme.spacing.xs,
  },
  actions: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});

export default SharePreviewSkeleton;
