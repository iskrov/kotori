import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../contexts/AuthContext';
import { UserAPI } from '../../services/api';
import logger from '../../utils/logger';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

const SettingsScreen = () => {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme, isSystemTheme, setUseSystemTheme } = useAppTheme();
  
  // User profile state
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState(user?.profile_picture || null);

  // App settings state
  const [pushNotifications, setPushNotifications] = useState(true);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

  // Profile image picker
  const pickImage = async () => {
    try {
      // On web, we don't need to request permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required for image selection');
          return;
        }
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProfileImage(result.assets[0].uri);
        logger.info('Image selected:', { uri: result.assets[0].uri });
        // Here would be code to upload the image to the server
      }
    } catch (error) {
      logger.error('Image picker error', error);
      // For web, provide a fallback when ImagePicker fails
      if (Platform.OS === 'web') {
        Alert.alert(
          'Image Picker Error',
          'The image picker encountered an issue. This feature may have limited functionality in web browsers.'
        );
      }
    }
  };

  // Update profile
  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    
    try {
      setIsLoading(true);
      
      await UserAPI.updateProfile({
        full_name: name,
        email,
      });
      
      // Update local user state in AuthContext
      await updateUser({ full_name: name, email: email });
      
      setIsProfileEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      logger.error('Failed to update profile', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'All password fields are required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    try {
      setIsLoading(true);
      
      await UserAPI.updatePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordChanging(false);
      Alert.alert('Success', 'Password changed successfully');
    } catch (error) {
      logger.error('Failed to change password', error);
      Alert.alert('Error', 'Failed to change password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    logger.info('[SettingsScreen] Logout button pressed.');

    const performLogout = async () => {
      setIsLoading(true);
      try {
        await logout(); 
      } catch (error) {
        logger.error('Logout error', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Directly call performLogout without confirmation
    await performLogout();
  };

  // Load push notification settings (theme settings are now handled by ThemeProvider)
  useEffect(() => {
    const loadPushSettings = async () => {
      try {
        const pushNotifs = await AsyncStorage.getItem('pushNotifications');
        setPushNotifications(pushNotifs !== 'false'); // Default to true if not set or error
      } catch (error) {
        logger.error('Failed to load push notification settings', error);
        setPushNotifications(true); // Fallback
      }
    };
    loadPushSettings();
  }, []);

  // Save push notification setting
  const savePushSetting = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('pushNotifications', value.toString());
    } catch (error) {
      logger.error(`Failed to save setting: pushNotifications`, error);
    }
  };

  const styles = getStyles(theme); // Generate styles with the current theme

  return (
    <ScrollView style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
      
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Ionicons name="person" size={theme.spacing.xxl} color={theme.colors.textSecondary} />
              </View>
            )}
            <View style={styles.imageEditIcon}>
              <Ionicons name="camera" size={theme.typography.fontSizes.lg} color={theme.colors.white} />
            </View>
          </TouchableOpacity>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.full_name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>
        
        {!isProfileEditing ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsProfileEditing(true)}
          >
            <Ionicons name="create-outline" size={theme.typography.fontSizes.lg} color={theme.colors.primary} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editProfileForm}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={theme.colors.textSecondary}
            />
            
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Your email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.colors.textSecondary}
            />
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setName(user?.full_name || '');
                  setEmail(user?.email || '');
                  setIsProfileEditing(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdateProfile}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {!isPasswordChanging ? (
          <TouchableOpacity 
            style={styles.passwordButton}
            onPress={() => setIsPasswordChanging(true)}
          >
            <Ionicons name="lock-closed-outline" size={theme.typography.fontSizes.lg} color={theme.colors.primary} />
            <Text style={styles.passwordButtonText}>Change Password</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.passwordForm}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              secureTextEntry
              placeholderTextColor={theme.colors.textSecondary}
            />
            
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              secureTextEntry
              placeholderTextColor={theme.colors.textSecondary}
            />
            
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              placeholderTextColor={theme.colors.textSecondary}
            />
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setIsPasswordChanging(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleChangePassword}
              >
                <Text style={styles.saveButtonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      
      {/* App Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Dark Mode</Text>
          <Switch
            trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
            thumbColor={theme.isDarkMode ? theme.colors.white : theme.colors.gray100}
            ios_backgroundColor={theme.colors.gray300}
            onValueChange={() => {
              if (isSystemTheme) setUseSystemTheme(false);
              toggleTheme();
            }}
            value={theme.isDarkMode}
            disabled={isSystemTheme}
          />
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Use System Theme</Text>
          <Switch
            trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
            thumbColor={isSystemTheme ? theme.colors.white : theme.colors.gray100}
            ios_backgroundColor={theme.colors.gray300}
            onValueChange={setUseSystemTheme}
            value={isSystemTheme}
          />
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Enable Push Notifications</Text>
          <Switch
            trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
            thumbColor={pushNotifications ? theme.colors.white : theme.colors.gray100}
            ios_backgroundColor={theme.colors.gray300}
            onValueChange={(value) => {
              setPushNotifications(value);
              savePushSetting(value); // Use the new savePushSetting
            }}
            value={pushNotifications}
          />
        </View>
      </View>
      
      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <TouchableOpacity style={styles.aboutItem}>
          <Text style={styles.aboutItemText}>Privacy Policy</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.aboutItem}>
          <Text style={styles.aboutItemText}>Terms of Service</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.aboutItem}>
          <Text style={styles.aboutItemText}>Version 1.0.0</Text>
        </TouchableOpacity>
      </View>
      
      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={theme.typography.fontSizes.lg} color={theme.colors.white} />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
      
      {/* Footer space */}
      <View style={styles.footer} />
    </ScrollView>
  );
};

// Function to generate styles based on the theme
const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  section: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  profileImageContainer: {
    marginRight: theme.spacing.md,
    position: 'relative',
  },
  profileImage: {
    width: theme.spacing.xxl * 1.5,
    height: theme.spacing.xxl * 1.5,
    borderRadius: theme.spacing.xxl * 0.75,
    backgroundColor: theme.colors.border,
  },
  profileImagePlaceholder: {
    width: theme.spacing.xxl * 1.5,
    height: theme.spacing.xxl * 1.5,
    borderRadius: theme.spacing.xxl * 0.75,
    backgroundColor: theme.colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.xs,
    borderRadius: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: theme.typography.fontSizes.xl,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
  },
  profileEmail: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.primary + '20',
    borderRadius: theme.spacing.sm,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
  },
  editButtonText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  editProfileForm: {
    marginTop: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.sm,
  },
  button: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.sm,
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
    minWidth: 100,
  },
  buttonText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  cancelButton: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray200,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  passwordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.gray100,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.md,
  },
  passwordButtonText: {
    marginLeft: theme.spacing.sm,
    color: theme.colors.primary,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  passwordForm: {
    marginTop: theme.spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    flex: 1,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  subSettingText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    flex: 1,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.xs,
  },
  aboutItem: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  aboutItemText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  logoutButton: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.sm,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  footer: {
    height: theme.spacing.xl,
  },
});

export default SettingsScreen; 