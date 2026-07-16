import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Modal, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { getItemSearchName, prettifyItemName } from '@/lib/guideItemNames';
import {
  getLocationImage,
  getTmsHmsGuide,
  getWalkthroughGuide,
  gyazoDirectImageUrl,
  localizedLocationName,
  type GuideStep,
  type RegionId,
} from '@/lib/guides';
import { useGuideBookmarkStore } from '@/store/guideBookmarkStore';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';
import { displayFont } from '@/theme/fonts';

type ViewerImage = { direct: string; fallback: string };

type Item = GuideStep['items'][number];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One FIFO queue per item name (in the *displayed* locale's own vocabulary —
 * see below), so that when the same item ("tinymushroom") appears several
 * times in a section, each textual mention picks up its own distinct
 * occurrence (and image) in the order the items were extracted.
 *
 * English source text embeds items as raw squished slugs directly in the
 * sentence ("pick a hidden tinymushroom", "pick a TM-WaterGun" — move name
 * squished with no space even for TMs), so `item.name` itself is the search
 * key there. The Spanish translation is natural prose instead ("MT-Pistola
 * Agua", with the space a real move name has), so the search key there has to
 * be `getItemSearchName`'s prose-matching form — plain `item.name` or even
 * `prettifyItemName` would never match either.
 */
function buildItemQueues(items: Item[], locale: 'es' | 'en'): Map<string, Item[]> {
  const queues = new Map<string, Item[]>();
  for (const item of items) {
    const searchName = (locale === 'en' ? item.name : getItemSearchName(item.name, 'es')).toLowerCase();
    if (!queues.has(searchName)) queues.set(searchName, []);
    queues.get(searchName)!.push(item);
  }
  return queues;
}

/**
 * Splits a step sentence into plain text and highlighted spans for every
 * item mentioned — hidden items become clickable/colored (tap opens the
 * Gyazo screenshot), visible items just get bolded. Unlike the item's flag
 * in the data, there's no reliable textual marker to tell which occurrence
 * of a repeated name is the hidden one (English used to key off the literal
 * word "hidden", but Spanish prose puts "oculto"/"oculta" *after* the item
 * and doesn't agree in gender predictably enough to regex for it) — so this
 * takes each match in the order it's found and pops the next entry off that
 * name's FIFO queue, trusting the extraction order instead of the sentence.
 */
function renderLineWithItemHighlights(
  line: string,
  queues: Map<string, Item[]>,
  onPressImage: (image: ViewerImage) => void
) {
  const pendingNames = [...queues.entries()].filter(([, q]) => q.length > 0).map(([name]) => name);
  if (pendingNames.length === 0) return <Text className="text-sm leading-5 text-ink-300">{line}</Text>;

  // Longest names first so e.g. "seta grande" matches before a bare "seta" would.
  const pattern = pendingNames
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  // No \b here on purpose — JS's \b is ASCII-only ([A-Za-z0-9_]), so it never
  // recognizes a boundary next to an accented letter (found via testing:
  // "Éter" never matched with \b since it starts with É). Boundaries are
  // checked manually below against a Latin-1-inclusive letter class instead.
  const regex = new RegExp(`(${pattern})`, 'gi');
  const LETTER = /[a-zA-ZÀ-ÿ]/;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    const before = line[match.index - 1];
    const after = line[match.index + match[0].length];
    if ((before && LETTER.test(before)) || (after && LETTER.test(after))) continue;

    const name = match[1].toLowerCase();
    const queue = queues.get(name);
    if (!queue || queue.length === 0) continue;
    const occurrence = queue.shift()!;

    if (match.index > lastIndex) nodes.push(<Text key={key++}>{line.slice(lastIndex, match.index)}</Text>);
    nodes.push(
      occurrence.hidden ? (
        <Text
          key={key++}
          onPress={
            occurrence.image
              ? (e) => {
                  // Without this the tap bubbles up to the card's own
                  // PressScale and collapses it right as the image opens.
                  e.stopPropagation();
                  onPressImage({ direct: gyazoDirectImageUrl(occurrence.image!) ?? occurrence.image!, fallback: occurrence.image! });
                }
              : undefined
          }
          style={{ color: colors.type.psychic, fontWeight: '700', textDecorationLine: occurrence.image ? 'underline' : 'none' }}
        >
          {match[1]}
        </Text>
      ) : (
        <Text key={key++} style={{ color: colors.ink[100], fontWeight: '700' }}>
          {match[1]}
        </Text>
      )
    );
    lastIndex = match.index + match[0].length;
  }
  nodes.push(<Text key={key++}>{line.slice(lastIndex)}</Text>);

  return <Text className="text-sm leading-5 text-ink-300">{nodes}</Text>;
}

