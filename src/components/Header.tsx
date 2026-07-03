import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { t } from '@/i18n';

function handleBack() {
  // Checked at press time, not render time: canGoBack() can lag one tick
  // behind the real stack right after a router.replace(), so a render-time
  // check can hide the button entirely with no fallback. Falling back to a
  // known route keeps the affordance functional either way.
  if (router.canGoBack()) router.back();
  else router.replace('/torneos');
}

export function Header({
  title,
  showBack = true,
  onEdit,
}: {
  title: string;
  showBack?: boolean;
  onEdit?: () => void;
}) {
  return (
    <View className="mb-4 flex-row items-center">
      {showBack && (
        <Pressable onPress={handleBack} className="mr-3 py-1" hitSlop={12}>
          <Text className="text-pokeRed text-base font-semibold">{'‹ ' + t('common.back')}</Text>
        </Pressable>
      )}
      <Text className="flex-1 text-2xl font-bold text-ink-100">{title}</Text>
      {onEdit && (
        <Pressable onPress={onEdit} hitSlop={12} className="ml-2 py-1">
          <Text className="text-lg text-ink-400">✎</Text>
        </Pressable>
      )}
    </View>
  );
}
