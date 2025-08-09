/**
 * Feature Flags Configuration
 * 
 * Central location for controlling app features during development and deployment.
 * This allows us to disable features temporarily while preserving code for future releases.
 */

export interface FeatureFlags {
  // Secret Tags Features
  ENABLE_OFFLINE_SECRET_TAGS: boolean;
  ENABLE_SECRET_TAG_CACHING: boolean;
  ENABLE_SECURITY_MODE_SWITCHING: boolean;
  ENABLE_BORDER_CROSSING_MODE: boolean;
  // Global kill-switch for all secret-tag UI & detection paths
  ENABLE_SECRET_TAGS: boolean;
  
  // Future features can be added here
  ENABLE_TEAM_COLLABORATION: boolean;
  ENABLE_CLOUD_BACKUP: boolean;
}

/**
 * Current feature flag configuration for production deployment
 * 
 * TEMPORARILY DISABLED FOR INITIAL LAUNCH:
 * - Offline secret tags functionality
 * - Security mode switching 
 * - Border crossing data clearing
 * 
 * These features are fully implemented and tested, but disabled to simplify
 * the initial user experience and reduce complexity for the first release.
 * 
 * To re-enable offline features for future releases, change the relevant
 * flags to true and the system will seamlessly restore full functionality.
 */
export const FEATURE_FLAGS: FeatureFlags = {
  // Global kill-switch (default OFF for Kotori)
  ENABLE_SECRET_TAGS: false,
  // Secret Tags - TEMPORARILY DISABLED FOR LAUNCH SIMPLIFICATION
  ENABLE_OFFLINE_SECRET_TAGS: false,        // Disable offline caching
  ENABLE_SECRET_TAG_CACHING: false,         // Disable local storage of tags
  ENABLE_SECURITY_MODE_SWITCHING: false,    // Hide online/offline mode toggle
  ENABLE_BORDER_CROSSING_MODE: false,       // Disable data clearing features
  
  // Future features - Not yet implemented
  ENABLE_TEAM_COLLABORATION: false,
  ENABLE_CLOUD_BACKUP: false,
};

/**
 * Development override flags (for testing disabled features during development)
 * Set via environment variables or developer settings
 */
export const DEV_FEATURE_OVERRIDES: Partial<FeatureFlags> = {
  // Uncomment to test offline features during development:
  // ENABLE_OFFLINE_SECRET_TAGS: true,
  // ENABLE_SECRET_TAG_CACHING: true,
  // ENABLE_SECURITY_MODE_SWITCHING: true,
  // ENABLE_BORDER_CROSSING_MODE: true,
};

/**
 * Get the current feature flag value with development overrides
 */
export function getFeatureFlag<K extends keyof FeatureFlags>(key: K): boolean {
  // Check for development override first
  if (DEV_FEATURE_OVERRIDES[key] !== undefined) {
    return DEV_FEATURE_OVERRIDES[key] as boolean;
  }
  
  // Return production flag value
  return FEATURE_FLAGS[key];
}

/**
 * Check if offline secret tag features are enabled
 */
export function isOfflineSecretTagsEnabled(): boolean {
  return getFeatureFlag('ENABLE_SECRET_TAGS') && getFeatureFlag('ENABLE_OFFLINE_SECRET_TAGS');
}

/**
 * Check if security mode switching is enabled
 */
export function isSecurityModeSwitchingEnabled(): boolean {
  return getFeatureFlag('ENABLE_SECRET_TAGS') && getFeatureFlag('ENABLE_SECURITY_MODE_SWITCHING');
}

/**
 * Check if secret tag caching is enabled  
 */
export function isSecretTagCachingEnabled(): boolean {
  return getFeatureFlag('ENABLE_SECRET_TAGS') && getFeatureFlag('ENABLE_SECRET_TAG_CACHING');
}

/**
 * Check if border crossing mode is enabled
 */
export function isBorderCrossingModeEnabled(): boolean {
  return getFeatureFlag('ENABLE_SECRET_TAGS') && getFeatureFlag('ENABLE_BORDER_CROSSING_MODE');
} 

export function areSecretTagsEnabled(): boolean {
  return getFeatureFlag('ENABLE_SECRET_TAGS');
}