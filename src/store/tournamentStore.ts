import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { generateBracket, setWinner as setSingleElimWinner, undoWinner as undoSingleElimWinner } from '@/lib/bracket';
import { generateDoubleElimBracket, setDoubleElimWinner, undoDoubleElimWinner } from '@/lib/doubleElimBracket';
import { generateLeagueMatches, setLeagueWinner, undoLeagueWinner } from '@/lib/leagueFormat';
import {
  generateSwissRound,
  getTotalSwissRounds,
  isRoundComplete,
  setSwissResult,
  undoSwissResult,
} from '@/lib/swissFormat';
import { decodeFromCode, encodeToCode } from '@/lib/exportCode';
import { generateId } from '@/lib/id';
import { DEFAULT_SWISS_CONFIG, parseImportedTournament, statusFor } from '@/lib/tournamentValidation';
import type { MatchScore, OnlineLink, SwissConfig, Tournament, TournamentFormat } from '@/types/tournament';

type TournamentStore = {
  tournaments: Tournament[];
  createTournament: (
    name: string,
    participantNames: string[],
    format?: TournamentFormat,
    swiss?: SwissConfig
  ) => Tournament;
  renameTournament: (tournamentId: string, name: string) => void;
  setMatchWinner: (tournamentId: string, matchId: string, winnerId: string, score?: MatchScore) => void;
  undoLastMatch: (tournamentId: string) => void;
  setMatchdayDate: (tournamentId: string, round: number, date: string) => void;
  deleteTournament: (tournamentId: string) => void;
  exportTournament: (tournamentId: string) => string | null;
  importTournament: (code: string) => Tournament | null;
  // Swiss only.
  startNextSwissRound: (tournamentId: string) => { started: boolean; hadToRepeatPairing: boolean };
  setSwissTotalRounds: (tournamentId: string, totalRounds: number) => void;
  addSwissParticipant: (tournamentId: string, name: string) => boolean;
  removeSwissParticipant: (tournamentId: string, participantId: string) => void;
  setOnlineLink: (tournamentId: string, online: OnlineLink | undefined) => void;
  replaceTournament: (tournament: Tournament) => void;
};

