import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput } from 'react-native';

import { Header } from '@/components/Header';
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { searchPokemon } from '@/lib/pokedex';
import { useBoxStore } from '@/store/boxStore';
import colors from '@/theme/colors';

export default function NewBoxBuild() {
  const createBuild = useBoxStore((s) => s.createBuild);
  const [query, setQuery] = useState('');

  const results = useMemo(() => (query.trim() ? searchPokemon(query).slice(0, 12) : []), [query]);

  function handleSelect(pokemonId: number) {
    const id = createBuild(pokemonId);
    // replace, not push — the empty picker screen shouldn't stay on the back
    // stack once a build actually exists to edit.
    router.replace(`/caja/${id}`);
  }

  return (
    <Screen>
      <Header title={t('box.newTitle')} backHref="/caja" />
      <Text className="mb-4 text-sm text-ink-300">{t('box.newSubtitle')}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('box.searchPlaceholder')}
        placeholderTextColor={colors.ink[400]}
        className="mb-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
        autoFocus
      />
      {results.map((p) => (
        <PressScale
          key={p.id}
          haptic="select"
          scaleTo={0.98}
          onPress={() => handleSelect(p.id)}
          className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700"
        >
          <PokemonSprite id={p.id} types={p.types} size={36} />
          <Text className="flex-1 text-sm font-semibold text-ink-100">{p.name.es}</Text>
        </PressScale>
      ))}
    </Screen>
  );
}
