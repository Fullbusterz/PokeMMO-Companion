import type { Match, Participant, SwissConfig } from '@/types/tournament';

// Swiss is the only format whose pairings can't be generated up front: round
// N+1 depends on the standings after round N. So unlike bracket.ts /
// leagueFormat.ts (which emit the whole schedule at creation time), this
// module emits ONE round at a time and the store appends it once the previous
// round is fully decided.

export const WIN_POINTS = 3;
export const LOSS_POINTS = 0;

export type SwissStanding = {
  participantId: string;
  played: number;
  wins: number;
  losses: number;
  byes: number;
  points: number;
  // Bo3 only (Bo1 mirrors wins/losses). Counted from Match.score.
  gamesWon: number;
  gamesLost: number;
  // Sum of the match points of everyone this player actually faced. Byes
  // contribute nothing (there's no opponent to sum), which is the usual
  // "unplayed rounds score 0" convention — a player who got the bye is
  // therefore slightly penalised on tiebreaks, on purpose: they had an
  // easier round than everyone else.
  buchholz: number;
  opponentIds: string[];
};

function emptyStanding(participantId: string): SwissStanding {
  return {
    participantId,
    played: 0,
    wins: 0,
    losses: 0,
    byes: 0,
    points: 0,
    gamesWon: 0,
    gamesLost: 0,
    buchholz: 0,
    opponentIds: [],
  };
}

// A match counts as decided once it has a winner, or once it's a bye (byes
// are awarded at pairing time and never played).
export function isDecided(match: Match): boolean {
  return match.isBye || match.winnerId !== null;
}

export function getTotalSwissRounds(matches: Match[]): number {
  return matches.reduce((max, m) => Math.max(max, m.round), 0);
}

export function matchesOfRound(matches: Match[], round: number): Match[] {
  return matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
}

export function isRoundComplete(matches: Match[], round: number): boolean {
  const list = matchesOfRound(matches, round);
  return list.length > 0 && list.every(isDecided);
}

// Whether a round contains a pairing that already happened in an earlier
// round. generateSwissRound reports this at pairing time, but that answer is
// gone by the next render — and Alert.alert is a no-op on web, where this app
// mostly runs. Deriving it from the match list means the warning survives a
// reload, a re-import, and the organizer's other device.
export function roundHasRepeatedPairing(matches: Match[], round: number): boolean {
  const seen = new Set<string>();
  for (const m of matches) {
    if (m.isBye || !m.player1Id || !m.player2Id || m.round >= round) continue;
    seen.add(pairKey(m.player1Id, m.player2Id));
  }
  return matches.some(
    (m) => m.round === round && !m.isBye && m.player1Id && m.player2Id && seen.has(pairKey(m.player1Id, m.player2Id))
  );
}

export function computeSwissStandings(matches: Match[], participants: Participant[]): SwissStanding[] {
  const byId = new Map<string, SwissStanding>();
  participants.forEach((p) => byId.set(p.id, emptyStanding(p.id)));

  for (const match of matches) {
    if (!isDecided(match)) continue;

    if (match.isBye) {
      // A bye is a free win: same points as beating someone, but it doesn't
      // add an opponent (so it can't inflate Buchholz) and it's tracked
      // separately so the pairing code never hands the same player two.
      const restingId = match.player1Id ?? match.player2Id;
      const standing = restingId ? byId.get(restingId) : undefined;
      if (standing) {
        standing.byes += 1;
        standing.points += WIN_POINTS;
      }
      continue;
    }

    const { player1Id, player2Id, winnerId, score } = match;
    if (!player1Id || !player2Id || !winnerId) continue;
    const s1 = byId.get(player1Id);
    const s2 = byId.get(player2Id);
    if (!s1 || !s2) continue;

    s1.played += 1;
    s2.played += 1;
    s1.opponentIds.push(player2Id);
    s2.opponentIds.push(player1Id);

    // Bo1 matches carry no score; treat them as a 1-0 so game tiebreaks stay
    // meaningful (and comparable) in a tournament that mixes neither.
    const g1 = score ? score.p1 : winnerId === player1Id ? 1 : 0;
    const g2 = score ? score.p2 : winnerId === player2Id ? 1 : 0;
    s1.gamesWon += g1;
    s1.gamesLost += g2;
    s2.gamesWon += g2;
    s2.gamesLost += g1;

    if (winnerId === player1Id) {
      s1.wins += 1;
      s1.points += WIN_POINTS;
      s2.losses += 1;
      s2.points += LOSS_POINTS;
    } else {
      s2.wins += 1;
      s2.points += WIN_POINTS;
      s1.losses += 1;
      s1.points += LOSS_POINTS;
    }
  }

  // Second pass: Buchholz needs every player's final points, so it can only
  // be summed once the loop above has finished.
  for (const standing of byId.values()) {
    standing.buchholz = standing.opponentIds.reduce((sum, oppId) => sum + (byId.get(oppId)?.points ?? 0), 0);
  }

  return sortStandings([...byId.values()], matches, participants);
}

