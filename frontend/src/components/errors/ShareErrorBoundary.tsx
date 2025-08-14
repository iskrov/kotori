import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import logger from '../../utils/logger';

interface ShareErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  retry: () => void;
}

interface ShareErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetError, 
  retry 
}) => {
  const { theme } = useAppTheme();
  const styles = getDefaultErrorFallbackStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons 
          name="alert-circle-outline" 
          size={64} 
          color={theme.colors.error} 
        />
        
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Something Went Wrong
        </Text>
        
        <Text style={[styles.message, { color: theme.colors.textMuted }]}>
          The sharing feature encountered an unexpected error. This has been logged and will be investigated.
        </Text>

        <View style={styles.errorDetails}>
          <Text style={[styles.errorTitle, { color: theme.colors.textMuted }]}>
            Error Details:
          </Text>
          <Text style={[styles.errorMessage, { color: theme.colors.error }]}>
            {error.message}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color={theme.colors.surface} 
              style={styles.buttonIcon}
            />
            <Text style={[styles.primaryButtonText, { color: theme.colors.surface }]}>
              Try Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
            onPress={resetError}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export class ShareErrorBoundary extends React.Component<
  ShareErrorBoundaryProps,
  ShareErrorBoundaryState
> {
  constructor(props: ShareErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ShareErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Log the error
    logger.error('[ShareErrorBoundary] Component crashed', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'ShareErrorBoundary',
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    logger.info('[ShareErrorBoundary] Retry attempted');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReset = () => {
    logger.info('[ShareErrorBoundary] Reset attempted');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.handleReset}
          retry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

const getDefaultErrorFallbackStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontFamily: theme.typography.fontFamilies.bold,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.lg,
  },
  errorDetails: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  errorTitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.xs,
  },
  errorMessage: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.mono,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.md,
  },
  primaryButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  buttonIcon: {
    marginRight: theme.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.md,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default ShareErrorBoundary;
