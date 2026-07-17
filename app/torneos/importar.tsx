import { router } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { isNative } from '@/lib/animation';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { successHaptic } from '@/lib/haptics';
import colors from '@/theme/colors';
import { useTournamentStore } from '@/store/tournamentStore';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
// Custom-wrapped component — see src/lib/animatedNativewind.ts for why this is necessary.
cssInterop(AnimatedTextInput, { className: 'style' });

export default function ImportTournament() {
  const importTournament = useTournamentStore((s) => s.importTournament);
  const [code, setCode] = useState('');
  const shakeX = useSharedValue(0);

  function handleImport() {
    const imported = importTournament(code);
    if (!imported) {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 45 }),
        withTiming(8, { duration: 90 }),
        withTiming(-8, { duration: 90 }),
        withTiming(0, { duration: 45 })
      );
      Alert.alert(t('exportImport.invalidCode'));
      return;
    }
    successHaptic();
    router.replace(`/torneos/${imported.id}`);
  }

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  return (
    <Screen>
      <Header title={t('exportImport.importTitle')} backHref="/torneos" />
      <Text className="mb-4 text-ink-300">{t('exportImport.importSubtitle')}</Text>

      <AnimatedTextInput
        value={code}
        onChangeText={setCode}
        placeholder={t('exportImport.importPlaceholder')}
        placeholderTextColor={colors.ink[400]}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        // useAnimatedStyle + className loses the className styles on native
        // (see CLAUDE.md 2026-07-17) — native drops the shake, keeps the box
        // styled; web keeps the animated path.
        style={isNative ? undefined : shakeStyle}
        className="mb-5 min-h-32 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
      />

      <Button onPress={handleImport}>{t('exportImport.importButton')}</Button>
    </Screen>
  );
}
