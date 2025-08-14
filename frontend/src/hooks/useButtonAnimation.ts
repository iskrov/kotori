import { useRef, useCallback } from 'react';
import { Animated, AccessibilityInfo } from 'react-native';

interface ButtonAnimationConfig {
  scaleValue?: number;
  duration?: number;
  tension?: number;
  friction?: number;
  useNativeDriver?: boolean;
}

interface ButtonAnimationReturn {
  scaleValue: Animated.Value;
  pressIn: () => void;
  pressOut: () => void;
  animatedStyle: {
    transform: [{ scale: Animated.Value }];
  };
}

const defaultConfig: Required<ButtonAnimationConfig> = {
  scaleValue: 0.95,
  duration: 100,
  tension: 300,
  friction: 10,
  useNativeDriver: true,
};

export const useButtonAnimation = (
  config: ButtonAnimationConfig = {}
): ButtonAnimationReturn => {
  const finalConfig = { ...defaultConfig, ...config };
  const scaleValue = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const pressIn = useCallback(() => {
    // Check if reduced motion is enabled
    AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (isEnabled) {
        return; // Skip animation if reduce motion is enabled
      }

      // Stop any ongoing animation
      if (animationRef.current) {
        animationRef.current.stop();
      }

      animationRef.current = Animated.spring(scaleValue, {
        toValue: finalConfig.scaleValue,
        useNativeDriver: finalConfig.useNativeDriver,
        tension: finalConfig.tension,
        friction: finalConfig.friction,
      });

      animationRef.current.start();
    });
  }, [scaleValue, finalConfig]);

  const pressOut = useCallback(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (isEnabled) {
        return; // Skip animation if reduce motion is enabled
      }

      // Stop any ongoing animation
      if (animationRef.current) {
        animationRef.current.stop();
      }

      animationRef.current = Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: finalConfig.useNativeDriver,
        tension: finalConfig.tension,
        friction: finalConfig.friction,
      });

      animationRef.current.start();
    });
  }, [scaleValue, finalConfig]);

  const animatedStyle = {
    transform: [{ scale: scaleValue }],
  };

  return {
    scaleValue,
    pressIn,
    pressOut,
    animatedStyle,
  };
};

export default useButtonAnimation;
