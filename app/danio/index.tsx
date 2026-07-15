import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { BoxPickerModal } from '@/components/BoxPickerModal';
import { Header } from '@/components/Header';
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { computeDamageRange } from '@/lib/damageCalc';
import { t } from '@/i18n';
import { getMoveData, getMoveset, localizedMoveName, searchPokemon } from '@/lib/pokedex';
import { localizedNatureName, NATURES } from '@/lib/showdown';
import { applyStage, computeHp, computeStat } from '@/lib/stats';
import { getMultiplier, type PokeType } from '@/lib/typeChart';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';
import type { PokemonEntry } from '@/types/pokemon';
import type { StatKey } from '@/lib/breeding';
import type { BoxBuild } from '@/store/boxStore';

/** The subset of a box build's per-stat maps this screen actually preloads (nature/moves are applied directly, level isn't stored on a build at all). */
type BoxStatSource = { ivs: Record<StatKey, number>; evs: Record<StatKey, number> };

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

function PokemonPicker({ label, value, onSelect }: { label: string; value: PokemonEntry | null; onSelect: (p: PokemonEntry) => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? searchPokemon(query).slice(0, 6) : []), [query]);

  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</Text>
      {value && (
        <View className="mb-2 flex-row items-center gap-2 rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5">
          <PokemonSprite id={value.id} types={value.types} size={28} />
          <Text className="text-sm font-semibold text-ink-100">{value.name.es}</Text>
        </View>
      )}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholderTextColor={colors.ink[400]}
        className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100"
      />
      {results.length > 0 && (
        <View className="mt-2">
          {results.map((p) => (
            <PressScale
              key={p.id}
              haptic="select"
              scaleTo={0.98}
              onPress={() => {
                onSelect(p);
                setQuery('');
              }}
              className="mb-1.5 flex-row items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 p-1.5"
            >
              <PokemonSprite id={p.id} types={p.types} size={28} />
              <Text className="text-sm text-ink-100">{p.name.es}</Text>
            </PressScale>
          ))}
        </View>
      )}
    </View>
  );
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  return (
    <View className="w-[31%]">
      <Text className="mb-1 text-[10px] text-ink-400">{label}</Text>
      <TextInput
        value={String(value)}
        onChangeText={(v) => onChange(Math.max(0, Math.min(max, Number(v.replace(/[^0-9]/g, '')) || 0)))}
        keyboardType="number-pad"
        maxLength={3}
        className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-center text-sm text-ink-100"
      />
    </View>
  );
}

function StageStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-xs text-ink-400">{label}</Text>
      <View className="flex-row items-center gap-3">
        <PressScale haptic="select" scaleTo={0.9} onPress={() => onChange(Math.max(-6, value - 1))} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full bg-ink-700">
          <Ionicons name="remove" size={14} color={colors.ink[100]} />
        </PressScale>
        <Text className="w-8 text-center text-sm font-bold text-ink-100">{value > 0 ? `+${value}` : value}</Text>
        <PressScale haptic="select" scaleTo={0.9} onPress={() => onChange(Math.min(6, value + 1))} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full bg-pokeRed">
          <Ionicons name="add" size={14} color="white" />
        </PressScale>
      </View>
    </View>
  );
}

