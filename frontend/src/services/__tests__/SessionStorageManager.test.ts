/**
 * SessionStorageManager Tests
 */

import { SessionStorageManager } from '../SessionStorageManager';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    Version: '14.0',
  },
}));

describe('SessionStorageManager', () => {
  let storageManager: SessionStorageManager;

  beforeEach(() => {
    storageManager = SessionStorageManager.getInstance();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await storageManager.clearAll();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should be a singleton', () => {
      const instance1 = SessionStorageManager.getInstance();
      const instance2 = SessionStorageManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize successfully', async () => {
      await expect(storageManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Device Fingerprinting', () => {
    it('should generate device fingerprint', async () => {
      await storageManager.initialize();
      const fingerprint = storageManager.getDeviceFingerprint();
      
      expect(fingerprint).toBeTruthy();
      expect(fingerprint?.platform).toBe('ios');
      expect(fingerprint?.hash).toBeTruthy();
    });
  });

  describe('Session Metadata Persistence', () => {
    const mockSessionMetadata = [{
      tagId: 'test-tag-1',
      tagName: 'Test Tag',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      deviceFingerprint: 'test-fingerprint',
      isLocked: false,
      lastAccessed: new Date(),
      accessCount: 0,
      origin: 'voice' as const
    }];

    it('should store session metadata', async () => {
      await expect(storageManager.storeSessionMetadata(mockSessionMetadata)).resolves.not.toThrow();
    });

    it('should retrieve session metadata', async () => {
      const sessions = await storageManager.retrieveSessionMetadata();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should remove specific session metadata', async () => {
      await expect(storageManager.removeSessionMetadata('test-tag-1')).resolves.not.toThrow();
    });

    it('should clear all session metadata', async () => {
      await expect(storageManager.clearSessionMetadata()).resolves.not.toThrow();
    });
  });

  describe('Background Detection', () => {
    it('should track background info', () => {
      const backgroundInfo = storageManager.getBackgroundInfo();
      expect(backgroundInfo).toHaveProperty('wasBackgrounded');
      expect(backgroundInfo).toHaveProperty('duration');
    });
  });
}); 