// Gen 5 damage formula — https://bulbapedia.bulbagarden.net/wiki/Damage#Generation_V,
// the generation PokeMMO's battle engine is built on (see REGLA DE ORO in
// CLAUDE.md: the formula itself is a core battle-engine mechanic, not
// something that varies by story region). Verified critical-hit multiplier
// is x2 here — Gen 6+ lowered it to x1.5, an easy generation to mix up.
//
// Scope note (deliberate, not an oversight): this covers the core formula —
// level/power/stats/stage/critical/random roll/STAB/type effectiveness/burn.
// It does NOT model weather, multi-hit moves, spread-move reduction, or
// item/ability-specific modifiers (Life Orb, Choice items, Technician,
// etc.) — those would each need their own PokeMMO-specific verification
// pass. The `otherModifier` param exists so a user who knows their own
// multiplier can still get a correct number without the app pretending to
// know modifiers it hasn't verified.

export type DamageInput = {
  attackerLevel: number;
  movePower: number;
  attackStat: number;
  defenseStat: number;
  isCritical: boolean;
  isStab: boolean;
  /** Combined type-effectiveness multiplier — 0, 0.25, 0.5, 1, 2, or 4. */
  typeEffectiveness: number;
  /** Physical attacker burned (and doesn't have an ability like Guts that ignores/inverts it). */
  isBurned: boolean;
  /** Any additional multiplier not otherwise modeled here (weather, items, abilities...). Defaults to 1 (no effect). */
  otherModifier: number;
};

export type DamageResult = {
  min: number;
  max: number;
};

function baseDamage(level: number, power: number, attack: number, defense: number): number {
  return Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * power * attack) / defense) / 50) + 2;
}

function applyRoll(base: number, input: DamageInput, randomPercent: number): number {
  let dmg = base;
  if (input.isCritical) dmg = Math.floor(dmg * 2);
  dmg = Math.floor((dmg * randomPercent) / 100);
  if (input.isStab) dmg = Math.floor(dmg * 1.5);
  dmg = Math.floor(dmg * input.typeEffectiveness);
  if (input.isBurned) dmg = Math.floor(dmg * 0.5);
  dmg = Math.floor(dmg * input.otherModifier);
  return dmg;
}

export function computeDamageRange(input: DamageInput): DamageResult {
  if (input.movePower <= 0 || input.typeEffectiveness === 0) return { min: 0, max: 0 };
  const base = baseDamage(input.attackerLevel, input.movePower, input.attackStat, input.defenseStat);
  const min = applyRoll(base, input, 85);
  const max = applyRoll(base, input, 100);
  return { min, max };
}
