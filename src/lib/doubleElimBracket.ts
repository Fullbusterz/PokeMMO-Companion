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

const MIN_DOUBLE_ELIM_PARTICIPANTS = 4;
const MAX_DOUBLE_ELIM_PARTICIPANTS = 32;

// Any participant count in [4, 32] is accepted. Non-power-of-two counts are
// handled the same way bracket.ts's single-elimination handles them: round
// up to the next power of two and pad round 1 of the winners bracket with
// byes. A bye doesn't produce a loser, so the losers-bracket slot it would
// have fed is treated as a *structural* bye too (see `losersDeadSlot` below)
// instead of requiring organizers to hit an exact power of two.
export function isValidDoubleElimSize(participantCount: number): boolean {
  return participantCount >= MIN_DOUBLE_ELIM_PARTICIPANTS && participantCount <= MAX_DOUBLE_ELIM_PARTICIPANTS;
}

export function getWinnersRounds(matches: Match[]): number {
  return matches.filter((m) => m.bracket === 'winners').reduce((max, m) => Math.max(max, m.round), 0);
}

export function getLosersRounds(matches: Match[]): number {
  return matches.filter((m) => m.bracket === 'losers').reduce((max, m) => Math.max(max, m.round), 0);
}

// Slot index (0-based) of every round-1 winners-bracket match that's a bye,
// read straight off the already-generated matches — `generateBracket` (in
// bracket.ts) is the single source of truth for which round-1 slots get a
// bye, so this never re-derives that placement rule independently.
function winnersR1ByeFlags(matches: Match[]): boolean[] {
  return matches
    .filter((m) => m.bracket === 'winners' && m.round === 1)
    .sort((a, b) => a.slot - b.slot)
    .map((m) => m.isBye);
}

// Which slot (if any) of a losers-bracket match will *structurally* never
// receive a real player — independent of who wins any actual game, so this
// is fully knowable at generation time, not just once matches get played.
//
// Byes only ever occur in winners-bracket round 1 (bracket.ts's own comment
// guarantees every later winners round is bye-free: every round-1 winner,
// bye or not, is a real participant). That means "deadness" can only enter
// the losers bracket at round 1 (fed directly by two round-1 winners slots)
// and echo once into round 2 (round 2's slot `s` gets its player1 1:1 from
// round 1's slot `s`, and its player2 from a guaranteed-real winners-round-2
// drop-in). From round 3 on, every match's two inputs are each guaranteed to
// eventually produce a real winner — a round-2 match is at worst a "virtual
// bye" (one dead slot), never fully dead, since its player2 is always real —
// so nothing past round 2 can ever be dead. Verified for all 29 supported
// sizes (4..32) by simulation, not just by this argument — see the Node
// script referenced in the task report.
function losersDeadSlot(match: Match, matches: Match[]): 'player1' | 'player2' | null {
  if (match.bracket !== 'losers') return null;
  if (match.round === 1) {
    const byeFlags = winnersR1ByeFlags(matches);
    const p1Bye = byeFlags[match.slot * 2];
    const p2Bye = byeFlags[match.slot * 2 + 1];
    if (p1Bye && !p2Bye) return 'player1';
    if (p2Bye && !p1Bye) return 'player2';
    return null; // both real (normal match) or both bye (never generated at all, see below)
  }
  if (match.round === 2) {
    // player1 is fed 1:1 from round 1's same slot; it's dead only if that
    // round-1 match was fully dead (both its feeders were byes) and
    // therefore was never generated in the first place.
    const hasRound1Feeder = matches.some((m) => m.id === `lb-r1-m${match.slot}`);
    return hasRound1Feeder ? null : 'player1';
  }
  return null;
}

// Auto-resolves any losers-bracket match whose one live slot has just been
// filled while its other slot is structurally dead (see `losersDeadSlot`) —
// the losers-bracket equivalent of bracket.ts's `autoAdvanceByes`, except it
// has to run on every propagation step (not just once at generation time):
// the dead slot's sibling can arrive many real matches later, whenever an
// earlier match actually gets played, not necessarily right away.
function autoAdvanceLosersByes(matches: Match[]): Match[] {
  let result = matches;
  let changed = true;
  let guard = 0;
  while (changed && guard <= result.length) {
    changed = false;
    guard++;
    for (const m of result) {
      if (m.bracket !== 'losers' || m.winnerId || (m.round !== 1 && m.round !== 2)) continue;
      const dead = losersDeadSlot(m, result);
      if (!dead) continue;
      const liveId = dead === 'player1' ? m.player2Id : m.player1Id;
      if (!liveId) continue;
      result = propagateSetWinner(result, m.id, liveId).map((x) => (x.id === m.id ? { ...x, isBye: true } : x));
      changed = true;
      break;
    }
  }
  return result;
}

