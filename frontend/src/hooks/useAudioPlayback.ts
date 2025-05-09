import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import logger from '../utils/logger';

interface AudioPlaybackOptions {
  autoPlay?: boolean;
  onPlaybackComplete?: () => void;
}

export interface AudioPlaybackHook {
  isPlaying: boolean;
  playbackProgress: number; // 0-1 range
  playbackDuration: number; // in milliseconds
  playbackPosition: number; // in milliseconds
  playAudio: (uri: string) => Promise<void>;
  pauseAudio: () => Promise<void>;
  resumeAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  togglePlayback: (uri: string) => Promise<void>;
  error: Error | null;
}

const useAudioPlayback = (initialUri?: string, options?: AudioPlaybackOptions): AudioPlaybackHook => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const currentUri = useRef<string | null>(initialUri || null);
  
  // Initialize sound on mount if initialUri is provided
  useEffect(() => {
    if (initialUri && options?.autoPlay) {
      playAudio(initialUri).catch(err => {
        logger.error('Failed to auto-play audio', err);
      });
    }
    
    return () => {
      // Cleanup sound when component unmounts
      if (sound) {
        sound.unloadAsync().catch(e => logger.error('Error unloading sound on unmount', e));
      }
    };
  }, [initialUri]);

  // Configure status update handler
  const configurePlaybackStatusUpdate = useCallback((sound: Audio.Sound) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      
      // Update state based on playback status
      setIsPlaying(status.isPlaying);
      
      if (status.durationMillis) {
        setPlaybackDuration(status.durationMillis);
        setPlaybackProgress(status.positionMillis / status.durationMillis);
        setPlaybackPosition(status.positionMillis);
      }
      
      // Handle playback completion
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackProgress(1);
        if (options?.onPlaybackComplete) {
          options.onPlaybackComplete();
        }
      }
    });
  }, [options]);

  // Load and play audio from URI
  const playAudio = async (uri: string) => {
    try {
      setError(null);
      
      // If we have an existing sound playing, unload it first
      if (sound) {
        await sound.unloadAsync();
      }
      
      // Create and load the new sound
      logger.info(`Loading audio from URI: ${uri}`);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      setSound(newSound);
      setIsPlaying(true);
      currentUri.current = uri;
      
      // Configure status updates
      configurePlaybackStatusUpdate(newSound);
      
      // Start playback
      await newSound.playAsync();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(`Failed to play audio: ${uri}`);
      logger.error('Error playing audio', error);
      setError(error);
      setIsPlaying(false);
    }
  };

  // Pause current playback
  const pauseAudio = async () => {
    if (!sound) return;
    
    try {
      logger.info('Pausing audio playback');
      await sound.pauseAsync();
      setIsPlaying(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to pause audio');
      logger.error('Error pausing audio', error);
      setError(error);
    }
  };

  // Resume paused playback
  const resumeAudio = async () => {
    if (!sound) return;
    
    try {
      logger.info('Resuming audio playback');
      await sound.playAsync();
      setIsPlaying(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to resume audio');
      logger.error('Error resuming audio', error);
      setError(error);
    }
  };

  // Stop and unload current playback
  const stopAudio = async () => {
    if (!sound) return;
    
    try {
      logger.info('Stopping audio playback');
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      setPlaybackProgress(0);
      setPlaybackPosition(0);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop audio');
      logger.error('Error stopping audio', error);
      setError(error);
    }
  };

  // Toggle between play and pause
  const togglePlayback = async (uri: string) => {
    if (isPlaying) {
      await pauseAudio();
    } else if (currentUri.current === uri && sound) {
      await resumeAudio();
    } else {
      await playAudio(uri);
    }
  };

  return {
    isPlaying,
    playbackProgress,
    playbackDuration,
    playbackPosition,
    playAudio,
    pauseAudio,
    resumeAudio,
    stopAudio,
    togglePlayback,
    error,
  };
};

export default useAudioPlayback; 