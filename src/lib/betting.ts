import type { Match } from '@/types/tournament';

// Parimutuel (pool) betting, not fixed odds. Everything staked on a match goes
// into one pot; when the result is confirmed, the pot is split among whoever
// backed the winner, in proportion to what they staked. Three reasons this is
// the right shape here:
//   * nobody has to set odds, and there is no house to go bust;
//   * a payout is a pure function of (bets, result), so every device computes
//     the same numbers from the same public rows — no settlement writes, and
//     nothing to tamper with;
//   * it self-balances: backing the obvious favourite pays little precisely
//     because everyone else did too.
//
// Chips have no value of any kind. They are not money, not PokéYen, and not
// convertible into anything — this is a prediction game with a scoreboard.

export type Bet = {
  id: string;
  viewerId: string;
  matchId: string;
  /** Participant id this bet backs to win. */
  pick: string;
  amount: number;
};

export type Viewer = {
  id: string;
  name: string;
  /** Roster slot this person is, or null for a spectator. */
  participantId: string | null;
};

export type BetOutcome = 'open' | 'won' | 'lost' | 'refunded';

export type SettledBet = Bet & {
  outcome: BetOutcome;
  /** Chips returned for this bet: 0 when lost, the stake when refunded, stake + winnings when won. */
  returned: number;
};

export type MatchPool = {
  matchId: string;
  total: number;
  /** Staked per participant id. */
  byPick: Map<string, number>;
};

export function poolFor(bets: Bet[], matchId: string): MatchPool {
  const byPick = new Map<string, number>();
  let total = 0;
  for (const bet of bets) {
    if (bet.matchId !== matchId) continue;
    total += bet.amount;
    byPick.set(bet.pick, (byPick.get(bet.pick) ?? 0) + bet.amount);
  }
  return { matchId, total, byPick };
}

// What one chip staked on `pick` would return if `pick` won, given the pool as
// it stands. Shown as "x2.4" next to a name. It moves as people bet, and the
// figure at settlement time is the one that counts — which the UI says.
export function currentOdds(pool: MatchPool, pick: string, prospectiveStake = 0): number {
  const onPick = (pool.byPick.get(pick) ?? 0) + prospectiveStake;
  const total = pool.total + prospectiveStake;
  if (onPick <= 0) return 0;
  return total / onPick;
}

// Splitting a pot in whole chips never divides evenly, and the leftover has to
// go somewhere explicit rather than quietly vanishing (or being invented).
// Each winner gets the floor of their exact share, and the remainder goes to
// the largest stakes first — the same convention as splitting a restaurant
// bill, and it guarantees sum(payouts) === pool exactly.
function distribute(pool: number, stakes: { id: string; amount: number }[]): Map<string, number> {
  const staked = stakes.reduce((sum, s) => sum + s.amount, 0);
  const payouts = new Map<string, number>();
  if (staked <= 0) return payouts;

  let handedOut = 0;
  for (const stake of stakes) {
    const exact = (stake.amount * pool) / staked;
    const whole = Math.floor(exact);
    payouts.set(stake.id, whole);
    handedOut += whole;
  }

  // Hand the rounding remainder to the biggest stakes, breaking ties by id so
  // the result is stable no matter what order the rows arrived in.
  const order = [...stakes].sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  let remainder = pool - handedOut;
  for (let i = 0; remainder > 0 && i < order.length; i++, remainder--) {
    const id = order[i].id;
    payouts.set(id, (payouts.get(id) ?? 0) + 1);
  }
  return payouts;
}

