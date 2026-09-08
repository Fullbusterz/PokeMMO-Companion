import { t } from '@/i18n';
import { computeRole, type CombatRole } from '@/lib/role';
import type { PokeType } from '@/lib/typeChart';
import type {
  AbilityDescriptionEntry,
  AbilityEntry,
  LocationEntry,
  MoveEntry,
  MovesetEntry,
  PokemonEntry,
  PokemonMove,
  PvpTier,
  TierEntry,
} from '@/types/pokemon';


// All 5 PokeMMO regions — evolution lookups need the full combined list
// since plenty of chains cross region boundaries (e.g. Crobat/Johto evolves
// from Golbat/Kanto, Raichu/Kanto's pre-evolution Pichu/Johto only resolves
// once both are loaded). Teselia (Gen 5) is the last region and, unlike
// Sinnoh, doesn't add any new evolutions for older-region Pokemon — verified
// programmatically when this region was built.
// Everything this module serves is built on first use, never at import time.
// That matters because expo-router builds its route table by requiring every
// route file up front: importing pokedex.ts from one screen effectively
// imports it on every screen, so a player opening the tournament link on their
// phone was parsing 0.84 MB of Pokedex JSON they never look at.
//
// The tables are indexes rather than arrays to scan, too. searchPokemon()
// filtering by tier called getTier() — a linear scan of 649 rows — once per
// Pokemon, so one tap on a filter chip cost ~420,000 string comparisons.
type PokedexTables = {
  all: PokemonEntry[];
  byId: Map<number, PokemonEntry>;
  byEnglishName: Map<string, PokemonEntry>;
  evolvesInto: Map<string, PokemonEntry[]>;
  abilities: AbilityEntry[];
  abilityByPokemon: Map<string, AbilityEntry>;
  moveByName: Map<string, MoveEntry>;
  abilityDescriptionByName: Map<string, AbilityDescriptionEntry>;
  tierByPokemon: Map<string, TierEntry>;
  moveNamesEs: Record<string, string>;
  abilityNamesEs: Record<string, string>;
};

let tables: PokedexTables | null = null;

function buildTables(): PokedexTables {
  const all: PokemonEntry[] = [
    ...(require('../../data/kanto/pokemon.json') as PokemonEntry[]),
    ...(require('../../data/johto/pokemon.json') as PokemonEntry[]),
    ...(require('../../data/hoenn/pokemon.json') as PokemonEntry[]),
    ...(require('../../data/sinnoh/pokemon.json') as PokemonEntry[]),
    ...(require('../../data/teselia/pokemon.json') as PokemonEntry[]),
  ];
  // Placeholder stub entries (pokemon: "_example_do_not_use") from regions that
  // were never scraped fall out of the lookups on their own: no real Pokemon
  // name ever matches that key.
  const abilities: AbilityEntry[] = [
    ...(require('../../data/kanto/abilities.json') as AbilityEntry[]),
    ...(require('../../data/johto/abilities.json') as AbilityEntry[]),
    ...(require('../../data/hoenn/abilities.json') as AbilityEntry[]),
    ...(require('../../data/sinnoh/abilities.json') as AbilityEntry[]),
    ...(require('../../data/teselia/abilities.json') as AbilityEntry[]),
  ];

  const byId = new Map<number, PokemonEntry>();
  const byEnglishName = new Map<string, PokemonEntry>();
  const evolvesInto = new Map<string, PokemonEntry[]>();
  for (const pokemon of all) {
    byId.set(pokemon.id, pokemon);
    byEnglishName.set(pokemon.name.en.toLowerCase(), pokemon);
    const from = pokemon.evolvesFrom?.toLowerCase();
    if (from) {
      const list = evolvesInto.get(from);
      if (list) list.push(pokemon);
      else evolvesInto.set(from, [pokemon]);
    }
  }

  return {
    all,
    byId,
    byEnglishName,
    evolvesInto,
    abilities,
    abilityByPokemon: new Map(abilities.map((a) => [a.pokemon, a])),
    moveByName: new Map((require('../../data/reference/moves.json') as MoveEntry[]).map((m) => [m.name, m])),
    abilityDescriptionByName: new Map(
      (require('../../data/reference/ability-descriptions.json') as AbilityDescriptionEntry[]).map((a) => [a.name, a])
    ),
    tierByPokemon: new Map(
      (require('../../data/tiers/pokemmo_tiers.json') as TierEntry[]).map((entry) => [entry.pokemon, entry])
    ),
    moveNamesEs: require('../../data/reference/move-names-es.json') as Record<string, string>,
    abilityNamesEs: require('../../data/reference/ability-names-es.json') as Record<string, string>,
  };
}

