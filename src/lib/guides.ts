import type { Ionicons } from '@expo/vector-icons';

import locationNamesEs from '../../data/reference/location-names-es.json';

// Official Spanish location names (2026-07-11, Ferran explicitly asked for
// these despite being told PokeMMO itself never localizes place names in-game
// — see the "PALLET TOWN" note further down and the CLAUDE.md entry for this
// change). Display-only: the underlying `location` string is never touched,
// so image matching / search / everything else keeps keying off English.
const LOCATION_NAMES_ES = locationNamesEs as Record<string, string>;

// The same place is written differently depending on where the string came
// from: the walkthrough guides shout it ("MT.MOON", "PALLET TOWN") while the
// wild-encounter dataset title-cases it ("Mt. Moon", "Pallet Town"). An exact
// lookup only ever matched the first kind, which is why the Pokédex still
// showed English names while the Guide didn't. Indexing on a normalised key
// (case, dots, apostrophes and runs of spaces folded away) makes one
// dictionary serve both.
function normalizeLocationKey(location: string): string {
  return location
    .toUpperCase()
    .replace(/[.']/g, ' ')
    .replace(/’/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LOCATION_NAMES_ES_INDEX: Record<string, string> = Object.fromEntries(
  Object.entries(LOCATION_NAMES_ES).map(([key, value]) => [normalizeLocationKey(key), value])
);

/**
 * Display-only. The underlying `location` string is never touched, so image
 * matching, search and every other lookup keep keying off the English name.
 * Anything without a translation falls through unchanged rather than being
 * guessed at.
 */
export function localizedLocationName(location: string, locale: 'es' | 'en'): string {
  if (locale === 'en') return location;
  return LOCATION_NAMES_ES_INDEX[normalizeLocationKey(location)] ?? location;
}

// Keys sorted longest-first so "Route 44" is matched before "Route 4" — a
// shortest-match pass would rewrite the wrong half of the string.
const LOCATION_KEYS_BY_LENGTH = Object.keys(LOCATION_NAMES_ES_INDEX).sort((a, b) => b.length - a.length);

// Place names inside running prose. The walkthrough text was translated to
// Spanish but its place names were deliberately left in English back in
// July, when the rule was "PokeMMO never localizes them in-game". Ferran has
// since asked for them translated everywhere, so this is the third and last
// place that needed it — and the trickiest, because unlike the other two the
// name sits inside a sentence rather than at a known position.
//
// Two things make it safe:
//  * longest key first, so "Route 4" can never rewrite the "Route 4" inside
//    "Route 44";
//  * boundaries checked by hand against a Latin-1-inclusive letter class
//    instead of \b. JS's \b is ASCII-only and never fires next to an accented
//    letter — the same trap that once stopped "Éter" from ever matching in the
//    item highlighter a few lines below.
// Keys are matched with flexible separators so the dictionary's "MT.MOON"
// still finds "Mt. Moon" in the text.
const LOCATION_PROSE_PATTERN = new RegExp(
  `(${Object.keys(LOCATION_NAMES_ES_INDEX)
    .sort((a, b) => b.length - a.length)
    .map((key) =>
      key
        .split(' ')
        .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[.\\s]+')
    )
    .join('|')})`,
  'gi'
);
const PROSE_LETTER = /[a-zA-ZÀ-ÿ0-9]/;

/**
 * Replaces every English place name found inside a line of prose with its
 * Spanish name. Display-only: the stored text is never modified, so item
 * highlighting and image lookups keep working off the original strings.
 */
export function localizedLocationsInText(text: string, locale: 'es' | 'en'): string {
  if (locale === 'en') return text;
  LOCATION_PROSE_PATTERN.lastIndex = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LOCATION_PROSE_PATTERN.exec(text)) !== null) {
    const before = text[match.index - 1];
    const after = text[match.index + match[0].length];
    if ((before && PROSE_LETTER.test(before)) || (after && PROSE_LETTER.test(after))) continue;

    const spanish = LOCATION_NAMES_ES_INDEX[normalizeLocationKey(match[0])];
    if (!spanish) continue;

    result += text.slice(lastIndex, match.index) + spanish;
    lastIndex = match.index + match[0].length;
  }

  return lastIndex === 0 ? text : result + text.slice(lastIndex);
}

/**
 * Translates the place name at the START of a longer phrase, leaving the rest
 * alone: "Cerulean City (Gimnasio - derrota a Misty)" becomes "Ciudad Celeste
 * (Gimnasio - derrota a Misty)". The TM/HM tables were translated from the
 * Portuguese source but their place names were left in English, so they read
 * half in each language.
 *
 * Only the leading name is touched. Substituting anywhere in the string would
 * eventually rewrite a word inside the descriptive part, and a wrong place name
 * is worse than an untranslated one.
 */
export function localizedLocationPhrase(phrase: string, locale: 'es' | 'en'): string {
  if (locale === 'en') return phrase;
  const normalized = normalizeLocationKey(phrase);
  const key = LOCATION_KEYS_BY_LENGTH.find(
    (candidate) => normalized === candidate || normalized.startsWith(candidate + ' ')
  );
  if (!key) return phrase;

  // Walk the original string token by token until the normalised prefix is
  // consumed, so the untouched remainder keeps its original spacing and case.
  const keyWords = key.split(' ').length;
  const words = phrase.trim().split(/\s+/);
  const rest = words.slice(keyWords).join(' ');
  return rest ? `${LOCATION_NAMES_ES_INDEX[key]} ${rest}` : LOCATION_NAMES_ES_INDEX[key];
}

export type GuideStep = {
  order: number;
  location: string;
  steps: string[];
  /** Community Spanish translation of `steps` (2026-07-10, Ferran reversed the earlier English-only decision) — same line count/order as `steps`. Place names stay in English inside the translated text too (PokeMMO doesn't localize them). Optional: only populated where a translation has actually been done; falls back to `steps` otherwise. */
  stepsEs?: string[];
  items: { name: string; hidden: boolean; image?: string }[];
};

// Guide items store the Gyazo *page* URL (gyazo.com/<hash>) since that's what's
// attributable back to the source guide. The page itself just embeds a direct
// image at i.gyazo.com/<hash>.png — deriving that here lets the app show the
// screenshot inline instead of bouncing out to the browser.
export function gyazoDirectImageUrl(pageUrl: string): string | null {
  const match = pageUrl.match(/gyazo\.com\/([a-f0-9]+)$/i);
  return match ? `https://i.gyazo.com/${match[1]}.png` : null;
}

export type WalkthroughGuide = {
  region: string;
  title: string;
  source: string;
  note?: string;
  steps: GuideStep[];
};

export type TmEntry = {
  tm: number;
  name: string;
  type: string;
  power: string;
  accuracy: string;
  pp: string;
  locations: string[];
};

export type HmEntry = { name: string; location: string };

export type TmsHmsGuide = {
  region: string;
  title: string;
  source: string;
  verified: boolean;
  tms: TmEntry[];
  hms: HmEntry[];
};

export type RegionId = 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'teselia';

export const GUIDE_REGIONS: { id: RegionId; nameEn: string; nameEs: string; available: boolean }[] = [
  { id: 'kanto', nameEn: 'Kanto', nameEs: 'Kanto', available: true },
  { id: 'johto', nameEn: 'Johto', nameEs: 'Johto', available: true },
  { id: 'hoenn', nameEn: 'Hoenn', nameEs: 'Hoenn', available: true },
  { id: 'sinnoh', nameEn: 'Sinnoh', nameEs: 'Sinnoh', available: true },
  { id: 'teselia', nameEn: 'Unova', nameEs: 'Teselia', available: true },
];

export function getWalkthroughGuide(region: RegionId): WalkthroughGuide | null {
  switch (region) {
    case 'kanto':
      return require('../../data/guides/kanto.json');
    case 'johto':
      return require('../../data/guides/johto.json');
    case 'hoenn':
      return require('../../data/guides/hoenn.json');
    case 'sinnoh':
      return require('../../data/guides/sinnoh.json');
    case 'teselia':
      return require('../../data/guides/teselia.json');
    default:
      return null;
  }
}

export type LocationImageEntry = { location: string; wikiPageUrl: string; imageUrl: string };

const LOCATION_IMAGE_REGION_PREFIX: Record<RegionId, string> = {
  kanto: 'Kanto ',
  johto: 'Johto ',
  hoenn: 'Hoenn ',
  sinnoh: 'Sinnoh ',
  teselia: 'Unova ',
};

let locationImagesCache: Record<string, LocationImageEntry[]> | null = null;
function loadLocationImages(): Record<string, LocationImageEntry[]> {
  if (!locationImagesCache) {
    locationImagesCache = require('../../data/guides/location-images.json');
  }
  return locationImagesCache!;
}

function stripRegionPrefix(name: string, region: RegionId): string {
  const prefix = LOCATION_IMAGE_REGION_PREFIX[region];
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function coreKeyword(name: string): string {
  return name.replace(/\s+(Town|City)$/i, '').toUpperCase();
}

// Matches a walkthrough tramo's `location` string (e.g. "ROUTE 1", "VIRIDIAN
// CITY", or Johto's composite chapter titles like "AZALEA AND KURT'S HOUSE")
// against the location-images dataset. Exact match first (covers the simple
// "ROUTE N" / "CITY NAME" convention used by Kanto/Hoenn/Sinnoh/Teselia).
//
// The core-keyword substring fallback is Johto-only, on purpose — it exists
// because Johto's `location` is a narrative chapter title, not a bare place
// name, so an exact match is never possible there. Applying that same
// fallback to the other 4 regions caused real false positives (found
// 2026-07-11): "VIRIDIAN FOREST" matched "Viridian City" (different place,
// shared word), and "ROUTE 25" matched "Kanto Route 2" (plain substring:
// "ROUTE 25" contains the literal text "ROUTE 2"). Neither is Johto's
// composite-title case, so for every other region a non-exact match now
// means "no image" rather than a guess.
export function getLocationImage(region: RegionId, tramoLocation: string): LocationImageEntry | null {
  const entries = loadLocationImages()[region] as LocationImageEntry[] | undefined;
  if (!entries) return null;
  const upper = tramoLocation.toUpperCase();

  for (const entry of entries) {
    if (stripRegionPrefix(entry.location, region).toUpperCase() === upper) return entry;
  }
  if (region !== 'johto') return null;
  for (const entry of entries) {
    const core = coreKeyword(stripRegionPrefix(entry.location, region));
    if (core.length >= 4 && upper.includes(core)) return entry;
  }
  return null;
}

export function getTmsHmsGuide(region: RegionId): TmsHmsGuide | null {
  switch (region) {
    case 'kanto':
      return require('../../data/guides/kanto-tms-hms.json');
    case 'hoenn':
      return require('../../data/guides/hoenn-tms-hms.json');
    case 'sinnoh':
      return require('../../data/guides/sinnoh-tms-hms.json');
    default:
      return null;
  }
}

// Reference guide shapes — each topic's JSON was hand-built from a different
// kind of source material (prose article, Q&A FAQ, structured table...), so
// unlike GuideStep/TmEntry above there's no single common schema across them.
export type ProseSection = { heading: string | null; paragraphs: string[] };
export type ProseGuide = { topic: string; title: string; source: string; note?: string; sections: ProseSection[] };

export type QaEntry = { question: string; answer: string };
export type RoamingLegendariesGuide = {
  topic: string;
  title: string;
  source: string;
  note?: string;
  qa: QaEntry[];
};

export type EvSpotPokemon = { count: number; pokemon: string; evs?: number };
export type EvSpot = { stat?: string; pokemon: EvSpotPokemon[]; details: string };
export type EvTrainingGuide = {
  topic: string;
  title: string;
  source: string;
  note?: string;
  bestSpots: EvSpot[];
  levelingSpots: EvSpot[];
  alternativeSpots: EvSpot[];
  reducingBerries: { stat: string; berry: string; effect: string }[];
};

export type SmeargleMethod = { name: string; steps: string[]; note?: string };
export type SmeargleGuide = {
  topic: string;
  title: string;
  source: string;
  intro: string;
  methods: SmeargleMethod[];
  faq: QaEntry[];
  warning?: string;
  pokemonWithKeyMoves: { move: string; pokemon: string[] }[];
};

export type TmMarketEntry = { move: string; locations: string[]; price: string };
export type ShardTutor = {
  color: string;
  tutorLocations: string[];
  shardLocation?: string;
  moves: { move: string; cost: number }[];
};
export type MoveTutorEntry = { move: string; cost: string; description: string };
export type BattleFrontierTutor = { side: 'left' | 'right'; moves: { move: string; cost: string }[] };
export type UltimateMoveEntry = { move: string; requirement: string; cost: string };
export type FindingEveryMoveGuide = {
  topic: string;
  title: string;
  source: string;
  note?: string;
  tmMarketLocations: TmMarketEntry[];
  shardTutors: ShardTutor[];
  moveTutorsByRegion: { kanto: MoveTutorEntry[]; hoenn: MoveTutorEntry[]; sinnoh: MoveTutorEntry[]; unova: MoveTutorEntry[] };
  battleFrontier: { note: string; location: string; tutors: BattleFrontierTutor[] };
  ultimateMoves: { locations: string[]; moves: UltimateMoveEntry[] };
  otherRegionsPending?: { note: string };
};

export type BreedingMechanic = { title: string; description: string };
export type GenderCostRow = { femaleChancePercent: number; costMale: string; costFemale: string };
export type BreedingCostRow = { target: string; cost: string };
export type BreedingGuide = {
  topic: string;
  title: string;
  source: string;
  note?: string;
  mechanics: BreedingMechanic[];
  genderSelectionCosts: GenderCostRow[];
  shinyBreeding: { intro: string; ivFormula: string; otTransfer: string };
  costTable: { note: string; rows: BreedingCostRow[] };
};

export type DifferenceItem = {
  nameEs: string;
  nameEn: string;
  pokemmoEffect: string;
  officialEffect: string;
  differenceType: string;
  sourceUrl: string;
  confidence: string;
};
export type DifferencesGuide = {
  topic: string;
  title: string;
  source: string;
  note?: string;
  scopeNote: string;
  items: DifferenceItem[];
};

export type ReferenceGuideData =
  | ProseGuide
  | RoamingLegendariesGuide
  | EvTrainingGuide
  | SmeargleGuide
  | FindingEveryMoveGuide
  | BreedingGuide
  | DifferencesGuide;

export type ReferenceTopic =
  | 'ivs'
  | 'ev-training'
  | 'effort-values'
  | 'damage-calculator'
  | 'building-competitive-teams'
  | 'roaming-legendaries'
  | 'finding-every-move'
  | 'smeargle-sketch'
  | 'breeding'
  | 'differences'
  | 'general-mechanics';

export const REFERENCE_TOPICS: { id: ReferenceTopic; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'ivs', icon: 'analytics' },
  { id: 'effort-values', icon: 'stats-chart' },
  { id: 'ev-training', icon: 'barbell' },
  { id: 'breeding', icon: 'heart' },
  { id: 'building-competitive-teams', icon: 'people' },
  { id: 'finding-every-move', icon: 'compass' },
  { id: 'smeargle-sketch', icon: 'brush' },
  { id: 'roaming-legendaries', icon: 'paw' },
  { id: 'damage-calculator', icon: 'calculator' },
  { id: 'differences', icon: 'git-compare' },
  { id: 'general-mechanics', icon: 'sparkles' },
];

export function getReferenceGuide(topic: ReferenceTopic): ReferenceGuideData | null {
  switch (topic) {
    case 'ivs':
      return require('../../data/guides/ivs.json');
    case 'ev-training':
      return require('../../data/guides/ev-training.json');
    case 'effort-values':
      return require('../../data/guides/effort-values.json');
    case 'damage-calculator':
      return require('../../data/guides/damage-calculator.json');
    case 'building-competitive-teams':
      return require('../../data/guides/building-competitive-teams.json');
    case 'roaming-legendaries':
      return require('../../data/guides/roaming-legendaries.json');
    case 'finding-every-move':
      return require('../../data/guides/finding-every-move.json');
    case 'smeargle-sketch':
      return require('../../data/guides/smeargle-sketch.json');
    case 'breeding':
      return require('../../data/guides/breeding.json');
    case 'differences':
      return require('../../data/guides/differences.json');
    case 'general-mechanics':
      return require('../../data/guides/general-mechanics.json');
    default:
      // Reachable at runtime via an invalid deep link — `topic` comes from
      // the URL and the `as ReferenceTopic` cast doesn't actually validate it.
      return null;
  }
}
