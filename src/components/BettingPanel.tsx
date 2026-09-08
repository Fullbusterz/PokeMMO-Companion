import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import {
  betEligibility,
  chipStandings,
  currentOdds,
  poolFor,
  settleBets,
  type Bet,
  type MatchPool,
  type Viewer,
} from '@/lib/betting';
import { surfaceTransition, transition } from '@/lib/webMotion';
import type { Match } from '@/types/tournament';

// Odds move as people bet, so the figure on screen is always provisional. It's
// shown to two decimals with the caveat spelled out below the list — quoting it
// like a fixed price would be a lie.
function formatOdds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return value.toFixed(2).replace(/\.00$/, '');
}

// Where the money actually is, as a bar. Two numbers side by side make you do
// the division yourself; a split bar answers "who is everyone backing?" before
// you've read anything, which is the whole appeal of watching a pool move.
function PoolBar({ pool, p1, p2 }: { pool: MatchPool; p1: string | null; p2: string | null }) {
  const onP1 = p1 ? (pool.byPick.get(p1) ?? 0) : 0;
  const onP2 = p2 ? (pool.byPick.get(p2) ?? 0) : 0;
  const total = onP1 + onP2;
  const p1Share = total > 0 ? (onP1 / total) * 100 : 50;

  return (
    <View className="h-1.5 flex-row overflow-hidden rounded-full bg-ink-700">
      <View
        className={total > 0 ? 'bg-pokeRed' : 'bg-ink-600'}
        style={[{ width: `${p1Share}%` }, transition(['width'], 320)]}
      />
      <View className={total > 0 ? 'bg-gold' : 'bg-ink-600'} style={{ flex: 1 }} />
    </View>
  );
}

const QUICK_STAKES = [5, 10, 25, 50];

