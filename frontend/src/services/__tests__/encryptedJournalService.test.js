/**
 * Tests for EncryptedJournalService with Secret Tag integration
 * 
 * Tests the enhanced journal service functionality including:
 * - Secret tag entry creation and retrieval
 * - Public entry handling
 * - Entry filtering by active tags
 * - Encryption integration
 */

import { encryptedJournalService } from '../encryptedJournalService';
import { JournalAPI } from '../api';
import { zeroKnowledgeEncryption } from '../zeroKnowledgeEncryption';
import { secretTagManager } from '../secretTagManager';

// Mock dependencies
jest.mock('../api');
jest.mock('../zeroKnowledgeEncryption');
jest.mock('../secretTagManager');

describe('EncryptedJournalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Entry Creation', () => {
    const mockEntryData = {
      title: 'Test Entry',
      content: 'This is test content',
      entry_date: '2024-01-01T10:00:00Z',
      tags: ['test', 'journal']
    };

    it('should create public entry when no secret tag is active', async () => {
      secretTagManager.getActiveSecretTagForNewEntry.mockResolvedValue(null);
      JournalAPI.createEntry.mockResolvedValue({
        data: { id: '123', ...mockEntryData }
      });

      const result = await encryptedJournalService.createEntry(mockEntryData);

      expect(JournalAPI.createEntry).toHaveBeenCalledWith({
        title: 'Test Entry',
        content: 'This is test content',
        entry_date: '2024-01-01T10:00:00Z',
        audio_url: undefined,
        tags: ['test', 'journal'],
        secret_tag_id: null,
        secret_tag_hash: null
      });
      expect(result.id).toBe('123');
    });

    it('should create secret tag entry when tag is active', async () => {
      const mockSecretTag = {
        id: 'secret-tag-123',
        serverTagHash: 'server_hash_123'
      };

      secretTagManager.getActiveSecretTagForNewEntry.mockResolvedValue(mockSecretTag);
      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockReturnValue(true);
      zeroKnowledgeEncryption.encryptEntryWithSecretTag.mockResolvedValue({
        encryptedContent: 'encrypted_content',
        encryptedKey: 'encrypted_key',
        iv: 'iv_value',
        salt: 'salt_value',
        algorithm: 'AES-GCM',
        wrapIv: 'wrap_iv'
      });
      secretTagManager.getAllSecretTags.mockResolvedValue([mockSecretTag]);
      JournalAPI.createEncryptedEntry.mockResolvedValue({
        data: { id: '456', secret_tag_id: 'secret-tag-123' }
      });

      const result = await encryptedJournalService.createEntry(mockEntryData);

      expect(zeroKnowledgeEncryption.encryptEntryWithSecretTag).toHaveBeenCalledWith(
        'This is test content',
        'secret-tag-123'
      );
      expect(JournalAPI.createEncryptedEntry).toHaveBeenCalledWith({
        title: 'Test Entry',
        encrypted_content: 'encrypted_content',
        encrypted_key: 'encrypted_key',
        iv: 'iv_value',
        salt: 'salt_value',
        algorithm: 'AES-GCM',
        wrapIv: 'wrap_iv',
        entry_date: '2024-01-01T10:00:00Z',
        audio_url: undefined,
        tags: ['test', 'journal'],
        secret_tag_id: 'secret-tag-123',
        secret_tag_hash: 'server_hash_123'
      });
      expect(result.content).toBe('This is test content'); // Original content for UI
    });

    it('should force public entry creation when specified', async () => {
      secretTagManager.getActiveSecretTagForNewEntry.mockResolvedValue({
        id: 'active-tag'
      });
      JournalAPI.createEntry.mockResolvedValue({
        data: { id: '789', ...mockEntryData }
      });

      const result = await encryptedJournalService.createEntry(mockEntryData, {
        forcePublic: true
      });

      expect(JournalAPI.createEntry).toHaveBeenCalled();
      expect(JournalAPI.createEncryptedEntry).not.toHaveBeenCalled();
      expect(result.id).toBe('789');
    });

    it('should create entry with specific secret tag', async () => {
      const mockSecretTag = {
        id: 'specific-tag-123',
        serverTagHash: 'specific_hash'
      };

      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockReturnValue(true);
      zeroKnowledgeEncryption.encryptEntryWithSecretTag.mockResolvedValue({
        encryptedContent: 'encrypted_content',
        encryptedKey: 'encrypted_key',
        iv: 'iv_value',
        salt: 'salt_value',
        algorithm: 'AES-GCM',
        wrapIv: 'wrap_iv'
      });
      secretTagManager.getAllSecretTags.mockResolvedValue([mockSecretTag]);
      JournalAPI.createEncryptedEntry.mockResolvedValue({
        data: { id: '101', secret_tag_id: 'specific-tag-123' }
      });

      const result = await encryptedJournalService.createEntry(mockEntryData, {
        secretTagId: 'specific-tag-123'
      });

      expect(zeroKnowledgeEncryption.encryptEntryWithSecretTag).toHaveBeenCalledWith(
        'This is test content',
        'specific-tag-123'
      );
    });

    it('should handle encryption key not loaded error', async () => {
      secretTagManager.getActiveSecretTagForNewEntry.mockResolvedValue({
        id: 'unloaded-tag'
      });
      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockReturnValue(false);

      await expect(
        encryptedJournalService.createEntry(mockEntryData)
      ).rejects.toThrow('Secret tag encryption not loaded');
    });

    it('should handle secret tag not found error', async () => {
      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockReturnValue(true);
      secretTagManager.getAllSecretTags.mockResolvedValue([]);

      await expect(
        encryptedJournalService.createEntry(mockEntryData, {
          secretTagId: 'non-existent-tag'
        })
      ).rejects.toThrow('Secret tag not found');
    });
  });

  describe('Entry Retrieval', () => {
    const mockEntries = [
      {
        id: '1',
        title: 'Public Entry',
        content: 'Public content',
        secret_tag_id: null
      },
      {
        id: '2',
        title: 'Secret Entry',
        content: '',
        encrypted_content: 'encrypted_data',
        secret_tag_id: 'secret-tag-123'
      },
      {
        id: '3',
        title: 'Another Public',
        content: 'More public content',
        secret_tag_id: null
      }
    ];

    it('should retrieve and filter entries by active tags', async () => {
      secretTagManager.getActiveTagHashes.mockResolvedValue(['hash_123']);
      JournalAPI.getEntries.mockResolvedValue({ data: mockEntries });
      secretTagManager.filterEntriesByActiveTags.mockReturnValue([
        mockEntries[0], // Public entry
        mockEntries[1]  // Secret entry with active tag
      ]);
      zeroKnowledgeEncryption.decryptEntryWithSecretTag.mockResolvedValue('Decrypted content');

      const result = await encryptedJournalService.getEntries();

      expect(JournalAPI.getEntries).toHaveBeenCalledWith({
        secret_tag_hashes: ['hash_123'],
        include_public: true
      });
      expect(secretTagManager.filterEntriesByActiveTags).toHaveBeenCalledWith(mockEntries);
      expect(result).toHaveLength(2);
    });

    it('should decrypt secret tag entries', async () => {
      const secretEntry = {
        id: '2',
        title: 'Secret Entry',
        content: '',
        encrypted_content: 'encrypted_data',
        secret_tag_id: 'secret-tag-123'
      };

      secretTagManager.getActiveTagHashes.mockResolvedValue(['hash_123']);
      JournalAPI.getEntries.mockResolvedValue({ data: [secretEntry] });
      secretTagManager.filterEntriesByActiveTags.mockReturnValue([secretEntry]);
      zeroKnowledgeEncryption.decryptEntryWithSecretTag.mockResolvedValue('Decrypted secret content');

      const result = await encryptedJournalService.getEntries();

      expect(zeroKnowledgeEncryption.decryptEntryWithSecretTag).toHaveBeenCalledWith(
        secretEntry,
        'secret-tag-123'
      );
      expect(result[0].content).toBe('Decrypted secret content');
    });

    it('should handle decryption errors gracefully', async () => {
      const secretEntry = {
        id: '2',
        title: 'Secret Entry',
        content: '',
        encrypted_content: 'encrypted_data',
        secret_tag_id: 'secret-tag-123'
      };

      secretTagManager.getActiveTagHashes.mockResolvedValue(['hash_123']);
      JournalAPI.getEntries.mockResolvedValue({ data: [secretEntry] });
      secretTagManager.filterEntriesByActiveTags.mockReturnValue([secretEntry]);
      zeroKnowledgeEncryption.decryptEntryWithSecretTag.mockRejectedValue(new Error('Decryption failed'));

      const result = await encryptedJournalService.getEntries();

      expect(result[0].content).toBe('[Decryption Error]');
    });

    it('should return only public entries when no tags active', async () => {
      secretTagManager.getActiveTagHashes.mockResolvedValue([]);
      JournalAPI.getEntries.mockResolvedValue({ data: mockEntries });
      secretTagManager.filterEntriesByActiveTags.mockReturnValue([
        mockEntries[0], // Only public entries
        mockEntries[2]
      ]);

      const result = await encryptedJournalService.getEntries();

      expect(JournalAPI.getEntries).toHaveBeenCalledWith({
        secret_tag_hashes: [],
        include_public: true
      });
      expect(result).toHaveLength(2);
      expect(result.every(entry => entry.secret_tag_id === null)).toBe(true);
    });
  });

  describe('Entry Search', () => {
    it('should search entries with active tag filtering', async () => {
      secretTagManager.getActiveTagHashes.mockResolvedValue(['hash_123']);
      JournalAPI.searchEntries.mockResolvedValue({
        data: [{ id: '1', title: 'Found Entry', content: 'Search result' }]
      });
      secretTagManager.filterEntriesByActiveTags.mockReturnValue([
        { id: '1', title: 'Found Entry', content: 'Search result' }
      ]);

      const result = await encryptedJournalService.searchEntries('test query');

      expect(JournalAPI.searchEntries).toHaveBeenCalledWith('test query', {
        secret_tag_hashes: ['hash_123'],
        include_public: true
      });
      expect(result).toHaveLength(1);
    });

    it('should handle empty search results', async () => {
      secretTagManager.getActiveTagHashes.mockResolvedValue([]);
      JournalAPI.searchEntries.mockResolvedValue({ data: [] });
      secretTagManager.filterEntriesByActiveTags.mockReturnValue([]);

      const result = await encryptedJournalService.searchEntries('no results');

      expect(result).toHaveLength(0);
    });
  });

  describe('Entry Updates', () => {
    it('should update entry using regular API', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      JournalAPI.updateEntry.mockResolvedValue({
        data: { id: '123', ...updates }
      });

      const result = await encryptedJournalService.updateEntry('123', updates);

      expect(JournalAPI.updateEntry).toHaveBeenCalledWith('123', updates);
      expect(result.title).toBe('Updated Title');
    });

    it('should handle update errors', async () => {
      JournalAPI.updateEntry.mockRejectedValue(new Error('Update failed'));

      await expect(
        encryptedJournalService.updateEntry('123', { title: 'New Title' })
      ).rejects.toThrow('Failed to update journal entry');
    });
  });

  describe('Entry Deletion', () => {
    it('should delete entry using API', async () => {
      JournalAPI.deleteEntry.mockResolvedValue({ success: true });

      const result = await encryptedJournalService.deleteEntry('123');

      expect(JournalAPI.deleteEntry).toHaveBeenCalledWith('123');
      expect(result.success).toBe(true);
    });

    it('should handle deletion errors', async () => {
      JournalAPI.deleteEntry.mockRejectedValue(new Error('Delete failed'));

      await expect(
        encryptedJournalService.deleteEntry('123')
      ).rejects.toThrow('Failed to delete journal entry');
    });
  });

  describe('Secret Tag Encryption Management', () => {
    it('should initialize secret tag encryption', async () => {
      zeroKnowledgeEncryption.initializeSecretTagKey.mockResolvedValue(true);

      const result = await encryptedJournalService.initializeSecretTagEncryption(
        'tag-123',
        'user-secret'
      );

      expect(zeroKnowledgeEncryption.initializeSecretTagKey).toHaveBeenCalledWith(
        'tag-123',
        'user-secret'
      );
      expect(result).toBe(true);
    });

    it('should load secret tag encryption', async () => {
      zeroKnowledgeEncryption.loadSecretTagKey.mockResolvedValue(true);

      const result = await encryptedJournalService.loadSecretTagEncryption(
        'tag-123',
        'user-secret'
      );

      expect(zeroKnowledgeEncryption.loadSecretTagKey).toHaveBeenCalledWith(
        'tag-123',
        'user-secret'
      );
      expect(result).toBe(true);
    });

    it('should handle encryption initialization errors', async () => {
      zeroKnowledgeEncryption.initializeSecretTagKey.mockRejectedValue(new Error('Init failed'));

      const result = await encryptedJournalService.initializeSecretTagEncryption(
        'tag-123',
        'user-secret'
      );

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      JournalAPI.getEntries.mockRejectedValue(new Error('API Error'));

      await expect(
        encryptedJournalService.getEntries()
      ).rejects.toThrow('Failed to retrieve journal entries');
    });

    it('should handle secret tag manager errors', async () => {
      secretTagManager.getActiveTagHashes.mockRejectedValue(new Error('Tag manager error'));

      await expect(
        encryptedJournalService.getEntries()
      ).rejects.toThrow('Failed to retrieve journal entries');
    });

    it('should handle encryption service errors', async () => {
      const mockEntryData = {
        title: 'Test',
        content: 'Content'
      };

      secretTagManager.getActiveSecretTagForNewEntry.mockResolvedValue({
        id: 'tag-123'
      });
      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockReturnValue(true);
      zeroKnowledgeEncryption.encryptEntryWithSecretTag.mockRejectedValue(new Error('Encryption failed'));

      await expect(
        encryptedJournalService.createEntry(mockEntryData)
      ).rejects.toThrow('Failed to create encrypted journal entry');
    });
  });

  describe('Integration with Voice Detection', () => {
    it('should handle detected tag from voice input', async () => {
      const mockEntryData = {
        title: 'Voice Entry',
        content: 'This was spoken'
      };

      const mockDetectedTag = {
        id: 'voice-detected-tag',
        serverTagHash: 'voice_hash'
      };

      zeroKnowledgeEncryption.isSecretTagKeyLoaded.mockReturnValue(true);
      zeroKnowledgeEncryption.encryptEntryWithSecretTag.mockResolvedValue({
        encryptedContent: 'encrypted_voice_content',
        encryptedKey: 'encrypted_key',
        iv: 'iv_value',
        salt: 'salt_value',
        algorithm: 'AES-GCM',
        wrapIv: 'wrap_iv'
      });
      secretTagManager.getAllSecretTags.mockResolvedValue([mockDetectedTag]);
      JournalAPI.createEncryptedEntry.mockResolvedValue({
        data: { id: '999', secret_tag_id: 'voice-detected-tag' }
      });

      const result = await encryptedJournalService.createEntry(mockEntryData, {
        detectedTagId: 'voice-detected-tag'
      });

      expect(zeroKnowledgeEncryption.encryptEntryWithSecretTag).toHaveBeenCalledWith(
        'This was spoken',
        'voice-detected-tag'
      );
      expect(result.secret_tag_id).toBe('voice-detected-tag');
    });
  });
}); 