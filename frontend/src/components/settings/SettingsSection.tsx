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
import { componentStyles } from '../../styles/theme';

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
      {collapsible ? (
        <TouchableOpacity style={styles.header} onPress={toggleExpanded}>
          {icon && (
            <Ionicons name={icon} size={20} color={theme.colors.textSecondary} style={styles.headerIcon} />
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {headerAction && (
            <View style={styles.headerAction}>
              {headerAction}
            </View>
          )}
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={theme.colors.textSecondary}
            style={styles.chevron}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.header}>
          {icon && (
            <Ionicons name={icon} size={20} color={theme.colors.textSecondary} style={styles.headerIcon} />
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {headerAction && (
            <View style={styles.headerAction}>
              {headerAction}
            </View>
          )}
        </View>
      )}
      {(!collapsible || isExpanded) && (
        <View style={styles.childrenContainer}>{children}</View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      ...componentStyles.card,
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
      marginVertical: theme.spacing.sm,
      marginHorizontal: theme.spacing.md,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerIcon: {
      marginRight: theme.spacing.md,
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: theme.typography.fontSizes.lg,
      fontFamily: theme.typography.fontFamilies.semiBold,
      fontWeight: '600',
      color: theme.colors.textSecondary, // Using textSecondary for softer appearance
    },
    headerAction: {
      marginLeft: theme.spacing.md,
    },
    subtitle: {
      fontSize: theme.typography.fontSizes.sm,
      color: theme.colors.textMuted, // Using textMuted for descriptions
      marginLeft: theme.spacing.sm,
      padding: theme.spacing.xs,
    },
    childrenContainer: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.chipBackground, // Using chip background
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.md,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.card,
    },
    chevron: {
      marginLeft: theme.spacing.sm,
    },
  });

export default SettingsSection; 