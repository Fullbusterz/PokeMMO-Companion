import { Text, View } from 'react-native';

import { t } from '@/i18n';
import type { PokeType } from '@/lib/typeChart';
import colors from '@/theme/colors';

// Tailwind/nativewind can't generate `bg-type-${type}` classes at build time
// for a dynamic type name (JIT only picks up literal strings it can scan) —
// this is the one place that legitimately needs inline styles sourced from
// the same shared color tokens everything else uses.
export function TypeBadge({ type }: { type: PokeType }) {
  const color = colors.type[type];
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}26` }}>
      <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
        {t(`types.${type}`)}
      </Text>
    </View>
  );
}
