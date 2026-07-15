import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';

import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';

export function LanguageToggle() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const other = locale === 'es' ? 'en' : 'es';
  return (
    <PressScale
      haptic="select"
      scaleTo={0.9}
      onPress={() => setLocale(other)}
      className="flex-row items-center gap-1 rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5"
      accessibilityRole="button"
      accessibilityLabel={t('common.switchLanguage')}
    >
      <Ionicons name="language" size={14} color={colors.ink[300]} />
      <Text className="text-xs font-bold uppercase text-ink-200">{locale}</Text>
    </PressScale>
  );
}
