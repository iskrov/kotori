/**
 * Encrypted Entry Types
 * 
 * TypeScript interfaces for OPAQUE-encrypted journal entries.
 * Provides type safety for the encrypted entry creation and management workflow.
 */

// Core encrypted entry data structure
export interface EncryptedEntryData {
  id?: string;
  title?: string;
  encryptedContent: string;      // Base64 encoded encrypted content
  encryptionIv: string;          // Base64 encoded IV for content encryption
  wrappedKey: string;            // Base64 encoded entry key wrapped with vault key
  wrapIv: string;                // Base64 encoded IV for key wrapping
  algorithm: string;             // Encryption algorithm (e.g., 'AES-256-GCM')
  tagId: string;                 // OPAQUE tag ID associated with this entry
  tagName?: string;              // Display name of the tag
  entryDate: string;             // ISO timestamp of entry creation
  audioUrl?: string;             // Optional audio URL
  tags?: string[];               // Regular tags (non-encrypted)
  createdAt?: string;            // ISO timestamp of creation
  updatedAt?: string;            // ISO timestamp of last update
}

// Entry creation request
export interface CreateEncryptedEntryRequest {
  title?: string;
  content: string;               // Plaintext content to be encrypted
  tagId: string;                 // OPAQUE tag ID to use for encryption
  entryDate?: string;            // Optional custom entry date
  audioUrl?: string;             // Optional audio URL
  tags?: string[];               // Optional regular tags
}

// Entry decryption result
export interface DecryptedEntry {
  id: string;
  title?: string;
  content: string;               // Decrypted plaintext content
  tagId: string;
  tagName?: string;
  entryDate: string;
  audioUrl?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  encryptionStatus: 'decrypted' | 'encrypted' | 'error';
}

// Entry encryption operation result
export interface EncryptionResult {
  success: boolean;
  encryptedContent?: string;
  encryptionIv?: string;
  wrappedKey?: string;
  wrapIv?: string;
  algorithm?: string;
  error?: string;
}

// Entry decryption operation result
export interface DecryptionResult {
  success: boolean;
  content?: string;
  error?: string;
}

// Entry encryption status for UI display
export interface EntryEncryptionStatus {
  isEncrypted: boolean;
  tagId?: string;
  tagName?: string;
  hasActiveSession: boolean;
  canDecrypt: boolean;
  encryptionLevel: 'none' | 'standard' | 'enhanced';
  lastDecrypted?: Date;
}

// Entry list item with encryption metadata
export interface EncryptedEntryListItem {
  id: string;
  title?: string;
  preview?: string;              // First few words of content (if decrypted)
  encryptionStatus: EntryEncryptionStatus;
  entryDate: string;
  audioUrl?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Encryption configuration options
export interface EncryptionOptions {
  algorithm?: string;            // Default: 'AES-256-GCM'
  keySize?: number;              // Default: 256 bits
  ivSize?: number;               // Default: 12 bytes for GCM
  tagSize?: number;              // Default: 16 bytes for GCM
  iterations?: number;           // PBKDF2 iterations (if needed)
}

// Entry search and filtering options
export interface EncryptedEntrySearchOptions {
  query?: string;                // Search query
  tagIds?: string[];             // Filter by OPAQUE tag IDs
  includeEncrypted?: boolean;    // Include encrypted entries in search
  onlyDecryptable?: boolean;     // Only include entries that can be decrypted
  dateRange?: {
    start: string;
    end: string;
  };
  limit?: number;
  offset?: number;
}

// Batch encryption operation
export interface BatchEncryptionRequest {
  entries: Array<{
    id?: string;
    title?: string;
    content: string;
    tagId: string;
    entryDate?: string;
    audioUrl?: string;
    tags?: string[];
  }>;
  options?: EncryptionOptions;
}

// Batch encryption result
export interface BatchEncryptionResult {
  success: boolean;
  results: Array<{
    id?: string;
    success: boolean;
    encryptedData?: EncryptedEntryData;
    error?: string;
  }>;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
}

// Entry migration from legacy encryption
export interface EntryMigrationRequest {
  legacyEntryId: string;
  newTagId: string;              // OPAQUE tag to migrate to
  preserveMetadata?: boolean;    // Keep original dates/tags
}

// Entry migration result
export interface EntryMigrationResult {
  success: boolean;
  legacyEntryId: string;
  newEntryId?: string;
  error?: string;
}

// Entry export/import for backup
export interface EncryptedEntryExport {
  version: string;               // Export format version
  entries: EncryptedEntryData[];
  metadata: {
    exportedAt: string;
    totalEntries: number;
    encryptionMethod: string;
  };
}

// Entry statistics and analytics
export interface EncryptedEntryStats {
  totalEntries: number;
  encryptedEntries: number;
  unencryptedEntries: number;
  entriesByTag: Array<{
    tagId: string;
    tagName: string;
    count: number;
  }>;
  encryptionLevels: {
    standard: number;
    enhanced: number;
  };
  recentActivity: {
    entriesCreatedToday: number;
    entriesCreatedThisWeek: number;
    entriesCreatedThisMonth: number;
  };
}

// Error types for encrypted entry operations
export interface EncryptedEntryError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Common error codes
export const ENCRYPTED_ENTRY_ERROR_CODES = {
  NO_ACTIVE_SESSION: 'NO_ACTIVE_SESSION',
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  INVALID_TAG_ID: 'INVALID_TAG_ID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  VAULT_KEY_MISSING: 'VAULT_KEY_MISSING',
  CONTENT_TOO_LARGE: 'CONTENT_TOO_LARGE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type EncryptedEntryErrorCode = typeof ENCRYPTED_ENTRY_ERROR_CODES[keyof typeof ENCRYPTED_ENTRY_ERROR_CODES]; 