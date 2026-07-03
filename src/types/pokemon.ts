export type PokemonStats = {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
};

export type PokemonEntry = {
  id: number;
  name: { en: string; es: string };
  types: string[];
  baseStats: PokemonStats;
  evolvesFrom: string | null;
  sprite: string;
  source: string;
};

export type AbilityEntry = {
  pokemon: string;
  abilities: string[];
  hiddenAbility: string | null;
  source: string;
  verified: boolean;
};

export type PokemonMove = {
  name: string;
  /** e.g. "level 1", "tm", "egg", "tutor" */
  methods: string[];
};

export type MovesetEntry = {
  pokemon: string;
  moves: PokemonMove[];
  source: string;
  verified: boolean;
};
