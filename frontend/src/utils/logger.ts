import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logDirectory: string;
  private logFilePath: string;
  private isWeb: boolean;
  private enabled: boolean = true;
  private isDev: boolean;
  private debugEnabled: boolean;
  private suppressedWarnings: Set<string>;

  constructor() {
    this.isWeb = Platform.OS === 'web';
    this.logDirectory = this.isWeb ? '' : `${FileSystem.documentDirectory}logs/`;
    this.logFilePath = this.isWeb ? '' : `${this.logDirectory}app.log`;
    this.isDev = __DEV__;
    this.debugEnabled = false; // Default to false, can be enabled via enableDebug()
    this.suppressedWarnings = new Set([
      'setNativeProps is deprecated', // Third-party library warning
    ]);
    this.initializeLogger();
  }

  private async initializeLogger() {
    if (this.isWeb && !this.isDev) {
      return; // Don't log initialization message in production web
    }

    if (this.isWeb && this.isDev) {
      console.log('Logger initialized in web development mode');
      this.setupConsoleOverrides();
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

  private setupConsoleOverrides() {
    if (!this.isWeb || !this.isDev) return;

    // Override console.warn to filter out suppressed warnings
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      
      // Check if this warning should be suppressed
      for (const suppressedWarning of this.suppressedWarnings) {
        if (message.includes(suppressedWarning)) {
          return; // Suppress this warning
        }
      }
      
      // Allow the warning through
      originalWarn.apply(console, args);
    };
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

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    if (level === 'error' || level === 'warn') return true;
    if (level === 'debug' && !this.debugEnabled) return false;
    if (!this.isDev) return true;
    return this.debugEnabled;
  }

  private shouldSuppressMessage(message: string): boolean {
    for (const suppressedWarning of this.suppressedWarnings) {
      if (message.includes(suppressedWarning)) {
        return true;
      }
    }
    return false;
  }

  public debug(message: string, data?: any) {
    if (!this.shouldLog('debug')) return;
    if (data !== undefined) {
      console.debug(message, data);
    } else {
      console.debug(message);
    }
    this.writeToFile('debug', message, data);
  }

  public info(message: string, data?: any) {
    if (!this.shouldLog('info')) return;
    if (data !== undefined) {
      console.info(message, data);
    } else {
      console.info(message);
    }
    this.writeToFile('info', message, data);
  }

  public warn(message: string, data?: any) {
    // Check if this warning should be suppressed
    if (this.shouldSuppressMessage(message)) {
      return;
    }

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

  public enableDebug() {
    this.debugEnabled = true;
  }

  public disableDebug() {
    this.debugEnabled = false;
  }

  public addSuppressedWarning(warning: string) {
    this.suppressedWarnings.add(warning);
  }

  public removeSuppressedWarning(warning: string) {
    this.suppressedWarnings.delete(warning);
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger; 