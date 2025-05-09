import 'process';
import { Buffer } from 'buffer';
import { AppRegistry } from 'react-native';
import App from '../App';
import { name as appName } from '../app.json';
import logger from './utils/logger';

// Ensure global Buffer is available
window.Buffer = Buffer;

// Set up global error handling
window.addEventListener('error', (event) => {
  logger.error('Uncaught error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', {
    reason: event.reason
  });
});

// Set up app initialization
try {
  // Register the app
  AppRegistry.registerComponent(appName, () => App);

  // Web-specific setup
  if (module.hot) {
    module.hot.accept();
  }

  // Initialize the app on the browser
  AppRegistry.runApplication(appName, {
    rootTag: document.getElementById('root'),
  });

  logger.info('Web app initialized successfully');
} catch (error) {
  logger.error('Failed to initialize web app:', error);
  // Display error to user
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
        <h1 style="color: #e74c3c;">Application Error</h1>
        <p style="max-width: 500px; text-align: center;">
          There was a problem initializing the application. Please try refreshing the page.
        </p>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px; max-width: 80vw; overflow: auto;">
          ${error.toString()}
        </pre>
      </div>
    `;
  }
} 