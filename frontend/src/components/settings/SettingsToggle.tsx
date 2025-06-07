import React from 'react';
import { Switch, ViewStyle } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import SettingsRow from './SettingsRow';
import { Ionicons } from '@expo/vector-icons';

interface SettingsToggleProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({
  title,
  subtitle,
  leftIcon,
  value,
  onValueChange,
  disabled = false,
  style,
  testID,
}) => {
  const { theme } = useAppTheme();

  const handleToggle = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  const switchElement = (
    <Switch
      trackColor={{ 
        false: theme.colors.gray300, 
        true: theme.colors.primary + '80' 
      }}
      thumbColor={value ? theme.colors.primary : theme.colors.gray100}
      ios_backgroundColor={theme.colors.gray300}
      onValueChange={onValueChange}
      value={value}
      disabled={disabled}
      accessibilityLabel={`${title} toggle`}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    />
  );

  return (
    <SettingsRow
      title={title}
      subtitle={subtitle}
      leftIcon={leftIcon}
      rightElement={switchElement}
      onPress={handleToggle}
      disabled={disabled}
      style={style}
      testID={testID}
    />
  );
};

export default SettingsToggle; 