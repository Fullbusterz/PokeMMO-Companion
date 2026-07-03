import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Image, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { searchPokemon } from '@/lib/pokedex';
import type { PokeType } from '@/lib/typeChart';
import colors from '@/theme/colors';
import type { PokemonEntry } from '@/types/pokemon';

// Capped so a big search result doesn't queue up a multi-second stagger —
// past this the rows just fade in together instead of cascading.
const MAX_STAGGER_INDEX = 12;

function PokemonRow({ pokemon, index }: { pokemon: PokemonEntry; index: number }) {
  const primaryType = (pokemon.types as PokeType[])[0];
  return (
    <Animated.View entering={nativeOnly(FadeInDown.delay(Math.min(index, MAX_STAGGER_INDEX) * 40).duration(240))}>
      <Link href={`/pokedex/${pokemon.id}`} asChild>
        <PressScale haptic="select" scaleTo={0.985} className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: `${colors.type[primaryType]}22` }}
          >
            <Image source={{ uri: pokemon.sprite }} className="h-11 w-11" resizeMode="contain" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-ink-400">#{String(pokemon.id).padStart(3, '0')}</Text>
            <Text className="text-base font-semibold text-ink-100">{pokemon.name.es}</Text>
            <View className="mt-1 flex-row flex-wrap gap-1">
              {(pokemon.types as PokeType[]).map((tp) => (
                <TypeBadge key={tp} type={tp} />
              ))}
            </View>
          </View>
        </PressScale>
      </Link>
    </Animated.View>
  );
}

export default function PokedexList() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchPokemon(query), [query]);

  return (
    <Screen scroll={false}>
      <Header title={t('pokedex.title')} />

      <Link href="/pokedex/tipos" asChild>
        <Button variant="secondary" className="mb-3">
          {t('pokedex.typesLink')}
        </Button>
      </Link>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('pokedex.searchPlaceholder')}
        placeholderTextColor={colors.ink[400]}
        className="mb-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
      />

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => <PokemonRow pokemon={item} index={index} />}
        ListEmptyComponent={
          <Animated.View entering={nativeOnly(FadeInDown.duration(280))} className="mt-12 items-center">
            <View className="mb-3 rounded-full bg-ink-800 p-4">
              <Ionicons name="search-outline" size={28} color={colors.ink[400]} />
            </View>
            <Text className="text-center text-ink-400">{t('pokedex.empty')}</Text>
          </Animated.View>
        }
      />
    </Screen>
  );
}
