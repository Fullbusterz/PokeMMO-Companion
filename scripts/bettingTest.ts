// Betting engine checks. Run with:  npx tsx scripts/bettingTest.ts
//
// The invariant that matters more than any other is CONSERVATION: chips are
// only ever moved between people, never created or destroyed. Integer pool
// splits are exactly where that quietly breaks — a naive Math.round on each
// share invents or loses chips on almost every uneven split, and nobody would
// notice until the scoreboard stopped adding up. So the suite hammers random
// scenarios and asserts the totals every time.
import {
  betEligibility,
  chipStandings,
  currentOdds,
  poolFor,
  settleBets,
  type Bet,
  type Viewer,
} from '../src/lib/betting';
import type { Match } from '../src/types/tournament';

let failures = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    failures += 1;
    console.error(`  FAIL: ${message}`);
  }
}

function match(id: string, p1: string, p2: string, winnerId: string | null, isBye = false): Match {
  return { id, round: 1, slot: 0, player1Id: p1, player2Id: p2, winnerId, isBye };
}

function viewers(n: number): Viewer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `v${i + 1}`,
    name: `Viewer ${i + 1}`,
    participantId: i < 4 ? `p${i + 1}` : null,
  }));
}

const START = 100;

console.log('Betting engine checks\n');

// 1. Conservation over thousands of random tournaments.
{
  const runs = 2000;
  let maxDrift = 0;
  for (let run = 0; run < runs; run++) {
    const vs = viewers(2 + Math.floor(Math.random() * 8));
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const matches: Match[] = [];
    const matchCount = 1 + Math.floor(Math.random() * 5);
    for (let m = 0; m < matchCount; m++) {
      const a = players[Math.floor(Math.random() * players.length)];
      let b = players[Math.floor(Math.random() * players.length)];
      while (b === a) b = players[Math.floor(Math.random() * players.length)];
      const decided = Math.random() < 0.7;
      matches.push(match(`m${m}`, a, b, decided ? (Math.random() < 0.5 ? a : b) : null));
    }

    const bets: Bet[] = [];
    let betId = 0;
    for (const v of vs) {
      for (const m of matches) {
        if (Math.random() < 0.5) continue;
        if (v.participantId && (m.player1Id === v.participantId || m.player2Id === v.participantId)) continue;
        const pick = Math.random() < 0.5 ? (m.player1Id as string) : (m.player2Id as string);
        // Deliberately awkward stakes: primes and odd numbers are what expose
        // rounding bugs in a proportional split.
        const amount = [1, 3, 7, 11, 13, 17, 23, 31][Math.floor(Math.random() * 8)];
        bets.push({ id: `b${betId++}`, viewerId: v.id, matchId: m.id, pick, amount });
      }
    }

    const standings = chipStandings(vs, bets, matches, START);
    const total = standings.reduce((sum, s) => sum + s.total, 0);
    const expected = vs.length * START;
    maxDrift = Math.max(maxDrift, Math.abs(total - expected));
    check(total === expected, `run ${run}: chips must be conserved (${total} vs ${expected})`);

    for (const s of standings) {
      check(Number.isInteger(s.balance), `run ${run}: balance must be a whole number of chips`);
      check(Number.isInteger(s.total), `run ${run}: total must be a whole number of chips`);
      check(s.atStake >= 0, `run ${run}: chips at stake cannot be negative`);
    }

    // Every settled pot must be handed out exactly, to the chip.
    const settled = settleBets(bets, matches);
    for (const m of matches) {
      const forMatch = settled.filter((b) => b.matchId === m.id);
      if (forMatch.length === 0 || !m.winnerId) continue;
      const pool = forMatch.reduce((sum, b) => sum + b.amount, 0);
      const paid = forMatch.reduce((sum, b) => sum + b.returned, 0);
      check(paid === pool, `run ${run}, ${m.id}: paid ${paid} out of a ${pool} pool`);
    }
  }
  console.log(`Conservation: ${runs} random scenarios, worst drift ${maxDrift} chips`);
}

// 2. A worked example, checked by hand.
{
  const vs: Viewer[] = [
    { id: 'v1', name: 'Ana', participantId: null },
    { id: 'v2', name: 'Bea', participantId: null },
    { id: 'v3', name: 'Cesc', participantId: null },
  ];
  const m = match('m1', 'p1', 'p2', 'p1');
  const bets: Bet[] = [
    { id: 'b1', viewerId: 'v1', matchId: 'm1', pick: 'p1', amount: 10 },
    { id: 'b2', viewerId: 'v2', matchId: 'm1', pick: 'p1', amount: 30 },
    { id: 'b3', viewerId: 'v3', matchId: 'm1', pick: 'p2', amount: 60 },
  ];
  // Pool 100, winners staked 40 -> 2.5 chips back per chip staked.
  const settled = settleBets(bets, [m]);
  const byId = new Map(settled.map((b) => [b.id, b]));
  check(byId.get('b1')?.returned === 25, 'a 10-chip stake in a 40/100 pool returns 25');
  check(byId.get('b2')?.returned === 75, 'a 30-chip stake in a 40/100 pool returns 75');
  check(byId.get('b3')?.returned === 0, 'the losing stake returns nothing');

  const standings = chipStandings(vs, bets, [m], START);
  const byViewer = new Map(standings.map((s) => [s.viewerId, s]));
  check(byViewer.get('v1')?.total === START + 15, 'Ana is up 15');
  check(byViewer.get('v2')?.total === START + 45, 'Bea is up 45');
  check(byViewer.get('v3')?.total === START - 60, 'Cesc is down 60');
  console.log('Worked example: 10/30 vs 60 on a 100 pool pays 25/75, +15/+45/-60');
}

