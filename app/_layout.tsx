import '../global.css';
import '@/lib/animatedNativewind';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';

import colors from '@/theme/colors';

// Fire-and-forget, once at module load: avoids a white flash behind the RN
// root view on native cold start before JS paints the dark screens.
SystemUI.setBackgroundColorAsync(colors.ink[900]);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
