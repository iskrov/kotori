import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import settingsService, { UserSettings, DEFAULT_SETTINGS } from '../services/settingsService';
import notificationService from '../services/notificationService';
import logger from '../utils/logger';

interface SettingsContextValue {
  settings: UserSettings;
  isLoading: boolean;
  error: string | null;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  exportSettings: () => Promise<string>;
  importSettings: (jsonData: string) => Promise<void>;
  getSetting: <K extends keyof UserSettings>(key: K) => UserSettings[K];
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize settings on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const loadedSettings = await settingsService.initialize();
        setSettings(loadedSettings);
        
        logger.info('[SettingsContext] Settings initialized successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize settings';
        logger.error('[SettingsContext] Settings initialization failed:', err);
        setError(errorMessage);
        
        // Fallback to defaults on error
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, []);

  // Subscribe to settings changes from the service
  useEffect(() => {
    const unsubscribe = settingsService.subscribe((updatedSettings) => {
      setSettings(updatedSettings);
      logger.debug('[SettingsContext] Settings updated via subscription');
    });

    return unsubscribe;
  }, []);

  // Update a single setting
  const updateSetting = async <K extends keyof UserSettings>(
    key: K, 
    value: UserSettings[K]
  ): Promise<void> => {
    try {
      setError(null);
      await settingsService.updateSetting(key, value);
      
      // Update notification settings if notification-related settings changed
      if (key === 'notificationsEnabled' || key === 'reminderNotifications' || key === 'dailyReminderTime') {
        await notificationService.updateNotificationSettings();
        logger.info(`[SettingsContext] Updated notification settings after ${key} change`);
      }
      
      // Settings will be updated via subscription
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to update ${key}`;
      logger.error(`[SettingsContext] Failed to update setting ${key}:`, err);
      setError(errorMessage);
      throw err; // Re-throw for component error handling
    }
  };

  // Update multiple settings
  const updateSettings = async (updates: Partial<UserSettings>): Promise<void> => {
    try {
      setError(null);
      await settingsService.updateSettings(updates);
      // Settings will be updated via subscription
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      logger.error('[SettingsContext] Failed to update settings:', err);
      setError(errorMessage);
      throw err; // Re-throw for component error handling
    }
  };

  // Reset all settings to defaults
  const resetToDefaults = async (): Promise<void> => {
    try {
      setError(null);
      await settingsService.resetToDefaults();
      // Settings will be updated via subscription
      logger.info('[SettingsContext] Settings reset to defaults');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      logger.error('[SettingsContext] Failed to reset settings:', err);
      setError(errorMessage);
      throw err; // Re-throw for component error handling
    }
  };

  // Export settings
  const exportSettings = async (): Promise<string> => {
    try {
      setError(null);
      const exportData = await settingsService.exportSettings();
      logger.info('[SettingsContext] Settings exported successfully');
      return exportData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export settings';
      logger.error('[SettingsContext] Failed to export settings:', err);
      setError(errorMessage);
      throw err; // Re-throw for component error handling
    }
  };

  // Import settings
  const importSettings = async (jsonData: string): Promise<void> => {
    try {
      setError(null);
      await settingsService.importSettings(jsonData);
      // Settings will be updated via subscription
      logger.info('[SettingsContext] Settings imported successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import settings';
      logger.error('[SettingsContext] Failed to import settings:', err);
      setError(errorMessage);
      throw err; // Re-throw for component error handling
    }
  };

  // Get a specific setting value
  const getSetting = <K extends keyof UserSettings>(key: K): UserSettings[K] => {
    return settings[key];
  };

  const contextValue: SettingsContextValue = {
    settings,
    isLoading,
    error,
    updateSetting,
    updateSettings,
    resetToDefaults,
    exportSettings,
    importSettings,
    getSetting,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext; 