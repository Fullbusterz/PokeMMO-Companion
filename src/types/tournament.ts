export type Participant = {
  id: string;
  name: string;
};

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
};

export type TournamentStatus = 'setup' | 'in_progress' | 'finished';

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
};
