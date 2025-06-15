/**
 * Secret Tag Indicator Component
 * 
 * Shows active secret tags status in the UI with visual indicators.
 * Displays in recording screen, journal screens, etc.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { SecretTagV2 } from '../services/secretTagOnlineManager';
import logger from '../utils/logger';

// Helper to determine if native driver should be used
const useNativeDriver = Platform.OS !== 'web';

interface SecretTagIndicatorProps {
  activeTags: SecretTagV2[];
  onPress?: () => void;
  compact?: boolean;
  showPulse?: boolean;
}

const SecretTagIndicator: React.FC<SecretTagIndicatorProps> = ({
  activeTags,
  onPress,
  compact = false,
  showPulse = true,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for active state
  useEffect(() => {
    if (showPulse && activeTags.length > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver,
          }),
        ])
      );
      pulse.start();
      
      return () => pulse.stop();
    }
  }, [activeTags.length, showPulse, pulseAnim]);

  // Don't render if no active tags
  if (activeTags.length === 0) {
    return null;
  }

  const primaryTag = activeTags[0];
  const hasMultipleTags = activeTags.length > 1;

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Animated.View style={[
          styles.compactIndicator,
          { backgroundColor: primaryTag.colorCode },
          showPulse && { transform: [{ scale: pulseAnim }] }
        ]}>
          <Ionicons name="shield-checkmark" size={12} color={theme.colors.background} />
        </Animated.View>
        {hasMultipleTags && (
          <View style={styles.multipleTagsBadge}>
            <Text style={styles.multipleTagsText}>+{activeTags.length - 1}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={[
        styles.indicator,
        { borderColor: primaryTag.colorCode },
        showPulse && { transform: [{ scale: pulseAnim }] }
      ]}>
        <View style={[styles.colorDot, { backgroundColor: primaryTag.colorCode }]} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={16} color={theme.colors.primary} />
            <Text style={styles.title}>Secret Tag Active</Text>
          </View>
          
          <Text style={styles.tagName} numberOfLines={1}>
            {primaryTag.name}
            {hasMultipleTags && ` +${activeTags.length - 1} more`}
          </Text>
          
          <Text style={styles.subtitle}>
            New entries will be encrypted
          </Text>
        </View>
        
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Mini version for floating display
 */
export const SecretTagFloatingIndicator: React.FC<{
  activeTags: SecretTagV2[];
  onPress?: () => void;
}> = ({ activeTags, onPress }) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (activeTags.length > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1500,
            useNativeDriver,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver,
          }),
        ])
      );
      pulse.start();
      
      return () => pulse.stop();
    }
  }, [activeTags.length, pulseAnim]);

  if (activeTags.length === 0) {
    return null;
  }

  const primaryTag = activeTags[0];

  return (
    <TouchableOpacity
      style={styles.floatingContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={[
        styles.floatingIndicator,
        { backgroundColor: primaryTag.colorCode },
        { transform: [{ scale: pulseAnim }] }
      ]}>
        <Ionicons name="shield-checkmark" size={16} color={theme.colors.background} />
        {activeTags.length > 1 && (
          <View style={styles.floatingBadge}>
            <Text style={styles.floatingBadgeText}>{activeTags.length}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginVertical: theme.spacing.xs,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: 4,
  },
  tagName: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.medium,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  compactContainer: {
    position: 'relative',
  },
  compactIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  multipleTagsBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  multipleTagsText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.background,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  floatingContainer: {
    position: 'absolute',
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 1000,
  },
  floatingIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lg,
    position: 'relative',
  },
  floatingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  floatingBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.bold,
  },
});

export default SecretTagIndicator; 