function BettableMatch({
  match,
  viewer,
  bets,
  balance,
  nameById,
  onPlace,
  isPlacing,
}: {
  match: Match;
  viewer: Viewer;
  bets: Bet[];
  balance: number;
  nameById: Map<string, string>;
  onPlace: (matchId: string, pick: string, amount: number) => void;
  isPlacing: boolean;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [stake, setStake] = useState(10);

  const pool = useMemo(() => poolFor(bets, match.id), [bets, match.id]);
  const eligibility = betEligibility(match, viewer, bets, balance);
  const myBet = bets.find((b) => b.matchId === match.id && b.viewerId === viewer.id);

  const clampedStake = Math.max(1, Math.min(balance, stake));
  const projectedOdds = pick ? currentOdds(pool, pick, clampedStake) : 0;

  function renderSide(playerId: string | null, side: 'p1' | 'p2') {
    if (!playerId) return null;
    const staked = pool.byPick.get(playerId) ?? 0;
    const odds = currentOdds(pool, playerId);
    const isPicked = pick === playerId;
    const isMyBet = myBet?.pick === playerId;

    return (
      <PressScale
        haptic="select"
        scaleTo={0.98}
        disabled={!eligibility.canBet}
        onPress={() => setPick((current) => (current === playerId ? null : playerId))}
        className={`flex-1 rounded-xl border p-3 ${
          isPicked
            ? 'border-pokeRed bg-pokeRed/10'
            : isMyBet
              ? 'border-gold/60 bg-gold/10'
              : 'border-ink-600 bg-ink-700/30'
        }`}
        style={surfaceTransition()}
      >
        <Text className="text-sm font-semibold text-ink-100" numberOfLines={1}>
          {nameById.get(playerId) ?? '?'}
        </Text>
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <View
            className={`rounded-full px-1.5 py-0.5 ${side === 'p1' ? 'bg-pokeRed/20' : 'bg-gold/20'}`}
          >
            <Text className={`text-[11px] font-bold ${side === 'p1' ? 'text-pokeRed' : 'text-gold'}`}>
              {t('betting.oddsLabel', { odds: formatOdds(odds) })}
            </Text>
          </View>
          <Text className="text-[11px] text-ink-400">{staked}</Text>
        </View>
      </PressScale>
    );
  }

  return (
    <Card skipEntrance className="mb-3 px-3 py-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[11px] uppercase tracking-wide text-ink-400">
          {t('betting.poolLabel', { total: pool.total })}
        </Text>
      </View>

      <View className="mb-2.5">
        <PoolBar pool={pool} p1={match.player1Id} p2={match.player2Id} />
      </View>

      <View className="flex-row gap-2">
        {renderSide(match.player1Id, 'p1')}
        {renderSide(match.player2Id, 'p2')}
      </View>

      {myBet && (
        <View className="mt-2 flex-row items-center gap-1.5 rounded-lg bg-gold/10 px-2 py-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-gold" />
          <Text className="flex-1 text-xs text-gold">
            {t('betting.yourBet', { amount: myBet.amount, pick: nameById.get(myBet.pick) ?? '?' })}
          </Text>
        </View>
      )}

      {!eligibility.canBet && !myBet && (
        <Text className="mt-2 text-xs italic text-ink-400">
          {eligibility.reason === 'own-match'
            ? t('betting.closedOwnMatch')
            : eligibility.reason === 'no-chips'
              ? t('betting.closedNoChips')
              : t('betting.closedDecided')}
        </Text>
      )}

      {/* Quick stakes instead of a keyboard: on a phone, at a table, nobody
          wants to open a numeric keypad to type "10". */}
      {eligibility.canBet && pick && (
        <View className="mt-3 border-t border-ink-700 pt-3">
          <Text className="mb-2 text-xs text-ink-400">{t('betting.stakeLabel')}</Text>
          <View className="mb-3 flex-row gap-2">
            {QUICK_STAKES.filter((value) => value <= balance).map((value) => (
              <PressScale
                key={value}
                haptic="tap"
                scaleTo={0.96}
                onPress={() => setStake(value)}
                className={`flex-1 rounded-lg border py-2 ${
                  clampedStake === value ? 'border-gold bg-gold/15' : 'border-ink-600'
                }`}
                style={surfaceTransition()}
              >
                <Text
                  className={`text-center text-sm font-semibold ${
                    clampedStake === value ? 'text-gold' : 'text-ink-300'
                  }`}
                >
                  {value}
                </Text>
              </PressScale>
            ))}
            <PressScale
              haptic="tap"
              scaleTo={0.96}
              onPress={() => setStake(balance)}
              className={`flex-1 rounded-lg border py-2 ${
                clampedStake === balance ? 'border-gold bg-gold/15' : 'border-ink-600'
              }`}
              style={surfaceTransition()}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  clampedStake === balance ? 'text-gold' : 'text-ink-300'
                }`}
              >
                {t('betting.allIn')}
              </Text>
            </PressScale>
          </View>

          <View className="mb-3 flex-row items-baseline justify-between">
            <Text className="text-xs text-ink-400">{t('betting.wouldReturnLabel')}</Text>
            <Text className="text-base font-bold text-gold">
              ~{Math.floor(clampedStake * projectedOdds)}
            </Text>
          </View>

          <Button disabled={clampedStake < 1 || isPlacing} onPress={() => { onPlace(match.id, pick, clampedStake); setPick(null); }}>
            {isPlacing ? t('betting.placing') : t('betting.placeBet', { amount: clampedStake })}
          </Button>
        </View>
      )}
    </Card>
  );
}

export function BettingPanel({
  matches,
  viewer,
  viewers,
  bets,
  startingChips,
  nameById,
  onPlace,
  isPlacing,
  error,
  avatarByViewer,
}: {
  matches: Match[];
  viewer: Viewer;
  viewers: Viewer[];
  bets: Bet[];
  startingChips: number;
  nameById: Map<string, string>;
  onPlace: (matchId: string, pick: string, amount: number) => void;
  isPlacing: boolean;
  error: boolean;
  /** Viewer id -> picture, for the people who uploaded one. */
  avatarByViewer?: Map<string, string>;
}) {
  const standings = useMemo(
    () => chipStandings(viewers, bets, matches, startingChips),
    [viewers, bets, matches, startingChips]
  );
  const mine = standings.find((s) => s.viewerId === viewer.id);
  const settled = useMemo(() => settleBets(bets, matches), [bets, matches]);
  const myBets = settled.filter((b) => b.viewerId === viewer.id);
  const viewerNameById = useMemo(() => new Map(viewers.map((v) => [v.id, v.name])), [viewers]);
  const openMatches = matches.filter((m) => !m.isBye && !m.winnerId);

  const balance = mine?.balance ?? startingChips;
  const net = (mine?.total ?? startingChips) - startingChips;

  return (
    <View className="mb-6">
      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">{t('betting.title')}</Text>

      {/* The purse, given the weight it deserves — this is the number people
          check between rounds. */}
      <Card skipEntrance className="mb-3 flex-row items-center justify-between px-4 py-3">
        <View>
          <Text className="text-[11px] uppercase tracking-wide text-ink-400">{t('betting.yourChips')}</Text>
          <View className="mt-0.5 flex-row items-baseline gap-2">
            <Text className="text-2xl font-bold text-gold">{balance}</Text>
            {net !== 0 && (
              <Text className={`text-sm font-semibold ${net > 0 ? 'text-status-progress' : 'text-pokeRed'}`}>
                {net > 0 ? '+' : ''}
                {net}
              </Text>
            )}
          </View>
        </View>
        {mine && mine.atStake > 0 && (
          <View className="items-end">
            <Text className="text-[11px] uppercase tracking-wide text-ink-400">{t('betting.atStakeLabel')}</Text>
            <Text className="mt-0.5 text-lg font-semibold text-ink-100">{mine.atStake}</Text>
          </View>
        )}
      </Card>

      <Text className="mb-3 text-xs leading-4 text-ink-400">{t('betting.explainer')}</Text>

      {openMatches.map((match) => (
        <BettableMatch
          key={match.id}
          match={match}
          viewer={viewer}
          bets={bets}
          balance={balance}
          nameById={nameById}
          onPlace={onPlace}
          isPlacing={isPlacing}
        />
      ))}

      {error && <Text className="mb-2 text-sm text-pokeRed">{t('betting.betError')}</Text>}
      {openMatches.length > 0 && (
        <Text className="mb-4 text-xs leading-4 text-ink-400">{t('betting.returnNote')}</Text>
      )}

      {myBets.length > 0 && (
        <View className="mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t('betting.history')}
          </Text>
          {myBets.map((bet) => (
            <View
              key={bet.id}
              className="mb-1 flex-row items-center justify-between rounded-lg bg-ink-800/60 px-3 py-2"
            >
              <Text className="flex-1 text-xs text-ink-300" numberOfLines={1}>
                {nameById.get(bet.pick) ?? '?'} · {bet.amount}
              </Text>
              <Text
                className={`text-xs font-semibold ${
                  bet.outcome === 'won'
                    ? 'text-status-progress'
                    : bet.outcome === 'lost'
                      ? 'text-pokeRed'
                      : 'text-ink-400'
                }`}
              >
                {bet.outcome === 'won'
                  ? t('betting.won', { amount: bet.returned - bet.amount })
                  : bet.outcome === 'lost'
                    ? t('betting.lost', { amount: bet.amount })
                    : bet.outcome === 'refunded'
                      ? t('betting.refunded', { amount: bet.amount })
                      : t('betting.openBet', { amount: bet.amount })}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Card skipEntrance className="overflow-hidden">
        <View className="border-b border-ink-700 bg-ink-900/40 px-3 py-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t('betting.leaderboard')}
          </Text>
        </View>
        {standings.map((standing, index) => {
          const isMe = standing.viewerId === viewer.id;
          return (
            <View
              key={standing.viewerId}
              className={`flex-row items-center px-3 py-2.5 ${
                index < standings.length - 1 ? 'border-b border-ink-700/60' : ''
              } ${isMe ? 'bg-pokeRed/10' : ''}`}
              style={transition(['background-color'])}
            >
              <Text className={`w-5 text-xs font-bold ${index === 0 ? 'text-gold' : 'text-ink-400'}`}>
                {index + 1}
              </Text>
              <View className="mr-2">
                <Avatar
                  name={viewerNameById.get(standing.viewerId) ?? '?'}
                  uri={avatarByViewer?.get(standing.viewerId)}
                  size={24}
                  tone={index === 0 ? 'gold' : 'neutral'}
                />
              </View>
              <Text
                className={`flex-1 text-sm ${isMe ? 'font-bold text-pokeRed' : 'text-ink-100'}`}
                numberOfLines={1}
              >
                {viewerNameById.get(standing.viewerId) ?? '?'}
              </Text>
              <Text className="w-12 text-right text-xs text-ink-400">
                {standing.won}/{standing.bets}
              </Text>
              <Text className="w-16 text-right text-sm font-bold text-ink-100">{standing.total}</Text>
            </View>
          );
        })}
      </Card>
    </View>
  );
}
