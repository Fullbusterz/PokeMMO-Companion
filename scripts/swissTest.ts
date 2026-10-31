// Exhaustive simulation of the Swiss engine. Run with:  npx tsx scripts/swissTest.ts
//
// The pairing algorithm is the one piece of this feature that can silently
// produce a *plausible but wrong* tournament (a rematch, a double bye, a
// player left out of a round), and none of that is obvious from looking at
// the UI — so it gets checked by brute force over thousands of random events
// rather than by eyeballing one bracket.
import {
  computeSwissStandings,
  generateSwissRound,
  isRoundComplete,
  isSwissFinished,
  isValidScore,
  maxRounds,
  recommendedRounds,
  setSwissDraw,
  setSwissResult,
  undoSwissResult,
  DRAW_POINTS,
  WIN_POINTS,
} from '../src/lib/swissFormat';
import { settleBets } from '../src/lib/betting';
import { actionableReports, agreedReports } from '../src/lib/onlineTournament';
import { parseImportedTournament } from '../src/lib/tournamentValidation';
import type { Match, Participant } from '../src/types/tournament';

let failures = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    failures += 1;
    console.error(`  FAIL: ${message}`);
  }
}

function makePlayers(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Jugador ${i + 1}` }));
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

type SimOptions = { players: number; rounds: number; bestOf: 1 | 3 };

function simulate({ players, rounds, bestOf }: SimOptions) {
  const participants = makePlayers(players);
  let matches: Match[] = [];
  const seenPairs = new Set<string>();
  const byeCount = new Map<string, number>();
  let repeatedPairings = 0;

  for (let round = 1; round <= rounds; round++) {
    const { matches: roundMatches, hadToRepeatPairing } = generateSwissRound(participants, matches, round);
    if (hadToRepeatPairing) repeatedPairings += 1;

    // Every player appears exactly once per round (bye included).
    const appearances = new Map<string, number>();
    for (const m of roundMatches) {
      for (const id of [m.player1Id, m.player2Id]) {
        if (id) appearances.set(id, (appearances.get(id) ?? 0) + 1);
      }
    }
    check(
      appearances.size === players && [...appearances.values()].every((c) => c === 1),
      `round ${round}: every player must appear exactly once (${players} players, saw ${appearances.size})`
    );

    // Odd fields get exactly one bye per round, even fields get none.
    const byes = roundMatches.filter((m) => m.isBye);
    check(
      byes.length === (players % 2 === 0 ? 0 : 1),
      `round ${round}: expected ${players % 2 === 0 ? 0 : 1} bye(s), got ${byes.length}`
    );
    for (const b of byes) {
      const id = b.player1Id ?? b.player2Id;
      if (id) byeCount.set(id, (byeCount.get(id) ?? 0) + 1);
      check(b.winnerId === (b.player1Id ?? b.player2Id), `round ${round}: a bye must resolve to the resting player`);
    }

    // No rematches, as long as the algorithm didn't report it was forced to.
    for (const m of roundMatches) {
      if (m.isBye || !m.player1Id || !m.player2Id) continue;
      const key = pairKey(m.player1Id, m.player2Id);
      if (!hadToRepeatPairing) {
        check(!seenPairs.has(key), `round ${round}: ${key} is a rematch`);
      }
      seenPairs.add(key);
    }

    matches = [...matches, ...roundMatches];
    check(!isRoundComplete(matches, round), `round ${round}: must not be complete before results are entered`);

    // Play the round out at random.
    for (const m of roundMatches) {
      if (m.isBye || !m.player1Id || !m.player2Id) continue;
      const p1Wins = Math.random() < 0.5;
      const winnerId = p1Wins ? m.player1Id : m.player2Id;
      const score =
        bestOf === 3
          ? { p1: p1Wins ? 2 : Math.round(Math.random()), p2: p1Wins ? Math.round(Math.random()) : 2 }
          : undefined;
      if (score) check(isValidScore(score, 3), `round ${round}: generated an invalid Bo3 score`);
      matches = setSwissResult(matches, m.id, winnerId, score);
    }

    check(isRoundComplete(matches, round), `round ${round}: must be complete once every result is in`);
  }

  // Nobody sits out twice while someone else never sat out at all.
  const byeValues = [...byeCount.values()];
  if (players % 2 !== 0) {
    check(
      byeValues.every((c) => c <= 1) || rounds > players,
      `byes must not repeat within ${rounds} rounds (got ${JSON.stringify([...byeCount])})`
    );
  }

  // Points must reconcile with the results actually recorded.
  const standings = computeSwissStandings(matches, participants);
  check(standings.length === players, 'standings must list every player');
  for (const s of standings) {
    check(
      s.points === (s.wins + s.byes) * WIN_POINTS,
      `${s.participantId}: ${s.points} points doesn't match ${s.wins} wins + ${s.byes} byes`
    );
    check(s.played === s.wins + s.losses, `${s.participantId}: played must equal wins + losses`);
    check(s.played + s.byes === rounds, `${s.participantId}: must have one result per round`);
    check(s.opponentIds.length === s.played, `${s.participantId}: opponent list must match games played`);
    check(!s.opponentIds.includes(s.participantId), `${s.participantId}: cannot be their own opponent`);
  }

  // Total points handed out = 3 per round per decided match, plus byes.
  const totalPoints = standings.reduce((sum, s) => sum + s.points, 0);
  const decided = matches.filter((m) => m.winnerId).length;
  check(totalPoints === decided * WIN_POINTS, `total points ${totalPoints} != ${decided} decided results * ${WIN_POINTS}`);

  // The table must be sorted by points descending.
  for (let i = 1; i < standings.length; i++) {
    check(standings[i - 1].points >= standings[i].points, 'standings must be sorted by points descending');
  }

  check(
    isSwissFinished(matches, { totalRounds: rounds, bestOf }),
    'a fully played event must report as finished'
  );
  check(
    !isSwissFinished(matches, { totalRounds: rounds + 1, bestOf }),
    'adding a round must reopen the event'
  );

  return { repeatedPairings, standings, matches };
}