export function settleBets(bets: Bet[], matches: Match[]): SettledBet[] {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const settled: SettledBet[] = [];

  const matchIds = [...new Set(bets.map((b) => b.matchId))];
  for (const matchId of matchIds) {
    const matchBets = bets.filter((b) => b.matchId === matchId);
    const match = matchById.get(matchId);

    // A match that no longer exists (the round was re-paired) or hasn't been
    // decided yet: the stake is still on the table, not lost.
    if (!match || !match.winnerId) {
      const outcome: BetOutcome = match ? 'open' : 'refunded';
      for (const bet of matchBets) {
        settled.push({ ...bet, outcome, returned: outcome === 'refunded' ? bet.amount : 0 });
      }
      continue;
    }

    const winners = matchBets.filter((b) => b.pick === match.winnerId);
    // Nobody backed the winner: there is no house to keep the pot, so
    // everyone gets their stake back rather than the chips disappearing.
    if (winners.length === 0) {
      for (const bet of matchBets) settled.push({ ...bet, outcome: 'refunded', returned: bet.amount });
      continue;
    }

    const pool = matchBets.reduce((sum, b) => sum + b.amount, 0);
    const payouts = distribute(
      pool,
      winners.map((b) => ({ id: b.id, amount: b.amount }))
    );
    for (const bet of matchBets) {
      if (bet.pick === match.winnerId) {
        settled.push({ ...bet, outcome: 'won', returned: payouts.get(bet.id) ?? 0 });
      } else {
        settled.push({ ...bet, outcome: 'lost', returned: 0 });
      }
    }
  }

  return settled;
}

export type ChipStanding = {
  viewerId: string;
  /** Chips free to stake right now. */
  balance: number;
  /** Chips currently tied up in undecided matches. */
  atStake: number;
  /** balance + atStake — what the scoreboard ranks by. */
  total: number;
  bets: number;
  won: number;
  lost: number;
};

// A balance is derived, never stored: starting chips, minus everything staked,
// plus everything returned. That means there is no balance to corrupt and no
// settlement step that can be missed — replaying the same public rows always
// produces the same number.
export function chipStandings(
  viewers: Viewer[],
  bets: Bet[],
  matches: Match[],
  startingChips: number
): ChipStanding[] {
  const settled = settleBets(bets, matches);
  const byViewer = new Map<string, ChipStanding>();
  for (const viewer of viewers) {
    byViewer.set(viewer.id, {
      viewerId: viewer.id,
      balance: startingChips,
      atStake: 0,
      total: startingChips,
      bets: 0,
      won: 0,
      lost: 0,
    });
  }

  for (const bet of settled) {
    const standing = byViewer.get(bet.viewerId);
    if (!standing) continue;
    standing.bets += 1;
    standing.balance -= bet.amount;
    standing.balance += bet.returned;
    if (bet.outcome === 'open') standing.atStake += bet.amount;
    if (bet.outcome === 'won') standing.won += 1;
    if (bet.outcome === 'lost') standing.lost += 1;
  }

  for (const standing of byViewer.values()) {
    standing.total = standing.balance + standing.atStake;
  }

  const nameOrder = new Map(viewers.map((v, i) => [v.id, i]));
  return [...byViewer.values()].sort(
    (a, b) => b.total - a.total || b.won - a.won || (nameOrder.get(a.viewerId) ?? 0) - (nameOrder.get(b.viewerId) ?? 0)
  );
}

export type BetEligibility =
  | { canBet: true; maxStake: number }
  | { canBet: false; reason: 'closed' | 'bye' | 'own-match' | 'already-bet' | 'no-chips' };

// The same rules place_bet() enforces server-side, evaluated up front so the
// UI can explain WHY a match is not bettable instead of offering a button that
// fails. The only rule that lives solely here is affordability (see the note
// in supabase/betting.sql).
export function betEligibility(
  match: Match,
  viewer: Viewer,
  bets: Bet[],
  balance: number
): BetEligibility {
  if (match.isBye) return { canBet: false, reason: 'bye' };
  if (match.winnerId) return { canBet: false, reason: 'closed' };
  if (
    viewer.participantId &&
    (match.player1Id === viewer.participantId || match.player2Id === viewer.participantId)
  ) {
    return { canBet: false, reason: 'own-match' };
  }
  if (bets.some((b) => b.matchId === match.id && b.viewerId === viewer.id)) {
    return { canBet: false, reason: 'already-bet' };
  }
  if (balance < 1) return { canBet: false, reason: 'no-chips' };
  return { canBet: true, maxStake: balance };
}

export const DEFAULT_STARTING_CHIPS = 100;
