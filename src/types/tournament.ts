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
};

export type TournamentStatus = 'setup' | 'in_progress' | 'finished';
export type TournamentFormat = 'single' | 'double' | 'league';

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
};
