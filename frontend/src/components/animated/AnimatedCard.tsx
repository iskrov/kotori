import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
  Animated,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { useButtonAnimation } from '../../hooks/useButtonAnimation';

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  selected?: boolean;
  pressable?: boolean;
  elevation?: number;
  borderRadius?: number;
  padding?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  onPress,
  style,
  disabled = false,
  selected = false,
  pressable = true,
  elevation = 2,
  borderRadius,
  padding,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const { theme } = useAppTheme();
  const styles = getAnimatedCardStyles(theme);
  const { pressIn, pressOut, animatedStyle } = useButtonAnimation({
    scaleValue: 0.98,
  });

  const isInteractive = pressable && onPress && !disabled;

  const cardStyle = [
    styles.card,
    {
      backgroundColor: selected ? theme.colors.primaryLight : theme.colors.surface,
      borderColor: selected ? theme.colors.primary : theme.colors.border,
      borderWidth: selected ? 2 : 1,
      borderRadius: borderRadius ?? theme.spacing.md,
      padding: padding ?? theme.spacing.md,
      elevation: elevation,
      shadowOpacity: elevation > 0 ? 0.1 : 0,
    },
    disabled && styles.disabled,
    style,
  ];

  if (isInteractive) {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          style={cardStyle}
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{
            disabled,
            selected,
          }}
          testID={testID}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View
      style={cardStyle}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </View>
  );
};

const getAnimatedCardStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowRadius: 2,
    // Android shadow
    elevation: 2,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default AnimatedCard;
