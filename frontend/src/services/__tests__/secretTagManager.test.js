/**
 * Tests for SecretTagManager service
 * 
 * Tests the complete secret tags functionality including:
 * - Tag creation and management
 * - Voice phrase detection
 * - Tag activation/deactivation
 * - Encryption integration
 * - Zero-knowledge compliance
 */

import { secretTagManager } from '../secretTagManager';
import { zeroKnowledgeEncryption } from '../zeroKnowledgeEncryption';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-secure-store');
jest.mock('../zeroKnowledgeEncryption');
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' }
}));

// Mock crypto for testing
global.crypto = {
  randomUUID: jest.fn(() => 'test-uuid-123'),
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
    importKey: jest.fn(() => Promise.resolve({})),
    deriveBits: jest.fn(() => Promise.resolve(new ArrayBuffer(32)))
  }
};

describe('SecretTagManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
    SecureStore.deleteItemAsync.mockClear();
    SecureStore.setItemAsync.mockClear();
    SecureStore.getItemAsync.mockClear();
  });

  describe('Tag Creation', () => {
    it('should create a new secret tag successfully', async () => {
      // Mock empty existing tags
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify([]));
      
      const tagId = await secretTagManager.createSecretTag(
        'Work Private',
        'work secret mode',
        '#FF5733'
      );

      expect(tagId).toBe('test-uuid-123');
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should reject empty tag name', async () => {
      await expect(
        secretTagManager.createSecretTag('', 'phrase', '#FF5733')
      ).rejects.toThrow('Tag name and phrase cannot be empty');
    });

    it('should reject empty phrase', async () => {
      await expect(
        secretTagManager.createSecretTag('Test Tag', '', '#FF5733')
      ).rejects.toThrow('Tag name and phrase cannot be empty');
    });

    it('should reject short phrases', async () => {
      await expect(
        secretTagManager.createSecretTag('Test Tag', 'hi', '#FF5733')
      ).rejects.toThrow('Activation phrase must be at least 3 characters');
    });

    it('should reject duplicate tag names', async () => {
      const existingTags = [{
        id: 'existing-tag',
        name: 'Work Private',
        phrase: 'existing phrase',
        phraseHash: 'hash',
        phraseSalt: 'salt',
        colorCode: '#007AFF',
        createdAt: Date.now(),
        isActive: false,
        serverTagHash: 'server_hash'
      }];
      
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(existingTags));
      
      await expect(
        secretTagManager.createSecretTag('Work Private', 'new phrase', '#FF5733')
      ).rejects.toThrow('A secret tag with this name already exists');
    });

    it('should use default color if not provided', async () => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify([]));
      
      await secretTagManager.createSecretTag('Test Tag', 'test phrase');
      
      const saveCall = SecureStore.setItemAsync.mock.calls.find(call => 
        call[0] === 'secret_tags_data'
      );
      const savedTags = JSON.parse(saveCall[1]);
      expect(savedTags[0].colorCode).toBe('#007AFF');
    });
  });

  describe('Phrase Detection', () => {
    const mockTags = [
      {
        id: 'tag-1',
        name: 'Work Private',
        phrase: 'work secret mode',
        phraseHash: 'work_hash',
        phraseSalt: 'work_salt',
        colorCode: '#FF5733',
        createdAt: Date.now(),
        isActive: false,
        serverTagHash: 'work_server_hash'
      },
      {
        id: 'tag-2',
        name: 'Personal',
        phrase: 'personal private',
        phraseHash: 'personal_hash',
        phraseSalt: 'personal_salt',
        colorCode: '#007AFF',
        createdAt: Date.now(),
        isActive: true,
        serverTagHash: 'personal_server_hash'
      }
    ];

    beforeEach(() => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockTags));
    });

    it('should detect activation phrase for inactive tag', async () => {
      // Mock phrase verification to return true
      secretTagManager.containsPhrase = jest.fn().mockResolvedValue(true);
      
      const result = await secretTagManager.checkForSecretTagPhrases('work secret mode');
      
      expect(result.found).toBe(true);
      expect(result.tagId).toBe('tag-1');
      expect(result.tagName).toBe('Work Private');
      expect(result.action).toBe('activate');
    });

    it('should detect deactivation phrase for active tag', async () => {
      // Mock phrase verification to return true for the second tag
      secretTagManager.containsPhrase = jest.fn()
        .mockResolvedValueOnce(false) // First tag
        .mockResolvedValueOnce(true); // Second tag
      
      const result = await secretTagManager.checkForSecretTagPhrases('personal private');
      
      expect(result.found).toBe(true);
      expect(result.tagId).toBe('tag-2');
      expect(result.tagName).toBe('Personal');
      expect(result.action).toBe('deactivate');
    });

    it('should detect panic phrase', async () => {
      const result = await secretTagManager.checkForSecretTagPhrases('emergency delete everything');
      
      expect(result.found).toBe(true);
      expect(result.action).toBe('panic');
      expect(result.tagId).toBeUndefined();
    });

    it('should return not found for unmatched phrases', async () => {
      secretTagManager.containsPhrase = jest.fn().mockResolvedValue(false);
      
      const result = await secretTagManager.checkForSecretTagPhrases('random text');
      
      expect(result.found).toBe(false);
    });

    it('should handle phrase detection errors gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));
      
      const result = await secretTagManager.checkForSecretTagPhrases('test phrase');
      
      expect(result.found).toBe(false);
    });
  });

  describe('Tag Activation/Deactivation', () => {
    const mockTags = [
      {
        id: 'tag-1',
        name: 'Test Tag',
        phrase: 'test phrase',
        phraseHash: 'hash',
        phraseSalt: 'salt',
        colorCode: '#FF5733',
        createdAt: Date.now(),
        isActive: false,
        serverTagHash: 'server_hash'
      }
    ];

    beforeEach(() => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockTags));
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify([])); // Empty active tags
    });

    it('should activate a secret tag successfully', async () => {
      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockReturnValue(true);
      
      await secretTagManager.activateSecretTag('tag-1');
      
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should deactivate a secret tag successfully', async () => {
      // Mock tag as active
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['tag-1']));
      
      await secretTagManager.deactivateSecretTag('tag-1');
      
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should reject activation of non-existent tag', async () => {
      await expect(
        secretTagManager.activateSecretTag('non-existent')
      ).rejects.toThrow('Secret tag not found');
    });

    it('should enforce maximum active tags limit', async () => {
      // Mock 3 active tags (assuming max is 3)
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['tag-2', 'tag-3', 'tag-4']));
      
      await expect(
        secretTagManager.activateSecretTag('tag-1')
      ).rejects.toThrow('Maximum');
    });

    it('should initialize encryption when activating tag', async () => {
      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockReturnValue(false);
      
      await secretTagManager.activateSecretTag('tag-1');
      
      // Should attempt to initialize encryption
      expect(zeroKnowledgeEncryption.isSecretTagKeyLoaded).toHaveBeenCalledWith('tag-1');
    });
  });

  describe('Tag Management', () => {
    const mockTags = [
      {
        id: 'tag-1',
        name: 'Test Tag',
        phrase: 'test phrase',
        phraseHash: 'hash',
        phraseSalt: 'salt',
        colorCode: '#FF5733',
        createdAt: Date.now(),
        isActive: false,
        serverTagHash: 'server_hash'
      }
    ];

    beforeEach(() => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockTags));
    });

    it('should get all secret tags', async () => {
      const tags = await secretTagManager.getAllSecretTags();
      
      expect(tags).toHaveLength(1);
      expect(tags[0].id).toBe('tag-1');
      expect(tags[0].name).toBe('Test Tag');
    });

    it('should get active secret tags only', async () => {
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['tag-1']));
      
      const activeTags = await secretTagManager.getActiveSecretTags();
      
      expect(activeTags).toHaveLength(1);
      expect(activeTags[0].id).toBe('tag-1');
    });

    it('should get active tag hashes', async () => {
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['tag-1']));
      
      const hashes = await secretTagManager.getActiveTagHashes();
      
      expect(hashes).toEqual(['server_hash']);
    });

    it('should update secret tag successfully', async () => {
      await secretTagManager.updateSecretTag('tag-1', {
        name: 'Updated Name',
        colorCode: '#00FF00'
      });
      
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should delete secret tag successfully', async () => {
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['tag-1'])); // Tag is active
      zeroKnowledgeEncryption.clearSecretTagEncryption = jest.fn();
      
      await secretTagManager.deleteSecretTag('tag-1');
      
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(zeroKnowledgeEncryption.clearSecretTagEncryption).toHaveBeenCalledWith('tag-1');
    });

    it('should reject update with duplicate name', async () => {
      const multipleTags = [
        ...mockTags,
        {
          id: 'tag-2',
          name: 'Another Tag',
          phrase: 'another phrase',
          phraseHash: 'hash2',
          phraseSalt: 'salt2',
          colorCode: '#007AFF',
          createdAt: Date.now(),
          isActive: false,
          serverTagHash: 'server_hash2'
        }
      ];
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(multipleTags));
      
      await expect(
        secretTagManager.updateSecretTag('tag-1', { name: 'Another Tag' })
      ).rejects.toThrow('A secret tag with this name already exists');
    });
  });

  describe('Entry Filtering', () => {
    const mockEntries = [
      { id: '1', content: 'Public entry', secret_tag_id: null },
      { id: '2', content: 'Work entry', secret_tag_id: 'work-tag' },
      { id: '3', content: 'Personal entry', secret_tag_id: 'personal-tag' },
      { id: '4', content: 'Another public', secret_tag_id: null }
    ];

    it('should filter entries by active tags', () => {
      // Mock active tags
      secretTagManager.activeTags = new Set(['work-tag']);
      
      const filtered = secretTagManager.filterEntriesByActiveTags(mockEntries);
      
      expect(filtered).toHaveLength(3); // 2 public + 1 work entry
      expect(filtered.map(e => e.id)).toEqual(['1', '2', '4']);
    });

    it('should return only public entries when no tags active', () => {
      secretTagManager.activeTags = new Set();
      
      const filtered = secretTagManager.filterEntriesByActiveTags(mockEntries);
      
      expect(filtered).toHaveLength(2); // Only public entries
      expect(filtered.map(e => e.id)).toEqual(['1', '4']);
    });

    it('should return all entries when multiple tags active', () => {
      secretTagManager.activeTags = new Set(['work-tag', 'personal-tag']);
      
      const filtered = secretTagManager.filterEntriesByActiveTags(mockEntries);
      
      expect(filtered).toHaveLength(4); // All entries
    });
  });

  describe('Panic Mode', () => {
    beforeEach(() => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify([
        { id: 'tag-1', name: 'Test' }
      ]));
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['tag-1']));
    });

    it('should execute panic mode when enabled', async () => {
      // Mock config with panic mode enabled
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'secret_tag_config') {
          return Promise.resolve(JSON.stringify({ panicModeEnabled: true }));
        }
        return Promise.resolve(JSON.stringify(['tag-1']));
      });

      zeroKnowledgeEncryption.clearAllSecretTagEncryption = jest.fn();
      
      await secretTagManager.activatePanicMode();
      
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
      expect(zeroKnowledgeEncryption.clearAllSecretTagEncryption).toHaveBeenCalled();
    });

    it('should reject panic mode when disabled', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'secret_tag_config') {
          return Promise.resolve(JSON.stringify({ panicModeEnabled: false }));
        }
        return Promise.resolve(JSON.stringify([]));
      });
      
      await expect(
        secretTagManager.activatePanicMode()
      ).rejects.toThrow('Panic mode is disabled');
    });
  });

  describe('Configuration Management', () => {
    it('should load default configuration', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      
      await secretTagManager.loadConfiguration();
      
      // Should use default config
      expect(secretTagManager.config.timeoutMinutes).toBe(5);
      expect(secretTagManager.config.panicModeEnabled).toBe(true);
    });

    it('should save configuration changes', async () => {
      const newConfig = {
        timeoutMinutes: 10,
        allowQuickLock: false,
        panicModeEnabled: false,
        maxActiveTags: 5
      };
      
      await secretTagManager.updateConfiguration(newConfig);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'secret_tag_config',
        JSON.stringify(newConfig)
      );
    });
  });

  describe('Zero-Knowledge Compliance', () => {
    it('should not store sensitive data in plain text', async () => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify([]));
      
      await secretTagManager.createSecretTag('Sensitive Tag', 'secret phrase', '#FF0000');
      
      const saveCall = SecureStore.setItemAsync.mock.calls.find(call => 
        call[0] === 'secret_tags_data'
      );
      const savedData = saveCall[1];
      
      // Should not contain plain text phrase
      expect(savedData).not.toContain('secret phrase');
      // Should contain hashed version
      expect(savedData).toContain('phraseHash');
      expect(savedData).toContain('phraseSalt');
    });

    it('should use secure storage for sensitive data', async () => {
      await secretTagManager.createSecretTag('Test', 'phrase', '#FF0000');
      
      // Should use SecureStore for tag data
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'secret_tags_data',
        expect.any(String),
        expect.objectContaining({
          requireAuthentication: true
        })
      );
    });

    it('should generate non-reversible server hashes', async () => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify([]));
      
      await secretTagManager.createSecretTag('Test Tag', 'test phrase', '#FF0000');
      
      const saveCall = SecureStore.setItemAsync.mock.calls.find(call => 
        call[0] === 'secret_tags_data'
      );
      const savedTags = JSON.parse(saveCall[1]);
      const tag = savedTags[0];
      
      // Should have server hash that doesn't reveal tag ID
      expect(tag.serverTagHash).toBeDefined();
      expect(tag.serverTagHash).not.toContain(tag.id);
      expect(tag.serverTagHash).not.toContain('Test Tag');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));
      
      const tags = await secretTagManager.getAllSecretTags();
      
      expect(tags).toEqual([]);
    });

    it('should handle encryption errors during activation', async () => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify([
        { id: 'tag-1', name: 'Test' }
      ]));
      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockImplementation(() => {
        throw new Error('Encryption error');
      });
      
      await expect(
        secretTagManager.activateSecretTag('tag-1')
      ).rejects.toThrow();
    });

    it('should handle malformed stored data', async () => {
      SecureStore.getItemAsync.mockResolvedValue('invalid json');
      
      const tags = await secretTagManager.getAllSecretTags();
      
      expect(tags).toEqual([]);
    });
  });
}); 