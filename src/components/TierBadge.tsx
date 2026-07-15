import { Text, View } from 'react-native';

import { t } from '@/i18n';
import type { PvpTier } from '@/types/pokemon';

// Not part of the shared theme palette (src/theme/colors.js) since tiers
// aren't a recurring visual language elsewhere in the app the way Pokemon
// types are — kept local to this one badge instead of growing the shared
// palette for a single consumer.
const TIER_COLORS: Record<PvpTier, string> = {
  uber: '#E4383B',
  ou: '#F2C438',
  uu: '#4B9BE8',
  nu: '#8B95A3',
};

const TIER_LABEL_KEYS: Record<PvpTier, string> = {
  uber: 'pokedex.tierUber',
  ou: 'pokedex.tierOu',
  uu: 'pokedex.tierUu',
  nu: 'pokedex.tierNu',
};

export function TierBadge({ tier }: { tier: PvpTier }) {
  const color = TIER_COLORS[tier];
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}26` }}>
      <Text className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
        {t(TIER_LABEL_KEYS[tier])}
      </Text>
    </View>
  );
}
