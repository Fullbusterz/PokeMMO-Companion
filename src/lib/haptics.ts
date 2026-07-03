import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// expo-haptics throws "not available on web" if called directly on web —
// every call site would otherwise need its own Platform check. On native,
// a rejection means something actually failed (module not linked, OS-level
// vibration disabled, etc.) — surface that in dev instead of swallowing it
// silently, since native builds of this app haven't been tested on a real
// device/simulator yet and a silent haptics failure would be invisible.
function reportHapticFailure(err: unknown) {
  if (__DEV__) console.warn('[haptics] failed:', err);
}

export function tapHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(reportHapticFailure);
}

export function selectHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(reportHapticFailure);
}

export function successHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(reportHapticFailure);
}