function ImageViewerModal({ image, onClose }: { image: ViewerImage | null; onClose: () => void }) {
  const [loadFailed, setLoadFailed] = useState(false);

  // Reset the failed-load fallback whenever a different image is opened —
  // otherwise one broken screenshot would keep the fallback showing for
  // every image viewed afterward, since this component stays mounted.
  useEffect(() => {
    setLoadFailed(false);
  }, [image]);

  return (
    <Modal visible={!!image} transparent animationType="fade" onRequestClose={onClose}>
      <PressScale
        haptic="none"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/90 p-6"
      >
        {image && !loadFailed ? (
          <Image
            source={{ uri: image.direct }}
            className="h-full w-full"
            resizeMode="contain"
            onError={() => setLoadFailed(true)}
          />
        ) : (
          <ActivityIndicator color={colors.ink[300]} />
        )}
        {loadFailed && image && (
          <PressScale
            haptic="select"
            scaleTo={0.96}
            onPress={() => Linking.openURL(image.fallback)}
            className="mt-4 rounded-xl border border-ink-600 bg-ink-800 px-4 py-2"
          >
            <Text className="text-sm font-semibold text-ink-100">{t('guide.openInBrowser')}</Text>
          </PressScale>
        )}
        <PressScale
          haptic="select"
          scaleTo={0.9}
          onPress={onClose}
          hitSlop={12}
          className="absolute right-5 top-12 rounded-full bg-ink-800/90 p-2"
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={22} color={colors.ink[100]} />
        </PressScale>
      </PressScale>
    </Modal>
  );
}

/**
 * Plain reference list of every item in the tramo — informational only, not
 * pressable. Opening a screenshot is exclusively done by tapping the
 * highlighted word inline in the step text (see renderLineWithItemHighlights)
 * — Ferran asked (2026-07-11) to keep this list as a quick-glance summary but
 * remove its own tap-to-open behavior so there's a single, consistent way to
 * reach an item's image.
 */
