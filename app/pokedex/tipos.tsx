import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { ALL_TYPES, getEffectivenessFor, type PokeType } from '@/lib/typeChart';
import colors from '@/theme/colors';

function EffectivenessSection({ title, types }: { title: string; types: PokeType[] }) {
  return (
    <View className="mb-4">
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
    </View>
  );
}

export default function TypeComparator() {
  const [selected, setSelected] = useState<PokeType | null>(null);
  const effectiveness = useMemo(() => (selected ? getEffectivenessFor(selected) : null), [selected]);

  return (
    <Screen>
      <Header title={t('pokedex.typesTitle')} />
      <Text className="mb-4 text-ink-300">{t('pokedex.typesSubtitle')}</Text>

      <View className="mb-5 flex-row flex-wrap gap-2">
        {ALL_TYPES.map((tp) => {
          const isSelected = selected === tp;
          const color = colors.type[tp];
          return (
            <Pressable
              key={tp}
              onPress={() => setSelected(tp)}
              className="rounded-full px-3 py-1.5"
              style={{
                backgroundColor: isSelected ? color : `${color}26`,
                borderWidth: isSelected ? 0 : 1,
                borderColor: `${color}55`,
              }}
            >
              <Text
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: isSelected ? colors.ink[900] : color }}
              >
                {t(`types.${tp}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {effectiveness && (
        <>
          <EffectivenessSection title={t('pokedex.superEffective')} types={effectiveness.superEffective} />
          <EffectivenessSection title={t('pokedex.notVeryEffective')} types={effectiveness.notVeryEffective} />
          <EffectivenessSection title={t('pokedex.noEffect')} types={effectiveness.noEffect} />
        </>
      )}
    </Screen>
  );
}
