import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { isNative, nativeOnly } from '@/lib/animation';
import { ALL_TYPES, getEffectivenessFor, getEffectivenessForCombo, type PokeType } from '@/lib/typeChart';
import colors from '@/theme/colors';

function EffectivenessSection({ title, types, index }: { title: string; types: PokeType[]; index: number }) {
  return (
    <Animated.View entering={nativeOnly(FadeInDown.delay(index * 60).duration(240))} className="mb-4">
      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">{title}</Text>
      {types.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {types.map((tp) => (
            <TypeBadge key={tp} type={tp} />
          ))}
        </View>
      ) : (
        <Text className="text-ink-400">{t('pokedex.typesEmptyCategory')}</Text>
      )}
    </Animated.View>
  );
}

function TypeToggle({ type, isSelected, onPress }: { type: PokeType; isSelected: boolean; onPress: () => void }) {
  const color = colors.type[type];
  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    // On web, post-mount shared-value updates never reach the DOM (see
    // src/lib/animation.ts) — the plain `style` fallback below covers
    // correctness there, so there's nothing useful for this effect to do.
    if (!isNative) return;
    progress.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [`${color}26`, color]),
    borderWidth: progress.value > 0.5 ? 0 : 1,
    borderColor: `${color}55`,
  }));
  const webStyle = {
    backgroundColor: isSelected ? color : `${color}26`,
    borderWidth: isSelected ? 0 : 1,
    borderColor: `${color}55`,
  };

  return (
    <PressScale
      haptic="select"
      scaleTo={0.94}
      onPress={onPress}
      className="rounded-full px-3 py-1.5"
      // Static style on BOTH platforms now: PressScale renders a plain
      // Pressable on native (see its 2026-07-17 note), so the animated color
      // style has nowhere to run there — and web always used the static path.
      style={webStyle}
    >
      <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: isSelected ? colors.ink[900] : color }}>
        {t(`types.${type}`)}
      </Text>
    </PressScale>
  );
}

function ModeToggle({ mode, onChange }: { mode: 'single' | 'combo'; onChange: (mode: 'single' | 'combo') => void }) {
  return (
    <View className="mb-4 flex-row gap-2">
      {(['single', 'combo'] as const).map((m) => (
        <PressScale
          key={m}
          haptic="select"
          scaleTo={0.97}
          onPress={() => onChange(m)}
          className={`flex-1 rounded-full border px-3 py-2 ${
            mode === m ? 'border-pokeRed bg-pokeRed/15' : 'border-ink-600 bg-ink-800'
          }`}
        >
          <Text
            className={`text-center text-xs font-bold uppercase tracking-wide ${
              mode === m ? 'text-pokeRed' : 'text-ink-400'
            }`}
          >
            {t(m === 'single' ? 'pokedex.typesModeSingle' : 'pokedex.typesModeCombo')}
          </Text>
        </PressScale>
      ))}
    </View>
  );
}

function SingleTypeMode() {
  const [selected, setSelected] = useState<PokeType | null>(null);
  const effectiveness = useMemo(() => (selected ? getEffectivenessFor(selected) : null), [selected]);

  return (
    <>
      <Text className="mb-4 text-ink-300">{t('pokedex.typesSubtitle')}</Text>

      <View className="mb-5 flex-row flex-wrap gap-2">
        {ALL_TYPES.map((tp) => (
          <TypeToggle key={tp} type={tp} isSelected={selected === tp} onPress={() => setSelected(tp)} />
        ))}
      </View>

      {effectiveness && (
        <View key={selected}>
          <EffectivenessSection title={t('pokedex.superEffective')} types={effectiveness.superEffective} index={0} />
          <EffectivenessSection title={t('pokedex.notVeryEffective')} types={effectiveness.notVeryEffective} index={1} />
          <EffectivenessSection title={t('pokedex.noEffect')} types={effectiveness.noEffect} index={2} />
        </View>
      )}
    </>
  );
}

function ComboTypeMode() {
  const [comboTypes, setComboTypes] = useState<PokeType[]>([]);
  const effectiveness = useMemo(
    () => (comboTypes.length > 0 ? getEffectivenessForCombo(comboTypes) : null),
    [comboTypes]
  );

  const toggleType = (tp: PokeType) => {
    setComboTypes((prev) => {
      if (prev.includes(tp)) return prev.filter((t2) => t2 !== tp);
      if (prev.length < 2) return [...prev, tp];
      return [prev[1], tp];
    });
  };

  return (
    <>
      <Text className="mb-4 text-ink-300">{t('pokedex.typesComboSubtitle')}</Text>

      <View className="mb-5 flex-row flex-wrap gap-2">
        {ALL_TYPES.map((tp) => (
          <TypeToggle key={tp} type={tp} isSelected={comboTypes.includes(tp)} onPress={() => toggleType(tp)} />
        ))}
      </View>

      {effectiveness ? (
        <View key={comboTypes.join('-')}>
          <EffectivenessSection title={t('pokedex.typesComboX4')} types={effectiveness.x4} index={0} />
          <EffectivenessSection title={t('pokedex.typesComboX2')} types={effectiveness.x2} index={1} />
          <EffectivenessSection title={t('pokedex.typesComboX05')} types={effectiveness.x05} index={2} />
          <EffectivenessSection title={t('pokedex.typesComboX025')} types={effectiveness.x025} index={3} />
          <EffectivenessSection title={t('pokedex.typesComboX0')} types={effectiveness.x0} index={4} />
        </View>
      ) : (
        <Text className="text-ink-400">{t('pokedex.typesComboEmpty')}</Text>
      )}
    </>
  );
}

export default function TypeComparator() {
  const [mode, setMode] = useState<'single' | 'combo'>('single');

  return (
    <Screen>
      <Header title={t('pokedex.typesTitle')} backHref="/pokedex" />
      <ModeToggle mode={mode} onChange={setMode} />
      {mode === 'single' ? <SingleTypeMode /> : <ComboTypeMode />}
    </Screen>
  );
}
