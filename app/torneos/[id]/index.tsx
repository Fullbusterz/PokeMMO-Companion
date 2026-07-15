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
import { computeStandings, getTotalLeagueRounds, type LeagueStanding } from '@/lib/leagueFormat';
import colors from '@/theme/colors';
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

// League matches never eliminate anyone, so unlike MatchCard there's no
// winner/loser strikethrough distinction to draw — every player stays "in
// the tournament" regardless of this match's outcome.
const LeagueMatchRow = memo(function LeagueMatchRow({
  match,
  index,
  nameById,
  tournamentId,
  setMatchWinner,
}: {
  match: Match;
  index: number;
  nameById: Map<string, string>;
  tournamentId: string;
  setMatchWinner: SetMatchWinner;
}) {
  if (match.isBye) {
    const restingId = match.player1Id ?? match.player2Id;
    return (
      <Card index={index} skipEntrance className="mb-2 px-3 py-2.5">
        <Text className="text-sm italic text-ink-400">
          {t('league.restsThisMatchday', { name: restingId ? nameById.get(restingId) ?? '?' : '?' })}
        </Text>
      </Card>
    );
  }

  function renderPlayer(playerId: string | null) {
    const name = playerId ? nameById.get(playerId) ?? '?' : null;
    const isWinner = match.winnerId === playerId && playerId !== null;
    const canPick = !match.winnerId && Boolean(match.player1Id) && Boolean(match.player2Id) && Boolean(playerId);
    const textClass = ['text-base', isWinner ? 'font-bold text-pokeRed' : 'text-ink-100'].join(' ');

    return (
      <PressScale
        disabled={!canPick}
        haptic="select"
        scaleTo={0.98}
        onPress={() => playerId && setMatchWinner(tournamentId, match.id, playerId)}
        className={`px-3 py-2.5 ${isWinner ? 'bg-pokeRed/10' : ''}`}
      >
        <Text className={textClass}>{name ?? '—'}</Text>
      </PressScale>
    );
  }

  return (
    <Card index={index} skipEntrance className="mb-2 overflow-hidden">
      {renderPlayer(match.player1Id)}
      <VsDivider />
      {renderPlayer(match.player2Id)}
    </Card>
  );
});

function LeagueMatchdaySection({
  round,
  matches,
  nameById,
  tournamentId,
  setMatchWinner,
  date,
  setMatchdayDate,
}: {
  round: number;
  matches: Match[];
  nameById: Map<string, string>;
  tournamentId: string;
  setMatchWinner: SetMatchWinner;
  date: string;
  setMatchdayDate: (tournamentId: string, round: number, date: string) => void;
}) {
  return (
    <View className="mb-6">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="text-sm font-semibold uppercase tracking-wide text-ink-400">
          {t('league.matchday', { number: round })}
        </Text>
        <TextInput
          value={date}
          onChangeText={(value) => setMatchdayDate(tournamentId, round, value)}
          placeholder={t('league.datePlaceholder')}
          placeholderTextColor={colors.ink[400]}
          className="rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs text-ink-100"
        />
      </View>
      {matches.map((match, index) => (
        <LeagueMatchRow
          key={match.id}
          match={match}
          index={index}
          nameById={nameById}
          tournamentId={tournamentId}
          setMatchWinner={setMatchWinner}
        />
      ))}
    </View>
  );
}

