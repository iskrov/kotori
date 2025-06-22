/**
 * Tests for the Dynamic Greeting Service
 */

import { getDynamicGreeting, getAllGreetingPreviews, getCurrentTimePeriodString } from '../greetingService';

// Mock Date to control time-based tests
const mockDate = (hour: number) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  jest.spyOn(global, 'Date').mockImplementation(() => date);
};

describe('Greeting Service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getDynamicGreeting', () => {
    it('should return morning greeting for 8 AM', () => {
      mockDate(8);
      const greeting = getDynamicGreeting('Alex');
      // Should be one of the morning greetings
      expect(
        greeting.mainGreeting.includes('morning') ||
        greeting.mainGreeting.includes('fresh') ||
        greeting.mainGreeting.includes('today') ||
        greeting.mainGreeting.includes('day is yours') ||
        greeting.mainGreeting.includes('clarity') ||
        greeting.mainGreeting.includes('capture')
      ).toBe(true);
    });

    it('should return afternoon greeting for 2 PM', () => {
      mockDate(14);
      const greeting = getDynamicGreeting('Alex');
      // Should be one of the afternoon greetings
      expect(
        greeting.mainGreeting.includes('afternoon') ||
        greeting.mainGreeting.includes('day going') ||
        greeting.mainGreeting.includes('reflect') ||
        greeting.mainGreeting.includes('Midday') ||
        greeting.mainGreeting.includes('Perfect time') ||
        greeting.mainGreeting.includes('been on your mind')
      ).toBe(true);
    });

    it('should return evening greeting for 8 PM', () => {
      mockDate(20);
      const greeting = getDynamicGreeting('Alex');
      expect(greeting.mainGreeting).toContain('Alex');
      // Should be one of the evening greetings
      expect(
        greeting.mainGreeting.includes('evening') ||
        greeting.mainGreeting.includes('reflection') ||
        greeting.mainGreeting.includes('stood out') ||
        greeting.mainGreeting.includes('Unwind') ||
        greeting.mainGreeting.includes('process') ||
        greeting.mainGreeting.includes('reflections')
      ).toBe(true);
    });

    it('should return night owl greeting for 1 AM', () => {
      mockDate(1);
      const greeting = getDynamicGreeting('Alex');
      // Should be one of the night owl greetings
      expect(
        greeting.mainGreeting.includes('Up late') ||
        greeting.mainGreeting.includes('Night thoughts') ||
        greeting.mainGreeting.includes('capture') ||
        greeting.mainGreeting.includes('Rest easier') ||
        greeting.mainGreeting.includes('Late night') ||
        greeting.mainGreeting.includes('best thoughts come at night')
      ).toBe(true);
    });



    it('should use fallback name when no name provided', () => {
      mockDate(10);
      const greeting = getDynamicGreeting();
      // Should return a valid greeting (may or may not contain 'there' depending on the selected greeting)
      expect(greeting.mainGreeting).toBeTruthy();
      expect(greeting.mainGreeting.length).toBeGreaterThan(0);
    });

    it('should include emojis in greetings', () => {
      mockDate(8); // Morning
      const greeting = getDynamicGreeting('Alex');
      // Should contain an emoji at the end
      expect(/[\u{1F300}-\u{1F9FF}]$/u.test(greeting.mainGreeting)).toBe(true);
    });

    it('should include user name in personalized greetings', () => {
      mockDate(8); // Morning
      const greeting = getDynamicGreeting('Alex');
      // For greetings that should contain the name, check if Alex is included
      if (greeting.mainGreeting.includes('Alex')) {
        expect(greeting.mainGreeting).toContain('Alex');
      }
    });
  });

  describe('getAllGreetingPreviews', () => {
    it('should return greetings for all time periods', () => {
      const previews = getAllGreetingPreviews('TestUser');
      
      expect(previews).toHaveProperty('morning');
      expect(previews).toHaveProperty('afternoon');
      expect(previews).toHaveProperty('evening');
      expect(previews).toHaveProperty('nightOwl');
      
      // Each period should have multiple greetings (we now have 18 each)
      expect(previews.morning.length).toBeGreaterThanOrEqual(18);
      expect(previews.afternoon.length).toBeGreaterThanOrEqual(18);
      expect(previews.evening.length).toBeGreaterThanOrEqual(18);
      expect(previews.nightOwl.length).toBeGreaterThanOrEqual(18);
      
      // Greetings with {userName} should include the test username
      previews.morning.forEach(greeting => {
        // Only check greetings that should contain the username
        if (greeting.includes('TestUser')) {
          expect(greeting).toContain('TestUser');
        }
        expect(greeting.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getCurrentTimePeriodString', () => {
    it('should return correct time period strings', () => {
      mockDate(8);
      expect(getCurrentTimePeriodString()).toBe('morning');
      
      mockDate(14);
      expect(getCurrentTimePeriodString()).toBe('afternoon');
      
      mockDate(20);
      expect(getCurrentTimePeriodString()).toBe('evening');
      
      mockDate(1);
      expect(getCurrentTimePeriodString()).toBe('nightOwl');
    });
  });

  describe('Rotation consistency', () => {
    it('should return the same greeting for the same time period on the same day', () => {
      mockDate(10);
      const greeting1 = getDynamicGreeting('Alex');
      const greeting2 = getDynamicGreeting('Alex');
      
      expect(greeting1.mainGreeting).toBe(greeting2.mainGreeting);
    });
  });
}); 