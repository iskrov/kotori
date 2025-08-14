import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Custom hook to set document title for web browsers
 * This is now mainly a backup - React Navigation should handle titles via screen options
 * @param title - The title to set for the current screen
 * @param appName - The app name to append (defaults to 'Kotori')
 */
export const useDocumentTitle = (title?: string, appName: string = 'Kotori') => {
  useEffect(() => {
    // Only set document title on web platform as a backup
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const documentTitle = title ? `${title} - ${appName}` : appName;
      
      // Set title with a small delay to let navigation settle
      const timeoutId = setTimeout(() => {
        document.title = documentTitle;
      }, 50);
      
      // Cleanup
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [title, appName]);
};

export default useDocumentTitle;