function pokedex(): PokedexTables {
  tables ??= buildTables();
  return tables;
}

/** Every Pokemon of the five regions, in dex order. Parsed on first call. */
export function allPokemon(): PokemonEntry[] {
  return pokedex().all;
}

export type RegionFilter = 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'teselia';

export const POKEDEX_REGIONS: { id: RegionFilter; nameEs: string; nameEn: string }[] = [
  { id: 'kanto', nameEs: 'Kanto', nameEn: 'Kanto' },
  { id: 'johto', nameEs: 'Johto', nameEn: 'Johto' },
  { id: 'hoenn', nameEs: 'Hoenn', nameEn: 'Hoenn' },
  { id: 'sinnoh', nameEs: 'Sinnoh', nameEn: 'Sinnoh' },
  { id: 'teselia', nameEs: 'Teselia', nameEn: 'Unova' },
];

export function regionForId(id: number): RegionFilter {
  if (id <= 151) return 'kanto';
  if (id <= 251) return 'johto';
  if (id <= 386) return 'hoenn';
  if (id <= 493) return 'sinnoh';
  return 'teselia';
}

export function getPokemonById(id: number): PokemonEntry | undefined {
  return pokedex().byId.get(id);
}

function getPokemonByEnglishName(englishName: string): PokemonEntry | undefined {
  return pokedex().byEnglishName.get(englishName.toLowerCase());
}

export function getEvolvesFrom(pokemon: PokemonEntry): PokemonEntry | undefined {
  if (!pokemon.evolvesFrom) return undefined;
  return getPokemonByEnglishName(pokemon.evolvesFrom);
}

export function getEvolvesInto(pokemon: PokemonEntry): PokemonEntry[] {
  return pokedex().evolvesInto.get(pokemon.name.en.toLowerCase()) ?? [];
}

export function searchPokemon(
  query: string,
  filters?: { region?: RegionFilter; type?: PokeType; tier?: PvpTier; role?: CombatRole }
): PokemonEntry[] {
  let list = pokedex().all;
  if (filters?.region) list = list.filter((p) => regionForId(p.id) === filters.region);
  if (filters?.type) list = list.filter((p) => (p.types as PokeType[]).includes(filters.type!));
  if (filters?.tier) list = list.filter((p) => getTier(p)?.tier === filters.tier);
  if (filters?.role) list = list.filter((p) => computeRole(p.baseStats) === filters.role);

  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (p) => p.name.es.toLowerCase().includes(q) || p.name.en.toLowerCase().includes(q) || String(p.id).includes(q)
  );
}

export function getAbilities(pokemon: PokemonEntry): AbilityEntry | undefined {
  return pokedex().abilityByPokemon.get(pokemon.name.en.toLowerCase());
}

// Reverse lookup for the Oracle assistant ("which Pokemon have Levitate?") —
// everywhere else only needs pokemon -> abilities, so this is the one caller
// that needs the relationship the other way round.
export function getPokemonWithAbility(abilityName: string): PokemonEntry[] {
  const normalized = abilityName.toLowerCase();
  const matchingSlugs = new Set(
    pokedex().abilities.filter(
      (a) => a.abilities.some((ab) => ab.toLowerCase() === normalized) || a.hiddenAbility?.toLowerCase() === normalized
    ).map((a) => a.pokemon)
  );
  return pokedex().all.filter((p) => matchingSlugs.has(p.name.en.toLowerCase()));
}

