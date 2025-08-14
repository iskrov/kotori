import React from 'react';
import { FlatList, RefreshControl, ListRenderItem } from 'react-native';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { ShareHistoryItem } from '../../../hooks/useShareHistory';
import { ShareHistoryItem as ShareHistoryItemComponent } from './ShareHistoryItem';

interface ShareHistoryListProps {
  shares: ShareHistoryItem[];
  onSharePress: (shareId: string) => void;
  onDeleteShare: (shareId: string, shareTitle: string) => void;
  onReshare: (shareId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export const ShareHistoryList: React.FC<ShareHistoryListProps> = ({
  shares,
  onSharePress,
  onDeleteShare,
  onReshare,
  refreshing,
  onRefresh,
}) => {
  const { theme } = useAppTheme();

  const renderItem: ListRenderItem<ShareHistoryItem> = ({ item, index }) => (
    <ShareHistoryItemComponent
      share={item}
      onPress={() => onSharePress(item.id)}
      onDelete={() => onDeleteShare(item.id, item.title)}
      onReshare={() => onReshare(item.id)}
      isLast={index === shares.length - 1}
    />
  );

  const keyExtractor = (item: ShareHistoryItem) => item.id;

  return (
    <FlatList
      data={shares}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
    />
  );
};

export default ShareHistoryList;
