import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { POKEDEX_REGIONS, searchPokemon, type RegionFilter } from '@/lib/pokedex';
import { ALL_ROLES, type CombatRole } from '@/lib/role';
import { ALL_TYPES, type PokeType } from '@/lib/typeChart';
import { countCaughtByRegion, regionTotal, TOTAL_POKEMON, useCaughtStore } from '@/store/caughtStore';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';
import type { PokemonEntry, PvpTier } from '@/types/pokemon';

type CaughtFilter = 'all' | 'caught' | 'missing';

const ALL_TIERS: PvpTier[] = ['uber', 'ou', 'uu', 'nu'];
const TIER_LABEL_KEYS: Record<PvpTier, string> = {
  uber: 'pokedex.tierUber',
  ou: 'pokedex.tierOu',
  uu: 'pokedex.tierUu',
  nu: 'pokedex.tierNu',
};
const ROLE_LABEL_KEYS: Record<CombatRole, string> = {
  physical: 'pokedex.rolePhysical',
  special: 'pokedex.roleSpecial',
  wall: 'pokedex.roleWall',
  speedster: 'pokedex.roleSpeedster',
  balanced: 'pokedex.roleBalanced',
};
const CAUGHT_FILTER_LABEL_KEYS: Record<CaughtFilter, string> = {
  all: 'pokedex.filterCaughtAll',
  caught: 'pokedex.filterCaughtOnly',
  missing: 'pokedex.filterCaughtMissing',
};

// Capped so a big search result doesn't queue up a multi-second stagger —
// past this the rows just fade in together instead of cascading.
const MAX_STAGGER_INDEX = 12;

function PokemonRow({ pokemon, index, caught }: { pokemon: PokemonEntry; index: number; caught: boolean }) {
  return (
    <Animated.View entering={nativeOnly(FadeInDown.delay(Math.min(index, MAX_STAGGER_INDEX) * 40).duration(240))}>
      <Link href={`/pokedex/${pokemon.id}`} asChild>
        <PressScale haptic="select" scaleTo={0.985} className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700">
          <PokemonSprite id={pokemon.id} types={pokemon.types} size={48} />
          <View className="flex-1">
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-ink-400">#{String(pokemon.id).padStart(3, '0')}</Text>
              {caught && <Ionicons name="checkmark-circle" size={12} color={colors.gold.DEFAULT} />}
            </View>
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

function FilterChip({
  label,
  selected,
  onPress,
  activeColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Defaults to the pokeRed accent (region filter); pass a type color for type chips. */
  activeColor?: string;
}) {
  return (
    <PressScale
      haptic="select"
      scaleTo={0.94}
      onPress={onPress}
      className="mr-2 rounded-full border px-3 py-1.5"
      style={{
        borderColor: selected ? (activeColor ?? colors.pokeRed.DEFAULT) : colors.ink[600],
        backgroundColor: selected ? `${activeColor ?? colors.pokeRed.DEFAULT}26` : colors.ink[800],
      }}
    >
      <Text
        className="text-xs font-semibold"
        style={{ color: selected ? (activeColor ?? colors.pokeRed.DEFAULT) : colors.ink[300] }}
      >
        {label}
      </Text>
    </PressScale>
  );
}

export default function PokedexList() {
  const locale = useLocaleStore((s) => s.locale);
  const caughtIds = useCaughtStore((s) => s.caughtIds);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<RegionFilter | null>(null);
  const [type, setType] = useState<PokeType | null>(null);
  const [tier, setTier] = useState<PvpTier | null>(null);
  const [role, setRole] = useState<CombatRole | null>(null);
  const [caughtFilter, setCaughtFilter] = useState<CaughtFilter>('all');
  const results = useMemo(
    () =>
      searchPokemon(query, {
        region: region ?? undefined,
        type: type ?? undefined,
        tier: tier ?? undefined,
        role: role ?? undefined,
      }),
    [query, region, type, tier, role]
  );
  const caughtSet = useMemo(() => new Set(caughtIds), [caughtIds]);
  const filteredResults = useMemo(() => {
    if (caughtFilter === 'all') return results;
    return results.filter((p) => (caughtFilter === 'caught' ? caughtSet.has(p.id) : !caughtSet.has(p.id)));
  }, [results, caughtFilter, caughtSet]);
  const progressLabel = useMemo(() => {
    if (region) {
      const byRegion = countCaughtByRegion(caughtIds);
      return t('pokedex.caughtProgressRegion', { caught: byRegion[region], total: regionTotal(region) });
    }
    return t('pokedex.caughtProgressTotal', { caught: caughtIds.length, total: TOTAL_POKEMON });
  }, [region, caughtIds, locale]);

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2 -mx-4 h-9 shrink-0 grow-0 px-4"
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <FilterChip label={t('pokedex.filterAllRegions')} selected={region === null} onPress={() => setRegion(null)} />
        {POKEDEX_REGIONS.map((r) => (
          <FilterChip
            key={r.id}
            label={locale === 'es' ? r.nameEs : r.nameEn}
            selected={region === r.id}
            onPress={() => setRegion(region === r.id ? null : r.id)}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2 -mx-4 h-9 shrink-0 grow-0 px-4"
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <FilterChip label={t('pokedex.filterAllTypes')} selected={type === null} onPress={() => setType(null)} />
        {ALL_TYPES.map((tp) => (
          <FilterChip
            key={tp}
            label={t(`types.${tp}`)}
            selected={type === tp}
            onPress={() => setType(type === tp ? null : tp)}
            activeColor={colors.type[tp]}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3 -mx-4 h-9 shrink-0 grow-0 px-4"
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <FilterChip label={t('pokedex.filterAllTiers')} selected={tier === null} onPress={() => setTier(null)} />
        {ALL_TIERS.map((tr) => (
          <FilterChip
            key={tr}
            label={t(TIER_LABEL_KEYS[tr])}
            selected={tier === tr}
            onPress={() => setTier(tier === tr ? null : tr)}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2 -mx-4 h-9 shrink-0 grow-0 px-4"
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <FilterChip label={t('pokedex.filterAllRoles')} selected={role === null} onPress={() => setRole(null)} />
        {ALL_ROLES.map((r) => (
          <FilterChip
            key={r}
            label={t(ROLE_LABEL_KEYS[r])}
            selected={role === r}
            onPress={() => setRole(role === r ? null : r)}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2 -mx-4 h-9 shrink-0 grow-0 px-4"
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
      >
        {(['all', 'caught', 'missing'] as CaughtFilter[]).map((cf) => (
          <FilterChip
            key={cf}
            label={t(CAUGHT_FILTER_LABEL_KEYS[cf])}
            selected={caughtFilter === cf}
            onPress={() => setCaughtFilter(cf)}
            activeColor={colors.gold.DEFAULT}
          />
        ))}
      </ScrollView>

      <Text className="mb-2 text-center text-xs text-ink-400">{progressLabel}</Text>

      <FlatList
        data={filteredResults}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => <PokemonRow pokemon={item} index={index} caught={caughtSet.has(item.id)} />}
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
