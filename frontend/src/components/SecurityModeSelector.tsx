/**
 * Security Mode Selector Component
 * 
 * Allows users to quickly switch between security modes and activate
 * border crossing mode for travel scenarios.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { SecurityMode, secretTagManagerHybrid } from '../services/secretTagManagerHybrid';
import logger from '../utils/logger';

interface SecurityModeSelectorProps {
  currentMode: SecurityMode;
  borderCrossingMode: boolean;
  onModeChange: (mode: SecurityMode) => Promise<void>;
  onBorderCrossingToggle: (enabled: boolean) => Promise<void>;
  disabled?: boolean;
}

interface SecurityModeInfo {
  mode: SecurityMode;
  title: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  useCases: string[];
}

const SecurityModeSelector: React.FC<SecurityModeSelectorProps> = ({
  currentMode,
  borderCrossingMode,
  onModeChange,
  onBorderCrossingToggle,
  disabled = false
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [isChanging, setIsChanging] = useState(false);

  const securityModes: SecurityModeInfo[] = [
    {
      mode: 'maximum',
      title: 'Maximum Security',
      description: 'Server-only, no caching',
      icon: 'shield',
      color: '#FF3B30',
      features: [
        'No local data storage',
        'Server-only verification',
        'Instant cache clearing',
        'Maximum privacy protection'
      ],
      useCases: [
        'Border crossings',
        'High-risk travel',
        'Shared devices',
        'Maximum privacy scenarios'
      ]
    },
    {
      mode: 'balanced',
      title: 'Balanced Security',
      description: 'Server-first with cache fallback',
      icon: 'shield-checkmark',
      color: '#007AFF',
      features: [
        'Server verification priority',
        'Cache fallback when offline',
        'Automatic sync',
        'Good privacy & usability balance'
      ],
      useCases: [
        'Daily use',
        'Home & office',
        'Reliable network areas',
        'Most users'
      ]
    },
    {
      mode: 'convenience',
      title: 'Convenience Mode',
      description: 'Cache-first with server sync',
      icon: 'checkmark-circle',
      color: '#34C759',
      features: [
        'Fast offline access',
        'Cache-first verification',
        'Background sync',
        'Maximum convenience'
      ],
      useCases: [
        'Frequent travel',
        'Poor connectivity areas',
        'Offline-first usage',
        'Performance priority'
      ]
    }
  ];

  /**
   * Handle security mode change
   */
  const handleModeChange = useCallback(async (mode: SecurityMode) => {
    if (mode === currentMode || disabled || isChanging) return;

    // Show confirmation for mode changes
    const modeInfo = securityModes.find(m => m.mode === mode);
    if (!modeInfo) return;

    Alert.alert(
      `Switch to ${modeInfo.title}?`,
      `${modeInfo.description}\n\n${modeInfo.features.join('\n• ')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setIsChanging(true);
            try {
              await onModeChange(mode);
              logger.info(`Security mode changed to: ${mode}`);
            } catch (error) {
              logger.error('Failed to change security mode:', error);
              Alert.alert('Error', 'Failed to change security mode');
            } finally {
              setIsChanging(false);
            }
          }
        }
      ]
    );
  }, [currentMode, disabled, isChanging, onModeChange, securityModes]);

  /**
   * Handle border crossing mode toggle
   */
  const handleBorderCrossingToggle = useCallback(async () => {
    if (disabled || isChanging) return;

    if (!borderCrossingMode) {
      // Activating border crossing mode
      Alert.alert(
        'Enable Border Crossing Mode?',
        'This will:\n\n• Switch to Maximum Security mode\n• Clear all cached data\n• Disable offline access\n\nYour device will appear completely normal if inspected.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            style: 'destructive',
            onPress: async () => {
              setIsChanging(true);
              try {
                await onBorderCrossingToggle(true);
                logger.info('Border crossing mode enabled');
                Alert.alert(
                  'Border Crossing Mode Active',
                  'Cache cleared and maximum security enabled. Your device now appears normal.',
                  [{ text: 'OK' }]
                );
              } catch (error) {
                logger.error('Failed to enable border crossing mode:', error);
                Alert.alert('Error', 'Failed to enable border crossing mode');
              } finally {
                setIsChanging(false);
              }
            }
          }
        ]
      );
    } else {
      // Disabling border crossing mode
      Alert.alert(
        'Disable Border Crossing Mode?',
        'This will restore balanced security settings and re-enable caching.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            onPress: async () => {
              setIsChanging(true);
              try {
                await onBorderCrossingToggle(false);
                logger.info('Border crossing mode disabled');
              } catch (error) {
                logger.error('Failed to disable border crossing mode:', error);
                Alert.alert('Error', 'Failed to disable border crossing mode');
              } finally {
                setIsChanging(false);
              }
            }
          }
        ]
      );
    }
  }, [borderCrossingMode, disabled, isChanging, onBorderCrossingToggle]);

  /**
   * Render security mode card
   */
  const renderModeCard = (modeInfo: SecurityModeInfo) => {
    const isActive = modeInfo.mode === currentMode;
    const isDisabled = disabled || isChanging;

    return (
      <TouchableOpacity
        key={modeInfo.mode}
        style={[
          styles.modeCard,
          isActive && styles.activeModeCard,
          isDisabled && styles.disabledModeCard
        ]}
        onPress={() => handleModeChange(modeInfo.mode)}
        disabled={isDisabled || isActive}
        accessibilityLabel={`${modeInfo.title} security mode`}
        accessibilityRole="button"
      >
        <View style={styles.modeHeader}>
          <View style={styles.modeIconContainer}>
            <Ionicons 
              name={modeInfo.icon as any} 
              size={24} 
              color={isActive ? theme.colors.background : modeInfo.color} 
            />
          </View>
          <View style={styles.modeTitleContainer}>
            <Text style={[
              styles.modeTitle,
              isActive && styles.activeModeTitle
            ]}>
              {modeInfo.title}
            </Text>
            <Text style={[
              styles.modeDescription,
              isActive && styles.activeModeDescription
            ]}>
              {modeInfo.description}
            </Text>
          </View>
          {isActive && (
            <Ionicons 
              name="checkmark-circle" 
              size={20} 
              color={theme.colors.background} 
            />
          )}
        </View>

        <View style={styles.modeFeatures}>
          {modeInfo.features.slice(0, 2).map((feature, index) => (
            <Text key={index} style={[
              styles.featureText,
              isActive && styles.activeFeatureText
            ]}>
              • {feature}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Security Mode</Text>
        <Text style={styles.subtitle}>
          Choose how tags are verified and stored
        </Text>
      </View>

      {/* Border Crossing Mode */}
      <TouchableOpacity
        style={[
          styles.borderCrossingCard,
          borderCrossingMode && styles.activeBorderCrossingCard,
          disabled && styles.disabledCard
        ]}
        onPress={handleBorderCrossingToggle}
        disabled={disabled || isChanging}
        accessibilityLabel="Border crossing mode toggle"
        accessibilityRole="button"
      >
        <View style={styles.borderCrossingContent}>
          <View style={styles.borderCrossingIcon}>
            {isChanging ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Ionicons 
                name={borderCrossingMode ? 'airplane' : 'airplane-outline'} 
                size={20} 
                color={borderCrossingMode ? theme.colors.background : theme.colors.error} 
              />
            )}
          </View>
          <View style={styles.borderCrossingText}>
            <Text style={[
              styles.borderCrossingTitle,
              borderCrossingMode && styles.activeBorderCrossingTitle
            ]}>
              Border Crossing Mode
            </Text>
            <Text style={[
              styles.borderCrossingSubtitle,
              borderCrossingMode && styles.activeBorderCrossingSubtitle
            ]}>
              {borderCrossingMode 
                ? 'Maximum security active • Cache cleared'
                : 'Tap to clear cache and maximize security'
              }
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Security Modes */}
      <View style={styles.modesContainer}>
        {securityModes.map(renderModeCard)}
      </View>

      {/* Current Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Current Status</Text>
        <Text style={styles.statusText}>
          {borderCrossingMode 
            ? 'Border crossing mode active with maximum security'
            : `${securityModes.find(m => m.mode === currentMode)?.title} mode active`
          }
        </Text>
      </View>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
  },
  
  // Header
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  
  // Border Crossing Mode
  borderCrossingCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  activeBorderCrossingCard: {
    backgroundColor: theme.colors.error,
    borderColor: theme.colors.error,
  },
  borderCrossingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  borderCrossingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  borderCrossingText: {
    flex: 1,
  },
  borderCrossingTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  activeBorderCrossingTitle: {
    color: theme.colors.background,
  },
  borderCrossingSubtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.xs,
  },
  activeBorderCrossingSubtitle: {
    color: theme.colors.background + 'CC',
  },
  
  // Security Modes
  modesContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  modeCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  activeModeCard: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  disabledModeCard: {
    opacity: 0.5,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  modeTitleContainer: {
    flex: 1,
  },
  modeTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  activeModeTitle: {
    color: theme.colors.background,
  },
  modeDescription: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.xs,
  },
  activeModeDescription: {
    color: theme.colors.background + 'CC',
  },
  modeFeatures: {
    gap: theme.spacing.xs,
  },
  featureText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  activeFeatureText: {
    color: theme.colors.background + 'DD',
  },
  
  // Status
  statusContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: theme.spacing.md,
  },
  statusTitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  
  // Disabled state
  disabledCard: {
    opacity: 0.5,
  },
});

export default SecurityModeSelector; 