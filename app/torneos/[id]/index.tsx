import * as Sharing from 'expo-sharing';
import { Link, useLocalSearchParams } from 'expo-router';
import { memo, useMemo, useRef, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { VsDivider } from '@/components/VsDivider';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { getTotalRounds } from '@/lib/bracket';
import { useTournamentStore } from '@/store/tournamentStore';
import type { Match } from '@/types/tournament';

function roundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return t('bracket.final');
  if (round === totalRounds - 1) return t('bracket.semifinal');
  return t('bracket.round', { number: round });
}

type SetMatchWinner = (tournamentId: string, matchId: string, winnerId: string) => void;

// Memoized per match.id: since the store only creates a new object for
// matches whose winner/slots actually changed, a single winner pick only
// re-renders the 1-2 affected cards instead of the whole bracket tree.
const MatchCard = memo(function MatchCard({
  match,
  index,
  nameById,
  positionById,
  tournamentId,
  setMatchWinner,
}: {
  match: Match;
  index: number;
  nameById: Map<string, string>;
  positionById: Map<string, number>;
  tournamentId: string;
  setMatchWinner: SetMatchWinner;
}) {
  function renderPlayer(playerId: string | null) {
    const name = playerId ? nameById.get(playerId) ?? '?' : null;
    // Only the introductory round (winners bracket round 1, or single-elim's
    // only round 1) shows the draw position — everywhere else the same
    // lookup would just re-show it on every later match, which is noise.
    const isIntroRound = match.round === 1 && match.bracket !== 'losers' && match.bracket !== 'final';
    const position = playerId && isIntroRound ? positionById.get(playerId) : undefined;
    const isWinner = match.winnerId === playerId && playerId !== null;
    const isLoser = Boolean(match.winnerId) && match.winnerId !== playerId && playerId !== null;
    const canPick = !match.winnerId && Boolean(match.player1Id) && Boolean(match.player2Id) && Boolean(playerId);
    const textClass = [
      'text-base',
      isWinner ? 'font-bold text-pokeRed' : 'text-ink-100',
      isLoser && 'text-ink-400 line-through',
      !name && 'italic text-ink-400',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <PressScale
        disabled={!canPick}
        haptic="select"
        scaleTo={0.98}
        onPress={() => playerId && setMatchWinner(tournamentId, match.id, playerId)}
        className={`px-3 py-2.5 ${isWinner ? 'bg-pokeRed/10' : ''}`}
      >
        <Text className={textClass}>{name ?? '—'}</Text>
        {position !== undefined && (
          <Text className="text-xs text-ink-400">{t('bracket.position', { number: position })}</Text>
        )}
      </PressScale>
    );
  }

  return (
    // This card lives inside bracketRef, which shareAsImage() captures —
    // skipEntrance so a share right after a re-render never grabs a
    // mid-fade-in frame.
    <Card index={index} skipEntrance className="mb-2 overflow-hidden">
      {renderPlayer(match.player1Id)}
      <VsDivider />
      {renderPlayer(match.player2Id)}
    </Card>
  );
});

function RoundSection({
  title,
  matches,
  nameById,
  positionById,
  tournamentId,
  setMatchWinner,
}: {
  title: string;
  matches: Match[];
  nameById: Map<string, string>;
  positionById: Map<string, number>;
  tournamentId: string;
  setMatchWinner: SetMatchWinner;
}) {
  return (
    <View className="mb-6">
      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">{title}</Text>
      {matches.map((match, index) => (
        <MatchCard
          key={match.id}
          match={match}
          index={index}
          nameById={nameById}
          positionById={positionById}
          tournamentId={tournamentId}
          setMatchWinner={setMatchWinner}
        />
      ))}
    </View>
  );
}

function groupByRound(matches: Match[]): Map<number, Match[]> {
  const map = new Map<number, Match[]>();
  matches.forEach((m) => {
    const list = map.get(m.round);
    if (list) list.push(m);
    else map.set(m.round, [m]);
  });
  for (const list of map.values()) list.sort((a, b) => a.slot - b.slot);
  return map;
}

