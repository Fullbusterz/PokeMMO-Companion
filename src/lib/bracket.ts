import type { Match, Participant } from '@/types/tournament';

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getTotalRounds(matches: Match[]): number {
  return matches.reduce((max, m) => Math.max(max, m.round), 0);
}

export function setWinner(matches: Match[], matchId: string, winnerId: string): Match[] {
  const match = matches.find((m) => m.id === matchId);
  if (!match) return matches;

  const totalRounds = getTotalRounds(matches);
  const nextMatchId =
    match.round < totalRounds ? `r${match.round + 1}-m${Math.floor(match.slot / 2)}` : null;
  const isFirstSlotOfPair = match.slot % 2 === 0;

  return matches.map((m) => {
    if (m.id === matchId) return { ...m, winnerId };
    if (m.id === nextMatchId) {
      return isFirstSlotOfPair ? { ...m, player1Id: winnerId } : { ...m, player2Id: winnerId };
    }
    return m;
  });
}

// Mirror of setWinner: clears a match's winner and the slot it propagated
// into the next round. Refuses byes — those are never in a tournament's
// human-decision history, so a caller passing one here is a bug upstream,
// not a state we should silently "fix" by undoing it anyway.
export function undoWinner(matches: Match[], matchId: string): Match[] {
  const match = matches.find((m) => m.id === matchId);
  if (!match || !match.winnerId || match.isBye) return matches;

  const totalRounds = getTotalRounds(matches);
  const nextMatchId =
    match.round < totalRounds ? `r${match.round + 1}-m${Math.floor(match.slot / 2)}` : null;
  const isFirstSlotOfPair = match.slot % 2 === 0;

  return matches.map((m) => {
    if (m.id === matchId) return { ...m, winnerId: null };
    if (m.id === nextMatchId) {
      return isFirstSlotOfPair ? { ...m, player1Id: null } : { ...m, player2Id: null };
    }
    return m;
  });
}

// Byes only ever occur structurally in round 1 (from the null padding in
// generateBracket). Every round-1 match always resolves to exactly one real
// winner (either played or via bye), so round 2+ never has a structural bye —
// a missing slot there just means "waiting on an earlier match", which must
// NOT be auto-resolved. Do not recurse into later rounds here.
function autoAdvanceByes(matches: Match[]): Match[] {
  let result = matches;
  for (const match of matches) {
    if (match.round !== 1) continue;
    const hasBye = Boolean(match.player1Id) !== Boolean(match.player2Id);
    if (hasBye) {
      const winnerId = (match.player1Id ?? match.player2Id) as string;
      result = setWinner(result, match.id, winnerId).map((m) =>
        m.id === match.id ? { ...m, isBye: true } : m
      );
    }
  }
  return result;
}

export function generateBracket(participants: Participant[]): Match[] {
  const bracketSize = nextPowerOfTwo(Math.max(participants.length, 2));
  const totalRounds = Math.log2(bracketSize);
  const round1Count = bracketSize / 2;
  const byes = bracketSize - participants.length;
  if (byes >= round1Count) {
    // Would mean some round-1 match has no real participant at all — can't
    // happen for bracketSize = nextPowerOfTwo(n), kept as a guard so a future
    // change to the sizing math fails loudly instead of corrupting brackets.
    throw new Error(`generateBracket: ${byes} byes can't fit in ${round1Count} round-1 matches`);
  }
  const reals = shuffle(participants).map((p) => p.id);

  const matches: Match[] = [];
  let realIndex = 0;
  for (let slot = 0; slot < round1Count; slot++) {
    // Byes are spread one-per-match over the last `byes` matches so no
    // player can ever draw two consecutive byes (bracketSize/2 > byes always).
    const isByeMatch = slot >= round1Count - byes;
    const player1Id = reals[realIndex++] ?? null;
    const player2Id = isByeMatch ? null : (reals[realIndex++] ?? null);
    matches.push({
      id: `r1-m${slot}`,
      round: 1,
      slot,
      player1Id,
      player2Id,
      winnerId: null,
      isBye: false,
    });
  }

  for (let round = 2; round <= totalRounds; round++) {
    const count = bracketSize / 2 ** round;
    for (let slot = 0; slot < count; slot++) {
      matches.push({
        id: `r${round}-m${slot}`,
        round,
        slot,
        player1Id: null,
        player2Id: null,
        winnerId: null,
        isBye: false,
      });
    }
  }

  return autoAdvanceByes(matches);
}

export function getChampion(matches: Match[]): string | null {
  const totalRounds = getTotalRounds(matches);
  const final = matches.find((m) => m.round === totalRounds);
  return final?.winnerId ?? null;
}

export function isFinished(matches: Match[]): boolean {
  return getChampion(matches) !== null;
}
