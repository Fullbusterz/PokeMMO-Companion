import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { generateBracket, setWinner as setSingleElimWinner, undoWinner as undoSingleElimWinner } from '@/lib/bracket';
import { generateDoubleElimBracket, setDoubleElimWinner, undoDoubleElimWinner } from '@/lib/doubleElimBracket';
import { generateLeagueMatches, setLeagueWinner, undoLeagueWinner } from '@/lib/leagueFormat';
import { decodeFromCode, encodeToCode } from '@/lib/exportCode';
import { generateId } from '@/lib/id';
import { parseImportedTournament, statusFor } from '@/lib/tournamentValidation';
import type { Tournament, TournamentFormat } from '@/types/tournament';

type TournamentStore = {
  tournaments: Tournament[];
  createTournament: (name: string, participantNames: string[], format?: TournamentFormat) => Tournament;
  renameTournament: (tournamentId: string, name: string) => void;
  setMatchWinner: (tournamentId: string, matchId: string, winnerId: string) => void;
  undoLastMatch: (tournamentId: string) => void;
  setMatchdayDate: (tournamentId: string, round: number, date: string) => void;
  deleteTournament: (tournamentId: string) => void;
  exportTournament: (tournamentId: string) => string | null;
  importTournament: (code: string) => Tournament | null;
};

export const useTournamentStore = create<TournamentStore>()(
  persist(
    (set, get) => ({
      tournaments: [],

      createTournament: (name, participantNames, format = 'single') => {
        const participants = participantNames
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ id: generateId(), name: n }));
        const matches =
          format === 'double'
            ? generateDoubleElimBracket(participants)
            : format === 'league'
              ? generateLeagueMatches(participants)
              : generateBracket(participants);

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
                : t.format === 'league'
                  ? setLeagueWinner(t.matches, matchId, winnerId)
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
              t.format === 'double'
                ? undoDoubleElimWinner(t.matches, lastMatchId)
                : t.format === 'league'
                  ? undoLeagueWinner(t.matches, lastMatchId)
                  : undoSingleElimWinner(t.matches, lastMatchId);
            return { ...t, matches, status: statusFor(matches, t.format), history: t.history.slice(0, -1) };
          }),
        }));
      },

      setMatchdayDate: (tournamentId, round, date) => {
        const trimmed = date.trim();
        set((state) => ({
          tournaments: state.tournaments.map((t) => {
            if (t.id !== tournamentId) return t;
            const matchdayDates = { ...(t.matchdayDates ?? {}) };
            if (trimmed) matchdayDates[String(round)] = trimmed;
            else delete matchdayDates[String(round)];
            return { ...t, matchdayDates };
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
            matchdayDates: t.matchdayDates ?? {},
          })),
        };
      },
    }
  )
);
