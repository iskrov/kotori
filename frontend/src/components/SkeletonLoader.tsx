import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to determine if native driver should be used
const useNativeDriver = Platform.OS !== 'web';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius,
  style,
  variant = 'rectangular',
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme, variant);
  
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver,
      })
    );
    
    shimmer.start();
    
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const getVariantStyles = () => {
    switch (variant) {
      case 'text':
        return {
          height: 16,
          borderRadius: theme.borderRadius.sm,
        };
      case 'circular':
        return {
          width: height,
          height: height,
          borderRadius: height / 2,
        };
      case 'card':
        return {
          height: 200,
          borderRadius: theme.borderRadius.xl,
        };
      default:
        return {
          borderRadius: borderRadius || theme.borderRadius.md,
        };
    }
  };

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  const variantStyles = getVariantStyles();

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height: variantStyles.height || height,
          borderRadius: variantStyles.borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX: shimmerTranslateX }],
          },
        ]}
      />
    </View>
  );
};

// Skeleton components for common use cases
export const SkeletonText: React.FC<Omit<SkeletonLoaderProps, 'variant'>> = (props) => (
  <SkeletonLoader {...props} variant="text" />
);

export const SkeletonCircle: React.FC<Omit<SkeletonLoaderProps, 'variant'>> = (props) => (
  <SkeletonLoader {...props} variant="circular" />
);

export const SkeletonCard: React.FC<Omit<SkeletonLoaderProps, 'variant'>> = (props) => (
  <SkeletonLoader {...props} variant="card" />
);

// Journal card skeleton
export const JournalCardSkeleton: React.FC = () => {
  const { theme } = useAppTheme();
  
  return (
    <View style={{
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.sm,
      marginHorizontal: theme.spacing.xs,
      ...theme.shadows.md,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <SkeletonText width="40%" height={14} style={{ marginBottom: theme.spacing.xs }} />
          <SkeletonText width="25%" height={12} />
        </View>
        <SkeletonCircle height={36} />
      </View>
      
      {/* Title */}
      <SkeletonText width="80%" height={20} style={{ marginBottom: theme.spacing.md }} />
      
      {/* Content */}
      <SkeletonText width="100%" height={16} style={{ marginBottom: theme.spacing.sm }} />
      <SkeletonText width="90%" height={16} style={{ marginBottom: theme.spacing.sm }} />
      <SkeletonText width="60%" height={16} style={{ marginBottom: theme.spacing.lg }} />
      
      {/* Tags */}
      <View style={{ flexDirection: 'row' }}>
        <SkeletonText width={60} height={24} borderRadius={12} style={{ marginRight: theme.spacing.sm }} />
        <SkeletonText width={80} height={24} borderRadius={12} style={{ marginRight: theme.spacing.sm }} />
        <SkeletonText width={50} height={24} borderRadius={12} />
      </View>
    </View>
  );
};

const getStyles = (theme: AppTheme, variant: string) => StyleSheet.create({
  container: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray200,
    overflow: 'hidden',
  },
  shimmer: {
    width: '30%',
    height: '100%',
    backgroundColor: theme.isDarkMode ? theme.colors.gray600 : theme.colors.gray300,
    opacity: 0.5,
  },
});

export default SkeletonLoader; 