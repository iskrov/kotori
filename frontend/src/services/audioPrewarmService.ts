import { Audio } from 'expo-av';
import logger from '../utils/logger';

interface AudioPrewarmState {
  permissionsGranted: boolean;
  audioModeConfigured: boolean;
  isPrewarmed: boolean;
  lastPrewarmTime: number;
}

/**
 * Simplified Audio Prewarm Service
 * Pre-configures audio permissions and settings for faster recording initialization
 */
class AudioPrewarmService {
  private state: AudioPrewarmState = {
    permissionsGranted: false,
    audioModeConfigured: false,
    isPrewarmed: false,
    lastPrewarmTime: 0,
  };

  private prewarmPromise: Promise<void> | null = null;

  /**
   * Main prewarm method - can be called multiple times safely
   */
  async prewarmAudioSystem(): Promise<void> {
    // If already prewarming, wait for existing operation
    if (this.prewarmPromise) {
      await this.prewarmPromise;
      return;
    }

    // If recently prewarmed (within 5 minutes), skip
    const fiveMinutes = 5 * 60 * 1000;
    if (this.state.isPrewarmed && (Date.now() - this.state.lastPrewarmTime) < fiveMinutes) {
      logger.debug('Audio system already prewarmed recently, skipping');
      return;
    }

    // Start new prewarm operation
    this.prewarmPromise = this.performPrewarm();
    
    try {
      await this.prewarmPromise;
    } finally {
      this.prewarmPromise = null;
    }
  }

  /**
   * Perform the actual prewarming operations
   */
  private async performPrewarm(): Promise<void> {
    logger.info('Starting audio system prewarm...');
    const startTime = Date.now();

    try {
      // Step 1: Request and verify permissions
      await this.prewarmPermissions();

      // Step 2: Configure audio mode
      await this.prewarmAudioMode();

      this.state.isPrewarmed = true;
      this.state.lastPrewarmTime = Date.now();

      const duration = Date.now() - startTime;
      logger.info(`Audio system prewarm completed in ${duration}ms`);
    } catch (error) {
      logger.error('Audio system prewarm failed:', error);
      this.state.isPrewarmed = false;
      throw error;
    }
  }

  /**
   * Pre-warm audio permissions
   */
  private async prewarmPermissions(): Promise<void> {
    try {
      logger.debug('Prewarming audio permissions...');
      
      // Request microphone permission
      const audioPermission = await Audio.requestPermissionsAsync();
      if (!audioPermission.granted) {
        logger.warn('Microphone permission not granted during prewarm');
        this.state.permissionsGranted = false;
        return;
      }

      this.state.permissionsGranted = true;
      logger.debug('Audio permissions prewarmed successfully');
    } catch (error) {
      logger.error('Failed to prewarm audio permissions:', error);
      this.state.permissionsGranted = false;
      throw error;
    }
  }

  /**
   * Pre-configure audio mode for optimal recording
   */
  private async prewarmAudioMode(): Promise<void> {
    try {
      logger.debug('Prewarming audio mode configuration...');
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      this.state.audioModeConfigured = true;
      logger.debug('Audio mode prewarmed successfully');
    } catch (error) {
      logger.error('Failed to prewarm audio mode:', error);
      this.state.audioModeConfigured = false;
      throw error;
    }
  }

  /**
   * Get current prewarm state
   */
  getPrewarmState(): AudioPrewarmState {
    return { ...this.state };
  }

  /**
   * Check if audio system is ready for recording
   */
  isReadyForRecording(): boolean {
    return this.state.permissionsGranted && this.state.audioModeConfigured;
  }

  /**
   * Force refresh of prewarm state
   */
  async refreshPrewarm(): Promise<void> {
    this.state.isPrewarmed = false;
    this.state.lastPrewarmTime = 0;
    await this.prewarmAudioSystem();
  }

  /**
   * Get prewarm performance metrics
   */
  getPerformanceMetrics(): {
    isPrewarmed: boolean;
    lastPrewarmTime: number;
    timeSinceLastPrewarm: number;
    readyForRecording: boolean;
  } {
    const now = Date.now();
    return {
      isPrewarmed: this.state.isPrewarmed,
      lastPrewarmTime: this.state.lastPrewarmTime,
      timeSinceLastPrewarm: this.state.lastPrewarmTime > 0 ? now - this.state.lastPrewarmTime : -1,
      readyForRecording: this.isReadyForRecording(),
    };
  }

  /**
   * Cleanup and reset prewarm state
   */
  cleanup(): void {
    this.state = {
      permissionsGranted: false,
      audioModeConfigured: false,
      isPrewarmed: false,
      lastPrewarmTime: 0,
    };
    this.prewarmPromise = null;
    logger.debug('Audio prewarm service cleaned up');
  }
}

// Export singleton instance
export const audioPrewarmService = new AudioPrewarmService();
export default audioPrewarmService; 