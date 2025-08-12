import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { accessibilityTokens } from '../../styles/theme';
import hapticService from '../../services/hapticService';

interface SettingsRowProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  leftIconColor?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  showChevron?: boolean;
  testID?: string;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  title,
  subtitle,
  leftIcon,
  leftIconColor,
  rightElement,
  onPress,
  disabled = false,
  style,
  showChevron = false,
  testID,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  const handlePress = () => {
    if (!disabled && onPress) {
      hapticService.selection(); // Light haptic feedback for settings interactions
      onPress();
    }
  };

  const isInteractive = !!onPress && !disabled;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        disabled && styles.containerDisabled,
        !isInteractive && styles.containerNonInteractive,
        style,
      ]}
      onPress={handlePress}
      disabled={!isInteractive}
      activeOpacity={isInteractive ? 0.7 : 1}
      testID={testID}
      accessibilityRole={isInteractive ? 'button' : 'text'}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={isInteractive ? 'Tap to modify this setting' : undefined}
    >
      <View style={styles.leftSection}>
        {leftIcon && (
          <View style={styles.iconContainer}>
            <Ionicons
              name={leftIcon}
              size={22}
              color={disabled ? theme.colors.disabled : (leftIconColor || theme.colors.primary)}
            />
          </View>
        )}
        
        <View style={styles.textContainer}>
          <Text 
            style={[
              styles.title,
              disabled && styles.titleDisabled,
            ]}
          >
            {title}
          </Text>
          
          {subtitle && (
            <Text 
              style={[
                styles.subtitle,
                disabled && styles.subtitleDisabled,
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        {rightElement}
        
        {showChevron && isInteractive && (
          <View style={styles.chevronContainer}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={disabled ? theme.colors.disabled : theme.colors.textSecondary}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: accessibilityTokens.minTouchTarget, // Ensure proper touch target
  },
  containerDisabled: {
    opacity: 0.6,
  },
  containerNonInteractive: {
    // No special styling for non-interactive rows
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.chipBackground, // Using chip background
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  titleDisabled: {
    color: theme.colors.textSecondary,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    color: theme.colors.textMuted, // Using textMuted for subtitles
    lineHeight: 18,
  },
  subtitleDisabled: {
    color: theme.colors.border,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.md,
  },
  chevronContainer: {
    marginLeft: theme.spacing.sm,
  },
});

export default SettingsRow; 