// 3. Nobody backed the winner -> everyone gets their stake back.
{
  const m = match('m1', 'p1', 'p2', 'p2');
  const bets: Bet[] = [
    { id: 'b1', viewerId: 'v1', matchId: 'm1', pick: 'p1', amount: 10 },
    { id: 'b2', viewerId: 'v2', matchId: 'm1', pick: 'p1', amount: 5 },
  ];
  const settled = settleBets(bets, [m]);
  check(settled.every((b) => b.outcome === 'refunded' && b.returned === b.amount), 'an unbacked winner refunds everyone');
}

// 4. An undecided match holds the stake; a vanished match refunds it.
{
  const open = match('m1', 'p1', 'p2', null);
  const bets: Bet[] = [{ id: 'b1', viewerId: 'v1', matchId: 'm1', pick: 'p1', amount: 40 }];
  const settledOpen = settleBets(bets, [open]);
  check(settledOpen[0].outcome === 'open' && settledOpen[0].returned === 0, 'an open bet returns nothing yet');

  const standing = chipStandings([{ id: 'v1', name: 'A', participantId: null }], bets, [open], START)[0];
  check(standing.balance === START - 40, 'an open stake leaves the balance');
  check(standing.atStake === 40, 'an open stake is counted as at stake');
  check(standing.total === START, 'an open stake does not change the total');

  const settledGone = settleBets(bets, []);
  check(settledGone[0].outcome === 'refunded' && settledGone[0].returned === 40, 'a vanished match refunds the stake');
}

// 5. Odds.
{
  const bets: Bet[] = [
    { id: 'b1', viewerId: 'v1', matchId: 'm1', pick: 'p1', amount: 25 },
    { id: 'b2', viewerId: 'v2', matchId: 'm1', pick: 'p2', amount: 75 },
  ];
  const pool = poolFor(bets, 'm1');
  check(pool.total === 100, 'the pool is the sum of every stake');
  check(currentOdds(pool, 'p1') === 4, 'the unfancied side pays x4');
  check(Math.abs(currentOdds(pool, 'p2') - 100 / 75) < 1e-9, 'the favourite pays x1.33');
  // Staking 25 more on p1 makes the pool 125 with 50 on that side: x2.5, not
  // the x4 it showed before committing. The UI has to price the bet the user
  // is about to make, not the one they could have made a moment ago.
  check(currentOdds(pool, 'p1', 25) === 2.5, 'your own stake is priced in before you commit');
  check(currentOdds(poolFor([], 'm1'), 'p1') === 0, 'an empty pool has no odds');
}

// 6. Eligibility.
{
  const player: Viewer = { id: 'v1', name: 'Ana', participantId: 'p1' };
  const spectator: Viewer = { id: 'v2', name: 'Zoe', participantId: null };
  const own = match('m1', 'p1', 'p2', null);
  const other = match('m2', 'p3', 'p4', null);
  const done = match('m3', 'p3', 'p4', 'p3');
  const bye = match('m4', 'p5', null as unknown as string, 'p5', true);

  check(betEligibility(own, player, [], 100).canBet === false, 'a player cannot bet on their own match');
  check(
    betEligibility(own, player, [], 100).canBet === false &&
      (betEligibility(own, player, [], 100) as { reason: string }).reason === 'own-match',
    'and the reason says so'
  );
  check(betEligibility(own, spectator, [], 100).canBet === true, 'a spectator can bet on any match');
  check(betEligibility(other, player, [], 100).canBet === true, 'a player can bet on other matches');
  check(betEligibility(done, spectator, [], 100).canBet === false, 'a decided match is closed');
  check(betEligibility(bye, spectator, [], 100).canBet === false, 'a bye cannot be bet on');
  check(betEligibility(other, spectator, [], 0).canBet === false, 'no chips, no bet');
  check(
    betEligibility(other, spectator, [{ id: 'b1', viewerId: 'v2', matchId: 'm2', pick: 'p3', amount: 5 }], 100)
      .canBet === false,
    'one bet per person per match'
  );
  const ok = betEligibility(other, spectator, [], 42);
  check(ok.canBet === true && ok.maxStake === 42, 'the maximum stake is the balance');
  console.log('Rules: own match, closed match, bye, double bet and empty purse all refused');
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
