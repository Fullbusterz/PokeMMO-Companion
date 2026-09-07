import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

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
  type Viewer,
} from '@/lib/betting';
import colors from '@/theme/colors';
import type { Match } from '@/types/tournament';

// Odds move as people bet, so the figure on screen is always provisional. The
// UI shows it to two decimals and says plainly that the number that counts is
// the one at settlement — quoting it as if it were fixed would be a lie.
function formatOdds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return value.toFixed(2).replace(/\.00$/, '');
}

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
  const [stakeDraft, setStakeDraft] = useState('10');

  const pool = useMemo(() => poolFor(bets, match.id), [bets, match.id]);
  const eligibility = betEligibility(match, viewer, bets, balance);
  const myBet = bets.find((b) => b.matchId === match.id && b.viewerId === viewer.id);

  const stake = Math.max(0, Math.min(balance, Math.floor(Number(stakeDraft) || 0)));
  const projectedOdds = pick ? currentOdds(pool, pick, stake) : 0;

  function renderSide(playerId: string | null) {
    if (!playerId) return null;
    const staked = pool.byPick.get(playerId) ?? 0;
    const odds = currentOdds(pool, playerId);
    const isPicked = pick === playerId;
    const isMyBet = myBet?.pick === playerId;

    return (
      <PressScale
        key={playerId}
        haptic="select"
        scaleTo={0.98}
        disabled={!eligibility.canBet}
        onPress={() => setPick((current) => (current === playerId ? null : playerId))}
        className={`flex-1 rounded-xl border p-3 ${
          isPicked ? 'border-pokeRed bg-pokeRed/10' : isMyBet ? 'border-gold/60 bg-gold/10' : 'border-ink-600'
        }`}
      >
        <Text className="text-sm font-semibold text-ink-100" numberOfLines={1}>
          {nameById.get(playerId) ?? '?'}
        </Text>
        <Text className="mt-1 text-xs text-ink-400">
          {t('betting.oddsLabel', { odds: formatOdds(odds) })} · {staked}
        </Text>
      </PressScale>
    );
  }

  return (
    <Card skipEntrance className="mb-3 px-3 py-3">
      <Text className="mb-2 text-xs uppercase tracking-wide text-ink-400">
        {t('betting.poolLabel', { total: pool.total })}
      </Text>

      <View className="flex-row gap-2">
        {renderSide(match.player1Id)}
        {renderSide(match.player2Id)}
      </View>

      {myBet && (
        <Text className="mt-2 text-xs text-gold">
          {t('betting.yourBet', { amount: myBet.amount, pick: nameById.get(myBet.pick) ?? '?' })}
        </Text>
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

      {eligibility.canBet && pick && (
        <View className="mt-3 border-t border-ink-700 pt-3">
          <Text className="mb-1 text-xs text-ink-400">{t('betting.stakeLabel')}</Text>
          <TextInput
            value={stakeDraft}
            onChangeText={setStakeDraft}
            keyboardType="number-pad"
            placeholderTextColor={colors.ink[400]}
            className="mb-2 rounded-xl border border-ink-600 bg-ink-800 px-4 py-2 text-base text-ink-100"
          />
          <Text className="mb-2 text-xs text-ink-400">
            {t('betting.wouldReturn', { amount: Math.floor(stake * projectedOdds) })}
          </Text>
          <Button
            disabled={stake < 1 || isPlacing}
            onPress={() => {
              onPlace(match.id, pick, stake);
              setPick(null);
            }}
          >
            {isPlacing ? t('betting.placing') : t('betting.placeBet', { amount: stake })}
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
}: {
  /** Matches of the round currently on the table. */
  matches: Match[];
  viewer: Viewer;
  viewers: Viewer[];
  bets: Bet[];
  startingChips: number;
  nameById: Map<string, string>;
  onPlace: (matchId: string, pick: string, amount: number) => void;
  isPlacing: boolean;
  error: boolean;
}) {
  const standings = useMemo(
    () => chipStandings(viewers, bets, matches, startingChips),
    [viewers, bets, matches, startingChips]
  );
  const mine = standings.find((s) => s.viewerId === viewer.id);
  const settled = useMemo(() => settleBets(bets, matches), [bets, matches]);
  const myBets = settled.filter((b) => b.viewerId === viewer.id);
  const viewerNameById = useMemo(() => new Map(viewers.map((v) => [v.id, v.name])), [viewers]);

  return (
    <View className="mb-6">
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text className="text-sm font-semibold uppercase tracking-wide text-ink-400">{t('betting.title')}</Text>
        <Text className="text-sm font-bold text-gold">
          {mine?.balance ?? startingChips} {t('betting.chips')}
          {mine && mine.atStake > 0 ? ` · ${t('betting.atStake', { count: mine.atStake })}` : ''}
        </Text>
      </View>
      <Text className="mb-3 text-xs text-ink-400">{t('betting.explainer')}</Text>

      {matches
        .filter((m) => !m.isBye && !m.winnerId)
        .map((match) => (
          <BettableMatch
            key={match.id}
            match={match}
            viewer={viewer}
            bets={bets}
            balance={mine?.balance ?? startingChips}
            nameById={nameById}
            onPlace={onPlace}
            isPlacing={isPlacing}
          />
        ))}

      {error && <Text className="mb-2 text-sm text-pokeRed">{t('betting.betError')}</Text>}
      <Text className="mb-4 text-xs text-ink-400">{t('betting.returnNote')}</Text>

      {myBets.length > 0 && (
        <View className="mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t('betting.history')}
          </Text>
          {myBets.map((bet) => (
            <View key={bet.id} className="mb-1 flex-row items-center justify-between">
              <Text className="flex-1 text-xs text-ink-300" numberOfLines={1}>
                {nameById.get(bet.pick) ?? '?'} · {bet.amount}
              </Text>
              <Text
                className={`text-xs font-semibold ${
                  bet.outcome === 'won' ? 'text-status-finished' : bet.outcome === 'lost' ? 'text-pokeRed' : 'text-ink-400'
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
        <View className="border-b border-ink-700 px-3 py-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t('betting.leaderboard')}
          </Text>
        </View>
        {standings.map((standing, index) => (
          <View
            key={standing.viewerId}
            className={`flex-row items-center px-3 py-2 ${
              index < standings.length - 1 ? 'border-b border-ink-700' : ''
            } ${standing.viewerId === viewer.id ? 'bg-pokeRed/10' : ''}`}
          >
            <Text className="flex-1 text-sm text-ink-100" numberOfLines={1}>
              {index + 1}. {viewerNameById.get(standing.viewerId) ?? '?'}
            </Text>
            <Text className="w-12 text-right text-sm text-ink-400">{standing.won}/{standing.bets}</Text>
            <Text className="w-16 text-right text-sm font-bold text-ink-100">{standing.total}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}
