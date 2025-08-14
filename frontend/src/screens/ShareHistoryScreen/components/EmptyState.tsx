import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { AppTheme } from '../../../config/theme';

interface EmptyStateProps {
  hasShares: boolean;
  searchQuery: string;
  onClearSearch: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  hasShares,
  searchQuery,
  onClearSearch,
}) => {
  const { theme } = useAppTheme();
  const styles = getEmptyStateStyles(theme);

  if (searchQuery && hasShares) {
    // Search returned no results
    return (
      <View style={styles.container}>
        <Ionicons name="search" size={64} color={theme.colors.textMuted} />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          No Results Found
        </Text>
        <Text style={[styles.message, { color: theme.colors.textMuted }]}>
          No shares match "{searchQuery}". Try a different search term or clear your search to see all shares.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={onClearSearch}
        >
          <Text style={[styles.buttonText, { color: theme.colors.primaryContrast }]}>
            Clear Search
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No shares at all
  return (
    <View style={styles.container}>
      <Ionicons name="share-outline" size={64} color={theme.colors.textMuted} />
      <Text style={[styles.title, { color: theme.colors.text }]}>
        No Shares Yet
      </Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>
        You haven't created any shares yet. Start by creating a journal entry summary to share with your healthcare providers.
      </Text>
      <View style={styles.steps}>
        <View style={styles.step}>
          <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumberText, { color: theme.colors.primaryContrast }]}>
              1
            </Text>
          </View>
          <Text style={[styles.stepText, { color: theme.colors.textMuted }]}>
            Go to the Share tab
          </Text>
        </View>
        <View style={styles.step}>
          <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumberText, { color: theme.colors.primaryContrast }]}>
              2
            </Text>
          </View>
          <Text style={[styles.stepText, { color: theme.colors.textMuted }]}>
            Select a time period and template
          </Text>
        </View>
        <View style={styles.step}>
          <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumberText, { color: theme.colors.primaryContrast }]}>
              3
            </Text>
          </View>
          <Text style={[styles.stepText, { color: theme.colors.textMuted }]}>
            Review and share your summary
          </Text>
        </View>
      </View>
    </View>
  );
};

const getEmptyStateStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xl,
  },
  buttonText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  steps: {
    alignSelf: 'stretch',
    gap: theme.spacing.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  stepText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
  },
});

export default EmptyState;
