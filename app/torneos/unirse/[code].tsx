import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { AvatarEditor } from '@/components/AvatarEditor';
import { BettingPanel } from '@/components/BettingPanel';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { SwissRound } from '@/components/SwissRound';
import { SwissStandings } from '@/components/SwissStandings';
import { t } from '@/i18n';
import { DEFAULT_STARTING_CHIPS, type Bet, type Viewer } from '@/lib/betting';
import { successHaptic } from '@/lib/haptics';
import {
  fetchOnlineTournament,
  joinAsViewer,
  normalizeJoinCode,
  placeBet,
  submitOnlineSignup,
  submitReportAsViewer,
  type BetRow,
  type ReportRow,
  type ViewerIdentity,
  type ViewerRow,
} from '@/lib/onlineTournament';
import { useAvatars } from '@/lib/useAvatars';
import { isOnlineConfigured, ONLINE_POLL_MS, SupabaseError } from '@/lib/supabase';
import {
  clearViewerIdentity,
  loadPendingSignupName,
  loadViewerIdentity,
  savePendingSignupName,
  saveViewerIdentity,
} from '@/lib/viewerIdentity';
import { computeSwissStandings, getTotalSwissRounds, matchesOfRound } from '@/lib/swissFormat';
import colors from '@/theme/colors';
import type { Match, MatchScore, Tournament } from '@/types/tournament';

type EntryMode = 'player' | 'spectator';

