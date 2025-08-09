import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';
import { getDefaultLanguageCode, validateLanguageCode } from '../config/languageConfig';

// Settings interface with only functional user preferences
export interface UserSettings {
  // Language & Transcription (FUNCTIONAL)
  defaultLanguage: string; // Can be 'auto' for auto-detect or specific language code
  
  // Privacy & Security (FUNCTIONAL)
  defaultEntryPrivacy: 'public' | 'hidden';
  hiddenModeEnabled: boolean;
  
  // App Behavior (FUNCTIONAL)
  hapticFeedbackEnabled: boolean;
  
  // Notifications (FUNCTIONAL)
  notificationsEnabled: boolean;
  reminderNotifications: boolean;
  dailyReminderTime: string; // HH:MM format
  
  // Advanced (FUNCTIONAL)
  analyticsEnabled: boolean;
  crashReportsEnabled: boolean;
  
  // Additional (FUNCTIONAL)
  autoSaveEnabled: boolean;
  autoRecordingEnabled: boolean;
}

// Default settings with sensible defaults
export const DEFAULT_SETTINGS: UserSettings = {
  // Language & Transcription
  defaultLanguage: getDefaultLanguageCode(), // 'auto' for auto-detect
  
  // Privacy & Security
  defaultEntryPrivacy: 'public',
  hiddenModeEnabled: false,
  
  // App Behavior
  hapticFeedbackEnabled: true,
  
  // Notifications
  notificationsEnabled: true,
  reminderNotifications: false,
  dailyReminderTime: '20:00',
  
  // Advanced
  analyticsEnabled: true,
  crashReportsEnabled: true,
  
  // Additional
  autoSaveEnabled: true,
  autoRecordingEnabled: true,
};

const SETTINGS_STORAGE_KEY = '@kotori_user_settings';
const SETTINGS_VERSION = '1.0';

class SettingsService {
  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private initialized = false;
  private listeners: Set<(settings: UserSettings) => void> = new Set();

  /**
   * Initialize the settings service by loading stored preferences
   */
  async initialize(): Promise<UserSettings> {
    if (this.initialized) {
      return this.settings;
    }

    try {
      const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        
        // Extract just the settings object if it exists, otherwise use the whole parsed object
        const settingsToValidate = parsed.settings || parsed;
        
        // Merge with defaults to handle new settings added in updates
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...this.validateSettings(settingsToValidate),
        };
        
        logger.info('[SettingsService] Settings loaded from storage');
      } else {
        // First time - save defaults
        await this.saveSettings(this.settings);
        logger.info('[SettingsService] Initialized with default settings');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('[SettingsService] Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }

    this.initialized = true;
    return this.settings;
  }

  /**
   * Get current settings (readonly)
   */
  getSettings(): UserSettings {
    return { ...this.settings };
  }

  /**
   * Get a specific setting value
   */
  getSetting<K extends keyof UserSettings>(key: K): UserSettings[K] {
    return this.settings[key];
  }

  /**
   * Update a single setting
   */
  async updateSetting<K extends keyof UserSettings>(
    key: K, 
    value: UserSettings[K]
  ): Promise<void> {
    try {
      // Validate the setting
      const validatedValue = this.validateSingleSetting(key, value);
      
      // Update local settings
      this.settings = {
        ...this.settings,
        [key]: validatedValue,
      };

      // Persist to storage
      await this.saveSettings(this.settings);
      
      // Notify listeners
      this.notifyListeners();
      
      logger.info(`[SettingsService] Updated setting: ${String(key)} = ${value}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`[SettingsService] Failed to update setting ${String(key)}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(updates: Partial<UserSettings>): Promise<void> {
    try {
      // Validate all updates
      const validatedUpdates = this.validateSettings(updates);
      
      // Update local settings
      this.settings = {
        ...this.settings,
        ...validatedUpdates,
      };

      // Persist to storage
      await this.saveSettings(this.settings);
      
      // Notify listeners
      this.notifyListeners();
      
      logger.info('[SettingsService] Bulk settings update completed');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('[SettingsService] Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    try {
      this.settings = { ...DEFAULT_SETTINGS };
      await this.saveSettings(this.settings);
      this.notifyListeners();
      logger.info('[SettingsService] Settings reset to defaults');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('[SettingsService] Failed to reset settings:', error);
      throw error;
    }
  }

  /**
   * Export settings as JSON string
   */
  async exportSettings(): Promise<string> {
    const exportData = {
      version: SETTINGS_VERSION,
      timestamp: new Date().toISOString(),
      settings: this.settings,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import settings from JSON string
   */
  async importSettings(jsonData: string): Promise<void> {
    try {
      const imported = JSON.parse(jsonData);
      
      if (!imported.settings) {
        throw new Error('Invalid settings format - missing settings object');
      }
      
      // Validate and merge with current settings
      const validatedSettings = this.validateSettings(imported.settings);
      await this.updateSettings(validatedSettings);
      
      logger.info('[SettingsService] Settings imported successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('[SettingsService] Failed to import settings:', error);
      throw new Error('Failed to import settings: ' + error.message);
    }
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: (settings: UserSettings) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get migration recommendations for settings updates
   */
  getMigrationInfo(): { hasNewSettings: boolean; newSettings: string[] } {
    const currentKeys = Object.keys(this.settings);
    const defaultKeys = Object.keys(DEFAULT_SETTINGS);
    const newSettings = defaultKeys.filter(key => !currentKeys.includes(key));
    
    return {
      hasNewSettings: newSettings.length > 0,
      newSettings,
    };
  }

  // Private methods

  private async saveSettings(settings: UserSettings): Promise<void> {
    const settingsData = {
      version: SETTINGS_VERSION,
      timestamp: new Date().toISOString(),
      settings,
    };
    
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsData));
  }

  private validateSettings(settings: Partial<UserSettings>): Partial<UserSettings> {
    const validated: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(settings)) {
      try {
        const validatedValue = this.validateSingleSetting(
          key as keyof UserSettings, 
          value
        );
        validated[key] = validatedValue;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.warn(`[SettingsService] Invalid setting ${key}: ${error.message}, using default`);
        // Use default value for invalid settings
        const defaultValue = DEFAULT_SETTINGS[key as keyof UserSettings];
        validated[key] = defaultValue;
      }
    }
    
    return validated as Partial<UserSettings>;
  }

  private validateSingleSetting<K extends keyof UserSettings>(
    key: K, 
    value: unknown
  ): UserSettings[K] {
    switch (key) {
      case 'defaultLanguage':
        if (typeof value !== 'string' || (!validateLanguageCode(value) && value !== 'auto')) {
          throw new Error(`Invalid language code: ${value}`);
        }
        return value as UserSettings[K];
        
      case 'dailyReminderTime':
        if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
          throw new Error(`Invalid time format: ${value}`);
        }
        return value as UserSettings[K];
        
      default:
        // For boolean and other simple types, just ensure correct type
        if (typeof value !== typeof DEFAULT_SETTINGS[key]) {
          throw new Error(`Type mismatch for ${key}: expected ${typeof DEFAULT_SETTINGS[key]}, got ${typeof value}`);
        }
        return value as UserSettings[K];
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getSettings());
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('[SettingsService] Error in settings listener:', error);
      }
    });
  }
}

// Create and export singleton instance
export const settingsService = new SettingsService();

export default settingsService; 