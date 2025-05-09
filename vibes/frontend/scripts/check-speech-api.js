#!/usr/bin/env node

/**
 * Basic Speech-to-Text API Test
 * 
 * A script to test Google Cloud Speech-to-Text API connectivity 
 * using the official client library
 */

// Load environment variables from .env file
require('dotenv').config();

// Import the Google Cloud Speech client library
const { SpeechClient } = require('@google-cloud/speech');

// Getting API credentials from environment variables
const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

// Display current environment settings (masking sensitive data)
console.log('Environment variables:');
console.log('- GOOGLE_CLOUD_PROJECT_ID:', projectId || 'not set');

if (apiKey) {
  // Only show first 4 and last 4 characters of the API key for security
  const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
  console.log('- GOOGLE_SPEECH_API_KEY:', maskedKey, '(masked for security)');
} else {
  console.log('- GOOGLE_SPEECH_API_KEY: not set');
}

// Verify credentials exist
if (!apiKey || !projectId) {
  console.error('\nERROR: Missing required API credentials.');
  console.log('Please check your .env file and ensure both GOOGLE_SPEECH_API_KEY and GOOGLE_CLOUD_PROJECT_ID are set.');
  process.exit(1);
}

// Function to test the Speech API using the official client
async function testSpeechAPI() {
  console.log('\nTesting connection to Google Cloud Speech-to-Text API using the official client library...');
  
  try {
    // Create a client with API key auth 
    // Note: For API key auth with the client library, we still need to specify dummy credentials
    // but the actual auth will happen through the API key
    const speechClient = new SpeechClient({
      credentials: {
        client_email: 'not-needed-for-api-key@example.com',
        private_key: 'not-needed-for-api-key',
      },
      projectId: projectId,
      apiEndpoint: 'speech.googleapis.com',
      universeDomain: 'googleapis.com',
    });

    console.log('SpeechClient initialized, testing with a minimal request...');
    
    // Create a simple request to test connectivity
    // We're just listing available locations to avoid unnecessary processing
    const [locations] = await speechClient.listLocations({
      name: `projects/${projectId}`,
      filter: '',
      pageSize: 10,
      pageToken: ''
    }, {
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    console.log('\nAPI CONNECTION SUCCESSFUL!');
    console.log(`Found ${locations.length} available location(s)`);
    
    if (locations.length > 0) {
      console.log('Locations:', locations.map(loc => loc.name || loc).join(', '));
    }
    
    console.log('\nAdditionally, checking Speech-to-Text v2 API access...');
    
    // Also test a v2 API feature - list recognizers to ensure we have proper access
    const [recognizers] = await speechClient.listRecognizers({
      parent: `projects/${projectId}/locations/global`
    }, {
      headers: {
        'x-goog-api-key': apiKey
      }
    });
    
    console.log(`Found ${recognizers?.length || 0} recognizer(s) in your project`);
    console.log('\nYour Google Cloud Speech-to-Text API is properly configured and ready to use!');
    
    process.exit(0);
  } catch (error) {
    console.error('\nAPI CONNECTION FAILED!');
    console.error('Error details:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    console.log('\nTroubleshooting suggestions:');
    
    if (error.message.includes('permission') || error.message.includes('unauthorized') || 
        error.message.includes('auth') || error.message.includes('API key')) {
      console.log('- Your API key might be invalid or missing required permissions');
      console.log('- Make sure the Speech-to-Text API is enabled for your project');
      console.log('- Verify that your API key is not restricted to specific IP addresses or referrers');
    } else if (error.message.includes('project') || error.message.includes('not found')) {
      console.log('- Your project ID might be incorrect');
      console.log('- Verify that the project exists in the Google Cloud Console');
    } else {
      console.log('- Check your internet connection');
      console.log('- Verify that the Speech-to-Text API is enabled for your project');
    }
    
    process.exit(1);
  }
}

// Run the test
testSpeechAPI(); 