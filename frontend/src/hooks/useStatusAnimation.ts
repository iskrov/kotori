import { useRef, useCallback } from 'react';
import { Animated, AccessibilityInfo, Easing } from 'react-native';

export type StatusType = 'success' | 'error' | 'warning' | 'info';

interface StatusAnimationConfig {
  duration?: number;
  delay?: number;
  scaleTo?: number;
  useNativeDriver?: boolean;
}

interface StatusAnimationReturn {
  fadeValue: Animated.Value;
  scaleValue: Animated.Value;
  slideValue: Animated.Value;
  showStatus: (type: StatusType) => void;
  hideStatus: () => void;
  animatedStyle: {
    opacity: Animated.Value;
    transform: Array<{ scale: Animated.Value } | { translateY: Animated.Value }>;
  };
}

const defaultConfig: Required<StatusAnimationConfig> = {
  duration: 300,
  delay: 2000,
  scaleTo: 1,
  useNativeDriver: true,
};

export const useStatusAnimation = (
  config: StatusAnimationConfig = {}
): StatusAnimationReturn => {
  const finalConfig = { ...defaultConfig, ...config };
  
  const fadeValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.8)).current;
  const slideValue = useRef(new Animated.Value(-50)).current;
  
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showStatus = useCallback((type: StatusType) => {
    AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (isEnabled) {
        // For reduced motion, just set final values
        fadeValue.setValue(1);
        scaleValue.setValue(1);
        slideValue.setValue(0);
        
        // Still auto-hide after delay
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          fadeValue.setValue(0);
          scaleValue.setValue(0.8);
          slideValue.setValue(-50);
        }, finalConfig.delay);
        
        return;
      }

      // Stop any ongoing animations
      if (animationRef.current) {
        animationRef.current.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset values
      fadeValue.setValue(0);
      scaleValue.setValue(0.8);
      slideValue.setValue(-50);

      // Show animation
      animationRef.current = Animated.parallel([
        Animated.timing(fadeValue, {
          toValue: 1,
          duration: finalConfig.duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: finalConfig.useNativeDriver,
        }),
        Animated.spring(scaleValue, {
          toValue: finalConfig.scaleTo,
          tension: 100,
          friction: 8,
          useNativeDriver: finalConfig.useNativeDriver,
        }),
        Animated.spring(slideValue, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: finalConfig.useNativeDriver,
        }),
      ]);

      animationRef.current.start(() => {
        // Auto-hide after delay
        timeoutRef.current = setTimeout(() => {
          hideStatus();
        }, finalConfig.delay);
      });
    });
  }, [fadeValue, scaleValue, slideValue, finalConfig]);

  const hideStatus = useCallback(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (isEnabled) {
        // For reduced motion, just set final values
        fadeValue.setValue(0);
        scaleValue.setValue(0.8);
        slideValue.setValue(-50);
        return;
      }

      // Stop any ongoing animations
      if (animationRef.current) {
        animationRef.current.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Hide animation
      animationRef.current = Animated.parallel([
        Animated.timing(fadeValue, {
          toValue: 0,
          duration: finalConfig.duration,
          easing: Easing.in(Easing.ease),
          useNativeDriver: finalConfig.useNativeDriver,
        }),
        Animated.spring(scaleValue, {
          toValue: 0.8,
          tension: 100,
          friction: 8,
          useNativeDriver: finalConfig.useNativeDriver,
        }),
        Animated.timing(slideValue, {
          toValue: -50,
          duration: finalConfig.duration,
          easing: Easing.in(Easing.ease),
          useNativeDriver: finalConfig.useNativeDriver,
        }),
      ]);

      animationRef.current.start();
    });
  }, [fadeValue, scaleValue, slideValue, finalConfig]);

  const animatedStyle = {
    opacity: fadeValue,
    transform: [
      { scale: scaleValue },
      { translateY: slideValue },
    ],
  };

  return {
    fadeValue,
    scaleValue,
    slideValue,
    showStatus,
    hideStatus,
    animatedStyle,
  };
};

export default useStatusAnimation;
