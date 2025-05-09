import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from './types';
import logger from '../utils/logger';

// Stack Navigation
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

const Stack = createStackNavigator<RootStackParamList>();

const Navigation = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // Log navigation state for debugging
  // console.log('[Navigation/index] Rendering - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading); // Removed diagnostic log
  useEffect(() => {
    // Keep logger.info for general state overview
    logger.info('Navigation state:', { 
      isLoading,
      isAuthenticated,
      userExists: !!user,
      platform: Platform.OS,
      isDev: __DEV__
    });
  }, [isLoading, isAuthenticated, user]);

  // While authentication state is loading, show loading indicator
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#7D4CDB" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        // User is signed in
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        // User is not signed in
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  }
});

export default Navigation; 