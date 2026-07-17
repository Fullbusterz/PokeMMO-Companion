import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  interpolateColor,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { DeleteText } from '@/components/DeleteText';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { isNative, nativeOnly } from '@/lib/animation';
import { isValidDoubleElimSize } from '@/lib/doubleElimBracket';
import { successHaptic } from '@/lib/haptics';
import colors from '@/theme/colors';
import { useTournamentStore } from '@/store/tournamentStore';
import type { TournamentFormat } from '@/types/tournament';

function FormatOption({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    // On web, post-mount shared-value updates never reach the DOM (see
    // src/lib/animation.ts) — the plain `style` fallback below covers
    // correctness there, so there's nothing useful for this effect to do.
    if (!isNative) return;
    progress.value = withTiming(isSelected ? 1 : 0, { duration: 180 });
  }, [isSelected, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['transparent', `${colors.pokeRed.DEFAULT}1A`]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.ink[600], colors.pokeRed.DEFAULT]),
  }));
  const webStyle = {
    backgroundColor: isSelected ? `${colors.pokeRed.DEFAULT}1A` : 'transparent',
    borderColor: isSelected ? colors.pokeRed.DEFAULT : colors.ink[600],
  };

  return (
    <PressScale
      haptic="select"
      scaleTo={0.97}
      onPress={onPress}
      className="flex-1 rounded-xl border p-3"
      // Static style on BOTH platforms now: PressScale renders a plain
      // Pressable on native (see its 2026-07-17 note), so the animated color
      // style has nowhere to run there — and web always used the static path.
      style={webStyle}
    >
      <Text className={`text-center font-semibold ${isSelected ? 'text-pokeRed' : 'text-ink-300'}`}>{label}</Text>
    </PressScale>
  );
}

export default function NewTournament() {
  const createTournament = useTournamentStore((s) => s.createTournament);
  const [name, setName] = useState('');
  const [participantDraft, setParticipantDraft] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [format, setFormat] = useState<TournamentFormat>('single');

  function addParticipant() {
    const trimmed = participantDraft.trim();
    if (!trimmed) return;
    const isDuplicate = participants.some((p) => p.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      Alert.alert(t('newTournament.duplicateNameError', { name: trimmed }));
      return;
    }
    setParticipants((prev) => [...prev, trimmed]);
    setParticipantDraft('');
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCreate() {
    if (!name.trim()) {
      Alert.alert(t('newTournament.nameRequiredError'));
      return;
    }
    if (participants.length < 2) {
      Alert.alert(t('newTournament.minParticipantsError'));
      return;
    }
    if (format === 'double' && !isValidDoubleElimSize(participants.length)) {
      Alert.alert(t('newTournament.doubleElimSizeError'));
      return;
    }
    const tournament = createTournament(name, participants, format);
    successHaptic();
    router.replace(`/torneos/${tournament.id}`);
  }

  return (
    <Screen>
      <Header title={t('newTournament.title')} backHref="/torneos" />

      <Text className="mb-1 font-medium text-ink-300">{t('newTournament.nameLabel')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('newTournament.namePlaceholder')}
        placeholderTextColor={colors.ink[400]}
        className="mb-5 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
      />

      <Text className="mb-1 font-medium text-ink-300">{t('newTournament.formatLabel')}</Text>
      <View className="mb-5 flex-row gap-2">
        {(['single', 'double', 'league'] as const).map((option) => (
          <FormatOption
            key={option}
            isSelected={format === option}
            onPress={() => setFormat(option)}
            label={
              option === 'single'
                ? t('newTournament.formatSingle')
                : option === 'double'
                  ? t('newTournament.formatDouble')
                  : t('newTournament.formatLeague')
            }
          />
        ))}
      </View>
      {format === 'double' && (
        <Animated.Text entering={nativeOnly(FadeInDown.duration(200))} className="mb-5 text-xs text-ink-400">
          {t('newTournament.formatDoubleHint')}
        </Animated.Text>
      )}
      {format === 'league' && (
        <Animated.Text entering={nativeOnly(FadeInDown.duration(200))} className="mb-5 text-xs text-ink-400">
          {t('newTournament.formatLeagueHint')}
        </Animated.Text>
      )}

      <Text className="mb-1 font-medium text-ink-300">{t('newTournament.participantsLabel')}</Text>
      <View className="mb-3 flex-row gap-2">
        <TextInput
          value={participantDraft}
          onChangeText={setParticipantDraft}
          placeholder={t('newTournament.participantPlaceholder')}
          placeholderTextColor={colors.ink[400]}
          onSubmitEditing={addParticipant}
          returnKeyType="done"
          className="flex-1 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
        />
        <PressScale
          haptic="tap"
          onPress={addParticipant}
          className="justify-center rounded-xl bg-ink-700 px-4 active:bg-ink-600"
        >
          <Text className="font-semibold text-ink-100">{t('newTournament.addParticipant')}</Text>
        </PressScale>
      </View>

      {participants.map((p, index) => (
        <Animated.View
          // Stable per name (duplicates are rejected in addParticipant, so
          // this is always unique) — a key derived from `index` would churn
          // on every removal except the last one, since every later item's
          // index shifts down. React would then treat those as brand-new
          // elements (unmount+remount, firing exiting+entering) instead of
          // reusing them in place, which is exactly what `layout` below is
          // meant to animate smoothly.
          key={p}
          entering={nativeOnly(FadeInDown.duration(220).springify().damping(18))}
          exiting={nativeOnly(FadeOutUp.duration(180))}
          layout={nativeOnly(Layout.springify().damping(18))}
          className="mb-2 flex-row items-center justify-between rounded-lg bg-ink-800 px-4 py-3"
        >
          <Text className="text-ink-100">{p}</Text>
          <DeleteText onPress={() => removeParticipant(index)}>{t('common.delete')}</DeleteText>
        </Animated.View>
      ))}

      <Button onPress={handleCreate} className="mt-6">
        {t('newTournament.create')}
      </Button>
    </Screen>
  );
}
