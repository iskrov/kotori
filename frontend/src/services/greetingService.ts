/**
 * Greeting Service for Dynamic Home Screen Messages
 * 
 * Provides time-based and context-aware greetings that rotate to keep
 * the user experience fresh and engaging.
 */

export interface GreetingData {
  mainGreeting: string;
}

interface TimeBasedGreetings {
  morning: string[];
  afternoon: string[];
  evening: string[];
  nightOwl: string[];
}



// Time-based greeting templates
const TIME_GREETINGS: TimeBasedGreetings = {
  morning: [
    "Good morning, {userName} 🌅",
    "{userName}, let's start fresh ✨",
    "What are you hoping for today, {userName}? 🌱",
    "{userName}, the day is yours — what's on your mind? ☀️",
    "Morning clarity, {userName} 🧘",
    "Ready to capture today's thoughts, {userName}? 📝",
    "Rise and shine, {userName} 🌞",
    "{userName}, what dreams are you chasing today? 💫",
    "Morning energy is calling, {userName} 🔥",
    "{userName}, ready to make today count? 💪",
    "New day, fresh perspective, {userName} 🌿",
    "What's inspiring you this morning, {userName}? 💡",
    "{userName}, time to bloom 🌺",
    "Morning motivation time, {userName} ⚡",
    "Seize the morning, {userName} 🏆",
    "{userName}, what story will today tell? 📚",
    "Morning energy is strong, {userName} 🎵",
    "Ready for today's adventure, {userName}? 🗺️",
  ],
  afternoon: [
    "Good afternoon, {userName} ☀️",
    "How's your day going, {userName}? 🤔",
    "{userName}, got something to reflect on? 💭",
    "Midday pause — want to journal something, {userName}? ⏸️",
    "Perfect time for reflection, {userName} 🎯",
    "What's been on your mind today, {userName}? 🧠",
    "{userName}, time for a mental check-in 📊",
    "How are you feeling right now, {userName}? 💝",
    "{userName}, ready to process some thoughts? 🔄",
    "What's working well today, {userName}? ✅",
    "{userName}, any insights to capture? 🎨",
    "Taking a moment to breathe, {userName}? 🫁",
    "What's your energy like today, {userName}? ⚡",
    "{userName}, time to organize your thoughts? 📋",
    "Any breakthroughs to record, {userName}? 🚀",
    "{userName}, how's your heart feeling? ❤️",
    "Ready to dive deeper, {userName}? 🏊",
    "What patterns are you noticing, {userName}? 🔍",
  ],
  evening: [
    "Good evening, {userName} 🌆",
    "Evening is perfect for reflection, {userName} 🌙",
    "What stood out today, {userName}? ⭐",
    "Unwind your thoughts, {userName} 🛋️",
    "{userName}, time to process the day 📖",
    "Evening reflections, {userName}? 🌸",
    "Ready to wind down, {userName}? 🕯️",
    "What are you grateful for today, {userName}? 🙏",
    "{userName}, time to let go of today's stress 🌊",
    "Any lessons from today, {userName}? 🎓",
    "How did today shape you, {userName}? 🏺",
    "{userName}, ready for some evening clarity? 🔮",
    "What emotions need attention, {userName}? 🎭",
    "{userName}, time to celebrate today's wins? 🎉",
    "Any worries to release, {userName}? 🕊️",
    "What's your heart telling you, {userName}? 💖",
    "Ready to make peace with today, {userName}? ☮️",
    "{userName}, time for gentle self-reflection? 🪞",
  ],
  nightOwl: [
    "Up late, {userName}? 🌙",
    "Night thoughts can be powerful, {userName} 💫",
    "{userName}, let's capture what's on your mind 🌌",
    "Rest easier — journal it out, {userName} 😴",
    "Late night insights, {userName} 🦉",
    "Sometimes the best thoughts come at night, {userName} ✨",
    "What's keeping you up, {userName}? 🤯",
    "{userName}, midnight reflections calling? 🕛",
    "Ready to quiet the mind, {userName}? 🧘‍♀️",
    "Any deep thoughts to explore, {userName}? 🌊",
    "{userName}, night time, right time for journaling? 📝",
    "What's your soul whispering, {userName}? 👻",
    "{userName}, ready to release today's thoughts? 🎈",
    "Any dreams to document, {userName}? 💤",
    "{userName}, late night wisdom session? 🧙‍♂️",
    "What's stirring in your heart, {userName}? 🌪️",
    "{userName}, time to empty the mental jar? 🫙",
    "Ready for some nocturnal therapy, {userName}? 🌃",
  ],
};



// Time periods in 24-hour format
enum TimePeriod {
  MORNING = 'morning',     // 5:00 - 11:59
  AFTERNOON = 'afternoon', // 12:00 - 17:59
  EVENING = 'evening',     // 18:00 - 22:59
  NIGHT_OWL = 'nightOwl',  // 23:00 - 4:59
}

/**
 * Determines the current time period based on local device time
 */
function getCurrentTimePeriod(): TimePeriod {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return TimePeriod.MORNING;
  } else if (hour >= 12 && hour < 18) {
    return TimePeriod.AFTERNOON;
  } else if (hour >= 18 && hour < 23) {
    return TimePeriod.EVENING;
  } else {
    return TimePeriod.NIGHT_OWL;
  }
}

/**
 * Generates a pseudo-random index based on date and time period
 * This ensures greetings rotate but remain consistent within the same time period of the same day
 */
function getRotationIndex(arrayLength: number, timePeriod: TimePeriod): number {
  const today = new Date();
  const dateString = today.toDateString(); // "Mon Oct 09 2023"
  const seed = dateString + timePeriod;
  
  // Simple hash function for consistent pseudo-randomness
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash) % arrayLength;
}



/**
 * Main function to get dynamic greeting based on time
 */
export function getDynamicGreeting(
  userName: string = 'there'
): GreetingData {
  const timePeriod = getCurrentTimePeriod();
  const timeGreetings = TIME_GREETINGS[timePeriod];
  
  // Get main greeting with rotation
  const mainIndex = getRotationIndex(timeGreetings.length, timePeriod);
  const mainGreeting = timeGreetings[mainIndex].replace('{userName}', userName);
  
  return {
    mainGreeting,
  };
}

/**
 * Utility function to get a preview of all possible greetings for testing
 */
export function getAllGreetingPreviews(userName: string = 'User'): Record<string, string[]> {
  const previews: Record<string, string[]> = {};
  
  Object.entries(TIME_GREETINGS).forEach(([period, greetings]) => {
    previews[period] = greetings.map((greeting: string) => 
      greeting.replace('{userName}', userName)
    );
  });
  
  return previews;
}

/**
 * Get the current time period as a string (useful for debugging)
 */
export function getCurrentTimePeriodString(): string {
  return getCurrentTimePeriod();
} 