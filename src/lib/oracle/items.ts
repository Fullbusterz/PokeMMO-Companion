import { normalize } from './entities';
import { GUIDE_REGIONS, getWalkthroughGuide, gyazoDirectImageUrl, localizedLocationName } from '@/lib/guides';
import { prettifyItemName } from '@/lib/guideItemNames';
import type { AppLocale } from '@/store/localeStore';

export type ItemLocation = {
  displayName: string;
  regionName: string;
  location: string;
  hidden: boolean;
  image: string | null;
};

type IndexedItem = ItemLocation & { normalizedName: string; squishedName: string };

// Built lazily (not at module load) since it walks every step of every
// region's walkthrough — cheap once built (~1700 rows), but no reason to pay
// that cost on app start when most sessions never open the Oracle button.
// Cached per locale (display names/locations differ) rather than a single
// shared index, mirroring the locale-aware caching already used elsewhere.
const ITEM_INDEX_CACHE = new Map<AppLocale, IndexedItem[]>();

function buildItemIndex(locale: AppLocale): IndexedItem[] {
  const results: IndexedItem[] = [];
  for (const region of GUIDE_REGIONS) {
    if (!region.available) continue;
    const guide = getWalkthroughGuide(region.id);
    if (!guide) continue;
    for (const step of guide.steps) {
      for (const item of step.items) {
        const displayName = prettifyItemName(item.name, locale);
        const normalizedName = normalize(displayName);
        results.push({
          displayName,
          normalizedName,
          // Multi-word display names ("Tiny Mushroom", "Piedra Lunar") also
          // need to match a query that squishes the words together
          // ("tinymushroom") the way item slugs are usually typed/written —
          // without this, only single-word item names would ever match.
          squishedName: normalizedName.replace(/\s+/g, ''),
          regionName: locale === 'es' ? region.nameEs : region.nameEn,
          location: localizedLocationName(step.location, locale),
          hidden: item.hidden,
          image: item.image ? gyazoDirectImageUrl(item.image) : null,
        });
      }
    }
  }
  return results;
}

// Returns every walkthrough sighting of an item whose display name appears
// in the query — hidden items first (they're the ones a player is most
// likely to be stuck looking for), capped so a very common item (Potion,
// Poké Ball...) doesn't dump dozens of near-duplicate rows on screen.
export function findItemLocations(normalizedQuery: string, locale: AppLocale, limit = 6): ItemLocation[] {
  let index = ITEM_INDEX_CACHE.get(locale);
  if (!index) {
    index = buildItemIndex(locale);
    ITEM_INDEX_CACHE.set(locale, index);
  }

  const squishedQuery = normalizedQuery.replace(/\s+/g, '');
  const matches = index.filter(
    (entry) =>
      entry.normalizedName.length >= 3 &&
      (normalizedQuery.includes(entry.normalizedName) || squishedQuery.includes(entry.squishedName))
  );
  matches.sort((a, b) => Number(b.hidden) - Number(a.hidden));
  return matches.slice(0, limit);
}
