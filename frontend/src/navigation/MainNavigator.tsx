import React, { useCallback } from 'react';
import { createBottomTabNavigator, BottomTabBarButtonProps, BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity, Image } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { MainStackParamList, JournalStackParamList } from './types';

import HomeScreen from '../screens/main/HomeScreen';
import JournalScreen from '../screens/main/JournalScreen';
import RecordScreen from '../screens/main/RecordScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import JournalEntryDetailScreen from '../screens/main/JournalEntryDetailScreen';
import JournalEntryFormScreen from '../screens/main/JournalEntryFormScreen';
import ReminderFormScreen from '../screens/main/ReminderFormScreen';

const Tab = createBottomTabNavigator<MainStackParamList>();
const JournalStackNavigator = createStackNavigator<JournalStackParamList>();

const JournalStack = () => {
  const { theme } = useAppTheme();

  return (
    <JournalStackNavigator.Navigator
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
      <JournalStackNavigator.Screen 
        name="JournalList" 
        component={JournalScreen} 
        options={{ title: 'Journal Entries' }}
      />
      <JournalStackNavigator.Screen 
        name="JournalEntryDetail" 
        component={JournalEntryDetailScreen} 
        options={{ title: 'Journal Entry' }}
      />
      <JournalStackNavigator.Screen 
        name="JournalEntryForm" 
        component={JournalEntryFormScreen} 
        options={({ route }) => ({ 
          title: route.params?.journalId ? 'Edit Entry' : 'New Entry'
        })}
      />
      <JournalStackNavigator.Screen 
        name="ReminderForm" 
        component={ReminderFormScreen} 
        options={({ route }) => ({ 
          title: route.params?.reminderId ? 'Edit Reminder' : 'New Reminder'
        })}
      />
    </JournalStackNavigator.Navigator>
  );
};

const MainNavigator = () => {
  const { theme } = useAppTheme();

  const getRecordScreenOptions = useCallback((
    { navigation }: { navigation: BottomTabNavigationProp<MainStackParamList, 'Record'> }
  ) => {
    const TabBarButtonComponent = (props: BottomTabBarButtonProps) => (
        <TouchableOpacity
            {...props}
            style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center', 
            }}
            onPress={() => navigation.navigate('Record', { startRecording: true })}
        >
            <View style={{
                position: 'absolute',
                bottom: 10,
                height: 60,
                width: 60,
                borderRadius: 30,
                backgroundColor: theme.colors.card,
                justifyContent: 'center', 
                alignItems: 'center',
                shadowColor: theme.colors.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 2.0,
                elevation: 3,
            }}>
                <Image 
                    source={require('../assets/vibes_logo_bw.png')} 
                    style={{ 
                        width: 40,
                        height: 40,
                        // tintColor: theme.colors.primary // Temporarily removed
                    }}
                    resizeMode="contain"
                />
            </View>
        </TouchableOpacity>
    );

    return {
        title: 'Record',
        tabBarButton: TabBarButtonComponent,
    };
  }, [theme]);

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
            // iconName = 'help-circle-outline'; // This was for debugging
            // Restore original fallback:
            return <Image source={require('../assets/vibes_logo_bw.png')} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />;
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          if (!iconName) return null;

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textDisabled,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: 60,
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
        options={getRecordScreenOptions}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
};

export default MainNavigator; 