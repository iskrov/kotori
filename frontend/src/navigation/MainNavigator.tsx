import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MainTabNavigator from './MainTabNavigator';
import RecordScreen from '../screens/main/RecordScreen';
import TagManagementScreen from '../screens/main/TagManagementScreen';
import TagDeleteConfirmationScreen from '../screens/main/TagDeleteConfirmationScreen';
import { MainStackParamList } from './types';

const Stack = createStackNavigator<MainStackParamList>();

const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Record"
        component={RecordScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TagManagement"
        component={TagManagementScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TagDeleteConfirmation"
        component={TagDeleteConfirmationScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator; 