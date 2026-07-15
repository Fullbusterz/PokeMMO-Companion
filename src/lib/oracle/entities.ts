import abilityDescriptions from '../../../data/reference/ability-descriptions.json';
import abilityNamesEsData from '../../../data/reference/ability-names-es.json';
import moveNames from '../../../data/reference/move-names.json';
import moveNamesEsData from '../../../data/reference/move-names-es.json';
import { t } from '@/i18n';
import { ALL_POKEMON } from '@/lib/pokedex';
import { ALL_TYPES, type PokeType } from '@/lib/typeChart';
import type { AbilityDescriptionEntry, PokemonEntry } from '@/types/pokemon';

// Strips accents/case so "Pokémon", "pokemon" and "POKÉMON" all match the
// same way, and so a Spanish query ("dónde") matches an unaccented index
// entry built from English source data.
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

type IndexEntry<T> = { normalized: string; value: T };

// Every entity lookup below works the same way: build a list of {normalized
// name -> value} pairs (covering ES + EN spellings), sort longest-first so a
// longer match is preferred over a shorter one it contains (e.g. "nidoran"
// query shouldn't accidentally resolve via some 3-letter fragment), then scan
// for the first entry whose normalized name appears inside the query text.
// This is intentionally simple substring matching, not real NLP — matches
// the project's "no fake AI" design for this feature (see CLAUDE.md idea 5).
function findInIndex<T>(index: IndexEntry<T>[], normalizedQuery: string): T | null {
  for (const entry of index) {
    if (entry.normalized.length >= 3 && normalizedQuery.includes(entry.normalized)) {
      return entry.value;
    }
  }
  return null;
}

function buildIndex<T>(pairs: [string, T][]): IndexEntry<T>[] {
  return pairs
    .map(([name, value]) => ({ normalized: normalize(name), value }))
    .sort((a, b) => b.normalized.length - a.normalized.length);
}

// --- Pokemon ---
const POKEMON_INDEX = buildIndex<PokemonEntry>(
  ALL_POKEMON.flatMap((p) => [
    [p.name.es, p] as [string, PokemonEntry],
    [p.name.en, p] as [string, PokemonEntry],
  ])
);

export function findPokemon(normalizedQuery: string): PokemonEntry | null {
  return findInIndex(POKEMON_INDEX, normalizedQuery);
}

// --- Moves ---
const MOVE_NAMES_ES = moveNamesEsData as Record<string, string>;
const MOVE_INDEX = buildIndex<string>([
  ...(moveNames as string[]).map((name) => [name, name] as [string, string]),
  ...Object.entries(MOVE_NAMES_ES).map(([en, es]) => [es, en] as [string, string]),
]);

export function findMove(normalizedQuery: string): string | null {
  return findInIndex(MOVE_INDEX, normalizedQuery);
}

// --- Abilities ---
const ABILITY_NAMES_ES = abilityNamesEsData as Record<string, string>;
const ABILITY_NAMES = (abilityDescriptions as AbilityDescriptionEntry[]).map((a) => a.name);
const ABILITY_INDEX = buildIndex<string>([
  ...ABILITY_NAMES.map((name) => [name, name] as [string, string]),
  ...Object.entries(ABILITY_NAMES_ES).map(([en, es]) => [es, en] as [string, string]),
]);

export function findAbility(normalizedQuery: string): string | null {
  return findInIndex(ABILITY_INDEX, normalizedQuery);
}

// --- Types ---
const TYPE_INDEX = buildIndex<PokeType>(
  ALL_TYPES.flatMap((tp) => [
    [tp, tp] as [string, PokeType],
    [t(`types.${tp}`, { locale: 'es' }), tp] as [string, PokeType],
    [t(`types.${tp}`, { locale: 'en' }), tp] as [string, PokeType],
  ])
);

export function findType(normalizedQuery: string): PokeType | null {
  return findInIndex(TYPE_INDEX, normalizedQuery);
}

// Finds up to 2 distinct types mentioned in the query (for dual-type combo
// questions) — scans the same index but keeps collecting instead of
// returning on the first hit.
export function findTypes(normalizedQuery: string, max = 2): PokeType[] {
  const found: PokeType[] = [];
  for (const entry of TYPE_INDEX) {
    if (entry.normalized.length < 3) continue;
    if (!normalizedQuery.includes(entry.normalized)) continue;
    if (found.includes(entry.value)) continue;
    found.push(entry.value);
    if (found.length >= max) break;
  }
  return found;
}
