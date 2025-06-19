import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { AppTheme } from '../../config/theme';
import { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { SUPPORTED_LANGUAGES } from '../../config/languageConfig';
import logger from '../../utils/logger';
import SafeScrollView from '../../components/SafeScrollView';
import { SettingsSkeleton } from '../../components/SkeletonLoader';

// Settings components
import SettingsRow from '../../components/settings/SettingsRow';
import SettingsToggle from '../../components/settings/SettingsToggle';
import SettingsSelector from '../../components/settings/SettingsSelector';
import SettingsSection from '../../components/settings/SettingsSection';

interface SettingsOption {
  value: string;
  label: string;
  subtitle?: string;
}

type SettingsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Settings'>,
  StackNavigationProp<MainStackParamList>
>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isSystemTheme, setUseSystemTheme } = useAppTheme();
  const { settings, updateSetting, isLoading } = useSettings();
  const styles = getStyles(theme);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Scroll to top functionality
  const scrollViewRef = React.useRef<any>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollToTopOpacity = React.useRef(new Animated.Value(0)).current;
  
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const shouldShow = scrollY > 200;
    
    if (shouldShow !== showScrollToTop) {
      setShowScrollToTop(shouldShow);
      Animated.timing(scrollToTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };
  
  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <SettingsSkeleton />
      </View>
    );
  }

  // Language options for selector
  const languageOptions: SettingsOption[] = SUPPORTED_LANGUAGES.map(lang => ({
    value: lang.code,
    label: lang.name,
    subtitle: lang.region ? `${lang.region}` : undefined,
  }));

  // Add auto-detect option at the top
  languageOptions.unshift({
    value: 'auto',
    label: 'Auto-detect',
    subtitle: 'Automatically detect language',
  });

  const handleSignOut = async () => {
    // For web platform, use window.confirm instead of Alert.alert
    const confirmed = window.confirm('Are you sure you want to sign out?');
    
    if (confirmed) {
      try {
        logger.info('[SettingsScreen] User confirmed sign out');
        await logout();
        logger.info('[SettingsScreen] User signed out successfully');
      } catch (error) {
        logger.error('[SettingsScreen] Error during sign out:', error);
        window.alert('Failed to sign out. Please try again.');
      }
    }
  };

  // Handle pull-to-refresh
  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    // Simulate refresh by resetting the refresh state
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, []);

  return (
    <View style={styles.container}>
      <SafeScrollView 
        ref={scrollViewRef}
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Profile Section */}
      <SettingsSection
        title="Profile"
        subtitle="Manage your account and preferences"
        icon="person"
      >
        <SettingsRow
          title="Account"
          subtitle={user?.email || 'No email available'}
          leftIcon="mail"
          rightElement={
            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          }
        />

        <SettingsRow
          title="Sign Out"
          subtitle="Sign out of your account"
          leftIcon="log-out"
          onPress={handleSignOut}
          showChevron={true}
        />
      </SettingsSection>

      {/* Language & Transcription Section */}
      <SettingsSection
        title="Language & Transcription"
        subtitle="Voice recognition preferences"
        icon="language"
      >
        <SettingsSelector
          title="Default Language"
          subtitle="Language for voice transcription"
          leftIcon="globe"
          options={languageOptions}
          selectedValue={settings.defaultLanguage}
          onValueChange={(value) => updateSetting('defaultLanguage', value)}
        />
      </SettingsSection>

      {/* Privacy & Security Section */}
      <SettingsSection
        title="Privacy & Security"
        subtitle="Protect your data and privacy"
        icon="shield-checkmark"
      >
        <SettingsRow
          title="Tags"
          subtitle="Manage regular and privacy tags"
          leftIcon="pricetag"
          onPress={() => navigation.navigate('TagManagement')}
          showChevron={true}
        />

        <SettingsRow
          title="Hidden Mode Status"
          subtitle={settings.hiddenModeEnabled ? "Configured" : "Not configured"}
          leftIcon="eye-off"
          rightElement={
            <Text style={[styles.statusText, { 
              color: settings.hiddenModeEnabled ? theme.colors.success : theme.colors.textSecondary 
            }]}>
              {settings.hiddenModeEnabled ? "Active" : "Inactive"}
            </Text>
          }
        />

        <SettingsToggle
          title="Default Entry Privacy"
          subtitle="New entries are hidden by default"
          leftIcon="lock-closed"
          value={settings.defaultEntryPrivacy === 'hidden'}
          onValueChange={(value) => updateSetting('defaultEntryPrivacy', value ? 'hidden' : 'public')}
        />

        <SettingsToggle
          title="Analytics"
          subtitle="Help improve the app"
          leftIcon="analytics"
          value={settings.analyticsEnabled}
          onValueChange={(value) => updateSetting('analyticsEnabled', value)}
        />

        <SettingsToggle
          title="Crash Reports"
          subtitle="Send crash reports to developers"
          leftIcon="bug"
          value={settings.crashReportsEnabled}
          onValueChange={(value) => updateSetting('crashReportsEnabled', value)}
        />
      </SettingsSection>

      {/* App Settings Section */}
      <SettingsSection
        title="App Settings"
        subtitle="Customize app behavior and appearance"
        icon="settings"
      >
        <SettingsToggle
          title="Dark Mode"
          subtitle={isSystemTheme ? "Following system setting" : "Manual override"}
          leftIcon="moon"
          value={theme.isDarkMode}
          onValueChange={() => {
            if (isSystemTheme) setUseSystemTheme(false);
            toggleTheme();
          }}
          disabled={isSystemTheme}
        />
        
        <SettingsToggle
          title="Use System Theme"
          subtitle="Follow device theme setting"
          leftIcon="phone-portrait"
          value={isSystemTheme}
          onValueChange={setUseSystemTheme}
        />

        <SettingsSection title="App Behavior">
          <SettingsToggle
            title="Haptic Feedback"
            subtitle="Enable subtle vibrations for interactions"
            leftIcon="pulse-outline"
            value={settings.hapticFeedbackEnabled}
            onValueChange={(value) =>
              updateSetting('hapticFeedbackEnabled', value)
            }
          />
          <SettingsToggle
            title="Auto-Save Entry"
            subtitle="Automatically save during recording"
            leftIcon="save-outline"
            value={settings.autoSaveEnabled}
            onValueChange={(value) =>
              updateSetting('autoSaveEnabled', value)
            }
          />
          <SettingsToggle
            title="Auto-Start Recording"
            subtitle="Automatically start recording when opening record screen"
            leftIcon="mic-outline"
            value={settings.autoRecordingEnabled}
            onValueChange={(value) =>
              updateSetting('autoRecordingEnabled', value)
            }
          />
        </SettingsSection>
      </SettingsSection>

      {/* Notifications Section */}
      <SettingsSection
        title="Notifications"
        subtitle="Manage notification preferences"
        icon="notifications"
      >
        <SettingsToggle
          title="Push Notifications"
          subtitle="Receive app notifications"
          leftIcon="notifications"
          value={settings.notificationsEnabled}
          onValueChange={(value) => updateSetting('notificationsEnabled', value)}
        />

        <SettingsToggle
          title="Daily Reminders"
          subtitle="Reminder to write in your journal"
          leftIcon="time"
          value={settings.reminderNotifications}
          onValueChange={(value) => updateSetting('reminderNotifications', value)}
        />

        {settings.reminderNotifications && (
          <SettingsRow
            title="Reminder Time"
            subtitle={`Daily reminder at ${settings.dailyReminderTime}`}
            leftIcon="alarm"
            rightElement={
              <Text style={styles.timeText}>{settings.dailyReminderTime}</Text>
            }
            onPress={() => {
              // TODO: Implement time picker
              Alert.alert('Coming Soon', 'Time picker will be available in a future update.');
            }}
            showChevron={true}
          />
        )}
      </SettingsSection>

      {/* About Section */}
      <SettingsSection
        title="About"
        subtitle="App information and legal"
        icon="information-circle"
      >
        <SettingsRow
          title="Version"
          subtitle="Current app version"
          leftIcon="code-working"
          rightElement={
            <Text style={styles.versionText}>1.0.0</Text>
          }
        />

        <SettingsRow
          title="Privacy Policy"
          subtitle="View our privacy policy"
          leftIcon="document-text"
          onPress={() => {
            Alert.alert('Privacy Policy', 'Privacy policy will be available soon.');
          }}
          showChevron={true}
        />

        <SettingsRow
          title="Terms of Service"
          subtitle="View terms and conditions"
          leftIcon="document"
          onPress={() => {
            Alert.alert('Terms of Service', 'Terms of service will be available soon.');
          }}
          showChevron={true}
        />
      </SettingsSection>

      {/* Bottom spacing */}
      <View style={styles.bottomSpacing} />
    </SafeScrollView>
    
    {/* Scroll to top button */}
    <Animated.View 
      style={[
        styles.scrollToTopButton,
        {
          opacity: scrollToTopOpacity,
          transform: [{
            scale: scrollToTopOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            })
          }]
        }
      ]}
      pointerEvents={showScrollToTop ? 'auto' : 'none'}
    >
      <TouchableOpacity
        style={styles.scrollToTopButtonInner}
        onPress={scrollToTop}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-up" size={24} color={theme.colors.background} />
      </TouchableOpacity>
    </Animated.View>
  </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  headerTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  headerSpacer: {
    width: 40,
  },
  profileBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBadgeText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    color: theme.colors.background,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  statusText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  timeText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  versionText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  bottomSpacing: {
    height: theme.spacing.xxxl,
  },
  scrollToTopButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 1000,
  },
  scrollToTopButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lg,
  },
});

export default SettingsScreen; 