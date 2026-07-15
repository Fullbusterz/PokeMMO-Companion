import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import {
  EV_CAP_PER_STAT,
  EV_CAP_TOTAL,
  EV_STAT_KEYS,
  isOverEvCap,
  listEvZonesForStat,
  resolveEvZone,
  totalEvs,
  type EvStatKey,
  type EvZoneOption,
  type EvZoneRef,
} from '@/lib/evTraining';
import { getReferenceGuide, type EvTrainingGuide } from '@/lib/guides';
import { useEvSessionStore, type EvSession } from '@/store/evSessionStore';
import colors from '@/theme/colors';

// Same keys the Pokédex stat bars already use — reused instead of adding a
// second, redundant set of stat-name translations.
const STAT_LABEL_KEYS: Record<EvStatKey, string> = {
  hp: 'pokedex.hp',
  atk: 'pokedex.attack',
  def: 'pokedex.defense',
  spAtk: 'pokedex.spAttack',
  spDef: 'pokedex.spDefense',
  speed: 'pokedex.speed',
};

const MANUAL_INCREMENTS = [1, 4, 10] as const;

function StatRow({
  sessionId,
  stat,
  current,
  target,
}: {
  sessionId: string;
  stat: EvStatKey;
  current: number;
  target: number;
}) {
  const addEvs = useEvSessionStore((s) => s.addEvs);
  const setTarget = useEvSessionStore((s) => s.setTarget);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : current > 0 ? 100 : 0;

  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-ink-100">{t(STAT_LABEL_KEYS[stat])}</Text>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm text-ink-300">{current} / </Text>
          <TextInput
            value={String(target)}
            onChangeText={(raw) =>
              setTarget(sessionId, stat, Math.max(0, Math.min(EV_CAP_PER_STAT, Number(raw.replace(/[^0-9]/g, '')) || 0)))
            }
            keyboardType="number-pad"
            className="w-12 rounded-lg border border-ink-600 bg-ink-900 px-1 py-0.5 text-center text-sm text-ink-100"
          />
        </View>
      </View>
      <View className="mb-2 h-2 overflow-hidden rounded-full bg-ink-700">
        <View style={{ width: `${pct}%`, backgroundColor: colors.pokeRed.DEFAULT }} className="h-full rounded-full" />
      </View>
      <View className="flex-row gap-2">
        {MANUAL_INCREMENTS.map((n) => (
          <PressScale
            key={n}
            haptic="select"
            scaleTo={0.94}
            onPress={() => addEvs(sessionId, stat, n)}
            className="rounded-lg bg-ink-700 px-3 py-1.5 active:bg-ink-600"
          >
            <Text className="text-xs font-semibold text-ink-100">+{n}</Text>
          </PressScale>
        ))}
      </View>
    </View>
  );
}

