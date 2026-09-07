// Pure tournament-shape validation, extracted out of tournamentStore.ts so it
// can be reused by src/lib/backup.ts (the global backup codec) without that
// module having to import the store itself — the store pulls in AsyncStorage
// at module load, which would break running backup.ts's logic in plain Node
// (e.g. the round-trip test script, or any future unit test).
import { isFinished } from './bracket';
import { isDoubleElimFinished } from './doubleElimBracket';
import { isLeagueFinished } from './leagueFormat';
import { isSwissFinished } from './swissFormat';
import type {
  BettingConfig,
  BracketSection,
  Match,
  Participant,
  SwissConfig,
  Tournament,
  TournamentFormat,
} from '@/types/tournament';

export const VALID_BRACKET_SECTIONS: BracketSection[] = ['winners', 'losers', 'final'];

export const DEFAULT_SWISS_CONFIG: SwissConfig = { totalRounds: 5, bestOf: 1 };

export function statusFor(
  matches: Tournament['matches'],
  format: TournamentFormat,
  swiss?: SwissConfig
): Tournament['status'] {
  const finished =
    format === 'double'
      ? isDoubleElimFinished(matches)
      : format === 'league'
        ? isLeagueFinished(matches)
        : format === 'swiss'
          ? isSwissFinished(matches, swiss ?? DEFAULT_SWISS_CONFIG)
          : isFinished(matches);
  if (finished) return 'finished';
  // Bye wins are auto-resolved at creation time, before any human plays
  // anything, so they must not count as "the organizer started playing".
  const anyPlayed = matches.some((m) => m.winnerId && !m.isBye);
  return anyPlayed ? 'in_progress' : 'setup';
}

// Validates arbitrary decoded JSON (from a single-tournament import code, or
// from a tournament entry inside a full-app backup) before it's trusted as
// app state. Both import paths ingest data typed/copy-pasted by someone else,
// so a shallow shape check isn't enough — every id reference has to resolve
// to a declared participant, or downstream screens (which assume referential
// integrity) can crash or silently corrupt the bracket.
export function parseImportedTournament(data: unknown): Tournament | null {
  if (typeof data !== 'object' || data === null) return null;
  const raw = data as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.name !== 'string') return null;
  if (typeof raw.createdAt !== 'string') return null;
  if (!Array.isArray(raw.participants) || !Array.isArray(raw.matches)) return null;
  const format: TournamentFormat =
    raw.format === 'double'
      ? 'double'
      : raw.format === 'league'
        ? 'league'
        : raw.format === 'swiss'
          ? 'swiss'
          : 'single';

  const participants: Participant[] = [];
  const participantIds = new Set<string>();
  for (const p of raw.participants) {
    if (
      typeof p !== 'object' ||
      p === null ||
      typeof (p as Participant).id !== 'string' ||
      typeof (p as Participant).name !== 'string' ||
      participantIds.has((p as Participant).id)
    ) {
      return null;
    }
    participantIds.add((p as Participant).id);
    participants.push({ id: (p as Participant).id, name: (p as Participant).name });
  }
  // Every bracket/league format is corrupt without at least two players — but
  // a Swiss tournament legitimately starts EMPTY and fills up as people sign
  // themselves up through the share link, so it must survive the round trip
  // with an empty roster.
  if (format !== 'swiss' && participants.length < 2) return null;

  function isValidPlayerRef(value: unknown): value is string | null {
    return value === null || (typeof value === 'string' && participantIds.has(value));
  }

  // A malformed score is dropped rather than failing the import: `winnerId`
  // is the authoritative result, the score is only the Bo3 detail on top.
  function parseScore(value: unknown): { p1: number; p2: number } | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const raw = value as Record<string, unknown>;
    if (typeof raw.p1 !== 'number' || typeof raw.p2 !== 'number') return undefined;
    if (!Number.isInteger(raw.p1) || !Number.isInteger(raw.p2) || raw.p1 < 0 || raw.p2 < 0) return undefined;
    return { p1: raw.p1, p2: raw.p2 };
  }

  const matches: Match[] = [];
  const matchIds = new Set<string>();
  for (const m of raw.matches) {
    if (typeof m !== 'object' || m === null) return null;
    const match = m as Record<string, unknown>;
    const isValidBracket = match.bracket === undefined || VALID_BRACKET_SECTIONS.includes(match.bracket as BracketSection);
    if (
      typeof match.id !== 'string' ||
      matchIds.has(match.id) ||
      typeof match.round !== 'number' ||
      typeof match.slot !== 'number' ||
      !isValidPlayerRef(match.player1Id) ||
      !isValidPlayerRef(match.player2Id) ||
      !isValidPlayerRef(match.winnerId) ||
      (match.winnerId !== null && match.winnerId !== match.player1Id && match.winnerId !== match.player2Id) ||
      !isValidBracket
    ) {
      return null;
    }
    matchIds.add(match.id);
    matches.push({
      id: match.id,
      round: match.round,
      slot: match.slot,
      player1Id: match.player1Id as string | null,
      player2Id: match.player2Id as string | null,
      winnerId: match.winnerId as string | null,
      isBye: match.isBye === true,
      bracket: match.bracket as BracketSection | undefined,
      score: parseScore(match.score),
    });
  }
  // Same reasoning: Swiss has no matches at all until round 1 is paired, which
  // is exactly the window in which the link gets shared around.
  if (format !== 'swiss' && matches.length === 0) return null;

  // Purely cosmetic (organizer-entered matchday labels), so a malformed
  // entry is just dropped rather than failing the whole import over it.
  let matchdayDates: Record<string, string> | undefined;
  if (raw.matchdayDates && typeof raw.matchdayDates === 'object') {
    matchdayDates = {};
    for (const [round, date] of Object.entries(raw.matchdayDates as Record<string, unknown>)) {
      if (typeof date === 'string') matchdayDates[round] = date;
    }
  }

  // Swiss can't fall back to a default here the way matchdayDates can: the
  // round count decides when the event ends, so a swiss tournament arriving
  // without a usable config is rejected outright.
  let swiss: SwissConfig | undefined;
  if (format === 'swiss') {
    const rawSwiss = raw.swiss as Record<string, unknown> | undefined;
    if (typeof rawSwiss !== 'object' || rawSwiss === null) return null;
    const { totalRounds, bestOf } = rawSwiss;
    if (typeof totalRounds !== 'number' || !Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 32) {
      return null;
    }
    if (bestOf !== 1 && bestOf !== 3) return null;
    swiss = { totalRounds, bestOf };
  }

  // Betting config is dropped rather than fatal if malformed: the tournament
  // itself is still perfectly playable without the side game, so a bad value
  // should cost the betting, not the event.
  let betting: BettingConfig | undefined;
  const rawBetting = raw.betting as Record<string, unknown> | undefined;
  if (typeof rawBetting === 'object' && rawBetting !== null) {
    const { enabled, startingChips } = rawBetting;
    if (
      typeof enabled === 'boolean' &&
      typeof startingChips === 'number' &&
      Number.isInteger(startingChips) &&
      startingChips >= 1 &&
      startingChips <= 1000000
    ) {
      betting = { enabled, startingChips };
    }
  }

  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.createdAt,
    participants,
    matches,
    // Never trust the imported status verbatim — always recompute so a
    // hand-edited or stale code can't show a misleading state.
    status: statusFor(matches, format, swiss),
    // Undo history doesn't travel across devices — the importing device can
    // only undo decisions it makes itself after this point.
    history: [],
    format,
    matchdayDates,
    swiss,
    betting,
  };
}
