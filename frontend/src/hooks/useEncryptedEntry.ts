/**
 * useEncryptedEntry Hook
 * 
 * React hook for managing encrypted journal entries with OPAQUE authentication.
 * Provides a clean interface for creating, encrypting, and managing encrypted entries.
 */

import { useState, useCallback, useEffect } from 'react';
import { encryptedEntryManager } from '../services/EncryptedEntryManager';
import { voicePhraseDetector } from '../services/VoicePhraseDetector';
import logger from '../utils/logger';
import {
  CreateEncryptedEntryRequest,
  EncryptedEntryData,
  DecryptedEntry,
  EntryEncryptionStatus,
  EncryptedEntryError,
  ENCRYPTED_ENTRY_ERROR_CODES
} from '../types/encryptedEntryTypes';

export interface EncryptedEntryState {
  isCreating: boolean;
  isDecrypting: boolean;
  error: EncryptedEntryError | null;
  lastCreatedEntry: EncryptedEntryData | null;
  lastDecryptedEntry: DecryptedEntry | null;
}

export interface UseEncryptedEntryOptions {
  autoCheckVoiceActivation?: boolean;
  onEntryCreated?: (entry: EncryptedEntryData) => void;
  onEntryDecrypted?: (entry: DecryptedEntry) => void;
  onError?: (error: EncryptedEntryError) => void;
}

export interface UseEncryptedEntryReturn {
  // State
  state: EncryptedEntryState;
  
  // Core operations
  createEncryptedEntry: (request: CreateEncryptedEntryRequest) => Promise<EncryptedEntryData | null>;
  decryptEntry: (entryId: string, tagId: string) => Promise<DecryptedEntry | null>;
  
  // Voice integration
  checkVoiceActivation: (transcribedText: string) => Promise<{
    shouldEncrypt: boolean;
    tagId?: string;
    tagName?: string;
  }>;
  
  // Utility functions
  getEncryptionStatus: (entry: any) => EntryEncryptionStatus;
  clearError: () => void;
  reset: () => void;
}

/**
 * Hook for managing encrypted journal entries
 */
