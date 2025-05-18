import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import logger from '../utils/logger';

export interface AudioRecordingOptions {
  quality?: keyof typeof Audio.RecordingOptionsPresets;
  autoStart?: boolean;
  filePrefix?: string;
  requestPermissionOnMount?: boolean;
  maxDuration?: number; // in seconds, 0 means unlimited
}

const DEFAULT_OPTIONS: AudioRecordingOptions = {
  quality: 'HIGH_QUALITY',
  autoStart: false,
  filePrefix: 'recording_',
  requestPermissionOnMount: true,
  maxDuration: 0,
};

export interface AudioRecordingHook {
  isRecording: boolean;
  recordingDuration: number;
  audioUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cleanupRecordingFile: (uri: string | null) => Promise<void>;
  permissionGranted: boolean;
  error: Error | null;
}

const useAudioRecording = (options?: AudioRecordingOptions): AudioRecordingHook => {
  const RECORDING_DIR = FileSystem.documentDirectory + 'recordings/';
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordingInstanceRef = useRef<Audio.Recording | null>(null);
  const isRequestingPermissionRef = useRef(false);
  
  // Effect to keep recordingInstanceRef updated with the latest recording object
  useEffect(() => {
    recordingInstanceRef.current = recording;
  }, [recording]);
  
  // Debug effect for recordingDuration changes
  useEffect(() => {
    logger.debug(`[useAudioRecording] recordingDuration updated: ${recordingDuration}s`);
  }, [recordingDuration]);
  
  // Robust unmount cleanup effect
  useEffect(() => {
    return () => {
      logger.info('[useAudioRecording] Component unmounting. Performing final cleanup.');
      if (timerRef.current) {
        logger.info('[useAudioRecording] Unmount: Clearing timer interval.');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Also ensure the Audio.Recording object is stopped and unloaded.
      if (recordingInstanceRef.current) {
        logger.warn('[useAudioRecording] Unmount: Stopping and unloading active Audio.Recording object.');
        recordingInstanceRef.current.stopAndUnloadAsync()
          .catch(e => logger.error('Error stopping/unloading recording on unmount', e));
        recordingInstanceRef.current = null; // Clear the ref
      }
    };
  }, []); // Empty dependency array ensures this runs only on unmount
  
  const requestPermissionsAndSetupAudioMode = useCallback(async () => {
    if (isRequestingPermissionRef.current) {
      logger.debug("[useAudioRecording] Permission request already in progress.");
      return; // Exit if a request is already happening
    }
    isRequestingPermissionRef.current = true;
    setError(null); // Clear previous errors before a new attempt

    try {
      logger.info("[useAudioRecording] Requesting audio permissions via Expo AV.");
      const { granted, status } = await Audio.requestPermissionsAsync();
      logger.info(`[useAudioRecording] Expo AV permission request result: granted=${granted}, status=${status}.`);
      
      if (granted) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        logger.info('[useAudioRecording] Audio mode set successfully after permission grant.');
        setPermissionGranted(true); // Set state to true
      } else {
        const permissionError = new Error('Audio recording permission is needed to record audio.');
        logger.warn('[useAudioRecording] Audio recording permission not granted by user.');
        setError(permissionError);
        setPermissionGranted(false); // Ensure state is false
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to request permissions or set audio mode');
      logger.error('[useAudioRecording] Catch block: Audio permission/setup error:', err);
      setError(err);
      setPermissionGranted(false); // Ensure state is false on error
    } finally {
      isRequestingPermissionRef.current = false; // Reset the flag
    }
  }, []); // Empty dependency array: this callback is stable and manages state internally.
  
  const ensureRecordingDirExists = async () => {
    if (Platform.OS !== 'web') {
      const dirInfo = await FileSystem.getInfoAsync(RECORDING_DIR);
      if (!dirInfo.exists) {
        logger.info(`Creating directory for recordings: ${RECORDING_DIR}`);
        await FileSystem.makeDirectoryAsync(RECORDING_DIR, { intermediates: true });
      }
    }
  };

  // Function to stop recording - defined early so it can be referenced in updateTimer
  const stopRecording = useCallback(async () => {
    if (!recording) {
      logger.warn('stopRecording called when no recording is active.');
      return;
    }

    logger.info('Stopping audio recording...');
    setIsRecording(false);
    
    // Calculate final duration before clearing timer and resetting refs
    const finalDuration = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    logger.info(`[useAudioRecording] Final duration: ${finalDuration}s`);
    
    // IMPORTANT: Clear timer interval BEFORE resetting startTimeRef to avoid timer ticks with startTimeRef=0
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Set the final duration and then reset startTimeRef (order matters)
    setRecordingDuration(finalDuration);
    startTimeRef.current = 0;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      logger.info(`Recording stopped. URI: ${uri}, duration: ${finalDuration}s`);
      setAudioUri(uri);
      setRecording(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop recording');
      logger.error('Failed to stop and unload recording', error);
      setError(error);
      setAudioUri(null); // Ensure URI is null on error
    }
  }, [recording]); // Only depend on recording

  // Start recording implementation
  const startRecording = useCallback(async () => {
    setError(null);
    logger.info('[useAudioRecording] Attempting to start recording...');

    // Critical check: Rely on the permissionGranted state.
    if (!permissionGranted) {
        logger.error('[useAudioRecording] startRecording: Permissions are NOT granted. Aborting recording attempt.');
        setError(new Error('Audio recording permission has not been granted. Please grant permission first.'));
        return; // Do not proceed if permissions are not already granted
    }

    if (isRecording) {
        logger.warn('[useAudioRecording] startRecording called while already recording. Ignoring call.');
        return;
    }

    try {
      // First clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      logger.info('[useAudioRecording] Ensuring recording directory exists...');
      await ensureRecordingDirExists();
      logger.info('[useAudioRecording] Setting audio mode for recording...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // Set recording options based on quality preference
      const qualityPreset = mergedOptions.quality || 'HIGH_QUALITY';
      const options: Audio.RecordingOptions = {
        ...Audio.RecordingOptionsPresets[qualityPreset],
      };
      
      if (Platform.OS === 'web') {
        options.web = { mimeType: 'audio/webm' };
      }
      
      logger.info('[useAudioRecording] Creating recording instance...');
      const { recording: newRecording } = await Audio.Recording.createAsync(options);
      setRecording(newRecording);
      
      // Reset duration and set start time BEFORE setting isRecording
      setRecordingDuration(0);
      const now = Date.now();
      startTimeRef.current = now;
      logger.info(`[useAudioRecording] Setting start time to ${now}`);
      
      setIsRecording(true);
      setAudioUri(null); // Reset previous URI

      logger.info('[useAudioRecording] Starting timer interval...');
      // Use a direct function instead of updateTimer to ensure closure has latest startTimeRef
      timerRef.current = setInterval(() => {
        const currentTime = Date.now();
        
        // Safety check: If startTimeRef is 0 or otherwise invalid, stop the timer
        if (!startTimeRef.current) {
          logger.warn('[useAudioRecording] Timer tick with invalid startTimeRef (0). Clearing interval.');
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }
        
        const elapsed = Math.floor((currentTime - startTimeRef.current) / 1000);
        logger.info(`Timer tick: current=${currentTime}, start=${startTimeRef.current}, elapsed=${elapsed}s`);
        
        // Only update the duration if we have a valid elapsed time (prevents displaying astronomical values)
        if (elapsed >= 0 && elapsed < 86400) { // Sanity check: < 24 hours
          setRecordingDuration(elapsed);
        } else {
          logger.warn(`[useAudioRecording] Invalid elapsed time calculated: ${elapsed}s. Ignoring this tick.`);
        }
        
        // Check max duration
        if (mergedOptions.maxDuration && 
            mergedOptions.maxDuration > 0 && 
            elapsed >= mergedOptions.maxDuration) {
          logger.info(`Max duration reached: ${elapsed}s, stopping`);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          stopRecording();
        }
      }, 1000);
      
      logger.info('[useAudioRecording] Started audio recording successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      logger.error('[useAudioRecording] Failed to start recording', error);
      setError(error);
      setIsRecording(false);
      startTimeRef.current = 0;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, mergedOptions.quality, mergedOptions.maxDuration, stopRecording, ensureRecordingDirExists]);

  // Function to update timer based on elapsed time
  const updateTimer = useCallback(() => {
    if (!startTimeRef.current) {
      logger.warn('[useAudioRecording] updateTimer called but startTimeRef is not set');
      return;
    }
    
    const now = Date.now();
    const elapsed = Math.floor((now - startTimeRef.current) / 1000);
    logger.info(`[useAudioRecording] Timer tick, now: ${now}, start: ${startTimeRef.current}, elapsed: ${elapsed}s`);
    
    // Update recordingDuration state with actual elapsed time
    setRecordingDuration(elapsed);
    
    // Check for max duration
    if (mergedOptions.maxDuration && 
        mergedOptions.maxDuration > 0 && 
        elapsed >= mergedOptions.maxDuration) {
      logger.info(`[useAudioRecording] Max duration of ${mergedOptions.maxDuration}s reached, stopping recording`);
      stopRecording();
    }
  }, [mergedOptions.maxDuration, stopRecording]);

  // This useEffect handles permission requests on mount and auto-start logic.
  // It relies on permissionGranted state being updated by requestPermissionsAndSetupAudioMode.
  useEffect(() => {
    let didCancel = false; // To prevent state updates on unmounted component

    const managePermissionsAndAutoStart = async () => {
      if (mergedOptions.requestPermissionOnMount && !permissionGranted) {
        // Only call if no request is currently in progress
        if (!isRequestingPermissionRef.current) {
          logger.info("[useAudioRecording] Mount/PermissionEffect: Permissions not granted and no request in progress. Initiating request.");
          // requestPermissionsAndSetupAudioMode is async but we don't need to await it here
          // as its purpose is to update state, which will cause this effect to re-run.
          requestPermissionsAndSetupAudioMode();
        } else {
          logger.debug("[useAudioRecording] Mount/PermissionEffect: Permission request already in progress. Waiting for completion.");
        }
        // Important: Return early. Let the re-run of this effect (due to permissionGranted state change) handle auto-start.
        return;
      }

      // This part of the logic runs if: 
      // 1. Permissions were already granted on mount.
      // 2. Permissions became granted after a request, and the effect re-ran.
      if (permissionGranted && mergedOptions.autoStart && !isRecording) {
        if (!didCancel) { // Check if component is still mounted
          logger.info('[useAudioRecording] Mount/PermissionEffect: Permissions granted. Auto-start conditions met. Calling startRecording.');
          startRecording(); // Not awaiting, it's a fire-and-forget from this effect's perspective
        }
      } else if (permissionGranted && mergedOptions.autoStart && isRecording) {
        logger.debug('[useAudioRecording] Mount/PermissionEffect: Permissions granted and auto-start enabled, but already recording.');
      } else if (permissionGranted && !mergedOptions.autoStart) {
        logger.debug('[useAudioRecording] Mount/PermissionEffect: Permissions granted, but auto-start is not enabled.');
      }
    };

    managePermissionsAndAutoStart();

    return () => {
      didCancel = true; // Cleanup function to set didCancel on unmount
    };
  }, [
    mergedOptions.requestPermissionOnMount,
    mergedOptions.autoStart,
    permissionGranted, // Key dependency: effect re-runs when this changes
    isRecording,
    requestPermissionsAndSetupAudioMode, // Stable callback
    startRecording // Callback, its stability depends on its own deps
  ]);

  const cleanupRecordingFile = useCallback(async (uri: string | null) => {
    if (uri && Platform.OS !== 'web') {
        try {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (fileInfo.exists) {
                logger.info(`Cleaning up temporary recording file: ${uri}`);
                await FileSystem.deleteAsync(uri);
            }
        } catch (err) {
            logger.error(`Failed to delete recording file ${uri}`, err);
        }
    }
  }, []);

  return {
    isRecording,
    recordingDuration,
    audioUri,
    startRecording,
    stopRecording,
    cleanupRecordingFile,
    permissionGranted,
    error,
  };
};

export default useAudioRecording; 