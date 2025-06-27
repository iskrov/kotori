/**
 * Encrypted Entry Manager
 * 
 * Core service for managing OPAQUE-encrypted journal entries.
 * Handles encryption, decryption, storage, and retrieval of encrypted entries
 * using OPAQUE session vault keys.
 */

import { VoicePhraseDetector } from './VoicePhraseDetector';
import { SessionManager } from './SessionManager';
import { OpaqueClient } from './crypto/OpaqueClient';
import { JournalAPI } from './api';
import logger from '../utils/logger';
import {
  EncryptedEntryData,
  CreateEncryptedEntryRequest,
  DecryptedEntry,
  EncryptionResult,
  DecryptionResult,
  EntryEncryptionStatus,
  EncryptedEntryListItem,
  EncryptionOptions,
  EncryptedEntrySearchOptions,
  EncryptedEntryError,
  ENCRYPTED_ENTRY_ERROR_CODES,
  EncryptedEntryErrorCode
} from '../types/encryptedEntryTypes';
import { JournalEntry } from '../types';

// Simple secure memory management for sensitive data
class SecureMemory {
  private data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = new Uint8Array(data);
  }

  getData(): Uint8Array {
    return this.data;
  }

  clear(): void {
    this.data.fill(0);
  }
}

/**
 * Service for managing encrypted journal entries with OPAQUE authentication
 */
export class EncryptedEntryManager {
  private static instance: EncryptedEntryManager;
  private voicePhraseDetector: VoicePhraseDetector;
  private sessionManager: SessionManager;
  private opaqueClient: OpaqueClient;
  
  // Configuration constants
  private readonly DEFAULT_ALGORITHM = 'AES-256-GCM';
  private readonly DEFAULT_KEY_SIZE = 256;
  private readonly DEFAULT_IV_SIZE = 12;  // 96 bits for GCM
  private readonly DEFAULT_TAG_SIZE = 16; // 128 bits for GCM
  private readonly MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB limit

  private constructor() {
    this.voicePhraseDetector = VoicePhraseDetector.getInstance();
    this.sessionManager = SessionManager.getInstance();
    this.opaqueClient = OpaqueClient.getInstance();
  }

  public static getInstance(): EncryptedEntryManager {
    if (!EncryptedEntryManager.instance) {
      EncryptedEntryManager.instance = new EncryptedEntryManager();
    }
    return EncryptedEntryManager.instance;
  }

  /**
   * Create an encrypted journal entry
   */
  public async createEncryptedEntry(request: CreateEncryptedEntryRequest): Promise<EncryptedEntryData> {
    const startTime = Date.now();
    let entryKey: SecureMemory | null = null;
    let vaultKey: SecureMemory | null = null;

    try {
      logger.info(`[EncryptedEntryManager] Creating encrypted entry for tag ${request.tagId}`);

      // Validate input
      this.validateCreateRequest(request);

      // Check for active session
      const session = this.voicePhraseDetector.getActiveSession(request.tagId);
      if (!session) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.NO_ACTIVE_SESSION,
          `No active session for tag ${request.tagId}`
        );
      }

