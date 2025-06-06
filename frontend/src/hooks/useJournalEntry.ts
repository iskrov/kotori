import { useState, useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import debounce from 'lodash.debounce';
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

export interface JournalEntryHook {
  journalId: string | null;
  isSaving: boolean;
  isAutoSaving: boolean;
  saveEntry: () => Promise<string | null>;
  autoSave: () => void;
  cancelAutoSave: () => void;
  error: Error | null;
}

interface UseJournalEntryOptions {
  initialData?: Partial<JournalData>;
  autoSaveDelay?: number;
  selectedDate?: string; // Date in YYYY-MM-DD format from calendar
  onSaveComplete?: (id: string | null) => void;
  onSaveError?: (error: Error) => void;
}

const DEFAULT_OPTIONS: UseJournalEntryOptions = {
  autoSaveDelay: 2500,
};

const useJournalEntry = (data: JournalData, options?: UseJournalEntryOptions): JournalEntryHook => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { autoSaveDelay, selectedDate, onSaveComplete, onSaveError } = mergedOptions;
  const [journalId, setJournalId] = useState<string | null>(data.id);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
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

  // Create a stable reference to wrap the debounced function
  const debouncedAutoSaveRef = useRef<ReturnType<typeof debounce>>();
  
  // Create the debounced function only once
  useEffect(() => {
    // Create the debounce function once
    debouncedAutoSaveRef.current = debounce(async () => {
      // Double-check isMounted at the start of execution
      if (!isMounted.current || isNavigatingRef.current) {
        logger.info('Auto-save cancelled: component unmounted or navigation in progress');
        return;
      }
      
      if (isSaving) {
        logger.debug('Auto-save skipped (manual save in progress)');
        return;
      }
      
      logger.info('Attempting auto-save...');
      setIsAutoSaving(true);
      try {
        // Check again before API call
        if (!isMounted.current || isNavigatingRef.current) {
          logger.info('Auto-save cancelled: component unmounted before API call');
          return;
        }
        
        // Access the latest data from ref
        const currentData = currentDataRef.current;
        
        const savedId = await performSave(currentData);
        
        // And check once more after API call
        if (!isMounted.current || isNavigatingRef.current) {
          logger.info('Auto-save completed but component unmounted during API call');
          return;
        }
        
        logger.debug('Auto-save successful');
        if (savedId) {
          setJournalId(savedId);
        }
      } catch (error) {
        if (isMounted.current && !isNavigatingRef.current) {
          logger.error('Auto-save failed', error);
        }
      } finally {
        if (isMounted.current && !isNavigatingRef.current) {
          setIsAutoSaving(false);
        }
      }
    }, autoSaveDelay);
    
    // Clean up on unmount or when autoSaveDelay changes
    return () => {
      if (debouncedAutoSaveRef.current) {
        debouncedAutoSaveRef.current.cancel();
      }
    };
  }, [autoSaveDelay, isSaving, performSave]);

  // Function to trigger auto-save with current data
  const autoSave = useCallback(() => {
    // Don't schedule new auto-saves if the component is unmounted or navigating
    if (!isMounted.current || isNavigatingRef.current) {
      logger.debug('Ignoring autoSave request - component unmounted or navigation in progress');
      return;
    }
    
    // Access the latest data and check if there's content
    const currentData = currentDataRef.current;
    if (currentData.content.trim() || currentData.title.trim() || currentData.audioUri) {
      logger.debug("Content changed, scheduling auto-save");
      debouncedAutoSaveRef.current?.();
    } else {
      debouncedAutoSaveRef.current?.cancel();
    }
  }, []); // No dependencies needed since we're using refs

  // Cancel any pending auto-save
  const cancelAutoSave = useCallback(() => {
    logger.debug('Explicitly cancelling auto-save');
    debouncedAutoSaveRef.current?.cancel();
  }, []);

  // Immediate save function
  const saveEntry = useCallback(async (): Promise<string | null> => {
    // Check if already saving or auto-saving
    if (isSaving || isAutoSaving) {
      logger.debug('saveEntry: Save skipped: Another save operation is in progress.');
      return null;
    }

    // isNavigatingRef is set by the caller (RecordScreen) before calling saveEntry
    // cancelAutoSave(); // Caller should handle cancelling auto-save if needed
    logger.info('saveEntry: Attempting immediate save...');
    
    // Check mounted status before proceeding
    if (!isMounted.current) {
      logger.warn('saveEntry: Immediate save aborted: Component already unmounted');
      return null;
    }
    
    setIsSaving(true);
    setError(null);
    let savedId: string | null = null;
    
    try {
      // Get the most up-to-date data from ref just before saving
      const currentData = currentDataRef.current;
      
      // *** Await the actual save operation ***
      savedId = await performSave(currentData);
      logger.info(`saveEntry: performSave completed. Result ID: ${savedId}.`);
      
      // State update and callback call happen *after* performSave completes
      if (isMounted.current) { // Check mounted status again after await
         if (savedId !== null) {
           // No need to call setJournalId here, performSave does it on create
           // setJournalId(savedId);
         }
         if (onSaveComplete) {
           onSaveComplete(savedId);
         }
       } else {
           logger.warn('saveEntry: Save completed but component unmounted after await. Callback skipped.');
       }
      
      return savedId;
    } catch (err) {
      // Error handling is mostly done within performSave now
      // We just log that the overall saveEntry call failed.
      logger.error('saveEntry: Immediate save failed (error thrown by performSave).', err);
      // Ensure onSaveComplete is called with null on failure IF the component is still mounted
      // and the error wasn't already handled by performSave's onSaveError call.
      if (isMounted.current && onSaveComplete) {
          // Check if onSaveError was already called within performSave for this error
          // This is tricky, maybe simpler to rely on onSaveError always being called
          // Let's assume onSaveError was called if err occurred and component was mounted.
          // If we *still* call onSaveComplete(null), the caller might navigate incorrectly.
          // Let's REMOVE this call to onSaveComplete(null) here.
          // onSaveComplete(null); 
      } else if (!isMounted.current) {
          logger.warn('saveEntry: Save failed and component unmounted after await. Callback skipped.');
      }
      return null; // Indicate failure
    } finally {
      // Ensure isSaving is set to false only if the component is still mounted
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  }, [performSave, isSaving, isAutoSaving, onSaveComplete]); // Removed cancelAutoSave, onSaveError from deps - handled elsewhere or within performSave

  // Add a comprehensive unmount cleanup at the end of the hook, after all functions are defined
  useEffect(() => {
    return () => {
      // This will run when the component unmounts
      logger.info('Final cleanup: Cancelling any pending auto-saves on unmount');
      debouncedAutoSaveRef.current?.cancel();
      
      // Ensure we're marked as unmounted and navigating
      isMounted.current = false;
      isNavigatingRef.current = true;
    };
  }, []);

  return {
    journalId,
    isSaving,
    isAutoSaving,
    saveEntry,
    autoSave,
    cancelAutoSave,
    error,
  };
};

export default useJournalEntry; 