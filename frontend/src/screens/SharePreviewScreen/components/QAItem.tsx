import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { AppTheme } from '../../../config/theme';

interface QAItemProps {
  question: string;
  answer: string;
  confidence: number;
  onEdit: (newAnswer: string) => void;
  isLast: boolean;
}

export const QAItem: React.FC<QAItemProps> = ({
  question,
  answer,
  confidence,
  onEdit,
  isLast
}) => {
  const { theme } = useAppTheme();
  const styles = getQAItemStyles(theme);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(answer);

  const handleStartEdit = () => {
    setEditedText(answer);
    setIsEditing(true);
  };

  const handleSave = () => {
    onEdit(editedText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(answer);
    setIsEditing(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return theme.colors.success;
    if (confidence >= 0.6) return theme.colors.warning;
    return theme.colors.error;
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'High confidence';
    if (confidence >= 0.6) return 'Medium confidence';
    return 'Low confidence - please review';
  };

  const getConfidenceIcon = (confidence: number): keyof typeof Ionicons.glyphMap => {
    if (confidence >= 0.8) return 'checkmark-circle';
    if (confidence >= 0.6) return 'warning';
    return 'alert-circle';
  };

  return (
    <View style={[
      styles.qaContainer,
      { backgroundColor: theme.colors.surface },
      !isLast && styles.qaBorder
    ]}>
      <Text style={[styles.question, { color: theme.colors.text }]}>
        {question}
      </Text>

      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={[
              styles.editInput,
              {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              }
            ]}
            value={editedText}
            onChangeText={setEditedText}
            multiline
            autoFocus
            placeholder="Enter your answer..."
            placeholderTextColor={theme.colors.textMuted}
            maxLength={1000}
          />
          <Text style={[styles.characterCount, { color: theme.colors.textMuted }]}>
            {editedText.length}/1000 characters
          </Text>
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.colors.border }]}
              onPress={handleCancel}
            >
              <Text style={[styles.cancelText, { color: theme.colors.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSave}
            >
              <Text style={[styles.saveText, { color: theme.colors.primaryContrast }]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.answerContainer}
          onPress={handleStartEdit}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Edit answer: ${answer}`}
          accessibilityHint="Tap to edit this answer"
        >
          <Text style={[styles.answer, { color: theme.colors.text }]}>
            {answer}
          </Text>
          
          <View style={styles.answerFooter}>
            <View style={styles.confidenceIndicator}>
              <Ionicons
                name={getConfidenceIcon(confidence)}
                size={16}
                color={getConfidenceColor(confidence)}
              />
              <Text style={[
                styles.confidenceText,
                { color: getConfidenceColor(confidence) }
              ]}>
                {getConfidenceText(confidence)}
              </Text>
            </View>
            
            <View style={styles.editHint}>
              <Ionicons name="pencil" size={14} color={theme.colors.textMuted} />
              <Text style={[styles.editHintText, { color: theme.colors.textMuted }]}>
                Tap to edit
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const getQAItemStyles = (theme: AppTheme) => StyleSheet.create({
  qaContainer: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  qaBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 0,
    paddingBottom: theme.spacing.lg,
  },
  question: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  answerContainer: {
    minHeight: 60,
  },
  answer: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  answerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceText: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.medium,
    marginLeft: theme.spacing.xs,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editHintText: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.regular,
    marginLeft: theme.spacing.xs,
  },
  editContainer: {
    marginTop: theme.spacing.sm,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  saveButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  saveText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default QAItem;

