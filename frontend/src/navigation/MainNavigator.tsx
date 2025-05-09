import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useAppTheme } from '../contexts/ThemeContext';

import HomeScreen from '../screens/main/HomeScreen';
import JournalScreen from '../screens/main/JournalScreen';
import RecordScreen from '../screens/main/RecordScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import JournalEntryDetailScreen from '../screens/main/JournalEntryDetailScreen';
import JournalEntryFormScreen from '../screens/main/JournalEntryFormScreen';
import ReminderFormScreen from '../screens/main/ReminderFormScreen';
import { RootStackParamList } from './types';

// Define ParamList for the Journal Stack
type JournalStackParamList = {
  JournalList: undefined;
  JournalEntryDetail: { journalId: string };
  JournalEntryForm: { journalId?: string } | undefined; // For new or edit
  ReminderForm: { reminderId?: string } | undefined; // For new or edit
};

// Define ParamList for the Main Tabs (using names from Tab.Screen)
type MainTabParamList = {
  Home: undefined;
  Journal: { screen?: keyof JournalStackParamList }; // Allow navigating to nested screens
  Record: { startRecording?: boolean } | undefined; // Add param for triggering recording
  Calendar: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<JournalStackParamList>();

// Journal stack for nested navigation
const JournalStack = () => {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.card,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          color: theme.colors.text,
        },
      }}
    >
      <Stack.Screen 
        name="JournalList" 
        component={JournalScreen} 
        options={{ title: 'Journal Entries' }}
      />
      <Stack.Screen 
        name="JournalEntryDetail" 
        component={JournalEntryDetailScreen} 
        options={{ title: 'Journal Entry' }}
      />
      <Stack.Screen 
        name="JournalEntryForm" 
        component={JournalEntryFormScreen} 
        options={({ route }) => ({ 
          title: route.params?.journalId ? 'Edit Entry' : 'New Entry'
        })}
      />
      <Stack.Screen 
        name="ReminderForm" 
        component={ReminderFormScreen} 
        options={({ route }) => ({ 
          title: route.params?.reminderId ? 'Edit Reminder' : 'New Reminder'
        })}
      />
    </Stack.Navigator>
  );
};

const MainNavigator = () => {
  const { theme } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: theme.colors.card,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          color: theme.colors.text,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap | undefined;
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Journal') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Record') {
            iconName = focused ? 'mic' : 'mic-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textDisabled,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen 
        name="Journal" 
        component={JournalStack} 
        options={{ headerShown: false, title: 'Journal' }}
      />
      <Tab.Screen 
        name="Record" 
        component={RecordScreen} 
        options={{ 
          title: 'Record',
          tabBarLabel: () => null,
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ 
              position: 'absolute', 
              bottom: 10,
              height: 60, 
              width: 60, 
              borderRadius: 30, 
              backgroundColor: theme.colors.primary,
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: theme.colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}>
              <Ionicons 
                name={'mic'}
                size={size * 1.2} 
                color={theme.colors.onPrimary}
              />
            </View>
          )
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Prevent default action
            e.preventDefault();
            // Navigate to Record screen with param
            navigation.navigate('Record', { startRecording: true });
          },
        })}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
};

export default MainNavigator; 