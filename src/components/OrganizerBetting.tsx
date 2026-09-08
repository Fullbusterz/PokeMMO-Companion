import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BettingPanel } from '@/components/BettingPanel';
import { Card } from '@/components/Card';
import { t } from '@/i18n';
import { chipStandings, type Bet, type Viewer } from '@/lib/betting';
import { successHaptic } from '@/lib/haptics';
import { placeBet, type BetRow, type ViewerIdentity, type ViewerRow } from '@/lib/onlineTournament';
import { useAvatars } from '@/lib/useAvatars';
import { loadViewerIdentity } from '@/lib/viewerIdentity';
import { transition } from '@/lib/webMotion';
import type { Match } from '@/types/tournament';

// The organizer used to be the only person at the table who couldn't see the
// betting: the chips live in the database keyed to viewers, and the organizer
// screen is driven by the local store. The scoreboard is public, so showing it
// needs no identity at all — and registering now happens once, in the "you in
// this tournament" card up in the online section, whose credential this reads
// from the same shared module. Keeping the join UI here as well meant the
// organizer could be asked to register in two different places on one screen.

export function OrganizerBetting({
  code,
  matches,
  viewerRows,
  betRows,
  startingChips,
  nameById,
  onChanged,
}: {
  code: string;
  matches: Match[];
  viewerRows: ViewerRow[];
  betRows: BetRow[];
  startingChips: number;
  nameById: Map<string, string>;
  onChanged: () => void;
}) {
  const [identity, setIdentity] = useState<ViewerIdentity | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [betState, setBetState] = useState<'idle' | 'sending' | 'error'>('idle');

  // viewerRows changes on every poll, and re-reading the stored credential
  // when it does is how this picks up a registration made in the card above
  // without threading a prop down through the screen.
  useEffect(() => {
    loadViewerIdentity(code)
      .then(setIdentity)
      .finally(() => setIdentityLoaded(true));
  }, [code, viewerRows]);

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

  // The stored identity is only usable here if the server still knows about it
  // (the tournament could have been republished, or the row deleted).
  const isRegistered = Boolean(identity && viewerRows.some((v) => v.id === identity.viewerId));

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

      <Text className="text-xs text-ink-400">{t('betting.joinFromIdentityCard')}</Text>
    </View>
  );
}
