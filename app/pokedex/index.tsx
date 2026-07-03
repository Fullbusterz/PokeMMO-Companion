import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { searchPokemon } from '@/lib/pokedex';
import type { PokeType } from '@/lib/typeChart';
import colors from '@/theme/colors';
import type { PokemonEntry } from '@/types/pokemon';

function PokemonRow({ pokemon }: { pokemon: PokemonEntry }) {
  return (
    <Link href={`/pokedex/${pokemon.id}`} asChild>
      <Pressable className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700">
        <Image source={{ uri: pokemon.sprite }} className="h-12 w-12" resizeMode="contain" />
        <View className="flex-1">
          <Text className="text-xs text-ink-400">#{String(pokemon.id).padStart(3, '0')}</Text>
          <Text className="text-base font-semibold text-ink-100">{pokemon.name.es}</Text>
          <View className="mt-1 flex-row flex-wrap gap-1">
            {(pokemon.types as PokeType[]).map((tp) => (
              <TypeBadge key={tp} type={tp} />
            ))}
          </View>
        </View>
      </Pressable>
    </Link>
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
        renderItem={({ item }) => <PokemonRow pokemon={item} />}
        ListEmptyComponent={<Text className="mt-8 text-center text-ink-400">{t('pokedex.empty')}</Text>}
      />
    </Screen>
  );
}
