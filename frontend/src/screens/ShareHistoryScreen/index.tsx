import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { MainStackParamList } from '../../navigation/types';
import { ShareHistoryList, EmptyState } from './components';
import { useShareHistory } from '../../hooks/useShareHistory';
import { ShareListSkeleton } from '../../components/loading';
import { ShareErrorBoundary } from '../../components/errors';
import logger from '../../utils/logger';

type ShareHistoryScreenNavigationProp = StackNavigationProp<MainStackParamList>;

const ShareHistoryScreen: React.FC = () => {
  const navigation = useNavigation<ShareHistoryScreenNavigationProp>();
  const { theme } = useAppTheme();
  const styles = getShareHistoryStyles(theme);

  const {
    shares,
    loading,
    error,
    refreshing,
    fetchShares,
    refreshShares,
    deleteShare,
  } = useShareHistory();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch shares when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchShares();
    }, [fetchShares])
  );

  const handleSearch = useCallback(() => {
    setSearchVisible(!searchVisible);
    if (searchVisible) {
      setSearchQuery('');
    }
  }, [searchVisible]);

  const handleSharePress = useCallback((shareId: string) => {
    logger.info('[ShareHistoryScreen] Share item pressed', { shareId });
    // Navigate to share preview screen
    navigation.navigate('SharePreview', {
      shareId,
      fromHistory: true,
    } as any);
  }, [navigation]);

  const handleDeleteShare = useCallback(async (shareId: string, shareTitle: string) => {
    Alert.alert(
      'Delete Share',
      `Are you sure you want to delete "${shareTitle}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteShare(shareId);
              Alert.alert('Success', 'Share deleted successfully');
            } catch (error) {
              logger.error('[ShareHistoryScreen] Failed to delete share', error);
              Alert.alert('Error', 'Failed to delete share. Please try again.');
            }
          }
        }
      ]
    );
  }, [deleteShare]);

  const handleReshare = useCallback((shareId: string) => {
    logger.info('[ShareHistoryScreen] Re-share pressed', { shareId });
    // Navigate back to share preview with re-share option
    navigation.navigate('SharePreview', {
      shareId,
      fromHistory: true,
      enableReshare: true,
    } as any);
  }, [navigation]);

  const filteredShares = shares.filter(share =>
    searchQuery === '' ||
    share.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (share.template_name && share.template_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading && shares.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Share History</Text>
          <View style={{ width: 24 }} />
        </View>
        <ShareListSkeleton itemCount={5} showSearch={false} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Share History</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
          <Text style={[styles.errorTitle, { color: theme.colors.error }]}>
            Failed to Load History
          </Text>
          <Text style={[styles.errorMessage, { color: theme.colors.textMuted }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={fetchShares}
          >
            <Text style={[styles.retryText, { color: theme.colors.primaryContrast }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Share History</Text>
        <TouchableOpacity onPress={handleSearch}>
          <Ionicons 
            name={searchVisible ? "close" : "search"} 
            size={24} 
            color={theme.colors.text} 
          />
        </TouchableOpacity>
      </View>

      {searchVisible && (
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="search" size={20} color={theme.colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            onChangeText={setSearchQuery}
            placeholder="Search shares..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
          />
        </View>
      )}

      {filteredShares.length === 0 ? (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshShares}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          <EmptyState
            hasShares={shares.length > 0}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        </ScrollView>
      ) : (
        <ShareHistoryList
          shares={filteredShares}
          onSharePress={handleSharePress}
          onDeleteShare={handleDeleteShare}
          onReshare={handleReshare}
          refreshing={refreshing}
          onRefresh={refreshShares}
        />
      )}
    </SafeAreaView>
  );
};

const getShareHistoryStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  errorTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  retryText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default ShareHistoryScreen;
