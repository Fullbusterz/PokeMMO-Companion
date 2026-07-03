import { Text, View } from 'react-native';

import { t } from '@/i18n';

export function VsDivider() {
  return (
    <View className="flex-row items-center px-3">
      <View className="h-px flex-1 bg-ink-600" />
      <View className="mx-1.5 rounded-full border border-ink-600 bg-ink-900 px-2 py-0.5">
        <Text className="text-[10px] font-bold text-ink-400">{t('bracket.vs')}</Text>
      </View>
      <View className="h-px flex-1 bg-ink-600" />
    </View>
  );
}