// Mirror of autoAdvanceLosersByes for undo: an auto-resolved losers match
// whose live slot just got cleared (because the real match that fed it was
// undone) needs to be un-resolved too, cascading its own forward
// un-propagation exactly like undoing a human decision would.
function autoUndoLosersByes(matches: Match[]): Match[] {
  let result = matches;
  let changed = true;
  let guard = 0;
  while (changed && guard <= result.length) {
    changed = false;
    guard++;
    for (const m of result) {
      if (
        m.bracket === 'losers' &&
        (m.round === 1 || m.round === 2) &&
        m.isBye &&
        m.winnerId &&
        m.player1Id !== m.winnerId &&
        m.player2Id !== m.winnerId
      ) {
        result = propagateUndoWinner(result, m.id).map((x) => (x.id === m.id ? { ...x, isBye: false } : x));
        changed = true;
        break;
      }
    }
  }
  return result;
}

export function generateDoubleElimBracket(participants: Participant[]): Match[] {
  if (!isValidDoubleElimSize(participants.length)) {
    throw new Error(
      `generateDoubleElimBracket: ${participants.length} participants isn't between ${MIN_DOUBLE_ELIM_PARTICIPANTS} and ${MAX_DOUBLE_ELIM_PARTICIPANTS}`
    );
  }
  const bracketSize = nextPowerOfTwo(participants.length);
  const totalWinnersRounds = log2(bracketSize);

  // Winners bracket: bracket.ts's own single-elim generation already pads to
  // the next power of two with byes in round 1 — exactly the shape a
  // double-elim winners bracket needs too.
  const winnersMatches: Match[] = generateBracket(participants).map((m) => ({
    ...m,
    id: `wb-r${m.round}-m${m.slot}`,
    bracket: 'winners',
  }));
  const byeFlags = winnersR1ByeFlags(winnersMatches);

  const totalLosersRounds = 2 * totalWinnersRounds - 2;
  const losersMatches: Match[] = [];
  for (let round = 1; round <= totalLosersRounds; round++) {
    const feederWinnersRound = Math.ceil(round / 2);
    const count = bracketSize / 2 ** (feederWinnersRound + 1);
    for (let slot = 0; slot < count; slot++) {
      if (round === 1 && byeFlags[slot * 2] && byeFlags[slot * 2 + 1]) {
        // Both feeders are byes — neither produces a loser, so this slot
        // never has anyone to pair up. Never generated, same spirit as
        // bracket.ts never generating a round-1 match with no real
        // participant on either side.
        continue;
      }
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

// Core propagation for a decided match — no knowledge of losers-bracket
// byes. Wrapped by the exported `setDoubleElimWinner` below, which also runs
// `autoAdvanceLosersByes` afterwards; kept separate so that pass can call
// this recursively without re-triggering itself.
function propagateSetWinner(matches: Match[], matchId: string, winnerId: string): Match[] {
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

// Decides a match and propagates the result (winner AND loser) exactly like
// propagateSetWinner, then auto-resolves any losers-bracket match whose live
// slot this just filled while its other slot is structurally dead (see
// losersDeadSlot) — e.g. a losers-bracket match whose opponent will never
// arrive because that opponent's own bracket slot was a bye all the way
// back in winners-bracket round 1.
export function setDoubleElimWinner(matches: Match[], matchId: string, winnerId: string): Match[] {
  return autoAdvanceLosersByes(propagateSetWinner(matches, matchId, winnerId));
}

// Core un-propagation for a decided match — mirror of propagateSetWinner,
// no knowledge of losers-bracket byes. Wrapped by the exported
// `undoDoubleElimWinner` below.
function propagateUndoWinner(matches: Match[], matchId: string): Match[] {
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

// Mirror of setDoubleElimWinner: clears a match's winner and un-propagates
// both destinations a winners-bracket match writes to (winner AND loser),
// then un-resolves any losers-bracket auto-bye that's left inconsistent by
// that (its live slot just got cleared but its winnerId is stale).
export function undoDoubleElimWinner(matches: Match[], matchId: string): Match[] {
  return autoUndoLosersByes(propagateUndoWinner(matches, matchId));
}

export function getDoubleElimChampion(matches: Match[]): string | null {
  return matches.find((m) => m.id === GRAND_FINAL_ID)?.winnerId ?? null;
}

export function isDoubleElimFinished(matches: Match[]): boolean {
  return getDoubleElimChampion(matches) !== null;
}
