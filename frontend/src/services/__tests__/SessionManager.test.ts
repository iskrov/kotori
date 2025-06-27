/**
 * SessionManager Tests
 * 
 * Comprehensive test suite for enhanced session management features
 */

import { SessionManager } from '../SessionManager';
import { voicePhraseDetector } from '../VoicePhraseDetector';
import { sessionStorageManager } from '../SessionStorageManager';
import { OpaqueClient } from '../crypto/OpaqueClient';
import {
  SessionEvent,
  SessionControlOptions,
  SessionManagerConfig
} from '../../types/sessionTypes';

// Mock dependencies
jest.mock('../VoicePhraseDetector');
jest.mock('../SessionStorageManager');
jest.mock('../crypto/OpaqueClient');
jest.mock('../../utils/logger');

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockSessionStorageManager: jest.Mocked<typeof sessionStorageManager>;
  let mockVoicePhraseDetector: jest.Mocked<typeof voicePhraseDetector>;
  let mockOpaqueClient: jest.Mocked<OpaqueClient>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get fresh instance
    sessionManager = SessionManager.getInstance();
    
    // Setup mocks
    mockSessionStorageManager = sessionStorageManager as jest.Mocked<typeof sessionStorageManager>;
    mockVoicePhraseDetector = voicePhraseDetector as jest.Mocked<typeof voicePhraseDetector>;
    mockOpaqueClient = OpaqueClient.getInstance() as jest.Mocked<OpaqueClient>;

    // Setup default mock implementations
    mockSessionStorageManager.initialize.mockResolvedValue();
    mockSessionStorageManager.retrieveSessionMetadata.mockResolvedValue([]);
    mockSessionStorageManager.storeSessionMetadata.mockResolvedValue();
    mockOpaqueClient.initialize.mockResolvedValue();
    mockVoicePhraseDetector.isSessionActive.mockReturnValue(false);
    mockVoicePhraseDetector.cleanup.mockResolvedValue();
  });

  afterEach(async () => {
    try {
      await sessionManager.cleanup();
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with default config', async () => {
      await expect(sessionManager.initialize()).resolves.not.toThrow();
      
      expect(mockSessionStorageManager.initialize).toHaveBeenCalled();
      expect(mockOpaqueClient.initialize).toHaveBeenCalled();
      expect(mockSessionStorageManager.retrieveSessionMetadata).toHaveBeenCalled();
    });

    it('should initialize with custom config', async () => {
      const customConfig: Partial<SessionManagerConfig> = {
        defaultTimeout: 30 * 60 * 1000, // 30 minutes
        maxConcurrentSessions: 10,
        enableSessionAnalytics: false
      };

      await expect(sessionManager.initialize(customConfig)).resolves.not.toThrow();
      
      const config = sessionManager.getConfig();
      expect(config.defaultTimeout).toBe(30 * 60 * 1000);
      expect(config.maxConcurrentSessions).toBe(10);
      expect(config.enableSessionAnalytics).toBe(false);
    });

    it('should handle initialization failure gracefully', async () => {
      mockSessionStorageManager.initialize.mockRejectedValue(new Error('Storage init failed'));

      await expect(sessionManager.initialize()).rejects.toThrow('Storage init failed');
    });

    it('should not re-initialize if already initialized', async () => {
      await sessionManager.initialize();
      
      // Clear mock call history
      jest.clearAllMocks();
      
      await sessionManager.initialize();
      
      expect(mockSessionStorageManager.initialize).not.toHaveBeenCalled();
    });

    it('should be a singleton', () => {
      const instance1 = SessionManager.getInstance();
      const instance2 = SessionManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should have default configuration', () => {
      const config = sessionManager.getConfig();
      expect(config.defaultTimeout).toBe(15 * 60 * 1000);
      expect(config.maxConcurrentSessions).toBe(5);
    });
  });

  describe('Session Extension', () => {
    const mockSessionMetadata = {
      tagId: 'test-tag-1',
      tagName: 'Test Tag',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      deviceFingerprint: 'test-fingerprint',
      isLocked: false,
      lastAccessed: new Date(),
      accessCount: 0,
      origin: 'voice' as const
    };

    beforeEach(async () => {
      await sessionManager.initialize();
      // Add mock session to internal state
      (sessionManager as any).sessionMetadata.set('test-tag-1', mockSessionMetadata);
    });

    it('should extend session successfully', async () => {
      const options: SessionControlOptions = {
        extendBy: 10 * 60 * 1000, // 10 minutes
        reason: 'user_request'
      };

      const result = await sessionManager.extendSession('test-tag-1', options);

      expect(result.success).toBe(true);
      expect(result.tagId).toBe('test-tag-1');
      expect(result.operation).toBe('extend');
      expect(result.newState?.accessCount).toBe(1);
      expect(mockSessionStorageManager.storeSessionMetadata).toHaveBeenCalled();
    });

    it('should fail to extend non-existent session', async () => {
      const result = await sessionManager.extendSession('non-existent-tag');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should fail to extend locked session without force', async () => {
      const lockedSession = { ...mockSessionMetadata, isLocked: true };
      (sessionManager as any).sessionMetadata.set('test-tag-1', lockedSession);

      const result = await sessionManager.extendSession('test-tag-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is locked');
    });

    it('should extend locked session with force option', async () => {
      const lockedSession = { ...mockSessionMetadata, isLocked: true };
      (sessionManager as any).sessionMetadata.set('test-tag-1', lockedSession);

      const result = await sessionManager.extendSession('test-tag-1', { force: true });

      expect(result.success).toBe(true);
    });
  });

  describe('Session Locking', () => {
    const mockSessionMetadata = {
      tagId: 'test-tag-1',
      tagName: 'Test Tag',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      deviceFingerprint: 'test-fingerprint',
      isLocked: false,
      lastAccessed: new Date(),
      accessCount: 0,
      origin: 'voice' as const
    };

    beforeEach(async () => {
      await sessionManager.initialize();
      (sessionManager as any).sessionMetadata.set('test-tag-1', mockSessionMetadata);
    });

    it('should lock session successfully', async () => {
      const result = await sessionManager.lockSession('test-tag-1', { reason: 'security_concern' });

      expect(result.success).toBe(true);
      expect(result.newState?.isLocked).toBe(true);
      expect(mockSessionStorageManager.storeSessionMetadata).toHaveBeenCalled();
    });

    it('should fail to lock non-existent session', async () => {
      const result = await sessionManager.lockSession('non-existent-tag');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should fail to lock already locked session', async () => {
      const lockedSession = { ...mockSessionMetadata, isLocked: true };
      (sessionManager as any).sessionMetadata.set('test-tag-1', lockedSession);

      const result = await sessionManager.lockSession('test-tag-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session already locked');
    });
  });

  describe('Session Unlocking', () => {
    const mockSessionMetadata = {
      tagId: 'test-tag-1',
      tagName: 'Test Tag',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      deviceFingerprint: 'test-fingerprint',
      isLocked: true,
      lastAccessed: new Date(),
      accessCount: 0,
      origin: 'voice' as const
    };

    beforeEach(async () => {
      await sessionManager.initialize();
      (sessionManager as any).sessionMetadata.set('test-tag-1', mockSessionMetadata);
    });

    it('should unlock session successfully', async () => {
      const result = await sessionManager.unlockSession('test-tag-1', { reason: 'user_request' });

      expect(result.success).toBe(true);
      expect(result.newState?.isLocked).toBe(false);
      expect(mockSessionStorageManager.storeSessionMetadata).toHaveBeenCalled();
    });

    it('should fail to unlock non-existent session', async () => {
      const result = await sessionManager.unlockSession('non-existent-tag');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should fail to unlock already unlocked session', async () => {
      const unlockedSession = { ...mockSessionMetadata, isLocked: false };
      (sessionManager as any).sessionMetadata.set('test-tag-1', unlockedSession);

      const result = await sessionManager.unlockSession('test-tag-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not locked');
    });
  });

  describe('Statistics and Analytics', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should return session statistics', () => {
      const stats = sessionManager.getSessionStatistics();

      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('averageSessionDuration');
      expect(stats).toHaveProperty('mostUsedTags');
      expect(stats).toHaveProperty('sessionsByOrigin');
      expect(stats).toHaveProperty('dailySessionCount');
      expect(stats).toHaveProperty('weeklySessionCount');
    });

    it('should return security metrics', () => {
      const metrics = sessionManager.getSecurityMetrics();

      expect(metrics).toHaveProperty('suspiciousActivityDetected');
      expect(metrics).toHaveProperty('concurrentSessionCount');
      expect(metrics).toHaveProperty('deviceFingerprints');
      expect(metrics).toHaveProperty('lastSecurityEvent');
      expect(metrics).toHaveProperty('securityScore');
      
      expect(metrics.securityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.securityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Event Management', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should add and remove event listeners', () => {
      const callback = jest.fn();

      sessionManager.addEventListener(callback);
      sessionManager.removeEventListener(callback);

      // No events should be received after removal
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call event listeners when events are emitted', () => {
      const callback = jest.fn();
      sessionManager.addEventListener(callback);

      const event: SessionEvent = {
        type: 'session-created',
        tagId: 'test-tag',
        timestamp: new Date()
      };

      (sessionManager as any).emitEvent(event);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should handle errors in event callbacks gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();

      sessionManager.addEventListener(errorCallback);
      sessionManager.addEventListener(normalCallback);

      const event: SessionEvent = {
        type: 'session-created',
        tagId: 'test-tag',
        timestamp: new Date()
      };

      expect(() => (sessionManager as any).emitEvent(event)).not.toThrow();
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should return current configuration', () => {
      const config = sessionManager.getConfig();

      expect(config).toMatchObject({
        defaultTimeout: expect.any(Number),
        maxConcurrentSessions: expect.any(Number),
        persistenceTTL: expect.any(Number),
        analyticsRetentionDays: expect.any(Number),
        securityThresholds: expect.any(Object),
        enableCrossPlatformSync: expect.any(Boolean),
        enableSessionAnalytics: expect.any(Boolean),
        enableDeviceFingerprinting: expect.any(Boolean)
      });
    });

    it('should update configuration', () => {
      const updates = {
        defaultTimeout: 30 * 60 * 1000,
        maxConcurrentSessions: 8
      };

      sessionManager.updateConfig(updates);

      const config = sessionManager.getConfig();
      expect(config.defaultTimeout).toBe(30 * 60 * 1000);
      expect(config.maxConcurrentSessions).toBe(8);
    });
  });

  describe('Session Recovery', () => {
    beforeEach(async () => {
      mockSessionStorageManager.retrieveSessionMetadata.mockResolvedValue([
        {
          tagId: 'recovered-tag-1',
          tagName: 'Recovered Tag 1',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          deviceFingerprint: 'test-fingerprint',
          isLocked: false,
          lastAccessed: new Date().toISOString(),
          accessCount: 1,
          origin: 'voice'
        }
      ]);
    });

    it('should recover sessions on initialization', async () => {
      await sessionManager.initialize();

      expect(mockSessionStorageManager.retrieveSessionMetadata).toHaveBeenCalled();
      
      const stats = sessionManager.getSessionStatistics();
      expect(stats.activeSessions).toBe(1);
    });

    it('should handle recovery errors gracefully', async () => {
      mockSessionStorageManager.retrieveSessionMetadata.mockRejectedValue(new Error('Recovery failed'));

      await expect(sessionManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should clean up all resources', async () => {
      await sessionManager.cleanup();

      expect(mockVoicePhraseDetector.cleanup).toHaveBeenCalled();
      
      const stats = sessionManager.getSessionStatistics();
      expect(stats.activeSessions).toBe(0);
    });

    it('should handle cleanup errors', async () => {
      mockVoicePhraseDetector.cleanup.mockRejectedValue(new Error('Cleanup failed'));

      await expect(sessionManager.cleanup()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should handle storage errors during session operations', async () => {
      mockSessionStorageManager.storeSessionMetadata.mockRejectedValue(new Error('Storage error'));
      
      const mockSessionMetadata = {
        tagId: 'test-tag-1',
        tagName: 'Test Tag',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        deviceFingerprint: 'test-fingerprint',
        isLocked: false,
        lastAccessed: new Date(),
        accessCount: 0,
        origin: 'voice' as const
      };

      (sessionManager as any).sessionMetadata.set('test-tag-1', mockSessionMetadata);

      const result = await sessionManager.extendSession('test-tag-1');
      
      // Should still succeed even if persistence fails
      expect(result.success).toBe(true);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should handle multiple concurrent operations', async () => {
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        const mockSession = {
          tagId: `test-tag-${i}`,
          tagName: `Test Tag ${i}`,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          deviceFingerprint: 'test-fingerprint',
          isLocked: false,
          lastAccessed: new Date(),
          accessCount: 0,
          origin: 'voice' as const
        };

        (sessionManager as any).sessionMetadata.set(`test-tag-${i}`, mockSession);
        operations.push(sessionManager.extendSession(`test-tag-${i}`));
      }

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should complete session operations within performance requirements', async () => {
      const mockSession = {
        tagId: 'test-tag-1',
        tagName: 'Test Tag',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        deviceFingerprint: 'test-fingerprint',
        isLocked: false,
        lastAccessed: new Date(),
        accessCount: 0,
        origin: 'voice' as const
      };

      (sessionManager as any).sessionMetadata.set('test-tag-1', mockSession);

      const startTime = performance.now();
      await sessionManager.extendSession('test-tag-1');
      const endTime = performance.now();

      // Should complete within 100ms (performance requirement from task description)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
}); 