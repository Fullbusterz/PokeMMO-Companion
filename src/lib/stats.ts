import type { StatKey } from '@/lib/breeding';
import { NATURES } from '@/lib/showdown';

// Standard Gen 3+ stat formulas (unchanged through Gen 5, which is what
// PokeMMO's battle engine is built on regardless of which story region a
// Pokemon comes from — the formula itself isn't region-specific).
export function computeHp(base: number, iv: number, ev: number, level: number): number {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

export function computeOtherStat(base: number, iv: number, ev: number, level: number, natureName: string, stat: StatKey): number {
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  const nature = NATURES.find((n) => n.name === natureName);
  const natureMod = nature?.boosts === stat ? 1.1 : nature?.reduces === stat ? 0.9 : 1.0;
  return Math.floor(raw * natureMod);
}

export function computeStat(
  stat: StatKey,
  base: number,
  iv: number,
  ev: number,
  level: number,
  natureName: string
): number {
  if (stat === 'hp') return computeHp(base, iv, ev, level);
  return computeOtherStat(base, iv, ev, level, natureName, stat);
}

// Battle stat stage multiplier, -6 to +6 (Gen 3+ standard, still what Gen 5
// — and therefore PokeMMO — uses): stage>=0 is (2+n)/2, stage<0 is 2/(2-n).
export function stageMultiplier(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

export function applyStage(stat: number, stage: number): number {
  return Math.floor(stat * stageMultiplier(stage));
}
