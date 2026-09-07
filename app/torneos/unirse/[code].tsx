import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { SwissRound } from '@/components/SwissRound';
import { SwissStandings } from '@/components/SwissStandings';
import { t } from '@/i18n';
import { successHaptic } from '@/lib/haptics';
import {
  fetchOnlineTournament,
  normalizeJoinCode,
  submitOnlineReport,
  submitOnlineSignup,
  type ReportRow,
} from '@/lib/onlineTournament';
import { isOnlineConfigured, ONLINE_POLL_MS } from '@/lib/supabase';
import { computeSwissStandings, getTotalSwissRounds, matchesOfRound } from '@/lib/swissFormat';
import colors from '@/theme/colors';
import type { Match, MatchScore, Tournament } from '@/types/tournament';

// Remembers which participant this device is, per tournament, so a player
// doesn't have to re-identify every time they open the link. It's a
// convenience, not an authentication: picking the wrong name only lets you
// file a report the organizer has to confirm anyway.
const identityKey = (code: string) => `pokemmo-join-identity:${code}`;

export default function JoinTournament() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeJoinCode(params.code ?? '');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  const [meId, setMeId] = useState<string | null>(null);
  const [signupDraft, setSignupDraft] = useState('');
  const [signupState, setSignupState] = useState<'idle' | 'sending' | 'done' | 'duplicate' | 'error'>('idle');
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);

  // The name this device signed up with, kept so the player is auto-selected
  // as soon as the organizer's roster picks the sign-up up.
  const claimedNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!code) return;
    AsyncStorage.getItem(identityKey(code))
      .then((value) => {
        if (value) claimedNameRef.current = value;
      })
      .catch(() => {
        // A device that can't read its own storage just re-picks its name.
      });
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
      setLoadState('ready');
    } catch {
      // Keep whatever was already on screen: a dropped poll shouldn't blank
      // out the standings someone is reading.
      setLoadState((current) => (current === 'loading' ? 'error' : current));
    }
  }, [code]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), ONLINE_POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Resolve "who am I" against the live roster on every poll: before the
  // organizer's device folds a sign-up in, the name simply isn't there yet.
  useEffect(() => {
    if (!tournament || meId) return;
    const claimed = claimedNameRef.current;
    if (!claimed) return;
    const match = tournament.participants.find((p) => p.name.trim().toLowerCase() === claimed.trim().toLowerCase());
    if (match) setMeId(match.id);
  }, [tournament, meId]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    tournament?.participants.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [tournament?.participants]);

  const standings = useMemo(
    () => (tournament ? computeSwissStandings(tournament.matches, tournament.participants) : []),
    [tournament]
  );

  const config = tournament?.swiss ?? { totalRounds: 5, bestOf: 1 as const };
  const playedRounds = tournament ? getTotalSwissRounds(tournament.matches) : 0;
  const currentRoundMatches = tournament && playedRounds > 0 ? matchesOfRound(tournament.matches, playedRounds) : [];
  const signupsOpen = playedRounds === 0;

  const myMatch: Match | undefined = useMemo(() => {
    if (!meId) return undefined;
    return currentRoundMatches.find((m) => m.player1Id === meId || m.player2Id === meId);
  }, [currentRoundMatches, meId]);

  const myPendingReport = useMemo(
    () => (myMatch ? reports.find((r) => r.match_id === myMatch.id) : undefined),
    [reports, myMatch]
  );

  async function handleSignup() {
    const name = signupDraft.trim();
    if (!name || !code) return;
    setSignupState('sending');
    try {
      const result = await submitOnlineSignup(code, name);
      if (result === 'duplicate') {
        setSignupState('duplicate');
        return;
      }
      claimedNameRef.current = name;
      await AsyncStorage.setItem(identityKey(code), name).catch(() => undefined);
      setSignupState('done');
      successHaptic();
      void refresh();
    } catch {
      setSignupState('error');
    }
  }

  async function sendReport(winnerId: string, score?: MatchScore) {
    if (!myMatch || !meId || !code) return;
    setReportState('sending');
    try {
      await submitOnlineReport(code, { matchId: myMatch.id, reportedBy: meId, winnerId, score });
      setReportState('sent');
      setPendingWinnerId(null);
      successHaptic();
      void refresh();
    } catch {
      setReportState('error');
    }
  }

  async function pickIdentity(participantId: string, name: string) {
    setMeId(participantId);
    claimedNameRef.current = name;
    await AsyncStorage.setItem(identityKey(code), name).catch(() => undefined);
  }

  if (loadState === 'loading') {
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

  const opponentId = myMatch ? (myMatch.player1Id === meId ? myMatch.player2Id : myMatch.player1Id) : null;

  return (
    <Screen>
      <Header title={tournament.name} backHref="/torneos" />
      <Text className="mb-4 text-sm text-ink-300">
        {t('swiss.roundOf', { current: Math.max(playedRounds, 1), total: config.totalRounds })} · Bo{config.bestOf}
      </Text>

      {/* Sign-up: only while no round has been paired. */}
      {signupsOpen && !meId && (
        <Card skipEntrance className="mb-6 px-3 py-3">
          <Text className="mb-2 font-semibold text-ink-100">{t('online.signupTitle')}</Text>
          {signupState === 'done' ? (
            <Text className="text-sm text-status-finished">{t('online.signupDone')}</Text>
          ) : (
            <>
              <TextInput
                value={signupDraft}
                onChangeText={setSignupDraft}
                placeholder={t('online.signupPlaceholder')}
                placeholderTextColor={colors.ink[400]}
                onSubmitEditing={() => void handleSignup()}
                returnKeyType="done"
                className="mb-2 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
              />
              <Button onPress={() => void handleSignup()} disabled={signupState === 'sending'}>
                {t('online.signupButton')}
              </Button>
              {signupState === 'duplicate' && (
                <Text className="mt-2 text-sm text-pokeRed">{t('online.signupDuplicate')}</Text>
              )}
              {signupState === 'error' && <Text className="mt-2 text-sm text-pokeRed">{t('online.reportError')}</Text>}
            </>
          )}
        </Card>
      )}

      {/* Identity: needed to report a result. Anyone who doesn't pick simply
          watches. */}
      {!signupsOpen && !meId && tournament.participants.length > 0 && (
        <Card skipEntrance className="mb-6 px-3 py-3">
          <Text className="mb-1 font-semibold text-ink-100">{t('online.whoAreYou')}</Text>
          <Text className="mb-3 text-xs text-ink-400">{t('online.whoAreYouHint')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {tournament.participants.map((p) => (
              <PressScale
                key={p.id}
                haptic="select"
                scaleTo={0.97}
                onPress={() => void pickIdentity(p.id, p.name)}
                className="rounded-lg border border-ink-600 px-3 py-2 active:bg-ink-700"
              >
                <Text className="text-sm text-ink-100">{p.name}</Text>
              </PressScale>
            ))}
          </View>
        </Card>
      )}

      {meId && (
        <Card skipEntrance className="mb-6 px-3 py-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="font-semibold text-ink-100">{t('online.yourMatch')}</Text>
            <PressScale haptic="tap" onPress={() => setMeId(null)} className="px-2 py-1">
              <Text className="text-xs font-semibold text-ink-400">{t('online.notMe')}</Text>
            </PressScale>
          </View>

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
                {nameById.get(meId) ?? '?'} vs {opponentId ? (nameById.get(opponentId) ?? '?') : '?'}
              </Text>
              {config.bestOf === 1 ? (
                <View className="flex-row gap-2">
                  <Button className="flex-1" onPress={() => void sendReport(meId)} disabled={reportState === 'sending'}>
                    {t('online.reportWon')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={!opponentId || reportState === 'sending'}
                    onPress={() => opponentId && void sendReport(opponentId)}
                  >
                    {t('online.reportLost')}
                  </Button>
                </View>
              ) : !pendingWinnerId ? (
                <View className="flex-row gap-2">
                  <Button className="flex-1" onPress={() => setPendingWinnerId(meId)}>
                    {t('online.reportWon')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={!opponentId}
                    onPress={() => opponentId && setPendingWinnerId(opponentId)}
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

      {playedRounds > 0 && <SwissStandings standings={standings} nameById={nameById} highlightId={meId} />}

      {playedRounds > 0 && (
        <SwissRound
          round={playedRounds}
          totalRounds={config.totalRounds}
          matches={currentRoundMatches}
          nameById={nameById}
          bestOf={config.bestOf}
          highlightId={meId}
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

      {!meId && !signupsOpen && <Text className="mb-4 text-xs text-ink-400">{t('online.spectator')}</Text>}
    </Screen>
  );
}