export const useTournamentStore = create<TournamentStore>()(
  persist(
    (set, get) => ({
      tournaments: [],

      createTournament: (name, participantNames, format = 'single', swiss) => {
        const participants = participantNames
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ id: generateId(), name: n }));
        const swissConfig = format === 'swiss' ? (swiss ?? DEFAULT_SWISS_CONFIG) : undefined;
        // Swiss starts with NO matches at all, unlike every other format.
        // Pairing round 1 is what closes sign-ups, so leaving it to an
        // explicit tap is what lets players keep arriving through the share
        // link (and lets the organizer fix a typo in the roster) right up
        // until the tournament actually begins.
        const matches =
          format === 'double'
            ? generateDoubleElimBracket(participants)
            : format === 'league'
              ? generateLeagueMatches(participants)
              : format === 'swiss'
                ? []
                : generateBracket(participants);

        const tournament: Tournament = {
          id: generateId(),
          name: name.trim(),
          createdAt: new Date().toISOString(),
          participants,
          matches,
          status: statusFor(matches, format, swissConfig),
          history: [],
          format,
          swiss: swissConfig,
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

      setMatchWinner: (tournamentId, matchId, winnerId, score) => {
        set((state) => ({
          tournaments: state.tournaments.map((t) => {
            if (t.id !== tournamentId) return t;
            const matches =
              t.format === 'double'
                ? setDoubleElimWinner(t.matches, matchId, winnerId)
                : t.format === 'league'
                  ? setLeagueWinner(t.matches, matchId, winnerId)
                  : t.format === 'swiss'
                    ? setSwissResult(t.matches, matchId, winnerId, score)
                    : setSingleElimWinner(t.matches, matchId, winnerId);
            return {
              ...t,
              matches,
              status: statusFor(matches, t.format, t.swiss),
              history: [...t.history, matchId],
            };
          }),
        }));
      },

      undoLastMatch: (tournamentId) => {
        set((state) => ({
          tournaments: state.tournaments.map((t) => {
            if (t.id !== tournamentId || t.history.length === 0) return t;
            const lastMatchId = t.history[t.history.length - 1];
            // Swiss guard: a later round's pairings were computed FROM this
            // result, so undoing it would leave the tournament describing
            // matchups that the standings no longer justify. Only the
            // newest round can be corrected.
            if (t.format === 'swiss') {
              const match = t.matches.find((m) => m.id === lastMatchId);
              if (!match || match.round < getTotalSwissRounds(t.matches)) return t;
            }
            const matches =
              t.format === 'double'
                ? undoDoubleElimWinner(t.matches, lastMatchId)
                : t.format === 'league'
                  ? undoLeagueWinner(t.matches, lastMatchId)
                  : t.format === 'swiss'
                    ? undoSwissResult(t.matches, lastMatchId)
                    : undoSingleElimWinner(t.matches, lastMatchId);
            return {
              ...t,
              matches,
              status: statusFor(matches, t.format, t.swiss),
              history: t.history.slice(0, -1),
            };
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

      // Pairs the next round from the current standings. Refuses while the
      // current round still has undecided matches — pairing on incomplete
      // standings is the classic way to produce an unfair Swiss round.
      startNextSwissRound: (tournamentId) => {
        const tournament = get().tournaments.find((t) => t.id === tournamentId);
        if (!tournament || tournament.format !== 'swiss') return { started: false, hadToRepeatPairing: false };
        const config = tournament.swiss ?? DEFAULT_SWISS_CONFIG;
        const currentRound = getTotalSwissRounds(tournament.matches);
        if (currentRound >= config.totalRounds) return { started: false, hadToRepeatPairing: false };
        if (currentRound > 0 && !isRoundComplete(tournament.matches, currentRound)) {
          return { started: false, hadToRepeatPairing: false };
        }
        if (tournament.participants.length < 2) return { started: false, hadToRepeatPairing: false };

        const { matches: roundMatches, hadToRepeatPairing } = generateSwissRound(
          tournament.participants,
          tournament.matches,
          currentRound + 1
        );
        set((state) => ({
          tournaments: state.tournaments.map((t) => {
            if (t.id !== tournamentId) return t;
            const matches = [...t.matches, ...roundMatches];
            return { ...t, matches, status: statusFor(matches, t.format, t.swiss) };
          }),
        }));
        return { started: true, hadToRepeatPairing };
      },

      // Extending a finished event to a 6th round (or trimming it back before
      // that round is paired) — the only part of the Swiss config that can
      // change once play has started.
      setSwissTotalRounds: (tournamentId, totalRounds) => {
        set((state) => ({
          tournaments: state.tournaments.map((t) => {
            if (t.id !== tournamentId || t.format !== 'swiss' || !t.swiss) return t;
            const played = getTotalSwissRounds(t.matches);
            const clamped = Math.max(played, Math.min(32, Math.round(totalRounds)));
            const swiss = { ...t.swiss, totalRounds: clamped };
            return { ...t, swiss, status: statusFor(t.matches, t.format, swiss) };
          }),
        }));
      },

      // Sign-ups only make sense before round 1 is paired; afterwards a new
      // player would have a structurally impossible record.
      addSwissParticipant: (tournamentId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        const tournament = get().tournaments.find((t) => t.id === tournamentId);
        if (!tournament || tournament.format !== 'swiss') return false;
        if (getTotalSwissRounds(tournament.matches) > 0) return false;
        if (tournament.participants.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return false;

        set((state) => ({
          tournaments: state.tournaments.map((t) =>
            t.id === tournamentId
              ? { ...t, participants: [...t.participants, { id: generateId(), name: trimmed }] }
              : t
          ),
        }));
        return true;
      },

      removeSwissParticipant: (tournamentId, participantId) => {
        set((state) => ({
          tournaments: state.tournaments.map((t) => {
            if (t.id !== tournamentId || t.format !== 'swiss') return t;
            if (getTotalSwissRounds(t.matches) > 0) return t;
            return { ...t, participants: t.participants.filter((p) => p.id !== participantId) };
          }),
        }));
      },

      setOnlineLink: (tournamentId, online) => {
        set((state) => ({
          tournaments: state.tournaments.map((t) => (t.id === tournamentId ? { ...t, online } : t)),
        }));
      },

      // Used by the online sync when the server copy is newer than this
      // device's (another organizer device pushed, or a player's sign-up
      // landed). Keeps the local `online` credentials, which never travel.
      replaceTournament: (tournament) => {
        set((state) => ({
          tournaments: state.tournaments.map((t) =>
            t.id === tournament.id ? { ...tournament, online: t.online ?? tournament.online } : t
          ),
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
            // Swiss arrived after these were already on devices; a stored
            // swiss tournament without a config would never know when to end.
            swiss: t.format === 'swiss' ? (t.swiss ?? DEFAULT_SWISS_CONFIG) : t.swiss,
          })),
        };
      },
    }
  )
);
