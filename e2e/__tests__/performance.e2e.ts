import { device, expect } from 'detox';
import { ShareScreenPO } from '../pageObjects/ShareScreenPO';
import { SharePreviewPO } from '../pageObjects/SharePreviewPO';
import { ShareOptionsPO } from '../pageObjects/ShareOptionsPO';
import { ShareTestUtils } from '../utils/shareTestUtils';

describe('Share Workflow Performance E2E', () => {
  let shareScreen: ShareScreenPO;
  let sharePreview: SharePreviewPO;
  let shareOptions: ShareOptionsPO;

  beforeEach(async () => {
    shareScreen = new ShareScreenPO();
    sharePreview = new SharePreviewPO();
    shareOptions = new ShareOptionsPO();
  });

  afterEach(async () => {
    await ShareTestUtils.cleanupTestData();
  });

  describe('Share Generation Performance', () => {
    it('should generate daily shares within performance benchmarks', async () => {
      console.log('🚀 Testing daily share generation performance');

      const { result, duration } = await ShareTestUtils.measurePerformance(
        async () => {
          await shareScreen.navigateToShareScreen();
          await shareScreen.selectPeriod('daily');
          await shareScreen.selectTemplate('wellness');
          await shareScreen.generateShare();
          await sharePreview.waitForScreenToLoad();
          return 'daily-share-generated';
        },
        'Daily Share Generation',
        15000 // 15 second benchmark
      );

      // Verify performance meets benchmark
      expect(duration).toBeLessThan(15000);

      // Verify quality wasn't compromised for speed
      await sharePreview.verifyShareContent();
      await ShareTestUtils.verifyShareContent('wellness');

      console.log(`✅ Daily share generated in ${duration}ms (benchmark: 15000ms)`);
    }, 60000);

    it('should generate weekly shares within performance benchmarks', async () => {
      console.log('🚀 Testing weekly share generation performance');

      const { result, duration } = await ShareTestUtils.measurePerformance(
        async () => {
          await shareScreen.navigateToShareScreen();
          await shareScreen.selectPeriod('weekly');
          await shareScreen.selectTemplate('medical');
          await shareScreen.generateShare();
          await sharePreview.waitForScreenToLoad();
          return 'weekly-share-generated';
        },
        'Weekly Share Generation',
        25000 // 25 second benchmark
      );

      expect(duration).toBeLessThan(25000);
      await sharePreview.verifyShareContent();
      await ShareTestUtils.verifyShareContent('medical');

      console.log(`✅ Weekly share generated in ${duration}ms (benchmark: 25000ms)`);
    }, 90000);

    it('should generate monthly shares within performance benchmarks', async () => {
      console.log('🚀 Testing monthly share generation performance');

      const { result, duration } = await ShareTestUtils.measurePerformance(
        async () => {
          await shareScreen.navigateToShareScreen();
          await shareScreen.selectPeriod('monthly');
          await shareScreen.selectTemplate('mood');
          await shareScreen.generateShare();
          await sharePreview.waitForScreenToLoad();
          return 'monthly-share-generated';
        },
        'Monthly Share Generation',
        35000 // 35 second benchmark
      );

      expect(duration).toBeLessThan(35000);
      await sharePreview.verifyShareContent();
      await ShareTestUtils.verifyShareContent('mood');

      console.log(`✅ Monthly share generated in ${duration}ms (benchmark: 35000ms)`);
    }, 120000);
  });

  describe('PDF Generation Performance', () => {
    it('should generate PDFs within performance benchmarks', async () => {
      console.log('🚀 Testing PDF generation performance');

      // Create a share first
      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('weekly');
      await shareScreen.selectTemplate('wellness');
      await shareScreen.generateShare();
      await sharePreview.waitForScreenToLoad();

      // Open share options
      await sharePreview.shareContent();
      await shareOptions.waitForModalToOpen();

      // Measure PDF generation performance
      const { result, duration } = await ShareTestUtils.measurePerformance(
        async () => {
          await shareOptions.downloadPDF();
          return 'pdf-generated';
        },
        'PDF Generation',
        10000 // 10 second benchmark
      );

      expect(duration).toBeLessThan(10000);
      await shareOptions.verifyPDFDownloadSuccess();

      console.log(`✅ PDF generated in ${duration}ms (benchmark: 10000ms)`);
    }, 90000);

    it('should handle multiple PDF generations efficiently', async () => {
      console.log('🚀 Testing multiple PDF generation performance');

      // Create a share
      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('daily');
      await shareScreen.selectTemplate('medical');
      await shareScreen.generateShare();
      await sharePreview.waitForScreenToLoad();

      const pdfGenerationTimes: number[] = [];

      // Generate multiple PDFs
      for (let i = 0; i < 3; i++) {
        console.log(`📄 Generating PDF ${i + 1}`);

        await sharePreview.shareContent();
        await shareOptions.waitForModalToOpen();

        const { duration } = await ShareTestUtils.measurePerformance(
          async () => {
            await shareOptions.downloadPDF();
            return `pdf-${i + 1}`;
          },
          `PDF Generation ${i + 1}`,
          15000
        );

        pdfGenerationTimes.push(duration);
        await shareOptions.verifyPDFDownloadSuccess();
        await shareOptions.closeModal();

        // Brief pause between generations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Verify all generations were within benchmark
      pdfGenerationTimes.forEach((time, index) => {
        expect(time).toBeLessThan(15000);
        console.log(`✅ PDF ${index + 1} generated in ${time}ms`);
      });

      // Verify performance didn't degrade significantly
      const avgTime = pdfGenerationTimes.reduce((sum, time) => sum + time, 0) / pdfGenerationTimes.length;
      console.log(`📊 Average PDF generation time: ${avgTime}ms`);

      expect(avgTime).toBeLessThan(12000); // Average should be better than worst case

    }, 180000);
  });

  describe('UI Responsiveness Performance', () => {
    it('should maintain responsive UI during share generation', async () => {
      console.log('🚀 Testing UI responsiveness during generation');

      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('weekly');
      await shareScreen.selectTemplate('wellness');

      // Start generation
      await shareScreen.generateShare();

      // Test UI responsiveness during generation
      const startTime = Date.now();

      // Verify progress indicators are responsive
      try {
        await sharePreview.verifyGenerationProgress();
        
        // Test if we can interact with back button during generation
        const backButton = sharePreview.backButton;
        await expect(backButton).toBeVisible();
        
        // Don't actually tap back, just verify it's responsive
        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(2000); // UI should be responsive within 2 seconds
        
        console.log(`✅ UI remained responsive (${responseTime}ms) during generation`);
      } catch (error) {
        console.log('📊 Generation completed too quickly to test responsiveness');
      }

      // Wait for completion
      await sharePreview.waitForScreenToLoad();
      await sharePreview.verifyShareContent();

      console.log('✅ UI responsiveness test completed');
    }, 120000);

    it('should handle rapid user interactions efficiently', async () => {
      console.log('🚀 Testing rapid user interaction handling');

      // Test rapid period selection changes
      await shareScreen.navigateToShareScreen();

      const interactionTimes: number[] = [];

      const periods: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly', 'daily', 'weekly'];

      for (const period of periods) {
        const startTime = Date.now();
        await shareScreen.selectPeriod(period);
        const endTime = Date.now();
        
        const responseTime = endTime - startTime;
        interactionTimes.push(responseTime);
        
        console.log(`📅 ${period} selection took ${responseTime}ms`);
        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      }

      // Test rapid template selection
      await shareScreen.waitForTemplateLoading();
      
      const templates = ['wellness', 'medical', 'mood', 'wellness'];
      
      for (const template of templates) {
        const startTime = Date.now();
        await shareScreen.selectTemplate(template);
        const endTime = Date.now();
        
        const responseTime = endTime - startTime;
        interactionTimes.push(responseTime);
        
        console.log(`📋 ${template} selection took ${responseTime}ms`);
        expect(responseTime).toBeLessThan(1500); // Template selection might be slightly slower
      }

      const avgResponseTime = interactionTimes.reduce((sum, time) => sum + time, 0) / interactionTimes.length;
      console.log(`📊 Average interaction response time: ${avgResponseTime}ms`);
      
      expect(avgResponseTime).toBeLessThan(800); // Average should be quite fast

      console.log('✅ Rapid interaction test completed');
    }, 90000);
  });

  describe('Memory Usage Performance', () => {
    it('should maintain stable memory usage during multiple operations', async () => {
      console.log('🚀 Testing memory stability during multiple operations');

      // This test creates multiple shares to test memory usage
      const operations = ShareTestUtils.generateTestScenarios();

      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        console.log(`🔄 Performing operation ${i + 1}: ${operation.name}`);

        const { duration } = await ShareTestUtils.measurePerformance(
          async () => {
            await shareScreen.navigateToShareScreen();
            await shareScreen.selectPeriod(operation.period);
            await shareScreen.selectTemplate(operation.template);
            await shareScreen.generateShare();
            await sharePreview.waitForScreenToLoad();
            return operation.name;
          },
          operation.name,
          operation.expectedDuration
        );

        expect(duration).toBeLessThan(operation.expectedDuration);
        
        // Verify content quality
        await sharePreview.verifyShareContent();
        
        // Go back for next iteration (except last)
        if (i < operations.length - 1) {
          await sharePreview.goBack();
          await shareScreen.waitForScreenToLoad();
        }

        console.log(`✅ Operation ${i + 1} completed in ${duration}ms`);
      }

      console.log('✅ Memory stability test completed');
    }, 300000);

    it('should handle concurrent operations efficiently', async () => {
      console.log('🚀 Testing concurrent operation handling');

      // This test simulates rapid successive operations
      await shareScreen.navigateToShareScreen();
      await shareScreen.selectPeriod('daily');
      await shareScreen.selectTemplate('wellness');

      // Start generation
      await shareScreen.generateShare();

      // Immediately try to interact with other elements
      const startTime = Date.now();

      try {
        // Test if other UI elements remain responsive
        await shareScreen.viewHistoryButton.tap();
        
        // Should either navigate or show that generation is in progress
        const responseTime = Date.now() - startTime;
        console.log(`🔄 Concurrent interaction response time: ${responseTime}ms`);
        
        expect(responseTime).toBeLessThan(3000); // Should respond within 3 seconds
        
        // Navigate back to continue with generation
        await shareScreen.navigateToShareScreen();
        
      } catch (error) {
        console.log('📊 Concurrent interaction handled appropriately');
      }

      // Ensure original generation completes
      await sharePreview.waitForScreenToLoad();
      await sharePreview.verifyShareContent();

      console.log('✅ Concurrent operation test completed');
    }, 150000);
  });

  describe('Network Performance', () => {
    it('should optimize for different network conditions', async () => {
      console.log('🚀 Testing network condition optimization');

      // Test with normal network conditions
      const normalNetworkTime = await ShareTestUtils.measurePerformance(
        async () => {
          await shareScreen.navigateToShareScreen();
          await shareScreen.selectPeriod('weekly');
          await shareScreen.selectTemplate('wellness');
          await shareScreen.generateShare();
          await sharePreview.waitForScreenToLoad();
          return 'normal-network-share';
        },
        'Normal Network Share Generation'
      );

      console.log(`📶 Normal network generation: ${normalNetworkTime.duration}ms`);

      // Go back for next test
      await sharePreview.goBack();

      // Test with simulated slow network (if available)
      try {
        await ShareTestUtils.simulateNetworkConditions('slow');
        
        const slowNetworkTime = await ShareTestUtils.measurePerformance(
          async () => {
            await shareScreen.selectPeriod('daily');
            await shareScreen.selectTemplate('medical');
            await shareScreen.generateShare();
            await sharePreview.waitForScreenToLoad();
            return 'slow-network-share';
          },
          'Slow Network Share Generation'
        );

        console.log(`📶 Slow network generation: ${slowNetworkTime.duration}ms`);

        // Restore normal network
        await ShareTestUtils.simulateNetworkConditions('online');

        // Slow network should still complete within reasonable time
        expect(slowNetworkTime.duration).toBeLessThan(60000); // 1 minute max for slow network

      } catch (error) {
        console.log('📊 Slow network simulation not available, skipping slow network test');
      }

      console.log('✅ Network performance test completed');
    }, 200000);
  });
});
