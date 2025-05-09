#!/usr/bin/env node

/**
 * Speech-to-Text API Test Script
 * 
 * This script tests the connection to the Google Cloud Speech-to-Text API.
 * It verifies that your API key and project ID are correctly configured
 * in your .env file and that the service is accessible.
 * 
 * Usage:
 *   node scripts/test-speech-api.js
 */

// Load env variables
require('dotenv').config();

// Show environment variables with masked API key for debugging
console.log('Environment variables:');
console.log('- GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID || 'not set');
if (process.env.GOOGLE_SPEECH_API_KEY) {
  const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
  const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
  console.log('- GOOGLE_SPEECH_API_KEY:', maskedKey, '(masked)');
} else {
  console.log('- GOOGLE_SPEECH_API_KEY: not set');
}
console.log('- API_URL:', process.env.API_URL || 'not set');

try {
  console.log('\nLoading necessary modules...');
  
  // Register babel to handle TypeScript
  require('@babel/register')({
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    presets: ['@babel/preset-env', '@babel/preset-typescript', '@babel/preset-react'],
  });
  
  // Import the test function
  const { testSpeechToTextApi } = require('../src/utils/apiTester');
  
  // Run the test
  (async () => {
    try {
      console.log('Starting Speech-to-Text API connection test...');
      const status = await testSpeechToTextApi();
      
      if (!status.available) {
        console.log('\nTest completed with FAILURE. Speech-to-Text API is not available.');
        process.exit(1);
      }
      
      console.log('\nTest completed SUCCESSFULLY. Speech-to-Text API is available.');
      process.exit(0);
    } catch (error) {
      console.error('Test failed with an error:', error);
      process.exit(1);
    }
  })();
} catch (error) {
  console.error('Failed to run the test script:', error);
  process.exit(1);
} 