function ItemsRow({ items, locale }: { items: Item[]; locale: 'es' | 'en' }) {
  if (items.length === 0) return null;
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('guide.itemsInArea')}</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {items.map((item, i) => (
          <View
            key={i}
            className={`rounded-full border px-2.5 py-1 ${item.hidden ? 'border-type-psychic/50 bg-type-psychic/10' : 'border-gold/25 bg-ink-700'}`}
          >
            <Text className={`text-xs font-semibold ${item.hidden ? 'text-type-psychic' : 'text-ink-200'}`}>
              {prettifyItemName(item.name, locale)}
              {item.hidden ? ` · ${t('guide.hiddenItem')}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LocationCard({
  step,
  region,
  expanded,
  onToggle,
  onPressImage,
  index,
  isBookmarked,
  onToggleBookmark,
}: {
  step: GuideStep;
  region: RegionId;
  expanded: boolean;
  onToggle: () => void;
  onPressImage: (image: ViewerImage) => void;
  index: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  // NOTE: PokeMMO itself never localizes place names in-game — "Mt. Moon" is
  // "Mt. Moon" for every player regardless of client language. Ferran was told
  // this explicitly and asked for the official Spanish game names anyway
  // (2026-07-11), so `localizedLocationName` below is a display-only label —
  // matching against the actual game (getLocationImage, search) always keys
  // off the untranslated `step.location`.

  const locationImage = getLocationImage(region, step.location);
  const locale = useLocaleStore((s) => s.locale);
  const displayLocation = localizedLocationName(step.location, locale);
  const showTranslation = locale === 'es' && !!step.stepsEs;
  const linesToShow = showTranslation ? step.stepsEs! : step.steps;

  // Deliberately NOT memoized: renderLineWithItemHighlights mutates these
  // queues (.shift()) as it walks each line, so the map has to be rebuilt
  // fresh on every render pass — memoizing it on `step` would hand back the
  // already-drained queues from the previous render (e.g. reopening this
  // same card, or any re-render triggered by the image modal), silently
  // losing the highlights the second time around.
  // Keyed off `showTranslation`, not the raw app `locale` — if this tramo has
  // no Spanish translation yet, `linesToShow` falls back to English, and the
  // queues need to search for English item names to match that text.
  const itemQueues = buildItemQueues(step.items, showTranslation ? 'es' : 'en');

  return (
    <Animated.View entering={nativeOnly(FadeInDown.delay(Math.min(index, 12) * 30).duration(220))} className="relative mb-2">
      {/* Dashed trail segment — each row draws its own slice, so consecutive
          waypoints read as one continuous route down the list. */}
      <View
        className="absolute"
        style={{ left: 23, top: 0, bottom: 0, borderLeftWidth: 2, borderLeftColor: colors.gold.DEFAULT, borderStyle: 'dashed', opacity: 0.3 }}
      />
      {/* Only this outer View carries the card's chrome (border/background) —
          it is a plain View, never a Pressable, so a tap landing anywhere in
          the expanded body below has no collapse handler to bubble up to.
          The header PressScale nested inside is the ONLY thing that toggles
          expand/collapse; the expanded body sits as a sibling after it,
          entirely outside that Pressable's subtree.

          This is a structural fix, not another stopPropagation patch: on
          real touch input in react-native-web, a bare `<Text onPress>` deep
          inside the card (the highlighted item word) lost the responder to
          the ancestor PressScale/Pressable that wrapped the *entire* card
          before this change — stopPropagation() on the Text's own onPress
          fired too late to stop the parent's touch responder from having
          already claimed the gesture, so the card collapsed instead of (or
          in addition to) opening the image. With the body no longer nested
          inside any collapse-toggling Pressable, there is no ancestor
          onPress left to race against. */}
      <View
        className={`overflow-hidden rounded-xl border bg-ink-800 ${isBookmarked ? 'border-gold' : 'border-gold/25'}`}
        style={isBookmarked ? { borderWidth: 1.5 } : undefined}
      >
        <PressScale haptic="select" scaleTo={0.99} onPress={onToggle} className="flex-row items-center gap-2 p-3">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-pokeRed">
            <Text className="text-[11px] font-bold text-white">{step.order}</Text>
          </View>
          <Text className="flex-1 text-base text-ink-100" style={{ fontFamily: displayFont.regular }}>
            {displayLocation}
          </Text>
          {step.items.length > 0 && (
            <View className="rounded-full bg-pokeRed/15 px-2 py-0.5">
              <Text className="text-xs font-bold text-pokeRed">{step.items.length}</Text>
            </View>
          )}
          <PressScale
            haptic="select"
            scaleTo={0.85}
            onPress={(e) => {
              // Otherwise the tap bubbles up to the header's own onToggle and
              // expands/collapses it at the same time as (un)bookmarking.
              // Still needed here: this button IS nested inside the header
              // PressScale (by design — it lives in the header row), unlike
              // the expanded body which no longer has any such ancestor.
              e.stopPropagation();
              onToggleBookmark();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? t('guide.bookmarkRemove') : t('guide.bookmarkAdd')}
          >
            <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={isBookmarked ? colors.gold.DEFAULT : colors.ink[400]} />
          </PressScale>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink[400]} />
        </PressScale>

        {expanded && (
          <View className="border-t border-gold/20 p-3 pt-2">
            {locationImage && (
              <PressScale
                haptic="select"
                scaleTo={0.98}
                onPress={() => onPressImage({ direct: locationImage.imageUrl, fallback: locationImage.wikiPageUrl })}
                className="mb-3 overflow-hidden rounded-lg border border-gold/25"
              >
                <Image source={{ uri: locationImage.imageUrl }} className="h-32 w-full" resizeMode="cover" />
              </PressScale>
            )}
            <ItemsRow items={step.items} locale={locale} />
            <View className="gap-1.5">
              {linesToShow.map((line, i) => (
                <View key={i}>{renderLineWithItemHighlights(line, itemQueues, onPressImage)}</View>
              ))}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function RegionGuide() {
  const { region } = useLocalSearchParams<{ region: string }>();
  const regionId = region as RegionId;
  const guide = getWalkthroughGuide(regionId);
  const tmsHms = getTmsHmsGuide(regionId);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<ViewerImage | null>(null);
  const locale = useLocaleStore((s) => s.locale);
  const bookmarkOrder = useGuideBookmarkStore((s) => s.bookmarks[regionId]);
  const setBookmark = useGuideBookmarkStore((s) => s.setBookmark);
  const clearBookmark = useGuideBookmarkStore((s) => s.clearBookmark);
  const listRef = useRef<FlatList<GuideStep>>(null);
  const [pendingScrollOrder, setPendingScrollOrder] = useState<number | null>(null);

  const filteredSteps = useMemo(() => {
    if (!guide) return [];
    const q = query.trim().toLowerCase();
    if (!q) return guide.steps;
    return guide.steps.filter(
      (s) =>
        s.location.toLowerCase().includes(q) ||
        localizedLocationName(s.location, locale).toLowerCase().includes(q) ||
        s.items.some((i) => prettifyItemName(i.name, locale).toLowerCase().includes(q))
    );
  }, [guide, query, locale]);

  const bookmarkedStep = guide?.steps.find((s) => s.order === bookmarkOrder) ?? null;

  // Runs after `query`/`expanded` changes triggered by jumpToBookmark below —
  // waits for `filteredSteps` to reflect the cleared search before resolving
  // an index to scroll to, since scrolling in the same tick would still be
  // targeting the old (filtered) list.
  useEffect(() => {
    if (pendingScrollOrder == null) return;
    const index = filteredSteps.findIndex((s) => s.order === pendingScrollOrder);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.15 });
      setPendingScrollOrder(null);
    }
  }, [pendingScrollOrder, filteredSteps]);

  function jumpToBookmark() {
    if (bookmarkOrder == null) return;
    setQuery('');
    setExpanded((prev) => new Set(prev).add(bookmarkOrder));
    setPendingScrollOrder(bookmarkOrder);
  }

  if (!guide) {
    return (
      <Screen>
        <Header title={t('guide.title')} backHref="/guia" />
        <Text className="text-ink-400">{t('guide.comingSoon')}</Text>
      </Screen>
    );
  }

  function toggle(order: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(order)) next.delete(order);
      else next.add(order);
      return next;
    });
  }

  const searching = query.trim().length > 0;

  return (
    <Screen scroll={false}>
      <Header title={guide.title} backHref="/guia" />

      {tmsHms && (
        <Link href={`/guia/${regionId}/tms`} asChild>
          <Button variant="secondary" className="mb-3">
            {t('guide.tmsHmsLink')}
          </Button>
        </Link>
      )}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('guide.searchPlaceholder')}
        placeholderTextColor={colors.ink[400]}
        className="mb-3 rounded-xl border border-gold/25 bg-ink-800 px-4 py-3 text-base text-ink-100"
      />

      {bookmarkedStep && (
        <PressScale
          haptic="select"
          scaleTo={0.98}
          onPress={jumpToBookmark}
          className="mb-3 flex-row items-center gap-2 rounded-xl border border-gold bg-gold/10 px-3 py-2.5"
        >
          <Ionicons name="bookmark" size={16} color={colors.gold.DEFAULT} />
          <Text className="flex-1 text-sm font-semibold text-gold" numberOfLines={1}>
            {t('guide.jumpToBookmark', { location: localizedLocationName(bookmarkedStep.location, locale) })}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.gold.DEFAULT} />
        </PressScale>
      )}

      <FlatList
        ref={listRef}
        data={filteredSteps}
        keyExtractor={(item) => String(item.order)}
        renderItem={({ item, index }) => (
          <LocationCard
            step={item}
            region={regionId}
            expanded={searching || expanded.has(item.order)}
            onToggle={() => toggle(item.order)}
            onPressImage={setSelectedImage}
            index={index}
            isBookmarked={item.order === bookmarkOrder}
            onToggleBookmark={() => (item.order === bookmarkOrder ? clearBookmark(regionId) : setBookmark(regionId, item.order))}
          />
        )}
        onScrollToIndexFailed={(info) => {
          // FlatList can't jump straight to an index it hasn't measured yet
          // (rows are variable height — collapsed vs. the one expanded card).
          // Standard RN workaround: get close via the average, then retry.
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.15 }), 100);
        }}
        ListEmptyComponent={<Text className="mt-8 text-center text-ink-400">{t('guide.searchEmpty')}</Text>}
        ListFooterComponent={
          <Text className="mb-6 mt-2 text-xs leading-4 text-ink-400">
            {t('guide.sourceLabel')}: {guide.source}
          </Text>
        }
      />

      <ImageViewerModal image={selectedImage} onClose={() => setSelectedImage(null)} />
    </Screen>
  );
}
