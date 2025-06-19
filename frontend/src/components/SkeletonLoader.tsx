import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
  animated?: boolean;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
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
    }
  }, [animated, animatedValue]);

  const backgroundColor = animated
    ? animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [
          theme.colors.skeleton || theme.colors.gray200,
          theme.colors.skeletonHighlight || theme.colors.gray300,
        ],
      })
    : theme.colors.skeleton || theme.colors.gray200;

  return (
    <Animated.View
      style={[
        styles.skeleton,
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

// Predefined skeleton components for common use cases
export const JournalCardSkeleton: React.FC = () => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.journalCardSkeleton}>
      <View style={styles.journalCardHeader}>
        <SkeletonLoader width="60%" height={18} />
        <SkeletonLoader width={80} height={14} />
      </View>
      <SkeletonLoader width="100%" height={16} style={{ marginTop: theme.spacing.sm }} />
      <SkeletonLoader width="85%" height={16} style={{ marginTop: theme.spacing.xs }} />
      <SkeletonLoader width="70%" height={16} style={{ marginTop: theme.spacing.xs }} />
      <View style={styles.journalCardFooter}>
        <SkeletonLoader width={60} height={12} />
        <SkeletonLoader width={40} height={12} />
      </View>
    </View>
  );
};

export const CalendarSkeleton: React.FC = () => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.calendarSkeleton}>
      {/* Calendar header */}
      <View style={styles.calendarHeader}>
        <SkeletonLoader width={30} height={30} borderRadius={15} />
        <SkeletonLoader width={120} height={20} />
        <SkeletonLoader width={30} height={30} borderRadius={15} />
      </View>
      
      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {Array.from({ length: 35 }, (_, index) => (
          <SkeletonLoader
            key={index}
            width={35}
            height={35}
            borderRadius={4}
            style={{ margin: 2 }}
          />
        ))}
      </View>
    </View>
  );
};

export const SettingsSkeleton: React.FC = () => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.settingsSkeleton}>
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={styles.settingsRow}>
          <View style={styles.settingsRowLeft}>
            <SkeletonLoader width={24} height={24} borderRadius={12} />
            <View style={styles.settingsRowText}>
              <SkeletonLoader width="70%" height={16} />
              <SkeletonLoader width="50%" height={12} style={{ marginTop: theme.spacing.xs }} />
            </View>
          </View>
          <SkeletonLoader width={50} height={20} borderRadius={10} />
        </View>
      ))}
    </View>
  );
};

const getStyles = (theme: AppTheme) => {
  const { width } = Dimensions.get('window');
  
  return StyleSheet.create({
    skeleton: {
      overflow: 'hidden',
    },
    journalCardSkeleton: {
      backgroundColor: theme.colors.card,
      padding: theme.spacing.md,
      marginHorizontal: theme.spacing.md,
      marginVertical: theme.spacing.sm,
      borderRadius: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    journalCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    journalCardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    calendarSkeleton: {
      backgroundColor: theme.colors.card,
      padding: theme.spacing.md,
      margin: theme.spacing.md,
      borderRadius: theme.spacing.sm,
    },
    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
    },
    settingsSkeleton: {
      padding: theme.spacing.md,
    },
    settingsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingsRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingsRowText: {
      marginLeft: theme.spacing.md,
      flex: 1,
    },
  });
};

export default SkeletonLoader; 