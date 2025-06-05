import React, { useEffect, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { MainTabParamList, JournalStackParamList, MainStackParamList } from './types';
import logger from '../utils/logger';
import audioPrewarmService from '../services/audioPrewarmService';

// Import our modern FloatingActionButton
import FloatingActionButton from '../components/FloatingActionButton';

import HomeScreen from '../screens/main/HomeScreen';
import JournalScreen from '../screens/main/JournalScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import JournalEntryDetailScreen from '../screens/main/JournalEntryDetailScreen';
import JournalEntryFormScreen from '../screens/main/JournalEntryFormScreen';
import ReminderFormScreen from '../screens/main/ReminderFormScreen';
import DeleteConfirmationScreen from '../screens/main/DeleteConfirmationScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const JournalStackNavigator = createStackNavigator<JournalStackParamList>();

type MainTabNavigatorProps = {
  navigation: StackNavigationProp<MainStackParamList, 'MainTabs'>;
};

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

const MainTabNavigator = ({ navigation }: MainTabNavigatorProps) => {
  const { theme } = useAppTheme();
  const styles = getNavigatorStyles(theme);

  // Pre-warm audio system when MainTabNavigator mounts
  useEffect(() => {
    const prewarmAudio = async () => {
      try {
        logger.info('[MainTabNavigator] Starting audio system prewarm...');
        await audioPrewarmService.prewarmAudioSystem();
        
        const metrics = audioPrewarmService.getPerformanceMetrics();
        logger.info('[MainTabNavigator] Audio prewarm completed:', metrics);
      } catch (error) {
        logger.error('[MainTabNavigator] Audio prewarm failed:', error);
      }
    };

    prewarmAudio();

    // Cleanup on unmount
    return () => {
      audioPrewarmService.cleanup();
    };
  }, []);

  const handleRecordPress = useCallback(() => {
    logger.info('[MainTabNavigator] FloatingActionButton pressed. Navigating to Record screen.');
    
    // Check if audio system is ready
    const isReady = audioPrewarmService.isReadyForRecording();
    if (!isReady) {
      logger.warn('[MainTabNavigator] Audio system not ready, attempting to prewarm...');
      audioPrewarmService.prewarmAudioSystem().catch(error => {
        logger.error('[MainTabNavigator] Failed to prewarm audio system:', error);
      });
    }
    
    // Navigate to the Record screen using the navigation prop from the parent StackNavigator
    navigation.navigate('Record', { startRecording: true });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.colors.tabBarActive,
          tabBarInactiveTintColor: theme.colors.tabBarInactive,
          tabBarStyle: styles.tabBarStyle,
          tabBarLabelStyle: styles.tabBarLabelStyle,
          tabBarItemStyle: styles.tabBarItemStyle,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap | undefined;
            if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'Journal') iconName = focused ? 'book' : 'book-outline';
            else if (route.name === 'Calendar') iconName = focused ? 'calendar' : 'calendar-outline';
            else if (route.name === 'Settings') iconName = focused ? 'cog' : 'cog-outline';

            if (!iconName) return <View style={{width:size, height:size}}/>;
            return <Ionicons name={iconName} size={focused ? size + 2 : size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home'}} />
        <Tab.Screen name="Journal" component={JournalStack} options={{ tabBarLabel: 'Journal'}} />
        <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: 'Calendar'}} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings'}}/>
      </Tab.Navigator>
      
      {/* Floating Action Button positioned over the tab bar */}
      <View style={styles.fabContainer}>
        <FloatingActionButton
          onPress={handleRecordPress}
          icon="mic"
          size={64}
          variant="primary"
          testID="main-record-button"
        />
      </View>
    </View>
  );
};

const getNavigatorStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarStyle: {
    backgroundColor: theme.colors.card,
    borderTopColor: theme.colors.borderLight,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 75,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadows.lg,
    // Modern floating tab bar effect
    marginHorizontal: theme.spacing.md,
    marginBottom: Platform.OS === 'ios' ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBarLabelStyle: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.medium,
    marginBottom: Platform.OS === 'ios' ? 0 : theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  tabBarItemStyle: {
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 85, // Position above tab bar
    alignSelf: 'center',
    zIndex: 1000,
  },
});

export default MainTabNavigator; 