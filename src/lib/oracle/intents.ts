import { findAbility, findMove, findPokemon, findType, findTypes, normalize } from './entities';
import { findItemLocations, type ItemLocation } from './items';
import { t } from '@/i18n';
import { getReferenceGuide, getTmsHmsGuide, type FindingEveryMoveGuide } from '@/lib/guides';
import { getLearners, getRecommendedLearners } from '@/lib/moveLearners';
import {
  getAbilityDescription,
  getEvolvesFrom,
  getEvolvesInto,
  getLocations,
  getMoveData,
  getPokemonWithAbility,
  localizedAbilityName,
  localizedEncounterValue,
  localizedMoveName,
} from '@/lib/pokedex';
import { getEffectivenessFor, getEffectivenessForCombo, type ComboEffectiveness, type Effectiveness, type PokeType } from '@/lib/typeChart';
import type { AppLocale } from '@/store/localeStore';
import type { LocationEntry, PokemonEntry, PvpTier } from '@/types/pokemon';

export type OracleAnswer = { text: string; images?: string[] };

const pokemonName = (p: PokemonEntry, locale: AppLocale) => (locale === 'es' ? p.name.es : p.name.en);

const TUTOR_REGION_LABEL: Record<'kanto' | 'hoenn' | 'sinnoh' | 'unova', Record<AppLocale, string>> = {
  kanto: { es: 'Kanto', en: 'Kanto' },
  hoenn: { es: 'Hoenn', en: 'Hoenn' },
  sinnoh: { es: 'Sinnoh', en: 'Sinnoh' },
  unova: { es: 'Teselia', en: 'Unova' },
};

function formatWildLocations(locations: LocationEntry[], locale: AppLocale): string {
  return locations
    .map((l) => {
      const time =
        l.timeOfDay.length > 0
          ? ` (${l.timeOfDay.map((tod) => localizedEncounterValue('timeOfDay', tod, locale)).join('/')})`
          : '';
      return t('oracle.answers.wildLocationLine', {
        location: l.location,
        locationType: localizedEncounterValue('locationType', l.locationType, locale),
        levels: l.levels,
        rate: localizedEncounterValue('rate', l.rate, locale),
        time,
        locale,
      });
    })
    .join('\n');
}

function answerPokemonLocation(pokemon: PokemonEntry, locale: AppLocale): OracleAnswer {
  const locations = getLocations(pokemon);
  const name = pokemonName(pokemon, locale);
  if (locations.length === 0) {
    const from = getEvolvesFrom(pokemon);
    if (from) {
      return { text: t('oracle.answers.notWildFromEvolution', { name, from: pokemonName(from, locale), locale }) };
    }
    return { text: t('oracle.answers.notWildUnknown', { name, locale }) };
  }
  const header = t('oracle.answers.wildLocationsHeader', { name, id: pokemon.id, locale });
  return { text: `${header}\n${formatWildLocations(locations, locale)}` };
}

function answerTmHmTutor(moveNameEn: string, locale: AppLocale): OracleAnswer | null {
  const lines: string[] = [];
  const guide = getReferenceGuide('finding-every-move') as FindingEveryMoveGuide | null;
  const displayName = localizedMoveName(moveNameEn, locale);
  const target = moveNameEn.toLowerCase();

  const marketRow = guide?.tmMarketLocations.find((r) => r.move.toLowerCase() === target);
  if (marketRow) {
    lines.push(t('oracle.answers.tmMarket', { price: marketRow.price, locations: marketRow.locations.join(', '), locale }));
  }

  for (const region of ['kanto', 'hoenn', 'sinnoh'] as const) {
    const tmsHms = getTmsHmsGuide(region);
    if (!tmsHms) continue;
    const regionLabel = TUTOR_REGION_LABEL[region][locale];
    const tm = tmsHms.tms.find((x) => x.name.toLowerCase() === target);
    if (tm) lines.push(t('oracle.answers.tmInRegion', { tm: tm.tm, region: regionLabel, locations: tm.locations.join(', '), locale }));
    const hm = tmsHms.hms.find((x) => x.name.toLowerCase() === target);
    if (hm) lines.push(t('oracle.answers.hmInRegion', { region: regionLabel, location: hm.location, locale }));
  }

  if (guide) {
    for (const region of ['kanto', 'hoenn', 'sinnoh', 'unova'] as const) {
      const tutor = guide.moveTutorsByRegion[region]?.find((x) => x.move.toLowerCase() === target);
      if (tutor) {
        lines.push(
          t('oracle.answers.tutorInRegion', { region: TUTOR_REGION_LABEL[region][locale], cost: tutor.cost, description: tutor.description, locale })
        );
      }
    }
  }

  if (lines.length === 0) return null;
  return { text: `${displayName}:\n${lines.join('\n')}` };
}

