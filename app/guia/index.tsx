import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { GUIDE_REGIONS, REFERENCE_TOPICS, getWalkthroughGuide, localizedLocationName } from '@/lib/guides';
import { useGuideBookmarkStore } from '@/store/guideBookmarkStore';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';
import { displayFont } from '@/theme/fonts';

export default function GuideHub() {
  const locale = useLocaleStore((s) => s.locale);
  const bookmarks = useGuideBookmarkStore((s) => s.bookmarks);

  return (
    <Screen>
      <Header title={t('guide.title')} />
      <Text className="mb-5 text-ink-400">{t('guide.subtitle')}</Text>

      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
        {t('guide.regionsTitle')}
      </Text>
      <View className="mb-6 flex-row flex-wrap gap-2">
        {GUIDE_REGIONS.map((region, index) => {
          const bookmarkOrder = bookmarks[region.id];
          const bookmarkedStep =
            bookmarkOrder != null ? getWalkthroughGuide(region.id)?.steps.find((s) => s.order === bookmarkOrder) : null;
          const card = (
            <Animated.View
              key={region.id}
              entering={nativeOnly(FadeInDown.delay(index * 50).duration(240))}
              style={{ width: '48%' }}
            >
              <PressScale
                disabled={!region.available}
                haptic={region.available ? 'select' : undefined}
                scaleTo={0.97}
                className={`rounded-xl border p-4 ${
                  region.available
                    ? 'border-gold/30 bg-ink-800 active:bg-ink-700'
                    : 'border-ink-700 bg-ink-800/40'
                }`}
              >
                <Text
                  className={`text-base ${region.available ? 'text-ink-100' : 'text-ink-400'}`}
                  style={{ fontFamily: displayFont.regular }}
                >
                  {region.nameEs}
                </Text>
                {bookmarkedStep ? (
                  <View className="mt-1 flex-row items-center gap-1">
                    <Ionicons name="bookmark" size={11} color={colors.gold.DEFAULT} />
                    <Text className="flex-1 text-xs text-gold" numberOfLines={1}>
                      {t('guide.bookmarkedAt', { location: localizedLocationName(bookmarkedStep.location, locale) })}
                    </Text>
                  </View>
                ) : (
                  <Text className="mt-1 text-xs text-ink-400">
                    {region.available ? t('guide.walkthroughLink') : t('guide.comingSoon')}
                  </Text>
                )}
              </PressScale>
            </Animated.View>
          );
          return region.available ? (
            <Link key={region.id} href={`/guia/${region.id}`} asChild>
              {card}
            </Link>
          ) : (
            card
          );
        })}
      </View>

      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
        {t('guide.referenceTitle')}
      </Text>
      <View>
        {REFERENCE_TOPICS.map((topic, index) => (
          <Animated.View
            key={topic.id}
            entering={nativeOnly(FadeInDown.delay(index * 40).duration(240))}
            className="relative mb-2"
          >
            <View
              className="absolute"
              style={{ left: 23, top: 0, bottom: 0, borderLeftWidth: 2, borderLeftColor: colors.gold.DEFAULT, borderStyle: 'dashed', opacity: 0.3 }}
            />
            <Link href={`/guia/referencia/${topic.id}`} asChild>
              <PressScale
                haptic="select"
                scaleTo={0.98}
                className="flex-row items-center gap-3 rounded-xl border border-gold/25 bg-ink-800 p-3 active:bg-ink-700"
              >
                <View className="h-6 w-6 items-center justify-center rounded-full bg-pokeRed">
                  <Ionicons name={topic.icon} size={13} color="white" />
                </View>
                <Text className="flex-1 text-base text-ink-100" style={{ fontFamily: displayFont.regular }}>
                  {t(`guide.topics.${topic.id}`)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.ink[400]} />
              </PressScale>
            </Link>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}
