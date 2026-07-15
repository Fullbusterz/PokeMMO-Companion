import moveLearnersData from '../../data/reference/move-learners.json';
import { getMoveData, getPokemonById, getTier } from '@/lib/pokedex';
import type { PokeType } from '@/lib/typeChart';
import type { PokemonEntry, PvpTier } from '@/types/pokemon';

// Reverse index of movesets.json (move name -> which dex ids learn it, by
// any method: level/TM/egg/tutor), generated once by a scratch Node script
// (not checked into the repo) that scans the 5 regions' movesets.json files.
// ~464KB uncompressed — under the ~600KB threshold this project uses to
// decide between eager import and the loadRegionMovesets()-style lazy
// require() (see src/lib/pokedex.ts), so this stays a plain top-level import.
// Regenerate by re-running that script if movesets.json ever changes.
const MOVE_LEARNERS = moveLearnersData as Record<string, number[]>;

// Every Pokemon that learns `moveName` by any method, across all 5 regions.
// Sorted by dex id (ascending) — this is a plain lookup, not a ranking.
export function getLearners(moveName: string): PokemonEntry[] {
  const ids = MOVE_LEARNERS[moveName];
  if (!ids) return [];
  return ids.map((id) => getPokemonById(id)).filter((p): p is PokemonEntry => Boolean(p));
}

export type RecommendedLearner = {
  pokemon: PokemonEntry;
  // Structured reasons the UI renders as chips (e.g. "STAB · 130 Ata · OU") —
  // deliberately never collapsed into an opaque sentence, so any screen that
  // shows this can pick its own wording/order per the project's i18n rules.
  reasons: {
    /** The move's type is one of this Pokemon's own types (Same-Type Attack Bonus). */
    hasStab: boolean;
    /** Raw base stat (Attack for physical moves, Sp. Attack for special) — not a computed in-battle stat. */
    attackStat: number;
    /** Shown for context only — see "tier solo se muestra, no ordena" below. null = no PvP tier data at all. */
    tier: PvpTier | null;
  };
};

// Scored + sorted recommendations, for damage-dealing moves only. A status
// move (category "status") has no offensive stat to score against — there's
// no honest way to rank "who should learn Thunder Wave" from base stats
// alone, so this deliberately returns null (not an empty array) to let
// callers distinguish "not applicable to this move" from "applicable, but
// nobody learns it". Callers should fall back to the plain getLearners()
// list for status moves.
//
// Sort order (STAB first, then raw offensive stat descending): tier is
// exposed in `reasons.tier` for display only and never used to order the
// list — same reasoning already documented for the team builder's
// suggestCandidates()/isLegalInFormat() in src/lib/teamBuilder.ts: the app
// doesn't know what format the player cares about, so it doesn't get to
// decide an OU Pokemon is "better" than an NU one.
export function getRecommendedLearners(moveName: string): RecommendedLearner[] | null {
  const move = getMoveData(moveName);
  if (!move || move.category === 'status') return null;

  const statKey = move.category === 'physical' ? 'attack' : 'spAttack';
  const moveType = move.type as PokeType;

  const scored: RecommendedLearner[] = getLearners(moveName)
    .map((pokemon) => ({
      pokemon,
      reasons: {
        hasStab: (pokemon.types as PokeType[]).includes(moveType),
        attackStat: pokemon.baseStats[statKey],
        tier: getTier(pokemon)?.tier ?? null,
      },
    }))
    // tier === null means the species is absent from the wiki's OU/UU/NU
    // eligibility tables — not obtainable/usable in PokeMMO (Groudon, Mewtwo,
    // etc.). Recommending an uncatchable Pokemon would be actively misleading,
    // so they're excluded here; the plain getLearners() list still includes
    // them, since "it CAN learn the move" remains true data.
    .filter((entry) => entry.reasons.tier !== null);

  scored.sort((a, b) => {
    if (a.reasons.hasStab !== b.reasons.hasStab) return a.reasons.hasStab ? -1 : 1;
    return b.reasons.attackStat - a.reasons.attackStat;
  });

  return scored;
}