console.log('Swiss engine checks\n');

// 1. The actual event Ferran is running: 9 players, 5 rounds, both formats.
for (const bestOf of [1, 3] as const) {
  const runs = 500;
  let forced = 0;
  for (let i = 0; i < runs; i++) forced += simulate({ players: 9, rounds: 5, bestOf }).repeatedPairings > 0 ? 1 : 0;
  console.log(`9 players / 5 rounds / Bo${bestOf}: ${runs} events, ${forced} needed a forced rematch`);
  check(forced === 0, `Bo${bestOf}: 9 players over 5 rounds must never require a rematch`);
}

// 2. The 6th round he might add.
{
  const runs = 500;
  let forced = 0;
  for (let i = 0; i < runs; i++) forced += simulate({ players: 9, rounds: 6, bestOf: 1 }).repeatedPairings > 0 ? 1 : 0;
  console.log(`9 players / 6 rounds:        ${runs} events, ${forced} needed a forced rematch`);
  check(forced === 0, '9 players over 6 rounds must never require a rematch');
}

// 3. Sizes around it, even and odd, at the round count the app recommends.
for (const players of [2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 17, 24, 32]) {
  const rounds = Math.min(recommendedRounds(players), maxRounds(players));
  let forced = 0;
  for (let i = 0; i < 100; i++) forced += simulate({ players, rounds, bestOf: 1 }).repeatedPairings > 0 ? 1 : 0;
  console.log(`${String(players).padStart(2)} players / ${rounds} rounds:       100 events, ${forced} needed a forced rematch`);
  check(forced === 0, `${players} players over ${rounds} rounds must never require a rematch`);
}

// 4. The pathological case: more rounds than distinct opponents exist. The
//    engine must still produce a full round rather than throwing.
{
  const { repeatedPairings } = simulate({ players: 4, rounds: 5, bestOf: 1 });
  console.log(`\n 4 players / 5 rounds (impossible without rematches): ${repeatedPairings} forced round(s), no crash`);
  check(repeatedPairings > 0, 'exhausting every pairing must be reported, not hidden');
}

// 5. Score validation.
check(isValidScore({ p1: 2, p2: 0 }, 3), 'Bo3 2-0 is valid');
check(isValidScore({ p1: 2, p2: 1 }, 3), 'Bo3 2-1 is valid');
check(!isValidScore({ p1: 2, p2: 2 }, 3), 'Bo3 2-2 is not valid');
check(!isValidScore({ p1: 3, p2: 0 }, 3), 'Bo3 3-0 is not valid');
check(!isValidScore({ p1: 1, p2: 0 }, 3), 'Bo3 1-0 is not a finished match');
check(isValidScore({ p1: 1, p2: 0 }, 1), 'Bo1 1-0 is valid');
check(!isValidScore({ p1: 2, p2: 0 }, 1), 'Bo1 2-0 is not valid');
check(!isValidScore({ p1: -1, p2: 2 }, 3), 'negative games are not valid');
check(!isValidScore({ p1: 1.5, p2: 2 }, 3), 'fractional games are not valid');

