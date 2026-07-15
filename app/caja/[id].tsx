import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Share, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { STAT_KEYS, type StatKey } from '@/lib/breeding';
import { confirmDestructive } from '@/lib/confirmDialog';
import { EV_CAP_TOTAL } from '@/lib/evTraining';
import { successHaptic } from '@/lib/haptics';
import { getAbilities, getMoveset, getPokemonById, groupMovesByMethod, localizedMoveName } from '@/lib/pokedex';
import { exportTeamToShowdown, localizedNatureName, NATURES, totalEvs, type TeamMemberBuild } from '@/lib/showdown';
import { useBoxStore, type BoxBuild } from '@/store/boxStore';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';

const STAT_LABEL_KEYS: Record<StatKey, string> = {
  hp: 'pokedex.hp',
  attack: 'pokedex.attack',
  defense: 'pokedex.defense',
  spAttack: 'pokedex.spAttack',
  spDefense: 'pokedex.spDefense',
  speed: 'pokedex.speed',
};

function PickChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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

export default function BoxBuildEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const build = useBoxStore((s) => s.builds.find((b) => b.id === id));
  const updateBuild = useBoxStore((s) => s.updateBuild);
  const deleteBuild = useBoxStore((s) => s.deleteBuild);
  const duplicateBuild = useBoxStore((s) => s.duplicateBuild);
  const locale = useLocaleStore((s) => s.locale);

  const [exportText, setExportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pokemon = build ? getPokemonById(build.pokemonId) : undefined;

  const abilityInfo = pokemon ? getAbilities(pokemon) : undefined;
  const availableAbilities = [
    ...(abilityInfo?.abilities ?? []),
    ...(abilityInfo?.hiddenAbility ? [abilityInfo.hiddenAbility] : []),
  ];

  const moveGroups = useMemo(() => {
    if (!pokemon) return null;
    const moveset = getMoveset(pokemon);
    if (!moveset) return null;
    return groupMovesByMethod(moveset.moves);
  }, [pokemon]);

  // Functional updater only (see boxStore.ts / CLAUDE.md's "bug real
  // encontrado" note on the team builder's BuildEditorModal) — every field
  // change is routed through the store's own updater form so two edits in
  // quick succession can never clobber each other by both reading the same
  // stale `build` prop.
  function change(updater: (prev: BoxBuild) => BoxBuild) {
    if (!id) return;
    updateBuild(id, updater);
  }

  const setEv = (stat: StatKey, raw: string) => {
    const parsed = Math.max(0, Math.min(252, Number(raw.replace(/[^0-9]/g, '')) || 0));
    change((prev) => ({ ...prev, evs: { ...prev.evs, [stat]: parsed } }));
  };
  const setIv = (stat: StatKey, raw: string) => {
    const parsed = Math.max(0, Math.min(31, Number(raw.replace(/[^0-9]/g, '')) || 0));
    change((prev) => ({ ...prev, ivs: { ...prev.ivs, [stat]: parsed } }));
  };
  const toggleMove = (name: string) => {
    change((prev) => {
      if (prev.moves.includes(name)) return { ...prev, moves: prev.moves.filter((m) => m !== name) };
      if (prev.moves.length >= 4) return prev;
      return { ...prev, moves: [...prev.moves, name] };
    });
  };

  async function handleDelete() {
    if (!id) return;
    const confirmed = await confirmDestructive({
      title: t('box.deleteConfirmTitle'),
      message: t('box.deleteConfirmMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (confirmed) {
      deleteBuild(id);
      router.replace('/caja');
    }
  }

  function handleDuplicate() {
    if (!id) return;
    const newId = duplicateBuild(id);
    if (newId) router.replace(`/caja/${newId}`);
  }

  function handleExport() {
    if (!pokemon || !build) return;
    setExportText(exportTeamToShowdown([{ pokemon, build }]));
    setCopied(false);
  }
  async function handleCopy() {
    if (!exportText) return;
    await Clipboard.setStringAsync(exportText);
    setCopied(true);
    successHaptic();
  }

  if (!build || !pokemon) {
    return (
      <Screen>
        <Header title={t('box.title')} backHref="/caja" />
        <Text className="text-sm text-ink-400">{t('box.notFound')}</Text>
      </Screen>
    );
  }

  const evTotal = totalEvs(build.evs);
  const overEvCap = evTotal > EV_CAP_TOTAL;

  return (
    <Screen>
      <Header title={build.nickname.trim() || pokemon.name.es} backHref="/caja" />

      <View className="mb-4 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-3">
        <PokemonSprite id={pokemon.id} types={pokemon.types} size={52} />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink-100">{pokemon.name.es}</Text>
          <Text className="text-xs text-ink-400">#{pokemon.id}</Text>
        </View>
      </View>

      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('box.nicknameLabel')}</Text>
      <TextInput
        value={build.nickname}
        onChangeText={(v) => change((prev) => ({ ...prev, nickname: v }))}
        placeholderTextColor={colors.ink[400]}
        className="mb-3 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100"
      />

      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('box.itemLabel')}</Text>
      <TextInput
        value={build.item}
        onChangeText={(v) => change((prev) => ({ ...prev, item: v }))}
        placeholderTextColor={colors.ink[400]}
        className="mb-3 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100"
      />

      {availableAbilities.length > 0 && (
        <>
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('box.abilityLabel')}</Text>
          <View className="mb-3 flex-row flex-wrap">
            {availableAbilities.map((a) => (
              <PickChip key={a} label={a} selected={build.ability === a} onPress={() => change((prev) => ({ ...prev, ability: a }))} />
            ))}
          </View>
        </>
      )}

      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('box.natureLabel')}</Text>
      <View className="mb-3 flex-row flex-wrap">
        {NATURES.map((n) => (
          <PickChip
            key={n.name}
            label={localizedNatureName(n.name, locale)}
            selected={build.nature === n.name}
            onPress={() => change((prev) => ({ ...prev, nature: n.name }))}
          />
        ))}
      </View>

      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {t('box.evsLabel')} — {t('box.evsTotal', { total: evTotal, limit: EV_CAP_TOTAL })}
      </Text>
      <View className="mb-1 flex-row flex-wrap gap-2">
        {STAT_KEYS.map((stat) => (
          <View key={stat} className="w-[30%]">
            <Text className="mb-1 text-[10px] text-ink-400">{t(STAT_LABEL_KEYS[stat])}</Text>
            <TextInput
              value={String(build.evs[stat])}
              onChangeText={(v) => setEv(stat, v)}
              keyboardType="number-pad"
              maxLength={3}
              className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-center text-sm text-ink-100"
            />
          </View>
        ))}
      </View>
      {overEvCap && (
        <View className="mb-3 rounded-lg border border-pokeRed bg-pokeRed/10 px-3 py-2">
          <Text className="text-xs text-pokeRed">{t('box.evsOverLimit', { limit: EV_CAP_TOTAL })}</Text>
        </View>
      )}
      {!overEvCap && <View className="mb-3" />}

      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('box.ivsLabel')}</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {STAT_KEYS.map((stat) => (
          <View key={stat} className="w-[30%]">
            <Text className="mb-1 text-[10px] text-ink-400">{t(STAT_LABEL_KEYS[stat])}</Text>
            <TextInput
              value={String(build.ivs[stat])}
              onChangeText={(v) => setIv(stat, v)}
              keyboardType="number-pad"
              maxLength={2}
              className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-center text-sm text-ink-100"
            />
          </View>
        ))}
      </View>

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {t('box.movesLabel')} — {t('box.movesSelected', { count: build.moves.length })}
      </Text>
      {!moveGroups ? (
        <Text className="mb-4 text-sm text-ink-400">{t('teams.movesEmpty')}</Text>
      ) : (
        <View className="mb-4">
          {moveGroups.byLevel.length > 0 && (
            <View className="mb-2">
              <Text className="mb-1.5 text-[11px] font-semibold text-ink-500">{t('pokedex.movesByLevel')}</Text>
              <View className="flex-row flex-wrap">
                {moveGroups.byLevel.map(({ name }) => (
                  <PickChip
                    key={name}
                    label={localizedMoveName(name, locale)}
                    selected={build.moves.includes(name)}
                    onPress={() => toggleMove(name)}
                  />
                ))}
              </View>
            </View>
          )}
          {moveGroups.tm.length > 0 && (
            <View className="mb-2">
              <Text className="mb-1.5 text-[11px] font-semibold text-ink-500">{t('pokedex.movesTm')}</Text>
              <View className="flex-row flex-wrap">
                {moveGroups.tm.map((name) => (
                  <PickChip
                    key={name}
                    label={localizedMoveName(name, locale)}
                    selected={build.moves.includes(name)}
                    onPress={() => toggleMove(name)}
                  />
                ))}
              </View>
            </View>
          )}
          {moveGroups.egg.length > 0 && (
            <View className="mb-2">
              <Text className="mb-1.5 text-[11px] font-semibold text-ink-500">{t('pokedex.movesEgg')}</Text>
              <View className="flex-row flex-wrap">
                {moveGroups.egg.map((name) => (
                  <PickChip
                    key={name}
                    label={localizedMoveName(name, locale)}
                    selected={build.moves.includes(name)}
                    onPress={() => toggleMove(name)}
                  />
                ))}
              </View>
            </View>
          )}
          {moveGroups.tutor.length > 0 && (
            <View className="mb-2">
              <Text className="mb-1.5 text-[11px] font-semibold text-ink-500">{t('pokedex.movesTutor')}</Text>
              <View className="flex-row flex-wrap">
                {moveGroups.tutor.map((name) => (
                  <PickChip
                    key={name}
                    label={localizedMoveName(name, locale)}
                    selected={build.moves.includes(name)}
                    onPress={() => toggleMove(name)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      <View className="mb-4 flex-row gap-3">
        <Button variant="secondary" onPress={handleDuplicate} className="flex-1">
          {t('box.duplicate')}
        </Button>
        <Button variant="danger" onPress={handleDelete} className="flex-1">
          {t('common.delete')}
        </Button>
      </View>

      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('box.exportTitle')}</Text>
      <Button onPress={handleExport} className="mb-3">
        {t('box.exportButton')}
      </Button>
      {exportText && (
        <>
          <View className="mb-3 rounded-xl border border-ink-600 bg-ink-900 p-3">
            <ScrollView>
              <Text selectable className="font-mono text-xs text-ink-100">
                {exportText}
              </Text>
            </ScrollView>
          </View>
          <View className="mb-6 flex-row gap-3">
            <Button variant="secondary" onPress={handleCopy} className="flex-1">
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
            <Button onPress={() => Share.share({ message: exportText })} className="flex-1">
              {t('common.share')}
            </Button>
          </View>
        </>
      )}
    </Screen>
  );
}
