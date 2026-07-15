import type { PokemonStats } from '@/types/pokemon';

export type CombatRole = 'physical' | 'special' | 'wall' | 'speedster' | 'balanced';

// A heuristic, not a PokeMMO-verified fact — see REGLA DE ORO in CLAUDE.md.
// It only ever looks at raw base stats (base stats ARE safe to use as-is,
// unlike movesets/abilities/tiers — see the historical stats/type audit in
// project memory), never at movepool, items, or actual competitive usage.
// Any UI that shows this must label it as a heuristic, not a real tier/role.
export function computeRole(stats: PokemonStats): CombatRole {
  const bulk = (stats.hp + stats.defense + stats.spDefense) / 3;
  const offense = Math.max(stats.attack, stats.spAttack);

  if (stats.speed > bulk * 1.15 && stats.speed > offense * 0.9) return 'speedster';
  if (bulk > offense * 1.15) return 'wall';
  if (stats.attack > stats.spAttack * 1.2) return 'physical';
  if (stats.spAttack > stats.attack * 1.2) return 'special';
  return 'balanced';
}

export const ALL_ROLES: CombatRole[] = ['physical', 'special', 'wall', 'speedster', 'balanced'];
