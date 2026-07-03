import { Text, View } from 'react-native';
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

export function StatusBadge({ status, label }: { status: TournamentStatus; label: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <View className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${config.container}`}>
      {status === 'finished' ? (
        <Text className={`text-xs ${config.text}`}>✓</Text>
      ) : (
        <View className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      )}
      <Text className={`text-xs font-semibold uppercase tracking-wide ${config.text}`}>{label}</Text>
    </View>
  );
}
