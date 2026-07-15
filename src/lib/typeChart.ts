import chartData from '../../data/type-chart.json';

// 17 types — no Fairy (introduced in Gen 6, doesn't exist in PokeMMO's Gen 5
// cap). See data/type-chart.json for the source note on the Steel exception.
export type PokeType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel';

type TypeChartData = {
  source: string;
  verified: boolean;
  types: PokeType[];
  effectiveness: Record<PokeType, Partial<Record<PokeType, number>>>;
};

const typeChart = chartData as TypeChartData;

export const ALL_TYPES: PokeType[] = typeChart.types;

export type Effectiveness = {
  superEffective: PokeType[];
  notVeryEffective: PokeType[];
  noEffect: PokeType[];
};

export function getEffectivenessFor(attackerType: PokeType): Effectiveness {
  const row = typeChart.effectiveness[attackerType] ?? {};
  const superEffective: PokeType[] = [];
  const notVeryEffective: PokeType[] = [];
  const noEffect: PokeType[] = [];

  for (const defenderType of ALL_TYPES) {
    const multiplier = row[defenderType] ?? 1;
    if (multiplier === 2) superEffective.push(defenderType);
    else if (multiplier === 0.5) notVeryEffective.push(defenderType);
    else if (multiplier === 0) noEffect.push(defenderType);
  }

  return { superEffective, notVeryEffective, noEffect };
}

// Raw combined multiplier of one attacking type against 1-2 defending types
// — the building block both getEffectivenessForCombo() and the team builder
// (src/lib/teamBuilder.ts) use, exposed separately since the team builder
// needs a single number per (attacker, defender) pair rather than a bucketed
// list.
export function getMultiplier(attackerType: PokeType, defenderTypes: PokeType[]): number {
  const row = typeChart.effectiveness[attackerType] ?? {};
  return defenderTypes.reduce((acc, defType) => acc * (row[defType] ?? 1), 1);
}

export type ComboEffectiveness = {
  x4: PokeType[];
  x2: PokeType[];
  x05: PokeType[];
  x025: PokeType[];
  x0: PokeType[];
};

// Effectiveness of each attacking type against a *defending* dual-type
// combination (e.g. Grass/Poison) — multiplies the two per-type matchups,
// same math the games use for double-typed Pokemon.
export function getEffectivenessForCombo(defenderTypes: PokeType[]): ComboEffectiveness {
  const result: ComboEffectiveness = { x4: [], x2: [], x05: [], x025: [], x0: [] };

  for (const attackerType of ALL_TYPES) {
    const multiplier = getMultiplier(attackerType, defenderTypes);
    if (multiplier === 4) result.x4.push(attackerType);
    else if (multiplier === 2) result.x2.push(attackerType);
    else if (multiplier === 0.5) result.x05.push(attackerType);
    else if (multiplier === 0.25) result.x025.push(attackerType);
    else if (multiplier === 0) result.x0.push(attackerType);
  }

  return result;
}
