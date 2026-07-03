import { generateBracket } from './bracket';
import type { Match, Participant } from '@/types/tournament';

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function log2(n: number): number {
  return Math.round(Math.log(n) / Math.log(2));
}

export const GRAND_FINAL_ID = 'gf-m0';

// Double elimination is restricted to power-of-two participant counts (>=4).
// Byes don't produce a loser, which breaks the losers-bracket slot counts
// this algorithm relies on to stay clean — rather than generalize that (a
// much bigger undertaking, see CLAUDE.md's own caution about the single-elim
// bye bug), organizers add/remove a player to hit 4/8/16/32.
export function isValidDoubleElimSize(participantCount: number): boolean {
  return participantCount >= 4 && nextPowerOfTwo(participantCount) === participantCount;
}

export function getWinnersRounds(matches: Match[]): number {
  return matches.filter((m) => m.bracket === 'winners').reduce((max, m) => Math.max(max, m.round), 0);
}

export function getLosersRounds(matches: Match[]): number {
  return matches.filter((m) => m.bracket === 'losers').reduce((max, m) => Math.max(max, m.round), 0);
}

export function generateDoubleElimBracket(participants: Participant[]): Match[] {
  if (!isValidDoubleElimSize(participants.length)) {
    throw new Error(
      `generateDoubleElimBracket: ${participants.length} participants isn't a power of two (>=4)`
    );
  }
  const bracketSize = participants.length;
  const totalWinnersRounds = log2(bracketSize);

  // Winners bracket: single-elim generation with zero byes (guaranteed by the
  // power-of-two check above) is exactly the winners-bracket structure.
  const winnersMatches: Match[] = generateBracket(participants).map((m) => ({
    ...m,
    id: `wb-r${m.round}-m${m.slot}`,
    bracket: 'winners',
  }));

  const totalLosersRounds = 2 * totalWinnersRounds - 2;
  const losersMatches: Match[] = [];
  for (let round = 1; round <= totalLosersRounds; round++) {
    const feederWinnersRound = Math.ceil(round / 2);
    const count = bracketSize / 2 ** (feederWinnersRound + 1);
    for (let slot = 0; slot < count; slot++) {
      losersMatches.push({
        id: `lb-r${round}-m${slot}`,
        round,
        slot,
        player1Id: null,
        player2Id: null,
        winnerId: null,
        isBye: false,
        bracket: 'losers',
      });
    }
  }

  const grandFinal: Match = {
    id: GRAND_FINAL_ID,
    round: 1,
    slot: 0,
    player1Id: null,
    player2Id: null,
    winnerId: null,
    isBye: false,
    bracket: 'final',
  };

  return [...winnersMatches, ...losersMatches, grandFinal];
}

export function setDoubleElimWinner(matches: Match[], matchId: string, winnerId: string): Match[] {
  const match = matches.find((m) => m.id === matchId);
  if (!match || match.winnerId) return matches;
  const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;

  let updated = matches.map((m) => (m.id === matchId ? { ...m, winnerId } : m));
  const totalWinnersRounds = getWinnersRounds(matches);
  const totalLosersRounds = getLosersRounds(matches);

  if (match.bracket === 'winners') {
    const isFirstSlotOfPair = match.slot % 2 === 0;

    if (match.round < totalWinnersRounds) {
      const nextId = `wb-r${match.round + 1}-m${Math.floor(match.slot / 2)}`;
      updated = updated.map((m) =>
        m.id === nextId ? (isFirstSlotOfPair ? { ...m, player1Id: winnerId } : { ...m, player2Id: winnerId }) : m
      );
    } else {
      updated = updated.map((m) => (m.id === GRAND_FINAL_ID ? { ...m, player1Id: winnerId } : m));
    }

    // The loser drops into the losers bracket: round 1 losers pair up with
    // each other (a "drop" round); every later round's losers merge 1:1 into
    // an already-running losers-bracket round instead.
    let loserDestId: string;
    let loserIsFirstSlot: boolean;
    if (match.round === 1) {
      loserDestId = `lb-r1-m${Math.floor(match.slot / 2)}`;
      loserIsFirstSlot = match.slot % 2 === 0;
    } else {
      loserDestId = `lb-r${2 * match.round - 2}-m${match.slot}`;
      loserIsFirstSlot = false;
    }
    updated = updated.map((m) =>
      m.id === loserDestId ? (loserIsFirstSlot ? { ...m, player1Id: loserId } : { ...m, player2Id: loserId }) : m
    );
  } else if (match.bracket === 'losers') {
    const isMergeRound = match.round % 2 === 0;

    if (match.round < totalLosersRounds) {
      if (isMergeRound) {
        // Next round consolidates survivors together, same pairing shape as
        // the winners bracket's own round-to-round advancement.
        const nextId = `lb-r${match.round + 1}-m${Math.floor(match.slot / 2)}`;
        const isFirstSlotOfPair = match.slot % 2 === 0;
        updated = updated.map((m) =>
          m.id === nextId ? (isFirstSlotOfPair ? { ...m, player1Id: winnerId } : { ...m, player2Id: winnerId }) : m
        );
      } else {
        // Next round merges 1:1 with a fresh winners-bracket drop.
        const nextId = `lb-r${match.round + 1}-m${match.slot}`;
        updated = updated.map((m) => (m.id === nextId ? { ...m, player1Id: winnerId } : m));
      }
    } else {
      updated = updated.map((m) => (m.id === GRAND_FINAL_ID ? { ...m, player2Id: winnerId } : m));
    }
  }
  // bracket === 'final': no further propagation, this decides the champion.

  return updated;
}

