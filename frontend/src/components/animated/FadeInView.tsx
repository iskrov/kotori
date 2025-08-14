import React, { useRef, useEffect } from 'react';
import { Animated, ViewStyle, AccessibilityInfo, Easing } from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
  fadeFrom?: number;
  fadeTo?: number;
  useNativeDriver?: boolean;
}

export const FadeInView: React.FC<FadeInViewProps> = ({
  children,
  duration = 300,
  delay = 0,
  style,
  fadeFrom = 0,
  fadeTo = 1,
  useNativeDriver = true,
}) => {
  const fadeValue = useRef(new Animated.Value(fadeFrom)).current;

  useEffect(() => {
    const animate = async () => {
      // Check if reduced motion is enabled
      const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
      
      if (isReduceMotionEnabled) {
        // Skip animation and set final value immediately
        fadeValue.setValue(fadeTo);
        return;
      }

      // Perform fade in animation
      const animation = Animated.timing(fadeValue, {
        toValue: fadeTo,
        duration,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver,
      });

      animation.start();
      
      // Cleanup function
      return () => {
        animation.stop();
      };
    };

    animate();
  }, [fadeValue, duration, delay, fadeTo, useNativeDriver]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeValue,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default FadeInView;
