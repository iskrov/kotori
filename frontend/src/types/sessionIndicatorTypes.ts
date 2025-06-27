/**
 * TypeScript types for OPAQUE session indicator components
 * 
 * Defines interfaces for session status display, real-time updates,
 * interactive controls, and UI integration points.
 */

import { ViewStyle, TextStyle } from 'react-native';

// Session Status Types
export interface SessionStatus {
  sessionId: string;
  tagName: string;
  isActive: boolean;
  isLocked: boolean;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  deviceFingerprint: string;
  securityLevel: 'standard' | 'enhanced';
  remainingTimeMs: number;
  healthScore: number; // 0-100, higher is better
}

export interface SessionHealth {
  score: number; // 0-100
  status: 'excellent' | 'good' | 'warning' | 'critical';
  issues: SessionHealthIssue[];
  recommendations: string[];
}

export interface SessionHealthIssue {
  type: 'timeout_warning' | 'security_risk' | 'performance_issue' | 'device_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
}

// Session Indicator Component Props
export interface SessionStatusBadgeProps {
  session: SessionStatus;
  variant?: 'compact' | 'detailed' | 'minimal';
  showCountdown?: boolean;
  showHealthIndicator?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export interface SessionTimeoutIndicatorProps {
  session: SessionStatus;
  format?: 'short' | 'long' | 'precise';
  showIcon?: boolean;
  warningThresholdMs?: number;
  criticalThresholdMs?: number;
  onTimeout?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export interface SessionHealthIndicatorProps {
  health: SessionHealth;
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export interface SessionQuickActionsProps {
  session: SessionStatus;
  actions?: SessionQuickAction[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  onAction?: (action: SessionQuickActionType, sessionId: string) => void;
  style?: ViewStyle;
  testID?: string;
}

// Session Management Types
export interface SessionManagerModalProps {
  visible: boolean;
  sessions: SessionStatus[];
  onClose: () => void;
  onSessionAction?: (action: SessionActionType, sessionId: string) => void;
  onPanicMode?: () => void;
  testID?: string;
}

export interface ActiveSessionsListProps {
  sessions: SessionStatus[];
  onSessionSelect?: (sessionId: string) => void;
  onSessionAction?: (action: SessionActionType, sessionId: string) => void;
  showQuickActions?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export interface SessionDetailsCardProps {
  session: SessionStatus;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onAction?: (action: SessionActionType) => void;
  style?: ViewStyle;
  testID?: string;
}

// Action Types
export type SessionQuickActionType = 'extend' | 'lock' | 'unlock' | 'terminate';
export type SessionActionType = SessionQuickActionType | 'view_details' | 'panic_mode';

export interface SessionQuickAction {
  type: SessionQuickActionType;
  label: string;
  icon: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning';
  disabled?: boolean;
  requiresConfirmation?: boolean;
}

// Hook Types
export interface UseSessionIndicatorsOptions {
  updateInterval?: number; // ms, default 1000
  enableBackgroundUpdates?: boolean;
  warningThresholdMs?: number; // default 5 minutes
  criticalThresholdMs?: number; // default 1 minute
}

export interface UseSessionIndicatorsReturn {
  sessions: SessionStatus[];
  activeSessions: SessionStatus[];
  expiringSessions: SessionStatus[];
  sessionHealth: Record<string, SessionHealth>;
  isLoading: boolean;
  error: string | null;
  refreshSessions: () => Promise<void>;
  extendSession: (sessionId: string, durationMs?: number) => Promise<void>;
  terminateSession: (sessionId: string) => Promise<void>;
  lockSession: (sessionId: string) => Promise<void>;
  unlockSession: (sessionId: string) => Promise<void>;
  triggerPanicMode: () => Promise<void>;
}

// Notification Types
export interface SessionNotification {
  id: string;
  sessionId: string;
  type: 'timeout_warning' | 'session_expired' | 'security_alert' | 'health_warning';
  title: string;
  message: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: boolean;
  actions?: SessionNotificationAction[];
}

export interface SessionNotificationAction {
  type: 'extend' | 'dismiss' | 'view_details' | 'terminate';
  label: string;
  handler: () => void;
}

// Theme and Styling Types
export interface SessionIndicatorTheme {
  colors: {
    active: string;
    inactive: string;
    warning: string;
    critical: string;
    success: string;
    background: string;
    text: string;
    border: string;
  };
  sizes: {
    badge: {
      small: number;
      medium: number;
      large: number;
    };
    icon: {
      small: number;
      medium: number;
      large: number;
    };
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    small: number;
    medium: number;
    large: number;
  };
}

// Integration Types
export interface SessionAwareComponentProps {
  sessionId?: string;
  showSessionStatus?: boolean;
  onSessionRequired?: () => void;
  onSessionExpired?: () => void;
}

export interface HeaderSessionIndicatorProps {
  position?: 'left' | 'center' | 'right';
  variant?: 'badge' | 'icon' | 'text';
  showCount?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

// Analytics Types
export interface SessionIndicatorAnalytics {
  sessionViewCount: number;
  quickActionUsage: Record<SessionQuickActionType, number>;
  averageSessionDuration: number;
  timeoutWarningCount: number;
  manualExtensionCount: number;
  panicModeActivations: number;
  healthScoreHistory: Array<{
    timestamp: Date;
    averageScore: number;
  }>;
}

// Accessibility Types
export interface SessionIndicatorA11y {
  sessionStatusLabel: string;
  timeoutAnnouncementInterval?: number; // ms
  healthStatusDescription: string;
  actionButtonLabels: Record<SessionActionType, string>;
  screenReaderUpdates: boolean;
}

// Error Types
export interface SessionIndicatorError {
  code: 'SESSION_LOAD_FAILED' | 'ACTION_FAILED' | 'REAL_TIME_UPDATE_FAILED' | 'NOTIFICATION_FAILED';
  message: string;
  sessionId?: string;
  actionType?: SessionActionType;
  timestamp: Date;
  recoverable: boolean;
}

// Configuration Types
export interface SessionIndicatorConfig {
  theme: SessionIndicatorTheme;
  updateInterval: number;
  notifications: {
    enabled: boolean;
    warningThreshold: number;
    criticalThreshold: number;
  };
  accessibility: SessionIndicatorA11y;
  analytics: {
    enabled: boolean;
    trackingInterval: number;
  };
} 