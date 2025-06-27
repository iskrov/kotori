/**
 * OPAQUE Tag Indicator Component
 * 
 * Visual indicator for OPAQUE-based secret tags showing security level,
 * session status, and authentication method.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { OpaqueTagIndicatorProps } from '../types/opaqueTypes';

const OpaqueTagIndicator: React.FC<OpaqueTagIndicatorProps> = ({
  tag,
  showSession = true,
  showSecurityLevel = true,
  onSessionToggle,
  size = 'medium'
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme, size);

  // Get security level color and icon
  const getSecurityLevelInfo = () => {
    switch (tag.security_level) {
      case 'enhanced':
        return {
          color: '#00C851', // Green
          icon: 'shield-checkmark' as const,
          label: 'Enhanced'
        };
      case 'standard':
        return {
          color: '#007AFF', // Blue
          icon: 'shield' as const,
          label: 'Standard'
        };
      case 'legacy':
        return {
          color: '#FF9500', // Orange
          icon: 'shield-outline' as const,
          label: 'Legacy'
        };
      default:
        return {
          color: '#8E8E93', // Gray
          icon: 'shield-outline' as const,
          label: 'Unknown'
        };
    }
  };

  // Get authentication method info
  const getAuthMethodInfo = () => {
    switch (tag.auth_method) {
      case 'opaque':
        return {
          color: '#00C851', // Green
          icon: 'key' as const,
          label: 'OPAQUE'
        };
      case 'legacy':
        return {
          color: '#FF9500', // Orange
          icon: 'key-outline' as const,
          label: 'Legacy'
        };
      default:
        return {
          color: '#8E8E93', // Gray
          icon: 'key-outline' as const,
          label: 'Unknown'
        };
    }
  };

  const securityInfo = getSecurityLevelInfo();
  const authInfo = getAuthMethodInfo();

  return (
    <View style={styles.container}>
      {/* Security Level Indicator */}
      {showSecurityLevel && (
        <View style={styles.indicatorGroup}>
          <View style={[styles.indicator, { backgroundColor: securityInfo.color + '20' }]}>
            <Ionicons 
              name={securityInfo.icon} 
              size={size === 'small' ? 12 : size === 'large' ? 18 : 14}
              color={securityInfo.color}
            />
            {size !== 'small' && (
              <Text style={[styles.indicatorText, { color: securityInfo.color }]}>
                {securityInfo.label}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Authentication Method Indicator */}
      <View style={styles.indicatorGroup}>
        <View style={[styles.indicator, { backgroundColor: authInfo.color + '20' }]}>
          <Ionicons 
            name={authInfo.icon} 
            size={size === 'small' ? 12 : size === 'large' ? 18 : 14}
            color={authInfo.color}
          />
          {size !== 'small' && (
            <Text style={[styles.indicatorText, { color: authInfo.color }]}>
              {authInfo.label}
            </Text>
          )}
        </View>
      </View>

      {/* Session Status Indicator */}
      {showSession && onSessionToggle && (
        <TouchableOpacity 
          style={styles.sessionToggle}
          onPress={() => onSessionToggle(tag.id)}
          accessibilityLabel="Toggle session status"
          accessibilityRole="button"
        >
          <View style={[styles.indicator, { backgroundColor: theme.colors.primary + '20' }]}>
            <Ionicons 
              name="time" 
              size={size === 'small' ? 12 : size === 'large' ? 18 : 14}
              color={theme.colors.primary}
            />
            {size !== 'small' && (
              <Text style={[styles.indicatorText, { color: theme.colors.primary }]}>
                Session
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Device Binding Indicator */}
      {tag.device_fingerprint && (
        <View style={styles.indicatorGroup}>
          <View style={[styles.indicator, { backgroundColor: '#00C851' + '20' }]}>
            <Ionicons 
              name="phone-portrait" 
              size={size === 'small' ? 12 : size === 'large' ? 18 : 14}
              color="#00C851"
            />
            {size === 'large' && (
              <Text style={[styles.indicatorText, { color: '#00C851' }]}>
                Device Bound
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Migration Indicator */}
      {tag.migrated_from && (
        <View style={styles.indicatorGroup}>
          <View style={[styles.indicator, { backgroundColor: '#FF9500' + '20' }]}>
            <Ionicons 
              name="refresh" 
              size={size === 'small' ? 12 : size === 'large' ? 18 : 14}
              color="#FF9500"
            />
            {size === 'large' && (
              <Text style={[styles.indicatorText, { color: '#FF9500' }]}>
                Migrated
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme, size: 'small' | 'medium' | 'large') => {
  const padding = size === 'small' ? 4 : size === 'large' ? 8 : 6;
  const fontSize = size === 'small' ? 10 : size === 'large' ? 12 : 11;
  const spacing = size === 'small' ? 4 : size === 'large' ? 8 : 6;

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing,
    },
    indicatorGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    indicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: padding,
      paddingVertical: padding / 2,
      borderRadius: 12,
      gap: 4,
    },
    indicatorText: {
      fontSize,
      fontWeight: '500',
      fontFamily: theme.typography.fontFamilies.medium,
    },
    sessionToggle: {
      // Add touch feedback styles if needed
    },
  });
};

export default OpaqueTagIndicator; 