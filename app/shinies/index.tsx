import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Header } from '@/components/Header';
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { getPokemonById, searchPokemon } from '@/lib/pokedex';
import { useShinyStore, type ShinyHunt } from '@/store/shinyStore';
import colors from '@/theme/colors';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function HuntRow({ hunt, isActive, index }: { hunt: ShinyHunt; isActive: boolean; index: number }) {
  const increment = useShinyStore((s) => s.increment);
  const decrement = useShinyStore((s) => s.decrement);
  const markCaught = useShinyStore((s) => s.markCaught);
  const deleteHunt = useShinyStore((s) => s.deleteHunt);
  const setActiveHunt = useShinyStore((s) => s.setActiveHunt);

  const pokemon = getPokemonById(hunt.pokemonId);
  if (!pokemon) return null;

  const confirmDelete = () => {
    Alert.alert(t('shinies.deleteConfirmTitle'), t('shinies.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteHunt(hunt.id) },
    ]);
  };

  return (
    <Animated.View
      entering={nativeOnly(FadeInDown.delay(Math.min(index, 8) * 40).duration(220))}
      className="mb-3 rounded-xl border border-ink-600 bg-ink-800 p-3"
    >
      <View className="flex-row items-center gap-3">
        <PokemonSprite id={pokemon.id} types={pokemon.types} size={48} />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink-100">{pokemon.name.es}</Text>
          <Text className="text-xs text-ink-400">
            {t('shinies.startedOn')}: {formatDate(hunt.startedAt)}
          </Text>
          {hunt.caughtAt && (
            <Text className="text-xs text-type-electric">
              {t('shinies.caughtOn')}: {formatDate(hunt.caughtAt)}
            </Text>
          )}
        </View>
        {isActive && !hunt.caughtAt && (
          <View className="rounded-full bg-pokeRed/15 px-2 py-1">
            <Text className="text-[10px] font-bold uppercase text-pokeRed">{t('shinies.activeLabel')}</Text>
          </View>
        )}
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <PressScale
            haptic="select"
            scaleTo={0.9}
            onPress={() => decrement(hunt.id)}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full bg-ink-700"
          >
            <Ionicons name="remove" size={16} color={colors.ink[100]} />
          </PressScale>
          <Text className="w-10 text-center text-lg font-bold text-ink-100">{hunt.count}</Text>
          <PressScale
            haptic="select"
            scaleTo={0.9}
            onPress={() => increment(hunt.id)}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full bg-pokeRed"
          >
            <Ionicons name="add" size={16} color="white" />
          </PressScale>
        </View>

        <View className="flex-row gap-2">
          {!isActive && !hunt.caughtAt && (
            <PressScale haptic="select" scaleTo={0.96} onPress={() => setActiveHunt(hunt.id)} className="rounded-lg bg-ink-700 px-2.5 py-1.5">
              <Text className="text-xs font-semibold text-ink-200">{t('shinies.setActive')}</Text>
            </PressScale>
          )}
          {!hunt.caughtAt && (
            <PressScale haptic="select" scaleTo={0.96} onPress={() => markCaught(hunt.id)} className="rounded-lg bg-type-electric/15 px-2.5 py-1.5">
              <Text className="text-xs font-semibold text-type-electric">{t('shinies.markCaught')}</Text>
            </PressScale>
          )}
          <PressScale haptic="select" scaleTo={0.9} onPress={confirmDelete} hitSlop={8} className="p-1.5">
            <Ionicons name="trash-outline" size={16} color={colors.ink[400]} />
          </PressScale>
        </View>
      </View>
    </Animated.View>
  );
}

export default function ShinyTracker() {
  const hunts = useShinyStore((s) => s.hunts);
  const activeHuntId = useShinyStore((s) => s.activeHuntId);
  const startHunt = useShinyStore((s) => s.startHunt);
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => (query.trim() ? searchPokemon(query).slice(0, 6) : []), [query]);

  const sortedHunts = useMemo(
    () =>
      [...hunts].sort((a, b) => {
        if (a.id === activeHuntId) return -1;
        if (b.id === activeHuntId) return 1;
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      }),
    [hunts, activeHuntId]
  );

  return (
    <Screen>
      <Header title={t('shinies.title')} />
      <Text className="mb-4 text-sm text-ink-300">{t('shinies.subtitle')}</Text>

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('shinies.newHunt')}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('shinies.searchPlaceholder')}
        placeholderTextColor={colors.ink[400]}
        className="mb-2 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
      />
      {searchResults.length > 0 && (
        <View className="mb-4">
          {searchResults.map((p) => (
            <PressScale
              key={p.id}
              haptic="select"
              scaleTo={0.98}
              onPress={() => {
                startHunt(p.id);
                setQuery('');
              }}
              className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700"
            >
              <PokemonSprite id={p.id} types={p.types} size={36} />
              <Text className="flex-1 text-sm font-semibold text-ink-100">{p.name.es}</Text>
              <Ionicons name="add-circle-outline" size={20} color={colors.ink[300]} />
            </PressScale>
          ))}
        </View>
      )}

      {sortedHunts.length === 0 ? (
        <View className="rounded-xl border border-ink-600 bg-ink-800 p-4">
          <Text className="text-sm text-ink-400">{t('shinies.empty')}</Text>
        </View>
      ) : (
        sortedHunts.map((hunt, i) => <HuntRow key={hunt.id} hunt={hunt} isActive={hunt.id === activeHuntId} index={i} />)
      )}
    </Screen>
  );
}
