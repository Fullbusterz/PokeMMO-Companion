import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import colors from '@/theme/colors';

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
    <View className="mb-4 flex-row items-center border-b border-ink-700 pb-4">
      {showBack && (
        <PressScale
          haptic="select"
          scaleTo={0.9}
          onPress={handleBack}
          className="mr-3 flex-row items-center gap-0.5 py-1"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={18} color={colors.pokeRed.DEFAULT} />
          <Text className="text-pokeRed text-base font-semibold">{t('common.back')}</Text>
        </PressScale>
      )}
      <Text className="flex-1 text-2xl font-bold text-ink-100">{title}</Text>
      {onEdit && (
        <PressScale haptic="select" scaleTo={0.85} onPress={onEdit} hitSlop={12} className="ml-2 rounded-full p-2 active:bg-ink-700">
          <Ionicons name="pencil" size={16} color={colors.ink[400]} />
        </PressScale>
      )}
    </View>
  );
}
