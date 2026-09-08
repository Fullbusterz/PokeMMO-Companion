import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Share, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressScale } from '@/components/PressScale';
import { SwissRound, type ResultPick } from '@/components/SwissRound';
import { SwissStandings } from '@/components/SwissStandings';
import { t } from '@/i18n';
import { successHaptic } from '@/lib/haptics';
import { joinUrl } from '@/lib/onlineTournament';
import {
  computeSwissStandings,
  getTotalSwissRounds,
  isRoundComplete,
  matchesOfRound,
  roundHasRepeatedPairing,
} from '@/lib/swissFormat';
import { useOnlineOrganizer } from '@/lib/useOnlineOrganizer';
import { transition } from '@/lib/webMotion';
import { useTournamentStore } from '@/store/tournamentStore';
import colors from '@/theme/colors';
import type { Tournament } from '@/types/tournament';

export function SwissTournamentView({ tournament }: { tournament: Tournament }) {
  const setMatchWinner = useTournamentStore((s) => s.setMatchWinner);
  const startNextSwissRound = useTournamentStore((s) => s.startNextSwissRound);
  const setSwissTotalRounds = useTournamentStore((s) => s.setSwissTotalRounds);
  const addSwissParticipant = useTournamentStore((s) => s.addSwissParticipant);
  const removeSwissParticipant = useTournamentStore((s) => s.removeSwissParticipant);

  const online = useOnlineOrganizer(tournament);
  const [participantDraft, setParticipantDraft] = useState('');
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [publishError, setPublishError] = useState(false);

  const config = tournament.swiss ?? { totalRounds: 5, bestOf: 1 as const };
  const playedRounds = getTotalSwissRounds(tournament.matches);
  const currentRoundComplete = playedRounds > 0 && isRoundComplete(tournament.matches, playedRounds);
  const canPairNextRound = playedRounds < config.totalRounds && (playedRounds === 0 || currentRoundComplete);
  const hasEnoughPlayers = tournament.participants.length >= 2;

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    tournament.participants.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [tournament.participants]);

  const standings = useMemo(
    () => computeSwissStandings(tournament.matches, tournament.participants),
    [tournament.matches, tournament.participants]
  );

  // Rounds newest first: during an event the round you care about is the one
  // being played, and scrolling past four finished rounds to reach it gets
  // old fast.
  const rounds = useMemo(
    () => Array.from({ length: playedRounds }, (_, i) => playedRounds - i),
    [playedRounds]
  );

  // A pending report is shown on the match card itself as well as in the
  // confirm list, so the organizer can see at a glance which of the open
  // matches already have a claimed result.
  const pendingLabelByMatchId = useMemo(() => {
    const map = new Map<string, string>();
    for (const report of online.reports) {
      map.set(
        report.match_id,
        t('swiss.reportSays', {
          reporter: nameById.get(report.reported_by) ?? '?',
          winner: nameById.get(report.winner_id) ?? '?',
        })
      );
    }
    return map;
  }, [online.reports, nameById]);

  const championId = tournament.status === 'finished' ? (standings[0]?.participantId ?? null) : null;

  const handlePick: ResultPick = (matchId, winnerId, score) => {
    setMatchWinner(tournament.id, matchId, winnerId, score);
    successHaptic();
  };

  function handleStartRound() {
    // The button is disabled unless this can succeed, so a false here means
    // the store rejected something the UI thought was fine — surface it
    // inline rather than through Alert.alert, which is a no-op on web.
    const { started } = startNextSwissRound(tournament.id);
    if (!started) return;
    successHaptic();
  }

  // Deliberately no confirmation dialog: adding a round is reversible (the
  // round isn't paired until you tap again) and Alert.alert's buttons don't
  // work on web at all, which is where this app is mostly used.
  function handleAddRound() {
    setSwissTotalRounds(tournament.id, config.totalRounds + 1);
    successHaptic();
  }

  function handleAddParticipant() {
    const name = participantDraft.trim();
    if (!name) return;
    if (!addSwissParticipant(tournament.id, name)) {
      setRosterError(t('newTournament.duplicateNameError', { name }));
      return;
    }
    setRosterError(null);
    setParticipantDraft('');
  }

  async function handlePublish() {
    const result = await online.publish();
    setPublishError(!result.ok);
    if (result.ok) successHaptic();
  }

  async function handleCopyLink() {
    if (!online.code) return;
    await Clipboard.setStringAsync(joinUrl(online.code));
    setLinkCopied(true);
    successHaptic();
  }

  return (
    <View>
      {/* Status strip: where the event is, and whether the players are seeing
          it. Both were loose lines of grey text before, which made the most
          important state on the screen the least visible thing on it. */}
      <Card skipEntrance className="mb-4 px-3 py-2.5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-semibold text-ink-100">
              {t('swiss.roundOf', { current: Math.max(playedRounds, 1), total: config.totalRounds })}
            </Text>
            <View className="rounded-full border border-ink-600 px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-ink-300">Bo{config.bestOf}</Text>
            </View>
          </View>
          {online.isPublished && (
            <View className="flex-row items-center gap-1.5">
              <View
                className={`h-1.5 w-1.5 rounded-full ${
                  online.status === 'error' ? 'bg-pokeRed' : online.status === 'synced' ? 'bg-status-progress' : 'bg-gold'
                }`}
                style={transition(['background-color'], 300)}
              />
              <Text className="text-[11px] text-ink-400">
                {online.status === 'error'
                  ? t('online.syncError')
                  : online.status === 'synced' && online.lastSyncedAt
                    ? t('online.syncedAt', { time: new Date(online.lastSyncedAt).toLocaleTimeString() })
                    : t('online.syncing')}
              </Text>
            </View>
          )}
        </View>

        {/* One pip per round: played, current, still to come. Reads the shape
            of the whole event at a glance, which "Ronda 2 de 5" alone does
            not. */}
        <View className="mt-2.5 flex-row gap-1">
          {Array.from({ length: config.totalRounds }, (_, i) => i + 1).map((round) => {
            const isDone = round < playedRounds || (round === playedRounds && currentRoundComplete);
            const isCurrent = round === playedRounds && !currentRoundComplete;
            return (
              <View
                key={round}
                className={`h-1 flex-1 rounded-full ${
                  isDone ? 'bg-status-progress' : isCurrent ? 'bg-gold' : 'bg-ink-700'
                }`}
                style={transition(['background-color'], 300)}
              />
            );
          })}
        </View>
      </Card>

      {championId && (
        <Card skipEntrance className="mb-4 border border-gold/40 bg-gold/10 px-3 py-3">
          <Text className="text-center text-base font-bold text-gold">
            {t('swiss.finished', { name: nameById.get(championId) ?? '?' })}
          </Text>
        </Card>
      )}

      {/* Sign-up phase: no round has been paired yet, so the roster is still
          editable and players can keep arriving through the link. */}
      {playedRounds === 0 && (
        <View className="mb-6">
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
            {t('swiss.roster', { count: tournament.participants.length })}
          </Text>
          {tournament.participants.length === 0 && (
            <Text className="mb-2 text-sm italic text-ink-400">{t('swiss.waitingPlayers')}</Text>
          )}
          {tournament.participants.map((p) => (
            <View key={p.id} className="mb-2 flex-row items-center justify-between rounded-lg bg-ink-800 px-4 py-3">
              <Text className="flex-1 text-ink-100" numberOfLines={1}>
                {p.name}
              </Text>
              <PressScale haptic="tap" onPress={() => removeSwissParticipant(tournament.id, p.id)} className="px-2 py-1">
                <Text className="text-sm font-semibold text-pokeRed">{t('common.delete')}</Text>
              </PressScale>
            </View>
          ))}
          <View className="mt-1 flex-row gap-2">
            <TextInput
              value={participantDraft}
              onChangeText={setParticipantDraft}
              placeholder={t('newTournament.participantPlaceholder')}
              placeholderTextColor={colors.ink[400]}
              onSubmitEditing={handleAddParticipant}
              returnKeyType="done"
              className="flex-1 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
            />
            <PressScale
              haptic="tap"
              onPress={handleAddParticipant}
              className="justify-center rounded-xl bg-ink-700 px-4 active:bg-ink-600"
            >
              <Text className="font-semibold text-ink-100">{t('newTournament.addParticipant')}</Text>
            </PressScale>
          </View>
          {rosterError && <Text className="mt-2 text-sm text-pokeRed">{rosterError}</Text>}
        </View>
      )}

      {online.reports.length > 0 && (
        <View className="mb-6">
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gold">
            {t('swiss.pendingReports')}
          </Text>
          {online.reports.map((report) => (
            <Card key={report.id} skipEntrance className="mb-2 px-3 py-3">
              <Text className="mb-2 text-sm text-ink-100">
                {t('swiss.reportSays', {
                  reporter: nameById.get(report.reported_by) ?? '?',
                  winner: nameById.get(report.winner_id) ?? '?',
                })}
                {report.score ? ` (${report.score.p1}-${report.score.p2})` : ''}
              </Text>
              <View className="flex-row gap-2">
                <Button className="flex-1" onPress={() => void online.confirmReport(report)}>
                  {t('swiss.confirm')}
                </Button>
                <Button variant="secondary" className="flex-1" onPress={() => void online.rejectReport(report)}>
                  {t('swiss.reject')}
                </Button>
              </View>
            </Card>
          ))}
        </View>
      )}

      {playedRounds > 0 && <SwissStandings standings={standings} nameById={nameById} />}

      {canPairNextRound && (
        <View className="mb-6">
          <Button onPress={handleStartRound} disabled={!hasEnoughPlayers}>
            {playedRounds === 0
              ? t('swiss.startFirstRound')
              : t('swiss.startNextRound', { number: playedRounds + 1 })}
          </Button>
          {!hasEnoughPlayers && <Text className="mt-2 text-xs text-ink-400">{t('swiss.minPlayers')}</Text>}
        </View>
      )}

      {rounds.map((round) => (
        <View key={round}>
          {roundHasRepeatedPairing(tournament.matches, round) && (
            <Text className="mb-2 text-xs text-gold">{t('swiss.repeatedPairingWarning')}</Text>
          )}
          <SwissRound
            round={round}
            totalRounds={config.totalRounds}
            matches={matchesOfRound(tournament.matches, round)}
            nameById={nameById}
            bestOf={config.bestOf}
            onPick={handlePick}
            canEdit={round === playedRounds}
            pendingLabelByMatchId={pendingLabelByMatchId}
          />
        </View>
      ))}

      {tournament.status === 'finished' && (
        <Button variant="secondary" className="mb-6" onPress={handleAddRound}>
          {t('swiss.addRound')}
        </Button>
      )}

      {/* Online section last: it's set up once and then only consulted to
          re-copy the link. */}
      <View className="mb-6">
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
          {t('online.sectionTitle')}
        </Text>
        {!online.isConfigured ? (
          <Text className="text-sm text-ink-400">{t('online.notConfigured')}</Text>
        ) : !online.isPublished ? (
          <View>
            <Button onPress={() => void handlePublish()} disabled={online.status === 'publishing'}>
              {online.status === 'publishing' ? t('online.publishing') : t('online.publishButton')}
            </Button>
            {publishError && <Text className="mt-2 text-sm text-pokeRed">{t('online.pushError')}</Text>}
          </View>
        ) : (
          <Card skipEntrance className="px-3 py-3">
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {t('online.shareTitle')}
            </Text>
            <Text selectable className="mb-2 font-mono text-xs text-ink-100">
              {joinUrl(online.code ?? '')}
            </Text>
            <Text className="mb-3 text-xs text-ink-400">{t('online.shareHint')}</Text>
            <View className="flex-row gap-2">
              <Button variant="secondary" className="flex-1" onPress={() => void handleCopyLink()}>
                {linkCopied ? t('online.linkCopied') : t('online.copyLink')}
              </Button>
              <Button
                className="flex-1"
                onPress={() => void Share.share({ message: joinUrl(online.code ?? '') })}
              >
                {t('common.share')}
              </Button>
            </View>
            <Text className="mt-2 text-center text-xs text-ink-400">
              {t('online.joinCode', { code: online.code })}
            </Text>
          </Card>
        )}
      </View>
    </View>
  );
}
