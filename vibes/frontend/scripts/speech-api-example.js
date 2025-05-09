#!/usr/bin/env node

/**
 * Google Cloud Speech-to-Text API Example
 * 
 * This script demonstrates how to use the official Google Cloud Speech-to-Text
 * client library to transcribe a short audio file.
 */

// Load environment variables from .env file
require('dotenv').config();

// Import the Google Cloud Speech client library
const { SpeechClient } = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');

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

/**
 * Transcribe the given audio file
 * @param {string} audioFilePath Path to the audio file to transcribe
 */
async function transcribeAudio(audioFilePath) {
  // Create a client with API key auth
  const speechClient = new SpeechClient({
    credentials: {
      client_email: 'not-needed-for-api-key@example.com',
      private_key: 'not-needed-for-api-key',
    },
    projectId: projectId,
    apiEndpoint: 'speech.googleapis.com',
    universeDomain: 'googleapis.com',
  });

  try {
    console.log(`Reading audio file: ${audioFilePath}`);
    
    // Read the audio file content
    const audioContent = fs.readFileSync(audioFilePath).toString('base64');
    
    console.log('Audio file read successfully');
    console.log('File size:', Math.round(audioContent.length / 1024), 'KB');
    console.log('Sending to Google Cloud Speech-to-Text API...');

    // Configure the request
    // Note: For non-WAV files, you need to specify the encoding and sample rate
    const request = {
      audio: {
        content: audioContent,
      },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        model: 'default',
        alternativeLanguageCodes: ['es-ES', 'fr-FR'],
        enableAutomaticPunctuation: true,
      },
    };

    // Make the API request
    // Note: We need to add the API key as a header
    const [response] = await speechClient.recognize(request, {
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    const transcriptions = response.results;
    console.log('\nTranscription results:');
    
    if (transcriptions && transcriptions.length > 0) {
      transcriptions.forEach((result, index) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`Text: ${result.alternatives[0].transcript}`);
        console.log(`Confidence: ${Math.round(result.alternatives[0].confidence * 100)}%`);
        if (result.languageCode) {
          console.log(`Detected language: ${result.languageCode}`);
        }
      });
    } else {
      console.log('No transcription results returned.');
    }
  } catch (error) {
    console.error('Error during transcription:', error);
    if (error.message.includes('API key')) {
      console.log('\nTroubleshooting:');
      console.log('- Check that your API key is correct');
      console.log('- Ensure the Speech-to-Text API is enabled for your project');
    } else if (error.message.includes('File not found')) {
      console.log('\nTroubleshooting:');
      console.log('- Check the path to your audio file');
      console.log('- Ensure the file exists and is readable');
    } else {
      console.log('\nTroubleshooting:');
      console.log('- Check your internet connection');
      console.log('- Ensure the audio file is in a supported format');
      console.log('- Try specifying the correct encoding and sample rate for your audio');
    }
  }
}

// Check if an audio file path was provided
const audioFilePath = process.argv[2];
if (!audioFilePath) {
  console.error('ERROR: No audio file specified.');
  console.log('Usage: node speech-api-example.js <path-to-audio-file>');
  console.log('Example: node speech-api-example.js ./samples/hello.wav');
  process.exit(1);
}

// Run the transcription
transcribeAudio(audioFilePath); 