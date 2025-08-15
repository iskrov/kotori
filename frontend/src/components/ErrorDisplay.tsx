/**
 * Error Display component for showing user-friendly error messages
 * Provides secure error presentation without leaking sensitive information
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Alert
} from 'react-native';
import { ErrorDisplayProps, ErrorSeverity } from '../types/errorTypes';
import { getRecoverySuggestions, getSeverityDescription } from '../utils/secureErrorMessages';

/**
 * Component for displaying errors in a user-friendly way
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  compact = false
}) => {
  const [expanded, setExpanded] = useState(showDetails);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    
    setRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setRetrying(false);
    }
  };

  const handleShowDetails = () => {
    setExpanded(!expanded);
  };

  const handleCopyErrorCode = () => {
    if (error.supportCode) {
      // In a real app, this would copy to clipboard
      Alert.alert(
        'Error Code Copied',
        `Error code ${error.supportCode} has been copied to clipboard. You can provide this to support for assistance.`,
        [{ text: 'OK' }]
      );
    }
  };

  const getSeverityColor = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return '#28a745'; // Green
      case ErrorSeverity.MEDIUM:
        return '#ffc107'; // Yellow
      case ErrorSeverity.HIGH:
        return '#fd7e14'; // Orange
      case ErrorSeverity.CRITICAL:
        return '#dc3545'; // Red
      default:
        return '#6c757d'; // Gray
    }
  };

  const getSeverityIcon = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'ℹ️';
      case ErrorSeverity.MEDIUM:
        return '⚠️';
      case ErrorSeverity.HIGH:
        return '❗';
      case ErrorSeverity.CRITICAL:
        return '🚨';
      default:
        return '❓';
    }
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { borderLeftColor: getSeverityColor(error.severity) }]}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactIcon}>{getSeverityIcon(error.severity)}</Text>
          <Text style={styles.compactMessage} numberOfLines={1}>
            {error.message}
          </Text>
          {onRetry && (
            <TouchableOpacity 
              style={styles.compactRetryButton} 
              onPress={handleRetry}
              disabled={retrying}
            >
              <Text style={styles.compactRetryText}>
                {retrying ? '⏳' : '🔄'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const recoverySuggestions = getRecoverySuggestions(error.type);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{getSeverityIcon(error.severity)}</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.severity}>
              {getSeverityDescription(error.severity)}
            </Text>
          </View>
        </View>
      </View>

      {/* Main message */}
      <View style={styles.messageContainer}>
        <Text style={styles.message}>{error.message}</Text>
      </View>

      {/* Recovery suggestions */}
      {recoverySuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>What you can try:</Text>
          {recoverySuggestions.map((suggestion, index) => (
            <View key={index} style={styles.suggestionItem}>
              <Text style={styles.suggestionBullet}>•</Text>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionContainer}>
        {onRetry && (
          <TouchableOpacity 
            style={[styles.button, styles.retryButton]} 
            onPress={handleRetry}
            disabled={retrying}
          >
            <Text style={styles.retryButtonText}>
              {retrying ? 'Retrying...' : 'Try Again'}
            </Text>
          </TouchableOpacity>
        )}
        
        {error.recovery?.userAction && (
          <TouchableOpacity 
            style={[styles.button, styles.actionButton]} 
            onPress={error.recovery.userAction.action}
          >
            <Text style={styles.actionButtonText}>
              {error.recovery.userAction.label}
            </Text>
          </TouchableOpacity>
        )}
        
        {onDismiss && (
          <TouchableOpacity 
            style={[styles.button, styles.dismissButton]} 
            onPress={onDismiss}
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Details section */}
      <View style={styles.detailsContainer}>
        <TouchableOpacity 
          style={styles.detailsToggle} 
          onPress={handleShowDetails}
        >
          <Text style={styles.detailsToggleText}>
            {expanded ? '▼ Hide Details' : '▶ Show Details'}
          </Text>
        </TouchableOpacity>
        
        {expanded && (
          <ScrollView style={styles.detailsContent}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Error Type:</Text>
              <Text style={styles.detailValue}>{error.type}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Category:</Text>
              <Text style={styles.detailValue}>{error.category}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Time:</Text>
              <Text style={styles.detailValue}>
                {error.timestamp.toLocaleString()}
              </Text>
            </View>
            
            {error.supportCode && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Support Code:</Text>
                <TouchableOpacity onPress={handleCopyErrorCode}>
                  <Text style={[styles.detailValue, styles.supportCode]}>
                    {error.supportCode} (tap to copy)
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            {error.helpUrl && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Help:</Text>
                <TouchableOpacity>
                  <Text style={[styles.detailValue, styles.helpLink]}>
                    View help documentation
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    margin: 10,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  compactContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    margin: 5,
    borderLeftWidth: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    marginBottom: 15,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 2,
  },
  severity: {
    fontSize: 14,
    color: '#6c757d',
  },
  messageContainer: {
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 24,
  },
  suggestionsContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007bff',
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  suggestionBullet: {
    fontSize: 16,
    color: '#007bff',
    marginRight: 8,
    marginTop: 2,
  },
  suggestionText: {
    fontSize: 14,
    color: '#495057',
    flex: 1,
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 10,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#007bff',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#28a745',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: '#6c757d',
  },
  dismissButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 15,
  },
  detailsToggle: {
    paddingVertical: 8,
  },
  detailsToggleText: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '500',
  },
  detailsContent: {
    marginTop: 10,
    maxHeight: 200,
  },
  detailItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#6c757d',
    flex: 1,
  },
  supportCode: {
    color: '#007bff',
    textDecorationLine: 'underline',
  },
  helpLink: {
    color: '#007bff',
    textDecorationLine: 'underline',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  compactMessage: {
    fontSize: 14,
    color: '#495057',
    flex: 1,
  },
  compactRetryButton: {
    marginLeft: 8,
    padding: 4,
  },
  compactRetryText: {
    fontSize: 16,
  },
});

export default ErrorDisplay; 