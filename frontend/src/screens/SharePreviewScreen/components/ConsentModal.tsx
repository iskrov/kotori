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
      lineHeight: 20,
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
          <Text style={styles.title}>Share processing consent</Text>
          <Text style={styles.text}>We will process your journal entries to generate answers for the selected template.</Text>
          <Text style={[styles.text, styles.warning]}>Entries to be processed: {entryCount} ({dateRangeLabel})</Text>
          <Text style={[styles.text, { marginTop: theme.spacing.sm }]}>We won't store your plaintext entries; we only audit consent details (timeframe and entry count).</Text>
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


