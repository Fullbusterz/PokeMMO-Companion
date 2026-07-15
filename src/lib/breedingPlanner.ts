import type { StatKey } from '@/lib/breeding';

// Multi-generation breeding tree planner — verified against the forum's breeding
// guide ("PART 1 - Perfectionists" section of forums.pokemmo.com/topic/49440),
// which documents the FULL step-by-step procedure for building a 6x31 from
// thirty-two 1x31 base parents via a binary doubling tree (worked example given
// stat-by-stat for every step). The guide's own numbers (62 braces / 620,000
// PokéYen minimum, "1:5:10:10:5:1" ratio of base 1x31 needed per stat) match
// exactly what this recursive construction produces, so this generalizes the
// SAME documented algorithm to any 2-6 target stats instead of inventing new
// mechanics. Cost is intentionally NOT recomputed here — it's pulled from the
// already-verified data/guides/breeding.json costTable by stat count, since the
// mechanic is symmetric (cost only depends on how many stats, not which ones).

type TreeNode = {
  stats: StatKey[];
  bracedStats: [StatKey, StatKey] | null;
  left: TreeNode | null;
  right: TreeNode | null;
};

function buildTree(stats: StatKey[]): TreeNode {
  if (stats.length === 1) {
    return { stats, bracedStats: null, left: null, right: null };
  }
  const left = buildTree(stats.slice(0, -1));
  const right = buildTree(stats.slice(1));
  return {
    stats,
    bracedStats: [stats[0], stats[stats.length - 1]],
    left,
    right,
  };
}

export type CrossStep = {
  level: number; // 1 = first generation of crosses (combines base 1x31 parents), increases toward the final cross
  resultStats: StatKey[];
  bracedStats: [StatKey, StatKey];
  leftStats: StatKey[];
  rightStats: StatKey[];
};

export type MultiGenPlan = {
  targetStats: StatKey[];
  totalBaseParents: number;
  baseParentsByStat: { stat: StatKey; count: number }[];
  totalCrosses: number;
  totalBraces: number;
  stepsByLevel: { level: number; steps: CrossStep[] }[];
};

export function computeMultiGenPlan(targetStats: StatKey[]): MultiGenPlan | null {
  if (targetStats.length < 2 || targetStats.length > 6) return null;

  const tree = buildTree(targetStats);
  const leafCounts = new Map<StatKey, number>();
  const crossSteps: CrossStep[] = [];

  function walk(node: TreeNode) {
    if (!node.left || !node.right || !node.bracedStats) {
      leafCounts.set(node.stats[0], (leafCounts.get(node.stats[0]) ?? 0) + 1);
      return;
    }
    walk(node.left);
    walk(node.right);
    crossSteps.push({
      level: node.stats.length - 1,
      resultStats: node.stats,
      bracedStats: node.bracedStats,
      leftStats: node.left.stats,
      rightStats: node.right.stats,
    });
  }
  walk(tree);

  const totalBaseParents = Array.from(leafCounts.values()).reduce((a, b) => a + b, 0);
  const baseParentsByStat = targetStats.map((stat) => ({ stat, count: leafCounts.get(stat) ?? 0 }));

  const levels = Array.from(new Set(crossSteps.map((s) => s.level))).sort((a, b) => a - b);
  const stepsByLevel = levels.map((level) => ({
    level,
    steps: crossSteps.filter((s) => s.level === level),
  }));

  return {
    targetStats,
    totalBaseParents,
    baseParentsByStat,
    totalCrosses: crossSteps.length,
    totalBraces: crossSteps.length * 2,
    stepsByLevel,
  };
}
