#!/usr/bin/env node

/**
 * Simple Speech-to-Text API Test Script
 * 
 * This script tests the connection to the Google Cloud Speech-to-Text API
 * using a simple direct approach without requiring TypeScript or complex imports.
 * 
 * Usage:
 *   node scripts/simple-api-test.js
 */

// Load env variables
require('dotenv').config();

// Check if fetch is available globally (Node.js v18+) or needs to be imported
let fetch;
try {
  // Check if fetch is available globally
  if (globalThis.fetch) {
    fetch = globalThis.fetch;
    console.log('Using built-in fetch API');
  } else {
    // Try to import node-fetch if fetch is not available globally
    console.log('Built-in fetch API not available, trying to use node-fetch');
    const nodeFetch = require('node-fetch');
    fetch = nodeFetch;
    console.log('Using node-fetch module');
  }
} catch (error) {
  console.error('ERROR: fetch API is not available. For Node.js versions before 18.0.0, you need to install node-fetch:');
  console.error('npm install --save-dev node-fetch@2');
  process.exit(1);
}

// Access environment variables
const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

// Show environment variables with masked API key for debugging
console.log('Environment variables:');
console.log('- GOOGLE_CLOUD_PROJECT_ID:', projectId || 'not set');
if (apiKey) {
  const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
  console.log('- GOOGLE_SPEECH_API_KEY:', maskedKey, '(masked)');
} else {
  console.log('- GOOGLE_SPEECH_API_KEY: not set');
}

// Check if required environment variables are set
if (!apiKey) {
  console.error('ERROR: GOOGLE_SPEECH_API_KEY environment variable is not set.');
  console.log('Please set it in your .env file.');
  process.exit(1);
}

if (!projectId) {
  console.error('ERROR: GOOGLE_CLOUD_PROJECT_ID environment variable is not set.');
  console.log('Please set it in your .env file.');
  process.exit(1);
}

const apiUrl = 'https://speech.googleapis.com/v2';

/**
 * Test the connection to Google Cloud Speech-to-Text API
 */
async function testSpeechToTextApi() {
  console.log('\nTesting connection to Google Cloud Speech-to-Text API...');
  console.log(`Project ID: ${projectId}`);
  
  try {
    const startTime = Date.now();
    
    // Make a lightweight request to verify the API is accessible
    // Using the locations endpoint which should return a list of supported locations
    const response = await fetch(
      `${apiUrl}/projects/${projectId}/locations?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    console.log(`Request completed in ${duration}ms`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\nAPI CONNECTION SUCCESSFUL!');
      console.log(`Status code: ${response.status}`);
      console.log(`Available locations: ${data.locations?.length || 0}`);
      
      if (data.locations?.length > 0) {
        console.log('Locations:', data.locations.map(loc => loc.name || loc).join(', '));
      }
      
      return true;
    } else {
      const errorText = await response.text();
      console.error('\nAPI CONNECTION FAILED!');
      console.error(`Status code: ${response.status}`);
      console.error('Error message:', errorText);
      
      console.log('\nTroubleshooting suggestions:');
      if (response.status === 401 || response.status === 403) {
        console.log('- Your API key might be invalid or missing required permissions');
        console.log('- Make sure you created the API key correctly in the Google Cloud Console');
        console.log('- Check if the Speech-to-Text API is enabled for your project');
      } else if (response.status === 404) {
        console.log('- Your project ID might be incorrect');
        console.log('- Verify that the project exists in the Google Cloud Console');
      } else {
        console.log('- Check your internet connection');
        console.log('- Verify that your API key is not restricted to specific IP addresses or referrers');
        console.log('- Make sure the Speech-to-Text API is enabled for your project');
      }
      
      return false;
    }
  } catch (error) {
    console.error('\nAPI CONNECTION FAILED WITH EXCEPTION!');
    console.error('Error message:', error.message);
    console.error('Error details:', error);
    
    console.log('\nTroubleshooting suggestions:');
    console.log('- Check your internet connection');
    console.log('- Verify your environment variables are set correctly');
    console.log('- Make sure the Speech-to-Text API is enabled for your project');
    
    return false;
  }
}

// Run the test
(async () => {
  const success = await testSpeechToTextApi();
  process.exit(success ? 0 : 1);
})(); 