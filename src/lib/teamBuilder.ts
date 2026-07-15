import { ALL_POKEMON, getMoveData, getMoveset, getTier } from '@/lib/pokedex';
import { ALL_TYPES, getMultiplier, type PokeType } from '@/lib/typeChart';
import type { PokemonEntry, PvpTier } from '@/types/pokemon';

export const MAX_TEAM_SIZE = 6;

export type TeamWeakness = { type: PokeType; members: PokemonEntry[] };

// A "shared weakness" is a type that hits 2+ team members for x2 or more —
// a single member being weak to something isn't a team-building problem on
// its own, but two or more sharing it means one attack can threaten half the
// team at once. Pure type math, no tier/role data — see REGLA DE ORO in
// CLAUDE.md on why this V1 deliberately stays that way.
export function analyzeTeamWeaknesses(team: PokemonEntry[]): TeamWeakness[] {
  const result: TeamWeakness[] = [];
  for (const attackerType of ALL_TYPES) {
    const members = team.filter((p) => getMultiplier(attackerType, p.types as PokeType[]) >= 2);
    if (members.length >= 2) result.push({ type: attackerType, members });
  }
  return result.sort((a, b) => b.members.length - a.members.length);
}

export type TeamCandidate = { pokemon: PokemonEntry; covers: PokeType[]; tier: PvpTier | null };

// A battle format's legal roster is cumulative in PokeMMO's tiering (see
// data/tiers/pokemmo_tiers.json / CLAUDE.md Fase 3): an OU format allows
// anything not banned to Uber (ou+uu+nu), a UU format additionally bans the
// OU-tier mons (uu+nu only), NU allows only nu-tier. 'uber' here means "no
// restriction" (every tier legal), not "Uber-only".
export type PvpFormat = 'uber' | 'ou' | 'uu' | 'nu';

const FORMAT_LEGAL_TIERS: Record<PvpFormat, PvpTier[]> = {
  uber: ['uber', 'ou', 'uu', 'nu'],
  ou: ['ou', 'uu', 'nu'],
  uu: ['uu', 'nu'],
  nu: ['nu'],
};

export function isLegalInFormat(tier: PvpTier | null, format: PvpFormat): boolean {
  if (tier === null) return format === 'uber';
  return FORMAT_LEGAL_TIERS[format].includes(tier);
}

// Ranks every Pokemon not already on the team by how many of the team's
// shared weaknesses it resists or is immune to (x0.5 or less) — doesn't
// touch offense or movepool. Tier is exposed per-candidate and can optionally
// filter to a target battle format, but never re-sorts by "best tier" — this
// app doesn't know what format the user is actually building for, so
// picking one tier over another isn't its call to make (see CLAUDE.md V3
// note: the tier data is a dated snapshot of the wiki tables, see `asOf`).
export function suggestCandidates(
  weaknesses: TeamWeakness[],
  team: PokemonEntry[],
  format: PvpFormat = 'uber',
  limit = 15
): TeamCandidate[] {
  if (weaknesses.length === 0) return [];
  const excludeIds = new Set(team.map((p) => p.id));
  const weakTypes = weaknesses.map((w) => w.type);

  const scored: TeamCandidate[] = [];
  for (const p of ALL_POKEMON) {
    if (excludeIds.has(p.id)) continue;
    const tier = getTier(p)?.tier ?? null;
    if (!isLegalInFormat(tier, format)) continue;
    const covers = weakTypes.filter((wt) => getMultiplier(wt, p.types as PokeType[]) <= 0.5);
    if (covers.length > 0) scored.push({ pokemon: p, covers, tier });
  }

  scored.sort((a, b) => b.covers.length - a.covers.length);
  return scored.slice(0, limit);
}

// Shared by getAvailableAttackTypes() below and by the override path in
// analyzeOffensiveGaps() — both ultimately need "which attacking types does
// this list of move names give access to", the only difference being where
// the move name list comes from (the full moveset vs. a Mi caja build's
// actually-chosen moves).
function getAttackTypesFromMoveNames(moveNames: string[]): Set<PokeType> {
  const types = new Set<PokeType>();
  for (const name of moveNames) {
    const data = getMoveData(name);
    if (data && data.category !== 'status') types.add(data.type as PokeType);
  }
  return types;
}

// The full set of attacking types a Pokemon has *access to* — every
// damaging (non-status) move anywhere in its moveset (level-up/TM/egg/
// tutor), not a specific chosen 4-move loadout, since this app doesn't track
// which moves a player actually taught their Pokemon. This is deliberately
// an optimistic "could cover" set, not "currently covers".
function getAvailableAttackTypes(pokemon: PokemonEntry): Set<PokeType> {
  const moveset = getMoveset(pokemon);
  if (!moveset) return new Set<PokeType>();
  return getAttackTypesFromMoveNames(moveset.moves.map((m) => m.name));
}

// A "gap" is a defending type that NONE of the team's available move types
// hit for x2 or more — i.e. something the team has no good way to threaten,
// regardless of what any individual member's own type is. Same pure-math
// spirit as analyzeTeamWeaknesses(), just offense instead of defense.
//
// `realMovesByPokemonId` is an optional per-member override (keyed by
// PokemonEntry.id, which is unique within a team — the team builder already
// refuses to add a species twice) for members that came from a Mi caja
// build with actual moves chosen: instead of the optimistic "everything in
// the movepool" set, only those specific moves count for that member. This
// is additive and backward compatible — omitting the argument (every
// existing caller) reproduces the exact old optimistic-for-everyone
// behavior.
export function analyzeOffensiveGaps(
  team: PokemonEntry[],
  realMovesByPokemonId?: Partial<Record<number, string[]>>
): PokeType[] {
  if (team.length === 0) return [];
  const teamAttackTypes = new Set<PokeType>();
  for (const p of team) {
    const override = realMovesByPokemonId?.[p.id];
    const attackTypes = override ? getAttackTypesFromMoveNames(override) : getAvailableAttackTypes(p);
    for (const tp of attackTypes) teamAttackTypes.add(tp);
  }

  const gaps: PokeType[] = [];
  for (const defenderType of ALL_TYPES) {
    const covered = Array.from(teamAttackTypes).some((atkType) => getMultiplier(atkType, [defenderType]) >= 2);
    if (!covered) gaps.push(defenderType);
  }
  return gaps;
}
