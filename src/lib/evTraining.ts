// Pure EV-training session logic — no zustand, no AsyncStorage, nothing that
// can't run in plain Node (same spirit as src/lib/backup.ts). The thin
// AsyncStorage/zustand-touching layer lives in src/store/evSessionStore.ts,
// which imports the mutators below instead of re-implementing them.
import type { EvSpot, EvTrainingGuide } from './guides';

export const EV_STAT_KEYS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'] as const;
export type EvStatKey = (typeof EV_STAT_KEYS)[number];

// PokeMMO mirrors Gen 5's EV rules: 252 per stat, 510 total. The game never
// grants more than 252 in a single stat — extra EVs from further KOs are just
// wasted in-game — so the session counter caps here too instead of letting
// the number run past what's actually achievable, which would be misleading
// during a live session rather than useful. The 510 total is NOT enforced
// (PokeMMO itself doesn't block it either, it just warns) — see isOverEvCap,
// used by the UI to show a non-blocking warning.
export const EV_CAP_PER_STAT = 252;
export const EV_CAP_TOTAL = 510;

export type EvRecord = Record<EvStatKey, number>;

export function zeroEvRecord(): EvRecord {
  return EV_STAT_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as EvRecord);
}

export function totalEvs(current: EvRecord): number {
  return EV_STAT_KEYS.reduce((sum, key) => sum + current[key], 0);
}

export function isOverEvCap(current: EvRecord): boolean {
  return totalEvs(current) > EV_CAP_TOTAL;
}

export type EvHistoryEntry = { stat: EvStatKey; amount: number };

export type EvSessionCounters = {
  current: EvRecord;
  history: EvHistoryEntry[];
};

/**
 * Applies one increment (a single KO's worth, a full horde, or a manual
 * +1/+4/+10 tap) to a stat, capping at EV_CAP_PER_STAT. Returns a new object
 * (never mutates `state`). If the stat is already at the cap, or the
 * requested amount rounds down to zero once capped, this is a no-op and
 * nothing is pushed to history — there's nothing meaningful to undo.
 */
export function applyEvIncrement(state: EvSessionCounters, stat: EvStatKey, amount: number): EvSessionCounters {
  if (amount <= 0) return state;
  const currentValue = state.current[stat];
  if (currentValue >= EV_CAP_PER_STAT) return state;
  const applied = Math.min(amount, EV_CAP_PER_STAT - currentValue);
  if (applied <= 0) return state;
  return {
    current: { ...state.current, [stat]: currentValue + applied },
    history: [...state.history, { stat, amount: applied }],
  };
}

/**
 * Undoes exactly the last applied increment (LIFO, same spirit as
 * tournamentStore's match `history`) — restores the stat to precisely what
 * it was before that increment, since `history` stores the amount actually
 * applied (post-cap), not the amount requested. No-op if history is empty.
 */
export function undoLastEvIncrement(state: EvSessionCounters): EvSessionCounters {
  if (state.history.length === 0) return state;
  const last = state.history[state.history.length - 1];
  return {
    current: { ...state.current, [last.stat]: Math.max(0, state.current[last.stat] - last.amount) },
    history: state.history.slice(0, -1),
  };
}

export type EvZoneSource = 'bestSpots' | 'alternativeSpots';

/**
 * Points at one exact Pokémon entry inside one spot of
 * data/guides/ev-training.json — coordinates only, never a copy of the data,
 * so that JSON stays the single source of truth (resolved fresh on every
 * read via resolveEvZone instead of being denormalized into the session).
 */
export type EvZoneRef = {
  stat: EvStatKey;
  source: EvZoneSource;
  spotIndex: number;
  pokemonIndex: number;
};

export type ResolvedEvZone = {
  pokemonName: string;
  evsPerKo: number;
  hordeSize: number;
  details: string;
};

export type EvZoneOption = ResolvedEvZone & Pick<EvZoneRef, 'source' | 'spotIndex' | 'pokemonIndex'>;

function spotsFor(guide: EvTrainingGuide, source: EvZoneSource): EvSpot[] {
  return source === 'bestSpots' ? guide.bestSpots : guide.alternativeSpots;
}

/** Resolves a stored EvZoneRef back into display-ready data. Returns null if the guide's shape ever changes underneath a stored ref (defensive, shouldn't happen with static bundled data). */
export function resolveEvZone(guide: EvTrainingGuide, zone: EvZoneRef): ResolvedEvZone | null {
  const spot = spotsFor(guide, zone.source)[zone.spotIndex];
  const pokemon = spot?.pokemon[zone.pokemonIndex];
  if (!spot || !pokemon || pokemon.evs == null) return null;
  return { pokemonName: pokemon.pokemon, evsPerKo: pokemon.evs, hordeSize: pokemon.count, details: spot.details };
}

/**
 * All selectable (spot, pokemon) pairs for a given stat, from both
 * bestSpots and alternativeSpots — feeds the zone picker. levelingSpots is
 * deliberately excluded: those entries have no `stat`/`evs`, they're pure XP
 * farming spots, not EV spots.
 */
export function listEvZonesForStat(guide: EvTrainingGuide, stat: EvStatKey): EvZoneOption[] {
  const options: EvZoneOption[] = [];
  (['bestSpots', 'alternativeSpots'] as const).forEach((source) => {
    spotsFor(guide, source).forEach((spot, spotIndex) => {
      if (spot.stat !== stat) return;
      spot.pokemon.forEach((pokemon, pokemonIndex) => {
        if (pokemon.evs == null) return;
        options.push({
          source,
          spotIndex,
          pokemonIndex,
          pokemonName: pokemon.pokemon,
          evsPerKo: pokemon.evs,
          hordeSize: pokemon.count,
          details: spot.details,
        });
      });
    });
  });
  return options;
}
