import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableOpacity,
  Dimensions,
  PanResponder 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
  position?: 'top' | 'bottom';
}

interface ToastNotificationProps extends ToastProps {
  visible: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOAST_HEIGHT = 80;
const ANIMATION_DURATION = 300;

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  visible,
  message,
  type = 'info',
  duration = 4000,
  onDismiss,
  action,
  position = 'top',
}) => {
  const { theme } = useAppTheme();
  const styles = getToastNotificationStyles(theme);
  
  const animatedValue = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const [isVisible, setIsVisible] = useState(visible);

  const getToastConfig = (toastType: ToastType) => {
    switch (toastType) {
      case 'success':
        return {
          backgroundColor: theme.colors.success,
          icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
          textColor: theme.colors.surface,
        };
      case 'error':
        return {
          backgroundColor: theme.colors.error,
          icon: 'alert-circle' as keyof typeof Ionicons.glyphMap,
          textColor: theme.colors.surface,
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.warning,
          icon: 'warning' as keyof typeof Ionicons.glyphMap,
          textColor: theme.colors.surface,
        };
      case 'info':
      default:
        return {
          backgroundColor: theme.colors.primary,
          icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
          textColor: theme.colors.surface,
        };
    }
  };

  const config = getToastConfig(type);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 20;
    },
    onPanResponderMove: (_, gestureState) => {
      if (position === 'top') {
        animatedValue.setValue(Math.min(0, gestureState.dy - TOAST_HEIGHT));
      } else {
        animatedValue.setValue(Math.max(0, gestureState.dy + TOAST_HEIGHT));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (Math.abs(gestureState.dy) > 50) {
        hideToast();
      } else {
        showToast();
      }
    },
  });

  const showToast = () => {
    setIsVisible(true);
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();

    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    }
  };

  const hideToast = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const targetValue = position === 'top' ? -TOAST_HEIGHT : TOAST_HEIGHT;
    
    Animated.timing(animatedValue, {
      toValue: targetValue,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onDismiss?.();
    });
  };

  useEffect(() => {
    if (visible) {
      showToast();
    } else {
      hideToast();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible]);

  if (!isVisible && !visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.topPosition : styles.bottomPosition,
        {
          backgroundColor: config.backgroundColor,
          transform: [{ translateY: animatedValue }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={config.icon}
            size={24}
            color={config.textColor}
          />
        </View>

        <View style={styles.messageContainer}>
          <Text
            style={[
              styles.message,
              { color: config.textColor }
            ]}
            numberOfLines={2}
          >
            {message}
          </Text>
        </View>

        {action && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text
              style={[
                styles.actionText,
                { color: config.textColor }
              ]}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.closeButton}
          onPress={hideToast}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Ionicons
            name="close"
            size={20}
            color={config.textColor}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// Toast Manager Hook
interface ToastState extends ToastProps {
  id: string;
  visible: boolean;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = (toastProps: ToastProps): string => {
    const id = Date.now().toString();
    const newToast: ToastState = {
      ...toastProps,
      id,
      visible: true,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after duration
    if (toastProps.duration !== 0) {
      setTimeout(() => {
        hideToast(id);
      }, toastProps.duration || 4000);
    }

    return id;
  };

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const hideAllToasts = () => {
    setToasts([]);
  };

  const ToastContainer: React.FC = () => (
    <>
      {toasts.map(toast => (
        <ToastNotification
          key={toast.id}
          {...toast}
          onDismiss={() => hideToast(toast.id)}
        />
      ))}
    </>
  );

  return {
    showToast,
    hideToast,
    hideAllToasts,
    ToastContainer,
  };
};

const getToastNotificationStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 9999,
    borderRadius: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  topPosition: {
    top: theme.spacing.xl + 20, // Account for status bar
  },
  bottomPosition: {
    bottom: theme.spacing.xl + 20, // Account for tab bar
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    minHeight: TOAST_HEIGHT,
  },
  iconContainer: {
    marginRight: theme.spacing.md,
  },
  messageContainer: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  message: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: theme.spacing.sm,
  },
  actionText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
});

export default ToastNotification;
