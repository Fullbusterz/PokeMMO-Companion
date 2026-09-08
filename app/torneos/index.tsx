import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import { StatusBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { confirmDestructive } from '@/lib/confirmDialog';
import colors from '@/theme/colors';
import { useTournamentStore } from '@/store/tournamentStore';
import type { Tournament, TournamentFormat, TournamentStatus } from '@/types/tournament';

function statusLabel(status: Tournament['status']): string {
  if (status === 'finished') return t('tournaments.statusFinished');
  if (status === 'in_progress') return t('tournaments.statusInProgress');
  return t('tournaments.statusSetup');
}

function formatLabel(format: TournamentFormat): string {
  if (format === 'double') return t('newTournament.formatDouble');
  if (format === 'league') return t('newTournament.formatLeague');
  if (format === 'swiss') return t('newTournament.formatSwiss');
  return t('newTournament.formatSingle');
}

const FORMAT_FILTERS: (TournamentFormat | 'all')[] = ['all', 'swiss', 'single', 'double', 'league'];
const STATUS_FILTERS: (TournamentStatus | 'all')[] = ['all', 'setup', 'in_progress', 'finished'];

function FilterChip({ label, isSelected, onPress }: { label: string; isSelected: boolean; onPress: () => void }) {
  return (
    <PressScale
      haptic="select"
      scaleTo={0.96}
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        isSelected ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600 bg-ink-800'
      }`}
    >
      <Text className={`text-xs font-semibold ${isSelected ? 'text-pokeRed' : 'text-ink-300'}`}>{label}</Text>
    </PressScale>
  );
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
  async function confirmDelete() {
    const confirmed = await confirmDestructive({
      title: t('tournaments.deleteConfirmTitle'),
      message: t('tournaments.deleteConfirmMessage', { name: tournament.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (confirmed) onDelete(tournament.id);
  }

  return (
    <Card index={index} layout={nativeOnly(Layout.springify().damping(18))} className="mb-3 flex-row items-center">
      <Link href={`/torneos/${tournament.id}`} asChild>
        <PressScale haptic="select" scaleTo={0.985} className="flex-1 p-4 active:bg-ink-700">
          {/* Name on its own line: sharing it with the status badge meant a
              two-word tournament name broke in half while the badge kept a
              third of the row to itself. */}
          <Text className="text-base font-semibold text-ink-100" numberOfLines={1}>
            {tournament.name}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-2">
            <StatusBadge status={tournament.status} label={statusLabel(tournament.status)} />
            <Text className="flex-1 text-sm text-ink-400" numberOfLines={1}>
              {t('tournaments.participantsCount', { count: tournament.participants.length })} ·{' '}
              {formatLabel(tournament.format)}
            </Text>
          </View>
        </PressScale>
      </Link>
      {/* An icon rather than the word: "Eliminar" took a third of the row and
          truncated the line that actually says what the tournament is. */}
      <PressScale
        haptic="tap"
        scaleTo={0.9}
        onPress={confirmDelete}
        hitSlop={10}
        className="px-3 py-4"
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
      >
        <Ionicons name="trash-outline" size={18} color={colors.pokeRed.DEFAULT} />
      </PressScale>
    </Card>
  );
});

export default function TournamentsList() {
  const tournaments = useTournamentStore((s) => s.tournaments);
  const deleteTournament = useTournamentStore((s) => s.deleteTournament);
  const [formatFilter, setFormatFilter] = useState<TournamentFormat | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | 'all'>('all');

  const filteredTournaments = useMemo(
    () =>
      tournaments.filter(
        (t) => (formatFilter === 'all' || t.format === formatFilter) && (statusFilter === 'all' || t.status === statusFilter)
      ),
    [tournaments, formatFilter, statusFilter]
  );
  const hasActiveFilters = formatFilter !== 'all' || statusFilter !== 'all';

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

      {/* Joining an online tournament is a different thing from importing a
          code: the link belongs to someone else's event, which this device
          follows live rather than owning a copy of. */}
      <Link href="/torneos/unirse" asChild>
        <Button variant="secondary" className="mb-4">
          {t('online.joinTitle')}
        </Button>
      </Link>

      {tournaments.length > 0 && (
        <View className="mb-4 gap-2">
          <View className="flex-row flex-wrap gap-2">
            {FORMAT_FILTERS.map((option) => (
              <FilterChip
                key={option}
                label={option === 'all' ? t('tournaments.filterFormatAll') : formatLabel(option)}
                isSelected={formatFilter === option}
                onPress={() => setFormatFilter(option)}
              />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => (
              <FilterChip
                key={option}
                label={option === 'all' ? t('tournaments.filterStatusAll') : statusLabel(option)}
                isSelected={statusFilter === option}
                onPress={() => setStatusFilter(option)}
              />
            ))}
          </View>
        </View>
      )}

      <FlatList
        data={filteredTournaments}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TournamentRow tournament={item} index={index} onDelete={deleteTournament} />
        )}
        ListEmptyComponent={
          <Animated.View entering={nativeOnly(FadeInDown.duration(280))} className="mt-12 items-center">
            <View className="mb-3 rounded-full bg-ink-800 p-4">
              <Ionicons name="trophy-outline" size={28} color={colors.ink[400]} />
            </View>
            <Text className="text-center text-ink-400">
              {hasActiveFilters ? t('tournaments.emptyFiltered') : t('tournaments.empty')}
            </Text>
          </Animated.View>
        }
      />
    </Screen>
  );
}
