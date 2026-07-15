// Pure tournament-shape validation, extracted out of tournamentStore.ts so it
// can be reused by src/lib/backup.ts (the global backup codec) without that
// module having to import the store itself — the store pulls in AsyncStorage
// at module load, which would break running backup.ts's logic in plain Node
// (e.g. the round-trip test script, or any future unit test).
import { isFinished } from './bracket';
import { isDoubleElimFinished } from './doubleElimBracket';
import { isLeagueFinished } from './leagueFormat';
import type { BracketSection, Match, Participant, Tournament, TournamentFormat } from '@/types/tournament';

export const VALID_BRACKET_SECTIONS: BracketSection[] = ['winners', 'losers', 'final'];

export function statusFor(matches: Tournament['matches'], format: TournamentFormat): Tournament['status'] {
  const finished =
    format === 'double' ? isDoubleElimFinished(matches) : format === 'league' ? isLeagueFinished(matches) : isFinished(matches);
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
  const format: TournamentFormat = raw.format === 'double' ? 'double' : raw.format === 'league' ? 'league' : 'single';

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
  if (participants.length < 2) return null;

  function isValidPlayerRef(value: unknown): value is string | null {
    return value === null || (typeof value === 'string' && participantIds.has(value));
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
    });
  }
  if (matches.length === 0) return null;

  // Purely cosmetic (organizer-entered matchday labels), so a malformed
  // entry is just dropped rather than failing the whole import over it.
  let matchdayDates: Record<string, string> | undefined;
  if (raw.matchdayDates && typeof raw.matchdayDates === 'object') {
    matchdayDates = {};
    for (const [round, date] of Object.entries(raw.matchdayDates as Record<string, unknown>)) {
      if (typeof date === 'string') matchdayDates[round] = date;
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
    status: statusFor(matches, format),
    // Undo history doesn't travel across devices — the importing device can
    // only undo decisions it makes itself after this point.
    history: [],
    format,
    matchdayDates,
  };
}
