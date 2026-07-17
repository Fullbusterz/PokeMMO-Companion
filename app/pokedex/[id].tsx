import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
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
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { RoleBadge } from '@/components/RoleBadge';
import { Screen } from '@/components/Screen';
import { TierBadge } from '@/components/TierBadge';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { isNative, nativeOnly } from '@/lib/animation';
import {
  getAbilities,
  getAbilityDescription,
  getEvolvesFrom,
  getEvolvesInto,
  getLocations,
  getMoveData,
  getMoveset,
  getPokemonById,
  getTier,
  groupMovesByMethod,
  localizedAbilityName,
  localizedEncounterValue,
  localizedMoveName,
} from '@/lib/pokedex';
import { getLearners, getRecommendedLearners, type RecommendedLearner } from '@/lib/moveLearners';
import { computeRole } from '@/lib/role';
import { useCaughtStore } from '@/store/caughtStore';
import { useLocaleStore } from '@/store/localeStore';
import type { PokeType } from '@/lib/typeChart';
import colors from '@/theme/colors';
import type { AbilityDescriptionEntry, LocationEntry, MoveEntry, PokemonEntry, PokemonStats, PvpTier } from '@/types/pokemon';

// Own badge-shaped button rather than a plain TypeBadge/TierBadge/RoleBadge
// clone — those are static display chips, this one needs to be pressable and
// carry an accessibility label that reflects the current toggle state.
function CaughtToggle({ caught, onToggle }: { caught: boolean; onToggle: () => void }) {
  const color = caught ? colors.gold.DEFAULT : colors.ink[400];
  return (
    <PressScale
      haptic="select"
      scaleTo={0.9}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={t(caught ? 'pokedex.caughtAccessibilityOn' : 'pokedex.caughtAccessibilityOff')}
      className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
      style={{ backgroundColor: `${color}26` }}
    >
      <Ionicons name={caught ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={color} />
      <Text className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
        {t(caught ? 'pokedex.caughtLabel' : 'pokedex.notCaughtLabel')}
      </Text>
    </PressScale>
  );
}

function groupLocationsByType(entries: LocationEntry[]) {
  const order: string[] = [];
  const byType = new Map<string, LocationEntry[]>();
  for (const entry of entries) {
    if (!byType.has(entry.locationType)) {
      byType.set(entry.locationType, []);
      order.push(entry.locationType);
    }
    byType.get(entry.locationType)!.push(entry);
  }
  return order.map((type) => ({ type, rows: byType.get(type)! }));
}

// Encounter methods where the wiki attaches a "rarity" that's actually a
// special mechanic rather than a spawn-frequency tier (a Lure spot, a horde
// battle) — visually flagged the same way hidden guide items are, since both
// mark "this isn't the default way you'd stumble into this Pokemon."
const NOTABLE_RATES = new Set(['Lure', 'Horde']);

function LocationRow({ entry }: { entry: LocationEntry }) {
  const locale = useLocaleStore((s) => s.locale);
  const notable = NOTABLE_RATES.has(entry.rate);
  const timeLabel = entry.timeOfDay.map((tod) => localizedEncounterValue('timeOfDay', tod, locale)).join(' · ');
  return (
    <View className="flex-row items-center gap-2 py-1">
      <View className="flex-1">
        <Text className="text-sm text-ink-100">{entry.location}</Text>
        {timeLabel.length > 0 && <Text className="text-[11px] text-ink-400">{timeLabel}</Text>}
      </View>
      <Text className="text-xs text-ink-400">
        {t('pokedex.levelsLabel')} {entry.levels}
      </Text>
      <View className={`rounded-full border px-2 py-0.5 ${notable ? 'border-pokeRed/40 bg-pokeRed/10' : 'border-ink-600 bg-ink-700'}`}>
        <Text className={`text-[10px] font-semibold ${notable ? 'text-pokeRed' : 'text-ink-300'}`}>
          {localizedEncounterValue('rate', entry.rate, locale)}
        </Text>
      </View>
    </View>
  );
}

function MoveChipRow({ moves, onPressMove }: { moves: string[]; onPressMove: (name: string) => void }) {
  const locale = useLocaleStore((s) => s.locale);
  return (
    <View className="flex-row flex-wrap gap-2">
      {moves.map((name) => (
        <PressScale
          key={name}
          haptic="select"
          scaleTo={0.95}
          onPress={() => onPressMove(name)}
          className="rounded-full border border-ink-600 bg-ink-700 px-3 py-1.5"
        >
          <Text className="text-sm font-semibold text-ink-100">{localizedMoveName(name, locale)}</Text>
        </PressScale>
      ))}
    </View>
  );
}

// Shared shell for the move/ability detail popups — backdrop tap closes it,
// the card itself stops that tap from bubbling up (same fix already needed
// for the Guide section's inline item images: without stopPropagation, a tap
// anywhere inside the card closes the modal right as it opens).
function DetailModalShell({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <PressScale haptic="none" onPress={onClose} className="flex-1 items-center justify-center bg-black/70 p-6">
        <PressScale
          haptic="none"
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl border border-ink-600 bg-ink-800 p-5"
        >
          {children}
        </PressScale>
        <PressScale
          haptic="select"
          scaleTo={0.9}
          onPress={onClose}
          hitSlop={12}
          className="absolute right-6 top-12 rounded-full bg-ink-800/90 p-2"
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={20} color={colors.ink[100]} />
        </PressScale>
      </PressScale>
    </Modal>
  );
}

const CATEGORY_LABELS: Record<MoveEntry['category'], string> = {
  physical: 'pokedex.categoryPhysical',
  special: 'pokedex.categorySpecial',
  status: 'pokedex.categoryStatus',
};

const TIER_LABEL_KEYS: Record<PvpTier, string> = {
  uber: 'pokedex.tierUber',
  ou: 'pokedex.tierOu',
  uu: 'pokedex.tierUu',
  nu: 'pokedex.tierNu',
};

// Small pill for a single structured recommendation reason — deliberately
// never collapsed into one opaque sentence (see moveLearners.ts doc comment),
// so each reason (STAB / offensive stat / tier) gets its own chip, same
// "structure is information" principle already used for type/tier/role
// badges elsewhere in this screen.
function ReasonChip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View
      className={`rounded-full border px-2 py-0.5 ${accent ? 'border-gold/50 bg-gold/10' : 'border-ink-600 bg-ink-700'}`}
    >
      <Text className={`text-[10px] font-semibold ${accent ? 'text-gold' : 'text-ink-300'}`}>{label}</Text>
    </View>
  );
}