export default function JoinTournament() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeJoinCode(params.code ?? '');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [viewerRows, setViewerRows] = useState<ViewerRow[]>([]);
  const [betRows, setBetRows] = useState<BetRow[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading');

  const [identity, setIdentity] = useState<ViewerIdentity | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const [mode, setMode] = useState<EntryMode>('player');
  const [nameDraft, setNameDraft] = useState('');
  const [slotDraft, setSlotDraft] = useState<string | null>(null);
  const [joinState, setJoinState] = useState<'idle' | 'sending' | 'taken' | 'error'>('idle');

  const [reportState, setReportState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);
  const [betState, setBetState] = useState<'idle' | 'sending' | 'error'>('idle');

  useEffect(() => {
    if (!code) return;
    Promise.all([loadViewerIdentity(code), loadPendingSignupName(code)])
      .then(([stored, pending]) => {
        if (stored) setIdentity(stored);
        if (pending) setPendingName(pending);
      })
      .finally(() => setIdentityLoaded(true));
  }, [code]);

  const refresh = useCallback(async () => {
    if (!code || !isOnlineConfigured()) {
      setLoadState('error');
      return;
    }
    try {
      const snapshot = await fetchOnlineTournament(code);
      if (!snapshot) {
        setLoadState('notFound');
        return;
      }
      setTournament(snapshot.tournament);
      setReports(snapshot.reports);
      setViewerRows(snapshot.viewers);
      setBetRows(snapshot.bets);
      setLoadState('ready');
    } catch {
      // Keep whatever is already on screen: a dropped poll shouldn't blank out
      // the standings someone is reading.
      setLoadState((current) => (current === 'loading' ? 'error' : current));
    }
  }, [code]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), ONLINE_POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const storeIdentity = useCallback(
    async (next: ViewerIdentity) => {
      setIdentity(next);
      setPendingName(null);
      await saveViewerIdentity(code, next);
    },
    [code]
  );

  // A player who signed up before round 1 exists in the sign-up table but not
  // yet on the roster. As soon as the organizer's device folds them in, claim
  // the slot automatically so they never have to come back and do it by hand.
  useEffect(() => {
    if (identity || !pendingName || !tournament) return;
    const slot = tournament.participants.find(
      (p) => p.name.trim().toLowerCase() === pendingName.trim().toLowerCase()
    );
    if (!slot) return;
    const claimed = viewerRows.some((v) => v.participant_id === slot.id);
    if (claimed) return;
    joinAsViewer(code, slot.name, slot.id)
      .then((next) => void storeIdentity(next))
      .catch(() => undefined);
  }, [identity, pendingName, tournament, viewerRows, code, storeIdentity]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    tournament?.participants.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [tournament?.participants]);

  const standings = useMemo(
    () => (tournament ? computeSwissStandings(tournament.matches, tournament.participants) : []),
    [tournament]
  );

  const viewers: Viewer[] = useMemo(
    () => viewerRows.map((v) => ({ id: v.id, name: v.name, participantId: v.participant_id })),
    [viewerRows]
  );
  const avatarByViewer = useAvatars(code, viewerRows);
  // The match cards are keyed by roster slot, not by viewer, so the pictures
  // have to be re-keyed through whoever claimed each slot. Spectators simply
  // never appear in this map.
  const avatarByParticipant = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of viewerRows) {
      const image = row.participant_id ? avatarByViewer.get(row.id) : undefined;
      if (row.participant_id && image) map.set(row.participant_id, image);
    }
    return map;
  }, [viewerRows, avatarByViewer]);
  const bets: Bet[] = useMemo(
    () =>
      betRows.map((b) => ({
        id: b.id,
        viewerId: b.viewer_id,
        matchId: b.match_id,
        pick: b.pick,
        amount: b.amount,
      })),
    [betRows]
  );

  const config = tournament?.swiss ?? { totalRounds: 5, bestOf: 1 as const };
  const playedRounds = tournament ? getTotalSwissRounds(tournament.matches) : 0;
  const currentRoundMatches = tournament && playedRounds > 0 ? matchesOfRound(tournament.matches, playedRounds) : [];
  const signupsOpen = playedRounds === 0;
  const bettingOn = Boolean(tournament?.betting?.enabled);
  const startingChips = tournament?.betting?.startingChips ?? DEFAULT_STARTING_CHIPS;

  const claimedSlots = useMemo(
    () => new Set(viewerRows.map((v) => v.participant_id).filter(Boolean) as string[]),
    [viewerRows]
  );

  const myMatch: Match | undefined = useMemo(() => {
    if (!identity?.participantId) return undefined;
    return currentRoundMatches.find(
      (m) => m.player1Id === identity.participantId || m.player2Id === identity.participantId
    );
  }, [currentRoundMatches, identity?.participantId]);

  const myPendingReport = useMemo(
    () => (myMatch ? reports.find((r) => r.match_id === myMatch.id) : undefined),
    [reports, myMatch]
  );

  async function handleJoin() {
    const name = nameDraft.trim();
    if (!code) return;
    setJoinState('sending');
    try {
      if (mode === 'player' && signupsOpen && !slotDraft) {
        // Round 1 isn't paired yet and this person isn't on the roster: sign
        // up by name and wait for the organizer to add them.
        if (!name) {
          setJoinState('idle');
          return;
        }
        const result = await submitOnlineSignup(code, name);
        if (result === 'duplicate') {
          setJoinState('taken');
          return;
        }
        setPendingName(name);
        await savePendingSignupName(code, name);
        setJoinState('idle');
        successHaptic();
        void refresh();
        return;
      }

      const claimedId = mode === 'player' ? slotDraft : null;
      const displayName = claimedId ? (nameById.get(claimedId) ?? name) : name;
      if (!displayName) {
        setJoinState('idle');
        return;
      }
      const next = await joinAsViewer(code, displayName, claimedId);
      await storeIdentity(next);
      setJoinState('idle');
      successHaptic();
      void refresh();
    } catch (error) {
      // A 409 here is the unique index doing its job: someone already took
      // that name, or that roster slot.
      setJoinState(error instanceof SupabaseError && error.status === 409 ? 'taken' : 'error');
    }
  }

  async function sendReport(winnerId: string, score?: MatchScore) {
    if (!myMatch || !identity || !code) return;
    setReportState('sending');
    try {
      await submitReportAsViewer(code, identity, { matchId: myMatch.id, winnerId, score });
      setReportState('idle');
      setPendingWinnerId(null);
      successHaptic();
      void refresh();
    } catch {
      setReportState('error');
    }
  }

  async function handlePlaceBet(matchId: string, pick: string, amount: number) {
    if (!identity || !code) return;
    setBetState('sending');
    try {
      await placeBet(code, identity, { matchId, pick, amount });
      setBetState('idle');
      successHaptic();
      void refresh();
    } catch {
      setBetState('error');
    }
  }

  async function forgetIdentity() {
    setIdentity(null);
    await clearViewerIdentity(code);
  }

  if (loadState === 'loading' || !identityLoaded) {
    return (
      <Screen>
        <Header title={t('online.joinTitle')} backHref="/torneos" />
        <ActivityIndicator color={colors.pokeRed.DEFAULT} />
      </Screen>
    );
  }

  if (loadState === 'notFound' || !tournament) {
    return (
      <Screen>
        <Header title={t('online.joinTitle')} backHref="/torneos" />
        <Text className="text-ink-300">
          {loadState === 'error' ? t('online.notConfigured') : t('online.joinNotFound')}
        </Text>
      </Screen>
    );
  }

  const opponentId = myMatch
    ? myMatch.player1Id === identity?.participantId
      ? myMatch.player2Id
      : myMatch.player1Id
    : null;
  const freeSlots = tournament.participants.filter((p) => !claimedSlots.has(p.id));

  return (
    <Screen>
      <Header title={tournament.name} backHref="/torneos" />
      <Text className="mb-4 text-sm text-ink-300">
        {t('swiss.roundOf', { current: Math.max(playedRounds, 1), total: config.totalRounds })} · Bo{config.bestOf}
      </Text>

      {/* Entry: who are you, and are you playing or watching? */}
      {!identity && (
        <Card skipEntrance className="mb-6 px-3 py-3">
          {pendingName ? (
            <Text className="text-sm text-status-finished">
              {t('online.waitingForOrganizer', { name: pendingName })}
            </Text>
          ) : (
            <>
              <Text className="mb-2 font-semibold text-ink-100">{t('online.howDoYouEnter')}</Text>
              <View className="mb-2 flex-row gap-2">
                {(['player', 'spectator'] as const).map((option) => (
                  <PressScale
                    key={option}
                    haptic="select"
                    scaleTo={0.97}
                    onPress={() => {
                      setMode(option);
                      setSlotDraft(null);
                      setJoinState('idle');
                    }}
                    className={`flex-1 rounded-xl border p-3 ${
                      mode === option ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600'
                    }`}
                  >
                    <Text
                      className={`text-center font-semibold ${mode === option ? 'text-pokeRed' : 'text-ink-300'}`}
                    >
                      {option === 'player' ? t('online.enterAsPlayer') : t('online.enterAsSpectator')}
                    </Text>
                  </PressScale>
                ))}
              </View>
              <Text className="mb-3 text-xs text-ink-400">
                {mode === 'player' ? t('online.enterAsPlayerHint') : t('online.enterAsSpectatorHint')}
              </Text>

              {/* Once the draw exists you can only claim a slot, not invent
                  one — the roster is what the pairings were computed from. */}
              {mode === 'player' && !signupsOpen && (
                <View className="mb-3">
                  <Text className="mb-2 text-xs text-ink-400">{t('online.pickYourSlot')}</Text>
                  {freeSlots.length === 0 ? (
                    <Text className="text-sm italic text-ink-400">{t('online.noSlotsLeft')}</Text>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      {freeSlots.map((p) => (
                        <PressScale
                          key={p.id}
                          haptic="select"
                          scaleTo={0.97}
                          onPress={() => setSlotDraft(p.id)}
                          className={`rounded-lg border px-3 py-2 ${
                            slotDraft === p.id ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600'
                          }`}
                        >
                          <Text className="text-sm text-ink-100">{p.name}</Text>
                        </PressScale>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {(mode === 'spectator' || signupsOpen) && (
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder={t('online.yourNamePlaceholder')}
                  placeholderTextColor={colors.ink[400]}
                  onSubmitEditing={() => void handleJoin()}
                  returnKeyType="done"
                  className="mb-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
                />
              )}

              <Button
                disabled={joinState === 'sending' || (mode === 'player' && !signupsOpen && !slotDraft)}
                onPress={() => void handleJoin()}
              >
                {t('online.enterButton')}
              </Button>
              {joinState === 'taken' && <Text className="mt-2 text-sm text-pokeRed">{t('online.nameTaken')}</Text>}
              {joinState === 'error' && <Text className="mt-2 text-sm text-pokeRed">{t('online.joinError')}</Text>}
            </>
          )}
        </Card>
      )}

      {identity && (
        <Card skipEntrance className="mb-4 px-3 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-sm text-ink-300" numberOfLines={1}>
              {identity.participantId
                ? t('online.youAre', { name: identity.name })
                : t('online.youAreSpectator', { name: identity.name })}
            </Text>
            <PressScale haptic="tap" onPress={() => void forgetIdentity()} className="px-2 py-1">
              <Text className="text-xs font-semibold text-ink-400">{t('online.leaveIdentity')}</Text>
            </PressScale>
          </View>
          <View className="mt-3">
            <AvatarEditor
              code={code}
              identity={identity}
              currentUri={avatarByViewer.get(identity.viewerId)}
              onChanged={() => void refresh()}
            />
            <Text className="mt-2 text-xs text-ink-400">{t('avatar.hint')}</Text>
          </View>
        </Card>
      )}

      {/* Your own match: the only one you can report on. */}
      {identity?.participantId && playedRounds > 0 && (
        <Card skipEntrance className="mb-6 px-3 py-3">
          <Text className="mb-2 font-semibold text-ink-100">{t('online.yourMatch')}</Text>
          {!myMatch ? (
            <Text className="text-sm italic text-ink-400">{t('online.noMatchYet')}</Text>
          ) : myMatch.isBye ? (
            <Text className="text-sm text-status-finished">{t('online.yourBye')}</Text>
          ) : myMatch.winnerId ? (
            <Text className="text-sm text-status-finished">
              {t('online.resultConfirmed', { winner: nameById.get(myMatch.winnerId) ?? '?' })}
            </Text>
          ) : myPendingReport ? (
            <Text className="text-sm text-gold">
              {t('online.reportPending', { winner: nameById.get(myPendingReport.winner_id) ?? '?' })}
            </Text>
          ) : (
            <>
              <Text className="mb-3 text-base text-ink-100">
                {nameById.get(identity.participantId) ?? '?'} vs{' '}
                {opponentId ? (nameById.get(opponentId) ?? '?') : '?'}
              </Text>
              {config.bestOf === 1 || pendingWinnerId === null ? (
                <View className="flex-row gap-2">
                  <Button
                    className="flex-1"
                    disabled={reportState === 'sending'}
                    onPress={() =>
                      config.bestOf === 1
                        ? void sendReport(identity.participantId as string)
                        : setPendingWinnerId(identity.participantId)
                    }
                  >
                    {t('online.reportWon')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={!opponentId || reportState === 'sending'}
                    onPress={() =>
                      opponentId && (config.bestOf === 1 ? void sendReport(opponentId) : setPendingWinnerId(opponentId))
                    }
                  >
                    {t('online.reportLost')}
                  </Button>
                </View>
              ) : (
                <View>
                  <Text className="mb-2 text-xs text-ink-400">{t('swiss.pickScore')}</Text>
                  <View className="flex-row gap-2">
                    {([
                      [2, 0],
                      [2, 1],
                    ] as const).map(([winnerGames, loserGames]) => (
                      <Button
                        key={`${winnerGames}-${loserGames}`}
                        variant="secondary"
                        className="flex-1"
                        onPress={() => {
                          const p1IsWinner = pendingWinnerId === myMatch.player1Id;
                          void sendReport(pendingWinnerId, {
                            p1: p1IsWinner ? winnerGames : loserGames,
                            p2: p1IsWinner ? loserGames : winnerGames,
                          });
                        }}
                      >
                        {`${winnerGames}-${loserGames}`}
                      </Button>
                    ))}
                  </View>
                </View>
              )}
              {reportState === 'error' && <Text className="mt-2 text-sm text-pokeRed">{t('online.reportError')}</Text>}
            </>
          )}
        </Card>
      )}

      {bettingOn && identity && playedRounds > 0 && (
        <BettingPanel
          matches={tournament.matches}
          viewer={{ id: identity.viewerId, name: identity.name, participantId: identity.participantId }}
          viewers={viewers}
          bets={bets}
          startingChips={startingChips}
          nameById={nameById}
          avatarByViewer={avatarByViewer}
          onPlace={(matchId, pick, amount) => void handlePlaceBet(matchId, pick, amount)}
          isPlacing={betState === 'sending'}
          error={betState === 'error'}
        />
      )}

      {playedRounds > 0 && (
        <SwissStandings standings={standings} nameById={nameById} highlightId={identity?.participantId ?? null} />
      )}

      {playedRounds > 0 && (
        <SwissRound
          round={playedRounds}
          totalRounds={config.totalRounds}
          matches={currentRoundMatches}
          nameById={nameById}
          bestOf={config.bestOf}
          highlightId={identity?.participantId ?? null}
          avatarByParticipant={avatarByParticipant}
        />
      )}

      {playedRounds === 0 && (
        <View className="mb-6">
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
            {t('swiss.roster', { count: tournament.participants.length })}
          </Text>
          {tournament.participants.map((p) => (
            <View key={p.id} className="mb-2 rounded-lg bg-ink-800 px-4 py-3">
              <Text className="text-ink-100">{p.name}</Text>
            </View>
          ))}
          {tournament.participants.length === 0 && (
            <Text className="text-sm italic text-ink-400">{t('swiss.waitingPlayers')}</Text>
          )}
        </View>
      )}
    </Screen>
  );
}
