import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

interface ScreenHeaderProps {
  title: string;
  showSecretTagIndicator?: boolean;
  secretTagText?: string;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ 
  title, 
  showSecretTagIndicator = false, 
  secretTagText = "Secret Tags Active" 
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {showSecretTagIndicator && (
        <View style={styles.secretTagIndicator}>
          <Ionicons name="shield-checkmark" size={16} color={theme.colors.primary} />
          <Text style={styles.secretTagText}>{secretTagText}</Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  header: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  secretTagIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primaryLight || theme.colors.primary + '20',
    borderRadius: 12,
  },
  secretTagText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.primary,
    marginLeft: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.medium,
  },
});

export default ScreenHeader; 