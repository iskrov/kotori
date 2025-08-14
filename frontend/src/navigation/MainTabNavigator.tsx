import React, { useEffect, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { accessibilityTokens } from '../styles/theme';
import { MainTabParamList, MainStackParamList } from './types';
import logger from '../utils/logger';
import audioPrewarmService from '../services/audioPrewarmService';

// Import our modern FloatingActionButton
import FloatingActionButton from '../components/FloatingActionButton';

import HomeScreen from '../screens/main/HomeScreen';
import JournalScreen from '../screens/main/JournalScreen';
import ShareScreen from '../screens/ShareScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabNavigatorProps = {
  navigation: StackNavigationProp<MainStackParamList, 'MainTabs'>;
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
    navigation.navigate('Record');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary, // Teal for active tabs
          tabBarInactiveTintColor: theme.colors.textMuted, // Soft gray for inactive
          tabBarStyle: styles.tabBarStyle,
          tabBarLabelStyle: styles.tabBarLabelStyle,
          tabBarItemStyle: styles.tabBarItemStyle,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap | undefined;
            if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'Journal') iconName = focused ? 'book' : 'book-outline';
            else if (route.name === 'Share') iconName = focused ? 'share' : 'share-outline';
            else if (route.name === 'Calendar') iconName = focused ? 'calendar' : 'calendar-outline';
            else if (route.name === 'Settings') iconName = focused ? 'cog' : 'cog-outline';

            if (!iconName) return <View style={{width:size, height:size}}/>;
            return (
              <Ionicons 
                name={iconName} 
                size={24} // Fixed size for consistency
                color={color} 
                accessibilityElementsHidden={true} // Icon is decorative, label provides context
              />
            );
          },
          tabBarAccessibilityLabel: route.name,
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home', title: 'Home - Kotori' }} />
        <Tab.Screen name="Journal" component={JournalScreen} options={{ tabBarLabel: 'Journal', title: 'Journal - Kotori' }} />
        <Tab.Screen name="Share" component={ShareScreen} options={{ tabBarLabel: 'Share', tabBarAccessibilityLabel: 'Share journal summaries', title: 'Share - Kotori' }} />
        <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: 'Calendar', title: 'Calendar - Kotori' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings', title: 'Settings - Kotori' }}/>
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
    backgroundColor: theme.colors.card, // Clean white background
    borderTopColor: theme.colors.border, // Soft border color
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 90 : 85, // Increased height for better icon/text layout
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: Platform.OS === 'ios' ? 12 : 16, // Balanced padding for vertical layout
    paddingHorizontal: theme.spacing.xs, // Reduced horizontal padding to give more space to tabs
    // Remove heavy shadow, use subtle one instead
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    // Clean, non-floating design
    position: 'relative', // Remove floating effect
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBarLabelStyle: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.medium,
    marginBottom: Platform.OS === 'ios' ? 2 : 4,
    marginTop: 4,
  },
  tabBarItemStyle: {
    paddingVertical: theme.spacing.xs,
    minHeight: accessibilityTokens.minTouchTarget, // Ensure proper touch targets
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column', // Force vertical layout (icon on top, text below)
    gap: 2, // Small gap between icon and text
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 112 : 100, // Adjusted for new tab bar height
    alignSelf: 'center',
    zIndex: 1000,
  },
});

export default MainTabNavigator; 