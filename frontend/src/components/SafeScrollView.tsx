import React from 'react';
import { ScrollView, ScrollViewProps, Platform } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface SafeScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  extraBottomPadding?: number;
}

const SafeScrollView: React.FC<SafeScrollViewProps> = ({
  children,
  extraBottomPadding = 0,
  contentContainerStyle,
  ...props
}) => {
  const { theme } = useAppTheme();

  // Calculate safe bottom padding
  // Tab bar height + FAB height + some extra spacing
  const tabBarHeight = Platform.OS === 'ios' ? 88 : 75;
  const fabHeight = 64;
  const fabBottomMargin = Platform.OS === 'ios' ? 100 : 85;
  const extraSpacing = theme.spacing.xl;
  
  // Use the larger of FAB bottom position or tab bar height, plus extra spacing
  // Increased padding to ensure content is fully accessible
  const safeBottomPadding = Math.max(fabBottomMargin + fabHeight/2, tabBarHeight) + extraSpacing + extraBottomPadding + 40;

  const safeContentContainerStyle = [
    {
      paddingBottom: safeBottomPadding,
    },
    contentContainerStyle,
  ];

  return (
    <ScrollView
      {...props}
      contentContainerStyle={safeContentContainerStyle}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
};

export default SafeScrollView; 