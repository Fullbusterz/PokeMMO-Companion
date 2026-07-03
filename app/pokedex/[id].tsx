import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { isNative, nativeOnly } from '@/lib/animation';
import { getEvolvesFrom, getEvolvesInto, getPokemonById } from '@/lib/pokedex';
import type { PokeType } from '@/lib/typeChart';
import colors from '@/theme/colors';
import type { PokemonEntry, PokemonStats } from '@/types/pokemon';

const STAT_ROWS: { key: keyof PokemonStats; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'hp', label: 'pokedex.hp', icon: 'heart' },
  { key: 'attack', label: 'pokedex.attack', icon: 'flash' },
  { key: 'defense', label: 'pokedex.defense', icon: 'shield' },
  { key: 'spAttack', label: 'pokedex.spAttack', icon: 'sparkles' },
  { key: 'spDefense', label: 'pokedex.spDefense', icon: 'shield-checkmark' },
  { key: 'speed', label: 'pokedex.speed', icon: 'speedometer' },
];

// Loose ceiling for bar scaling — no Kanto base stat exceeds this, so bars
// stay comparable to each other without any one stat maxing out the track.
const STAT_BAR_MAX = 180;

function EvolutionRow({ pokemon }: { pokemon: PokemonEntry }) {
  return (
    <Link href={`/pokedex/${pokemon.id}`} asChild>
      <PressScale haptic="select" scaleTo={0.98} className="flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700">
        <Image source={{ uri: pokemon.sprite }} className="h-10 w-10" resizeMode="contain" />
        <Text className="text-base font-semibold text-ink-100">{pokemon.name.es}</Text>
      </PressScale>
    </Link>
  );
}

function AnimatedStatBar({ value, max, index }: { value: number; max: number; index: number }) {
  // Starts pre-filled on web: see src/lib/animation.ts — post-mount shared-value
  // updates don't reach the DOM there, so animating from 0 would leave the bar
  // permanently empty instead of just losing the grow-in effect.
  const progress = useSharedValue(isNative ? 0 : 1);
  const targetPct = Math.min(100, (value / max) * 100);

  useEffect(() => {
    if (!isNative) return;
    progress.value = withDelay(index * 70, withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }));
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${progress.value * targetPct}%` }));
  return (
    <Animated.View style={animatedStyle} className="h-full overflow-hidden rounded-full">
      <LinearGradient
        colors={[colors.pokeRed[400], colors.pokeRed.DEFAULT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
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
  const primaryType = (pokemon.types as PokeType[])[0];

  return (
    <Screen>
      <Header title={pokemon.name.es} />

      <Animated.View entering={nativeOnly(FadeIn.duration(280))} className="mb-5 items-center">
        <View
          className="mb-1 h-36 w-36 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.type[primaryType]}1F` }}
        >
          <Animated.Image
            entering={nativeOnly(FadeInDown.duration(360).springify().damping(14))}
            source={{ uri: pokemon.sprite }}
            className="h-32 w-32"
            resizeMode="contain"
          />
        </View>
        <Text className="mb-2 text-ink-400">#{String(pokemon.id).padStart(3, '0')}</Text>
        <View className="flex-row gap-2">
          {(pokemon.types as PokeType[]).map((tp) => (
            <TypeBadge key={tp} type={tp} />
          ))}
        </View>
      </Animated.View>

      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
        {t('pokedex.statsTitle')}
      </Text>
      <View className="mb-5 rounded-xl border border-ink-600 bg-ink-800 p-4">
        {STAT_ROWS.map(({ key, label, icon }, index) => {
          const value = pokemon.baseStats[key];
          return (
            <View key={key} className={index < STAT_ROWS.length - 1 ? 'mb-3' : undefined}>
              <View className="mb-1 flex-row justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name={icon} size={13} color={colors.ink[400]} />
                  <Text className="text-sm text-ink-300">{t(label)}</Text>
                </View>
                <Text className="text-sm font-semibold text-ink-100">{value}</Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-ink-700">
                <AnimatedStatBar value={value} max={STAT_BAR_MAX} index={index} />
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
