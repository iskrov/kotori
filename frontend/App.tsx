import React, { useEffect, useState, ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LogBox, View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

import { AuthProvider } from './src/contexts/AuthContext';
import Navigation from './src/navigation';
import logger from './src/utils/logger';

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

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  // Log environment info for debugging
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

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Initializing app...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <NavigationContainer
              onStateChange={() => {
                if (__DEV__) {
                  logger.debug('Navigation state changed');
                }
              }}
              fallback={
                <View style={styles.loadingContainer}>
                  <Text>Loading navigation...</Text>
                </View>
              }
            >
              <Navigation />
              <StatusBar style="auto" />
            </NavigationContainer>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
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