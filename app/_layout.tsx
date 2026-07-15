import '../global.css';
import '@/lib/animatedNativewind';
import { PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic, useFonts } from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { View } from 'react-native';

import { OracleButton } from '@/components/OracleButton';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';

// Fire-and-forget, once at module load: avoids a white flash behind the RN
// root view on native cold start before JS paints the dark screens.
SystemUI.setBackgroundColorAsync(colors.ink[900]);

export default function RootLayout() {
  // `t()` reads i18n-js's mutable `i18n.locale` synchronously and isn't
  // reactive on its own, so switching language elsewhere in the app can't
  // make already-mounted screens re-render just by itself. Keying the whole
  // stack on the locale forces every screen to unmount/remount when it
  // changes, so every `t(...)` call in JSX re-evaluates against the new
  // language. This does reset any in-progress local component state (typed
  // text, scroll position, expanded sections) — acceptable since language
  // switching is a deliberate, infrequent action, not something done mid-task.
  const locale = useLocaleStore((s) => s.locale);
  // Display serif for headings only (see src/theme/fonts.ts) — part of the
  // "Mapa de región" visual direction (2026-07-10). Body text stays on the
  // system font; loading just these two weights keeps the bundle small.
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.ink[900] }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack key={locale} screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
        <OracleButton />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
