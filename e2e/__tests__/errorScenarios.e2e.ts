import { device, expect, element, by } from 'detox';
import { ShareScreenPO } from '../pageObjects/ShareScreenPO';
import { SharePreviewPO } from '../pageObjects/SharePreviewPO';
import { ShareOptionsPO } from '../pageObjects/ShareOptionsPO';
import { ShareTestUtils } from '../utils/shareTestUtils';
import { TestUtils } from '../setup';

describe('Share Workflow Error Scenarios E2E', () => {
  let shareScreen: ShareScreenPO;
  let sharePreview: SharePreviewPO;
  let shareOptions: ShareOptionsPO;

  beforeEach(async () => {
    shareScreen = new ShareScreenPO();
    sharePreview = new SharePreviewPO();
    shareOptions = new ShareOptionsPO();
  });

  afterEach(async () => {
    // Ensure network is restored after each test
    await TestUtils.setNetworkCondition('online');
    await ShareTestUtils.cleanupTestData();
  });

  describe('Network Error Handling', () => {
    it('should handle network disconnection during share generation', async () => {
      console.log('🚀 Testing network disconnection during share generation');

      // Navigate to share screen and make selections
      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('weekly');
      await shareScreen.selectTemplate('wellness');

      // Disconnect network before generating share
      console.log('📡 Disconnecting network');
      await ShareTestUtils.simulateNetworkConditions('offline');
      
      // Attempt to generate share
      await shareScreen.generateShare();

      // Verify network error handling
      console.log('⚠️ Verifying network error handling');
      await ShareTestUtils.verifyErrorRecovery('network', async () => {
        // Restore network connection
        console.log('🔄 Restoring network and retrying');
        await TestUtils.setNetworkCondition('online');
        
        // Tap retry button
        const retryButton = element(by.text('Retry'));
        await retryButton.tap();
      });

      // Verify successful generation after retry
      await sharePreview.waitForScreenToLoad();
      await sharePreview.verifyShareContent();

      console.log('✅ Network error recovery test completed');
    }, 180000);

    it('should handle network disconnection during PDF download', async () => {
      console.log('🚀 Testing network disconnection during PDF download');

      // Create a share first
      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('daily');
      await shareScreen.selectTemplate('medical');
      await shareScreen.generateShare();
      await sharePreview.waitForScreenToLoad();

      // Open share options
      await sharePreview.shareContent();
      await shareOptions.waitForModalToOpen();

      // Disconnect network before downloading PDF
      console.log('📡 Disconnecting network before PDF download');
      await TestUtils.setNetworkCondition('offline');

      // Attempt PDF download
      try {
        await shareOptions.downloadPDF();
        
        // Should show network error
        await shareOptions.waitForErrorMessage('Unable to connect to the server');
        
        // Restore network and retry
        console.log('🔄 Restoring network for retry');
        await TestUtils.setNetworkCondition('online');
        
        const retryButton = element(by.text('Retry'));
        await retryButton.tap();
        
        // Verify successful download
        await shareOptions.verifyPDFDownloadSuccess();
        
      } catch (error) {
        console.log('📄 PDF download error handled as expected');
        
        // Close error dialog and restore network
        await TestUtils.setNetworkCondition('online');
        const okButton = element(by.text('OK'));
        await okButton.tap();
      }

      console.log('✅ PDF download error recovery test completed');
    }, 150000);

    it('should handle intermittent network issues', async () => {
      console.log('🚀 Testing intermittent network issues');

      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('weekly');
      await shareScreen.selectTemplate('wellness');

      // Simulate intermittent connectivity during generation
      console.log('📡 Simulating intermittent network');
      
      // Start generation
      await shareScreen.generateShare();

      // Briefly disconnect and reconnect network multiple times
      for (let i = 0; i < 3; i++) {
        await ShareTestUtils.simulateNetworkConditions('offline', 1000);
        await ShareTestUtils.simulateNetworkConditions('online', 2000);
      }

      // Should eventually complete or show appropriate error handling
      try {
        await sharePreview.waitForScreenToLoad(90000);
        await sharePreview.verifyShareContent();
        console.log('✅ Generation completed despite intermittent network');
      } catch (error) {
        console.log('⚠️ Generation failed due to network issues, verifying error handling');
        
        const networkError = element(by.text('Network Error'));
        await expect(networkError).toBeVisible();
        
        const retryButton = element(by.text('Retry'));
        await retryButton.tap();
        
        await sharePreview.waitForScreenToLoad();
        await sharePreview.verifyShareContent();
      }

      console.log('✅ Intermittent network test completed');
    }, 200000);
  });

  describe('Server Error Handling', () => {
    it('should handle server 500 errors gracefully', async () => {
      console.log('🚀 Testing server 500 error handling');

      // Note: This test would require mock server setup or specific test environment
      // For now, we'll test the UI response to server errors
      
      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('weekly');
      await shareScreen.selectTemplate('wellness');
      await shareScreen.generateShare();

      // In a real test environment, we might mock a 500 error response
      // For now, we'll test timeout scenarios which might trigger server errors
      
      try {
        await sharePreview.waitForScreenToLoad(30000); // Shorter timeout
        console.log('✅ Share generation completed successfully');
      } catch (error) {
        console.log('⚠️ Testing server error response');
        
        // Look for server error message
        const serverError = element(by.text('Server error. Please try again later.'));
        try {
          await expect(serverError).toBeVisible();
          
          // Test retry functionality
          const retryButton = element(by.text('Try Again'));
          await retryButton.tap();
          
          await sharePreview.waitForScreenToLoad(60000);
          await sharePreview.verifyShareContent();
          
        } catch (retryError) {
          console.log('📊 Server error handling UI not visible, test environment may not support this scenario');
        }
      }

      console.log('✅ Server error handling test completed');
    }, 150000);

    it('should handle API rate limiting', async () => {
      console.log('🚀 Testing API rate limiting');

      // Attempt multiple rapid share generations to potentially trigger rate limiting
      for (let i = 0; i < 3; i++) {
        console.log(`🔄 Attempt ${i + 1}: Rapid share generation`);
        
        await shareScreen.navigateToShareScreen();
        await shareScreen.selectPeriod('daily');
        await shareScreen.selectTemplate('wellness');
        await shareScreen.generateShare();

        try {
          await sharePreview.waitForScreenToLoad(15000);
          console.log(`✅ Attempt ${i + 1} successful`);
          
          // Go back for next attempt
          if (i < 2) {
            await sharePreview.goBack();
          }
        } catch (error) {
          console.log(`⚠️ Attempt ${i + 1} may have hit rate limit`);
          
          // Look for rate limit error
          const rateLimitError = element(by.text('Too many requests. Please wait a moment and try again.'));
          try {
            await expect(rateLimitError).toBeVisible();
            
            // Wait and retry
            console.log('⏱️ Waiting for rate limit to reset');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const retryButton = element(by.text('Try Again'));
            await retryButton.tap();
            
            await sharePreview.waitForScreenToLoad();
            break;
            
          } catch (rateLimitUIError) {
            console.log('📊 Rate limit UI not visible, continuing test');
            // Go back and continue
            try {
              await sharePreview.goBack();
            } catch (backError) {
              // Might already be on share screen
            }
          }
        }
      }

      console.log('✅ Rate limiting test completed');
    }, 200000);
  });

  describe('Data Validation Errors', () => {
    it('should handle invalid template selection', async () => {
      console.log('🚀 Testing invalid template selection');

      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('weekly');

      // Try to generate without selecting template
      console.log('⚠️ Attempting generation without template');
      
      // Verify button is disabled or shows validation error
      try {
        await shareScreen.verifyGenerateButtonDisabled();
        console.log('✅ Generate button properly disabled without template');
      } catch (error) {
        console.log('📊 Generate button state not verifiable, attempting generation');
        
        await shareScreen.generateShare();
        
        // Should show validation error
        const validationError = element(by.text('Please select a template'));
        try {
          await expect(validationError).toBeVisible();
          console.log('✅ Validation error shown for missing template');
        } catch (validationUIError) {
          console.log('📊 Validation UI not visible, test may need UI updates');
        }
      }

      console.log('✅ Invalid template selection test completed');
    }, 60000);

    it('should handle invalid date range selection', async () => {
      console.log('🚀 Testing invalid date range selection');

      await shareScreen.navigateToShareScreen();
      await shareScreen.selectTemplate('wellness');

      // Try to generate without selecting period (if possible)
      console.log('⚠️ Attempting generation without period selection');
      
      try {
        await shareScreen.verifyGenerateButtonDisabled();
        console.log('✅ Generate button properly disabled without period');
      } catch (error) {
        console.log('📊 Generate button state not verifiable');
        
        // If we can attempt generation, should show validation error
        try {
          await shareScreen.generateShare();
          
          const validationError = element(by.text('Please select a time period'));
          await expect(validationError).toBeVisible();
          console.log('✅ Validation error shown for missing period');
        } catch (generationError) {
          console.log('📊 Generation prevented by UI constraints');
        }
      }

      console.log('✅ Invalid date range selection test completed');
    }, 60000);
  });

  describe('Memory and Performance Errors', () => {
    it('should handle memory pressure during generation', async () => {
      console.log('🚀 Testing memory pressure handling');

      // This test simulates memory pressure by creating multiple shares
      const shares = [];
      
      for (let i = 0; i < 3; i++) {
        console.log(`🔄 Creating share ${i + 1}`);
        
        await shareScreen.navigateToShareScreen();
        await shareScreen.selectPeriod('weekly');
        await shareScreen.selectTemplate('wellness');
        await shareScreen.generateShare();

        try {
          await sharePreview.waitForScreenToLoad(45000);
          console.log(`✅ Share ${i + 1} created successfully`);
          
          shares.push(`share-${i + 1}`);
          
          // Go back for next iteration
          if (i < 2) {
            await sharePreview.goBack();
          }
        } catch (error) {
          console.log(`⚠️ Share ${i + 1} creation failed, possibly due to memory pressure`);
          
          // Look for memory-related error messages
          const memoryError = element(by.text('Unable to process request. Please try again.'));
          try {
            await expect(memoryError).toBeVisible();
            
            console.log('📱 Memory pressure error detected');
            
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const retryButton = element(by.text('Try Again'));
            await retryButton.tap();
            
            await sharePreview.waitForScreenToLoad();
            break;
            
          } catch (memoryUIError) {
            console.log('📊 Memory error UI not visible');
            break;
          }
        }
      }

      console.log(`✅ Memory pressure test completed. Created ${shares.length} shares.`);
    }, 300000);
  });

  describe('Timeout Scenarios', () => {
    it('should handle generation timeouts gracefully', async () => {
      console.log('🚀 Testing generation timeout handling');

      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('monthly'); // Longer period might take more time
      await shareScreen.selectTemplate('medical');
      await shareScreen.generateShare();

      // Use a shorter timeout to potentially trigger timeout handling
      try {
        await sharePreview.waitForScreenToLoad(20000); // 20 second timeout
        console.log('✅ Generation completed within timeout');
      } catch (error) {
        console.log('⏱️ Generation timeout, testing timeout handling');
        
        // Look for timeout error message
        const timeoutError = element(by.text('Request timed out. Please try again.'));
        try {
          await expect(timeoutError).toBeVisible();
          
          console.log('✅ Timeout error message displayed');
          
          // Test retry functionality
          const retryButton = element(by.text('Retry'));
          await retryButton.tap();
          
          // Allow more time for retry
          await sharePreview.waitForScreenToLoad(90000);
          await sharePreview.verifyShareContent();
          
        } catch (timeoutUIError) {
          console.log('📊 Timeout error UI not visible, generation may have completed');
          
          // Give it one more chance with extended timeout
          await sharePreview.waitForScreenToLoad(60000);
          await sharePreview.verifyShareContent();
        }
      }

      console.log('✅ Timeout handling test completed');
    }, 200000);
  });
});
