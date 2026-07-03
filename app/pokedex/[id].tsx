import { Link, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { getEvolvesFrom, getEvolvesInto, getPokemonById } from '@/lib/pokedex';
import type { PokeType } from '@/lib/typeChart';
import type { PokemonEntry, PokemonStats } from '@/types/pokemon';

const STAT_ROWS: { key: keyof PokemonStats; label: string }[] = [
  { key: 'hp', label: 'pokedex.hp' },
  { key: 'attack', label: 'pokedex.attack' },
  { key: 'defense', label: 'pokedex.defense' },
  { key: 'spAttack', label: 'pokedex.spAttack' },
  { key: 'spDefense', label: 'pokedex.spDefense' },
  { key: 'speed', label: 'pokedex.speed' },
];

// Loose ceiling for bar scaling — no Kanto base stat exceeds this, so bars
// stay comparable to each other without any one stat maxing out the track.
const STAT_BAR_MAX = 180;

function EvolutionRow({ pokemon }: { pokemon: PokemonEntry }) {
  return (
    <Link href={`/pokedex/${pokemon.id}`} asChild>
      <Pressable className="flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700">
        <Image source={{ uri: pokemon.sprite }} className="h-10 w-10" resizeMode="contain" />
        <Text className="text-base font-semibold text-ink-100">{pokemon.name.es}</Text>
      </Pressable>
    </Link>
  );
}

export default function PokemonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pokemon = getPokemonById(Number(id));

  if (!pokemon) {
    return (
      <Screen>
        <Header title={t('pokedex.title')} />
        <Text className="text-ink-400">{t('pokedex.empty')}</Text>
      </Screen>
    );
  }

  const evolvesFrom = getEvolvesFrom(pokemon);
  const evolvesInto = getEvolvesInto(pokemon);
  const hasEvolutionFamily = Boolean(evolvesFrom) || evolvesInto.length > 0;

  return (
    <Screen>
      <Header title={pokemon.name.es} />

      <View className="mb-5 items-center">
        <Image source={{ uri: pokemon.sprite }} className="h-32 w-32" resizeMode="contain" />
        <Text className="mb-2 text-ink-400">#{String(pokemon.id).padStart(3, '0')}</Text>
        <View className="flex-row gap-2">
          {(pokemon.types as PokeType[]).map((tp) => (
            <TypeBadge key={tp} type={tp} />
          ))}
        </View>
      </View>

      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
        {t('pokedex.statsTitle')}
      </Text>
      <View className="mb-5 rounded-xl border border-ink-600 bg-ink-800 p-4">
        {STAT_ROWS.map(({ key, label }, index) => {
          const value = pokemon.baseStats[key];
          const widthPct = Math.min(100, (value / STAT_BAR_MAX) * 100);
          return (
            <View key={key} className={index < STAT_ROWS.length - 1 ? 'mb-3' : undefined}>
              <View className="mb-1 flex-row justify-between">
                <Text className="text-sm text-ink-300">{t(label)}</Text>
                <Text className="text-sm font-semibold text-ink-100">{value}</Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-ink-700">
                <View className="h-full rounded-full bg-pokeRed" style={{ width: `${widthPct}%` }} />
              </View>
            </View>
          );
        })}
      </View>

      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
        {t('pokedex.evolutionTitle')}
      </Text>
      {hasEvolutionFamily ? (
        <View className="gap-2">
          {evolvesFrom && (
            <View>
              <Text className="mb-1 text-xs text-ink-400">{t('pokedex.evolvesFrom')}</Text>
              <EvolutionRow pokemon={evolvesFrom} />
            </View>
          )}
          {evolvesInto.length > 0 && (
            <View>
              <Text className="mb-1 text-xs text-ink-400">{t('pokedex.evolvesInto')}</Text>
              {evolvesInto.map((p) => (
                <View key={p.id} className="mb-2">
                  <EvolutionRow pokemon={p} />
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View className="rounded-xl border border-ink-600 bg-ink-800 p-4">
          <Text className="text-ink-400">{t('pokedex.noEvolutionFamily')}</Text>
        </View>
      )}
    </Screen>
  );
}