export function useEncryptedEntry(options: UseEncryptedEntryOptions = {}): UseEncryptedEntryReturn {
  const {
    autoCheckVoiceActivation = false,
    onEntryCreated,
    onEntryDecrypted,
    onError
  } = options;

  const [state, setState] = useState<EncryptedEntryState>({
    isCreating: false,
    isDecrypting: false,
    error: null,
    lastCreatedEntry: null,
    lastDecryptedEntry: null
  });

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setState({
      isCreating: false,
      isDecrypting: false,
      error: null,
      lastCreatedEntry: null,
      lastDecryptedEntry: null
    });
  }, []);

  // Create encrypted entry
  const createEncryptedEntry = useCallback(async (
    request: CreateEncryptedEntryRequest
  ): Promise<EncryptedEntryData | null> => {
    try {
      setState(prev => ({ ...prev, isCreating: true, error: null }));

      logger.info(`[useEncryptedEntry] Creating encrypted entry for tag ${request.tagId}`);
      
      const encryptedEntry = await encryptedEntryManager.createEncryptedEntry(request);
      
      setState(prev => ({
        ...prev,
        isCreating: false,
        lastCreatedEntry: encryptedEntry
      }));

      logger.info(`[useEncryptedEntry] Encrypted entry created with ID: ${encryptedEntry.id}`);
      
      // Trigger callback
      if (onEntryCreated) {
        onEntryCreated(encryptedEntry);
      }

      return encryptedEntry;

    } catch (error) {
      logger.error('[useEncryptedEntry] Failed to create encrypted entry:', error);
      
      const encryptedError: EncryptedEntryError = error instanceof Error && 'code' in error
        ? {
            code: (error as any).code,
            message: error.message,
            details: (error as any).details,
            timestamp: new Date()
          }
        : {
            code: ENCRYPTED_ENTRY_ERROR_CODES.UNKNOWN_ERROR,
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            timestamp: new Date()
          };

      setState(prev => ({
        ...prev,
        isCreating: false,
        error: encryptedError
      }));

      // Trigger error callback
      if (onError) {
        onError(encryptedError);
      }

      return null;
    }
  }, [onEntryCreated, onError]);

  // Decrypt entry
  const decryptEntry = useCallback(async (
    entryId: string,
    tagId: string
  ): Promise<DecryptedEntry | null> => {
    try {
      setState(prev => ({ ...prev, isDecrypting: true, error: null }));

      logger.info(`[useEncryptedEntry] Decrypting entry ${entryId} for tag ${tagId}`);
      
      const decryptedEntry = await encryptedEntryManager.decryptEntry(entryId, tagId);
      
      setState(prev => ({
        ...prev,
        isDecrypting: false,
        lastDecryptedEntry: decryptedEntry
      }));

      logger.info(`[useEncryptedEntry] Entry ${entryId} decrypted successfully`);
      
      // Trigger callback
      if (onEntryDecrypted) {
        onEntryDecrypted(decryptedEntry);
      }

      return decryptedEntry;

    } catch (error) {
      logger.error(`[useEncryptedEntry] Failed to decrypt entry ${entryId}:`, error);
      
      const encryptedError: EncryptedEntryError = error instanceof Error && 'code' in error
        ? {
            code: (error as any).code,
            message: error.message,
            details: (error as any).details,
            timestamp: new Date()
          }
        : {
            code: ENCRYPTED_ENTRY_ERROR_CODES.DECRYPTION_FAILED,
            message: error instanceof Error ? error.message : 'Decryption failed',
            timestamp: new Date()
          };

      setState(prev => ({
        ...prev,
        isDecrypting: false,
        error: encryptedError
      }));

      // Trigger error callback
      if (onError) {
        onError(encryptedError);
      }

      return null;
    }
  }, [onEntryDecrypted, onError]);

  // Check voice activation
  const checkVoiceActivation = useCallback(async (transcribedText: string) => {
    try {
      logger.debug(`[useEncryptedEntry] Checking voice activation for: "${transcribedText}"`);
      
      const activation = await encryptedEntryManager.checkVoiceActivation(transcribedText);
      
      if (activation.shouldEncrypt) {
        logger.info(`[useEncryptedEntry] Voice activation detected for tag: ${activation.tagName}`);
      }
      
      return activation;
    } catch (error) {
      logger.error('[useEncryptedEntry] Voice activation check failed:', error);
      return { shouldEncrypt: false };
    }
  }, []);

  // Get encryption status for an entry
  const getEncryptionStatus = useCallback((entry: any): EntryEncryptionStatus => {
    try {
      return encryptedEntryManager.getEntryEncryptionStatus(entry);
    } catch (error) {
      logger.error('[useEncryptedEntry] Failed to get encryption status:', error);
      return {
        isEncrypted: false,
        encryptionLevel: 'none',
        hasActiveSession: false,
        canDecrypt: false
      };
    }
  }, []);

  // Auto-check voice activation if enabled
  useEffect(() => {
    if (!autoCheckVoiceActivation) return;

    let isActive = true;

    const handleVoiceTranscription = async (transcribedText: string) => {
      if (!isActive) return;
      
      try {
        const activation = await checkVoiceActivation(transcribedText);
        if (activation.shouldEncrypt) {
          logger.info('[useEncryptedEntry] Auto voice activation detected');
          // Could trigger additional actions here if needed
        }
      } catch (error) {
        logger.error('[useEncryptedEntry] Auto voice activation check failed:', error);
      }
    };

    // This would integrate with the voice transcription service
    // For now, we'll just set up the cleanup
    
    return () => {
      isActive = false;
    };
  }, [autoCheckVoiceActivation, checkVoiceActivation]);

  return {
    state,
    createEncryptedEntry,
    decryptEntry,
    checkVoiceActivation,
    getEncryptionStatus,
    clearError,
    reset
  };
}

// Helper hook for voice-activated encryption
export function useVoiceEncryption(options: {
  onActivation?: (tagId: string, tagName?: string) => void;
  onError?: (error: EncryptedEntryError) => void;
} = {}) {
  const { onActivation, onError } = options;
  
  const [isListening, setIsListening] = useState(false);
  const [lastActivation, setLastActivation] = useState<{
    tagId: string;
    tagName?: string;
    timestamp: Date;
  } | null>(null);

  const checkAndActivate = useCallback(async (transcribedText: string) => {
    try {
      setIsListening(true);
      
      const activation = await encryptedEntryManager.checkVoiceActivation(transcribedText);
      
      if (activation.shouldEncrypt && activation.tagId) {
        const activationData = {
          tagId: activation.tagId,
          tagName: activation.tagName,
          timestamp: new Date()
        };
        
        setLastActivation(activationData);
        
        if (onActivation) {
          onActivation(activation.tagId, activation.tagName);
        }
        
        logger.info(`[useVoiceEncryption] Voice encryption activated for tag: ${activation.tagName}`);
      }
      
      return activation;
    } catch (error) {
      logger.error('[useVoiceEncryption] Voice activation failed:', error);
      
      const encryptedError: EncryptedEntryError = {
        code: ENCRYPTED_ENTRY_ERROR_CODES.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Voice activation failed',
        timestamp: new Date()
      };
      
      if (onError) {
        onError(encryptedError);
      }
      
      return { shouldEncrypt: false };
    } finally {
      setIsListening(false);
    }
  }, [onActivation, onError]);

  return {
    isListening,
    lastActivation,
    checkAndActivate
  };
} 