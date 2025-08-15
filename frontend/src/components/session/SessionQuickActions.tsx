/**
 * Session Quick Actions Component
 * 
 * Provides quick action buttons for common session operations
 * like extend, lock, unlock, and terminate.
 */

import React from 'react';
import { View, TouchableOpacity, Text, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  SessionQuickActionsProps, 
  SessionQuickAction, 
  SessionQuickActionType 
} from '../../types/sessionIndicatorTypes';

const DEFAULT_ACTIONS: SessionQuickAction[] = [
  {
    type: 'extend',
    label: 'Extend',
    icon: 'time-outline',
    variant: 'primary'
  },
  {
    type: 'lock',
    label: 'Lock',
    icon: 'lock-closed-outline',
    variant: 'secondary'
  },
  {
    type: 'unlock',
    label: 'Unlock',
    icon: 'lock-open-outline',
    variant: 'secondary'
  },
  {
    type: 'terminate',
    label: 'End',
    icon: 'stop-circle-outline',
    variant: 'danger',
    requiresConfirmation: true
  }
];

export const SessionQuickActions: React.FC<SessionQuickActionsProps> = ({
  session,
  actions = DEFAULT_ACTIONS,
  layout = 'horizontal',
  onAction,
  style,
  testID = 'session-quick-actions'
}) => {
  const handleAction = (action: SessionQuickActionType) => {
    const actionConfig = actions.find(a => a.type === action);
    
    if (actionConfig?.requiresConfirmation) {
      Alert.alert(
        `${actionConfig.label} Session`,
        `Are you sure you want to ${action} this session?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: actionConfig.label,
            style: actionConfig.variant === 'danger' ? 'destructive' : 'default',
            onPress: () => onAction?.(action, session.sessionId)
          }
        ]
      );
    } else {
      onAction?.(action, session.sessionId);
    }
  };

  const getButtonStyle = (action: SessionQuickAction) => {
    const baseStyle = [styles.actionButton];
    
    switch (action.variant) {
      case 'primary':
        return [...baseStyle, styles.primaryButton];
      case 'danger':
        return [...baseStyle, styles.dangerButton];
      case 'warning':
        return [...baseStyle, styles.warningButton];
      default:
        return [...baseStyle, styles.secondaryButton];
    }
  };

  const getTextStyle = (action: SessionQuickAction) => {
    const baseStyle = [styles.actionText];
    
    switch (action.variant) {
      case 'primary':
        return [...baseStyle, styles.primaryText];
      case 'danger':
        return [...baseStyle, styles.dangerText];
      case 'warning':
        return [...baseStyle, styles.warningText];
      default:
        return [...baseStyle, styles.secondaryText];
    }
  };

  const getIconColor = (action: SessionQuickAction) => {
    switch (action.variant) {
      case 'primary':
        return theme.colors.onPrimary;
      case 'danger':
        return theme.colors.onPrimary;
      case 'warning':
        return theme.colors.onPrimary;
      default:
        return '#007AFF';
    }
  };

  const getAvailableActions = () => {
    return actions.filter(action => {
      switch (action.type) {
        case 'lock':
          return session.isActive && !session.isLocked;
        case 'unlock':
          return session.isActive && session.isLocked;
        case 'extend':
          return session.isActive;
        case 'terminate':
          return session.isActive;
        default:
          return true;
      }
    });
  };

  const availableActions = getAvailableActions();

  if (availableActions.length === 0) {
    return null;
  }

  const containerStyle = [
    styles.container,
    layout === 'vertical' && styles.verticalContainer,
    layout === 'grid' && styles.gridContainer,
    style
  ];

  return (
    <View style={containerStyle} testID={testID}>
      {availableActions.map((action) => (
        <TouchableOpacity
          key={action.type}
          style={getButtonStyle(action)}
          onPress={() => handleAction(action.type)}
          disabled={action.disabled}
          testID={`action-${action.type}`}
        >
          <Ionicons
            name={action.icon as any}
            size={16}
            color={getIconColor(action)}
          />
          <Text style={getTextStyle(action)}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  
  verticalContainer: {
    flexDirection: 'column',
  },
  
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
  },
  
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  
  secondaryButton: {
    backgroundColor: theme.colors.borderLight,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  
  warningButton: {
    backgroundColor: theme.colors.warning,
  },
  
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  primaryText: {
    color: theme.colors.onPrimary,
  },
  
  secondaryText: {
    color: '#007AFF',
  },
  
  dangerText: {
    color: theme.colors.onPrimary,
  },
  
  warningText: {
    color: theme.colors.onPrimary,
  },
}); 