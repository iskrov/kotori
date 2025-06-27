/**
 * EncryptedEntryManager Tests
 * 
 * Test suite for the OPAQUE-encrypted journal entry manager.
 */

import { EncryptedEntryManager } from '../EncryptedEntryManager';
import { VoicePhraseDetector } from '../VoicePhraseDetector';
import { JournalAPI } from '../api';
import {
  CreateEncryptedEntryRequest,
  ENCRYPTED_ENTRY_ERROR_CODES
} from '../../types/encryptedEntryTypes';
import { SessionData } from '../../types/sessionTypes';

// Mock dependencies
jest.mock('../VoicePhraseDetector');
jest.mock('../SessionManager');
jest.mock('../crypto/OpaqueClient');
jest.mock('../api');
jest.mock('../../utils/logger');

// Mock crypto.subtle for testing
const mockCrypto = {
  getRandomValues: jest.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    importKey: jest.fn().mockResolvedValue({ type: 'secret' }),
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32))
  }
};

// @ts-ignore
global.crypto = mockCrypto;

// Mock TextEncoder/TextDecoder
global.TextEncoder = class {
  encode(text: string): Uint8Array {
    return new Uint8Array(Buffer.from(text, 'utf8'));
  }
};

global.TextDecoder = class {
  decode(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('utf8');
  }
};

// Mock btoa/atob for base64 encoding
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

describe('EncryptedEntryManager', () => {
  let encryptedEntryManager: EncryptedEntryManager;
  let mockVoicePhraseDetector: jest.Mocked<VoicePhraseDetector>;

  const mockSessionData: SessionData = {
    tagId: 'test-tag-id',
    tagName: 'Test Tag',
    sessionKey: new Uint8Array([1, 2, 3, 4]),
    vaultKey: new Uint8Array([5, 6, 7, 8]),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    lastAccessed: new Date(),
    deviceFingerprint: 'test-device'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (EncryptedEntryManager as any).instance = undefined;
    encryptedEntryManager = EncryptedEntryManager.getInstance();

    // Setup mocks
    mockVoicePhraseDetector = VoicePhraseDetector.getInstance() as jest.Mocked<VoicePhraseDetector>;
    mockVoicePhraseDetector.getActiveSession.mockReturnValue(mockSessionData);
    
    (JournalAPI.createEncryptedEntry as jest.Mock).mockResolvedValue({
      data: {
        id: 123,
        title: 'Test Entry',
        created_at: '2025-01-20T12:00:00.000Z',
        updated_at: '2025-01-20T12:00:00.000Z'
      }
    });
  });

  describe('createEncryptedEntry', () => {
    const createRequest: CreateEncryptedEntryRequest = {
      title: 'Test Entry',
      content: 'This is a test entry content',
      tagId: 'test-tag-id'
    };

    it('should create an encrypted entry successfully', async () => {
      const result = await encryptedEntryManager.createEncryptedEntry(createRequest);

      expect(result).toBeDefined();
      expect(result.title).toBe(createRequest.title);
      expect(result.tagId).toBe(createRequest.tagId);
      expect(result.encryptedContent).toBeDefined();
      expect(JournalAPI.createEncryptedEntry).toHaveBeenCalled();
    });

    it('should throw error when no active session exists', async () => {
      mockVoicePhraseDetector.getActiveSession.mockReturnValue(null);

      await expect(encryptedEntryManager.createEncryptedEntry(createRequest))
        .rejects.toMatchObject({
          code: ENCRYPTED_ENTRY_ERROR_CODES.NO_ACTIVE_SESSION
        });
    });

    it('should validate content is required', async () => {
      const invalidRequest = {
        ...createRequest,
        content: ''
      };

      await expect(encryptedEntryManager.createEncryptedEntry(invalidRequest))
        .rejects.toMatchObject({
          code: ENCRYPTED_ENTRY_ERROR_CODES.UNKNOWN_ERROR,
          message: 'Content is required'
        });
    });
  });

  describe('checkVoiceActivation', () => {
    it('should detect voice activation successfully', async () => {
      const transcribedText = 'activate secret mode';
      mockVoicePhraseDetector.checkForSecretPhrase.mockResolvedValueOnce({
        found: true,
        tagId: 'test-tag-id',
        tagName: 'Test Tag',
        action: 'activate'
      });

      const result = await encryptedEntryManager.checkVoiceActivation(transcribedText);

      expect(result.shouldEncrypt).toBe(true);
      expect(result.tagId).toBe('test-tag-id');
      expect(result.tagName).toBe('Test Tag');
    });

    it('should handle no voice activation detected', async () => {
      const transcribedText = 'regular text';
      mockVoicePhraseDetector.checkForSecretPhrase.mockResolvedValueOnce({
        found: false
      });

      const result = await encryptedEntryManager.checkVoiceActivation(transcribedText);

      expect(result.shouldEncrypt).toBe(false);
    });
  });
}); 