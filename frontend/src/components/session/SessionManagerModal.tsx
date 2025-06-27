/**
 * Session Manager Modal Component
 * 
 * Full-screen modal for comprehensive OPAQUE session management
 * including session list, controls, and panic mode access.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SessionManagerModalProps, SessionActionType } from '../../types/sessionIndicatorTypes';
import { SessionStatusBadge } from './SessionStatusBadge';
import { SessionQuickActions } from './SessionQuickActions';

export const SessionManagerModal: React.FC<SessionManagerModalProps> = ({
  visible,
  sessions,
  onClose,
  onSessionAction,
  onPanicMode,
  testID = 'session-manager-modal'
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const activeSessions = sessions.filter(s => s.isActive);
  const expiredSessions = sessions.filter(s => !s.isActive);

  const handleSessionAction = (action: SessionActionType, sessionId: string) => {
    if (action === 'panic_mode') {
      handlePanicMode();
      return;
    }

    onSessionAction?.(action, sessionId);
  };

  const handlePanicMode = () => {
    Alert.alert(
      'Panic Mode',
      'This will immediately terminate all active sessions and clear all encrypted data. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Activate Panic Mode',
          style: 'destructive',
          onPress: () => {
            onPanicMode?.();
            onClose();
          }
        }
      ]
    );
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(selectedSessionId === sessionId ? null : sessionId);
  };

  const renderSessionItem = (session: any) => {
    const isSelected = selectedSessionId === session.sessionId;
    
    return (
      <View key={session.sessionId} style={styles.sessionItem}>
        <TouchableOpacity
          style={[styles.sessionHeader, isSelected && styles.sessionHeaderSelected]}
          onPress={() => handleSessionSelect(session.sessionId)}
        >
          <SessionStatusBadge
            session={session}
            variant="detailed"
            showCountdown={true}
            showHealthIndicator={true}
          />
          <Ionicons
            name={isSelected ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#8E8E93"
          />
        </TouchableOpacity>
        
        {isSelected && (
          <View style={styles.sessionDetails}>
            <View style={styles.sessionInfo}>
              <Text style={styles.infoLabel}>Created:</Text>
              <Text style={styles.infoValue}>
                {session.createdAt.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.sessionInfo}>
              <Text style={styles.infoLabel}>Last Activity:</Text>
              <Text style={styles.infoValue}>
                {session.lastActivityAt.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.sessionInfo}>
              <Text style={styles.infoLabel}>Device:</Text>
              <Text style={styles.infoValue}>
                {session.deviceFingerprint}
              </Text>
            </View>
            
            <View style={styles.sessionInfo}>
              <Text style={styles.infoLabel}>Security Level:</Text>
              <Text style={[styles.infoValue, styles.securityLevel]}>
                {session.securityLevel.toUpperCase()}
              </Text>
            </View>
            
            <SessionQuickActions
              session={session}
              onAction={handleSessionAction}
              layout="grid"
              style={styles.quickActions}
            />
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.title}>Session Manager</Text>
        <Text style={styles.subtitle}>
          {activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.panicButton}
          onPress={handlePanicMode}
          testID="panic-mode-button"
        >
          <Ionicons name="warning" size={18} color="#FFFFFF" />
          <Text style={styles.panicButtonText}>Panic</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          testID="close-button"
        >
          <Ionicons name="close" size={24} color="#1C1C1E" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSectionHeader = (title: string, count: number) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="shield-checkmark-outline" size={64} color="#8E8E93" />
      <Text style={styles.emptyTitle}>No Active Sessions</Text>
      <Text style={styles.emptySubtitle}>
        Use voice phrases to create secure sessions for encrypted journaling
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      testID={testID}
    >
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeSessions.length === 0 && expiredSessions.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {activeSessions.length > 0 && (
                <View style={styles.section}>
                  {renderSectionHeader('Active Sessions', activeSessions.length)}
                  {activeSessions.map(renderSessionItem)}
                </View>
              )}
              
              {expiredSessions.length > 0 && (
                <View style={styles.section}>
                  {renderSectionHeader('Recent Sessions', expiredSessions.length)}
                  {expiredSessions.map(renderSessionItem)}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  
  headerLeft: {
    flex: 1,
  },
  
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  panicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  
  panicButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  closeButton: {
    padding: 4,
  },
  
  content: {
    flex: 1,
  },
  
  section: {
    marginBottom: 24,
  },
  
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  
  sectionBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  sessionItem: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  
  sessionHeaderSelected: {
    backgroundColor: '#F8F9FA',
  },
  
  sessionDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  
  infoValue: {
    fontSize: 14,
    color: '#1C1C1E',
    flex: 1,
    textAlign: 'right',
  },
  
  securityLevel: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  
  quickActions: {
    marginTop: 12,
  },
  
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
  },
  
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
}); 