export type StatKey = 'hp' | 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed';

export const STAT_KEYS: StatKey[] = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'];

export type ParentInput = {
  ivs: Record<StatKey, number>;
  /** At most one stat per parent — a parent can hold a brace or an Everstone, never both. */
  bracedStat: StatKey | null;
  hasEverstone: boolean;
};

export function emptyParent(): ParentInput {
  return {
    ivs: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
    bracedStat: null,
    hasEverstone: false,
  };
}

export type StatOutcome = {
  stat: StatKey;
  /** Set when a brace forces this stat's IV to come from a specific parent — the only fully deterministic case. */
  guaranteed: { value: number; fromParent: 'A' | 'B' } | null;
  /** Value if this stat lands in the "averaged" bucket (always the same number, no randomness once the bucket is decided). */
  averagedValue: number;
  /** Value if this stat lands in the "inherited directly" bucket and the game happens to pick parent A. */
  inheritFromA: number;
  /** Same, but parent B. */
  inheritFromB: number;
  /** Shiny-breeding only: value if this stat lands in the "best of both parents" bucket. */
  bestOfBoth: number;
};

export type BreedingResult = {
  perStat: StatOutcome[];
  /** How many of the non-braced stats the game will additionally place in the "inherited directly" bucket (randomly chosen, PokeMMO doesn't let the player pick which). Normal breeding always ends with 3 inherited total; shiny breeding with 2 inherited + 2 best-of-both. */
  extraRandomInheritSlots: number;
  /** Shiny breeding only: how many additional stats land in the "best of both" bucket. */
  extraBestOfBothSlots: number;
  natureFromParent: 'A' | 'B' | null;
};

// Verified against the PokeMMO forum's breeding guide (see data/guides/breeding.json
// for the full source) — PokeMMO's breeding does NOT use vanilla-game mechanics
// (no Destiny Knot, no random 0-31 on unselected slots). Normal breeding: 3 of the
// 6 IVs are inherited directly (up to 2 forced via braces, the rest chosen at
// random by the game from whichever parent), the other 3 are averaged and rounded
// down. Shiny x shiny breeding uses a different 2 inherited + 2 best-of-both + 2
// averaged split.
export function computeBreedingOutcome(parentA: ParentInput, parentB: ParentInput, shinyBreeding: boolean): BreedingResult {
  const bracedCount = (parentA.bracedStat ? 1 : 0) + (parentB.bracedStat ? 1 : 0);
  const inheritTarget = shinyBreeding ? 2 : 3;
  const extraRandomInheritSlots = Math.max(0, inheritTarget - bracedCount);
  const extraBestOfBothSlots = shinyBreeding ? 2 : 0;

  const perStat: StatOutcome[] = STAT_KEYS.map((stat) => {
    const a = parentA.ivs[stat];
    const b = parentB.ivs[stat];
    let guaranteed: StatOutcome['guaranteed'] = null;
    if (parentA.bracedStat === stat) guaranteed = { value: a, fromParent: 'A' };
    else if (parentB.bracedStat === stat) guaranteed = { value: b, fromParent: 'B' };

    return {
      stat,
      guaranteed,
      averagedValue: Math.floor((a + b) / 2),
      inheritFromA: a,
      inheritFromB: b,
      bestOfBoth: Math.max(a, b),
    };
  });

  let natureFromParent: 'A' | 'B' | null = null;
  if (parentA.hasEverstone && !parentB.hasEverstone) natureFromParent = 'A';
  else if (parentB.hasEverstone && !parentA.hasEverstone) natureFromParent = 'B';

  return { perStat, extraRandomInheritSlots, extraBestOfBothSlots, natureFromParent };
}