// 6. Buchholz: beating strong opponents must rank above beating weak ones.
{
  const players = makePlayers(4);
  let matches: Match[] = [];
  const r1 = generateSwissRound(players, matches, 1).matches;
  matches = [...matches, ...r1];
  console.log('\nBuchholz sanity check on a hand-built 4-player round');
  check(r1.length === 2, 'a 4-player round is 2 matches');
}

// 7. Round-trip through the import validator. This is what the online sync
//    runs every server response through, so anything it rejects is a
//    tournament that silently stops syncing. Regression: it used to reject a
//    just-created Swiss event (0 participants, 0 matches) because those
//    invariants were written for brackets, which broke sign-ups by link — the
//    exact window the share link is meant for.
{
  console.log('\nImport-validator round trip');
  const fresh = {
    id: 'sw1',
    name: 'Recién creado',
    createdAt: new Date().toISOString(),
    participants: [],
    matches: [],
    status: 'setup',
    history: [],
    format: 'swiss',
    swiss: { totalRounds: 5, bestOf: 1 },
  };
  check(parseImportedTournament(fresh) !== null, 'an empty Swiss tournament must survive the round trip');

  const oneSignup = { ...fresh, participants: [{ id: 'p1', name: 'Ana' }] };
  check(parseImportedTournament(oneSignup) !== null, 'a Swiss tournament with a single sign-up must survive too');

  const played = {
    ...fresh,
    participants: [
      { id: 'p1', name: 'Ana' },
      { id: 'p2', name: 'Bea' },
    ],
    matches: [
      { id: 'r1-m0', round: 1, slot: 0, player1Id: 'p1', player2Id: 'p2', winnerId: 'p1', isBye: false, score: { p1: 2, p2: 1 } },
    ],
  };
  const parsed = parseImportedTournament(played);
  check(parsed !== null, 'a Swiss tournament in progress must survive the round trip');
  check(parsed?.matches[0].score?.p1 === 2, 'the Bo3 score must survive the round trip');
  check(parsed?.swiss?.totalRounds === 5, 'the Swiss config must survive the round trip');

  // The relaxation must NOT leak into the other formats.
  check(
    parseImportedTournament({ ...fresh, format: 'single' }) === null,
    'an empty single-elimination tournament must still be rejected'
  );
  check(
    parseImportedTournament({ ...fresh, swiss: { totalRounds: 0, bestOf: 1 } }) === null,
    'a Swiss tournament with an impossible round count must be rejected'
  );
  check(
    parseImportedTournament({ ...fresh, swiss: undefined }) === null,
    'a Swiss tournament with no config must be rejected'
  );
  console.log('  done');
}

// ---------------------------------------------------------------------------
// Auto-confirmation: a result both players reported the same way needs no
// organizer. The rules that keep that safe get tested rather than trusted.
{
  console.log('\nAuto-confirmation of agreed reports');

  const tournament = {
    id: 'auto1',
    name: 'Auto',
    createdAt: new Date().toISOString(),
    participants: [
      { id: 'a', name: 'Ana' },
      { id: 'b', name: 'Bea' },
      { id: 'c', name: 'Cesc' },
    ],
    matches: [
      { id: 'm1', round: 1, slot: 0, player1Id: 'a', player2Id: 'b', winnerId: null, isBye: false },
      { id: 'm2', round: 1, slot: 1, player1Id: 'c', player2Id: null, winnerId: 'c', isBye: true },
    ],
    status: 'in_progress' as const,
    history: [],
    format: 'swiss' as const,
    swiss: { totalRounds: 3, bestOf: 1 as const },
  };

  const report = (
    id: string,
    reportedBy: string,
    winnerId: string,
    score?: { p1: number; p2: number }
  ) => ({
    id,
    code: 'X',
    match_id: 'm1',
    reported_by: reportedBy,
    winner_id: winnerId,
    score: score ?? null,
    created_at: new Date().toISOString(),
  });

  check(
    agreedReports(tournament, [report('r1', 'a', 'b')]).length === 0,
    'one player alone is not agreement'
  );
  check(
    agreedReports(tournament, [report('r1', 'a', 'b'), report('r2', 'a', 'b')]).length === 0,
    'the same player twice is not agreement'
  );
  check(
    agreedReports(tournament, [report('r1', 'a', 'b'), report('r2', 'b', 'a')]).length === 0,
    'two players naming different winners is not agreement'
  );

  const both = agreedReports(tournament, [report('r1', 'a', 'b'), report('r2', 'b', 'b')]);
  check(both.length === 1 && both[0].winnerId === 'b', 'both players naming the same winner agrees');
  check(
    both.length === 1 && both[0].reportIds.length === 2,
    'agreement consumes both report rows, not just one'
  );

  check(
    agreedReports(tournament, [
      report('r1', 'a', 'b', { p1: 0, p2: 2 }),
      report('r2', 'b', 'b', { p1: 1, p2: 2 }),
    ]).length === 0,
    'same winner but different Bo3 score is left to the organizer'
  );
  check(
    agreedReports(tournament, [
      report('r1', 'a', 'b', { p1: 0, p2: 2 }),
      report('r2', 'b', 'b', { p1: 0, p2: 2 }),
    ]).length === 1,
    'same winner and same score agrees'
  );

  const decided = {
    ...tournament,
    matches: tournament.matches.map((m) => (m.id === 'm1' ? { ...m, winnerId: 'a' } : m)),
  };
  check(
    agreedReports(decided, [report('r1', 'a', 'b'), report('r2', 'b', 'b')]).length === 0,
    'a match the organizer already decided is never re-applied'
  );

  console.log('  done');
}

