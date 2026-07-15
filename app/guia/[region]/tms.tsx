import { useLocalSearchParams } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { getTmsHmsGuide, type HmEntry, type RegionId, type TmEntry } from '@/lib/guides';
import type { PokeType } from '@/lib/typeChart';

function TmRow({ tm, index }: { tm: TmEntry; index: number }) {
  return (
    <Animated.View
      entering={nativeOnly(FadeInDown.delay(Math.min(index, 12) * 25).duration(220))}
      className="mb-2 rounded-xl border border-ink-600 bg-ink-800 p-3"
    >
      <View className="flex-row items-center gap-2">
        <View className="rounded bg-ink-700 px-1.5 py-0.5">
          <Text className="text-xs font-bold text-ink-300">TM{String(tm.tm).padStart(2, '0')}</Text>
        </View>
        <Text className="flex-1 text-base font-semibold text-ink-100">{tm.name}</Text>
        <TypeBadge type={tm.type.toLowerCase() as PokeType} />
      </View>
      <View className="mt-2 flex-row gap-4">
        <Text className="text-xs text-ink-400">
          {t('guide.power')}: <Text className="text-ink-200">{tm.power}</Text>
        </Text>
        <Text className="text-xs text-ink-400">
          {t('guide.accuracy')}: <Text className="text-ink-200">{tm.accuracy}</Text>
        </Text>
        <Text className="text-xs text-ink-400">
          {t('guide.pp')}: <Text className="text-ink-200">{tm.pp}</Text>
        </Text>
      </View>
      <View className="mt-2 gap-0.5">
        {tm.locations.map((loc, i) => (
          <Text key={i} className="text-sm text-ink-300">
            📍 {loc}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}

function HmRow({ hm, index }: { hm: HmEntry; index: number }) {
  return (
    <Animated.View
      entering={nativeOnly(FadeInDown.delay(Math.min(index, 12) * 25).duration(220))}
      className="mb-2 rounded-xl border border-ink-600 bg-ink-800 p-3"
    >
      <Text className="text-base font-semibold text-ink-100">{hm.name}</Text>
      <Text className="mt-1 text-sm text-ink-300">📍 {hm.location}</Text>
    </Animated.View>
  );
}

export default function RegionTmsHms() {
  const { region } = useLocalSearchParams<{ region: string }>();
  const guide = getTmsHmsGuide(region as RegionId);

  if (!guide) {
    return (
      <Screen>
        <Header title={t('guide.tmsHmsLink')} backHref={`/guia/${region}`} />
        <Text className="text-ink-400">{t('guide.comingSoon')}</Text>
      </Screen>
    );
  }

  const data: (({ kind: 'tm' } & TmEntry) | ({ kind: 'hm' } & HmEntry) | { kind: 'hmHeader' })[] = [
    ...guide.tms.map((tm) => ({ kind: 'tm' as const, ...tm })),
    { kind: 'hmHeader' as const },
    ...guide.hms.map((hm) => ({ kind: 'hm' as const, ...hm })),
  ];

  return (
    <Screen scroll={false}>
      <Header title={guide.title} backHref={`/guia/${region}`} />
      {!guide.verified && (
        <View className="mb-3 rounded-lg border border-type-electric/30 bg-type-electric/10 px-3 py-2">
          <Text className="text-xs text-type-electric">{t('guide.unverifiedBadge')}</Text>
        </View>
      )}
      <FlatList
        data={data}
        keyExtractor={(item, i) => (item.kind === 'hmHeader' ? 'hm-header' : `${item.kind}-${i}`)}
        renderItem={({ item, index }) => {
          if (item.kind === 'hmHeader') {
            return (
              <Text className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
                {t('guide.hms')}
              </Text>
            );
          }
          if (item.kind === 'tm') return <TmRow tm={item} index={index} />;
          return <HmRow hm={item} index={index} />;
        }}
        ListFooterComponent={
          <Text className="mb-6 mt-2 text-xs leading-4 text-ink-400">
            {t('guide.sourceLabel')}: {guide.source}
          </Text>
        }
      />
    </Screen>
  );
}
