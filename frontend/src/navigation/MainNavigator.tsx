import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MainTabNavigator from './MainTabNavigator';
import RecordScreen from '../screens/main/RecordScreen';
import TagManagementScreen from '../screens/main/TagManagementScreen';
import TagDeleteConfirmationScreen from '../screens/main/TagDeleteConfirmationScreen';
import JournalEntryDetailScreen from '../screens/main/JournalEntryDetailScreen';
import JournalEntryFormScreen from '../screens/main/JournalEntryFormScreen';
import ReminderFormScreen from '../screens/main/ReminderFormScreen';
import DeleteConfirmationScreen from '../screens/main/DeleteConfirmationScreen';
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
      <Stack.Screen
        name="JournalEntryDetail"
        component={JournalEntryDetailScreen}
        options={{
          headerShown: false, // Custom header in component
        }}
      />
      <Stack.Screen
        name="JournalEntryForm"
        component={JournalEntryFormScreen}
        options={{
          headerShown: true,
          title: 'Edit Entry',
          headerStyle: { backgroundColor: '#f8f9fa' },
          headerTintColor: '#333',
        }}
      />
      <Stack.Screen
        name="ReminderForm"
        component={ReminderFormScreen}
        options={{
          headerShown: true,
          title: 'Reminder',
          headerStyle: { backgroundColor: '#f8f9fa' },
          headerTintColor: '#333',
        }}
      />
      <Stack.Screen
        name="DeleteConfirmation"
        component={DeleteConfirmationScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Delete Entry',
          headerStyle: { backgroundColor: '#f8f9fa' },
          headerTintColor: '#333',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator; 