function answerAbilityHolders(abilityNameEn: string, locale: AppLocale): OracleAnswer {
  const mons = getPokemonWithAbility(abilityNameEn);
  const displayAbility = localizedAbilityName(abilityNameEn, locale);
  if (mons.length === 0) {
    return { text: t('oracle.answers.noAbilityHolders', { ability: displayAbility, locale }) };
  }
  const names = mons.map((p) => pokemonName(p, locale)).join(', ');
  return { text: t('oracle.answers.abilityHolders', { ability: displayAbility, names, locale }) };
}

// Reuses the same badge labels the Pokedex screen shows for a tier
// (pokedex.tierUber/Ou/Uu/Nu) — a tier name is the same word everywhere in
// the app, no need for a separate oracle-only translation.
const TIER_LABEL_KEYS: Record<PvpTier, string> = {
  uber: 'pokedex.tierUber',
  ou: 'pokedex.tierOu',
  uu: 'pokedex.tierUu',
  nu: 'pokedex.tierNu',
};

// "Who learns X" — mirrors the Pokedex move-detail modal's "Quién lo
// aprende" section (src/lib/moveLearners.ts): a plain reverse lookup for
// every move, plus a heuristic top-5 (STAB + raw offensive stat, tier shown
// but never used to sort) for damage-dealing moves only. Status moves get
// the honest "no recommendations" notice instead of a fabricated ranking —
// same rule as the UI, see REGLA DE ORO in CLAUDE.md.
function answerMoveLearners(moveNameEn: string, locale: AppLocale): OracleAnswer {
  const displayName = localizedMoveName(moveNameEn, locale);
  const learners = getLearners(moveNameEn);
  if (learners.length === 0) {
    return { text: t('oracle.answers.moveLearnersNone', { move: displayName, locale }) };
  }

  const header = t('oracle.answers.moveLearnersHeader', { move: displayName, count: learners.length, locale });
  const recommended = getRecommendedLearners(moveNameEn);
  if (recommended === null) {
    return { text: `${header}\n${t('oracle.answers.moveLearnersStatusNotice', { locale })}` };
  }

  const move = getMoveData(moveNameEn);
  const attackKey = move?.category === 'physical' ? 'oracle.answers.moveLearnersAtk' : 'oracle.answers.moveLearnersSpA';
  const lines = recommended.slice(0, 5).map((rec, index) => {
    const parts: string[] = [];
    if (rec.reasons.hasStab) parts.push(t('oracle.answers.moveLearnersStab', { locale }));
    parts.push(t(attackKey, { value: rec.reasons.attackStat, locale }));
    if (rec.reasons.tier) parts.push(t(TIER_LABEL_KEYS[rec.reasons.tier], { locale }));
    return t('oracle.answers.moveLearnersRecommendedLine', {
      index: index + 1,
      name: pokemonName(rec.pokemon, locale),
      reasons: parts.join(' · '),
      locale,
    });
  });

  return {
    text: [header, t('oracle.answers.moveLearnersRecommendedHeader', { locale }), ...lines].join('\n'),
  };
}