function RecommendedLearnerRow({
  rec,
  category,
  onPress,
}: {
  rec: RecommendedLearner;
  category: MoveEntry['category'];
  onPress: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const name = locale === 'es' ? rec.pokemon.name.es : rec.pokemon.name.en;
  const attackLabel = t(category === 'physical' ? 'pokedex.learnersReasonAtk' : 'pokedex.learnersReasonSpA', {
    value: rec.reasons.attackStat,
  });
  return (
    <PressScale
      haptic="select"
      scaleTo={0.98}
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-xl border border-ink-600 bg-ink-700 px-3 py-2"
    >
      <PokemonSprite id={rec.pokemon.id} types={rec.pokemon.types} size={32} />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink-100">
          {name} <Text className="text-ink-400">#{String(rec.pokemon.id).padStart(3, '0')}</Text>
        </Text>
        <View className="mt-1 flex-row flex-wrap gap-1.5">
          {rec.reasons.hasStab && <ReasonChip label={t('pokedex.learnersReasonStab')} accent />}
          <ReasonChip label={attackLabel} />
          {rec.reasons.tier && <ReasonChip label={t(TIER_LABEL_KEYS[rec.reasons.tier])} />}
        </View>
      </View>
    </PressScale>
  );
}

// "Who learns this" — a plain reverse lookup (getLearners) for every move,
// plus a heuristic top-5 (getRecommendedLearners) for damage-dealing moves
// only, per the project's honesty rule (REGLA DE ORO / RoleBadge precedent):
// never present a scored recommendation as verified competitive data.
function MoveLearnersSection({ move, onNavigate }: { move: MoveEntry; onNavigate: (id: number) => void }) {
  const locale = useLocaleStore((s) => s.locale);
  const [expanded, setExpanded] = useState(false);
  const learners = getLearners(move.name);
  const recommended = getRecommendedLearners(move.name);
  const top5 = recommended?.slice(0, 5) ?? [];

  return (
    <View className="mt-4 border-t border-ink-700 pt-3">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('pokedex.learnersTitle')}</Text>

      {learners.length === 0 ? (
        <Text className="text-xs text-ink-400">{t('pokedex.learnersEmpty')}</Text>
      ) : (
        <>
          {recommended !== null ? (
            <View className="mb-3">
              <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
                {t('pokedex.learnersRecommendedTitle')}
              </Text>
              <Text className="mb-2 text-[11px] leading-4 text-ink-400">{t('pokedex.learnersRecommendedNotice')}</Text>
              <View className="gap-1.5">
                {top5.map((rec) => (
                  <RecommendedLearnerRow
                    key={rec.pokemon.id}
                    rec={rec}
                    category={move.category}
                    onPress={() => onNavigate(rec.pokemon.id)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Text className="mb-3 text-[11px] leading-4 text-ink-400">{t('pokedex.learnersStatusNotice')}</Text>
          )}

          <PressScale
            haptic="select"
            scaleTo={0.98}
            onPress={() => setExpanded((v) => !v)}
            className="flex-row items-center justify-between rounded-lg border border-ink-600 bg-ink-900 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-ink-200">
              {t('pokedex.learnersFullListToggle', { count: learners.length })}
            </Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink[400]} />
          </PressScale>

          {expanded && (
            <ScrollView style={{ maxHeight: 220 }} className="mt-2" nestedScrollEnabled>
              <View className="gap-1">
                {learners.map((p) => (
                  <PressScale
                    key={p.id}
                    haptic="select"
                    scaleTo={0.98}
                    onPress={() => onNavigate(p.id)}
                    className="flex-row items-center justify-between rounded-lg px-2 py-1.5 active:bg-ink-700"
                  >
                    <Text className="text-sm text-ink-200">{locale === 'es' ? p.name.es : p.name.en}</Text>
                    <Text className="text-xs text-ink-500">#{String(p.id).padStart(3, '0')}</Text>
                  </PressScale>
                ))}
              </View>
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

function MoveDetailModal({
  move,
  onClose,
  onNavigate,
}: {
  move: MoveEntry | null;
  onClose: () => void;
  onNavigate: (id: number) => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  return (
    <DetailModalShell visible={!!move} onClose={onClose}>
      {move && (
        <>
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-lg font-bold text-ink-100">{localizedMoveName(move.name, locale)}</Text>
            <TypeBadge type={move.type as PokeType} />
          </View>
          <View className="mb-3 flex-row flex-wrap items-center gap-3">
            <View className="rounded-full border border-ink-600 bg-ink-700 px-2 py-0.5">
              <Text className="text-[10px] font-semibold uppercase text-ink-300">{t(CATEGORY_LABELS[move.category])}</Text>
            </View>
            <Text className="text-xs text-ink-400">
              {t('guide.power')}: <Text className="text-ink-200">{move.power ?? '—'}</Text>
            </Text>
            <Text className="text-xs text-ink-400">
              {t('guide.accuracy')}: <Text className="text-ink-200">{move.accuracy !== null ? `${move.accuracy}%` : '—'}</Text>
            </Text>
            <Text className="text-xs text-ink-400">
              {t('guide.pp')}: <Text className="text-ink-200">{move.pp}</Text>
            </Text>
          </View>
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('pokedex.effectTitle')}</Text>
          <Text className="text-sm leading-5 text-ink-300">{move.effect}</Text>
          {!move.verified && (
            <View className="mt-3 rounded-lg border border-type-electric/30 bg-type-electric/10 px-3 py-2">
              <Text className="text-xs text-type-electric">{t('guide.unverifiedBadge')}</Text>
            </View>
          )}
          <MoveLearnersSection move={move} onNavigate={onNavigate} />
        </>
      )}
    </DetailModalShell>
  );
}

function AbilityDetailModal({ ability, onClose }: { ability: AbilityDescriptionEntry | null; onClose: () => void }) {
  const locale = useLocaleStore((s) => s.locale);
  return (
    <DetailModalShell visible={!!ability} onClose={onClose}>
      {ability && (
        <>
          <Text className="mb-3 text-lg font-bold text-ink-100">{localizedAbilityName(ability.name, locale)}</Text>
          <Text className="text-sm leading-5 text-ink-300">{ability.effect}</Text>
          {!ability.verified && (
            <View className="mt-3 rounded-lg border border-type-electric/30 bg-type-electric/10 px-3 py-2">
              <Text className="text-xs text-type-electric">{t('guide.unverifiedBadge')}</Text>
            </View>
          )}
        </>
      )}
    </DetailModalShell>
  );
}

const STAT_ROWS: { key: keyof PokemonStats; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'hp', label: 'pokedex.hp', icon: 'heart' },
  { key: 'attack', label: 'pokedex.attack', icon: 'flash' },
  { key: 'defense', label: 'pokedex.defense', icon: 'shield' },
  { key: 'spAttack', label: 'pokedex.spAttack', icon: 'sparkles' },
  { key: 'spDefense', label: 'pokedex.spDefense', icon: 'shield-checkmark' },
  { key: 'speed', label: 'pokedex.speed', icon: 'speedometer' },
];

// The real max any base stat can reach across every game (Blissey/Chansey's
// HP, Shuckle's Def/SpDef) — using the true ceiling instead of a per-region
// guess keeps outlier stats from all looking like an identical "full" bar.
const STAT_BAR_MAX = 255;

function EvolutionRow({ pokemon }: { pokemon: PokemonEntry }) {
  return (
    <Link href={`/pokedex/${pokemon.id}`} asChild>
      <PressScale haptic="select" scaleTo={0.98} className="flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700">
        <PokemonSprite id={pokemon.id} types={pokemon.types} size={40} />
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

  const fill = (
    <LinearGradient
      colors={[colors.pokeRed[400], colors.pokeRed.DEFAULT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    />
  );

  // useAnimatedStyle + className on the same element loses the className
  // styles on native (reanimated>=4.1.1 + nativewind regression, see the
  // 2026-07-17 CLAUDE.md entry) — the bar rendered with no fill at all in the
  // release APK. Native gets a static, pre-filled plain View instead (loses
  // only the grow-in effect); web keeps the animated path, which it already
  // renders pre-filled anyway (see the shared-value note above).
  if (isNative) {
    return (
      <View style={{ width: `${targetPct}%` }} className="h-full overflow-hidden rounded-full">
        {fill}
      </View>
    );
  }
  return (
    <Animated.View style={animatedStyle} className="h-full overflow-hidden rounded-full">
      {fill}
    </Animated.View>
  );
}

export default function PokemonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pokemon = getPokemonById(Number(id));
  const locale = useLocaleStore((s) => s.locale);
  const caught = useCaughtStore((s) => (pokemon ? s.caughtIds.includes(pokemon.id) : false));
  const toggleCaught = useCaughtStore((s) => s.toggleCaught);
  const [selectedMove, setSelectedMove] = useState<MoveEntry | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<AbilityDescriptionEntry | null>(null);

  function openMove(name: string) {
    const move = getMoveData(name);
    if (move) setSelectedMove(move);
  }

  function openAbility(name: string) {
    const ability = getAbilityDescription(name);
    if (ability) setSelectedAbility(ability);
  }

  // The "who learns this move" list inside MoveDetailModal can point at a
  // different Pokemon than the one this whole screen is showing — since the
  // modal lives nested inside this same [id] screen, close it explicitly
  // before pushing the new route rather than relying on the push itself to
  // unmount it (this project has already hit unreliable navigation-state
  // assumptions once, see the canGoBack() bug documented in CLAUDE.md).
  function navigateToLearner(targetId: number) {
    setSelectedMove(null);
    router.push(`/pokedex/${targetId}`);
  }

  if (!pokemon) {
    return (
      <Screen>
        <Header title={t('pokedex.title')} backHref="/pokedex" />
        <Text className="text-ink-400">{t('pokedex.empty')}</Text>
      </Screen>
    );
  }

  const evolvesFrom = getEvolvesFrom(pokemon);
  const evolvesInto = getEvolvesInto(pokemon);
  const hasEvolutionFamily = Boolean(evolvesFrom) || evolvesInto.length > 0;
  const primaryType = (pokemon.types as PokeType[])[0];
  const abilityInfo = getAbilities(pokemon);
  const hasAbilities = Boolean(abilityInfo?.verified && (abilityInfo.abilities.length > 0 || abilityInfo.hiddenAbility));
  const movesetInfo = getMoveset(pokemon);
  const hasMoves = Boolean(movesetInfo?.verified && movesetInfo.moves.length > 0);
  const moveGroups = hasMoves ? groupMovesByMethod(movesetInfo!.moves) : null;
  const locationEntries = getLocations(pokemon);
  const locationGroups = locationEntries.length > 0 ? groupLocationsByType(locationEntries) : null;
  const tierInfo = getTier(pokemon);
  const role = computeRole(pokemon.baseStats);

  return (
    <Screen>
      <Header title={pokemon.name.es} backHref="/pokedex" />

      <Animated.View entering={nativeOnly(FadeIn.duration(280))} className="mb-5 items-center">
        <Animated.View entering={nativeOnly(FadeInDown.duration(360).springify().damping(14))} className="mb-1">
          <PokemonSprite id={pokemon.id} types={pokemon.types} size={144} />
        </Animated.View>
        <Text className="mb-2 text-ink-400">#{String(pokemon.id).padStart(3, '0')}</Text>
        <View className="flex-row flex-wrap items-center justify-center gap-2">
          {(pokemon.types as PokeType[]).map((tp) => (
            <TypeBadge key={tp} type={tp} />
          ))}
          {tierInfo?.tier && <TierBadge tier={tierInfo.tier} />}
          <RoleBadge role={role} />
          <CaughtToggle caught={caught} onToggle={() => toggleCaught(pokemon.id)} />
        </View>
      </Animated.View>

      {tierInfo && (
        <View className="mb-3 rounded-xl border border-type-electric/30 bg-type-electric/10 px-3 py-2">
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-type-electric">
            {t('pokedex.tierTitle')}
          </Text>
          <Text className="text-xs text-type-electric">
            {tierInfo.tier
              ? t('pokedex.tierSourceNotice', { tier: t(TIER_LABEL_KEYS[tierInfo.tier]), date: tierInfo.asOf })
              : t('pokedex.tierUnavailable')}
          </Text>
        </View>
      )}

      <View className="mb-5 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('pokedex.roleTitle')}</Text>
        <Text className="text-xs text-ink-400">{t('pokedex.roleUnverifiedNotice')}</Text>
      </View>

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
        {t('pokedex.abilitiesTitle')}
      </Text>
      <View className="mb-5 rounded-xl border border-ink-600 bg-ink-800 p-4">
        {hasAbilities ? (
          <View className="flex-row flex-wrap gap-2">
            {abilityInfo!.abilities.map((ability) => (
              <PressScale
                key={ability}
                haptic="select"
                scaleTo={0.95}
                onPress={() => openAbility(ability)}
                className="rounded-full border border-ink-600 bg-ink-700 px-3 py-1.5"
              >
                <Text className="text-sm font-semibold text-ink-100">{localizedAbilityName(ability, locale)}</Text>
              </PressScale>
            ))}
            {abilityInfo!.hiddenAbility && (
              <PressScale
                haptic="select"
                scaleTo={0.95}
                onPress={() => openAbility(abilityInfo!.hiddenAbility!)}
                className="flex-row items-center gap-1 rounded-full border border-pokeRed/40 bg-pokeRed/10 px-3 py-1.5"
              >
                <Text className="text-[10px] font-bold uppercase tracking-wide text-pokeRed">
                  {t('pokedex.hiddenAbility')}
                </Text>
                <Text className="text-sm font-semibold text-pokeRed">
                  {localizedAbilityName(abilityInfo!.hiddenAbility, locale)}
                </Text>
              </PressScale>
            )}
          </View>
        ) : (
          <Text className="text-ink-400">
            {abilityInfo && !abilityInfo.verified ? t('pokedex.abilitiesUnverified') : t('pokedex.abilitiesEmpty')}
          </Text>
        )}
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

      <Text className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-ink-400">
        {t('pokedex.movesTitle')}
      </Text>
      <View className="rounded-xl border border-ink-600 bg-ink-800 p-4">
        {hasMoves ? (
          <View className="gap-4">
            {moveGroups!.byLevel.length > 0 && (
              <View>
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('pokedex.movesByLevel')}
                </Text>
                <View className="gap-1.5">
                  {moveGroups!.byLevel.map(({ name, level }, index) => (
                    <PressScale
                      key={`${name}-${level}-${index}`}
                      haptic="select"
                      scaleTo={0.98}
                      onPress={() => openMove(name)}
                      className="flex-row items-center gap-2"
                    >
                      <View className="w-10 rounded bg-ink-700 px-1.5 py-0.5">
                        <Text className="text-center text-xs font-bold text-ink-300">{level}</Text>
                      </View>
                      <Text className="text-sm text-ink-100">{localizedMoveName(name, locale)}</Text>
                    </PressScale>
                  ))}
                </View>
              </View>
            )}
            {moveGroups!.tm.length > 0 && (
              <View>
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('pokedex.movesTm')}
                </Text>
                <MoveChipRow moves={moveGroups!.tm} onPressMove={openMove} />
              </View>
            )}
            {moveGroups!.egg.length > 0 && (
              <View>
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('pokedex.movesEgg')}
                </Text>
                <MoveChipRow moves={moveGroups!.egg} onPressMove={openMove} />
              </View>
            )}
            {moveGroups!.tutor.length > 0 && (
              <View>
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('pokedex.movesTutor')}
                </Text>
                <MoveChipRow moves={moveGroups!.tutor} onPressMove={openMove} />
              </View>
            )}
          </View>
        ) : (
          <Text className="text-ink-400">
            {movesetInfo && !movesetInfo.verified ? t('pokedex.movesUnverified') : t('pokedex.movesEmpty')}
          </Text>
        )}
      </View>

      <Text className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-ink-400">
        {t('pokedex.locationsTitle')}
      </Text>
      <View className="mb-6 rounded-xl border border-ink-600 bg-ink-800 p-4">
        {locationGroups ? (
          <View className="gap-4">
            {locationGroups.map(({ type, rows }) => (
              <View key={type}>
                <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {localizedEncounterValue('locationType', type, locale)}
                </Text>
                <View>
                  {rows.map((entry, i) => (
                    <LocationRow key={`${entry.location}-${entry.levels}-${entry.rate}-${i}`} entry={entry} />
                  ))}
                </View>
              </View>
            ))}
            <Text className="text-[11px] leading-4 text-ink-500">
              {t('guide.sourceLabel')}: {locationEntries[0].source}
            </Text>
          </View>
        ) : (
          <Text className="text-ink-400">{t('pokedex.locationsEmpty')}</Text>
        )}
      </View>

      <MoveDetailModal move={selectedMove} onClose={() => setSelectedMove(null)} onNavigate={navigateToLearner} />
      <AbilityDetailModal ability={selectedAbility} onClose={() => setSelectedAbility(null)} />
    </Screen>
  );
}