// movesets.json is ~1-1.3MB PER region (~5MB combined) — big enough that
// eagerly combining all 5 like ALL_POKEMON/ALL_ABILITIES do would parse all
// of it on every app start, even though a session only ever looks at one
// Pokemon (one region) at a time. Each require() below has a static literal
// path (required for Metro to bundle it), but the actual JSON.parse only
// runs the first time that specific region is requested, and is cached
// after that by Metro's module system.
function loadRegionMovesets(region: string): MovesetEntry[] {
  switch (region) {
    case 'kanto':
      return require('../../data/kanto/movesets.json');
    case 'johto':
      return require('../../data/johto/movesets.json');
    case 'hoenn':
      return require('../../data/hoenn/movesets.json');
    case 'sinnoh':
      return require('../../data/sinnoh/movesets.json');
    case 'teselia':
      return require('../../data/teselia/movesets.json');
    default:
      return [];
  }
}

export function getMoveset(pokemon: PokemonEntry): MovesetEntry | undefined {
  const moves = loadRegionMovesets(regionForId(pokemon.id));
  return moves.find((m) => m.pokemon === pokemon.name.en.toLowerCase());
}

// Shared by the Pokedex detail screen (app/pokedex/[id].tsx) and Mi caja's
// build editor (app/caja/[id].tsx) — both need the same "by level / TM / egg
// / tutor" breakdown of a moveset, extracted here instead of duplicating it
// a second time. `type PokemonMove` methods are raw wiki-scrape strings like
// "level 32", "tm", "egg", "tutor" (see types/pokemon.ts).
export function groupMovesByMethod(moves: PokemonMove[]) {
  const byLevel: { name: string; level: number }[] = [];
  const tm = new Set<string>();
  const egg = new Set<string>();
  const tutor = new Set<string>();

  for (const move of moves) {
    for (const method of move.methods) {
      const levelMatch = method.match(/^level (\d+)$/);
      if (levelMatch) byLevel.push({ name: move.name, level: Number(levelMatch[1]) });
      else if (method === 'tm') tm.add(move.name);
      else if (method === 'egg') egg.add(move.name);
      else if (method === 'tutor') tutor.add(move.name);
    }
  }
  byLevel.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return { byLevel, tm: [...tm].sort(), egg: [...egg].sort(), tutor: [...tutor].sort() };
}

// locations.json totals ~950KB combined across the 5 regions — closer in
// scale to movesets.json (~5MB, lazily loaded) than to abilities.json
// (~156KB, eagerly combined), so it follows the same lazy per-region pattern
// as loadRegionMovesets() above instead of ALL_ABILITIES's eager approach.
function loadRegionLocations(region: string): LocationEntry[] {
  switch (region) {
    case 'kanto':
      return require('../../data/kanto/locations.json');
    case 'johto':
      return require('../../data/johto/locations.json');
    case 'hoenn':
      return require('../../data/hoenn/locations.json');
    case 'sinnoh':
      return require('../../data/sinnoh/locations.json');
    case 'teselia':
      return require('../../data/teselia/locations.json');
    default:
      return [];
  }
}

// A Pokemon only has location rows within its own dex-range region's file —
// e.g. Growlithe (Kanto dex range) only has its Kanto wild-encounter rows
// saved, even if PokeMMO also lets you catch it elsewhere. Same scoping
// getAbilities()/getMoveset() already use, just not merged across regions
// like ALL_ABILITIES because most Pokemon only ever have entries in one file.
export function getLocations(pokemon: PokemonEntry): LocationEntry[] {
  const locations = loadRegionLocations(regionForId(pokemon.id));
  return locations.filter((l) => l.pokemon === pokemon.name.en.toLowerCase());
}

// moves.json + ability-descriptions.json are ~250KB combined — small enough
// to eagerly load like ALL_ABILITIES above, and unlike per-Pokemon data
// there's exactly one region-agnostic file for each (a move works the same
// regardless of which region's Pokemon knows it).
export function getMoveData(name: string): MoveEntry | undefined {
  return pokedex().moveByName.get(name);
}

