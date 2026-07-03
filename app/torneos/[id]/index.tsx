import * as Sharing from 'expo-sharing';
import { Link, useLocalSearchParams } from 'expo-router';
import { memo, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { VsDivider } from '@/components/VsDivider';
import { t } from '@/i18n';
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
  nameById,
  positionById,
  tournamentId,
  setMatchWinner,
}: {
  match: Match;
  nameById: Map<string, string>;
  positionById: Map<string, number>;
  tournamentId: string;
  setMatchWinner: SetMatchWinner;
}) {
  function renderPlayer(playerId: string | null) {
    const name = playerId ? nameById.get(playerId) ?? '?' : null;
    const position = match.round === 1 && playerId ? positionById.get(playerId) : undefined;
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
      <Pressable
        disabled={!canPick}
        onPress={() => playerId && setMatchWinner(tournamentId, match.id, playerId)}
        className={`px-3 py-2.5 ${isWinner ? 'bg-pokeRed/10' : ''}`}
      >
        <Text className={textClass}>{name ?? '—'}</Text>
        {position !== undefined && (
          <Text className="text-xs text-ink-400">{t('bracket.position', { number: position })}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Card className="mb-2 overflow-hidden">
      {renderPlayer(match.player1Id)}
      <VsDivider />
      {renderPlayer(match.player2Id)}
    </Card>
  );
});

export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournament = useTournamentStore((s) => s.tournaments.find((tt) => tt.id === id));
  const setMatchWinner = useTournamentStore((s) => s.setMatchWinner);
  const undoLastMatch = useTournamentStore((s) => s.undoLastMatch);
  const renameTournament = useTournamentStore((s) => s.renameTournament);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    tournament?.participants.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [tournament?.participants]);

  const totalRounds = useMemo(() => getTotalRounds(tournament?.matches ?? []), [tournament?.matches]);

  // Not tournament.matches.find(...) via getChampion() here: that helper
  // recomputes totalRounds internally, and we already have it above.
  const championId = useMemo(() => {
    const final = tournament?.matches.find((m) => m.round === totalRounds);
    return final?.winnerId ?? null;
  }, [tournament?.matches, totalRounds]);

  const matchesByRound = useMemo(() => {
    const map = new Map<number, Match[]>();
    tournament?.matches.forEach((m) => {
      const list = map.get(m.round);
      if (list) list.push(m);
      else map.set(m.round, [m]);
    });
    for (const list of map.values()) list.sort((a, b) => a.slot - b.slot);
    return map;
  }, [tournament?.matches]);

  // Draw position (not a skill ranking — the draw is random). Only round 1
  // matches structurally hold every participant exactly once, so position =
  // their slot in that round, 1-indexed.
  const positionById = useMemo(() => {
    const map = new Map<string, number>();
    (matchesByRound.get(1) ?? []).forEach((m) => {
      if (m.player1Id) map.set(m.player1Id, m.slot * 2 + 1);
      if (m.player2Id) map.set(m.player2Id, m.slot * 2 + 2);
    });
    return map;
  }, [matchesByRound]);

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

  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
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
          <View className="mb-5 rounded-xl border border-type-electric/30 bg-type-electric/10 p-4">
            <Text className="text-center text-base font-bold text-type-electric">
              {t('bracket.champion', { name: nameById.get(championId) ?? '?' })}
            </Text>
          </View>
        )}

        {rounds.map((round) => (
          <View key={round} className="mb-6">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
              {roundLabel(round, totalRounds)}
            </Text>
            {(matchesByRound.get(round) ?? []).map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                nameById={nameById}
                positionById={positionById}
                tournamentId={tournamentId}
                setMatchWinner={setMatchWinner}
              />
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}
