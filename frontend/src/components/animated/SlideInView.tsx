import React, { useRef, useEffect } from 'react';
import { Animated, ViewStyle, AccessibilityInfo, Easing } from 'react-native';

export type SlideDirection = 'up' | 'down' | 'left' | 'right';

interface SlideInViewProps {
  children: React.ReactNode;
  direction?: SlideDirection;
  distance?: number;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
  useNativeDriver?: boolean;
}

export const SlideInView: React.FC<SlideInViewProps> = ({
  children,
  direction = 'up',
  distance = 50,
  duration = 300,
  delay = 0,
  style,
  useNativeDriver = true,
}) => {
  const slideValue = useRef(new Animated.Value(getInitialValue(direction, distance))).current;

  useEffect(() => {
    const animate = async () => {
      // Check if reduced motion is enabled
      const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
      
      if (isReduceMotionEnabled) {
        // Skip animation and set final value immediately
        slideValue.setValue(0);
        return;
      }

      // Perform slide in animation
      const animation = Animated.timing(slideValue, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver,
      });

      animation.start();
      
      // Cleanup function
      return () => {
        animation.stop();
      };
    };

    animate();
  }, [slideValue, duration, delay, useNativeDriver]);

  const getTransform = () => {
    switch (direction) {
      case 'up':
      case 'down':
        return [{ translateY: slideValue }];
      case 'left':
      case 'right':
        return [{ translateX: slideValue }];
      default:
        return [{ translateY: slideValue }];
    }
  };

  return (
    <Animated.View
      style={[
        style,
        {
          transform: getTransform(),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

function getInitialValue(direction: SlideDirection, distance: number): number {
  switch (direction) {
    case 'up':
      return distance;
    case 'down':
      return -distance;
    case 'left':
      return distance;
    case 'right':
      return -distance;
    default:
      return distance;
  }
}

export default SlideInView;
