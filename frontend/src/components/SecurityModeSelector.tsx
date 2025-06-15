/**
 * Security Mode Selector Component
 * 
 * Allows users to switch between online and offline modes for secret tags.
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
import { SecurityMode, tagManager } from '../services/tagManager';
import logger from '../utils/logger';

interface SecurityModeSelectorProps {
  currentMode: SecurityMode;
  onModeChange: (mode: SecurityMode) => Promise<void>;
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
  onModeChange,
  disabled = false
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [isChanging, setIsChanging] = useState(false);

  const securityModes: SecurityModeInfo[] = [
    {
      mode: 'online',
      title: 'Online Mode',
      description: 'Server-only, no secrets on device',
      icon: 'cloud',
      color: '#007AFF',
      features: [
        'No local secret storage',
        'Server-only verification',
        'Maximum privacy protection',
        'Device appears normal'
      ],
      useCases: [
        'Travel scenarios',
        'Shared devices',
        'High-security environments',
        'Border crossings'
      ]
    },
    {
      mode: 'offline',
      title: 'Offline Mode',
      description: 'Cached secrets for offline access',
      icon: 'shield-checkmark',
      color: '#34C759',
      features: [
        'Offline access available',
        'Cache-first verification',
        'Background sync',
        'Convenient daily use'
      ],
      useCases: [
        'Daily use',
        'Poor connectivity areas',
        'Frequent offline usage',
        'Most users'
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



      {/* Security Modes */}
      <View style={styles.modesContainer}>
        {securityModes.map(renderModeCard)}
      </View>

      {/* Current Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Current Status</Text>
        <Text style={styles.statusText}>
          {`${securityModes.find(m => m.mode === currentMode)?.title} active`}
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