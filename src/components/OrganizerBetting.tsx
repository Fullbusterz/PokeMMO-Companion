import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BettingPanel } from '@/components/BettingPanel';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import { chipStandings, type Bet, type Viewer } from '@/lib/betting';
import { successHaptic } from '@/lib/haptics';
import { joinAsViewer, placeBet, type BetRow, type ViewerIdentity, type ViewerRow } from '@/lib/onlineTournament';
import { useAvatars } from '@/lib/useAvatars';
import { loadViewerIdentity, saveViewerIdentity } from '@/lib/viewerIdentity';
import { surfaceTransition, transition } from '@/lib/webMotion';
import colors from '@/theme/colors';
import type { Match, Participant } from '@/types/tournament';

// The organizer used to be the only person at the table who couldn't see the
// betting: the chips live in the database keyed to viewers, and the organizer
// screen is driven by the local store. The scoreboard is public, so showing it
// needs no identity at all — and joining in only needs the same one-tap
// registration the players do, which is why the credential lives in a shared
// module (an organizer who already opened their own link on this phone is
// recognised instead of getting a second viewer row).

export function OrganizerBetting({
  code,
  matches,
  participants,
  viewerRows,
  betRows,
  startingChips,
  nameById,
  onChanged,
}: {
  code: string;
  matches: Match[];
  participants: Participant[];
  viewerRows: ViewerRow[];
  betRows: BetRow[];
  startingChips: number;
  nameById: Map<string, string>;
  onChanged: () => void;
}) {
  const [identity, setIdentity] = useState<ViewerIdentity | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [wantsToJoin, setWantsToJoin] = useState(false);
  const [slotDraft, setSlotDraft] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [joinState, setJoinState] = useState<'idle' | 'sending' | 'taken' | 'error'>('idle');
  const [betState, setBetState] = useState<'idle' | 'sending' | 'error'>('idle');

  useEffect(() => {
    loadViewerIdentity(code)
      .then(setIdentity)
      .finally(() => setIdentityLoaded(true));
  }, [code]);

  const viewers: Viewer[] = useMemo(
    () => viewerRows.map((v) => ({ id: v.id, name: v.name, participantId: v.participant_id })),
    [viewerRows]
  );
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

  const standings = useMemo(
    () => chipStandings(viewers, bets, matches, startingChips),
    [viewers, bets, matches, startingChips]
  );
  const viewerNameById = useMemo(() => new Map(viewers.map((v) => [v.id, v.name])), [viewers]);
  const avatarByViewer = useAvatars(code, viewerRows);
  const claimedSlots = useMemo(
    () => new Set(viewerRows.map((v) => v.participant_id).filter(Boolean) as string[]),
    [viewerRows]
  );
  const freeSlots = participants.filter((p) => !claimedSlots.has(p.id));

  // The stored identity is only usable here if the server still knows about it
  // (the tournament could have been republished, or the row deleted).
  const isRegistered = Boolean(identity && viewerRows.some((v) => v.id === identity.viewerId));

  async function handleJoin(asParticipantId: string | null) {
    const displayName = asParticipantId ? (nameById.get(asParticipantId) ?? '') : nameDraft.trim();
    if (!displayName) return;
    setJoinState('sending');
    try {
      const next = await joinAsViewer(code, displayName, asParticipantId);
      await saveViewerIdentity(code, next);
      setIdentity(next);
      setWantsToJoin(false);
      setJoinState('idle');
      successHaptic();
      onChanged();
    } catch {
      setJoinState('error');
    }
  }

  async function handlePlaceBet(matchId: string, pick: string, amount: number) {
    if (!identity) return;
    setBetState('sending');
    try {
      await placeBet(code, identity, { matchId, pick, amount });
      setBetState('idle');
      successHaptic();
      onChanged();
    } catch {
      setBetState('error');
    }
  }

  if (!identityLoaded) return null;

  // Already one of the bettors: give the organizer the same panel everyone
  // else gets, rather than a second-class read-only view.
  if (isRegistered && identity) {
    return (
      <BettingPanel
        matches={matches}
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
    );
  }

  return (
    <View className="mb-6">
      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">{t('betting.title')}</Text>

      {viewers.length === 0 ? (
        <Text className="mb-3 text-xs text-ink-400">{t('betting.nobodyBettingYet')}</Text>
      ) : (
        <Card skipEntrance className="mb-3 overflow-hidden">
          <View className="border-b border-ink-700 bg-ink-900/40 px-3 py-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {t('betting.leaderboard')}
            </Text>
          </View>
          {standings.map((standing, index) => (
            <View
              key={standing.viewerId}
              className={`flex-row items-center px-3 py-2.5 ${
                index < standings.length - 1 ? 'border-b border-ink-700/60' : ''
              }`}
              style={transition(['background-color'])}
            >
              <Text className={`w-5 text-xs font-bold ${index === 0 ? 'text-gold' : 'text-ink-400'}`}>
                {index + 1}
              </Text>
              <View className="mr-2">
                <Avatar
                  name={viewerNameById.get(standing.viewerId) ?? '?'}
                  uri={avatarByViewer.get(standing.viewerId)}
                  size={24}
                  tone={index === 0 ? 'gold' : 'neutral'}
                />
              </View>
              <Text className="flex-1 text-sm text-ink-100" numberOfLines={1}>
                {viewerNameById.get(standing.viewerId) ?? '?'}
              </Text>
              <Text className="w-12 text-right text-xs text-ink-400">
                {standing.won}/{standing.bets}
              </Text>
              <Text className="w-16 text-right text-sm font-bold text-ink-100">{standing.total}</Text>
            </View>
          ))}
        </Card>
      )}

      {!wantsToJoin ? (
        <PressScale
          haptic="tap"
          scaleTo={0.98}
          onPress={() => setWantsToJoin(true)}
          className="rounded-lg border border-gold/40 px-3 py-2.5"
          style={surfaceTransition()}
        >
          <Text className="text-center text-sm font-semibold text-gold">{t('betting.joinAsOrganizer')}</Text>
        </PressScale>
      ) : (
        <Card skipEntrance className="px-3 py-3">
          <Text className="mb-2 text-xs text-ink-400">{t('betting.joinAsOrganizerHint')}</Text>
          {freeSlots.length > 0 && (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {freeSlots.map((p) => (
                <PressScale
                  key={p.id}
                  haptic="select"
                  scaleTo={0.97}
                  onPress={() => setSlotDraft((current) => (current === p.id ? null : p.id))}
                  className={`rounded-lg border px-3 py-2 ${
                    slotDraft === p.id ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600'
                  }`}
                  style={surfaceTransition()}
                >
                  <Text className="text-sm text-ink-100">{p.name}</Text>
                </PressScale>
              ))}
            </View>
          )}

          {!slotDraft && (
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t('online.yourNamePlaceholder')}
              placeholderTextColor={colors.ink[400]}
              className="mb-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
            />
          )}

          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              disabled={joinState === 'sending' || (!slotDraft && !nameDraft.trim())}
              onPress={() => void handleJoin(slotDraft)}
            >
              {t('online.enterButton')}
            </Button>
            <Button variant="secondary" className="flex-1" onPress={() => setWantsToJoin(false)}>
              {t('common.cancel')}
            </Button>
          </View>
          {joinState === 'taken' && <Text className="mt-2 text-sm text-pokeRed">{t('online.nameTaken')}</Text>}
          {joinState === 'error' && <Text className="mt-2 text-sm text-pokeRed">{t('online.joinError')}</Text>}
        </Card>
      )}
    </View>
  );
}
