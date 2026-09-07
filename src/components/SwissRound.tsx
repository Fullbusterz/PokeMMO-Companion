import { memo, useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { PressScale } from '@/components/PressScale';
import { VsDivider } from '@/components/VsDivider';
import { t } from '@/i18n';
import type { Match, MatchScore } from '@/types/tournament';

export type ResultPick = (matchId: string, winnerId: string, score?: MatchScore) => void;

// Bo3 needs two taps (who won, then 2-0 or 2-1) — asking for the score first
// and the winner second would let someone record an impossible 2-1 for a
// player who lost. Bo1 stays a single tap.
const SwissMatchCard = memo(function SwissMatchCard({
  match,
  index,
  nameById,
  bestOf,
  onPick,
  canEdit,
  highlightId,
  pendingLabel,
}: {
  match: Match;
  index: number;
  nameById: Map<string, string>;
  bestOf: 1 | 3;
  onPick?: ResultPick;
  canEdit: boolean;
  highlightId?: string | null;
  pendingLabel?: string;
}) {
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);

  if (match.isBye) {
    const restingId = match.player1Id ?? match.player2Id;
    return (
      <Card index={index} skipEntrance className="mb-2 px-3 py-2.5">
        <Text className="text-sm italic text-ink-400">
          {t('swiss.byeRow', { name: restingId ? (nameById.get(restingId) ?? '?') : '?' })}
        </Text>
      </Card>
    );
  }

  function handlePress(playerId: string) {
    if (!onPick || !canEdit) return;
    if (bestOf === 1) {
      onPick(match.id, playerId);
      return;
    }
    setPendingWinnerId((current) => (current === playerId ? null : playerId));
  }

  function commitScore(winnerGames: number, loserGames: number) {
    if (!onPick || !pendingWinnerId) return;
    const p1IsWinner = pendingWinnerId === match.player1Id;
    onPick(match.id, pendingWinnerId, {
      p1: p1IsWinner ? winnerGames : loserGames,
      p2: p1IsWinner ? loserGames : winnerGames,
    });
    setPendingWinnerId(null);
  }

  function renderPlayer(playerId: string | null) {
    const name = playerId ? (nameById.get(playerId) ?? '?') : null;
    const isWinner = match.winnerId === playerId && playerId !== null;
    const isLoser = Boolean(match.winnerId) && match.winnerId !== playerId && playerId !== null;
    const isSelected = pendingWinnerId === playerId && playerId !== null;
    const isMe = highlightId === playerId && playerId !== null;
    const games = match.score ? (playerId === match.player1Id ? match.score.p1 : match.score.p2) : null;

    return (
      <PressScale
        disabled={!canEdit || Boolean(match.winnerId) || !playerId}
        haptic="select"
        scaleTo={0.98}
        onPress={() => playerId && handlePress(playerId)}
        className={`flex-row items-center px-3 py-2.5 ${isWinner ? 'bg-pokeRed/10' : ''} ${
          isSelected ? 'bg-gold/10' : ''
        }`}
      >
        <Text
          className={`flex-1 text-base ${isWinner ? 'font-bold text-pokeRed' : ''} ${
            isLoser ? 'text-ink-400' : 'text-ink-100'
          } ${isMe ? 'italic' : ''}`}
          numberOfLines={1}
        >
          {name ?? '—'}
        </Text>
        {games !== null && <Text className="ml-2 text-base font-bold text-ink-100">{games}</Text>}
      </PressScale>
    );
  }

  return (
    <Card index={index} skipEntrance className="mb-2 overflow-hidden">
      {renderPlayer(match.player1Id)}
      <VsDivider />
      {renderPlayer(match.player2Id)}

      {pendingWinnerId && (
        <View className="border-t border-ink-700 px-3 py-2">
          <Text className="mb-2 text-xs text-ink-400">{t('swiss.pickScore')}</Text>
          <View className="flex-row gap-2">
            <PressScale
              haptic="tap"
              onPress={() => commitScore(2, 0)}
              className="flex-1 rounded-lg border border-gold/40 py-2 active:bg-ink-700"
            >
              <Text className="text-center font-semibold text-ink-100">{t('swiss.scoreTwoZero')}</Text>
            </PressScale>
            <PressScale
              haptic="tap"
              onPress={() => commitScore(2, 1)}
              className="flex-1 rounded-lg border border-gold/40 py-2 active:bg-ink-700"
            >
              <Text className="text-center font-semibold text-ink-100">{t('swiss.scoreTwoOne')}</Text>
            </PressScale>
          </View>
        </View>
      )}

      {pendingLabel && !match.winnerId && (
        <View className="border-t border-ink-700 px-3 py-2">
          <Text className="text-xs text-gold">{pendingLabel}</Text>
        </View>
      )}
    </Card>
  );
});

export function SwissRound({
  round,
  totalRounds,
  matches,
  nameById,
  bestOf,
  onPick,
  canEdit = false,
  highlightId,
  pendingLabelByMatchId,
}: {
  round: number;
  totalRounds: number;
  matches: Match[];
  nameById: Map<string, string>;
  bestOf: 1 | 3;
  onPick?: ResultPick;
  canEdit?: boolean;
  highlightId?: string | null;
  pendingLabelByMatchId?: Map<string, string>;
}) {
  const missing = matches.filter((m) => !m.isBye && !m.winnerId).length;

  return (
    <View className="mb-6">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold uppercase tracking-wide text-ink-400">
          {t('swiss.roundOf', { current: round, total: totalRounds })}
        </Text>
        {missing > 0 && <Text className="text-xs text-ink-400">{t('swiss.waitingResults', { count: missing })}</Text>}
      </View>
      {matches.map((match, index) => (
        <SwissMatchCard
          key={match.id}
          match={match}
          index={index}
          nameById={nameById}
          bestOf={bestOf}
          onPick={onPick}
          canEdit={canEdit}
          highlightId={highlightId}
          pendingLabel={pendingLabelByMatchId?.get(match.id)}
        />
      ))}
    </View>
  );
}
