import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { isNative } from '@/lib/animation';
import type { TournamentStatus } from '@/types/tournament';

// Colores y semántica via Claude Design (sesión 2026-07-02): setup = slate
// latente, in_progress = verde "live" con punto pulsante, finished = azul
// asentado con check.
const STATUS_CONFIG: Record<TournamentStatus, { dot: string; container: string; text: string }> = {
  setup: {
    dot: 'bg-status-setup',
    container: 'border-ink-600 bg-ink-700',
    text: 'text-ink-100',
  },
  in_progress: {
    dot: 'bg-status-progress',
    container: 'border-status-progress/40 bg-status-progress/10',
    text: 'text-status-progress',
  },
  finished: {
    dot: 'bg-status-finished',
    container: 'border-status-finished/40 bg-status-finished/10',
    text: 'text-status-finished',
  },
};

function LiveDot({ className }: { className: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Post-mount shared-value updates never reach the DOM on web (see
    // src/lib/animation.ts) — the dot just stays solid there, which reads
    // fine as a static "live" indicator instead of a broken pulse.
    if (!isNative) return;
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={animatedStyle} className={`h-1.5 w-1.5 rounded-full ${className}`} />;
}

export function StatusBadge({ status, label }: { status: TournamentStatus; label: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <View className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${config.container}`}>
      {status === 'finished' ? (
        <Text className={`text-xs ${config.text}`}>✓</Text>
      ) : status === 'in_progress' ? (
        <LiveDot className={config.dot} />
      ) : (
        <View className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      )}
      <Text className={`text-xs font-semibold uppercase tracking-wide ${config.text}`}>{label}</Text>
    </View>
  );
}
