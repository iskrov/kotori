import 'dotenv/config';

// Load environment variables
const apiUrl = process.env.API_URL || "http://localhost:8001";
const googleCloudProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const googleSpeechApiKey = process.env.GOOGLE_SPEECH_API_KEY;
const googleClientId = process.env.GOOGLE_CLIENT_ID;

// Validation for required environment variables
if (!googleCloudProjectId || !googleSpeechApiKey) {
  console.warn(
    "Warning: Google Cloud Speech-to-Text configuration is incomplete. " +
    "Make sure to set GOOGLE_CLOUD_PROJECT_ID and GOOGLE_SPEECH_API_KEY in your .env file."
  );
}

export default {
  expo: {
    name: "Vibes",
    slug: "vibes",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.vibes.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.vibes.app"
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "webpack",
      output: "static",
      themeColor: "#7D4CDB",
      backgroundColor: "#ffffff",
      build: {
        babel: {
          include: ["@expo/vector-icons", "react-native-gesture-handler", "react-native-reanimated"]
        }
      }
    },
    extra: {
      // API configuration
      apiUrl,
      
      // Google Cloud configuration (set by admin for all users)
      googleClientId,
      googleCloudProjectId,
      googleSpeechApiKey,
      
      eas: {
        projectId: "your-project-id"
      }
    }
  }
}; 