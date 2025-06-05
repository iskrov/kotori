import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number;
  style?: object;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'accent';
  testID?: string;
}

// Helper to determine if native driver should be used
const useNativeDriver = Platform.OS !== 'web';

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onPress,
  icon = 'mic',
  size = 56,
  style,
  disabled = false,
  variant = 'primary',
  testID = 'floating-action-button',
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme, size, variant);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for attention
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver,
        }),
      ])
    );
    
    if (!disabled) {
      pulse.start();
    }
    
    return () => pulse.stop();
  }, [disabled, pulseAnim]);

  const handlePressIn = () => {
    if (disabled) return;
    
    // Haptic feedback
    if (Platform.OS === 'ios') {
      // Use Haptics API if available
      try {
        const { Haptics } = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Fallback to vibration
        Vibration.vibrate(50);
      }
    } else if (Platform.OS === 'android') {
      Vibration.vibrate(50);
    }

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 4,
        useNativeDriver,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (disabled) return;
    onPress();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.shadowContainer,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.button,
            disabled && styles.disabled,
            {
              transform: [
                { scale: scaleAnim },
                { rotate: rotation },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.touchable}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            activeOpacity={0.8}
            testID={testID}
          >
            <Ionicons
              name={icon}
              size={size * 0.5}
              color={styles.icon.color}
            />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const getStyles = (theme: AppTheme, size: number, variant: 'primary' | 'secondary' | 'accent') => {
  const getVariantColors = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: theme.colors.secondary,
          shadowColor: theme.colors.secondary,
        };
      case 'accent':
        return {
          backgroundColor: theme.colors.accent,
          shadowColor: theme.colors.accent,
        };
      default:
        return {
          backgroundColor: theme.colors.primary,
          shadowColor: theme.colors.primary,
        };
    }
  };

  const variantColors = getVariantColors();

  return StyleSheet.create({
    container: {
      position: 'relative',
    },
    shadowContainer: {
      borderRadius: size / 2,
      ...theme.shadows.lg,
      shadowColor: variantColors.shadowColor,
    },
    button: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: variantColors.backgroundColor,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    touchable: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    disabled: {
      backgroundColor: theme.colors.disabled,
      opacity: 0.6,
    },
    icon: {
      color: theme.colors.onPrimary,
    },
  });
};

export default FloatingActionButton; 