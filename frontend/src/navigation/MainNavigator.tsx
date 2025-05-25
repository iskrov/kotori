import React, { useCallback } from 'react';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Image } from 'react-native';
import { useNavigation, TabActions } from '@react-navigation/native';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { MainStackParamList, JournalStackParamList, RootStackParamList } from './types';
import logger from '../utils/logger';

import HomeScreen from '../screens/main/HomeScreen';
import JournalScreen from '../screens/main/JournalScreen';
import RecordScreen from '../screens/main/RecordScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import JournalEntryDetailScreen from '../screens/main/JournalEntryDetailScreen';
import JournalEntryFormScreen from '../screens/main/JournalEntryFormScreen';
import ReminderFormScreen from '../screens/main/ReminderFormScreen';
import DeleteConfirmationScreen from '../screens/main/DeleteConfirmationScreen';

const Tab = createBottomTabNavigator<MainStackParamList>();
const JournalStackNavigator = createStackNavigator<JournalStackParamList>();

const JournalStack = () => {
  const { theme } = useAppTheme();

  return (
    <JournalStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { color: theme.colors.text, fontFamily: theme.typography.fontFamilies.bold },
      }}
    >
      <JournalStackNavigator.Screen 
        name="JournalList" 
        component={JournalScreen} 
        options={{ title: 'Journal' }}
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
      <JournalStackNavigator.Screen 
        name="DeleteConfirmation" 
        component={DeleteConfirmationScreen} 
        options={{ title: 'Delete Entry' }}
      />
    </JournalStackNavigator.Navigator>
  );
};

const MainNavigator = () => {
  const { theme } = useAppTheme();
  const styles = getNavigatorStyles(theme);
  const navigation = useNavigation();

  const CustomRecordButton = useCallback(
    ({ children }: BottomTabBarButtonProps) => (
      <TouchableOpacity
        style={styles.recordTabButton}
        onPress={() => {
          logger.info('[MainNavigator] CustomRecordButton pressed. Navigating to Record screen with startRecording: true.');
          navigation.dispatch(
            TabActions.jumpTo('Record', { 
              startRecording: true, 
              journalId: undefined
            })
          );
        }}
      >
        <View style={styles.recordButtonInner}>
          <Image 
            source={require('../assets/vibes_button_transparent.png')} 
            style={styles.recordButtonImage} 
            resizeMode="contain" 
          />
        </View>
      </TouchableOpacity>
    ),
    [theme, styles, navigation]
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textDisabled,
        tabBarStyle: styles.tabBarStyle,
        tabBarLabelStyle: styles.tabBarLabelStyle,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap | undefined;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Journal') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Calendar') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Settings') iconName = focused ? 'cog' : 'cog-outline';
          
          if (route.name === 'Record') return null;

          if (!iconName) return <View style={{width:size, height:size}}/>;
          return <Ionicons name={iconName} size={focused ? size + 2 : size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home'}} />
      <Tab.Screen name="Journal" component={JournalStack} options={{ tabBarLabel: 'Journal'}} />
      <Tab.Screen 
        name="Record" 
        component={RecordScreen} 
        options={{
          tabBarLabel: () => null,
          tabBarButton: (props) => <CustomRecordButton {...props} />,
        }}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: 'Calendar'}} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings'}}/>
    </Tab.Navigator>
  );
};

const getNavigatorStyles = (theme: AppTheme) => StyleSheet.create({
  tabBarStyle: {
    backgroundColor: theme.colors.card,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 80 : 70,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  tabBarLabelStyle: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.regular,
    marginBottom: Platform.OS === 'ios' ? 0 : theme.spacing.sm,
  },
  recordTabButton: {
    top: -25,
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    ...(Platform.OS === 'android' && {
      position: 'absolute',
      left: '50%',
      marginLeft: -35,
      bottom: 15,
    })
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonImage: {
    width: 35,
    height: 35,
    tintColor: theme.colors.white,
  },
});

export default MainNavigator; 