/**
 * Session Management Types
 * 
 * Comprehensive type definitions for OPAQUE session management,
 * including persistence, analytics, and advanced controls
 */

export interface SessionMetadata {
  tagId: string;
  tagName: string;
  createdAt: Date;
  expiresAt: Date;
  deviceFingerprint: string;
  isLocked: boolean;
  lastAccessed: Date;
  accessCount: number;
  origin: 'voice' | 'manual' | 'recovery';
}

export interface SessionData {
  tagId: string;
  tagName: string;
  sessionKey: Uint8Array;
  vaultKey: Uint8Array;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionPersistenceData {
  tagId: string;
  tagName: string;
  createdAt: string; // ISO string for JSON serialization
  expiresAt: string; // ISO string for JSON serialization
  deviceFingerprint: string;
  isLocked: boolean;
  lastAccessed: string; // ISO string for JSON serialization
  accessCount: number;
  origin: 'voice' | 'manual' | 'recovery';
}

export interface SessionControlOptions {
  extendBy?: number; // milliseconds to extend session
  force?: boolean; // force operation even if conflicts exist
  reason?: string; // reason for the operation (for audit trail)
}

export interface SessionConflict {
  tagId: string;
  currentSession: SessionMetadata;
  conflictingSession: SessionMetadata;
  conflictType: 'device' | 'time' | 'state';
  resolution: 'replace' | 'merge' | 'reject';
}

export interface SessionAnalyticsEvent {
  type: 'created' | 'extended' | 'locked' | 'unlocked' | 'expired' | 'invalidated' | 'accessed';
  tagId: string;
  timestamp: Date;
  deviceFingerprint: string;
  metadata?: Record<string, any>;
}

export interface SessionStatistics {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  mostUsedTags: Array<{ tagId: string; tagName: string; count: number }>;
  sessionsByOrigin: Record<'voice' | 'manual' | 'recovery', number>;
  dailySessionCount: number;
  weeklySessionCount: number;
}

export interface SessionSecurityMetrics {
  suspiciousActivityDetected: boolean;
  concurrentSessionCount: number;
  deviceFingerprints: string[];
  lastSecurityEvent: Date | null;
  securityScore: number; // 0-100, higher is better
}

export interface DeviceFingerprint {
  platform: string;
  version: string;
  model?: string;
  screenDimensions: string;
  timezone: string;
  language: string;
  userAgent?: string;
  hash: string;
}

export interface SessionManagerConfig {
  defaultTimeout: number; // milliseconds
  maxConcurrentSessions: number;
  persistenceTTL: number; // milliseconds - how long to keep persistence data
  analyticsRetentionDays: number;
  securityThresholds: {
    maxConcurrentDevices: number;
    suspiciousActivityThreshold: number;
    maxSessionExtensions: number;
  };
  enableCrossPlatformSync: boolean;
  enableSessionAnalytics: boolean;
  enableDeviceFingerprinting: boolean;
}

export interface SessionEvent {
  type: 'session-created' | 'session-extended' | 'session-locked' | 'session-unlocked' | 
        'session-expired' | 'session-invalidated' | 'conflict-detected' | 'security-alert';
  tagId: string;
  timestamp: Date;
  data?: any;
}

export type SessionEventCallback = (event: SessionEvent) => void;

export interface SessionStorageAdapter {
  store(key: string, data: SessionPersistenceData[]): Promise<void>;
  retrieve(key: string): Promise<SessionPersistenceData[] | null>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionSyncData {
  deviceId: string;
  sessions: SessionMetadata[];
  timestamp: Date;
  signature: string;
}

export interface CrossPlatformSessionInfo {
  tagId: string;
  deviceFingerprint: string;
  lastSeen: Date;
  isActive: boolean;
  priority: number;
}

export interface SessionRecoveryOptions {
  requireReauth: boolean;
  maxAge: number; // milliseconds
  allowPartialRecovery: boolean;
}

export interface SessionBatchOperation {
  type: 'extend' | 'lock' | 'unlock' | 'invalidate';
  tagIds: string[];
  options?: SessionControlOptions;
}

export interface SessionOperationResult {
  success: boolean;
  tagId: string;
  operation: string;
  error?: string;
  previousState?: Partial<SessionMetadata>;
  newState?: Partial<SessionMetadata>;
} 