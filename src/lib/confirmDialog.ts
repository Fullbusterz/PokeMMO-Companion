import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

// Alert.alert(title, message, buttons) is a documented no-op on
// react-native-web — it never renders anything and never calls any button's
// onPress, so a destructive action gated only behind it would silently do
// nothing on web (verified: this is exactly what the existing tournament
// "delete" confirmation does today, it just happens not to matter as much
// there as it does here). This wraps both platforms behind one Promise-based
// API: native keeps the familiar Alert sheet, web falls back to
// window.confirm, which does work.
export function confirmDestructive({ title, message, confirmLabel, cancelLabel }: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(`${title}\n\n${message}`) : false;
    return Promise.resolve(confirmed);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
