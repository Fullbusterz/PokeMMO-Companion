import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, Share, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BoxPickerModal } from '@/components/BoxPickerModal';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { TierBadge } from '@/components/TierBadge';
import { TypeBadge } from '@/components/TypeBadge';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { STAT_KEYS, type StatKey } from '@/lib/breeding';
import { successHaptic } from '@/lib/haptics';
import { getAbilities, getMoveset, searchPokemon } from '@/lib/pokedex';
import {
  defaultBuild,
  exportTeamToShowdown,
  localizedNatureName,
  NATURES,
  totalEvs,
  type TeamMemberBuild,
} from '@/lib/showdown';
import {
  analyzeOffensiveGaps,
  analyzeTeamWeaknesses,
  MAX_TEAM_SIZE,
  suggestCandidates,
  type PvpFormat,
  type TeamCandidate,
  type TeamWeakness,
} from '@/lib/teamBuilder';
import type { PokeType } from '@/lib/typeChart';
import { type BoxBuild } from '@/store/boxStore';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';
import type { PokemonEntry } from '@/types/pokemon';

// Pokemon display names in this screen follow the same convention as
// app/pokedex/index.tsx's list rows: always Spanish (`.name.es`), not
// locale-aware — a pre-existing app-wide quirk, not something new here.

const STAT_LABEL_KEYS: Record<StatKey, string> = {
  hp: 'pokedex.hp',
  attack: 'pokedex.attack',
  defense: 'pokedex.defense',
  spAttack: 'pokedex.spAttack',
  spDefense: 'pokedex.spDefense',
  speed: 'pokedex.speed',
};

function TeamSlot({
  pokemon,
  onEdit,
  onRemove,
  index,
  usesRealMoves,
}: {
  pokemon: PokemonEntry;
  onEdit: () => void;
  onRemove: () => void;
  index: number;
  /** True when this member's moves came from a Mi caja build — the offensive coverage analysis then uses only those, not the full movepool (see analyzeOffensiveGaps' override param in teamBuilder.ts). */
  usesRealMoves: boolean;
}) {
  return (
    <Animated.View entering={nativeOnly(FadeInDown.delay(index * 40).duration(220))}>
      <View className="mb-2 flex-row items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 p-2">
        <PressScale haptic="select" scaleTo={0.97} onPress={onEdit} className="flex-1 flex-row items-center gap-3">
          <PokemonSprite id={pokemon.id} types={pokemon.types} size={44} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-ink-100">{pokemon.name.es}</Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-1">
              {(pokemon.types as PokeType[]).map((tp) => (
                <TypeBadge key={tp} type={tp} />
              ))}
              <View
                className="rounded-full px-1.5 py-0.5"
                style={{ backgroundColor: usesRealMoves ? `${colors.type.water}26` : colors.ink[700] }}
              >
                <Text
                  className="text-[9px] font-semibold uppercase"
                  style={{ color: usesRealMoves ? colors.type.water : colors.ink[400] }}
                >
                  {usesRealMoves ? t('teams.realMovesBadge') : t('teams.fullMovepoolBadge')}
                </Text>
              </View>
            </View>
          </View>
        </PressScale>
        <PressScale haptic="select" scaleTo={0.9} onPress={onEdit} hitSlop={8} className="p-1">
          <Ionicons name="create-outline" size={18} color={colors.ink[300]} />
        </PressScale>
        <PressScale haptic="select" scaleTo={0.9} onPress={onRemove} hitSlop={8} className="p-1">
          <Ionicons name="close-circle" size={20} color={colors.ink[400]} />
        </PressScale>
      </View>
    </Animated.View>
  );
}

function WeaknessRow({ weakness }: { weakness: TeamWeakness }) {
  return (
    <View className="mb-2 rounded-xl border border-ink-600 bg-ink-800 p-3">
      <View className="mb-1.5 flex-row items-center justify-between">
        <TypeBadge type={weakness.type} />
        <Text className="text-xs font-semibold text-pokeRed">
          {t('teams.membersWeak', { count: weakness.members.length })}
        </Text>
      </View>
      <Text className="text-xs text-ink-400">{weakness.members.map((p) => p.name.es).join(', ')}</Text>
    </View>
  );
}

