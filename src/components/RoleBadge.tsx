import { Text, View } from 'react-native';

import { t } from '@/i18n';
import type { CombatRole } from '@/lib/role';

// Local to this one badge, same reasoning as TierBadge — roles aren't a
// recurring visual language elsewhere in the app.
const ROLE_COLORS: Record<CombatRole, string> = {
  physical: '#F0803C',
  special: '#B892F8',
  wall: '#8B95A3',
  speedster: '#F2C438',
  balanced: '#55C464',
};

const ROLE_LABEL_KEYS: Record<CombatRole, string> = {
  physical: 'pokedex.rolePhysical',
  special: 'pokedex.roleSpecial',
  wall: 'pokedex.roleWall',
  speedster: 'pokedex.roleSpeedster',
  balanced: 'pokedex.roleBalanced',
};

export function RoleBadge({ role }: { role: CombatRole }) {
  const color = ROLE_COLORS[role];
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}26` }}>
      <Text className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
        {t(ROLE_LABEL_KEYS[role])}
      </Text>
    </View>
  );
}
