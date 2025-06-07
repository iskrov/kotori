import React, { useEffect, useState, ReactNode } from 'react';
import { StatusBar, StatusBarStyle } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LogBox, View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

import { AuthProvider } from './src/contexts/AuthContext';
import Navigation from './src/navigation';
import logger from './src/utils/logger';
import { ThemeProvider, useAppTheme } from './src/contexts/ThemeContext';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { HiddenModeProvider } from './src/contexts/HiddenModeContext';
// import { initializeAppInsights } from './src/services/appInsights'; // Commented out to fix linter error

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error boundary component
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('App error boundary caught error:', { error, errorInfo });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong!</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.toString() || 'An unexpected error occurred.'}
          </Text>
          <Text style={styles.errorHint}>Please reload the application.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Ignore specific warnings
LogBox.ignoreLogs([
  'AsyncStorage has been extracted from react-native',
  'Possible Unhandled Promise Rejection',
  'Require cycle:',
  // Add any other warnings you want to suppress
]);

// This component will now use the theme context
const AppContent = () => {
  const { theme } = useAppTheme(); // Get theme from context
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      logger.info('Running in development mode', {
        platform: Platform.OS,
        version: Platform.Version,
        constants: Constants.expoConfig?.extra
      });
    }
    setIsInitialized(true);
  }, []);

  // Map theme.colors.statusBar to StatusBarStyle
  let statusBarStyle: StatusBarStyle = 'auto';
  if (theme.colors.statusBar === 'dark-content') {
    statusBarStyle = 'dark';
  } else if (theme.colors.statusBar === 'light-content') {
    statusBarStyle = 'light';
  }

  if (!isInitialized) {
    // Use StyleSheet for initial loading to avoid theme dependency before provider
    const initialStyles = StyleSheet.create({
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#FFFFFF', // Default light background before theme loads
        }
    });
    return (
      <View style={initialStyles.loadingContainer}>
        <Text>Initializing app...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <SettingsProvider>
            <HiddenModeProvider>
              <NavigationContainer
                onStateChange={() => {
                  if (__DEV__) {
                    logger.debug('Navigation state changed');
                  }
                }}
                fallback={
                  // Use StyleSheet for initial loading
                  <View style={styles.loadingContainer}> 
                    <Text>Loading navigation...</Text>
                  </View>
                }
              >
                <Navigation />
                <StatusBar style={statusBarStyle} /> {/* Use mapped style */}
              </NavigationContainer>
            </HiddenModeProvider>
          </SettingsProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default function App() {
  // initializeAppInsights(); // Commented out

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <SettingsProvider>
            <HiddenModeProvider>
              <AppContent />
            </HiddenModeProvider>
          </SettingsProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// styles in App.tsx can remain for ErrorBoundary or truly global styles not covered by theme provider initially
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor will be set by theme once AppContent loads,
    // or use a default like in AppContent's initial loading state.
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa', // This could also become theme.colors.background if ErrorBoundary is themed
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c', // This could also become theme.colors.error
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 14,
    color: '#666',
  },
});