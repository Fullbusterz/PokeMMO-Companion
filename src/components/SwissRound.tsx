import { memo, useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import { surfaceTransition, transition } from '@/lib/webMotion';
import type { Match, MatchScore } from '@/types/tournament';

export type ResultPick = (matchId: string, winnerId: string, score?: MatchScore) => void;

// A name alone left a lot of empty panel, and an empty panel reads as
// unfinished rather than spacious. An initial disc costs nothing, fills the
// space with something that belongs to the player, and gives the eye an anchor
// when scanning a round for your own name.
function Initial({ name, tone }: { name: string; tone: 'winner' | 'loser' | 'neutral' }) {
  return (
    <View
      className={`h-7 w-7 items-center justify-center rounded-full border ${
        tone === 'winner'
          ? 'border-pokeRed/60 bg-pokeRed/20'
          : tone === 'loser'
            ? 'border-ink-700 bg-transparent'
            : 'border-ink-600 bg-ink-800'
      }`}
    >
      <Text
        className={`text-xs font-bold ${
          tone === 'winner' ? 'text-pokeRed' : tone === 'loser' ? 'text-ink-400' : 'text-ink-300'
        }`}
      >
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

// Two players facing each other across a VS, rather than the stacked full-width
// rows this used to be. Stacked rows read as a list of names — on a wide window
// they became two thousand-pixel bars with a divider between them, and even on
// a phone they never looked like a fixture. Side by side, the card says
// "these two are playing each other" at a glance and stays legible from 320px
// up because names truncate rather than wrap.
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
      <Card index={index} skipEntrance className="mb-2 flex-row items-center gap-2 px-3 py-2.5">
        <View className="h-1.5 w-1.5 rounded-full bg-ink-600" />
        <Text className="flex-1 text-sm italic text-ink-400" numberOfLines={1}>
          {t('swiss.byeRow', { name: restingId ? (nameById.get(restingId) ?? '?') : '?' })}
        </Text>
      </Card>
    );
  }

  const decided = Boolean(match.winnerId);

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

  function renderSide(playerId: string | null, align: 'left' | 'right') {
    const name = playerId ? (nameById.get(playerId) ?? '?') : null;
    const isWinner = match.winnerId === playerId && playerId !== null;
    const isLoser = decided && !isWinner && playerId !== null;
    const isSelected = pendingWinnerId === playerId && playerId !== null;
    const isMe = highlightId === playerId && playerId !== null;
    const games = match.score ? (playerId === match.player1Id ? match.score.p1 : match.score.p2) : null;
    const pickable = canEdit && !decided && Boolean(playerId);

    return (
      <PressScale
        disabled={!pickable}
        haptic="select"
        scaleTo={0.97}
        onPress={() => playerId && handlePress(playerId)}
        className={`flex-1 rounded-lg border px-3 py-2.5 ${
          isWinner
            ? 'border-pokeRed/60 bg-pokeRed/10'
            : isSelected
              ? 'border-gold bg-gold/10'
              : isLoser
                ? 'border-ink-700 bg-transparent'
                : 'border-ink-600 bg-ink-700/40'
        }`}
        style={surfaceTransition()}
      >
        <View className={`flex-row items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          <Initial name={name ?? '?'} tone={isWinner ? 'winner' : isLoser ? 'loser' : 'neutral'} />
          <Text
            className={`flex-1 text-base ${align === 'right' ? 'text-right' : ''} ${
              isWinner ? 'font-bold text-pokeRed' : isLoser ? 'text-ink-400' : 'font-semibold text-ink-100'
            }`}
            numberOfLines={1}
            style={transition(['color'])}
          >
            {name ?? '—'}
          </Text>
          {games !== null && (
            <Text className={`text-lg font-bold ${isWinner ? 'text-pokeRed' : 'text-ink-400'}`}>{games}</Text>
          )}
        </View>
        {isMe && (
          <Text className={`mt-0.5 text-[10px] uppercase tracking-wide text-gold ${align === 'right' ? 'text-right' : ''}`}>
            {t('swiss.youLabel')}
          </Text>
        )}
      </PressScale>
    );
  }

  return (
    <Card index={index} skipEntrance className="mb-2 px-3 py-3">
      <View className="flex-row items-center gap-2">
        {renderSide(match.player1Id, 'left')}
        <Text className="px-0.5 text-[11px] font-bold uppercase text-ink-400">{t('bracket.vs')}</Text>
        {renderSide(match.player2Id, 'right')}
      </View>

      {pendingWinnerId && (
        <View className="mt-3 border-t border-ink-700 pt-3">
          <Text className="mb-2 text-xs text-ink-400">{t('swiss.pickScore')}</Text>
          <View className="flex-row gap-2">
            {(
              [
                [2, 0],
                [2, 1],
              ] as const
            ).map(([winnerGames, loserGames]) => (
              <PressScale
                key={`${winnerGames}-${loserGames}`}
                haptic="tap"
                onPress={() => commitScore(winnerGames, loserGames)}
                className="flex-1 rounded-lg border border-gold/50 py-2 active:bg-ink-700"
                style={surfaceTransition()}
              >
                <Text className="text-center font-semibold text-ink-100">
                  {`${winnerGames}-${loserGames}`}
                </Text>
              </PressScale>
            ))}
          </View>
        </View>
      )}

      {pendingLabel && !decided && (
        <View className="mt-2 flex-row items-center gap-1.5 rounded-lg bg-gold/10 px-2 py-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-gold" />
          <Text className="flex-1 text-xs text-gold">{pendingLabel}</Text>
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
  const playable = matches.filter((m) => !m.isBye);
  const decided = playable.filter((m) => m.winnerId).length;
  const missing = playable.length - decided;

  return (
    <View className="mb-6">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="text-sm font-semibold uppercase tracking-wide text-ink-400">
          {t('swiss.roundOf', { current: round, total: totalRounds })}
        </Text>
        {/* A count of what's outstanding, plus the same thing as a bar — at a
            glance across the table you want "how far along is this round?"
            without reading. */}
        <View className="flex-row items-center gap-2">
          {missing > 0 && <Text className="text-xs text-ink-400">{t('swiss.waitingResults', { count: missing })}</Text>}
          {playable.length > 0 && (
            <View className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-700">
              <View
                className={`h-full rounded-full ${missing === 0 ? 'bg-status-progress' : 'bg-gold'}`}
                style={[{ width: `${(decided / playable.length) * 100}%` }, transition(['width'], 320)]}
              />
            </View>
          )}
        </View>
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
