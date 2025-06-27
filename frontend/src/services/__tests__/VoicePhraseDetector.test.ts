/**
 * Tests for VoicePhraseDetector Service
 */

import { VoicePhraseDetector, VoiceAuthenticationResult, PhraseDetectionResult } from '../VoicePhraseDetector';
import { OpaqueClient } from '../crypto/OpaqueClient';
import { AuthenticationError, NetworkError, OpaqueError } from '../crypto/errors';
import logger from '../../utils/logger';

// Mock the dependencies
jest.mock('../crypto/OpaqueClient');
jest.mock('../../utils/logger');

const MockedOpaqueClient = OpaqueClient as jest.MockedClass<typeof OpaqueClient>;

describe('VoicePhraseDetector', () => {
  let voicePhraseDetector: VoicePhraseDetector;
  let mockOpaqueClient: jest.Mocked<OpaqueClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock OPAQUE client instance
    mockOpaqueClient = {
      authenticate: jest.fn(),
      deriveVaultKey: jest.fn(),
      clearMemory: jest.fn(),
    } as any;

    // Mock the getInstance method
    MockedOpaqueClient.getInstance.mockReturnValue(mockOpaqueClient);
    
    // Get fresh instance
    voicePhraseDetector = VoicePhraseDetector.getInstance();
  });

  afterEach(async () => {
    // Clean up after each test
    await voicePhraseDetector.cleanup();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = VoicePhraseDetector.getInstance();
      const instance2 = VoicePhraseDetector.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('checkForSecretPhrase', () => {
    beforeEach(() => {
      // Mock getAvailableSecretTags to return test tags
      (voicePhraseDetector as any).getAvailableSecretTags = jest.fn().mockResolvedValue([
        { id: 'tag-1', name: 'Work Private' },
        { id: 'tag-2', name: 'Personal Secret' }
      ]);
    });

    it('should return not found for empty or whitespace input', async () => {
      const result1 = await voicePhraseDetector.checkForSecretPhrase('');
      const result2 = await voicePhraseDetector.checkForSecretPhrase('   ');
      const result3 = await voicePhraseDetector.checkForSecretPhrase('');

      expect(result1.found).toBe(false);
      expect(result2.found).toBe(false);
      expect(result3.found).toBe(false);
    });

    it('should detect panic phrase and trigger panic mode', async () => {
      const result = await voicePhraseDetector.checkForSecretPhrase('emergency delete everything');

      expect(result.found).toBe(true);
      expect(result.action).toBe('panic');
      expect(mockOpaqueClient.clearMemory).toHaveBeenCalled();
    });

    it('should successfully authenticate and activate session for new tag', async () => {
      const mockSessionKey = new Uint8Array([1, 2, 3, 4]);
      const mockVaultKey = new Uint8Array([5, 6, 7, 8]);

      mockOpaqueClient.authenticate.mockResolvedValue({
        success: true,
        sessionKey: mockSessionKey
      });
      mockOpaqueClient.deriveVaultKey.mockResolvedValue(mockVaultKey);

      const result = await voicePhraseDetector.checkForSecretPhrase('work secret phrase');

      expect(result.found).toBe(true);
      expect(result.tagId).toBe('tag-1');
      expect(result.tagName).toBe('Work Private');
      expect(result.action).toBe('activate');
      expect(voicePhraseDetector.isSessionActive('tag-1')).toBe(true);
    });

    it('should deactivate session for already active tag', async () => {
      // First, activate a session
      const mockSessionKey = new Uint8Array([1, 2, 3, 4]);
      const mockVaultKey = new Uint8Array([5, 6, 7, 8]);

      mockOpaqueClient.authenticate.mockResolvedValue({
        success: true,
        sessionKey: mockSessionKey
      });
      mockOpaqueClient.deriveVaultKey.mockResolvedValue(mockVaultKey);

      // Activate session
      await voicePhraseDetector.checkForSecretPhrase('work secret phrase');
      expect(voicePhraseDetector.isSessionActive('tag-1')).toBe(true);

      // Now authenticate again - should deactivate
      const result = await voicePhraseDetector.checkForSecretPhrase('work secret phrase');

      expect(result.found).toBe(true);
      expect(result.action).toBe('deactivate');
      expect(voicePhraseDetector.isSessionActive('tag-1')).toBe(false);
    });

    it('should return not found when authentication fails for all tags', async () => {
      mockOpaqueClient.authenticate.mockResolvedValue({
        success: false
      });

      const result = await voicePhraseDetector.checkForSecretPhrase('unknown phrase');

      expect(result.found).toBe(false);
      expect(mockOpaqueClient.authenticate).toHaveBeenCalledTimes(2); // Two tags
    });

    it('should handle authentication errors gracefully and continue with other tags', async () => {
      mockOpaqueClient.authenticate
        .mockRejectedValueOnce(new AuthenticationError('Auth failed for tag 1'))
        .mockResolvedValueOnce({
          success: true,
          sessionKey: new Uint8Array([1, 2, 3, 4])
        });
      
      mockOpaqueClient.deriveVaultKey.mockResolvedValue(new Uint8Array([5, 6, 7, 8]));

      const result = await voicePhraseDetector.checkForSecretPhrase('test phrase');

      expect(result.found).toBe(true);
      expect(result.tagId).toBe('tag-2');
      expect(mockOpaqueClient.authenticate).toHaveBeenCalledTimes(2);
    });

    it('should respect authentication timeout', async () => {
      // Mock slow authentication
      mockOpaqueClient.authenticate.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: false }), 3000))
      );

      const startTime = Date.now();
      const result = await voicePhraseDetector.checkForSecretPhrase('slow phrase');
      const endTime = Date.now();

      expect(result.found).toBe(false);
      expect(endTime - startTime).toBeLessThan(3000); // Should timeout before 3 seconds
    });

    it('should handle network errors properly', async () => {
      (voicePhraseDetector as any).getAvailableSecretTags = jest.fn()
        .mockRejectedValue(new NetworkError('Network failed'));

      const result = await voicePhraseDetector.checkForSecretPhrase('test phrase');

      expect(result.found).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[VoicePhraseDetector] Error during phrase detection'),
        expect.any(Error)
      );
    });

    it('should handle no available tags', async () => {
      (voicePhraseDetector as any).getAvailableSecretTags = jest.fn().mockResolvedValue([]);

      const result = await voicePhraseDetector.checkForSecretPhrase('test phrase');

      expect(result.found).toBe(false);
    });
  });

  describe('Session Management', () => {
    const mockSessionKey = new Uint8Array([1, 2, 3, 4]);
    const mockVaultKey = new Uint8Array([5, 6, 7, 8]);

    beforeEach(() => {
      (voicePhraseDetector as any).getAvailableSecretTags = jest.fn().mockResolvedValue([
        { id: 'tag-1', name: 'Test Tag' }
      ]);

      mockOpaqueClient.authenticate.mockResolvedValue({
        success: true,
        sessionKey: mockSessionKey
      });
      mockOpaqueClient.deriveVaultKey.mockResolvedValue(mockVaultKey);
    });

    it('should create active session after successful authentication', async () => {
      await voicePhraseDetector.checkForSecretPhrase('test phrase');

      expect(voicePhraseDetector.isSessionActive('tag-1')).toBe(true);
      
      const session = voicePhraseDetector.getActiveSession('tag-1');
      expect(session).not.toBeNull();
      expect(session!.tagId).toBe('tag-1');
      expect(session!.tagName).toBe('Test Tag');
    });

    it('should return all active sessions', async () => {
      await voicePhraseDetector.checkForSecretPhrase('test phrase');

      const activeSessions = voicePhraseDetector.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].tagId).toBe('tag-1');
    });

    it('should automatically expire sessions after timeout', (done) => {
      // Use a very short timeout for testing
      (voicePhraseDetector as any).SESSION_TIMEOUT_MS = 100;

      voicePhraseDetector.checkForSecretPhrase('test phrase').then(() => {
        expect(voicePhraseDetector.isSessionActive('tag-1')).toBe(true);

        // Wait for session to expire
        setTimeout(() => {
          expect(voicePhraseDetector.isSessionActive('tag-1')).toBe(false);
          done();
        }, 150);
      });
    });

    it('should clear sensitive data when deactivating session', async () => {
      await voicePhraseDetector.checkForSecretPhrase('test phrase');
      
      const session = voicePhraseDetector.getActiveSession('tag-1');
      const sessionKey = session!.sessionKey;
      const vaultKey = session!.vaultKey;

      // Deactivate session by authenticating again
      await voicePhraseDetector.checkForSecretPhrase('test phrase');

      // Check that memory was cleared (arrays should be zeroed)
      expect(Array.from(sessionKey)).toEqual([0, 0, 0, 0]);
      expect(Array.from(vaultKey)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('Phrase Normalization', () => {
    beforeEach(() => {
      (voicePhraseDetector as any).getAvailableSecretTags = jest.fn().mockResolvedValue([
        { id: 'tag-1', name: 'Test Tag' }
      ]);
    });

    it('should normalize phrases with punctuation and extra spaces', async () => {
      const normalizePhrase = (voicePhraseDetector as any).normalizePhrase.bind(voicePhraseDetector);

      expect(normalizePhrase('Hello,  World!')).toBe('hello world');
      expect(normalizePhrase('  Test   Phrase.  ')).toBe('test phrase');
      expect(normalizePhrase('Special@Characters#Here')).toBe('specialcharactershere');
    });

    it('should detect panic phrases with different formatting', async () => {
      const testPhrases = [
        'Emergency delete everything!',
        '  PANIC MODE NOW  ',
        'Destroy... all data?'
      ];

      for (const phrase of testPhrases) {
        const result = await voicePhraseDetector.checkForSecretPhrase(phrase);
        expect(result.found).toBe(true);
        expect(result.action).toBe('panic');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle OPAQUE client initialization errors', () => {
      MockedOpaqueClient.getInstance.mockImplementation(() => {
        throw new Error('OPAQUE client initialization failed');
      });

      expect(() => VoicePhraseDetector.getInstance()).toThrow();
    });

    it('should handle session creation errors', async () => {
      (voicePhraseDetector as any).getAvailableSecretTags = jest.fn().mockResolvedValue([
        { id: 'tag-1', name: 'Test Tag' }
      ]);

      mockOpaqueClient.authenticate.mockResolvedValue({
        success: true,
        sessionKey: new Uint8Array([1, 2, 3, 4])
      });
      mockOpaqueClient.deriveVaultKey.mockRejectedValue(new Error('Key derivation failed'));

      const result = await voicePhraseDetector.checkForSecretPhrase('test phrase');

      expect(result.found).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up all resources and sessions', async () => {
      // Create some active sessions
      (voicePhraseDetector as any).getAvailableSecretTags = jest.fn().mockResolvedValue([
        { id: 'tag-1', name: 'Tag 1' },
        { id: 'tag-2', name: 'Tag 2' }
      ]);

      mockOpaqueClient.authenticate.mockResolvedValue({
        success: true,
        sessionKey: new Uint8Array([1, 2, 3, 4])
      });
      mockOpaqueClient.deriveVaultKey.mockResolvedValue(new Uint8Array([5, 6, 7, 8]));

      await voicePhraseDetector.checkForSecretPhrase('test phrase 1');
      
      expect(voicePhraseDetector.getActiveSessions()).toHaveLength(1);

      // Cleanup
      await voicePhraseDetector.cleanup();

      expect(voicePhraseDetector.getActiveSessions()).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock a session with cleanup error
      const mockSession = {
        tagId: 'tag-1',
        tagName: 'Test Tag',
        sessionKey: new Uint8Array([1, 2, 3, 4]),
        vaultKey: new Uint8Array([5, 6, 7, 8]),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 900000)
      };

      (voicePhraseDetector as any).activeSessions.set('tag-1', mockSession);
      
      // Make sessionKey.fill throw an error
      mockSession.sessionKey.fill = jest.fn().mockImplementation(() => {
        throw new Error('Memory cleanup failed');
      });

      await voicePhraseDetector.cleanup();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[VoicePhraseDetector] Error during cleanup'),
        expect.any(Error)
      );
    });
  });

  describe('Performance', () => {
    it('should complete authentication within time limits', async () => {
      (voicePhraseDetector as any).getAvailableSecretTags = jest.fn().mockResolvedValue([
        { id: 'tag-1', name: 'Test Tag' }
      ]);

      mockOpaqueClient.authenticate.mockResolvedValue({
        success: true,
        sessionKey: new Uint8Array([1, 2, 3, 4])
      });
      mockOpaqueClient.deriveVaultKey.mockResolvedValue(new Uint8Array([5, 6, 7, 8]));

      const startTime = Date.now();
      await voicePhraseDetector.checkForSecretPhrase('test phrase');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });
}); 