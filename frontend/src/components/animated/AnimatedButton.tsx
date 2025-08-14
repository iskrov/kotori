import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { useButtonAnimation } from '../../hooks/useButtonAnimation';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success';
export type ButtonSize = 'small' | 'medium' | 'large';

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const { theme } = useAppTheme();
  const styles = getAnimatedButtonStyles(theme);
  const { pressIn, pressOut, animatedStyle } = useButtonAnimation({
    scaleValue: 0.96,
  });

  const isDisabled = disabled || loading;

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: isDisabled ? theme.colors.disabled : theme.colors.primary,
          textColor: theme.colors.surface,
        };
      case 'secondary':
        return {
          backgroundColor: isDisabled ? theme.colors.disabled : theme.colors.surface,
          borderColor: isDisabled ? theme.colors.disabled : theme.colors.primary,
          textColor: isDisabled ? theme.colors.textMuted : theme.colors.primary,
          borderWidth: 1,
        };
      case 'tertiary':
        return {
          backgroundColor: 'transparent',
          textColor: isDisabled ? theme.colors.disabled : theme.colors.primary,
        };
      case 'danger':
        return {
          backgroundColor: isDisabled ? theme.colors.disabled : theme.colors.error,
          textColor: theme.colors.surface,
        };
      case 'success':
        return {
          backgroundColor: isDisabled ? theme.colors.disabled : theme.colors.success,
          textColor: theme.colors.surface,
        };
      default:
        return {
          backgroundColor: isDisabled ? theme.colors.disabled : theme.colors.primary,
          textColor: theme.colors.surface,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          fontSize: theme.typography.fontSizes.sm,
          iconSize: 16,
        };
      case 'medium':
        return {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          fontSize: theme.typography.fontSizes.md,
          iconSize: 20,
        };
      case 'large':
        return {
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.xl,
          fontSize: theme.typography.fontSizes.lg,
          iconSize: 24,
        };
      default:
        return {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          fontSize: theme.typography.fontSizes.md,
          iconSize: 20,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const renderIcon = () => {
    if (!icon) return null;

    return (
      <Ionicons
        name={icon}
        size={sizeStyles.iconSize}
        color={variantStyles.textColor}
        style={iconPosition === 'left' ? styles.iconLeft : styles.iconRight}
      />
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={variantStyles.textColor}
          style={styles.loadingIndicator}
        />
      );
    }

    return (
      <>
        {icon && iconPosition === 'left' && renderIcon()}
        <Text
          style={[
            styles.text,
            {
              color: variantStyles.textColor,
              fontSize: sizeStyles.fontSize,
              fontFamily: theme.typography.fontFamilies.semiBold,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
        {icon && iconPosition === 'right' && renderIcon()}
      </>
    );
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        fullWidth && styles.fullWidth,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
            borderWidth: variantStyles.borderWidth || 0,
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
          },
          isDisabled && styles.disabled,
          style,
        ]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: isDisabled,
          busy: loading,
        }}
        testID={testID}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
};

const getAnimatedButtonStyles = (theme: AppTheme) => StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.spacing.md,
    minHeight: 44, // Accessibility minimum touch target
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: theme.spacing.sm,
  },
  iconRight: {
    marginLeft: theme.spacing.sm,
  },
  loadingIndicator: {
    // No additional styles needed, ActivityIndicator handles its own sizing
  },
});

export default AnimatedButton;
