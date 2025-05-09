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

const SettingsScreen = () => {
  const { user, logout, updateUser } = useAuth();
  
  // User profile state
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState(user?.profile_picture || null);

  // App settings state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const darkMode = await AsyncStorage.getItem('darkMode');
        const pushNotifs = await AsyncStorage.getItem('pushNotifications');
        
        setIsDarkMode(darkMode === 'true');
        setPushNotifications(pushNotifs !== 'false');
      } catch (error) {
        logger.error('Failed to load settings', error);
      }
    };
    
    loadSettings();
  }, []);

  // Save setting when changed
  const saveSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, value.toString());
    } catch (error) {
      logger.error(`Failed to save setting: ${key}`, error);
    }
  };

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

  return (
    <ScrollView style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007bff" />
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
                <Ionicons name="person" size={40} color="#999" />
              </View>
            )}
            <View style={styles.imageEditIcon}>
              <Ionicons name="camera" size={18} color="#fff" />
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
            <Ionicons name="create-outline" size={18} color="#007bff" />
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
            />
            
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Your email"
              keyboardType="email-address"
              autoCapitalize="none"
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
            <Ionicons name="lock-closed-outline" size={18} color="#007bff" />
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
            />
            
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              secureTextEntry
            />
            
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
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
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>Dark Mode</Text>
            <Text style={styles.settingDescription}>Switch to dark theme</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={(value) => {
              setIsDarkMode(value);
              saveSetting('darkMode', value);
            }}
            trackColor={{ false: '#d9d9d9', true: '#007bff' }}
            thumbColor={Platform.OS === 'ios' ? '#fff' : isDarkMode ? '#fff' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>Push Notifications</Text>
            <Text style={styles.settingDescription}>Allow push notifications</Text>
          </View>
          <Switch
            value={pushNotifications}
            onValueChange={(value) => {
              setPushNotifications(value);
              saveSetting('pushNotifications', value);
            }}
            trackColor={{ false: '#d9d9d9', true: '#007bff' }}
            thumbColor={Platform.OS === 'ios' ? '#fff' : pushNotifications ? '#fff' : '#f4f3f4'}
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
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
      
      {/* Footer space */}
      <View style={styles.footer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007bff',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 6,
    marginBottom: 12,
  },
  editButtonText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  passwordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 6,
  },
  passwordButtonText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  editProfileForm: {
    marginTop: 8,
  },
  passwordForm: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#007bff',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  aboutItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  aboutItemText: {
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc3545',
    marginHorizontal: 16,
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    height: 30,
  },
});

export default SettingsScreen; 