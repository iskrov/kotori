import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Animated,
  Dimensions,
  ScrollView,
  TextInput
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { JournalAPI } from '../../services/api';
import { JournalEntry, Tag } from '../../types';
import { MainStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import hapticService from '../../services/hapticService';
import TagInput from '../../components/TagInput';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Define the type for the route params
type JournalEntryDetailRouteProp = RouteProp<MainStackParamList, 'JournalEntryDetail'>;

// Define the type for the navigation prop
type JournalEntryDetailNavigationProp = StackNavigationProp<MainStackParamList, 'JournalEntryDetail'>;

const JournalEntryDetailScreen = () => {
  const navigation = useNavigation<JournalEntryDetailNavigationProp>();
  const route = useRoute<JournalEntryDetailRouteProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { entryId } = route.params;
  
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Unified edit state - everything is editable when enabled
  const [isEditMode, setIsEditMode] = useState(false); // Start in view mode by default
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Text input refs to handle focus issues
  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);
  
  // Animated header
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  });
  
  useFocusEffect(
    useCallback(() => {
      fetchEntryDetails();
      
      return () => {
        // Reset animations when leaving
        fadeAnim.setValue(0);
        slideAnim.setValue(50);
        scaleAnim.setValue(0.95);
      };
    }, [entryId])
  );

  useEffect(() => {
    if (entry) {
      // Animate in the content
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [entry]);
  
  const fetchEntryDetails = async () => {
    try {
      setIsLoading(true);
      const response = await JournalAPI.getEntry(parseInt(entryId));
      const entryData = response.data;
      setEntry(entryData);
      
      // Initialize edit state
      setEditTitle(entryData.title || '');
      setEditContent(entryData.content || '');
      setEditTags(entryData.tags || []);
    } catch (error) {
      console.error('Error fetching entry details', error);
      Alert.alert('Error', 'Failed to load journal entry details');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleEdit = () => {
    hapticService.light();
    setIsEditMode(!isEditMode);
  };
  
  const handleSaveChanges = async () => {
    if (!entry) {
      console.error('No entry to save');
      return;
    }
    
    try {
      setIsSaving(true);
      hapticService.light();
      
      const updateData = {
        title: editTitle,
        content: editContent,
        tags: editTags.map(tag => tag.name)
      };
      
      const response = await JournalAPI.updateEntry(parseInt(entryId), updateData);
      console.log('Entry saved successfully');
      
      // Update local entry state with new values
      const updatedEntry = {
        ...entry,
        title: editTitle,
        content: editContent,
        tags: editTags
      };
      setEntry(updatedEntry);
      setIsEditMode(false);
      
      // Show success feedback
      hapticService.success();
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', `Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      hapticService.error();
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCancelEdit = () => {
    hapticService.light();
    // Reset to original values
    if (entry) {
      setEditTitle(entry.title || '');
      setEditContent(entry.content || '');
      setEditTags(entry.tags || []);
    }
    setIsEditMode(false);
  };
  
  const handleDelete = async () => {
    hapticService.medium();
    navigation.navigate('DeleteConfirmation', { entryId });
  };

  const handleBack = () => {
    hapticService.light();
    if (isEditMode) {
      // Ask to save or discard changes
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. What would you like to do?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              handleCancelEdit();
              navigation.goBack();
            }
          },
          {
            text: 'Save & Exit',
            onPress: async () => {
              await handleSaveChanges();
              navigation.goBack();
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your entry...</Text>
        </View>
      </View>
    );
  }
  
  if (!entry) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Ionicons name="document-text-outline" size={80} color={theme.colors.textSecondary} />
          <Text style={styles.errorTitle}>Entry Not Found</Text>
          <Text style={styles.errorText}>This journal entry might have been deleted or moved.</Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.white} />
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const entryDate = parseISO(entry.entry_date);
  const isToday = format(new Date(), 'yyyy-MM-dd') === format(entryDate, 'yyyy-MM-dd');
  const isYesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') === format(entryDate, 'yyyy-MM-dd');

  const getDateDisplayText = () => {
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return format(entryDate, 'EEEE, MMMM d');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating Header */}
      <Animated.View 
        style={[
          styles.floatingHeader,
          {
            opacity: headerOpacity,
            transform: [{ scale: headerScale }]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.headerBackButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.floatingHeaderTitle} numberOfLines={1}>
          {entry.title || 'Journal Entry'}
        </Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* Main Header */}
      <View style={styles.mainHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {isEditMode ? (
            <>
              <TouchableOpacity 
                style={[styles.headerActionButton, isSaving && { opacity: 0.5 }]}
                onPress={() => {
                  // Blur text inputs first to prevent focus interference on web
                  titleInputRef.current?.blur();
                  contentInputRef.current?.blur();
                  handleSaveChanges();
                }}
                activeOpacity={0.7}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons name="checkmark" size={24} color={theme.colors.success} />
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerActionButton}
                onPress={handleToggleEdit}
                activeOpacity={0.7}
              >
                <Ionicons name="eye-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.headerActionButton}
              onPress={handleToggleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.headerActionButton, styles.deleteHeaderButton]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      
      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          {/* Hero Date Section */}
          <View style={styles.heroSection}>
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>{getDateDisplayText()}</Text>
              <Text style={styles.fullDateText}>
                {format(entryDate, 'MMMM d, yyyy')}
              </Text>
              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.timeText}>
                  {format(entryDate, 'h:mm a')}
                </Text>
              </View>
            </View>
            {entry.audio_url && (
              <View style={styles.audioIndicator}>
                <Ionicons name="musical-notes" size={24} color={theme.colors.accent} />
                <Text style={styles.audioText}>Audio</Text>
              </View>
            )}
          </View>

          {/* Unified Title and Content Section */}
          <View style={styles.entrySection}>
            <View style={styles.entryHeader}>
              <Ionicons name="document-text" size={20} color={theme.colors.primary} />
              <Text style={styles.entryHeaderText}>Your Entry</Text>
              {isEditMode && (
                <Text style={styles.editModeIndicator}>Editing</Text>
              )}
            </View>
            
            {/* Title - Always Visible, Editable in Edit Mode */}
            <View style={styles.titleSection}>
              {isEditMode ? (
                <TextInput
                  ref={titleInputRef}
                  style={styles.titleInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Enter title..."
                  multiline={false}
                  maxLength={100}
                />
              ) : (
                <Text style={styles.entryTitle}>
                  {entry.title || 'Untitled Entry'}
                </Text>
              )}
            </View>
            
            {/* Content - Always Visible, Editable in Edit Mode */}
            <View style={styles.contentSection}>
              {isEditMode ? (
                <TextInput
                  ref={contentInputRef}
                  style={styles.contentInput}
                  value={editContent}
                  onChangeText={setEditContent}
                  placeholder="What's on your mind?"
                  multiline={true}
                  numberOfLines={8}
                  textAlignVertical="top"
                />
              ) : (
                <Text style={styles.entryText}>{entry.content}</Text>
              )}
            </View>

            {/* Record Button - Available in Edit Mode */}
            {isEditMode && (
              <View style={styles.recordSection}>
                <TouchableOpacity 
                  style={styles.recordButton}
                  onPress={() => {
                    hapticService.light();
                    navigation.navigate('Record', { journalId: entryId });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mic" size={20} color={theme.colors.white} />
                  <Text style={styles.recordButtonText}>Record</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Tags Section - Always Editable */}
          <View style={styles.tagsSection}>
            <View style={styles.tagsHeader}>
              <Ionicons name="pricetags" size={20} color={theme.colors.primary} />
              <Text style={styles.tagsHeaderText}>Tags</Text>
              {!isEditMode && (
                <View style={styles.tagCount}>
                  <Text style={styles.tagCountText}>{entry.tags?.length || 0}</Text>
                </View>
              )}
            </View>
            
            {isEditMode ? (
              <TagInput
                tags={editTags}
                onChangeTags={setEditTags}
                placeholder="Add tags..."
                maxTags={10}
              />
            ) : (
              entry.tags && entry.tags.length > 0 && (
                <View style={styles.tagsList}>
                  {entry.tags.map((tag: Tag, index: number) => (
                    <Animated.View 
                      key={tag.id ? String(tag.id) : `${entry.id}-tag-${index}`}
                      style={[
                        styles.tag,
                        {
                          transform: [{
                            scale: fadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.8, 1],
                            })
                          }]
                        }
                      ]}
                    >
                      <Text style={styles.tagText}>{tag.name}</Text>
                    </Animated.View>
                  ))}
                </View>
              )
            )}
          </View>

          {/* Stats Section */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>Entry Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Ionicons name="text-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.statValue}>
                  {isEditMode ? editContent.length : entry.content.length}
                </Text>
                <Text style={styles.statLabel}>Characters</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="library-outline" size={24} color={theme.colors.accent} />
                <Text style={styles.statValue}>
                  {isEditMode 
                    ? editContent.split(' ').filter(word => word.length > 0).length 
                    : entry.content.split(' ').length
                  }
                </Text>
                <Text style={styles.statLabel}>Words</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="pricetags-outline" size={24} color={theme.colors.secondary} />
                <Text style={styles.statValue}>
                  {isEditMode ? editTags.length : (entry.tags?.length || 0)}
                </Text>
                <Text style={styles.statLabel}>Tags</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>
      
      {/* Floating Action Buttons */}
      <Animated.View 
        style={[
          styles.floatingActions,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <TouchableOpacity 
          style={[styles.fab, styles.editFab]} 
          onPress={handleToggleEdit}
          activeOpacity={0.8}
        >
          <Ionicons name="create" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.fab, styles.deleteFab]} 
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Ionicons name="trash" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

// Function to generate styles based on the theme
const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.lg,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  errorTitle: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  errorText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    ...theme.shadows.md,
  },
  errorButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: theme.colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 1000,
    ...theme.shadows.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  floatingHeaderTitle: {
    flex: 1,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginHorizontal: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  headerSpacer: {
    width: 40,
  },
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  deleteHeaderButton: {
    backgroundColor: theme.colors.errorLight + '20',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120, // Space for FABs
  },
  heroSection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    ...theme.shadows.lg,
    borderWidth: theme.isDarkMode ? 1 : 0,
    borderColor: theme.colors.border,
  },
  dateContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: theme.typography.fontSizes.xxxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.bold,
    letterSpacing: -1,
  },
  fullDateText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
  },
  timeText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  audioIndicator: {
    alignItems: 'center',
    backgroundColor: theme.colors.accentLight + '20',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 2,
    borderColor: theme.colors.accent + '30',
  },
  audioText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.accent,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  entrySection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.md,
    borderWidth: theme.isDarkMode ? 1 : 0,
    borderColor: theme.colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  entryHeaderText: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  entryTitle: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeights.tight * theme.typography.fontSizes.xxl,
    fontFamily: theme.typography.fontFamilies.bold,
    letterSpacing: -0.5,
    marginBottom: theme.spacing.lg,
  },
  entryText: {
    fontSize: theme.typography.fontSizes.lg,
    lineHeight: theme.typography.lineHeights.loose * theme.typography.fontSizes.lg,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    letterSpacing: 0.3,
  },
  tagsSection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.md,
    borderWidth: theme.isDarkMode ? 1 : 0,
    borderColor: theme.colors.border,
  },
  tagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tagsHeaderText: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    flex: 1,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  tagCount: {
    backgroundColor: theme.colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagCountText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.white,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamilies.bold,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tag: {
    backgroundColor: theme.colors.primaryLight + '20',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.primary + '30',
    ...theme.shadows.sm,
  },
  tagText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
    letterSpacing: 0.5,
  },
  statsSection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.md,
    borderWidth: theme.isDarkMode ? 1 : 0,
    borderColor: theme.colors.border,
  },
  statsTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  statLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  floatingActions: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 85,
    right: theme.spacing.lg,
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.xl,
    elevation: 8,
  },
  editFab: {
    backgroundColor: theme.colors.primary,
  },
  deleteFab: {
    backgroundColor: theme.colors.error,
  },
  // Inline edit styles
  editModeIndicator: {
    marginLeft: 'auto',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight + '20',
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  titleSection: {
    marginBottom: theme.spacing.lg,
  },
  titleInput: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 50,
  },
  contentSection: {
    marginBottom: theme.spacing.lg,
  },
  contentInput: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 150,
    lineHeight: theme.typography.lineHeights.loose * theme.typography.fontSizes.md,
  },
  recordSection: {
    alignItems: 'center',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.md,
  },
  recordButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default JournalEntryDetailScreen; 