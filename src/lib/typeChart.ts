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
