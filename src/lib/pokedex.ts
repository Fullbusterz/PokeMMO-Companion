import hoennAbilities from '../../data/hoenn/abilities.json';
import hoennPokemon from '../../data/hoenn/pokemon.json';
import johtoAbilities from '../../data/johto/abilities.json';
import johtoPokemon from '../../data/johto/pokemon.json';
import kantoAbilities from '../../data/kanto/abilities.json';
import kantoPokemon from '../../data/kanto/pokemon.json';
import sinnohAbilities from '../../data/sinnoh/abilities.json';
import sinnohPokemon from '../../data/sinnoh/pokemon.json';
import teseliaAbilities from '../../data/teselia/abilities.json';
import teseliaPokemon from '../../data/teselia/pokemon.json';
import type { AbilityEntry, MovesetEntry, PokemonEntry } from '@/types/pokemon';

// All 5 PokeMMO regions — evolution lookups need the full combined list
// since plenty of chains cross region boundaries (e.g. Crobat/Johto evolves
// from Golbat/Kanto, Raichu/Kanto's pre-evolution Pichu/Johto only resolves
// once both are loaded). Teselia (Gen 5) is the last region and, unlike
// Sinnoh, doesn't add any new evolutions for older-region Pokemon — verified
// programmatically when this region was built.
export const ALL_POKEMON = [
  ...(kantoPokemon as PokemonEntry[]),
  ...(johtoPokemon as PokemonEntry[]),
  ...(hoennPokemon as PokemonEntry[]),
  ...(sinnohPokemon as PokemonEntry[]),
  ...(teseliaPokemon as PokemonEntry[]),
];

export function getPokemonById(id: number): PokemonEntry | undefined {
  return ALL_POKEMON.find((p) => p.id === id);
}

function getPokemonByEnglishName(englishName: string): PokemonEntry | undefined {
  const normalized = englishName.toLowerCase();
  return ALL_POKEMON.find((p) => p.name.en.toLowerCase() === normalized);
}

export function getEvolvesFrom(pokemon: PokemonEntry): PokemonEntry | undefined {
  if (!pokemon.evolvesFrom) return undefined;
  return getPokemonByEnglishName(pokemon.evolvesFrom);
}

export function getEvolvesInto(pokemon: PokemonEntry): PokemonEntry[] {
  const normalized = pokemon.name.en.toLowerCase();
  return ALL_POKEMON.filter((p) => p.evolvesFrom?.toLowerCase() === normalized);
}

export function searchPokemon(query: string): PokemonEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_POKEMON;
  return ALL_POKEMON.filter(
    (p) => p.name.es.toLowerCase().includes(q) || p.name.en.toLowerCase().includes(q) || String(p.id).includes(q)
  );
}

// Placeholder stub entries (pokemon: "_example_do_not_use") from regions
// that haven't been scraped yet fall out here automatically since no real
// Pokemon name ever matches that key.
const ALL_ABILITIES = [
  ...(kantoAbilities as AbilityEntry[]),
  ...(johtoAbilities as AbilityEntry[]),
  ...(hoennAbilities as AbilityEntry[]),
  ...(sinnohAbilities as AbilityEntry[]),
  ...(teseliaAbilities as AbilityEntry[]),
];

export function getAbilities(pokemon: PokemonEntry): AbilityEntry | undefined {
  return ALL_ABILITIES.find((a) => a.pokemon === pokemon.name.en.toLowerCase());
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

function regionForId(id: number): string {
  if (id <= 151) return 'kanto';
  if (id <= 251) return 'johto';
  if (id <= 386) return 'hoenn';
  if (id <= 493) return 'sinnoh';
  return 'teselia';
}

export function getMoveset(pokemon: PokemonEntry): MovesetEntry | undefined {
  const moves = loadRegionMovesets(regionForId(pokemon.id));
  return moves.find((m) => m.pokemon === pokemon.name.en.toLowerCase());
}