function ZonePickerModal({
  visible,
  guide,
  stat,
  onChangeStat,
  onClose,
  onSelect,
}: {
  visible: boolean;
  guide: EvTrainingGuide | null;
  stat: EvStatKey;
  onChangeStat: (stat: EvStatKey) => void;
  onClose: () => void;
  onSelect: (option: EvZoneOption) => void;
}) {
  const options = useMemo(() => (guide ? listEvZonesForStat(guide, stat) : []), [guide, stat]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <PressScale haptic="none" onPress={onClose} className="flex-1 items-center justify-end bg-black/70 p-4">
        <PressScale
          haptic="none"
          onPress={(e) => e.stopPropagation()}
          className="max-h-[80%] w-full max-w-lg rounded-2xl border border-ink-600 bg-ink-800 p-5"
        >
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-lg font-bold text-ink-100">{t('entreno.zoneModalTitle')}</Text>
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

          <View className="mb-3 flex-row flex-wrap gap-2">
            {EV_STAT_KEYS.map((key) => (
              <PressScale
                key={key}
                haptic="select"
                scaleTo={0.96}
                onPress={() => onChangeStat(key)}
                className={`rounded-full border px-3 py-1.5 ${
                  stat === key ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600 bg-ink-900'
                }`}
              >
                <Text className={`text-xs font-semibold ${stat === key ? 'text-pokeRed' : 'text-ink-300'}`}>
                  {t(STAT_LABEL_KEYS[key])}
                </Text>
              </PressScale>
            ))}
          </View>

          <ScrollView>
            {options.length === 0 ? (
              <Text className="text-sm text-ink-400">{t('entreno.zoneEmptyForStat')}</Text>
            ) : (
              options.map((opt) => (
                <PressScale
                  key={`${opt.source}-${opt.spotIndex}-${opt.pokemonIndex}`}
                  haptic="select"
                  scaleTo={0.98}
                  onPress={() => onSelect(opt)}
                  className="mb-2 rounded-xl border border-ink-600 bg-ink-900 p-3 active:bg-ink-700"
                >
                  <Text className="text-sm font-semibold text-ink-100">
                    {opt.pokemonName} — {opt.evsPerKo} EVs ×{opt.hordeSize}
                  </Text>
                  <Text className="mt-1 text-xs text-ink-400">{opt.details}</Text>
                </PressScale>
              ))
            )}
          </ScrollView>
        </PressScale>
      </PressScale>
    </Modal>
  );
}

function ZoneCard({ session, guide }: { session: EvSession; guide: EvTrainingGuide | null }) {
  const setZone = useEvSessionStore((s) => s.setZone);
  const addEvs = useEvSessionStore((s) => s.addEvs);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStat, setPickerStat] = useState<EvStatKey>(session.zone?.stat ?? 'hp');

  const resolved = useMemo(() => (guide && session.zone ? resolveEvZone(guide, session.zone) : null), [guide, session.zone]);
  const zoneStat = session.zone?.stat;

  function openPicker() {
    setPickerStat(session.zone?.stat ?? 'hp');
    setPickerOpen(true);
  }

  function handleSelect(option: EvZoneOption) {
    const zone: EvZoneRef = { stat: pickerStat, source: option.source, spotIndex: option.spotIndex, pokemonIndex: option.pokemonIndex };
    setZone(session.id, zone);
    setPickerOpen(false);
  }

  return (
    <View className="mb-5 rounded-xl border border-gold/30 bg-ink-800 p-4">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('entreno.zoneTitle')}</Text>
      {resolved && zoneStat ? (
        <>
          <View className="mb-1 flex-row items-center gap-2">
            <View className="rounded-full bg-pokeRed/15 px-2 py-0.5">
              <Text className="text-xs font-bold text-pokeRed">{t(STAT_LABEL_KEYS[zoneStat])}</Text>
            </View>
            <Text className="flex-1 text-sm font-semibold text-ink-100">{resolved.pokemonName}</Text>
          </View>
          <Text className="mb-3 text-xs text-ink-400">{resolved.details}</Text>
          <View className="flex-row gap-2">
            <PressScale
              haptic="select"
              scaleTo={0.96}
              onPress={() => addEvs(session.id, zoneStat, resolved.evsPerKo)}
              className="flex-1 items-center rounded-xl bg-ink-700 px-3 py-3 active:bg-ink-600"
            >
              <Text className="text-center text-sm font-semibold text-ink-100">
                {t('entreno.zoneKoButton', { evs: resolved.evsPerKo })}
              </Text>
            </PressScale>
            <PressScale
              haptic="select"
              scaleTo={0.96}
              onPress={() => addEvs(session.id, zoneStat, resolved.evsPerKo * resolved.hordeSize)}
              className="flex-1 items-center rounded-xl bg-pokeRed px-3 py-3 active:bg-pokeRed/80"
            >
              <Text className="text-center text-sm font-semibold text-white">
                {t('entreno.zoneHordeButton', { evs: resolved.evsPerKo * resolved.hordeSize, count: resolved.hordeSize })}
              </Text>
            </PressScale>
          </View>
          <PressScale haptic="select" scaleTo={0.97} onPress={openPicker} className="mt-3 items-center py-1">
            <Text className="text-xs font-semibold text-ink-400">{t('entreno.zoneChange')}</Text>
          </PressScale>
        </>
      ) : (
        <>
          <Text className="mb-3 text-sm text-ink-400">{t('entreno.zoneNone')}</Text>
          <Button variant="secondary" onPress={openPicker}>
            {t('entreno.zoneSelect')}
          </Button>
        </>
      )}

      <ZonePickerModal
        visible={pickerOpen}
        guide={guide}
        stat={pickerStat}
        onChangeStat={setPickerStat}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
    </View>
  );
}