function CandidateRow({ candidate, onAdd }: { candidate: TeamCandidate; onAdd: () => void }) {
  return (
    <PressScale
      haptic="select"
      scaleTo={0.98}
      onPress={onAdd}
      className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700"
    >
      <PokemonSprite id={candidate.pokemon.id} types={candidate.pokemon.types} size={40} />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-semibold text-ink-100">{candidate.pokemon.name.es}</Text>
          {candidate.tier && <TierBadge tier={candidate.tier} />}
        </View>
        <Text className="mt-0.5 text-xs text-ink-400">
          {t('teams.coversLabel')}: {candidate.covers.map((tp) => t(`types.${tp}`)).join(', ')}
        </Text>
      </View>
      <Ionicons name="add-circle" size={20} color={colors.pokeRed.DEFAULT} />
    </PressScale>
  );
}

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

function BuildEditorModal({
  pokemon,
  build,
  onChange,
  onClose,
}: {
  pokemon: PokemonEntry | null;
  build: TeamMemberBuild | null;
  /** Functional updater, not a computed next value — several fields can
      change in quick succession (e.g. two chip taps before React re-renders
      this component with the previous update applied), and building `next`
      from the `build` prop directly would silently drop whichever update
      didn't win the race. Routing every change through setState's updater
      form makes each one apply on top of the latest state instead. */
  onChange: (updater: (prev: TeamMemberBuild) => TeamMemberBuild) => void;
  onClose: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const abilityInfo = pokemon ? getAbilities(pokemon) : undefined;
  const availableAbilities = [
    ...(abilityInfo?.abilities ?? []),
    ...(abilityInfo?.hiddenAbility ? [abilityInfo.hiddenAbility] : []),
  ];
  const availableMoves = pokemon
    ? Array.from(new Set((getMoveset(pokemon)?.moves ?? []).map((m) => m.name)))
    : [];

  const setEv = (stat: StatKey, raw: string) => {
    const parsed = Math.max(0, Math.min(252, Number(raw.replace(/[^0-9]/g, '')) || 0));
    onChange((prev) => ({ ...prev, evs: { ...prev.evs, [stat]: parsed } }));
  };
  const setIv = (stat: StatKey, raw: string) => {
    const parsed = Math.max(0, Math.min(31, Number(raw.replace(/[^0-9]/g, '')) || 0));
    onChange((prev) => ({ ...prev, ivs: { ...prev.ivs, [stat]: parsed } }));
  };
  const toggleMove = (name: string) => {
    onChange((prev) => {
      if (prev.moves.includes(name)) return { ...prev, moves: prev.moves.filter((m) => m !== name) };
      if (prev.moves.length >= 4) return prev;
      return { ...prev, moves: [...prev.moves, name] };
    });
  };

  return (
    <Modal visible={!!pokemon && !!build} transparent animationType="fade" onRequestClose={onClose}>
      <PressScale haptic="none" onPress={onClose} className="flex-1 items-center justify-end bg-black/70 p-4">
        <PressScale
          haptic="none"
          onPress={(e) => e.stopPropagation()}
          className="max-h-[88%] w-full max-w-lg rounded-2xl border border-ink-600 bg-ink-800 p-5"
        >
          {pokemon && build && (
            <>
              <View className="mb-3 flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-lg font-bold text-ink-100">
                  {t('teams.editSetTitle', { name: pokemon.name.es })}
                </Text>
                <PressScale
                  haptic="select"
                  scaleTo={0.9}
                  onPress={onClose}
                  hitSlop={12}
                  className="rounded-full bg-ink-700 p-2"
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                >
                  <Ionicons name="close" size={18} color={colors.ink[100]} />
                </PressScale>
              </View>

              <ScrollView>
                <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('teams.nicknameLabel')}
                </Text>
                <TextInput
                  value={build.nickname}
                  onChangeText={(v) => onChange((prev) => ({ ...prev, nickname: v }))}
                  placeholderTextColor={colors.ink[400]}
                  className="mb-3 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100"
                />

                <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('teams.itemLabel')}
                </Text>
                <TextInput
                  value={build.item}
                  onChangeText={(v) => onChange((prev) => ({ ...prev, item: v }))}
                  placeholderTextColor={colors.ink[400]}
                  className="mb-3 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100"
                />

                {availableAbilities.length > 0 && (
                  <>
                    <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('teams.abilityLabel')}
                    </Text>
                    <View className="mb-3 flex-row flex-wrap">
                      {availableAbilities.map((a) => (
                        <PickChip
                          key={a}
                          label={a}
                          selected={build.ability === a}
                          onPress={() => onChange((prev) => ({ ...prev, ability: a }))}
                        />
                      ))}
                    </View>
                  </>
                )}

                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('teams.natureLabel')}
                </Text>
                <View className="mb-3 flex-row flex-wrap">
                  {NATURES.map((n) => (
                    <PickChip
                      key={n.name}
                      label={localizedNatureName(n.name, locale)}
                      selected={build.nature === n.name}
                      onPress={() => onChange((prev) => ({ ...prev, nature: n.name }))}
                    />
                  ))}
                </View>

                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('teams.evsLabel')} — {t('teams.evsTotal', { total: totalEvs(build.evs) })}
                </Text>
                <View className="mb-3 flex-row flex-wrap gap-2">
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

                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('teams.ivsLabel')}
                </Text>
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

                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('teams.movesLabel')} — {t('teams.movesSelected', { count: build.moves.length })}
                </Text>
                {availableMoves.length === 0 ? (
                  <Text className="text-sm text-ink-400">{t('teams.movesEmpty')}</Text>
                ) : (
                  <View className="flex-row flex-wrap">
                    {availableMoves.map((move) => (
                      <PickChip key={move} label={move} selected={build.moves.includes(move)} onPress={() => toggleMove(move)} />
                    ))}
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </PressScale>
      </PressScale>
    </Modal>
  );
}

