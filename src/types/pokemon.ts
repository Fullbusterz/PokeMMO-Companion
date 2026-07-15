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

export type MoveCategory = 'physical' | 'special' | 'status';

export type MoveEntry = {
  name: string;
  /** lowercase PokeType */
  type: string;
  category: MoveCategory;
  /** null for status moves, or moves whose power is conditional/variable (described in `effect` instead) */
  power: number | null;
  /** null for moves that bypass accuracy checks entirely */
  accuracy: number | null;
  /** base PP before any PP Ups */
  pp: number;
  effect: string;
  source: string;
  verified: boolean;
};

export type AbilityDescriptionEntry = {
  name: string;
  effect: string;
  source: string;
  verified: boolean;
};

export type LocationEntry = {
  pokemon: string;
  region: string;
  /** e.g. "Tall Grass", "Cave", "Surfing", "Good Rod", "Super Rod", "Headbutt"... */
  locationType: string;
  location: string;
  levels: string;
  /** "Very Common" | "Common" | "Uncommon" | "Rare" | "Very Rare" | "Horde" | "Lure" | "Not specified" | "Special" */
  rate: string;
  timeOfDay: ('morning' | 'day' | 'night')[];
  source: string;
  verified: boolean;
};

export type PvpTier = 'uber' | 'ou' | 'uu' | 'nu';

export type TierEntry = {
  pokemon: string;
  /** null = legendario/mítico fuera de las tablas de elegibilidad de la wiki (no disponible en tiers estándar) */
  tier: PvpTier | null;
  source: string;
  verified: boolean;
  /** Fecha del dato más reciente usado para calcular el tier — ver aviso en la UI, el sistema real se recalcula en vivo por uso */
  asOf: string;
};
