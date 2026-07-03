import { Link } from 'expo-router';
import { memo } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { StatusBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DeleteText } from '@/components/DeleteText';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { useTournamentStore } from '@/store/tournamentStore';
import type { Tournament } from '@/types/tournament';

function statusLabel(status: Tournament['status']): string {
  if (status === 'finished') return t('tournaments.statusFinished');
  if (status === 'in_progress') return t('tournaments.statusInProgress');
  return t('tournaments.statusSetup');
}

const TournamentRow = memo(function TournamentRow({
  tournament,
  onDelete,
}: {
  tournament: Tournament;
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
    <Card className="mb-3 flex-row items-center">
      <Link href={`/torneos/${tournament.id}`} asChild>
        <Pressable className="flex-1 p-4 active:bg-ink-700">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-base font-semibold text-ink-100">{tournament.name}</Text>
            <StatusBadge status={tournament.status} label={statusLabel(tournament.status)} />
          </View>
          <Text className="mt-1 text-sm text-ink-400">
            {t('tournaments.participantsCount', { count: tournament.participants.length })}
          </Text>
        </Pressable>
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
        renderItem={({ item }) => <TournamentRow tournament={item} onDelete={deleteTournament} />}
        ListEmptyComponent={<Text className="mt-8 text-center text-ink-400">{t('tournaments.empty')}</Text>}
      />
    </Screen>
  );
}
