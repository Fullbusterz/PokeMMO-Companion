import johtoPokemon from '../../data/johto/pokemon.json';
import kantoPokemon from '../../data/kanto/pokemon.json';
import type { PokemonEntry } from '@/types/pokemon';

// Regions are appended here as they're built out — evolution lookups need
// the full combined list since plenty of chains cross region boundaries
// (e.g. Crobat/Johto evolves from Golbat/Kanto, Raichu/Kanto's pre-evolution
// Pichu/Johto only resolves once both are loaded).
export const ALL_POKEMON = [...(kantoPokemon as PokemonEntry[]), ...(johtoPokemon as PokemonEntry[])];

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