export default function DamageCalculator() {
  const locale = useLocaleStore((s) => s.locale);

  const [attacker, setAttacker] = useState<PokemonEntry | null>(null);
  const [attackerLevel, setAttackerLevel] = useState(50);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const [attackerNature, setAttackerNature] = useState('Hardy');
  const [attackerEv, setAttackerEv] = useState(0);
  const [attackerIv, setAttackerIv] = useState(31);
  const [attackerStage, setAttackerStage] = useState(0);
  const [attackerBurned, setAttackerBurned] = useState(false);
  // Set only when the attacker was preloaded from Mi caja — restricts the
  // move chips below to that build's own (up to 4) moves instead of the full
  // movepool, and lets the IV/EV effect below keep them in sync with
  // whichever move (attack vs. special attack stat) is currently selected.
  const [attackerBoxStats, setAttackerBoxStats] = useState<BoxStatSource | null>(null);
  const [attackerBoxMoves, setAttackerBoxMoves] = useState<string[] | null>(null);
  const [attackerPickerOpen, setAttackerPickerOpen] = useState(false);

  const [defender, setDefender] = useState<PokemonEntry | null>(null);
  const [defenderLevel, setDefenderLevel] = useState(50);
  const [defenderNature, setDefenderNature] = useState('Hardy');
  const [defenderEv, setDefenderEv] = useState(0);
  const [defenderIv, setDefenderIv] = useState(31);
  const [defenderStage, setDefenderStage] = useState(0);
  const [defenderHpEv, setDefenderHpEv] = useState(0);
  const [defenderHpIv, setDefenderHpIv] = useState(31);
  const [defenderBoxStats, setDefenderBoxStats] = useState<BoxStatSource | null>(null);
  const [defenderPickerOpen, setDefenderPickerOpen] = useState(false);

  const [isCritical, setIsCritical] = useState(false);
  const [otherModifier, setOtherModifier] = useState(1);

  const availableMoves = useMemo(() => {
    if (!attacker) return [];
    const names = attackerBoxMoves ?? Array.from(new Set((getMoveset(attacker)?.moves ?? []).map((m) => m.name)));
    return names.filter((name) => getMoveData(name)?.category !== 'status');
  }, [attacker, attackerBoxMoves]);

  const moveData = selectedMove ? getMoveData(selectedMove) : null;
  const statKey: StatKey = moveData?.category === 'special' ? 'spAttack' : 'attack';
  const defStatKey: StatKey = moveData?.category === 'special' ? 'spDefense' : 'defense';

  // Mi caja builds store all 6 IVs/EVs, but this screen only ever tracks the
  // single stat relevant to the currently selected move — so whenever a box
  // build is loaded (or the user picks a different move, changing which stat
  // is relevant), re-derive attacker/defender IV+EV from the build's full
  // map instead of leaving whatever was there before.
  useEffect(() => {
    if (!attackerBoxStats) return;
    setAttackerIv(attackerBoxStats.ivs[statKey]);
    setAttackerEv(attackerBoxStats.evs[statKey]);
  }, [statKey, attackerBoxStats]);
  useEffect(() => {
    if (!defenderBoxStats) return;
    setDefenderIv(defenderBoxStats.ivs[defStatKey]);
    setDefenderEv(defenderBoxStats.evs[defStatKey]);
  }, [defStatKey, defenderBoxStats]);

  function handleSelectAttackerBuild(build: BoxBuild, pokemon: PokemonEntry) {
    setAttacker(pokemon);
    setAttackerNature(build.nature);
    setAttackerBoxStats({ ivs: build.ivs, evs: build.evs });
    setAttackerBoxMoves(build.moves.length > 0 ? build.moves : null);
    setSelectedMove(build.moves[0] ?? null);
    setAttackerPickerOpen(false);
  }
  function handleSelectDefenderBuild(build: BoxBuild, pokemon: PokemonEntry) {
    setDefender(pokemon);
    setDefenderNature(build.nature);
    setDefenderBoxStats({ ivs: build.ivs, evs: build.evs });
    setDefenderHpIv(build.ivs.hp);
    setDefenderHpEv(build.evs.hp);
    setDefenderPickerOpen(false);
  }

  const attackStat =
    attacker && moveData
      ? applyStage(computeStat(statKey, attacker.baseStats[statKey], attackerIv, attackerEv, attackerLevel, attackerNature), attackerStage)
      : 0;
  const defenseStat =
    defender && moveData
      ? applyStage(computeStat(defStatKey, defender.baseStats[defStatKey], defenderIv, defenderEv, defenderLevel, defenderNature), defenderStage)
      : 0;
  const defenderMaxHp = defender ? computeHp(defender.baseStats.hp, defenderHpIv, defenderHpEv, defenderLevel) : 0;

  const isStab = attacker && moveData ? (attacker.types as PokeType[]).includes(moveData.type as PokeType) : false;
  const typeEffectiveness = defender && moveData ? getMultiplier(moveData.type as PokeType, defender.types as PokeType[]) : 1;
  const canBurn = moveData?.category === 'physical';

  const result =
    attacker && defender && moveData
      ? computeDamageRange({
          attackerLevel,
          movePower: moveData.power ?? 0,
          attackStat,
          defenseStat,
          isCritical,
          isStab,
          typeEffectiveness,
          isBurned: canBurn && attackerBurned,
          otherModifier,
        })
      : null;

  const percentMin = result && defenderMaxHp ? Math.floor((result.min / defenderMaxHp) * 100) : 0;
  const percentMax = result && defenderMaxHp ? Math.ceil((result.max / defenderMaxHp) * 100) : 0;

  return (
    <Screen>
      <Header title={t('damage.title')} />
      <Text className="mb-4 text-sm text-ink-300">{t('damage.subtitle')}</Text>

      {/* Attacker */}
      <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
        <Text className="mb-3 text-sm font-bold text-ink-100">{t('damage.attackerTitle')}</Text>
        <PokemonPicker
          label={t('damage.pokemonLabel')}
          value={attacker}
          onSelect={(p) => {
            setAttacker(p);
            setAttackerBoxStats(null);
            setAttackerBoxMoves(null);
            setSelectedMove(null);
          }}
        />
        <PressScale
          haptic="select"
          scaleTo={0.98}
          onPress={() => setAttackerPickerOpen(true)}
          className="mb-3 flex-row items-center justify-center gap-2 rounded-lg border border-gold/40 bg-ink-900 px-3 py-2"
        >
          <Ionicons name="file-tray-full-outline" size={14} color={colors.gold.DEFAULT} />
          <Text className="text-xs font-semibold text-ink-100">{t('damage.fromBoxButton')}</Text>
        </PressScale>

        <NumberField label={t('damage.levelLabel')} value={attackerLevel} onChange={setAttackerLevel} max={100} />

        <Text className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('damage.moveLabel')}</Text>
        {!attacker ? (
          <Text className="text-sm text-ink-400">{t('damage.moveNeedAttacker')}</Text>
        ) : availableMoves.length === 0 ? (
          <Text className="text-sm text-ink-400">{t('damage.moveEmpty')}</Text>
        ) : (
          <View className="flex-row flex-wrap">
            {availableMoves.map((move) => (
              <Chip key={move} label={localizedMoveName(move, locale)} selected={selectedMove === move} onPress={() => setSelectedMove(move)} />
            ))}
          </View>
        )}

        <Text className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('damage.natureLabel')}</Text>
        <View className="flex-row flex-wrap">
          {NATURES.map((n) => (
            <Chip
              key={n.name}
              label={localizedNatureName(n.name, locale)}
              selected={attackerNature === n.name}
              onPress={() => setAttackerNature(n.name)}
            />
          ))}
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          <NumberField label={t('damage.evLabel', { stat: t(STAT_LABEL_KEYS[statKey]) })} value={attackerEv} onChange={setAttackerEv} max={252} />
          <NumberField label={t('damage.ivLabel', { stat: t(STAT_LABEL_KEYS[statKey]) })} value={attackerIv} onChange={setAttackerIv} max={31} />
        </View>

        <View className="mt-2">
          <StageStepper label={t('damage.stageLabel', { stat: t(STAT_LABEL_KEYS[statKey]) })} value={attackerStage} onChange={setAttackerStage} />
        </View>

        {canBurn && (
          <PressScale
            haptic="select"
            scaleTo={0.98}
            onPress={() => setAttackerBurned(!attackerBurned)}
            className="mt-1 flex-row items-center gap-2 rounded-lg border px-3 py-2"
            style={{
              borderColor: attackerBurned ? colors.pokeRed.DEFAULT : colors.ink[600],
              backgroundColor: attackerBurned ? `${colors.pokeRed.DEFAULT}26` : colors.ink[900],
            }}
          >
            <Text className="text-xs font-semibold" style={{ color: attackerBurned ? colors.pokeRed.DEFAULT : colors.ink[300] }}>
              {attackerBurned ? '☑' : '☐'} {t('damage.burnedLabel')}
            </Text>
          </PressScale>
        )}
      </View>

      {/* Defender */}
      <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
        <Text className="mb-3 text-sm font-bold text-ink-100">{t('damage.defenderTitle')}</Text>
        <PokemonPicker
          label={t('damage.pokemonLabel')}
          value={defender}
          onSelect={(p) => {
            setDefender(p);
            setDefenderBoxStats(null);
          }}
        />
        <PressScale
          haptic="select"
          scaleTo={0.98}
          onPress={() => setDefenderPickerOpen(true)}
          className="mb-3 flex-row items-center justify-center gap-2 rounded-lg border border-gold/40 bg-ink-900 px-3 py-2"
        >
          <Ionicons name="file-tray-full-outline" size={14} color={colors.gold.DEFAULT} />
          <Text className="text-xs font-semibold text-ink-100">{t('damage.fromBoxButton')}</Text>
        </PressScale>

        <NumberField label={t('damage.levelLabel')} value={defenderLevel} onChange={setDefenderLevel} max={100} />

        <Text className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('damage.natureLabel')}</Text>
        <View className="flex-row flex-wrap">
          {NATURES.map((n) => (
            <Chip
              key={n.name}
              label={localizedNatureName(n.name, locale)}
              selected={defenderNature === n.name}
              onPress={() => setDefenderNature(n.name)}
            />
          ))}
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          <NumberField label={t('damage.hpEvLabel')} value={defenderHpEv} onChange={setDefenderHpEv} max={252} />
          <NumberField label={t('damage.hpIvLabel')} value={defenderHpIv} onChange={setDefenderHpIv} max={31} />
        </View>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <NumberField
            label={t('damage.evLabel', { stat: t(STAT_LABEL_KEYS[defStatKey]) })}
            value={defenderEv}
            onChange={setDefenderEv}
            max={252}
          />
          <NumberField
            label={t('damage.ivLabel', { stat: t(STAT_LABEL_KEYS[defStatKey]) })}
            value={defenderIv}
            onChange={setDefenderIv}
            max={31}
          />
        </View>

        <View className="mt-2">
          <StageStepper label={t('damage.stageLabel', { stat: t(STAT_LABEL_KEYS[defStatKey]) })} value={defenderStage} onChange={setDefenderStage} />
        </View>
      </View>

      {/* Extra modifiers */}
      <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
        <PressScale
          haptic="select"
          scaleTo={0.98}
          onPress={() => setIsCritical(!isCritical)}
          className="mb-3 flex-row items-center gap-2 rounded-lg border px-3 py-2"
          style={{
            borderColor: isCritical ? colors.pokeRed.DEFAULT : colors.ink[600],
            backgroundColor: isCritical ? `${colors.pokeRed.DEFAULT}26` : colors.ink[900],
          }}
        >
          <Text className="text-xs font-semibold" style={{ color: isCritical ? colors.pokeRed.DEFAULT : colors.ink[300] }}>
            {isCritical ? '☑' : '☐'} {t('damage.criticalLabel')}
          </Text>
        </PressScale>

        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('damage.otherModifierLabel')}</Text>
        <TextInput
          value={String(otherModifier)}
          onChangeText={(v) => setOtherModifier(Math.max(0, Number(v.replace(/[^0-9.]/g, '')) || 0))}
          keyboardType="decimal-pad"
          className="w-24 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-center text-sm text-ink-100"
        />
      </View>

      {/* Result */}
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('damage.resultTitle')}</Text>
      {!result ? (
        <Text className="text-sm text-ink-400">{t('damage.incomplete')}</Text>
      ) : (
        <View className="mb-6 rounded-xl border border-ink-600 bg-ink-800 p-4">
          <Text className="mb-1 text-lg font-bold text-ink-100">{t('damage.resultRange', { min: result.min, max: result.max })}</Text>
          <Text className="mb-3 text-sm text-ink-300">{t('damage.resultPercent', { min: percentMin, max: percentMax })}</Text>
          <View className="flex-row flex-wrap gap-3">
            {isStab && (
              <View className="rounded-full bg-pokeRed/15 px-2.5 py-1">
                <Text className="text-xs font-semibold text-pokeRed">{t('damage.stabDetected')}</Text>
              </View>
            )}
            <View className="rounded-full bg-ink-700 px-2.5 py-1">
              <Text className="text-xs font-semibold text-ink-300">
                {t('damage.effectivenessLabel')}: x{typeEffectiveness}
              </Text>
            </View>
          </View>
        </View>
      )}

      <BoxPickerModal
        visible={attackerPickerOpen}
        onClose={() => setAttackerPickerOpen(false)}
        onSelect={handleSelectAttackerBuild}
      />
      <BoxPickerModal
        visible={defenderPickerOpen}
        onClose={() => setDefenderPickerOpen(false)}
        onSelect={handleSelectDefenderBuild}
      />
    </Screen>
  );
}