// Who beat whom, among players tied on points and Buchholz. Only meaningful
// for a pair that actually met; returns 0 otherwise (including a 1-1 split,
// which can't happen in Swiss but costs nothing to handle).
function headToHead(a: string, b: string, matches: Match[]): number {
  let balance = 0;
  for (const m of matches) {
    if (m.isBye || !m.winnerId) continue;
    const isPair =
      (m.player1Id === a && m.player2Id === b) || (m.player1Id === b && m.player2Id === a);
    if (!isPair) continue;
    balance += m.winnerId === a ? 1 : -1;
  }
  return balance;
}

export function sortStandings(
  standings: SwissStanding[],
  matches: Match[],
  participants: Participant[]
): SwissStanding[] {
  const order = new Map(participants.map((p, i) => [p.id, i]));
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    const h2h = headToHead(b.participantId, a.participantId, matches);
    if (h2h !== 0) return h2h;
    const diffA = a.gamesWon - a.gamesLost;
    const diffB = b.gamesWon - b.gamesLost;
    if (diffB !== diffA) return diffB - diffA;
    if (b.wins !== a.wins) return b.wins - a.wins;
    // Last resort: creation order, so the table never reshuffles sideways
    // between renders for players who are genuinely tied on everything.
    return (order.get(a.participantId) ?? 0) - (order.get(b.participantId) ?? 0);
  });
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function playedPairs(matches: Match[]): Set<string> {
  const set = new Set<string>();
  for (const m of matches) {
    if (m.isBye || !m.player1Id || !m.player2Id) continue;
    set.add(pairKey(m.player1Id, m.player2Id));
  }
  return set;
}

