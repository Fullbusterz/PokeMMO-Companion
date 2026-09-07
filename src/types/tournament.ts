export type Participant = {
  id: string;
  name: string;
};

// Only present on double-elimination matches, to tell winners-bracket,
// losers-bracket, and the single grand-final match apart. Single-elimination
// matches omit it entirely — there's only one implicit bracket.
export type BracketSection = 'winners' | 'losers' | 'final';

export type Match = {
  id: string;
  round: number;
  slot: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  // True only for a round-1 match auto-resolved because its opponent slot is
  // structurally empty (bracket padding). Lets status/history logic tell
  // "decided by a bye" apart from "decided by an actual match".
  isBye: boolean;
  bracket?: BracketSection;
  // Swiss only, and only for Bo3: games won by each side (2-0 / 2-1). Bo1
  // matches leave it undefined — `winnerId` already says everything.
  score?: MatchScore;
};

export type MatchScore = { p1: number; p2: number };

export type TournamentStatus = 'setup' | 'in_progress' | 'finished';
export type TournamentFormat = 'single' | 'double' | 'league' | 'swiss';

export type SwissConfig = {
  // What the organizer chose at creation (5 by default). Can be raised
  // mid-event — the "add a 6th round" case — so it's config, not a
  // derived property of the match list.
  totalRounds: number;
  bestOf: 1 | 3;
};

export type Tournament = {
  id: string;
  name: string;
  createdAt: string;
  participants: Participant[];
  matches: Match[];
  status: TournamentStatus;
  // Chronological match ids decided by a human tap (never a bye). Undo pops
  // the last entry — strictly LIFO order guarantees it's always safe: no
  // later round can already depend on a decision that hasn't happened yet.
  history: string[];
  format: TournamentFormat;
  // League only: free-text, organizer-entered date per matchday (round
  // number as string key). Purely informational — the app has no
  // notifications/reminders, so this is never read for scheduling logic.
  matchdayDates?: Record<string, string>;
  // Swiss only. Absent on every other format.
  swiss?: SwissConfig;
  // Set once the tournament has been published to Supabase. `secret` is the
  // organizer key — it stays on the organizer's device and is what authorises
  // writes; it is deliberately NOT part of the share link.
  online?: OnlineLink;
};

export type OnlineLink = {
  // Public id used in the share link (/torneos/unirse/<code>).
  code: string;
  secret: string;
  // Server timestamp of the last push, to spot a stale local copy.
  syncedAt: string | null;
};