// Mirror of setDoubleElimWinner: clears a match's winner and un-propagates
// both destinations a winners-bracket match writes to (winner AND loser).
export function undoDoubleElimWinner(matches: Match[], matchId: string): Match[] {
  const match = matches.find((m) => m.id === matchId);
  if (!match || !match.winnerId) return matches;

  let updated = matches.map((m) => (m.id === matchId ? { ...m, winnerId: null } : m));
  const totalWinnersRounds = getWinnersRounds(matches);
  const totalLosersRounds = getLosersRounds(matches);

  if (match.bracket === 'winners') {
    const isFirstSlotOfPair = match.slot % 2 === 0;

    if (match.round < totalWinnersRounds) {
      const nextId = `wb-r${match.round + 1}-m${Math.floor(match.slot / 2)}`;
      updated = updated.map((m) =>
        m.id === nextId ? (isFirstSlotOfPair ? { ...m, player1Id: null } : { ...m, player2Id: null }) : m
      );
    } else {
      updated = updated.map((m) => (m.id === GRAND_FINAL_ID ? { ...m, player1Id: null } : m));
    }

    let loserDestId: string;
    let loserIsFirstSlot: boolean;
    if (match.round === 1) {
      loserDestId = `lb-r1-m${Math.floor(match.slot / 2)}`;
      loserIsFirstSlot = match.slot % 2 === 0;
    } else {
      loserDestId = `lb-r${2 * match.round - 2}-m${match.slot}`;
      loserIsFirstSlot = false;
    }
    updated = updated.map((m) =>
      m.id === loserDestId ? (loserIsFirstSlot ? { ...m, player1Id: null } : { ...m, player2Id: null }) : m
    );
  } else if (match.bracket === 'losers') {
    const isMergeRound = match.round % 2 === 0;

    if (match.round < totalLosersRounds) {
      if (isMergeRound) {
        const nextId = `lb-r${match.round + 1}-m${Math.floor(match.slot / 2)}`;
        const isFirstSlotOfPair = match.slot % 2 === 0;
        updated = updated.map((m) =>
          m.id === nextId ? (isFirstSlotOfPair ? { ...m, player1Id: null } : { ...m, player2Id: null }) : m
        );
      } else {
        const nextId = `lb-r${match.round + 1}-m${match.slot}`;
        updated = updated.map((m) => (m.id === nextId ? { ...m, player1Id: null } : m));
      }
    } else {
      updated = updated.map((m) => (m.id === GRAND_FINAL_ID ? { ...m, player2Id: null } : m));
    }
  }

  return updated;
}

export function getDoubleElimChampion(matches: Match[]): string | null {
  return matches.find((m) => m.id === GRAND_FINAL_ID)?.winnerId ?? null;
}

export function isDoubleElimFinished(matches: Match[]): boolean {
  return getDoubleElimChampion(matches) !== null;
}