function StandingsTable({ standings, nameById }: { standings: LeagueStanding[]; nameById: Map<string, string> }) {
  return (
    <Card skipEntrance className="mb-6 overflow-hidden">
      <View className="flex-row items-center px-3 py-2">
        <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
          {t('league.standingsTitle')}
        </Text>
        <Text className="w-9 text-center text-xs font-semibold text-ink-400">{t('league.played')}</Text>
        <Text className="w-9 text-center text-xs font-semibold text-ink-400">{t('league.wins')}</Text>
        <Text className="w-9 text-center text-xs font-semibold text-ink-400">{t('league.losses')}</Text>
        <Text className="w-9 text-center text-xs font-semibold text-ink-400">{t('league.points')}</Text>
      </View>
      {standings.map((s, index) => (
        <View
          key={s.participantId}
          className={`flex-row items-center px-3 py-2 ${index < standings.length - 1 ? 'border-b border-ink-700' : ''}`}
        >
          <Text className="flex-1 text-sm font-semibold text-ink-100" numberOfLines={1}>
            {index + 1}. {nameById.get(s.participantId) ?? '?'}
          </Text>
          <Text className="w-9 text-center text-sm text-ink-300">{s.played}</Text>
          <Text className="w-9 text-center text-sm text-ink-300">{s.wins}</Text>
          <Text className="w-9 text-center text-sm text-ink-300">{s.losses}</Text>
          <Text className="w-9 text-center text-sm font-bold text-ink-100">{s.points}</Text>
        </View>
      ))}
    </Card>
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
  const setMatchdayDate = useTournamentStore((s) => s.setMatchdayDate);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const format = tournament?.format ?? 'single';
  const isDouble = format === 'double';
  const isLeague = format === 'league';

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    tournament?.participants.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [tournament?.participants]);

  const leagueMatches = useMemo(() => (isLeague ? (tournament?.matches ?? []) : []), [tournament?.matches, isLeague]);
  const leagueByRound = useMemo(() => groupByRound(leagueMatches), [leagueMatches]);
  const leagueTotalRounds = useMemo(() => getTotalLeagueRounds(leagueMatches), [leagueMatches]);
  const standings = useMemo(
    () => (isLeague ? computeStandings(leagueMatches, tournament?.participants ?? []) : []),
    [isLeague, leagueMatches, tournament?.participants]
  );

  // Everything below is grouped by bracket section: for a single-elim
  // tournament, matches have no `bracket` tag, so "winners" here just means
  // "all of them" — the whole flat rounds list. For double-elim, it's the
  // actual winners-bracket subset (losers/final render separately below).
  // League matches render through their own section further down instead.
  const winnersMatches = useMemo(
    () =>
      isLeague
        ? []
        : isDouble
          ? (tournament?.matches ?? []).filter((m) => m.bracket === 'winners')
          : (tournament?.matches ?? []),
    [tournament?.matches, isDouble, isLeague]
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
    // League has no elimination final — "champion" is just whoever tops the
    // table once every matchday is decided, so it stays null until then.
    if (isLeague) return tournament?.status === 'finished' ? (standings[0]?.participantId ?? null) : null;
    if (isDouble) return finalMatch?.winnerId ?? null;
    const final = winnersMatches.find((m) => m.round === winnersTotalRounds);
    return final?.winnerId ?? null;
  }, [isLeague, isDouble, finalMatch, winnersMatches, winnersTotalRounds, tournament?.status, standings]);

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
        <Header title={t('tournaments.title')} backHref="/torneos" />
        <Text className="text-ink-400">{t('tournaments.empty')}</Text>
      </Screen>
    );
  }

  const winnersRounds = Array.from({ length: winnersTotalRounds }, (_, i) => i + 1);
  const losersRounds = Array.from({ length: losersTotalRounds }, (_, i) => i + 1);
  const leagueRounds = Array.from({ length: leagueTotalRounds }, (_, i) => i + 1);
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
        <Header title={tournament.name} backHref="/torneos" onEdit={startEditingName} />
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

        {isLeague && <StandingsTable standings={standings} nameById={nameById} />}

        {isLeague &&
          leagueRounds.map((round) => (
            <LeagueMatchdaySection
              key={`ld-${round}`}
              round={round}
              matches={leagueByRound.get(round) ?? []}
              nameById={nameById}
              tournamentId={tournamentId}
              setMatchWinner={setMatchWinner}
              date={tournament.matchdayDates?.[String(round)] ?? ''}
              setMatchdayDate={setMatchdayDate}
            />
          ))}

        {!isLeague && isDouble && (
          <Text className="mb-3 text-base font-bold text-ink-100">{t('bracket.winnersBracket')}</Text>
        )}
        {!isLeague &&
          winnersRounds.map((round) => (
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

        {!isLeague && isDouble && (
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