export default function TeamBuilderScreen() {
  const [team, setTeam] = useState<PokemonEntry[]>([]);
  const [builds, setBuilds] = useState<Record<number, TeamMemberBuild>>({});
  // Members added "de Mi caja" — tracks which pokemon.id's build.moves should
  // be treated as the member's actual chosen moveset (not the full optimistic
  // movepool) when computing offensive coverage. Deliberately NOT storing a
  // frozen copy of the moves here: analyzeOffensiveGaps reads builds[id].moves
  // live below, so editing the moves afterward in BuildEditorModal keeps the
  // "real moves" analysis in sync instead of going stale.
  const [fromBox, setFromBox] = useState<Record<number, true>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [exportText, setExportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<PvpFormat>('uber');
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!query.trim() || team.length >= MAX_TEAM_SIZE) return [];
    const teamIds = new Set(team.map((p) => p.id));
    return searchPokemon(query)
      .filter((p) => !teamIds.has(p.id))
      .slice(0, 8);
  }, [query, team]);

  const weaknesses = useMemo(() => analyzeTeamWeaknesses(team), [team]);
  const candidates = useMemo(() => suggestCandidates(weaknesses, team, format), [weaknesses, team, format]);
  const realMoveOverrides = useMemo(() => {
    const overrides: Partial<Record<number, string[]>> = {};
    for (const id of Object.keys(fromBox)) {
      const numericId = Number(id);
      const memberBuild = builds[numericId];
      if (memberBuild) overrides[numericId] = memberBuild.moves;
    }
    return overrides;
  }, [fromBox, builds]);
  const offensiveGaps = useMemo(() => analyzeOffensiveGaps(team, realMoveOverrides), [team, realMoveOverrides]);

  const addPokemon = (p: PokemonEntry) => {
    if (team.length >= MAX_TEAM_SIZE) return;
    setTeam((prev) => [...prev, p]);
    setBuilds((prev) => ({ ...prev, [p.id]: prev[p.id] ?? defaultBuild() }));
    setQuery('');
  };
  const removePokemon = (id: number) => {
    setTeam((prev) => prev.filter((p) => p.id !== id));
    setBuilds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setFromBox((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // "De Mi caja": adds the species (if room and not already on the team) and
  // seeds its set directly from the saved build — same TeamMemberBuild shape
  // (see boxStore.ts), so no field mapping needed — then flags it in
  // `fromBox` so the offensive-coverage analysis uses its real moves only.
  const addFromBox = (build: BoxBuild, pokemon: PokemonEntry) => {
    if (team.length >= MAX_TEAM_SIZE || team.some((p) => p.id === pokemon.id)) {
      setBoxPickerOpen(false);
      return;
    }
    setTeam((prev) => [...prev, pokemon]);
    setBuilds((prev) => ({
      ...prev,
      [pokemon.id]: {
        nickname: build.nickname,
        item: build.item,
        ability: build.ability,
        nature: build.nature,
        evs: build.evs,
        ivs: build.ivs,
        moves: build.moves,
      },
    }));
    setFromBox((prev) => ({ ...prev, [pokemon.id]: true }));
    setBoxPickerOpen(false);
  };

  const editingPokemon = team.find((p) => p.id === editingId) ?? null;
  const editingBuild = editingId !== null ? (builds[editingId] ?? null) : null;

  const handleExport = () => {
    const members = team.map((p) => ({ pokemon: p, build: builds[p.id] ?? defaultBuild() }));
    setExportText(exportTeamToShowdown(members));
    setCopied(false);
  };
  const handleCopy = async () => {
    if (!exportText) return;
    await Clipboard.setStringAsync(exportText);
    setCopied(true);
    successHaptic();
  };

  return (
    <Screen>
      <Header title={t('teams.title')} />
      <Text className="mb-4 text-sm text-ink-300">{t('teams.subtitle')}</Text>

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {t('teams.teamTitle')} ({team.length}/{MAX_TEAM_SIZE})
      </Text>
      {team.length === 0 ? (
        <View className="mb-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
          <Text className="text-sm text-ink-400">{t('teams.teamEmpty')}</Text>
        </View>
      ) : (
        <View className="mb-4">
          {team.map((p, i) => (
            <TeamSlot
              key={p.id}
              pokemon={p}
              index={i}
              onEdit={() => setEditingId(p.id)}
              onRemove={() => removePokemon(p.id)}
              usesRealMoves={!!fromBox[p.id]}
            />
          ))}
        </View>
      )}

      {team.length < MAX_TEAM_SIZE ? (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('teams.searchPlaceholder')}
            placeholderTextColor={colors.ink[400]}
            className="mb-2 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
          />
          <PressScale
            haptic="select"
            scaleTo={0.98}
            onPress={() => setBoxPickerOpen(true)}
            className="mb-4 flex-row items-center justify-center gap-2 rounded-xl border border-gold/40 bg-ink-800 px-4 py-3 active:bg-ink-700"
          >
            <Ionicons name="file-tray-full-outline" size={16} color={colors.gold.DEFAULT} />
            <Text className="text-sm font-semibold text-ink-100">{t('teams.addFromBox')}</Text>
          </PressScale>
          {searchResults.length > 0 && (
            <View className="mb-4">
              {searchResults.map((p) => (
                <PressScale
                  key={p.id}
                  haptic="select"
                  scaleTo={0.98}
                  onPress={() => addPokemon(p)}
                  className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-2 active:bg-ink-700"
                >
                  <PokemonSprite id={p.id} types={p.types} size={36} />
                  <Text className="flex-1 text-sm font-semibold text-ink-100">{p.name.es}</Text>
                  <Ionicons name="add-circle-outline" size={20} color={colors.ink[300]} />
                </PressScale>
              ))}
            </View>
          )}
        </>
      ) : (
        <View className="mb-4 rounded-xl border border-type-electric/30 bg-type-electric/10 px-3 py-2">
          <Text className="text-xs text-type-electric">{t('teams.teamFull')}</Text>
        </View>
      )}

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('teams.weaknessesTitle')}</Text>
      {team.length < 2 ? (
        <Text className="mb-4 text-sm text-ink-400">{t('teams.weaknessesNeedTwo')}</Text>
      ) : weaknesses.length === 0 ? (
        <Text className="mb-4 text-sm text-ink-400">{t('teams.weaknessesEmpty')}</Text>
      ) : (
        <View className="mb-4">
          {weaknesses.map((w) => (
            <WeaknessRow key={w.type} weakness={w} />
          ))}
        </View>
      )}

      {weaknesses.length > 0 && (
        <>
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('teams.suggestionsTitle')}</Text>
          <Text className="mb-2 text-xs text-ink-500">{t('teams.suggestionsSubtitle')}</Text>

          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('teams.formatLabel')}</Text>
          <View className="mb-2 flex-row flex-wrap">
            {(['uber', 'ou', 'uu', 'nu'] as const).map((f) => (
              <PickChip
                key={f}
                label={t(`teams.format${f.charAt(0).toUpperCase()}${f.slice(1)}`)}
                selected={format === f}
                onPress={() => setFormat(f)}
              />
            ))}
          </View>
          <Text className="mb-3 text-xs text-ink-500">{t('teams.formatCaveat')}</Text>

          {candidates.length > 0 && (
            <View className="mb-4">
              {candidates.map((c) => (
                <CandidateRow key={c.pokemon.id} candidate={c} onAdd={() => addPokemon(c.pokemon)} />
              ))}
            </View>
          )}
        </>
      )}

      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('teams.offenseTitle')}</Text>
      <Text className="mb-1 text-xs text-ink-500">{t('teams.offenseSubtitle')}</Text>
      {Object.keys(fromBox).length > 0 && (
        <Text className="mb-2 text-xs text-ink-500">{t('teams.offenseRealMovesCaveat')}</Text>
      )}
      {team.length === 0 ? (
        <Text className="mb-4 text-sm text-ink-400">{t('teams.offenseNeedOne')}</Text>
      ) : offensiveGaps.length === 0 ? (
        <Text className="mb-4 text-sm text-ink-400">{t('teams.offenseEmpty')}</Text>
      ) : (
        <View className="mb-4 flex-row flex-wrap gap-2">
          {offensiveGaps.map((tp) => (
            <TypeBadge key={tp} type={tp} />
          ))}
        </View>
      )}

      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('teams.exportTitle')}</Text>
      <Text className="mb-3 text-xs text-ink-500">{t('teams.exportSubtitle')}</Text>
      {team.length === 0 ? (
        <Text className="text-sm text-ink-400">{t('teams.exportEmpty')}</Text>
      ) : (
        <>
          <Button onPress={handleExport} className="mb-3">
            {t('teams.exportButton')}
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
              <View className="flex-row gap-3">
                <Button variant="secondary" onPress={handleCopy} className="flex-1">
                  {copied ? t('common.copied') : t('common.copy')}
                </Button>
                <Button onPress={() => Share.share({ message: exportText })} className="flex-1">
                  {t('common.share')}
                </Button>
              </View>
            </>
          )}
        </>
      )}

      <BuildEditorModal
        pokemon={editingPokemon}
        build={editingBuild}
        onChange={(updater) => {
          if (editingId === null) return;
          setBuilds((prev) => ({ ...prev, [editingId]: updater(prev[editingId] ?? defaultBuild()) }));
        }}
        onClose={() => setEditingId(null)}
      />

      <BoxPickerModal visible={boxPickerOpen} onClose={() => setBoxPickerOpen(false)} onSelect={addFromBox} />
    </Screen>
  );
}
