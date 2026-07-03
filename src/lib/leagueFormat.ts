import type { Match, Participant } from '@/types/tournament';

// Circle method: fixes index 0, rotates the rest by one position each round.
// Standard algorithm for a complete round-robin schedule in exactly n-1
// rounds (n even) where every pair of indices meets in exactly one round.
function circleMethodRounds(n: number): [number, number][][] {
  const rounds: [number, number][][] = [];
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let round = 0; round < n - 1; round++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([arr[i], arr[n - 1 - i]]);
    }
    rounds.push(pairs);
    const last = arr.pop() as number;
    arr.splice(1, 0, last);
  }
  return rounds;
}

export function getTotalLeagueRounds(matches: Match[]): number {
  return matches.reduce((max, m) => Math.max(max, m.round), 0);
}

// Every participant plays every other exactly once. Odd counts get a phantom
// opponent (index === participants.length, outside the real id range) so
// each real player sits out exactly one round instead of the schedule
// breaking — that round's match is flagged isBye and never resolves to a
// winner. Unlike bracket.ts's byes, there's no elimination to auto-advance,
// so it just stays empty for the whole tournament.
export function generateLeagueMatches(participants: Participant[]): Match[] {
  const ids = participants.map((p) => p.id);
  const n = ids.length;
  const hasPhantom = n % 2 !== 0;
  const size = hasPhantom ? n + 1 : n;
  const rounds = circleMethodRounds(size);

  const matches: Match[] = [];
  rounds.forEach((pairs, roundIndex) => {
    pairs.forEach(([a, b], slotIndex) => {
      const player1Id = a < n ? ids[a] : null;
      const player2Id = b < n ? ids[b] : null;
      matches.push({
        id: `r${roundIndex + 1}-m${slotIndex}`,
        round: roundIndex + 1,
        slot: slotIndex,
        player1Id,
        player2Id,
        winnerId: null,
        isBye: player1Id === null || player2Id === null,
      });
    });
  });
  return matches;
}

// League matches never propagate anywhere — every pairing is fixed at
// generation time, so setting/undoing a winner only ever touches the one
// match it's called on (no "next round slot" to feed, unlike bracket.ts).
export function setLeagueWinner(matches: Match[], matchId: string, winnerId: string): Match[] {
  return matches.map((m) => (m.id === matchId ? { ...m, winnerId } : m));
}

export function undoLeagueWinner(matches: Match[], matchId: string): Match[] {
  const match = matches.find((m) => m.id === matchId);
  if (!match || !match.winnerId || match.isBye) return matches;
  return matches.map((m) => (m.id === matchId ? { ...m, winnerId: null } : m));
}

export function isLeagueFinished(matches: Match[]): boolean {
  return matches.every((m) => m.isBye || m.winnerId !== null);
}

export type LeagueStanding = {
  participantId: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
};

// 3 points per win, 0 per loss — no draws exist, every non-bye match
// resolves to exactly one winner. Ties break by wins, then fewer losses,
// then original participant order, so the table doesn't reshuffle sideways
// between renders once points and wins are equal.
export function computeStandings(matches: Match[], participants: Participant[]): LeagueStanding[] {
  const standings = new Map<string, LeagueStanding>();
  participants.forEach((p) =>
    standings.set(p.id, { participantId: p.id, played: 0, wins: 0, losses: 0, points: 0 })
  );

  for (const match of matches) {
    if (match.isBye || !match.winnerId) continue;
    const loserId = match.winnerId === match.player1Id ? match.player2Id : match.player1Id;
    const winner = standings.get(match.winnerId);
    const loser = loserId ? standings.get(loserId) : undefined;
    if (winner) {
      winner.played += 1;
      winner.wins += 1;
      winner.points += 3;
    }
    if (loser) {
      loser.played += 1;
      loser.losses += 1;
    }
  }

  const order = participants.map((p) => p.id);
  return [...standings.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return order.indexOf(a.participantId) - order.indexOf(b.participantId);
  });
}
