import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../../../contexts/ThemeContext';

interface ConsentModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  entryCount: number;
  dateRangeLabel: string;
}

const ConsentModal: React.FC<ConsentModalProps> = ({ visible, onConfirm, onCancel, entryCount, dateRangeLabel }) => {
  const { theme } = useAppTheme();
  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: '#00000088',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    card: {
      width: '100%',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
    },
    title: {
      fontSize: theme.typography.fontSizes.lg,
      fontFamily: theme.typography.fontFamilies.semiBold,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    text: {
      fontSize: theme.typography.fontSizes.sm,
      fontFamily: theme.typography.fontFamilies.regular,
      color: theme.colors.text,
      lineHeight: 22,
    },
    warning: {
      marginTop: theme.spacing.md,
      color: theme.colors.warning,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    button: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
    },
    confirm: {
      backgroundColor: theme.colors.primary,
    },
    cancel: {
      backgroundColor: theme.colors.border,
    },
    btnText: {
      color: theme.colors.primaryContrast,
      fontFamily: theme.typography.fontFamilies.semiBold,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>AI Processing Consent</Text>
          <Text style={styles.text}>
            Your journal entries will be sent to Google's Gemini AI service to generate a personalized summary report.
          </Text>
          <Text style={[styles.text, styles.warning]}>
            Entries to be processed: {entryCount} ({dateRangeLabel})
          </Text>
          <Text style={[styles.text, { marginTop: theme.spacing.sm }]}>
            <Text style={{ fontFamily: theme.typography.fontFamilies.semiBold }}>Data Privacy:</Text>
            {'\n'}• Your entries will be temporarily sent to Google's AI service
            {'\n'}• Google may retain data for up to 55 days for abuse monitoring only
            {'\n'}• Your data will NOT be used to train AI models
            {'\n'}• We do not permanently store your plaintext entries
            {'\n'}• We only audit consent details (timeframe and entry count)
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={[styles.button, styles.cancel]} accessibilityRole="button">
              <Text style={[styles.btnText, { color: theme.colors.text } ]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={[styles.button, styles.confirm]} accessibilityRole="button">
              <Text style={styles.btnText}>I Consent</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConsentModal;


