import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { computeBreedingOutcome, emptyParent, STAT_KEYS, type ParentInput, type StatKey } from '@/lib/breeding';
import { computeMultiGenPlan } from '@/lib/breedingPlanner';
import type { BreedingGuide } from '@/lib/guides';
import colors from '@/theme/colors';

const breedingGuideData = require('../../data/guides/breeding.json') as BreedingGuide;

function getPlannerCost(count: number, natured: boolean): string | null {
  const label = `${count}x31${natured ? ' (con naturaleza)' : ''}`;
  return breedingGuideData.costTable.rows.find((r) => r.target === label)?.cost ?? null;
}

const STAT_LABEL_KEYS: Record<StatKey, string> = {
  hp: 'pokedex.hp',
  attack: 'pokedex.attack',
  defense: 'pokedex.defense',
  spAttack: 'pokedex.spAttack',
  spDefense: 'pokedex.spDefense',
  speed: 'pokedex.speed',
};

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressScale
      haptic="select"
      scaleTo={0.94}
      onPress={onPress}
      className="mb-2 mr-2 rounded-full border px-3 py-1.5"
      style={{
        borderColor: selected ? colors.pokeRed.DEFAULT : colors.ink[600],
        backgroundColor: selected ? `${colors.pokeRed.DEFAULT}26` : colors.ink[800],
      }}
    >
      <Text className="text-xs font-semibold" style={{ color: selected ? colors.pokeRed.DEFAULT : colors.ink[300] }}>
        {label}
      </Text>
    </PressScale>
  );
}

function ParentCard({
  label,
  parent,
  onChange,
}: {
  label: string;
  parent: ParentInput;
  onChange: (next: ParentInput) => void;
}) {
  const setIv = (stat: StatKey, raw: string) => {
    const parsed = Math.max(0, Math.min(31, Number(raw.replace(/[^0-9]/g, '')) || 0));
    onChange({ ...parent, ivs: { ...parent.ivs, [stat]: parsed } });
  };

  return (
    <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
      <Text className="mb-3 text-sm font-bold text-ink-100">{label}</Text>

      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('breeding.ivsLabel')}</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {STAT_KEYS.map((stat) => (
          <View key={stat} className="w-[30%]">
            <Text className="mb-1 text-[10px] text-ink-400">{t(STAT_LABEL_KEYS[stat])}</Text>
            <TextInput
              value={String(parent.ivs[stat])}
              onChangeText={(v) => setIv(stat, v)}
              keyboardType="number-pad"
              maxLength={2}
              className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-center text-sm text-ink-100"
            />
          </View>
        ))}
      </View>

      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('breeding.braceLabel')}</Text>
      <View className="mb-3 flex-row flex-wrap">
        <Chip
          label={t('breeding.braceNone')}
          selected={parent.bracedStat === null}
          onPress={() => onChange({ ...parent, bracedStat: null })}
        />
        {STAT_KEYS.map((stat) => (
          <Chip
            key={stat}
            label={t(STAT_LABEL_KEYS[stat])}
            selected={parent.bracedStat === stat}
            onPress={() => onChange({ ...parent, bracedStat: stat, hasEverstone: false })}
          />
        ))}
      </View>

      <PressScale
        haptic="select"
        scaleTo={0.98}
        onPress={() => onChange({ ...parent, hasEverstone: !parent.hasEverstone, bracedStat: parent.hasEverstone ? parent.bracedStat : null })}
        className="flex-row items-center gap-2 rounded-lg border px-3 py-2"
        style={{
          borderColor: parent.hasEverstone ? colors.pokeRed.DEFAULT : colors.ink[600],
          backgroundColor: parent.hasEverstone ? `${colors.pokeRed.DEFAULT}26` : colors.ink[900],
        }}
      >
        <Text className="text-xs font-semibold" style={{ color: parent.hasEverstone ? colors.pokeRed.DEFAULT : colors.ink[300] }}>
          {parent.hasEverstone ? '☑' : '☐'} {t('breeding.everstoneLabel')}
        </Text>
      </PressScale>
    </View>
  );
}

