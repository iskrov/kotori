import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, MainStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { useAuth } from '../../contexts/AuthContext';
import SafeScrollView from '../../components/SafeScrollView';
import logger from '../../utils/logger';
import LogViewer from '../../utils/LogViewer';

// Ensure web browser redirect results are handled
WebBrowser.maybeCompleteAuthSession();

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login, googleLogin, isLoading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLogViewer, setShowLogViewer] = useState(false);
  
  // Check if we're in development mode
  const isDev = __DEV__;
  
  // Clear error message when inputs change
  useEffect(() => {
    if (errorMessage) {
      setErrorMessage(null);
    }
  }, [email, password]);
  
  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Please fill in all required fields');
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // Log credentials before calling the API - REMOVED PASSWORD LOGGING
      // console.log(`Attempting login with Email: [${email}], Password: [${password}]`); 
      logger.debug(`Attempting login with Email: [${email}]`); // Log email only
      
      await login(email, password);
      // The AuthContext will handle navigation to the main app
    } catch (error: any) {
      logger.error('Login screen error:', error);
      let errorMsg = 'An error occurred during login. Please try again.';
      
      if (error.status === 401) {
        errorMsg = 'Invalid email or password. Please try again.';
      } else if (error.status === 422) {
        // Validation error
        if (error.message && typeof error.message === 'string') {
          errorMsg = error.message;
        } else if (error.errors && Array.isArray(error.errors)) {
          errorMsg = error.errors.join('\n');
        }
      } else if (error.status === 500 && error.message.includes('Database connection error')) {
        errorMsg = 'Cannot connect to the database. Please make sure the database service is running.';
      } else if (error.status === 0) {
        errorMsg = 'Unable to connect to the server. Please check your connection and try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await googleLogin();
      // The AuthContext will handle the response and navigation
    } catch (error: any) {
      logger.error('Google Login Screen Error:', error);
      let errorMsg = 'Failed to login with Google. Please try again.';
      
      if (error.status === 0) {
        errorMsg = 'Unable to connect to the server. Please check your connection and try again.';
      } else if (error.status === 500 && error.message.includes('Database connection error')) {
        errorMsg = 'Cannot connect to the database. Please make sure the database service is running.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };
  
  const navigateToRegister = () => {
    navigation.navigate('Auth', { screen: 'Register' });
  };

  const openLogViewer = () => {
    setShowLogViewer(true);
  };
  
  return (
    <SafeScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.logoContainer}>
        <Text style={styles.appName}>Vibes</Text>
        <Text style={styles.tagline}>Voice Journaling</Text>
      </View>
      
      <View style={styles.formContainer}>
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={20} color="#d32f2f" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
        
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
        
        <TouchableOpacity 
          style={styles.button}
          onPress={handleLogin}
          disabled={isLoading || authLoading}
        >
          {isLoading || authLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
        
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>
        
        <TouchableOpacity 
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          disabled={isLoading || authLoading}
        >
          <Ionicons name="logo-google" size={22} color="#EA4335" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>
        
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={navigateToRegister}>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>
        
        {isDev && (
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={openLogViewer}
          >
            <Ionicons name="bug-outline" size={16} color="#666" />
            <Text style={styles.debugButtonText}>Show Logs</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <LogViewer 
        visible={showLogViewer} 
        onClose={() => setShowLogViewer(false)} 
      />
    </SafeScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#7D4CDB',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: '#666',
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#d32f2f',
    marginLeft: 8,
    flex: 1,
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#7D4CDB',
    fontSize: 14,
    fontWeight: '600',
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    alignSelf: 'center',
  },
  debugButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});

export default LoginScreen; 