import { Platform, Vibration } from 'react-native';
import logger from '../utils/logger';

// Import settings service to check if haptic feedback is enabled
import settingsService from './settingsService';

export enum HapticFeedbackType {
  Selection = 'selection',
  ImpactLight = 'impactLight',
  ImpactMedium = 'impactMedium',
  ImpactHeavy = 'impactHeavy',
  NotificationSuccess = 'notificationSuccess',
  NotificationWarning = 'notificationWarning',
  NotificationError = 'notificationError',
}

class HapticService {
  private expoHaptics: any = null;
  private initialized = false;

  /**
   * Initialize the haptic service by trying to load Expo Haptics
   */
  private async initialize() {
    if (this.initialized) return;

    try {
      if (Platform.OS !== 'web') {
        // Try to import Expo Haptics
        const { Haptics } = require('expo-haptics');
        this.expoHaptics = Haptics;
        logger.info('[HapticService] Expo Haptics initialized successfully');
      } else {
        logger.info('[HapticService] Web platform - haptics not supported');
      }
    } catch (error) {
      logger.warn('[HapticService] Expo Haptics not available, will use fallback vibration');
    }

    this.initialized = true;
  }

  /**
   * Check if haptic feedback is enabled in user settings
   */
  private async isHapticEnabled(): Promise<boolean> {
    try {
      const settings = await settingsService.getSettings();
      return settings.hapticFeedbackEnabled;
    } catch (error) {
      logger.warn('[HapticService] Failed to get haptic setting, defaulting to enabled');
      return true; // Default to enabled if we can't get settings
    }
  }

  /**
   * Trigger haptic feedback of the specified type
   */
  async impact(type: HapticFeedbackType = HapticFeedbackType.ImpactMedium): Promise<void> {
    try {
      await this.initialize();

      // Check if haptic feedback is enabled
      const isEnabled = await this.isHapticEnabled();
      if (!isEnabled) {
        logger.debug('[HapticService] Haptic feedback disabled in settings');
        return;
      }

      if (Platform.OS === 'web') {
        // Web doesn't support haptics
        return;
      }

      if (this.expoHaptics) {
        // Use Expo Haptics if available
        await this.triggerExpoHaptic(type);
      } else {
        // Fallback to basic vibration
        this.triggerVibrationFallback(type);
      }

      logger.debug(`[HapticService] Haptic feedback triggered: ${type}`);
    } catch (error) {
      logger.error('[HapticService] Failed to trigger haptic feedback:', error);
    }
  }

  /**
   * Trigger haptic feedback using Expo Haptics
   */
  private async triggerExpoHaptic(type: HapticFeedbackType): Promise<void> {
    if (!this.expoHaptics) return;

    switch (type) {
      case HapticFeedbackType.Selection:
        await this.expoHaptics.selectionAsync();
        break;
      case HapticFeedbackType.ImpactLight:
        await this.expoHaptics.impactAsync(this.expoHaptics.ImpactFeedbackStyle.Light);
        break;
      case HapticFeedbackType.ImpactMedium:
        await this.expoHaptics.impactAsync(this.expoHaptics.ImpactFeedbackStyle.Medium);
        break;
      case HapticFeedbackType.ImpactHeavy:
        await this.expoHaptics.impactAsync(this.expoHaptics.ImpactFeedbackStyle.Heavy);
        break;
      case HapticFeedbackType.NotificationSuccess:
        await this.expoHaptics.notificationAsync(this.expoHaptics.NotificationFeedbackType.Success);
        break;
      case HapticFeedbackType.NotificationWarning:
        await this.expoHaptics.notificationAsync(this.expoHaptics.NotificationFeedbackType.Warning);
        break;
      case HapticFeedbackType.NotificationError:
        await this.expoHaptics.notificationAsync(this.expoHaptics.NotificationFeedbackType.Error);
        break;
      default:
        await this.expoHaptics.impactAsync(this.expoHaptics.ImpactFeedbackStyle.Medium);
    }
  }

  /**
   * Fallback to basic vibration when Expo Haptics is not available
   */
  private triggerVibrationFallback(type: HapticFeedbackType): void {
    let duration: number;

    switch (type) {
      case HapticFeedbackType.Selection:
        duration = 20;
        break;
      case HapticFeedbackType.ImpactLight:
        duration = 30;
        break;
      case HapticFeedbackType.ImpactMedium:
        duration = 50;
        break;
      case HapticFeedbackType.ImpactHeavy:
        duration = 80;
        break;
      case HapticFeedbackType.NotificationSuccess:
        duration = 100;
        break;
      case HapticFeedbackType.NotificationWarning:
        duration = 150;
        break;
      case HapticFeedbackType.NotificationError:
        duration = 200;
        break;
      default:
        duration = 50;
    }

    Vibration.vibrate(duration);
  }

  /**
   * Convenience methods for common haptic feedback types
   */
  async selection(): Promise<void> {
    return this.impact(HapticFeedbackType.Selection);
  }

  async light(): Promise<void> {
    return this.impact(HapticFeedbackType.ImpactLight);
  }

  async medium(): Promise<void> {
    return this.impact(HapticFeedbackType.ImpactMedium);
  }

  async heavy(): Promise<void> {
    return this.impact(HapticFeedbackType.ImpactHeavy);
  }

  async success(): Promise<void> {
    return this.impact(HapticFeedbackType.NotificationSuccess);
  }

  async warning(): Promise<void> {
    return this.impact(HapticFeedbackType.NotificationWarning);
  }

  async error(): Promise<void> {
    return this.impact(HapticFeedbackType.NotificationError);
  }
}

// Export singleton instance
const hapticService = new HapticService();
export default hapticService; 