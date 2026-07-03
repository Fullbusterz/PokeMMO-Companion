import { Text, View } from 'react-native';

import { t } from '@/i18n';

export function VsDivider() {
  return (
    <View className="flex-row items-center px-3">
      <View className="h-px flex-1 bg-ink-600" />
      <Text className="px-2 text-[10px] font-bold text-ink-400">{t('bracket.vs')}</Text>
      <View className="h-px flex-1 bg-ink-600" />
    </View>
  );
}