function formatSingleEffectiveness(typeLabel: string, eff: Effectiveness, locale: AppLocale): OracleAnswer {
  const parts: string[] = [];
  if (eff.superEffective.length) {
    parts.push(t('oracle.answers.superEffective', { types: eff.superEffective.map((tp) => t(`types.${tp}`)).join(', '), locale }));
  }
  if (eff.notVeryEffective.length) {
    parts.push(t('oracle.answers.notVeryEffective', { types: eff.notVeryEffective.map((tp) => t(`types.${tp}`)).join(', '), locale }));
  }
  if (eff.noEffect.length) {
    parts.push(t('oracle.answers.noEffect', { types: eff.noEffect.map((tp) => t(`types.${tp}`)).join(', '), locale }));
  }
  const header = t('oracle.answers.attacksOfType', { type: typeLabel, locale });
  return { text: `${header}\n${parts.join('\n')}` };
}

function formatComboEffectiveness(typeLabel: string, eff: ComboEffectiveness, locale: AppLocale): OracleAnswer {
  const parts: string[] = [];
  if (eff.x4.length) parts.push(t('oracle.answers.weak4x', { types: eff.x4.map((tp) => t(`types.${tp}`)).join(', '), locale }));
  if (eff.x2.length) parts.push(t('oracle.answers.weak2x', { types: eff.x2.map((tp) => t(`types.${tp}`)).join(', '), locale }));
  if (eff.x05.length) parts.push(t('oracle.answers.resist05x', { types: eff.x05.map((tp) => t(`types.${tp}`)).join(', '), locale }));
  if (eff.x025.length) parts.push(t('oracle.answers.resist025x', { types: eff.x025.map((tp) => t(`types.${tp}`)).join(', '), locale }));
  if (eff.x0.length) parts.push(t('oracle.answers.immuneTo', { types: eff.x0.map((tp) => t(`types.${tp}`)).join(', '), locale }));
  if (parts.length === 0) parts.push(t('oracle.answers.noWeaknessesOrResistances', { locale }));
  const header = t('oracle.answers.typeLabel', { type: typeLabel, locale });
  return { text: `${header}\n${parts.join('\n')}` };
}

function formatItemAnswer(items: ItemLocation[], locale: AppLocale): OracleAnswer {
  const hiddenSuffix = t('oracle.answers.hiddenSuffix', { locale });
  const lines = items.map((i) => `• ${i.displayName}${i.hidden ? hiddenSuffix : ''} — ${i.regionName}, ${i.location}`);
  const images = items.map((i) => i.image).filter((img): img is string => !!img);
  return { text: lines.join('\n'), images: images.length > 0 ? images : undefined };
}

function generalPokemonSummary(pokemon: PokemonEntry, locale: AppLocale): OracleAnswer {
  const name = pokemonName(pokemon, locale);
  const types = pokemon.types.map((tp) => t(`types.${tp}`)).join(' / ');
  const from = getEvolvesFrom(pokemon);
  const into = getEvolvesInto(pokemon);
  const lines = [t('oracle.answers.typeSummary', { name, id: pokemon.id, types, locale })];
  if (from) lines.push(t('oracle.answers.evolvesFrom', { name: pokemonName(from, locale), locale }));
  if (into.length > 0) lines.push(t('oracle.answers.evolvesTo', { names: into.map((p) => pokemonName(p, locale)).join(', '), locale }));
  lines.push(t('oracle.answers.canAskMore', { locale }));
  return { text: lines.join('\n') };
}

// Trigger words are matched bilingually (ES+EN) since these regexes gate
// intent detection on the normalized query regardless of the app's current
// locale — a query typed in English must match just as well as one in
// Spanish (this app has no monolingual mode).
const RE_LOCATION = /\b(donde|encuentro|encontrar|conseguir|consigo|capturar|atrapar|comprar|where|find|catch|get|buy)\b/;
const RE_TM_HM = /\b(mt|ct|tm|hm|mo|maquina|machine)\b/;
const RE_EFFECT = /\b(que hace|efecto de|para que sirve|what does|effect of|what is .* for)\b/;
const RE_ABILITY_HOLDERS = /\b(que pokemon|quien tiene|pokemon con|which pokemon|who has|pokemon with)\b.*\b(habilidad|ability)\b/;
const RE_MOVE_LEARNERS =
  /\b(quien aprende|quien puede aprender|que pokemon aprende|que pokemon aprenden|que pokemon pueden aprender|which pokemon learn|which pokemon can learn|what pokemon learn|who learns)\b/;