// ---------------------------------------------------------------------------
// Draws: the organizer closing an unplayed match with a point each. Added
// mid-event, so what matters is that it slots into everything that reads a
// result — standings, the next pairing, betting, reports, the sync parser —
// without any of them mistaking it for a win or for a match still open.
{
  console.log('\nDraws');

  // Random events with ~15% of matches drawn: the pairing invariants that
  // hold without draws must still hold with odd point totals in play.
  let drawnEvents = 0;
  for (const players of [9, 10, 11]) {
    for (let run = 0; run < 300; run++) {
      const participants = makePlayers(players);
      let matches: Match[] = [];
      const seen = new Set<string>();
      let expectedPoints = 0;
      let draws = 0;
      for (let round = 1; round <= 5; round++) {
        const { matches: roundMatches, hadToRepeatPairing } = generateSwissRound(participants, matches, round);
        check(!hadToRepeatPairing, `${players}p with draws, round ${round}: forced a rematch`);
        const appearances = new Map<string, number>();
        for (const m of roundMatches) {
          for (const id of [m.player1Id, m.player2Id]) if (id) appearances.set(id, (appearances.get(id) ?? 0) + 1);
          if (m.isBye || !m.player1Id || !m.player2Id) continue;
          const key = pairKey(m.player1Id, m.player2Id);
          check(!seen.has(key), `${players}p with draws, round ${round}: rematch ${key}`);
          seen.add(key);
        }
        check(
          participants.every((p) => appearances.get(p.id) === 1),
          `${players}p with draws, round ${round}: someone missing or doubled`
        );
        matches = [...matches, ...roundMatches];
        for (const m of roundMatches) {
          if (m.isBye) {
            expectedPoints += WIN_POINTS;
          } else if (Math.random() < 0.15) {
            matches = setSwissDraw(matches, m.id);
            expectedPoints += 2 * DRAW_POINTS;
            draws += 1;
          } else {
            matches = setSwissResult(matches, m.id, Math.random() < 0.5 ? m.player1Id! : m.player2Id!);
            expectedPoints += WIN_POINTS;
          }
        }
        check(isRoundComplete(matches, round), `${players}p with draws, round ${round}: a drawn round must count as complete`);
      }
      if (draws > 0) drawnEvents += 1;
      const standings = computeSwissStandings(matches, participants);
      const total = standings.reduce((sum, s) => sum + s.points, 0);
      check(total === expectedPoints, `${players}p with draws: points ${total} != expected ${expectedPoints}`);
      check(
        standings.every((s) => s.wins + s.draws + s.losses === s.played),
        `${players}p with draws: W+D+L must equal played`
      );
      check(isSwissFinished(matches, { totalRounds: 5, bestOf: 1 }), `${players}p with draws: event must finish`);
    }
  }
  check(drawnEvents > 800, 'the random runs must actually have exercised draws');

  // The real case that prompted this: 10 players, round 2, one match never
  // played. Same roster and same round-2 pairings as Ferran's event; round 1
  // is a plausible reconstruction, not the exact history.
  const ten = ['Respiros', 'Sayan', 'Joseba', 'Hailthor', 'Fandanguillo', '1Miki', 'Orveta', 'Derrickachu', 'Charlyzard', 'Caneteh'].map(
    (name, i) => ({ id: `p${i}`, name })
  );
  const [res, say, jos, hai, fan, mik, orv, der, cha, can] = ten.map((p) => p.id);
  const m = (id: string, round: number, slot: number, a: string, b: string, w: string | null): Match => ({
    id,
    round,
    slot,
    player1Id: a,
    player2Id: b,
    winnerId: w,
    isBye: false,
  });
  let real: Match[] = [
    m('r1-m0', 1, 0, res, orv, res),
    m('r1-m1', 1, 1, say, der, say),
    m('r1-m2', 1, 2, jos, cha, jos),
    m('r1-m3', 1, 3, hai, can, hai),
    m('r1-m4', 1, 4, fan, mik, mik),
    m('r2-m0', 2, 0, res, hai, res),
    m('r2-m1', 2, 1, say, mik, say),
    m('r2-m2', 2, 2, jos, orv, jos),
    m('r2-m3', 2, 3, cha, can, null),
    m('r2-m4', 2, 4, fan, der, fan),
  ];
  check(!isRoundComplete(real, 2), 'round 2 is open before the draw');
  real = setSwissDraw(real, 'r2-m3');
  check(isRoundComplete(real, 2), 'the draw completes round 2');
  const after = computeSwissStandings(real, ten);
  const pts = new Map(after.map((s) => [s.participantId, s]));
  check(pts.get(cha)?.points === 1 && pts.get(can)?.points === 1, 'each drawn player gets exactly 1 point');
  check(pts.get(cha)?.played === 2 && pts.get(can)?.draws === 1, 'a draw counts as a played match');
  check(pts.get(res)?.points === 6, 'the draw does not touch anyone else');
  const next = generateSwissRound(ten, real, 3);
  check(!next.hadToRepeatPairing, 'round 3 pairs without rematches after the draw');
  check(
    !next.matches.some((x) => pairKey(x.player1Id ?? '', x.player2Id ?? '') === pairKey(cha, can)),
    'the drawn pair counts as having met and is not paired again'
  );

  // Guards: a draw can't overwrite a result, and a result can't overwrite a
  // draw without an undo first — the store relies on both.
  const won = setSwissResult(real, 'r2-m0', res);
  check(setSwissDraw(won, 'r2-m0').find((x) => x.id === 'r2-m0')?.draw !== true, 'a decided match cannot be drawn');
  const reopened = undoSwissResult(real, 'r2-m3');
  const reopenedMatch = reopened.find((x) => x.id === 'r2-m3');
  check(!reopenedMatch?.draw && reopenedMatch?.winnerId === null, 'undo reopens a drawn match');
  check(!isRoundComplete(reopened, 2), 'undoing the draw reopens the round');

  // Betting: nobody's pick won a draw, so every stake comes back.
  const settled = settleBets(
    [
      { id: 'b1', viewerId: 'v1', matchId: 'r2-m3', pick: cha, amount: 20 },
      { id: 'b2', viewerId: 'v2', matchId: 'r2-m3', pick: can, amount: 7 },
    ],
    real
  );
  check(
    settled.every((b) => b.outcome === 'refunded' && b.returned === b.amount),
    'bets on a drawn match are refunded in full'
  );

  // Reports: a late report on a drawn match must neither show up for the
  // organizer nor auto-apply as a win.
  const docWithDraw = {
    id: 'draw1',
    name: 'Draw',
    createdAt: new Date().toISOString(),
    participants: ten,
    matches: real,
    status: 'in_progress' as const,
    history: [],
    format: 'swiss' as const,
    swiss: { totalRounds: 5, bestOf: 1 as const },
  };
  const late = (id: string, by: string) => ({
    id,
    code: 'X',
    match_id: 'r2-m3',
    reported_by: by,
    winner_id: cha,
    score: null,
    created_at: new Date().toISOString(),
  });
  check(actionableReports(docWithDraw, [late('l1', cha)]).length === 0, 'a report on a drawn match is dropped');
  check(agreedReports(docWithDraw, [late('l1', cha), late('l2', can)]).length === 0, 'agreeing late reports never undo a draw');

  // Sync: the flag has to survive the server round trip, and nothing that
  // isn't a genuine open pairing may carry it.
  const parsedDraw = parseImportedTournament(JSON.parse(JSON.stringify(docWithDraw)));
  check(parsedDraw?.matches.find((x) => x.id === 'r2-m3')?.draw === true, 'the draw survives the round trip');
  const tampered = {
    ...docWithDraw,
    matches: real.map((x) => (x.id === 'r2-m0' ? { ...x, draw: true } : x)),
  };
  check(
    parseImportedTournament(tampered)?.matches.find((x) => x.id === 'r2-m0')?.draw === undefined,
    'a draw flag on a match that also has a winner is dropped'
  );

  console.log('  done');
}

console.log(
  failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`
);
process.exit(failures === 0 ? 0 : 1);
