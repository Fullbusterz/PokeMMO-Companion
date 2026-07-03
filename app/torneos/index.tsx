import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { memo } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import { StatusBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DeleteText } from '@/components/DeleteText';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import colors from '@/theme/colors';
import { useTournamentStore } from '@/store/tournamentStore';
import type { Tournament } from '@/types/tournament';

function statusLabel(status: Tournament['status']): string {
  if (status === 'finished') return t('tournaments.statusFinished');
  if (status === 'in_progress') return t('tournaments.statusInProgress');
  return t('tournaments.statusSetup');
}

const TournamentRow = memo(function TournamentRow({
  tournament,
  index,
  onDelete,
}: {
  tournament: Tournament;
  index: number;
  onDelete: (id: string) => void;
}) {
  function confirmDelete() {
    Alert.alert(
      t('tournaments.deleteConfirmTitle'),
      t('tournaments.deleteConfirmMessage', { name: tournament.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(tournament.id) },
      ]
    );
  }

  return (
    <Card index={index} layout={nativeOnly(Layout.springify().damping(18))} className="mb-3 flex-row items-center">
      <Link href={`/torneos/${tournament.id}`} asChild>
        <PressScale haptic="select" scaleTo={0.985} className="flex-1 p-4 active:bg-ink-700">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-base font-semibold text-ink-100">{tournament.name}</Text>
            <StatusBadge status={tournament.status} label={statusLabel(tournament.status)} />
          </View>
          <Text className="mt-1 text-sm text-ink-400">
            {t('tournaments.participantsCount', { count: tournament.participants.length })}
          </Text>
        </PressScale>
      </Link>
      <DeleteText onPress={confirmDelete} className="px-4 py-4">
        {t('common.delete')}
      </DeleteText>
    </Card>
  );
});

export default function TournamentsList() {
  const tournaments = useTournamentStore((s) => s.tournaments);
  const deleteTournament = useTournamentStore((s) => s.deleteTournament);

  return (
    <Screen scroll={false}>
      <Header title={t('tournaments.title')} />

      <View className="mb-4 flex-row gap-3">
        <Link href="/torneos/nuevo" asChild>
          <Button variant="primary" className="flex-1">
            {t('tournaments.newTournament')}
          </Button>
        </Link>
        <Link href="/torneos/importar" asChild>
          <Button variant="secondary" className="flex-1">
            {t('tournaments.importCode')}
          </Button>
        </Link>
      </View>

      <FlatList
        data={tournaments}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TournamentRow tournament={item} index={index} onDelete={deleteTournament} />
        )}
        ListEmptyComponent={
          <Animated.View entering={nativeOnly(FadeInDown.duration(280))} className="mt-12 items-center">
            <View className="mb-3 rounded-full bg-ink-800 p-4">
              <Ionicons name="trophy-outline" size={28} color={colors.ink[400]} />
            </View>
            <Text className="text-center text-ink-400">{t('tournaments.empty')}</Text>
          </Animated.View>
        }
      />
    </Screen>
  );
}
