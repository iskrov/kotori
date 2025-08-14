import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

interface SkeletonRectProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

interface SkeletonCircleProps {
  size: number;
  style?: any;
}

interface SkeletonItemProps {
  children: React.ReactNode;
  style?: any;
}

export const SkeletonRect: React.FC<SkeletonRectProps> = ({ 
  width, 
  height, 
  borderRadius = 4,
  style 
}) => {
  const { theme } = useAppTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.skeleton, theme.colors.skeletonHighlight],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCircle: React.FC<SkeletonCircleProps> = ({ size, style }) => {
  return (
    <SkeletonRect
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
};

export const SkeletonItem: React.FC<SkeletonItemProps> = ({ children, style }) => {
  const { theme } = useAppTheme();
  const styles = getSkeletonItemStyles(theme);

  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
};

const getSkeletonItemStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
});