const RE_STATS = /\b(stats|estadisticas)\b/;
const RE_TYPE_OF = /\b(tipo|type)\b/;
const RE_EVOLUTION = /\bevol/;
const RE_EFFECTIVENESS = /\b(efectividad|debil|debilidad|debilidades|resiste|resistencia|resistencias|effective|weak|weakness|weaknesses|resist|resistance|resistances)\b/;

export function answerQuery(rawQuery: string, locale: AppLocale): OracleAnswer {
  const query = normalize(rawQuery);
  if (!query) return { text: t('oracle.emptyQuery') };

  // 1. TM/HM/tutor location for a move
  if (RE_LOCATION.test(query) && RE_TM_HM.test(query)) {
    const move = findMove(query);
    if (move) {
      const answer = answerTmHmTutor(move, locale);
      if (answer) return answer;
    }
  }

  // 2. Reverse ability lookup ("qué Pokémon tienen Levitación")
  if (RE_ABILITY_HOLDERS.test(query)) {
    const ability = findAbility(query);
    if (ability) return answerAbilityHolders(ability, locale);
  }

  // 3. Reverse move lookup ("quién aprende Terremoto" / "who learns Earthquake")
  if (RE_MOVE_LEARNERS.test(query)) {
    const move = findMove(query);
    if (move) return answerMoveLearners(move, locale);
  }

  // 4. Move / ability effect text
  if (RE_EFFECT.test(query)) {
    const move = findMove(query);
    if (move) {
      const data = getMoveData(move);
      if (data) return { text: `${localizedMoveName(move, locale)} (${t(`types.${data.type as PokeType}`)}, ${data.category}): ${data.effect}` };
    }
    const ability = findAbility(query);
    if (ability) {
      const data = getAbilityDescription(ability);
      if (data) return { text: `${localizedAbilityName(ability, locale)}: ${data.effect}` };
    }
  }

  // 5. Weaknesses/resistances of a specific Pokemon's own typing
  if (RE_EFFECTIVENESS.test(query)) {
    const pokemon = findPokemon(query);
    if (pokemon) {
      return formatComboEffectiveness(pokemonName(pokemon, locale), getEffectivenessForCombo(pokemon.types as PokeType[]), locale);
    }
    const types = findTypes(query, 2);
    if (types.length === 2) {
      return formatComboEffectiveness(types.map((tp) => t(`types.${tp}`)).join('/'), getEffectivenessForCombo(types), locale);
    }
    if (types.length === 1) {
      return formatSingleEffectiveness(t(`types.${types[0]}`), getEffectivenessFor(types[0]), locale);
    }
  }

  // 6. Direct type-effectiveness question without "efectividad"/"debilidad" wording
  if (RE_TYPE_OF.test(query) && !RE_EVOLUTION.test(query) && !findPokemon(query)) {
    const type = findType(query);
    if (type) return formatSingleEffectiveness(t(`types.${type}`), getEffectivenessFor(type), locale);
  }

  // 7. Anything else needs a Pokemon to be named
  const pokemon = findPokemon(query);
  if (pokemon) {
    if (RE_EVOLUTION.test(query)) return { text: generalPokemonSummary(pokemon, locale).text };
    if (RE_TYPE_OF.test(query) || RE_STATS.test(query)) {
      const name = pokemonName(pokemon, locale);
      const types = pokemon.types.map((tp) => t(`types.${tp}`)).join(' / ');
      const s = pokemon.baseStats;
      return {
        text: t('oracle.answers.statsLine', {
          name,
          types,
          hp: s.hp,
          attack: s.attack,
          defense: s.defense,
          spAttack: s.spAttack,
          spDefense: s.spDefense,
          speed: s.speed,
          locale,
        }),
      };
    }
    if (RE_LOCATION.test(query)) return answerPokemonLocation(pokemon, locale);
    return generalPokemonSummary(pokemon, locale);
  }

  // 8. Item location (including hidden items with their saved screenshot)
  if (RE_LOCATION.test(query)) {
    const items = findItemLocations(query, locale);
    if (items.length > 0) return formatItemAnswer(items, locale);
  }

  return { text: t('oracle.noMatch') };
}
