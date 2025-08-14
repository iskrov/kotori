import { Easing } from 'react-native';

// Animation durations (in milliseconds)
export const ANIMATION_DURATIONS = {
  // Quick interactions
  BUTTON_PRESS: 100,
  RIPPLE: 150,
  
  // Standard transitions
  FAST: 200,
  STANDARD: 300,
  SLOW: 500,
  
  // Complex animations
  SCREEN_TRANSITION: 400,
  MODAL_TRANSITION: 300,
  
  // Loading states
  SKELETON_PULSE: 1000,
  PROGRESS_UPDATE: 250,
  
  // Feedback animations
  SUCCESS_FEEDBACK: 600,
  ERROR_FEEDBACK: 400,
  
  // List animations
  STAGGER_DELAY: 100,
  LIST_ITEM_ENTER: 200,
} as const;

// Animation easing curves
export const ANIMATION_EASINGS = {
  // Standard Material Design easings
  STANDARD: Easing.out(Easing.ease),
  DECELERATE: Easing.out(Easing.quad),
  ACCELERATE: Easing.in(Easing.quad),
  ACCELERATE_DECELERATE: Easing.inOut(Easing.quad),
  
  // Spring-like easings
  BOUNCE: Easing.bounce,
  ELASTIC: Easing.elastic(1),
  BACK: Easing.back(1.1),
  
  // Custom easings for specific use cases
  BUTTON_PRESS: Easing.out(Easing.ease),
  SCREEN_ENTER: Easing.out(Easing.back(1.1)),
  MODAL_ENTER: Easing.out(Easing.ease),
  
  // Loading and progress
  PULSE: Easing.inOut(Easing.ease),
  PROGRESS: Easing.out(Easing.ease),
} as const;

// Animation scales and transforms
export const ANIMATION_SCALES = {
  BUTTON_PRESS: 0.95,
  CARD_PRESS: 0.98,
  MODAL_SCALE: 0.9,
  SUCCESS_PULSE: 1.1,
  ERROR_SHAKE: 1.05,
} as const;

// Animation distances (in pixels)
export const ANIMATION_DISTANCES = {
  SLIDE_SHORT: 20,
  SLIDE_MEDIUM: 50,
  SLIDE_LONG: 100,
  SHAKE_DISTANCE: 10,
} as const;

// Spring animation configurations
export const SPRING_CONFIGS = {
  BUTTON: {
    tension: 300,
    friction: 10,
  },
  MODAL: {
    tension: 100,
    friction: 8,
  },
  BOUNCE: {
    tension: 200,
    friction: 5,
  },
  GENTLE: {
    tension: 80,
    friction: 12,
  },
} as const;

// Stagger animation helpers
export const createStaggerConfig = (itemCount: number, baseDelay: number = ANIMATION_DURATIONS.STAGGER_DELAY) => {
  return Array.from({ length: itemCount }, (_, index) => ({
    delay: index * baseDelay,
    index,
  }));
};

// Common animation sequences
export const ANIMATION_SEQUENCES = {
  FADE_IN_UP: {
    fade: {
      from: 0,
      to: 1,
      duration: ANIMATION_DURATIONS.STANDARD,
      easing: ANIMATION_EASINGS.STANDARD,
    },
    slide: {
      from: ANIMATION_DISTANCES.SLIDE_MEDIUM,
      to: 0,
      duration: ANIMATION_DURATIONS.STANDARD,
      easing: ANIMATION_EASINGS.SCREEN_ENTER,
    },
  },
  SCALE_IN: {
    scale: {
      from: 0.8,
      to: 1,
      duration: ANIMATION_DURATIONS.STANDARD,
      easing: ANIMATION_EASINGS.BACK,
    },
    fade: {
      from: 0,
      to: 1,
      duration: ANIMATION_DURATIONS.FAST,
      easing: ANIMATION_EASINGS.STANDARD,
    },
  },
} as const;

// Screen transition configurations for React Navigation
export const SCREEN_TRANSITIONS = {
  SLIDE_FROM_RIGHT: {
    gestureEnabled: true,
    gestureDirection: 'horizontal' as const,
    transitionSpec: {
      open: {
        animation: 'timing' as const,
        config: {
          duration: ANIMATION_DURATIONS.SCREEN_TRANSITION,
          easing: ANIMATION_EASINGS.DECELERATE,
        },
      },
      close: {
        animation: 'timing' as const,
        config: {
          duration: ANIMATION_DURATIONS.SCREEN_TRANSITION,
          easing: ANIMATION_EASINGS.ACCELERATE,
        },
      },
    },
  },
  MODAL_PRESENTATION: {
    gestureEnabled: true,
    gestureDirection: 'vertical' as const,
    transitionSpec: {
      open: {
        animation: 'timing' as const,
        config: {
          duration: ANIMATION_DURATIONS.MODAL_TRANSITION,
          easing: ANIMATION_EASINGS.MODAL_ENTER,
        },
      },
      close: {
        animation: 'timing' as const,
        config: {
          duration: ANIMATION_DURATIONS.MODAL_TRANSITION,
          easing: ANIMATION_EASINGS.ACCELERATE,
        },
      },
    },
  },
} as const;

// Utility functions for animations
export const getStaggeredDelay = (index: number, baseDelay: number = ANIMATION_DURATIONS.STAGGER_DELAY): number => {
  return index * baseDelay;
};

export const createParallelAnimation = (animations: any[]) => {
  return {
    parallel: true,
    animations,
  };
};

export const createSequenceAnimation = (animations: any[]) => {
  return {
    sequence: true,
    animations,
  };
};
