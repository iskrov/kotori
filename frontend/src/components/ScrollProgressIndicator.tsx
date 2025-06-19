import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

interface ScrollProgressIndicatorProps {
  scrollY: Animated.Value;
  contentHeight: number;
  viewHeight: number;
  style?: any;
  showThreshold?: number; // Show indicator after scrolling this many pixels
  position?: 'top' | 'bottom';
  thickness?: number;
}

const ScrollProgressIndicator: React.FC<ScrollProgressIndicatorProps> = ({
  scrollY,
  contentHeight,
  viewHeight,
  style,
  showThreshold = 100,
  position = 'top',
  thickness = 3,
}) => {
  const { theme } = useAppTheme();
  const { width: screenWidth } = Dimensions.get('window');
  const styles = getStyles(theme, position, thickness);

  // Calculate the scroll progress
  const scrollableHeight = Math.max(contentHeight - viewHeight, 1);
  
  const progressWidth = scrollY.interpolate({
    inputRange: [0, scrollableHeight],
    outputRange: [0, screenWidth],
    extrapolate: 'clamp',
  });

  const opacity = scrollY.interpolate({
    inputRange: [0, showThreshold, showThreshold + 50],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.container, { opacity }, style]}>
      <View style={styles.track}>
        <Animated.View 
          style={[
            styles.progress,
            { width: progressWidth }
          ]} 
        />
      </View>
    </Animated.View>
  );
};

// Hook for managing scroll progress in components
export const useScrollProgress = () => {
  const [scrollY] = useState(new Animated.Value(0));
  const [contentHeight, setContentHeight] = useState(0);
  const [viewHeight, setViewHeight] = useState(0);

  const handleScroll = useCallback(
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: false }
    ),
    [scrollY]
  );

  const handleContentSizeChange = useCallback((width: number, height: number) => {
    setContentHeight(height);
  }, []);

  const handleLayout = useCallback((event: any) => {
    setViewHeight(event.nativeEvent.layout.height);
  }, []);

  return {
    scrollY,
    contentHeight,
    viewHeight,
    handleScroll,
    handleContentSizeChange,
    handleLayout,
  };
};

// Mini scroll position indicator (shows current page/section)
interface ScrollPositionHintProps {
  currentSection: number;
  totalSections: number;
  sectionNames?: string[];
  style?: any;
}

export const ScrollPositionHint: React.FC<ScrollPositionHintProps> = ({
  currentSection,
  totalSections,
  sectionNames,
  style,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  if (totalSections <= 1) return null;

  return (
    <View style={[styles.hintContainer, style]}>
      <View style={styles.hintDots}>
        {Array.from({ length: totalSections }, (_, index) => (
          <View
            key={index}
            style={[
              styles.hintDot,
              index === currentSection && styles.hintDotActive,
            ]}
          />
        ))}
      </View>
      {sectionNames && sectionNames[currentSection] && (
        <View style={styles.hintText}>
          <Text style={styles.hintTextContent}>
            {sectionNames[currentSection]}
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme, position?: 'top' | 'bottom', thickness?: number) => {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      [position === 'bottom' ? 'bottom' : 'top']: 0,
      zIndex: 1000,
    },
    track: {
      height: thickness || 3,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    progress: {
      height: '100%',
      backgroundColor: theme.colors.primary,
    },
    hintContainer: {
      position: 'absolute',
      right: theme.spacing.md,
      top: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.spacing.sm,
      padding: theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    hintDots: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    hintDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.border,
      marginHorizontal: 2,
    },
    hintDotActive: {
      backgroundColor: theme.colors.primary,
      transform: [{ scale: 1.2 }],
    },
    hintText: {
      marginLeft: theme.spacing.sm,
    },
    hintTextContent: {
      fontSize: theme.typography.fontSizes.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamilies.medium,
    },
  });
};

export default ScrollProgressIndicator; 