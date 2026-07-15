import natureNamesEsData from '../../data/reference/nature-names-es.json';
import naturesData from '../../data/reference/natures.json';
import { STAT_KEYS, type StatKey } from '@/lib/breeding';
import type { PokemonEntry } from '@/types/pokemon';

export type Nature = { name: string; boosts: StatKey | null; reduces: StatKey | null };
export const NATURES = naturesData as Nature[];

// Display-only translation layer, same pattern as localizedMoveName/
// localizedAbilityName in pokedex.ts (source: PokeAPI's nature_names.csv,
// language_id=7=es-ES, 25/25 verified). Lives here instead of pokedex.ts
// because NATURES/Nature already live in this file and pokedex.ts doesn't
// otherwise import showdown.ts — keeping the translation next to the data
// avoids adding a new cross-file dependency. The stored/exported value
// (build.nature, and the Showdown "<Nature> Nature" export line below) must
// stay in English — Showdown's import format requires it — so this helper
// is only ever used at render time, never on the value that gets persisted
// or exported.
const NATURE_NAMES_ES = natureNamesEsData as Record<string, string>;

export function localizedNatureName(name: string, locale: 'es' | 'en'): string {
  if (locale === 'en') return name;
  return NATURE_NAMES_ES[name] ?? name;
}

export type TeamMemberBuild = {
  nickname: string;
  item: string;
  ability: string;
  nature: string;
  evs: Record<StatKey, number>;
  ivs: Record<StatKey, number>;
  /** Up to 4 move names (canonical English, matching movesets.json/moves.json). */
  moves: string[];
};

export function defaultBuild(): TeamMemberBuild {
  return {
    nickname: '',
    item: '',
    ability: '',
    nature: 'Hardy',
    evs: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
    ivs: { hp: 31, attack: 31, defense: 31, spAttack: 31, spDefense: 31, speed: 31 },
    moves: [],
  };
}

const SHOWDOWN_STAT_LABEL: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  spAttack: 'SpA',
  spDefense: 'SpD',
  speed: 'Spe',
};

export function totalEvs(evs: Record<StatKey, number>): number {
  return STAT_KEYS.reduce((sum, stat) => sum + evs[stat], 0);
}

// Showdown's plain-text import/export format — https://pokepast.es and the
// in-client team builder both accept this. Only non-default lines are
// emitted (0 EVs / 31 IVs / no item / no moves) so a barely-configured
// export still reads cleanly instead of listing six "0 Atk" EV lines.
function exportMember(pokemon: PokemonEntry, build: TeamMemberBuild): string {
  const lines: string[] = [];
  const nameLine = build.nickname.trim() ? `${build.nickname.trim()} (${pokemon.name.en})` : pokemon.name.en;
  lines.push(build.item.trim() ? `${nameLine} @ ${build.item.trim()}` : nameLine);
  if (build.ability) lines.push(`Ability: ${build.ability}`);

  const evParts = STAT_KEYS.filter((s) => build.evs[s] > 0).map((s) => `${build.evs[s]} ${SHOWDOWN_STAT_LABEL[s]}`);
  if (evParts.length > 0) lines.push(`EVs: ${evParts.join(' / ')}`);

  lines.push(`${build.nature} Nature`);

  const ivParts = STAT_KEYS.filter((s) => build.ivs[s] !== 31).map((s) => `${build.ivs[s]} ${SHOWDOWN_STAT_LABEL[s]}`);
  if (ivParts.length > 0) lines.push(`IVs: ${ivParts.join(' / ')}`);

  for (const move of build.moves) lines.push(`- ${move}`);

  return lines.join('\n');
}

export function exportTeamToShowdown(members: { pokemon: PokemonEntry; build: TeamMemberBuild }[]): string {
  return members.map((m) => exportMember(m.pokemon, m.build)).join('\n\n');
}
