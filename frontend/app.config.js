import 'dotenv/config';

// Load environment variables
// Support both EXPO_PUBLIC_API_URL (recommended) and API_URL (legacy) for backwards compatibility
const apiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || "https://api.kotori.io"; // Production domain
const googleCloudProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const googleSpeechApiKey = process.env.GOOGLE_SPEECH_API_KEY;
const googleClientId = process.env.GOOGLE_CLIENT_ID;

// Only warn if explicitly required (frontend does not call Google STT directly)
const requireFrontendSpeechCreds = process.env.REQUIRE_FRONTEND_SPEECH_CREDS === 'true';
if (requireFrontendSpeechCreds && (!googleCloudProjectId || !googleSpeechApiKey)) {
  console.warn(
    "Warning: Google Cloud Speech-to-Text configuration is incomplete. " +
    "Make sure to set GOOGLE_CLOUD_PROJECT_ID and GOOGLE_SPEECH_API_KEY in your .env file."
  );
}

export default {
  expo: {
    name: "Kotori",
    slug: "kotori",
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
      bundleIdentifier: "com.kotori.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.kotori.app"
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