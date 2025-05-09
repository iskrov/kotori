import { apiTestUtil } from './apiTestUtil';

/**
 * Command-line utility for testing the Google Cloud Speech-to-Text API
 * This can be used during setup or for troubleshooting
 */
export const testSpeechToTextApi = async () => {
  console.log('Testing Google Cloud Speech-to-Text API connection...');
  
  try {
    const startTime = Date.now();
    const status = await apiTestUtil.testSpeechToTextApi();
    const duration = Date.now() - startTime;
    
    console.log('-------------------------------------');
    console.log(`Test completed in ${duration}ms`);
    console.log('Status:', status.available ? 'AVAILABLE' : 'UNAVAILABLE');
    
    if (status.error) {
      console.log('Error:', status.error);
    }
    
    if (status.available) {
      console.log('The Google Cloud Speech-to-Text API is properly configured and accessible.');
    } else {
      console.log('\nTroubleshooting steps:');
      console.log('1. Check that GOOGLE_CLOUD_PROJECT_ID and GOOGLE_SPEECH_API_KEY are set in your .env file');
      console.log('2. Verify that the Google Cloud Speech-to-Text API is enabled for your project');
      console.log('3. Ensure your API key has permission to access the Speech-to-Text API');
      console.log('4. Check your internet connection');
      console.log('5. Verify that your API key is not restricted to specific IP addresses or referrers');
    }
    console.log('-------------------------------------');
    
    return status;
  } catch (error) {
    console.error('Test failed with an unexpected error:');
    console.error(error);
    console.log('-------------------------------------');
    throw error;
  }
};

// For direct execution via node - uncomment this block to run directly
/*
(async () => {
  try {
    await testSpeechToTextApi();
  } catch (error) {
    process.exit(1);
  }
  process.exit(0);
})();
*/ 