import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { nativeOnly } from '@/lib/animation';
import colors from '@/theme/colors';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
// Custom-wrapped component, not covered by src/lib/animatedNativewind.ts —
// needs its own registration (see that file for why this is necessary).
cssInterop(AnimatedScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const Container = scroll ? AnimatedScrollView : Animated.View;
  return (
    // The gradient is the outermost flex:1 element (not an absolute-fill
    // sibling) — an absolutely-positioned layer inside SafeAreaView broke
    // web's flex sizing, collapsing the whole screen to its content's
    // intrinsic size instead of filling the viewport.
    <LinearGradient colors={[colors.ink[800], colors.ink[900]]} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: 'transparent' }}>
        <Container
          entering={nativeOnly(FadeIn.duration(220))}
          className="flex-1 px-5 py-4"
          contentContainerClassName={scroll ? 'pb-10' : undefined}
        >
          {children}
        </Container>
      </SafeAreaView>
    </LinearGradient>
  );
}
