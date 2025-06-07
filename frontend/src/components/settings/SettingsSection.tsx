import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

interface SettingsSectionProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  collapsible?: boolean;
  initiallyExpanded?: boolean;
  headerAction?: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  collapsible = false,
  initiallyExpanded = true,
  headerAction,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  const toggleExpanded = () => {
    if (collapsible) {
      // Use LayoutAnimation for smooth collapse/expand
      if (Platform.OS !== 'web') {
        LayoutAnimation.configureNext({
          duration: 300,
          create: { type: 'easeInEaseOut', property: 'opacity' },
          update: { type: 'easeInEaseOut' },
          delete: { type: 'easeInEaseOut', property: 'opacity' },
        });
      }
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        disabled={!collapsible}
        activeOpacity={collapsible ? 0.7 : 1}
        accessibilityRole={collapsible ? 'button' : 'text'}
        accessibilityLabel={`${title} section${collapsible ? (isExpanded ? ', expanded' : ', collapsed') : ''}`}
        accessibilityHint={collapsible ? 'Tap to toggle section visibility' : undefined}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <View style={styles.iconContainer}>
              <Ionicons
                name={icon}
                size={24}
                color={theme.colors.primary}
              />
            </View>
          )}
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}
          </View>
        </View>

        <View style={styles.headerRight}>
          {headerAction}
          
          {collapsible && (
            <View style={styles.chevronContainer}>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Section Content */}
      {isExpanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 64,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.md,
  },
  chevronContainer: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  content: {
    backgroundColor: theme.colors.card,
  },
});

export default SettingsSection; 