// Exhaustive pairing with backtracking: takes the highest-ranked unpaired
// player and tries opponents in rank order (closest score first, which is
// what makes it Swiss), recursing on the rest. Backtracking matters — a
// greedy pass can paint itself into a corner where the last two players have
// already met, and with 9 players over 5-6 rounds that happens often enough
// to be worth solving properly rather than reshuffling at random.
function pairOrdered(ordered: string[], forbidden: Set<string>): [string, string][] | null {
  if (ordered.length === 0) return [];
  const [first, ...rest] = ordered;
  for (let i = 0; i < rest.length; i++) {
    if (forbidden.has(pairKey(first, rest[i]))) continue;
    const remaining = rest.filter((_, j) => j !== i);
    const sub = pairOrdered(remaining, forbidden);
    if (sub) return [[first, rest[i]], ...sub];
  }
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type SwissPairingResult = {
  matches: Match[];
  // True when no rematch-free pairing existed and the algorithm had to allow
  // a repeat. With 9 players it takes ~7 rounds to become unavoidable, so in
  // a 5-6 round event this should stay false — but the UI surfaces it rather
  // than silently pairing a rematch.
  hadToRepeatPairing: boolean;
};

// Picks who sits out an odd round: the lowest-ranked player who hasn't had a
// bye yet. Standard practice, and it keeps the free 3 points away from the
// leaders. Everyone having had one already can only happen if rounds >
// players, which the round cap prevents.
function pickByePlayer(rankedIds: string[], standings: Map<string, SwissStanding>): string {
  for (let i = rankedIds.length - 1; i >= 0; i--) {
    const id = rankedIds[i];
    if ((standings.get(id)?.byes ?? 0) === 0) return id;
  }
  return rankedIds[rankedIds.length - 1];
}

export function generateSwissRound(
  participants: Participant[],
  previousMatches: Match[],
  round: number
): SwissPairingResult {
  if (participants.length < 2) {
    throw new Error(`generateSwissRound: needs at least 2 participants, got ${participants.length}`);
  }

  const standings = computeSwissStandings(previousMatches, participants);
  const standingById = new Map(standings.map((s) => [s.participantId, s]));

  // Round 1 has no standings to sort by, so the draw is random — same as
  // every other format's round 1 in this app.
  const rankedIds =
    round === 1 ? shuffle(participants.map((p) => p.id)) : standings.map((s) => s.participantId);

  const matches: Match[] = [];
  let slot = 0;
  let toPair = rankedIds;

  if (rankedIds.length % 2 !== 0) {
    const byeId = pickByePlayer(rankedIds, standingById);
    toPair = rankedIds.filter((id) => id !== byeId);
    matches.push({
      id: `r${round}-bye`,
      round,
      slot: -1, // sorts above the played matches; re-indexed below
      player1Id: byeId,
      player2Id: null,
      winnerId: byeId,
      isBye: true,
    });
  }

  const forbidden = playedPairs(previousMatches);
  let pairs = pairOrdered(toPair, forbidden);
  const hadToRepeatPairing = pairs === null;
  // Everyone has already faced everyone they could: pair by rank anyway
  // rather than refusing to start the round.
  if (!pairs) pairs = pairOrdered(toPair, new Set<string>());
  if (!pairs) throw new Error('generateSwissRound: could not pair an even number of players');

  for (const [p1, p2] of pairs) {
    matches.push({
      id: `r${round}-m${slot}`,
      round,
      slot,
      player1Id: p1,
      player2Id: p2,
      winnerId: null,
      isBye: false,
    });
    slot += 1;
  }

  // The bye card renders last in the round (it's not a match anyone plays),
  // so give it the trailing slot now that the real count is known.
  const bye = matches.find((m) => m.isBye);
  if (bye) bye.slot = slot;

  return { matches: matches.sort((a, b) => a.slot - b.slot), hadToRepeatPairing };
}

// Bo1: the winner is the whole result. Bo3: the score has to reach 2 wins for
// exactly one side, and the loser can't have more than 1 — anything else is a
// typo (or a tampered import) rather than a real Bo3 outcome.
export function isValidScore(score: { p1: number; p2: number }, bestOf: 1 | 3): boolean {
  const target = bestOf === 3 ? 2 : 1;
  const { p1, p2 } = score;
  if (!Number.isInteger(p1) || !Number.isInteger(p2) || p1 < 0 || p2 < 0) return false;
  if (p1 === p2) return false; // no draws in this format
  const max = Math.max(p1, p2);
  const min = Math.min(p1, p2);
  return max === target && min < target;
}

export function setSwissResult(
  matches: Match[],
  matchId: string,
  winnerId: string,
  score?: { p1: number; p2: number }
): Match[] {
  return matches.map((m) => {
    if (m.id !== matchId || m.isBye) return m;
    if (winnerId !== m.player1Id && winnerId !== m.player2Id) return m;
    return { ...m, winnerId, score };
  });
}

export function undoSwissResult(matches: Match[], matchId: string): Match[] {
  const match = matches.find((m) => m.id === matchId);
  if (!match || !match.winnerId || match.isBye) return matches;
  return matches.map((m) => (m.id === matchId ? { ...m, winnerId: null, score: undefined } : m));
}

// The tournament is over once the configured number of rounds has been played
// out. `totalRounds` is what the organizer chose (5 by default) and can be
// raised mid-event to break a tie, so this reads the config rather than the
// match list's own max round.
export function isSwissFinished(matches: Match[], config: SwissConfig): boolean {
  if (getTotalSwissRounds(matches) < config.totalRounds) return false;
  return isRoundComplete(matches, config.totalRounds);
}

// How many rounds a Swiss event of this size should have, for the "recommended"
// hint on the create screen: the smallest R where 2^R >= players, which is the
// point at which a single undefeated player is mathematically isolated.
export function recommendedRounds(playerCount: number): number {
  let rounds = 1;
  while (2 ** rounds < playerCount) rounds += 1;
  return rounds;
}

// Hard cap: with N players nobody can play more than N-1 distinct opponents,
// so more rounds than that would force rematches by construction.
export function maxRounds(playerCount: number): number {
  return Math.max(1, playerCount - 1);
}
