import { device, expect, element, by, waitFor } from 'detox';

// Global test timeout
const testTimeout = 120000;

beforeAll(async () => {
  console.log('🚀 Starting E2E Test Suite');
  
  // Launch the app
  await device.launchApp({
    permissions: {
      notifications: 'YES',
      camera: 'YES',
      photos: 'YES',
      microphone: 'YES',
    },
    launchArgs: {
      detoxEnableSynchronization: 0, // Disable synchronization for async operations
    },
  });
  
  console.log('📱 App launched successfully');
}, testTimeout);

beforeEach(async () => {
  // Reset app state before each test
  await device.reloadReactNative();
  
  // Wait for app to be ready
  await waitFor(element(by.id('main-navigator')))
    .toBeVisible()
    .withTimeout(10000);
}, testTimeout);

afterAll(async () => {
  console.log('🏁 E2E Test Suite completed');
  
  // Clean up
  await device.terminateApp();
}, testTimeout);

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Extended matchers for better assertions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeVisibleAndTappable(): R;
      toContainText(text: string): R;
    }
  }
}

expect.extend({
  async toBeVisibleAndTappable(received: Detox.IndexableNativeElement) {
    try {
      await expect(received).toBeVisible();
      await received.tap();
      return {
        message: () => `Element is visible and tappable`,
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `Element is not visible and tappable: ${error}`,
        pass: false,
      };
    }
  },
  
  async toContainText(received: Detox.IndexableNativeElement, text: string) {
    try {
      await expect(received).toHaveText(text);
      return {
        message: () => `Element contains text: ${text}`,
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `Element does not contain text: ${text}`,
        pass: false,
      };
    }
  },
});

// Test utilities
export const TestUtils = {
  /**
   * Wait for an element to appear and be visible
   */
  async waitForElement(matcher: Detox.NativeMatcher, timeout = 10000) {
    await waitFor(element(matcher))
      .toBeVisible()
      .withTimeout(timeout);
  },

  /**
   * Scroll to find an element
   */
  async scrollToElement(
    scrollViewId: string,
    elementMatcher: Detox.NativeMatcher,
    direction: 'up' | 'down' = 'down',
    maxScrolls = 5
  ) {
    let scrollCount = 0;
    
    while (scrollCount < maxScrolls) {
      try {
        await expect(element(elementMatcher)).toBeVisible();
        return;
      } catch (error) {
        await element(by.id(scrollViewId)).scroll(300, direction);
        scrollCount++;
      }
    }
    
    throw new Error(`Element not found after ${maxScrolls} scrolls`);
  },

  /**
   * Type text with delay for better reliability
   */
  async typeTextSlowly(elementMatcher: Detox.NativeMatcher, text: string, delay = 100) {
    const element_ = element(elementMatcher);
    await element_.tap();
    await element_.clearText();
    
    for (const char of text) {
      await element_.typeText(char);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  },

  /**
   * Wait for loading to complete
   */
  async waitForLoadingToComplete(timeout = 30000) {
    try {
      // Wait for any loading indicators to disappear
      await waitFor(element(by.id('loading-indicator')))
        .not.toBeVisible()
        .withTimeout(timeout);
    } catch (error) {
      // Loading indicator might not be present, which is fine
    }
    
    try {
      // Wait for skeleton loading to disappear
      await waitFor(element(by.id('skeleton-loading')))
        .not.toBeVisible()
        .withTimeout(timeout);
    } catch (error) {
      // Skeleton loading might not be present, which is fine
    }
  },

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(name: string) {
    try {
      await device.takeScreenshot(name);
      console.log(`📸 Screenshot taken: ${name}`);
    } catch (error) {
      console.warn(`Failed to take screenshot: ${error}`);
    }
  },

  /**
   * Simulate network conditions
   */
  async setNetworkCondition(condition: 'online' | 'offline' | 'slow') {
    switch (condition) {
      case 'offline':
        await device.setNetworkConnection(false);
        break;
      case 'slow':
        // Simulate slow network (this would need platform-specific implementation)
        console.log('⚠️ Slow network simulation not implemented');
        break;
      case 'online':
      default:
        await device.setNetworkConnection(true);
        break;
    }
  },
};

console.log('✅ E2E Test setup completed');
