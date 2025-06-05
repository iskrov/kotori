import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

import { AppTheme, lightModeColors, darkModeColors, typography, spacing, borderRadius, shadows, animations } from '../config/theme';

interface ThemeContextProps {
  theme: AppTheme;
  toggleTheme: () => void;
  isSystemTheme: boolean;
  setUseSystemTheme: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = Appearance.getColorScheme(); // 'light' | 'dark' | null
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [useSystemTheme, setUseSystemThemeState] = useState(true); // Default to using system theme

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem('themeMode'); // 'light', 'dark', or 'system'
        if (savedThemeMode) {
          if (savedThemeMode === 'system') {
            setUseSystemThemeState(true);
            setIsDarkMode(systemColorScheme === 'dark');
          } else {
            setUseSystemThemeState(false);
            setIsDarkMode(savedThemeMode === 'dark');
          }
        } else {
          // If no preference saved, default to system theme
          setUseSystemThemeState(true);
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.error('Failed to load theme preference from storage', error);
        // Fallback to system theme on error
        setUseSystemThemeState(true);
        setIsDarkMode(systemColorScheme === 'dark');
      }
    };
    loadThemePreference();
  }, [systemColorScheme]);

  useEffect(() => {
    // Listener for system theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (useSystemTheme) {
        setIsDarkMode(colorScheme === 'dark');
      }
    });
    return () => subscription.remove();
  }, [useSystemTheme]);

  const toggleTheme = async () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    setUseSystemThemeState(false); // Manual toggle means not following system theme anymore
    try {
      await AsyncStorage.setItem('themeMode', newIsDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save theme mode to storage', error);
    }
  };

  const setUseSystemTheme = async (value: boolean) => {
    setUseSystemThemeState(value);
    if (value) {
      setIsDarkMode(systemColorScheme === 'dark');
      try {
        await AsyncStorage.setItem('themeMode', 'system');
      } catch (error) {
        console.error('Failed to save theme mode (system) to storage', error);
      }
    } else {
      // If switching off system theme, retain current manual theme (light/dark)
      // The toggleTheme function or an explicit set (light/dark) will handle AsyncStorage for non-system themes
      // For simplicity, we can re-save current explicit choice if user toggles system off.
      try {
        await AsyncStorage.setItem('themeMode', isDarkMode ? 'dark' : 'light');
      } catch (error) {
        console.error('Failed to save theme mode (manual) to storage', error);
      }
    }
  };
  
  const currentThemeColors = isDarkMode ? darkModeColors : lightModeColors;
  const theme: AppTheme = {
    colors: currentThemeColors,
    typography,
    spacing,
    borderRadius,
    shadows,
    animations,
    isDarkMode,
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isSystemTheme: useSystemTheme, setUseSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}; 