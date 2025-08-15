/**
 * Session Status Badge Component
 * 
 * Displays compact session status information with real-time countdown
 * and health indicators for OPAQUE sessions.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SessionStatusBadgeProps } from '../../types/sessionIndicatorTypes';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const SessionStatusBadge: React.FC<SessionStatusBadgeProps> = ({
  session,
  variant = 'compact',
  showCountdown = true,
  showHealthIndicator = true,
  onPress,
  style,
  testID = 'session-status-badge'
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate remaining time
  const remainingMs = Math.max(0, session.expiresAt.getTime() - currentTime);
  const isExpiring = remainingMs <= 5 * MINUTE_MS; // Warning at 5 minutes
  const isCritical = remainingMs <= 1 * MINUTE_MS; // Critical at 1 minute

  // Format time display
  const formatTime = (ms: number): string => {
    if (ms === 0) return '0:00';
    
    const hours = Math.floor(ms / HOUR_MS);
    const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
    const seconds = Math.floor((ms % MINUTE_MS) / 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get status color
  const getStatusColor = () => {
    if (!session.isActive) return '#94A3B8'; // textMuted-like
    if (isCritical) return '#F87171'; // error
    if (isExpiring) return '#FBBF24'; // warning
    return '#34D399'; // success
  };

  // Get health indicator
  const getHealthIcon = () => {
    if (session.healthScore >= 90) return 'shield-checkmark';
    if (session.healthScore >= 70) return 'shield';
    if (session.healthScore >= 50) return 'warning';
    return 'alert-circle';
  };

  // Get health color
  const getHealthColor = () => {
    if (session.healthScore >= 90) return '#34D399';
    if (session.healthScore >= 70) return '#7CD4CF'; // teal light
    if (session.healthScore >= 50) return '#FBBF24';
    return '#F87171';
  };

  // Render compact variant
  const renderCompact = () => (
    <View style={[styles.compactContainer, { borderColor: getStatusColor() }]}>
      <View style={styles.compactHeader}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.tagName} numberOfLines={1}>
          {session.tagName}
        </Text>
        {showHealthIndicator && (
          <Ionicons 
            name={getHealthIcon() as any} 
            size={12} 
            color={getHealthColor()} 
          />
        )}
      </View>
      {showCountdown && session.isActive && (
        <Text style={[styles.countdown, { color: getStatusColor() }]}>
          {formatTime(remainingMs)}
        </Text>
      )}
    </View>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <View style={[styles.detailedContainer, { borderColor: getStatusColor() }]}>
      <View style={styles.detailedHeader}>
        <View style={styles.titleRow}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.tagNameDetailed}>{session.tagName}</Text>
          <Text style={styles.securityLevel}>
            {session.securityLevel.toUpperCase()}
          </Text>
        </View>
        {showHealthIndicator && (
          <View style={styles.healthIndicator}>
            <Ionicons 
              name={getHealthIcon() as any} 
              size={16} 
              color={getHealthColor()} 
            />
            <Text style={[styles.healthScore, { color: getHealthColor() }]}>
              {session.healthScore}
            </Text>
          </View>
        )}
      </View>
      
      {showCountdown && (
        <View style={styles.timeInfo}>
          <Text style={[styles.countdownDetailed, { color: getStatusColor() }]}>
            {session.isActive ? formatTime(remainingMs) : 'Expired'}
          </Text>
          <Text style={styles.timeLabel}>
            {session.isActive ? 'remaining' : ''}
          </Text>
        </View>
      )}
      
      <View style={styles.statusInfo}>
        <Text style={styles.statusText}>
          {session.isLocked ? 'Locked' : 'Active'}
        </Text>
        <Text style={styles.deviceInfo}>
          Device: {session.deviceFingerprint.slice(0, 8)}...
        </Text>
      </View>
    </View>
  );

  // Render minimal variant
  const renderMinimal = () => (
    <View style={styles.minimalContainer}>
      <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
      {showCountdown && session.isActive && (
        <Text style={[styles.minimalTime, { color: getStatusColor() }]}>
          {formatTime(remainingMs)}
        </Text>
      )}
    </View>
  );

  const renderContent = () => {
    switch (variant) {
      case 'detailed': return renderDetailed();
      case 'minimal': return renderMinimal();
      default: return renderCompact();
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={onPress}
        testID={testID}
        accessibilityLabel={`Session ${session.tagName}, ${formatTime(remainingMs)} remaining`}
        accessibilityRole="button"
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      accessibilityLabel={`Session ${session.tagName}, ${formatTime(remainingMs)} remaining`}
      accessibilityRole="text"
    >
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  
  // Compact variant styles
  compactContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 80,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0E1726',
    flex: 1,
  },
  countdown: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  
  // Detailed variant styles
  detailedContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minWidth: 200,
    shadowColor: 'rgba(14,23,38,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  tagNameDetailed: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0E1726',
    flex: 1,
  },
  securityLevel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E8E93',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  healthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  healthScore: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeInfo: {
    alignItems: 'center',
    marginVertical: 8,
  },
  countdownDetailed: {
    fontSize: 18,
    fontWeight: '700',
  },
  timeLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6ECF1',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0E1726',
  },
  deviceInfo: {
    fontSize: 10,
    color: '#94A3B8',
  },
  
  // Minimal variant styles
  minimalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minimalTime: {
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Common styles
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
}); 