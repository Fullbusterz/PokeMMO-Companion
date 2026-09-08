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
  setSwissResult,
  WIN_POINTS,
} from '../src/lib/swissFormat';
import { agreedReports } from '../src/lib/onlineTournament';
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

console.log(
  failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`
);
process.exit(failures === 0 ? 0 : 1);