export function getAbilityDescription(name: string): AbilityDescriptionEntry | undefined {
  return pokedex().abilityDescriptionByName.get(name);
}

// Move/ability data everywhere else (movesets.json, abilities.json,
// moves.json, ability-descriptions.json) is keyed by the canonical English
// name — these two maps are a display-only translation layer on top, sourced
// from PokeAPI's official localized names (safe to use here unlike for
// mechanics: a move's *name* in Spanish is a fixed Nintendo translation, not
// a PokeMMO-specific mechanic that could diverge — see REGLA DE ORO in
// CLAUDE.md). A couple of PokeMMO-exclusive abilities (e.g. Reactive Gas,
// Snow Plow) don't exist in the official games and have no entry here, so
// callers must fall back to the English name when the lookup misses.

export function localizedMoveName(name: string, locale: 'es' | 'en'): string {
  if (locale === 'en') return name;
  return pokedex().moveNamesEs[name] ?? name;
}

export function localizedAbilityName(name: string, locale: 'es' | 'en'): string {
  if (locale === 'en') return name;
  return pokedex().abilityNamesEs[name] ?? name;
}

// Wild-encounter fields (locations.json) come straight from the English wiki
// scrape — locationType ("Tall Grass", "Old Rod"...), rate ("Very Common",
// "Horde"...), timeOfDay ("morning"/"day"/"night"). This is a display-only
// translation layer (like localizedMoveName/localizedAbilityName above): the
// raw dataset value is never touched, only what's painted on screen. Unlike
// moves/abilities the enumeration here is tiny and closed (verified against
// every region's locations.json), so it lives as i18n keys instead of a
// separate reference JSON file.
export type EncounterValueKind = 'locationType' | 'rate' | 'timeOfDay';

const ENCOUNTER_KEY_TABLES: Record<EncounterValueKind, Record<string, string>> = {
  locationType: {
    'Tall Grass': 'tallGrass',
    Cave: 'cave',
    Surfing: 'surfing',
    Inside: 'inside',
    Rocks: 'rocks',
    'Honey Tree': 'honeyTree',
    'Old Rod': 'oldRod',
    'Good Rod': 'goodRod',
    'Super Rod': 'superRod',
    Headbutt: 'headbutt',
    'Dark Grass': 'darkGrass',
    Shadow: 'shadow',
    'Dust cloud': 'dustCloud',
    Fishing: 'fishing',
  },
  rate: {
    'Very Common': 'veryCommon',
    Common: 'common',
    Uncommon: 'uncommon',
    Rare: 'rare',
    'Very Rare': 'veryRare',
    Horde: 'horde',
    Lure: 'lure',
    Special: 'special',
    'Not specified': 'notSpecified',
  },
  timeOfDay: {
    morning: 'morning',
    day: 'day',
    night: 'night',
  },
};

// Never crashes and never leaks an i18n key to the screen: unknown raw
// values (e.g. a future wiki update adding a new encounter method) fall back
// to the raw English string exactly as before this helper existed.
export function localizedEncounterValue(kind: EncounterValueKind, raw: string, locale: 'es' | 'en'): string {
  if (locale === 'en') return raw;
  const key = ENCOUNTER_KEY_TABLES[kind][raw];
  if (!key) return raw;
  return t(`pokedex.encounter.${kind}.${key}`, { locale });
}

// PvP tier — derived from the PokeMMO Wiki's OU/UU/NU eligibility tables
// (set difference between the cumulative lists) plus the wiki/PvP universal
// bans (Shaymin, Jirachi). Every entry carries `asOf` (the wiki tables' own
// last-edit date) so the UI can show how fresh the data is — tiers are
// recalculated live by usage, so this is a snapshot, never "current".
export function getTier(pokemon: PokemonEntry): TierEntry | undefined {
  return pokedex().tierByPokemon.get(pokemon.name.en.toLowerCase());
}
