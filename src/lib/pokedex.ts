import kantoPokemon from '../../data/kanto/pokemon.json';
import type { PokemonEntry } from '@/types/pokemon';

export const KANTO_POKEMON = kantoPokemon as PokemonEntry[];

export function getPokemonById(id: number): PokemonEntry | undefined {
  return KANTO_POKEMON.find((p) => p.id === id);
}

function getPokemonByEnglishName(englishName: string): PokemonEntry | undefined {
  const normalized = englishName.toLowerCase();
  return KANTO_POKEMON.find((p) => p.name.en.toLowerCase() === normalized);
}

export function getEvolvesFrom(pokemon: PokemonEntry): PokemonEntry | undefined {
  if (!pokemon.evolvesFrom) return undefined;
  return getPokemonByEnglishName(pokemon.evolvesFrom);
}

export function getEvolvesInto(pokemon: PokemonEntry): PokemonEntry[] {
  const normalized = pokemon.name.en.toLowerCase();
  return KANTO_POKEMON.filter((p) => p.evolvesFrom?.toLowerCase() === normalized);
}

export function searchPokemon(query: string): PokemonEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return KANTO_POKEMON;
  return KANTO_POKEMON.filter(
    (p) => p.name.es.toLowerCase().includes(q) || p.name.en.toLowerCase().includes(q) || String(p.id).includes(q)
  );
}
