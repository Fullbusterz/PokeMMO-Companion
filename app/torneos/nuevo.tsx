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
import { DEFAULT_STARTING_CHIPS } from '@/lib/betting';
import { createOnlineTournament, generateOrganizerSecret } from '@/lib/onlineTournament';
import { isOnlineConfigured } from '@/lib/supabase';
import { maxRounds, recommendedRounds } from '@/lib/swissFormat';
import { DEFAULT_SWISS_CONFIG } from '@/lib/tournamentValidation';
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
  const setOnlineLink = useTournamentStore((s) => s.setOnlineLink);
  const setTournamentBetting = useTournamentStore((s) => s.setTournamentBetting);
  const [name, setName] = useState('');
  const [participantDraft, setParticipantDraft] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [format, setFormat] = useState<TournamentFormat>('single');
  const [rounds, setRounds] = useState(DEFAULT_SWISS_CONFIG.totalRounds);
  const [bestOf, setBestOf] = useState<1 | 3>(DEFAULT_SWISS_CONFIG.bestOf);
  const [online, setOnline] = useState(true);
  const [betting, setBetting] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // The recommendation follows the field size, but only until the organizer
  // sets a number themselves — overwriting their choice as players are added
  // would be infuriating.
  const [roundsTouched, setRoundsTouched] = useState(false);
  const recommended = recommendedRounds(Math.max(participants.length, 2));
  useEffect(() => {
    if (!roundsTouched) setRounds(Math.max(recommended, DEFAULT_SWISS_CONFIG.totalRounds));
  }, [recommended, roundsTouched]);

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

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert(t('newTournament.nameRequiredError'));
      return;
    }
    // Swiss is the one format that can start with an empty roster: players
    // sign themselves up through the share link, and round 1 isn't paired
    // until the organizer says so.
    if (participants.length < 2 && !(format === 'swiss' && online)) {
      Alert.alert(t('newTournament.minParticipantsError'));
      return;
    }
    if (format === 'double' && !isValidDoubleElimSize(participants.length)) {
      Alert.alert(t('newTournament.doubleElimSizeError'));
      return;
    }

    const tournament = createTournament(
      name,
      participants,
      format,
      format === 'swiss' ? { totalRounds: rounds, bestOf } : undefined
    );

    // Betting only makes sense on a published tournament: the bets live in the
    // database, keyed to the join code.
    if (format === 'swiss' && online && betting && isOnlineConfigured()) {
      setTournamentBetting(tournament.id, { enabled: true, startingChips: DEFAULT_STARTING_CHIPS });
    }
    successHaptic();

    if (format === 'swiss' && online && isOnlineConfigured()) {
      setIsPublishing(true);
      try {
        const secret = generateOrganizerSecret();
        const { code } = await createOnlineTournament(tournament, secret);
        setOnlineLink(tournament.id, { code, secret, syncedAt: new Date().toISOString() });
      } catch {
        // The tournament exists locally either way — publishing is a second
        // step the organizer can retry from its own screen.
        Alert.alert(t('newTournament.onlineError'));
      } finally {
        setIsPublishing(false);
      }
    }

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
      {/* Two rows of two: four options side by side squeeze the labels into
          two-line wraps on a phone. */}
      <View className="mb-2 flex-row gap-2">
        <FormatOption
          isSelected={format === 'swiss'}
          onPress={() => setFormat('swiss')}
          label={t('newTournament.formatSwiss')}
        />
        <FormatOption
          isSelected={format === 'league'}
          onPress={() => setFormat('league')}
          label={t('newTournament.formatLeague')}
        />
      </View>
      <View className="mb-5 flex-row gap-2">
        <FormatOption
          isSelected={format === 'single'}
          onPress={() => setFormat('single')}
          label={t('newTournament.formatSingle')}
        />
        <FormatOption
          isSelected={format === 'double'}
          onPress={() => setFormat('double')}
          label={t('newTournament.formatDouble')}
        />
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

      {format === 'swiss' && (
        <Animated.View entering={nativeOnly(FadeInDown.duration(200))} className="mb-5">
          <Text className="mb-3 text-xs text-ink-400">{t('newTournament.formatSwissHint')}</Text>

          <Text className="mb-1 font-medium text-ink-300">{t('newTournament.roundsLabel')}</Text>
          <View className="mb-1 flex-row gap-2">
            {[3, 4, 5, 6, 7].map((value) => (
              <PressScale
                key={value}
                haptic="select"
                scaleTo={0.97}
                disabled={value > maxRounds(Math.max(participants.length, 8))}
                onPress={() => {
                  setRoundsTouched(true);
                  setRounds(value);
                }}
                className={`flex-1 rounded-xl border py-3 ${
                  rounds === value ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${rounds === value ? 'text-pokeRed' : 'text-ink-300'}`}
                >
                  {value}
                </Text>
              </PressScale>
            ))}
          </View>
          {/* The recommendation is only meaningful once there's a field to
              size it against — with an empty roster (online sign-ups) it
              would read "for 2 players we recommend 1". */}
          {participants.length >= 2 && (
            <Text className="mb-4 text-xs text-ink-400">
              {t('newTournament.roundsHint', { count: participants.length, recommended })}
            </Text>
          )}

          <Text className="mb-1 font-medium text-ink-300">{t('newTournament.bestOfLabel')}</Text>
          <View className="mb-1 flex-row gap-2">
            <FormatOption
              isSelected={bestOf === 1}
              onPress={() => setBestOf(1)}
              label={t('newTournament.bestOfOne')}
            />
            <FormatOption
              isSelected={bestOf === 3}
              onPress={() => setBestOf(3)}
              label={t('newTournament.bestOfThree')}
            />
          </View>
          <Text className="mb-4 text-xs text-ink-400">
            {bestOf === 1 ? t('newTournament.bestOfOneHint') : t('newTournament.bestOfThreeHint')}
          </Text>

          <PressScale
            haptic="select"
            scaleTo={0.98}
            disabled={!isOnlineConfigured()}
            onPress={() => setOnline((value) => !value)}
            className={`flex-row items-center gap-3 rounded-xl border p-3 ${
              online && isOnlineConfigured() ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600'
            }`}
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded border ${
                online && isOnlineConfigured() ? 'border-pokeRed bg-pokeRed' : 'border-ink-500'
              }`}
            >
              {online && isOnlineConfigured() && <Text className="text-xs font-bold text-white">✓</Text>}
            </View>
            <Text className="flex-1 font-semibold text-ink-100">{t('newTournament.onlineLabel')}</Text>
          </PressScale>
          <Text className="mt-2 text-xs text-ink-400">
            {isOnlineConfigured() ? t('newTournament.onlineHint') : t('newTournament.onlineUnavailable')}
          </Text>

          {online && isOnlineConfigured() && (
            <>
              <PressScale
                haptic="select"
                scaleTo={0.98}
                onPress={() => setBetting((value) => !value)}
                className={`mt-3 flex-row items-center gap-3 rounded-xl border p-3 ${
                  betting ? 'border-gold bg-gold/10' : 'border-ink-600'
                }`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded border ${
                    betting ? 'border-gold bg-gold' : 'border-ink-500'
                  }`}
                >
                  {betting && <Text className="text-xs font-bold text-ink-900">✓</Text>}
                </View>
                <Text className="flex-1 font-semibold text-ink-100">{t('betting.enableLabel')}</Text>
              </PressScale>
              <Text className="mt-2 text-xs text-ink-400">
                {t('betting.enableHint', { chips: DEFAULT_STARTING_CHIPS })}
              </Text>
            </>
          )}
        </Animated.View>
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

      <Button onPress={() => void handleCreate()} disabled={isPublishing} className="mt-6">
        {isPublishing ? t('newTournament.creatingOnline') : t('newTournament.create')}
      </Button>
    </Screen>
  );
}