export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournament = useTournamentStore((s) => s.tournaments.find((tt) => tt.id === id));
  const setMatchWinner = useTournamentStore((s) => s.setMatchWinner);
  const undoLastMatch = useTournamentStore((s) => s.undoLastMatch);
  const renameTournament = useTournamentStore((s) => s.renameTournament);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const format = tournament?.format ?? 'single';
  const isDouble = format === 'double';

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    tournament?.participants.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [tournament?.participants]);

  // Everything below is grouped by bracket section: for a single-elim
  // tournament, matches have no `bracket` tag, so "winners" here just means
  // "all of them" — the whole flat rounds list. For double-elim, it's the
  // actual winners-bracket subset (losers/final render separately below).
  const winnersMatches = useMemo(
    () => (isDouble ? (tournament?.matches ?? []).filter((m) => m.bracket === 'winners') : (tournament?.matches ?? [])),
    [tournament?.matches, isDouble]
  );
  const losersMatches = useMemo(
    () => (isDouble ? (tournament?.matches ?? []).filter((m) => m.bracket === 'losers') : []),
    [tournament?.matches, isDouble]
  );
  const finalMatch = useMemo(
    () => (isDouble ? (tournament?.matches ?? []).find((m) => m.bracket === 'final') : undefined),
    [tournament?.matches, isDouble]
  );

  const winnersByRound = useMemo(() => groupByRound(winnersMatches), [winnersMatches]);
  const losersByRound = useMemo(() => groupByRound(losersMatches), [losersMatches]);
  const winnersTotalRounds = useMemo(() => getTotalRounds(winnersMatches), [winnersMatches]);
  const losersTotalRounds = useMemo(() => getTotalRounds(losersMatches), [losersMatches]);

  const championId = useMemo(() => {
    if (isDouble) return finalMatch?.winnerId ?? null;
    const final = winnersMatches.find((m) => m.round === winnersTotalRounds);
    return final?.winnerId ?? null;
  }, [isDouble, finalMatch, winnersMatches, winnersTotalRounds]);

  // Draw position (not a skill ranking — the draw is random). Only the
  // winners bracket's round 1 structurally holds every participant exactly
  // once, so position = their slot there, 1-indexed.
  const positionById = useMemo(() => {
    const map = new Map<string, number>();
    (winnersByRound.get(1) ?? []).forEach((m) => {
      if (m.player1Id) map.set(m.player1Id, m.slot * 2 + 1);
      if (m.player2Id) map.set(m.player2Id, m.slot * 2 + 2);
    });
    return map;
  }, [winnersByRound]);

  const bracketRef = useRef<View>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);

  if (!tournament) {
    return (
      <Screen>
        <Header title={t('tournaments.title')} />
        <Text className="text-ink-400">{t('tournaments.empty')}</Text>
      </Screen>
    );
  }

  const winnersRounds = Array.from({ length: winnersTotalRounds }, (_, i) => i + 1);
  const losersRounds = Array.from({ length: losersTotalRounds }, (_, i) => i + 1);
  const tournamentId = tournament.id;
  const tournamentName = tournament.name;

  function startEditingName() {
    setNameDraft(tournamentName);
    setIsEditingName(true);
  }

  function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Alert.alert(t('newTournament.nameRequiredError'));
      return;
    }
    renameTournament(tournamentId, trimmed);
    setIsEditingName(false);
  }

  async function shareAsImage() {
    if (!bracketRef.current) return;
    setIsSharingImage(true);
    try {
      const uri = await captureRef(bracketRef, { format: 'png', quality: 1 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert(t('bracket.shareImageUnavailable'));
      }
    } catch {
      Alert.alert(t('bracket.shareImageError'));
    } finally {
      setIsSharingImage(false);
    }
  }

  return (
    <Screen>
      {isEditingName ? (
        <View className="mb-4">
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            autoFocus
            className="mb-2 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-xl font-bold text-ink-100"
          />
          <View className="flex-row gap-3">
            <Button variant="secondary" onPress={() => setIsEditingName(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onPress={saveName} className="flex-1">
              {t('common.save')}
            </Button>
          </View>
        </View>
      ) : (
        <Header title={tournament.name} onEdit={startEditingName} />
      )}

      <View className="mb-3 flex-row gap-3">
        <Link href={`/torneos/${tournament.id}/export`} asChild>
          <Button variant="secondary" className="flex-1">
            {t('exportImport.exportTitle')}
          </Button>
        </Link>
        {tournament.history.length > 0 && (
          <Button variant="secondary" onPress={() => undoLastMatch(tournamentId)} className="flex-1">
            {t('bracket.undoButton')}
          </Button>
        )}
      </View>

      <Button variant="secondary" onPress={shareAsImage} disabled={isSharingImage} className="mb-6">
        {isSharingImage ? t('bracket.sharingImage') : t('bracket.shareImageButton')}
      </Button>

      {!championId && <Text className="mb-4 text-sm text-ink-400">{t('bracket.tapToSetWinner')}</Text>}

      <View ref={bracketRef} collapsable={false} className="bg-ink-900">
        {championId && (
          <Animated.View
            entering={nativeOnly(ZoomIn.duration(380).springify().damping(12))}
            className="mb-5 rounded-xl border border-type-electric/30 bg-type-electric/10 p-4 shadow-md shadow-type-electric/30"
          >
            <Text className="text-center text-base font-bold text-type-electric">
              {t('bracket.champion', { name: nameById.get(championId) ?? '?' })}
            </Text>
          </Animated.View>
        )}

        {isDouble && (
          <Text className="mb-3 text-base font-bold text-ink-100">{t('bracket.winnersBracket')}</Text>
        )}
        {winnersRounds.map((round) => (
          <RoundSection
            key={`w-${round}`}
            title={isDouble ? t('bracket.round', { number: round }) : roundLabel(round, winnersTotalRounds)}
            matches={winnersByRound.get(round) ?? []}
            nameById={nameById}
            positionById={positionById}
            tournamentId={tournamentId}
            setMatchWinner={setMatchWinner}
          />
        ))}

        {isDouble && (
          <>
            <Text className="mb-3 text-base font-bold text-ink-100">{t('bracket.losersBracket')}</Text>
            {losersRounds.map((round) => (
              <RoundSection
                key={`l-${round}`}
                title={t('bracket.losersRound', { number: round })}
                matches={losersByRound.get(round) ?? []}
                nameById={nameById}
                positionById={positionById}
                tournamentId={tournamentId}
                setMatchWinner={setMatchWinner}
              />
            ))}

            {finalMatch && (
              <RoundSection
                title={t('bracket.grandFinal')}
                matches={[finalMatch]}
                nameById={nameById}
                positionById={positionById}
                tournamentId={tournamentId}
                setMatchWinner={setMatchWinner}
              />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
