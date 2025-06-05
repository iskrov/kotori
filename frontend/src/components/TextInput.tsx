import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  Animated,
  TextInputProps as RNTextInputProps,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

// Helper to determine if native driver should be used
const useNativeDriver = Platform.OS !== 'web';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  variant?: 'outlined' | 'filled';
  size?: 'small' | 'medium' | 'large';
  required?: boolean;
  characterCount?: boolean;
  maxLength?: number;
  style?: object;
}

const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  variant = 'outlined',
  size = 'medium',
  required = false,
  characterCount = false,
  maxLength,
  value = '',
  onFocus,
  onBlur,
  style,
  ...props
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme, variant, size, !!error);
  
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!value);
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    setHasValue(!!value);
    Animated.timing(labelAnim, {
      toValue: (isFocused || !!value) ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, isFocused]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.parallel([
      Animated.timing(labelAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(borderAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.parallel([
      Animated.timing(labelAnim, {
        toValue: hasValue ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(borderAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
    onBlur?.(e);
  };

  const labelStyle = {
    transform: [
      {
        translateY: labelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -28],
        }),
      },
      {
        scale: labelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.85],
        }),
      },
    ],
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? theme.colors.error : theme.colors.border,
      error ? theme.colors.error : theme.colors.primary,
    ],
  });

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          minHeight: 40,
          paddingVertical: theme.spacing.sm,
          fontSize: theme.typography.fontSizes.sm,
        };
      case 'large':
        return {
          minHeight: 56,
          paddingVertical: theme.spacing.lg,
          fontSize: theme.typography.fontSizes.lg,
        };
      default:
        return {
          minHeight: 48,
          paddingVertical: theme.spacing.md,
          fontSize: theme.typography.fontSizes.md,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.inputContainer, { borderColor }]}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
        )}
        
        <View style={styles.inputWrapper}>
          <Animated.Text style={[styles.label, labelStyle]}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Animated.Text>
          
          <RNTextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                minHeight: sizeStyles.minHeight,
                paddingVertical: sizeStyles.paddingVertical,
                fontSize: sizeStyles.fontSize,
              },
              leftIcon && styles.inputWithLeftIcon,
              rightIcon && styles.inputWithRightIcon,
            ]}
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={theme.colors.textSecondary}
            maxLength={maxLength}
            {...props}
          />
        </View>

        {rightIcon && (
          <View style={styles.rightIconContainer}>
            <Ionicons
              name={rightIcon}
              size={20}
              color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
              onPress={onRightIconPress}
            />
          </View>
        )}
      </Animated.View>

      {/* Helper text, error, or character count */}
      <View style={styles.bottomContainer}>
        <View style={styles.helperContainer}>
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : helperText ? (
            <Text style={styles.helperText}>{helperText}</Text>
          ) : null}
        </View>

        {characterCount && maxLength && (
          <Text style={styles.characterCount}>
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
};

const getStyles = (theme: AppTheme, variant: string, size: string, hasError: boolean) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing.lg,
    },
    inputContainer: {
      borderWidth: 1,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: variant === 'filled' ? theme.colors.inputBackground : 'transparent',
      position: 'relative',
    },
    leftIconContainer: {
      position: 'absolute',
      left: theme.spacing.md,
      top: '50%',
      marginTop: -10,
      zIndex: 1,
    },
    rightIconContainer: {
      position: 'absolute',
      right: theme.spacing.md,
      top: '50%',
      marginTop: -10,
      zIndex: 1,
    },
    inputWrapper: {
      position: 'relative',
      flex: 1,
    },
    label: {
      position: 'absolute',
      left: theme.spacing.md,
      top: '50%',
      marginTop: -8,
      fontSize: theme.typography.fontSizes.md,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamilies.medium,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.xs,
      zIndex: 1,
    },
    required: {
      color: theme.colors.error,
    },
    input: {
      paddingHorizontal: theme.spacing.md,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamilies.regular,
      textAlignVertical: 'top',
    },
    inputWithLeftIcon: {
      paddingLeft: theme.spacing.xxxl,
    },
    inputWithRightIcon: {
      paddingRight: theme.spacing.xxxl,
    },
    bottomContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginTop: theme.spacing.xs,
      minHeight: 20,
    },
    helperContainer: {
      flex: 1,
    },
    helperText: {
      fontSize: theme.typography.fontSizes.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamilies.regular,
      lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.xs,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorText: {
      fontSize: theme.typography.fontSizes.xs,
      color: theme.colors.error,
      fontFamily: theme.typography.fontFamilies.medium,
      marginLeft: theme.spacing.xs,
      lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.xs,
    },
    characterCount: {
      fontSize: theme.typography.fontSizes.xs,
      color: theme.colors.textDisabled,
      fontFamily: theme.typography.fontFamilies.regular,
      marginLeft: theme.spacing.md,
    },
  });

export default TextInput; 