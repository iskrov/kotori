import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Modal,
  Platform,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Helper for native driver compatibility
const useNativeDriver = Platform.OS !== 'web';

interface BottomSheetProps {
  children: React.ReactNode;
  visible: boolean;
  onClose: () => void;
  snapPoints?: number[];
  initialSnapPoint?: number;
  enablePanGesture?: boolean;
  backdropOpacity?: number;
  style?: object;
}

export interface BottomSheetRef {
  snapTo: (index: number) => void;
  close: () => void;
}

const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(({
  children,
  visible,
  onClose,
  snapPoints = [0.3, 0.6, 0.9],
  initialSnapPoint = 1,
  enablePanGesture = true,
  backdropOpacity = 0.5,
  style,
}, ref) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity_ = useRef(new Animated.Value(0)).current;
  const lastGestureY = useRef(0);
  const currentSnapIndex = useRef(initialSnapPoint);
  const gestureTranslateY = useRef(new Animated.Value(0)).current;

  const snapPointsInPixels = snapPoints.map(point => SCREEN_HEIGHT * (1 - point));

  useImperativeHandle(ref, () => ({
    snapTo: (index: number) => {
      if (index >= 0 && index < snapPointsInPixels.length) {
        currentSnapIndex.current = index;
        Animated.spring(translateY, {
          toValue: snapPointsInPixels[index],
          useNativeDriver,
        }).start();
      }
    },
    close: () => {
      onClose();
    },
  }));

  useEffect(() => {
    if (visible) {
      // Show bottom sheet
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: snapPointsInPixels[initialSnapPoint],
          useNativeDriver,
        }),
        Animated.timing(backdropOpacity_, {
          toValue: 1,
          duration: 300,
          useNativeDriver,
        }),
      ]).start();
      currentSnapIndex.current = initialSnapPoint;
    } else {
      // Hide bottom sheet
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: SCREEN_HEIGHT,
          useNativeDriver,
        }),
        Animated.timing(backdropOpacity_, {
          toValue: 0,
          duration: 300,
          useNativeDriver,
        }),
      ]).start();
    }
  }, [visible, initialSnapPoint]);

  // Use a more React-friendly approach for gesture handling
  const onGestureEvent = useCallback(
    Animated.event(
      [{ nativeEvent: { translationY: gestureTranslateY } }],
      { 
        useNativeDriver: false, // Set to false for web compatibility
        listener: (event: any) => {
          // Optional: Add any additional gesture handling here
          if (!enablePanGesture) return;
          
          const { translationY } = event.nativeEvent;
          lastGestureY.current = translationY;
        }
      }
    ),
    [enablePanGesture, gestureTranslateY]
  );

  const onHandlerStateChange = useCallback((event: any) => {
    if (!enablePanGesture) return;

    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;
      const currentY = snapPointsInPixels[currentSnapIndex.current] + translationY;
      
      // Reset gesture value
      gestureTranslateY.setValue(0);
      
      // Determine which snap point to go to
      let targetSnapIndex = currentSnapIndex.current;
      
      if (velocityY > 500) {
        // Fast downward swipe - go to next snap point or close
        targetSnapIndex = Math.min(currentSnapIndex.current + 1, snapPointsInPixels.length - 1);
        if (targetSnapIndex === snapPointsInPixels.length - 1 && translationY > 100) {
          onClose();
          return;
        }
      } else if (velocityY < -500) {
        // Fast upward swipe - go to previous snap point
        targetSnapIndex = Math.max(currentSnapIndex.current - 1, 0);
      } else {
        // Find closest snap point
        let minDistance = Infinity;
        snapPointsInPixels.forEach((point, index) => {
          const distance = Math.abs(currentY - point);
          if (distance < minDistance) {
            minDistance = distance;
            targetSnapIndex = index;
          }
        });
        
        // If dragged down significantly, close
        if (currentY > SCREEN_HEIGHT * 0.8) {
          onClose();
          return;
        }
      }

      currentSnapIndex.current = targetSnapIndex;
      Animated.spring(translateY, {
        toValue: snapPointsInPixels[targetSnapIndex],
        useNativeDriver,
      }).start();
    }
  }, [enablePanGesture, snapPointsInPixels, onClose, translateY]);

  const handleBackdropPress = () => {
    onClose();
  };

  if (!visible) {
    return null;
  }

  // Combine translateY and gestureTranslateY for smoother gestures
  const combinedTranslateY = Animated.add(translateY, gestureTranslateY);

  const content = (
    <View style={styles.container}>
      
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity_.interpolate({
                inputRange: [0, 1],
                outputRange: [0, backdropOpacity],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={enablePanGesture}
      >
        <Animated.View
          style={[
            styles.bottomSheet,
            style,
            {
              transform: [{ translateY: combinedTranslateY }],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.content}>
            {children}
          </View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={onClose}
      >
        {content}
      </Modal>
    );
  }

  return content;
});

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
  bottomSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    minHeight: SCREEN_HEIGHT * 0.3,
    maxHeight: SCREEN_HEIGHT * 0.95,
    ...theme.shadows.xl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
});

export default BottomSheet; 