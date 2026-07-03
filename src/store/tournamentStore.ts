import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { generateBracket, isFinished, setWinner as setSingleElimWinner, undoWinner as undoSingleElimWinner } from '@/lib/bracket';
import {
  generateDoubleElimBracket,
  isDoubleElimFinished,
  setDoubleElimWinner,
  undoDoubleElimWinner,
} from '@/lib/doubleElimBracket';
import { decodeFromCode, encodeToCode } from '@/lib/exportCode';
import { generateId } from '@/lib/id';
import type { BracketSection, Match, Participant, Tournament, TournamentFormat } from '@/types/tournament';

type TournamentStore = {
  tournaments: Tournament[];
  createTournament: (name: string, participantNames: string[], format?: TournamentFormat) => Tournament;
  renameTournament: (tournamentId: string, name: string) => void;
  setMatchWinner: (tournamentId: string, matchId: string, winnerId: string) => void;
  undoLastMatch: (tournamentId: string) => void;
  deleteTournament: (tournamentId: string) => void;
  exportTournament: (tournamentId: string) => string | null;
  importTournament: (code: string) => Tournament | null;
};

function statusFor(matches: Tournament['matches'], format: TournamentFormat): Tournament['status'] {
  const finished = format === 'double' ? isDoubleElimFinished(matches) : isFinished(matches);
  if (finished) return 'finished';
  // Bye wins are auto-resolved at creation time, before any human plays
  // anything, so they must not count as "the organizer started playing".
  const anyPlayed = matches.some((m) => m.winnerId && !m.isBye);
  return anyPlayed ? 'in_progress' : 'setup';
}

const VALID_BRACKET_SECTIONS: BracketSection[] = ['winners', 'losers', 'final'];

// Validates arbitrary decoded JSON from an import code before it's trusted as
// app state. Import is the one path that ingests data typed/copy-pasted by
// someone else, so a shallow shape check isn't enough — every id reference
// has to resolve to a declared participant, or downstream screens (which
// assume referential integrity) can crash or silently corrupt the bracket.
function parseImportedTournament(data: unknown): Tournament | null {
  if (typeof data !== 'object' || data === null) return null;
  const raw = data as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.name !== 'string') return null;
  if (typeof raw.createdAt !== 'string') return null;
  if (!Array.isArray(raw.participants) || !Array.isArray(raw.matches)) return null;
  const format: TournamentFormat = raw.format === 'double' ? 'double' : 'single';

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
  };
}

export const useTournamentStore = create<TournamentStore>()(
  persist(
    (set, get) => ({
      tournaments: [],

      createTournament: (name, participantNames, format = 'single') => {
        const participants = participantNames
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ id: generateId(), name: n }));
        const matches = format === 'double' ? generateDoubleElimBracket(participants) : generateBracket(participants);

        const tournament: Tournament = {
          id: generateId(),
          name: name.trim(),
          createdAt: new Date().toISOString(),
          participants,
          matches,
          status: statusFor(matches, format),
          history: [],
          format,
        };

        set((state) => ({ tournaments: [tournament, ...state.tournaments] }));
        return tournament;
      },

      renameTournament: (tournamentId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          tournaments: state.tournaments.map((t) => (t.id === tournamentId ? { ...t, name: trimmed } : t)),
        }));
      },

      setMatchWinner: (tournamentId, matchId, winnerId) => {
        set((state) => ({
          tournaments: state.tournaments.map((t) => {
            if (t.id !== tournamentId) return t;
            const matches =
              t.format === 'double'
                ? setDoubleElimWinner(t.matches, matchId, winnerId)
                : setSingleElimWinner(t.matches, matchId, winnerId);
            return { ...t, matches, status: statusFor(matches, t.format), history: [...t.history, matchId] };
          }),
        }));
      },

      undoLastMatch: (tournamentId) => {
        set((state) => ({
          tournaments: state.tournaments.map((t) => {
            if (t.id !== tournamentId || t.history.length === 0) return t;
            const lastMatchId = t.history[t.history.length - 1];
            const matches =
              t.format === 'double' ? undoDoubleElimWinner(t.matches, lastMatchId) : undoSingleElimWinner(t.matches, lastMatchId);
            return { ...t, matches, status: statusFor(matches, t.format), history: t.history.slice(0, -1) };
          }),
        }));
      },

      deleteTournament: (tournamentId) => {
        set((state) => ({
          tournaments: state.tournaments.filter((t) => t.id !== tournamentId),
        }));
      },

      exportTournament: (tournamentId) => {
        const tournament = get().tournaments.find((t) => t.id === tournamentId);
        if (!tournament) return null;
        return encodeToCode(tournament);
      },

      importTournament: (code) => {
        let tournament: Tournament | null;
        try {
          tournament = parseImportedTournament(decodeFromCode<unknown>(code));
        } catch {
          return null;
        }
        if (!tournament) return null;

        const validated = tournament;
        set((state) => {
          const withoutExisting = state.tournaments.filter((t) => t.id !== validated.id);
          return { tournaments: [validated, ...withoutExisting] };
        });
        return validated;
      },
    }),
    {
      name: 'pokemmo-tournaments',
      storage: createJSONStorage(() => AsyncStorage),
      // Backfills fields added after tournaments were already persisted on a
      // device (e.g. `history`/`format`, introduced for undo/double-elim) so
      // old local data doesn't crash on load instead of just missing the new
      // capability.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TournamentStore> | undefined;
        return {
          ...currentState,
          tournaments: (persisted?.tournaments ?? []).map((t) => ({
            ...t,
            history: t.history ?? [],
            format: t.format ?? 'single',
          })),
        };
      },
    }
  )
);