export default function EvTrainingSessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useEvSessionStore((s) => s.sessions.find((sess) => sess.id === id));
  const renameSession = useEvSessionStore((s) => s.renameSession);
  const undoLast = useEvSessionStore((s) => s.undoLast);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Bundled JSON, safe to read once per screen mount rather than per render.
  const guide = useMemo(() => getReferenceGuide('ev-training') as EvTrainingGuide | null, []);

  if (!session) {
    return (
      <Screen>
        <Header title={t('entreno.title')} backHref="/entreno" />
        <Text className="text-ink-400">{t('entreno.empty')}</Text>
      </Screen>
    );
  }

  const total = totalEvs(session.current);
  const overLimit = isOverEvCap(session.current);
  const lastHistoryEntry = session.history[session.history.length - 1] ?? null;
  const sessionId = session.id;

  function startEditingName() {
    setNameDraft(session!.name);
    setIsEditingName(true);
  }

  function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Alert.alert(t('entreno.nameRequiredError'));
      return;
    }
    renameSession(sessionId, trimmed);
    setIsEditingName(false);
  }

  return (
    <Screen>
      {isEditingName ? (
        <View className="mb-4">
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            autoFocus
            className="mb-2 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-xl font-bold text-ink-100"
          />
          <View className="flex-row gap-3">
            <Button variant="secondary" onPress={() => setIsEditingName(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onPress={saveName} className="flex-1">
              {t('common.save')}
            </Button>
          </View>
        </View>
      ) : (
        <Header title={session.name} backHref="/entreno" onEdit={startEditingName} />
      )}

      <View className={`mb-4 rounded-xl border p-3 ${overLimit ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600 bg-ink-800'}`}>
        <Text className={`text-sm font-semibold ${overLimit ? 'text-pokeRed' : 'text-ink-300'}`}>
          {t('entreno.totalEvs', { current: total })}
        </Text>
        {overLimit && <Text className="mt-1 text-xs text-pokeRed">{t('entreno.totalEvsOverLimit')}</Text>}
      </View>

      <ZoneCard session={session} guide={guide} />

      <PressScale
        haptic="select"
        scaleTo={0.97}
        disabled={!lastHistoryEntry}
        onPress={() => undoLast(sessionId)}
        className={`mb-5 flex-row items-center justify-center gap-2 rounded-xl border p-3 ${
          lastHistoryEntry ? 'border-gold/40 active:bg-ink-700' : 'border-ink-700 opacity-40'
        }`}
      >
        <Ionicons name="arrow-undo" size={16} color={colors.ink[100]} />
        <Text className="font-semibold text-ink-100">
          {lastHistoryEntry
            ? t('entreno.undo', { evs: lastHistoryEntry.amount, stat: t(STAT_LABEL_KEYS[lastHistoryEntry.stat]) })
            : t('entreno.undoNothingToUndo')}
        </Text>
      </PressScale>

      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">{t('entreno.targetsTitle')}</Text>
      <Text className="mb-3 text-xs text-ink-400">{t('entreno.capNotice')}</Text>
      <View className="mb-5 gap-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
        {EV_STAT_KEYS.map((stat) => (
          <StatRow key={stat} sessionId={sessionId} stat={stat} current={session.current[stat]} target={session.targets[stat]} />
        ))}
      </View>
    </Screen>
  );
}
