import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import colors from '@/theme/colors';
import { displayFont } from '@/theme/fonts';

// router.canGoBack() is not reliable enough to be the only source of truth
// here: it reads react-navigation's in-memory stack, which starts fresh
// (i.e. reports false) after anything that resets it — a web reload, a deep
// link, or (as found 2026-07-10) a plain in-app navigation whenever it
// happens to fall through to a full browser page load instead of a client-
// side push. When that happens the old code fell back to a hardcoded route
// ('/', previously the even-more-wrong '/torneos'), which is correct for
// screens reached directly from home but wrong for anything nested (e.g.
// backing out of a Guía region page landed on the home screen instead of the
// Guía list). Each screen now tells Header its own logical parent via
// `backHref` — real back-stack navigation is still tried first (so the
// common case doesn't lose scroll/state), but the fallback is always a
// *specific, correct* destination instead of a generic guess.
function handleBack(backHref: string) {
  if (router.canGoBack()) router.back();
  // `backHref` is built from dynamic segments (e.g. `/guia/${regionId}`) by
  // callers, so it can't be typed against expo-router's generated literal
  // route union the way a hardcoded `<Link href="/torneos">` can.
  else router.replace(backHref as Href);
}

export function Header({
  title,
  showBack = true,
  backHref = '/',
  onEdit,
}: {
  title: string;
  showBack?: boolean;
  /** Logical parent screen to fall back to when there's no real back-stack entry (see handleBack above). Defaults to home, correct for screens reached directly from it. */
  backHref?: string;
  onEdit?: () => void;
}) {
  return (
    <View className="mb-4 flex-row items-center border-b border-gold/40 pb-4">
      {showBack && (
        <PressScale
          haptic="select"
          scaleTo={0.9}
          onPress={() => handleBack(backHref)}
          className="mr-3 flex-row items-center gap-0.5 py-1"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={18} color={colors.pokeRed.DEFAULT} />
          <Text className="text-pokeRed text-base font-semibold">{t('common.back')}</Text>
        </PressScale>
      )}
      <Text className="flex-1 text-2xl text-ink-100" style={{ fontFamily: displayFont.regular }}>
        {title}
      </Text>
      <View className="ml-2">
        <LanguageToggle />
      </View>
      {onEdit && (
        <PressScale
          haptic="select"
          scaleTo={0.85}
          onPress={onEdit}
          hitSlop={12}
          className="ml-2 rounded-full p-2 active:bg-ink-700"
          accessibilityRole="button"
          accessibilityLabel={t('common.edit')}
        >
          <Ionicons name="pencil" size={16} color={colors.ink[400]} />
        </PressScale>
      )}
    </View>
  );
}
