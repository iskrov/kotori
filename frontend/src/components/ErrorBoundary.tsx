/**
 * React Error Boundary component for the OPAQUE security system
 * Catches and handles React component errors with secure error reporting
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ErrorBoundaryState, ErrorInfo } from '../types/errorTypes';
import { handleComponentError } from '../utils/errorHandling';
import { logError } from '../services/ErrorLogger';
import { ErrorDisplay } from './ErrorDisplay';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: ErrorInfo) => void;
  enableRetry?: boolean;
  componentName?: string;
}

/**
 * Error Boundary component that catches JavaScript errors in child components
 * and displays a secure error UI without leaking sensitive information
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state to trigger error UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const componentName = this.props.componentName || 'ErrorBoundary';
    
    // Create secure error info
    const secureErrorInfo = handleComponentError(error, errorInfo, componentName);
    
    // Log the error securely
    const internalError = {
      ...secureErrorInfo,
      internalMessage: error.message,
      stackTrace: error.stack,
      component: componentName,
      operation: 'render',
      metadata: {
        componentStack: errorInfo.componentStack,
        retryCount: this.retryCount
      }
    };
    
    logError(internalError as any);
    
    // Update state with error info
    this.setState({
      errorInfo: secureErrorInfo,
      errorId: secureErrorInfo.id
    });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(secureErrorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    // Reset error state if children change (for retry functionality)
    if (prevState.hasError && !this.state.hasError) {
      this.retryCount = 0;
    }
  }

  /**
   * Retry rendering the component
   */
  private handleRetry = (): void => {
    if (this.retryCount >= this.maxRetries) {
      console.warn('Maximum retry attempts reached for ErrorBoundary');
      return;
    }
    
    this.retryCount++;
    
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined
    });
  };

  /**
   * Reset the error boundary state
   */
  public resetErrorBoundary = (): void => {
    this.retryCount = 0;
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.errorInfo) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.errorInfo, this.handleRetry);
      }
      
      // Default error UI
      return (
        <View style={styles.errorContainer}>
          <ErrorDisplay
            error={this.state.errorInfo}
            onRetry={this.props.enableRetry !== false ? this.handleRetry : undefined}
            onDismiss={this.resetErrorBoundary}
            showDetails={false}
            compact={false}
          />
          
          {/* Development mode details */}
          {__DEV__ && this.state.error && (
            <View style={styles.devDetails}>
              <Text style={styles.devTitle}>Development Details:</Text>
              <Text style={styles.devText}>
                Error: {this.state.error.message}
              </Text>
              <Text style={styles.devText}>
                Component: {this.props.componentName || 'Unknown'}
              </Text>
              <Text style={styles.devText}>
                Retry Count: {this.retryCount}/{this.maxRetries}
              </Text>
              {this.state.errorId && (
                <Text style={styles.devText}>
                  Error ID: {this.state.errorId}
                </Text>
              )}
            </View>
          )}
        </View>
      );
    }
    
    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for manually triggering error boundary
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    // Create an error that will be caught by the nearest error boundary
    throw error;
  };
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa'
  },
  devDetails: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7'
  },
  devTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 10
  },
  devText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 5,
    fontFamily: 'monospace'
  }
});

export default ErrorBoundary; 