      // Validate session hasn't expired
      if (new Date() > session.expiresAt) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.SESSION_EXPIRED,
          'Session has expired'
        );
      }

      // Get vault key from session
      if (!session.vaultKey) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.VAULT_KEY_MISSING,
          'Vault key not available in session'
        );
      }

      vaultKey = new SecureMemory(session.vaultKey);

      // Generate entry encryption key
      entryKey = await this.generateEntryKey();

      // Encrypt the content
      const encryptionResult = await this.encryptContent(
        request.content,
        entryKey.getData(),
        { algorithm: this.DEFAULT_ALGORITHM }
      );

      if (!encryptionResult.success) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.ENCRYPTION_FAILED,
          encryptionResult.error || 'Content encryption failed'
        );
      }

      // Wrap the entry key with vault key
      const keyWrappingResult = await this.wrapEntryKey(
        entryKey.getData(),
        vaultKey.getData()
      );

      if (!keyWrappingResult.success) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.ENCRYPTION_FAILED,
          keyWrappingResult.error || 'Key wrapping failed'
        );
      }

      // Prepare encrypted entry data
      const encryptedEntry: EncryptedEntryData = {
        title: request.title,
        encryptedContent: encryptionResult.encryptedContent!,
        encryptionIv: encryptionResult.encryptionIv!,
        wrappedKey: keyWrappingResult.wrappedKey!,
        wrapIv: keyWrappingResult.wrapIv!,
        algorithm: encryptionResult.algorithm!,
        tagId: request.tagId,
        tagName: session.tagName,
        entryDate: request.entryDate || new Date().toISOString(),
        audioUrl: request.audioUrl,
        tags: request.tags
      };

      // Store encrypted entry via API
      const storedEntry = await this.storeEncryptedEntry(encryptedEntry);

      const elapsedTime = Date.now() - startTime;
      logger.info(`[EncryptedEntryManager] Encrypted entry created successfully in ${elapsedTime}ms`);

      return storedEntry;

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      logger.error(`[EncryptedEntryManager] Failed to create encrypted entry (${elapsedTime}ms):`, error);
      throw error;
    } finally {
      // Clean up sensitive data
      if (entryKey) {
        entryKey.clear();
      }
      if (vaultKey) {
        vaultKey.clear();
      }
    }
  }

  /**
   * Decrypt an encrypted journal entry
   */
  public async decryptEntry(entryId: string, tagId: string): Promise<DecryptedEntry> {
    let vaultKey: SecureMemory | null = null;
    let entryKey: SecureMemory | null = null;

    try {
      logger.info(`[EncryptedEntryManager] Decrypting entry ${entryId} for tag ${tagId}`);

      // Check for active session
      const session = this.voicePhraseDetector.getActiveSession(tagId);
      if (!session) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.NO_ACTIVE_SESSION,
          `No active session for tag ${tagId}`
        );
      }

      // Get encrypted entry from storage
      const encryptedEntry = await this.getEncryptedEntry(entryId);
      if (!encryptedEntry) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.STORAGE_ERROR,
          'Encrypted entry not found'
        );
      }

      // Verify tag ID matches
      if (encryptedEntry.tagId !== tagId) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.INVALID_TAG_ID,
          'Tag ID mismatch'
        );
      }

      // Get vault key from session
      if (!session.vaultKey) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.VAULT_KEY_MISSING,
          'Vault key not available in session'
        );
      }

      vaultKey = new SecureMemory(session.vaultKey);

      // Unwrap entry key
      const keyUnwrappingResult = await this.unwrapEntryKey(
        encryptedEntry.wrappedKey,
        encryptedEntry.wrapIv,
        vaultKey.getData()
      );

      if (!keyUnwrappingResult.success) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.DECRYPTION_FAILED,
          keyUnwrappingResult.error || 'Key unwrapping failed'
        );
      }

      entryKey = new SecureMemory(keyUnwrappingResult.entryKey!);

      // Decrypt content
      const decryptionResult = await this.decryptContent(
        encryptedEntry.encryptedContent,
        encryptedEntry.encryptionIv,
        entryKey.getData(),
        { algorithm: encryptedEntry.algorithm }
      );

      if (!decryptionResult.success) {
        throw this.createError(
          ENCRYPTED_ENTRY_ERROR_CODES.DECRYPTION_FAILED,
          decryptionResult.error || 'Content decryption failed'
        );
      }

      const decryptedEntry: DecryptedEntry = {
        id: entryId,
        title: encryptedEntry.title,
        content: decryptionResult.content!,
        tagId: encryptedEntry.tagId,
        tagName: encryptedEntry.tagName,
        entryDate: encryptedEntry.entryDate,
        audioUrl: encryptedEntry.audioUrl,
        tags: encryptedEntry.tags,
        createdAt: encryptedEntry.createdAt,
        updatedAt: encryptedEntry.updatedAt,
        encryptionStatus: 'decrypted'
      };

      logger.info(`[EncryptedEntryManager] Entry ${entryId} decrypted successfully`);
      return decryptedEntry;

    } catch (error) {
      logger.error(`[EncryptedEntryManager] Failed to decrypt entry ${entryId}:`, error);
      throw error;
    } finally {
      // Clean up sensitive data
      if (vaultKey) {
        vaultKey.clear();
      }
      if (entryKey) {
        entryKey.clear();
      }
    }
  }

  /**
   * Get encryption status for a journal entry
   */
  public getEntryEncryptionStatus(entry: JournalEntry): EntryEncryptionStatus {
    const isEncrypted = !!(entry.encrypted_content || entry.secret_tag_id);
    
    if (!isEncrypted) {
      return {
        isEncrypted: false,
        encryptionLevel: 'none',
        hasActiveSession: false,
        canDecrypt: false
      };
    }

    const tagId = entry.secret_tag_id;
    const hasActiveSession = tagId ? this.voicePhraseDetector.isSessionActive(tagId) : false;
    const session = tagId ? this.voicePhraseDetector.getActiveSession(tagId) : null;

    return {
      isEncrypted: true,
      tagId: tagId || undefined,
      tagName: session?.tagName,
      hasActiveSession,
      canDecrypt: hasActiveSession,
      encryptionLevel: 'standard',
      lastDecrypted: session?.lastAccessed
    };
  }

  /**
   * List encrypted entries with metadata (for UI display)
   */
  public async listEncryptedEntries(options: EncryptedEntrySearchOptions = {}): Promise<EncryptedEntryListItem[]> {
    try {
      logger.info('[EncryptedEntryManager] Listing encrypted entries');

      // Get entries from API
      const response = await JournalAPI.getEntries({
        limit: options.limit || 50,
        offset: options.offset || 0,
        search: options.query,
        tag_ids: options.tagIds
      });

      const entries: JournalEntry[] = response.data.items || response.data;
      const listItems: EncryptedEntryListItem[] = [];

      for (const entry of entries) {
        const encryptionStatus = this.getEntryEncryptionStatus(entry);
        
        // Filter based on options
        if (options.onlyDecryptable && !encryptionStatus.canDecrypt) {
          continue;
        }
        
        if (options.includeEncrypted === false && encryptionStatus.isEncrypted) {
          continue;
        }

        // Generate preview if entry can be decrypted
        let preview: string | undefined;
        if (encryptionStatus.canDecrypt && encryptionStatus.tagId) {
          try {
            const decrypted = await this.decryptEntry(entry.id.toString(), encryptionStatus.tagId);
            preview = this.generatePreview(decrypted.content);
          } catch (error) {
            logger.debug(`Failed to generate preview for entry ${entry.id}:`, error);
            preview = '[Encrypted content]';
          }
        } else if (encryptionStatus.isEncrypted) {
          preview = '[Encrypted content - session required]';
        } else {
          preview = this.generatePreview(entry.content);
        }

        listItems.push({
          id: entry.id.toString(),
          title: entry.title,
          preview,
          encryptionStatus,
          entryDate: entry.entry_date,
          audioUrl: entry.audio_url || undefined,
          tags: entry.tags?.map(tag => tag.name),
          createdAt: entry.created_at,
          updatedAt: entry.updated_at
        });
      }

      logger.info(`[EncryptedEntryManager] Listed ${listItems.length} entries`);
      return listItems;

    } catch (error) {
      logger.error('[EncryptedEntryManager] Failed to list encrypted entries:', error);
      throw this.createError(
        ENCRYPTED_ENTRY_ERROR_CODES.STORAGE_ERROR,
        'Failed to retrieve entries'
      );
    }
  }

  /**
   * Check if voice-activated encryption should be triggered
   */
  public async checkVoiceActivation(transcribedText: string): Promise<{
    shouldEncrypt: boolean;
    tagId?: string;
    tagName?: string;
  }> {
    try {
      const phraseResult = await this.voicePhraseDetector.checkForSecretPhrase(transcribedText);
      
      if (phraseResult.found && phraseResult.action === 'activate' && phraseResult.tagId) {
        return {
          shouldEncrypt: true,
          tagId: phraseResult.tagId,
          tagName: phraseResult.tagName
        };
      }

      return { shouldEncrypt: false };
    } catch (error) {
      logger.error('[EncryptedEntryManager] Voice activation check failed:', error);
      return { shouldEncrypt: false };
    }
  }

  /**
   * Generate entry encryption key
   */
  private async generateEntryKey(): Promise<SecureMemory> {
    try {
      const keyBytes = new Uint8Array(32); // 256 bits
      crypto.getRandomValues(keyBytes);
      return new SecureMemory(keyBytes);
    } catch (error) {
      throw this.createError(
        ENCRYPTED_ENTRY_ERROR_CODES.ENCRYPTION_FAILED,
        'Failed to generate entry key'
      );
    }
  }

  /**
   * Encrypt content using AES-256-GCM
   */
  private async encryptContent(
    content: string,
    key: Uint8Array,
    options: EncryptionOptions = {}
  ): Promise<EncryptionResult> {
    try {
      const algorithm = options.algorithm || this.DEFAULT_ALGORITHM;
      const iv = new Uint8Array(options.ivSize || this.DEFAULT_IV_SIZE);
      crypto.getRandomValues(iv);

      const encoder = new TextEncoder();
      const contentBytes = encoder.encode(content);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const encryptedBytes = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: (options.tagSize || this.DEFAULT_TAG_SIZE) * 8
        },
        cryptoKey,
        contentBytes
      );

      return {
        success: true,
        encryptedContent: this.arrayBufferToBase64(encryptedBytes),
        encryptionIv: this.arrayBufferToBase64(iv.buffer),
        algorithm
      };

    } catch (error) {
      logger.error('[EncryptedEntryManager] Content encryption failed:', error);
      return {
        success: false,
        error: 'Content encryption failed'
      };
    }
  }

  /**
   * Decrypt content using AES-256-GCM
   */
  private async decryptContent(
    encryptedContent: string,
    ivBase64: string,
    key: Uint8Array,
    options: EncryptionOptions = {}
  ): Promise<DecryptionResult> {
    try {
      const encryptedBytes = this.base64ToArrayBuffer(encryptedContent);
      const iv = this.base64ToArrayBuffer(ivBase64);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const decryptedBytes = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv),
          tagLength: (options.tagSize || this.DEFAULT_TAG_SIZE) * 8
        },
        cryptoKey,
        encryptedBytes
      );

      const decoder = new TextDecoder();
      const content = decoder.decode(decryptedBytes);

      return {
        success: true,
        content
      };

    } catch (error) {
      logger.error('[EncryptedEntryManager] Content decryption failed:', error);
      return {
        success: false,
        error: 'Content decryption failed'
      };
    }
  }

  /**
   * Wrap entry key with vault key
   */
  private async wrapEntryKey(
    entryKey: Uint8Array,
    vaultKey: Uint8Array
  ): Promise<{ success: boolean; wrappedKey?: string; wrapIv?: string; error?: string }> {
    try {
      const iv = new Uint8Array(this.DEFAULT_IV_SIZE);
      crypto.getRandomValues(iv);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        vaultKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const wrappedBytes = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: this.DEFAULT_TAG_SIZE * 8
        },
        cryptoKey,
        entryKey
      );

      return {
        success: true,
        wrappedKey: this.arrayBufferToBase64(wrappedBytes),
        wrapIv: this.arrayBufferToBase64(iv.buffer)
      };

    } catch (error) {
      logger.error('[EncryptedEntryManager] Key wrapping failed:', error);
      return {
        success: false,
        error: 'Key wrapping failed'
      };
    }
  }

  /**
   * Unwrap entry key with vault key
   */
  private async unwrapEntryKey(
    wrappedKeyBase64: string,
    wrapIvBase64: string,
    vaultKey: Uint8Array
  ): Promise<{ success: boolean; entryKey?: Uint8Array; error?: string }> {
    try {
      const wrappedBytes = this.base64ToArrayBuffer(wrappedKeyBase64);
      const iv = this.base64ToArrayBuffer(wrapIvBase64);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        vaultKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const entryKeyBytes = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv),
          tagLength: this.DEFAULT_TAG_SIZE * 8
        },
        cryptoKey,
        wrappedBytes
      );

      return {
        success: true,
        entryKey: new Uint8Array(entryKeyBytes)
      };

    } catch (error) {
      logger.error('[EncryptedEntryManager] Key unwrapping failed:', error);
      return {
        success: false,
        error: 'Key unwrapping failed'
      };
    }
  }

  /**
   * Store encrypted entry via API
   */
  private async storeEncryptedEntry(encryptedEntry: EncryptedEntryData): Promise<EncryptedEntryData> {
    try {
      const apiData = {
        title: encryptedEntry.title,
        encrypted_content: encryptedEntry.encryptedContent,
        encrypted_key: encryptedEntry.wrappedKey,
        iv: encryptedEntry.encryptionIv,
        salt: '',
        algorithm: encryptedEntry.algorithm,
        wrapIv: encryptedEntry.wrapIv,
        entry_date: encryptedEntry.entryDate,
        audio_url: encryptedEntry.audioUrl,
        tags: encryptedEntry.tags || [],
        secret_tag_id: encryptedEntry.tagId,
        secret_tag_hash: ''
      };

      const response = await JournalAPI.createEncryptedEntry(apiData);
      const storedEntry = response.data;

      return {
        ...encryptedEntry,
        id: storedEntry.id.toString(),
        createdAt: storedEntry.created_at,
        updatedAt: storedEntry.updated_at
      };

    } catch (error) {
      logger.error('[EncryptedEntryManager] Failed to store encrypted entry:', error);
      throw this.createError(
        ENCRYPTED_ENTRY_ERROR_CODES.STORAGE_ERROR,
        'Failed to store encrypted entry'
      );
    }
  }

  /**
   * Get encrypted entry from storage
   */
  private async getEncryptedEntry(entryId: string): Promise<EncryptedEntryData | null> {
    try {
      const response = await JournalAPI.getEntry(parseInt(entryId));
      const entry = response.data;

      if (!entry.encrypted_content) {
        return null;
      }

      return {
        id: entry.id.toString(),
        title: entry.title,
        encryptedContent: entry.encrypted_content,
        encryptionIv: entry.encryption_iv || '',
        wrappedKey: entry.encrypted_key || '',
        wrapIv: entry.encryption_wrap_iv || '',
        algorithm: entry.encryption_algorithm || this.DEFAULT_ALGORITHM,
        tagId: entry.secret_tag_id || '',
        entryDate: entry.entry_date,
        audioUrl: entry.audio_url || undefined,
        tags: entry.tags?.map((tag: any) => tag.name),
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
      };

    } catch (error) {
      logger.error(`[EncryptedEntryManager] Failed to get encrypted entry ${entryId}:`, error);
      return null;
    }
  }

  /**
   * Validate create entry request
   */
  private validateCreateRequest(request: CreateEncryptedEntryRequest): void {
    if (!request.content?.trim()) {
      throw this.createError(
        ENCRYPTED_ENTRY_ERROR_CODES.UNKNOWN_ERROR,
        'Content is required'
      );
    }

    if (!request.tagId?.trim()) {
      throw this.createError(
        ENCRYPTED_ENTRY_ERROR_CODES.INVALID_TAG_ID,
        'Tag ID is required'
      );
    }

    if (request.content.length > this.MAX_CONTENT_SIZE) {
      throw this.createError(
        ENCRYPTED_ENTRY_ERROR_CODES.CONTENT_TOO_LARGE,
        `Content exceeds maximum size of ${this.MAX_CONTENT_SIZE} bytes`
      );
    }
  }

  /**
   * Generate content preview (first 100 characters)
   */
  private generatePreview(content: string): string {
    if (!content) return '';
    const preview = content.trim().substring(0, 100);
    return preview.length < content.trim().length ? preview + '...' : preview;
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Create standardized error
   */
  private createError(code: EncryptedEntryErrorCode, message: string, details?: any): EncryptedEntryError {
    return {
      code,
      message,
      details,
      timestamp: new Date()
    };
  }
}

// Export singleton instance
export const encryptedEntryManager = EncryptedEntryManager.getInstance(); 