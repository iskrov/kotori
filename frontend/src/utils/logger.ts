import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logDirectory: string;
  private logFilePath: string;
  private isWeb: boolean;
  private enabled: boolean = true;

  constructor() {
    this.isWeb = Platform.OS === 'web';
    this.logDirectory = this.isWeb ? '' : `${FileSystem.documentDirectory}logs/`;
    this.logFilePath = this.isWeb ? '' : `${this.logDirectory}app.log`;
    this.initializeLogger();
  }

  private async initializeLogger() {
    if (this.isWeb) {
      console.log('Logger initialized in web mode - logs will appear in console only');
      return;
    }

    try {
      const dirInfo = await FileSystem.getInfoAsync(this.logDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.logDirectory, { intermediates: true });
      }
      
      // Create log file if it doesn't exist
      const fileInfo = await FileSystem.getInfoAsync(this.logFilePath);
      if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(this.logFilePath, '--- Log Start ---\n');
      }
      
      // Keep log file size in check
      const fileStatus = await FileSystem.getInfoAsync(this.logFilePath);
      if (fileStatus.exists && fileStatus.size > 1024 * 1024) { // 1MB max log size
        await FileSystem.writeAsStringAsync(this.logFilePath, '--- Log Rotated ---\n');
      }
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private async writeToFile(level: LogLevel, message: string, data?: any) {
    if (!this.enabled || this.isWeb) return;
    
    try {
      let logEntry = `${this.getTimestamp()} [${level.toUpperCase()}] ${message}`;
      if (data) {
        logEntry += ` ${JSON.stringify(data, null, 2)}`;
      }
      logEntry += '\n';
      
      await FileSystem.writeAsStringAsync(this.logFilePath, logEntry, { 
        encoding: FileSystem.EncodingType.UTF8 
      });
    } catch (error: unknown) {
      if (error instanceof Error && (error as any).code === 'UNAVAILABLE' && this.isWeb) {
        console.warn('Attempted to write log file on web, which is not supported.');
      } else {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  public debug(message: string, data?: any) {
    if (data !== undefined) {
      console.debug(message, data);
    } else {
      console.debug(message);
    }
    this.writeToFile('debug', message, data);
  }

  public info(message: string, data?: any) {
    if (data !== undefined) {
      console.info(message, data);
    } else {
      console.info(message);
    }
    this.writeToFile('info', message, data);
  }

  public warn(message: string, data?: any) {
    if (data !== undefined) {
      console.warn(message, data);
    } else {
      console.warn(message);
    }
    this.writeToFile('warn', message, data);
  }

  public error(message: string, data?: any) {
    if (data !== undefined) {
      console.error(message, data);
    } else {
      console.error(message);
    }
    this.writeToFile('error', message, data);
  }

  public async getLogs(): Promise<string> {
    if (this.isWeb) {
      return 'Log files are not available in the web environment.';
    }
    
    try {
      return await FileSystem.readAsStringAsync(this.logFilePath);
    } catch (error) {
      console.error('Failed to read log file:', error);
      return `Error reading logs: ${error}`;
    }
  }

  public enable() {
    this.enabled = true;
  }

  public disable() {
    this.enabled = false;
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger; 