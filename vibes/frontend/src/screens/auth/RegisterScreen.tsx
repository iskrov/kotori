import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { useAuth } from '../../contexts/AuthContext';

// Ensure web browser redirect results are handled
WebBrowser.maybeCompleteAuthSession();

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const RegisterScreen = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { register, googleLogin, isLoading: authLoading } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password should be at least 6 characters');
      return;
    }
    
    try {
      setIsLoading(true);
      await register(name, email, password);
      // The AuthContext will handle navigation to the main app
    } catch (error: any) {
      console.error('Registration error:', error);
      let errorMessage = 'An error occurred during registration. Please try again.';
      
      if (error.status === 400) {
        if (error.message.includes('email')) {
          errorMessage = 'This email is already registered. Please login or use a different email.';
        } else if (error.message.includes('password')) {
          errorMessage = 'Invalid password format. Please try a different password.';
        } else {
          errorMessage = error.message;
        }
      } else if (error.status === 422) {
        // Validation error
        if (error.message && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if (error.errors && Array.isArray(error.errors)) {
          errorMessage = error.errors.join('\n');
        }
      } else if (error.status === 0) {
        errorMessage = 'Unable to connect to the server. Please check your connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Registration Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleRegister = async () => {
    try {
      setIsLoading(true);
      await googleLogin();
      // The AuthContext will handle the response and navigation
    } catch (error: any) {
      console.error('Google Registration Error:', error);
      let errorMessage = 'Failed to register with Google. Please try again.';
      
      if (error.status === 0) {
        errorMessage = 'Unable to connect to the server. Please check your connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Google Registration Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const navigateToLogin = () => {
    navigation.navigate('Auth', { screen: 'Login' });
  };
  
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={navigateToLogin}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={22} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholderTextColor="#999"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={22} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={22} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                size={22} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={22} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
          </View>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={handleRegister}
            disabled={isLoading || authLoading}
          >
            {isLoading || authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <TouchableOpacity 
            style={styles.googleButton}
            onPress={handleGoogleRegister}
            disabled={isLoading || authLoading}
          >
            <Ionicons name="logo-google" size={22} color="#EA4335" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
          
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={navigateToLogin}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    backgroundColor: '#7D4CDB',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#666',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 50,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#7D4CDB',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RegisterScreen; 