function PlannerView() {
  const [selectedStats, setSelectedStats] = useState<StatKey[]>(['hp', 'attack', 'defense', 'spAttack', 'spDefense']);
  const [natured, setNatured] = useState(false);

  const toggleStat = (stat: StatKey) => {
    setSelectedStats((prev) => (prev.includes(stat) ? prev.filter((s) => s !== stat) : [...prev, stat]));
  };

  const plan = useMemo(() => computeMultiGenPlan(selectedStats), [selectedStats]);
  const cost = plan ? getPlannerCost(plan.targetStats.length, natured) : null;

  return (
    <>
      <Text className="mb-3 text-sm text-ink-300">{t('breeding.plannerSubtitle')}</Text>

      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('breeding.plannerSelectStats')}</Text>
      <View className="mb-3 flex-row flex-wrap">
        {STAT_KEYS.map((stat) => (
          <Chip key={stat} label={t(STAT_LABEL_KEYS[stat])} selected={selectedStats.includes(stat)} onPress={() => toggleStat(stat)} />
        ))}
      </View>

      <PressScale
        haptic="select"
        scaleTo={0.98}
        onPress={() => setNatured(!natured)}
        className="mb-4 flex-row items-center gap-2 rounded-xl border px-3 py-2.5 self-start"
        style={{
          borderColor: natured ? colors.pokeRed.DEFAULT : colors.ink[600],
          backgroundColor: natured ? `${colors.pokeRed.DEFAULT}26` : colors.ink[800],
        }}
      >
        <Text className="text-sm font-semibold" style={{ color: natured ? colors.pokeRed.DEFAULT : colors.ink[300] }}>
          {natured ? '☑' : '☐'} {t('breeding.plannerNature')}
        </Text>
      </PressScale>

      {!plan && (
        <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-3">
          <Text className="text-sm text-ink-300">{t('breeding.plannerMinStats')}</Text>
        </View>
      )}

      {plan && (
        <>
          <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm text-ink-300">{t('breeding.plannerCost')}</Text>
              <Text className="text-base font-bold text-pokeRed">{cost ?? '—'}</Text>
            </View>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm text-ink-300">{t('breeding.plannerBaseParents')}</Text>
              <Text className="text-sm font-semibold text-ink-100">{plan.totalBaseParents}</Text>
            </View>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm text-ink-300">{t('breeding.plannerCrosses')}</Text>
              <Text className="text-sm font-semibold text-ink-100">{plan.totalCrosses}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-ink-300">{t('breeding.plannerBraces')}</Text>
              <Text className="text-sm font-semibold text-ink-100">{plan.totalBraces}</Text>
            </View>
          </View>

          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('breeding.plannerBaseByStat')}</Text>
          <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-3">
            {plan.baseParentsByStat.map((row, i) => (
              <View key={row.stat} className={`flex-row items-center justify-between ${i > 0 ? 'mt-1.5' : ''}`}>
                <Text className="text-sm text-ink-300">{t(STAT_LABEL_KEYS[row.stat])}</Text>
                <Text className="text-sm font-semibold text-ink-100">{row.count}x 1x31</Text>
              </View>
            ))}
          </View>

          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('breeding.plannerStepsTitle')}</Text>
          {plan.stepsByLevel.map((levelGroup) => (
            <View key={levelGroup.level} className="mb-3 rounded-xl border border-ink-600 bg-ink-800 p-3">
              <Text className="mb-2 text-sm font-bold text-ink-100">
                {levelGroup.steps.length === 1
                  ? t('breeding.plannerLevelTitleSingular', { level: levelGroup.level })
                  : t('breeding.plannerLevelTitle', { level: levelGroup.level, count: levelGroup.steps.length })}
              </Text>
              <View className="gap-2">
                {levelGroup.steps.map((step, i) => (
                  <Text key={i} className="text-xs leading-5 text-ink-300">
                    {step.leftStats.map((s) => t(STAT_LABEL_KEYS[s])).join('+')}
                    {' × '}
                    {step.rightStats.map((s) => t(STAT_LABEL_KEYS[s])).join('+')}
                    {' → '}
                    <Text className="font-semibold text-ink-100">{step.resultStats.map((s) => t(STAT_LABEL_KEYS[s])).join('+')}</Text>
                    {'  ('}
                    {t('breeding.plannerBraceOn')}: {t(STAT_LABEL_KEYS[step.bracedStats[0]])} + {t(STAT_LABEL_KEYS[step.bracedStats[1]])})
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </>
      )}
    </>
  );
}

export default function BreedingCalculator() {
  const [mode, setMode] = useState<'single' | 'planner'>('single');
  const [parentA, setParentA] = useState<ParentInput>(emptyParent());
  const [parentB, setParentB] = useState<ParentInput>(emptyParent());
  const [shiny, setShiny] = useState(false);

  const result = useMemo(() => computeBreedingOutcome(parentA, parentB, shiny), [parentA, parentB, shiny]);

  return (
    <Screen>
      <Header title={t('breeding.title')} />

      <Link href="/guia/referencia/breeding" asChild>
        <Button variant="secondary" className="mb-4">
          {t('guide.topics.breeding')}
        </Button>
      </Link>

      <View className="mb-4 flex-row rounded-xl border border-ink-600 bg-ink-800 p-1">
        <PressScale haptic="select" scaleTo={0.98} onPress={() => setMode('single')} className="flex-1 rounded-lg py-2" style={{ backgroundColor: mode === 'single' ? colors.pokeRed.DEFAULT : 'transparent' }}>
          <Text className="text-center text-xs font-bold" style={{ color: mode === 'single' ? '#fff' : colors.ink[300] }}>
            {t('breeding.singleTab')}
          </Text>
        </PressScale>
        <PressScale haptic="select" scaleTo={0.98} onPress={() => setMode('planner')} className="flex-1 rounded-lg py-2" style={{ backgroundColor: mode === 'planner' ? colors.pokeRed.DEFAULT : 'transparent' }}>
          <Text className="text-center text-xs font-bold" style={{ color: mode === 'planner' ? '#fff' : colors.ink[300] }}>
            {t('breeding.plannerTab')}
          </Text>
        </PressScale>
      </View>

      {mode === 'planner' && <PlannerView />}

      {mode === 'single' && (
      <>
      <Text className="mb-3 text-sm text-ink-300">{t('breeding.subtitle')}</Text>

      <ParentCard label={t('breeding.parentA')} parent={parentA} onChange={setParentA} />
      <ParentCard label={t('breeding.parentB')} parent={parentB} onChange={setParentB} />

      <PressScale
        haptic="select"
        scaleTo={0.98}
        onPress={() => setShiny(!shiny)}
        className="mb-4 flex-row items-center gap-2 rounded-xl border px-3 py-2.5"
        style={{
          borderColor: shiny ? colors.pokeRed.DEFAULT : colors.ink[600],
          backgroundColor: shiny ? `${colors.pokeRed.DEFAULT}26` : colors.ink[800],
        }}
      >
        <Text className="text-sm font-semibold" style={{ color: shiny ? colors.pokeRed.DEFAULT : colors.ink[300] }}>
          {shiny ? '☑' : '☐'} {t('breeding.shinyToggle')}
        </Text>
      </PressScale>

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('breeding.natureTitle')}</Text>
      <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-3">
        <Text className="text-sm text-ink-200">
          {result.natureFromParent === 'A'
            ? t('breeding.natureFromA')
            : result.natureFromParent === 'B'
              ? t('breeding.natureFromB')
              : t('breeding.natureRandom')}
        </Text>
      </View>

      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('breeding.resultsTitle')}</Text>
      <Text className="mb-3 text-xs text-ink-500">
        {t('breeding.extraSlotsNote', {
          inherit: result.extraRandomInheritSlots,
          best: result.extraBestOfBothSlots > 0 ? t('breeding.extraBestOfBoth', { count: result.extraBestOfBothSlots }) : '',
        })}
      </Text>

      <View className="mb-6">
        {result.perStat.map((outcome) => (
          <View key={outcome.stat} className="mb-2 rounded-xl border border-ink-600 bg-ink-800 p-3">
            <Text className="mb-1.5 text-sm font-semibold text-ink-100">{t(STAT_LABEL_KEYS[outcome.stat])}</Text>
            {outcome.guaranteed ? (
              <Text className="text-sm font-bold text-pokeRed">
                {t('breeding.guaranteedFrom', { parent: outcome.guaranteed.fromParent })}: {outcome.guaranteed.value}
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                <Text className="text-xs text-ink-300">
                  {t('breeding.inheritALabel')}: <Text className="font-semibold text-ink-100">{outcome.inheritFromA}</Text>
                </Text>
                <Text className="text-xs text-ink-300">
                  {t('breeding.inheritBLabel')}: <Text className="font-semibold text-ink-100">{outcome.inheritFromB}</Text>
                </Text>
                {shiny && (
                  <Text className="text-xs text-ink-300">
                    {t('breeding.bestOfBothLabel')}: <Text className="font-semibold text-ink-100">{outcome.bestOfBoth}</Text>
                  </Text>
                )}
                <Text className="text-xs text-ink-300">
                  {t('breeding.averagedLabel')}: <Text className="font-semibold text-ink-100">{outcome.averagedValue}</Text>
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
      </>
      )}
    </Screen>
  );
}
