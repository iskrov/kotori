import { useState, useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { encryptedJournalService } from '../services/encryptedJournalService';
import { JournalEntry } from '../types';
import logger from '../utils/logger';

export interface JournalData {
  id: string | null;
  title: string;
  content: string;
  tags: string[];
  audioUri: string | null;
}

export interface SaveOptions {
  silent?: boolean; // If true, no navigation or error callbacks
  navigateOnSuccess?: boolean; // If true, trigger navigation on success
}

export interface JournalEntryHook {
  journalId: string | null;
  isSaving: boolean;
  save: (data?: Partial<JournalData>, options?: SaveOptions) => Promise<string | null>;
  error: Error | null;
}

interface UseJournalEntryOptions {
  initialData?: Partial<JournalData>;
  selectedDate?: string; // Date in YYYY-MM-DD format from calendar
  onSaveComplete?: (id: string | null) => void;
  onSaveError?: (error: Error) => void;
}

const DEFAULT_OPTIONS: UseJournalEntryOptions = {};

const useJournalEntry = (data: JournalData, options?: UseJournalEntryOptions): JournalEntryHook => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { selectedDate, onSaveComplete, onSaveError } = mergedOptions;
  const [journalId, setJournalId] = useState<string | null>(data.id);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);
  const isNavigatingRef = useRef(false);
  
  // Add a reference to always hold the latest data
  const currentDataRef = useRef<JournalData>(data);
  
  // Keep the data reference updated
  useEffect(() => {
    currentDataRef.current = {
      ...data,
      id: journalId || data.id, // Always use the most up-to-date ID
    };
  }, [data, journalId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Important: Mark as navigating on unmount to prevent further saves
      isNavigatingRef.current = true;
    };
  }, []);

  // Core save function: handles create (POST) or update (PUT)
  const performSave = useCallback(async (currentData: JournalData): Promise<string | null> => {
    // Check if component unmounted or navigation started
    if (!isMounted.current || isNavigatingRef.current) {
      logger.warn('performSave: Save aborted: Component unmounting or navigation in progress');
      return null;
    }
    
    // Check if there's anything to save
    if (!currentData.content.trim() && !currentData.title.trim() && !currentData.audioUri) {
      logger.warn('performSave: Save skipped: No title, content, or audio URI.');
      return null;
    }
      
    // Don't send blob URLs to backend - they can't be accessed by the server
    let audioUrl = null;
    if (currentData.audioUri && !currentData.audioUri.startsWith('blob:')) {
      audioUrl = currentData.audioUri;
    } else if (currentData.audioUri) {
      logger.info('performSave: Detected blob URL for audio. This will not be sent to backend.');
    }
    
    // Use selectedDate if provided, otherwise use current date
    let entryDate: string;
    if (selectedDate) {
      // Parse the selectedDate (YYYY-MM-DD format) and create a proper UTC date
      // Set it to noon UTC to avoid timezone issues
      const [year, month, day] = selectedDate.split('-').map(Number);
      const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      entryDate = utcDate.toISOString();
      logger.info(`performSave: Using selectedDate ${selectedDate}, converted to UTC: ${entryDate}`);
    } else {
      entryDate = new Date().toISOString();
      logger.info(`performSave: Using current date: ${entryDate}`);
    }
      
    const entryData = {
      title: currentData.title.trim() || `Journal - ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
      content: currentData.content.trim(),
      entry_date: entryDate,
      audio_url: audioUrl || undefined, // Convert null to undefined for type compatibility
      tags: currentData.tags,
    };

    try {
      // Final check before API call
      if (!isMounted.current || isNavigatingRef.current) {
        logger.warn('performSave: Save aborted just before API call: Component unmounting or navigation in progress');
        return null;
      }
      
      let response;
      if (currentData.id !== null) {
        logger.info(`performSave: Updating journal entry ID: ${currentData.id}`);
        const updatedEntry = await encryptedJournalService.updateEntry(currentData.id, entryData);
        logger.info(`performSave: Journal entry ID: ${currentData.id} updated.`);
        return currentData.id;
      } else {
        logger.info('performSave: Creating new journal entry with data:', entryData);
        const newEntry = await encryptedJournalService.createEntry(entryData);
        const newId = String(newEntry.id);
        logger.info(`performSave: New journal entry created with ID: ${newId}`);
        if (isMounted.current && !isNavigatingRef.current) {
          setJournalId(newId);
        }
        return newId;
      }
    } catch (err) {
      // Only set error if still mounted and not navigating
      if (isMounted.current && !isNavigatingRef.current) {
        const error = err instanceof Error ? err : new Error('Error saving journal entry');
        logger.error('performSave: Error saving journal entry', error);
        setError(error);
        if (onSaveError) {
          onSaveError(error);
        }
      } else {
          logger.warn('performSave: Save error occurred, but component unmounted or navigating. Error not propagated.', err);
      }
      // Rethrow so the caller knows it failed, even if state isn't updated
      throw err; 
    }
  }, [onSaveError, selectedDate]);

  // Immediate save function
  const save = useCallback(async (dataOverride?: Partial<JournalData>, options?: SaveOptions): Promise<string | null> => {
    const { silent = false, navigateOnSuccess = false } = options || {};
    
    // Check if already saving
    if (isSaving) {
      logger.debug('save: Save skipped: Another save operation is in progress.');
      return null;
    }

    // Check mounted status before proceeding
    if (!isMounted.current || isNavigatingRef.current) {
      logger.warn('save: Save aborted: Component unmounting or navigation in progress');
      return null;
    }
    
    logger.info(`save: Starting ${silent ? 'silent' : 'manual'} save operation...`);
    
    setIsSaving(true);
    setError(null);
    let savedId: string | null = null;
    
    try {
      // Merge current data with any overrides
      const currentData = currentDataRef.current;
      const finalData: JournalData = {
        ...currentData,
        ...dataOverride,
      };
      
      // Perform the save operation
      savedId = await performSave(finalData);
      logger.info(`save: performSave completed. Result ID: ${savedId}.`);
      
      // Handle success callbacks only if component is still mounted
      if (isMounted.current && !isNavigatingRef.current) {
        if (savedId !== null) {
          setJournalId(savedId);
          
          // Only trigger navigation callback for non-silent saves
          if (!silent && navigateOnSuccess && onSaveComplete) {
            logger.info('save: Triggering navigation callback.');
            onSaveComplete(savedId);
          } else {
            logger.info(`save: Success (${silent ? 'silent' : 'manual'}) - no navigation.`);
          }
        }
      }
      
      return savedId;
    } catch (err) {
      logger.error('save: Save operation failed:', err);
      
      // Only trigger error callback for non-silent saves
      if (!silent && isMounted.current && !isNavigatingRef.current && onSaveError) {
        const error = err instanceof Error ? err : new Error('Error saving journal entry');
        setError(error);
        onSaveError(error);
      } else if (silent) {
        logger.info('save: Silent save failed - no error callback triggered.');
      }
      
      return null;
    } finally {
      // Ensure isSaving is set to false only if the component is still mounted
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  }, [performSave, isSaving, onSaveComplete, onSaveError]);

  // Add a comprehensive unmount cleanup at the end of the hook, after all functions are defined
  useEffect(() => {
    return () => {
      // This will run when the component unmounts
      logger.info('Final cleanup on unmount');
      
      // Ensure we're marked as unmounted and navigating
      isMounted.current = false;
      isNavigatingRef.current = true;
    };
  }, []);

  return {
    journalId,
    isSaving,
    save,
    error,
  };
};

export default useJournalEntry; 