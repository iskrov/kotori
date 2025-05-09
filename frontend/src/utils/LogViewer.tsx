import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal,
  SafeAreaView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import logger from './logger';

interface LogViewerProps {
  visible: boolean;
  onClose: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');

  useEffect(() => {
    if (visible) {
      fetchLogs();
    }
  }, [visible, filter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logData = await logger.getLogs();
      
      // Apply filters if needed
      if (filter !== 'all') {
        const filteredLogs = logData
          .split('\n')
          .filter(line => {
            const upperFilter = `[${filter.toUpperCase()}]`;
            return line.includes(upperFilter);
          })
          .join('\n');
        setLogs(filteredLogs || 'No matching logs found.');
      } else {
        setLogs(logData);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs('Error loading logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    // This is a placeholder - we would implement proper log clearing in the logger
    setLogs('Logs have been cleared.');
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Application Logs</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchLogs}>
            <Ionicons name="refresh" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'all' && styles.activeFilter]} 
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'error' && styles.activeFilter]} 
            onPress={() => setFilter('error')}
          >
            <Text style={[styles.filterText, filter === 'error' && styles.activeFilterText]}>Errors</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'warn' && styles.activeFilter]} 
            onPress={() => setFilter('warn')}
          >
            <Text style={[styles.filterText, filter === 'warn' && styles.activeFilterText]}>Warnings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'info' && styles.activeFilter]} 
            onPress={() => setFilter('info')}
          >
            <Text style={[styles.filterText, filter === 'info' && styles.activeFilterText]}>Info</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7D4CDB" />
            <Text style={styles.loadingText}>Loading logs...</Text>
          </View>
        ) : (
          <ScrollView style={styles.logsContainer}>
            {isWeb ? (
              <View>
                <Text style={styles.webNotice}>
                  Logs are only available in the developer console on web. 
                  Please check your browser's developer tools.
                </Text>
                <Text style={styles.codeBlock}>console.log('View logs here in browser console')</Text>
              </View>
            ) : (
              <Text style={styles.logs}>{logs}</Text>
            )}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={clearLogs}
          >
            <Text style={styles.clearButtonText}>Clear Logs</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Constants.statusBarHeight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
  },
  activeFilter: {
    backgroundColor: '#7D4CDB',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  logsContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  logs: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 12,
    color: '#333',
  },
  webNotice: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 14,
    backgroundColor: '#333',
    color: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  clearButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default LogViewer; 