import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { nativeOnly } from '@/lib/animation';
import colors from '@/theme/colors';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
// Custom-wrapped component, not covered by src/lib/animatedNativewind.ts —
// needs its own registration (see that file for why this is necessary).
cssInterop(AnimatedScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });

// The app was built phone-first and never constrained on a wide window, so on
// a desktop browser — which is how the PWA gets used at a table with a laptop
// open — every screen stretched to the full viewport: standings with the name
// pinned left, the numbers pinned right and a metre of empty navy between
// them, and match cards a thousand pixels wide holding two names. Capping the
// content column is the single change that fixes most of that, and it lands on
// every screen at once because they all render through here.
const CONTENT_MAX_WIDTH = 760;

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
          {/* `flex-1` only in the non-scrolling variant: there the child is
              usually a FlatList that has to fill the height, whereas inside a
              ScrollView a flex:1 wrapper would fight the content's own
              height. */}
          <View
            className={`w-full self-center ${scroll ? '' : 'flex-1'}`}
            style={{ maxWidth: CONTENT_MAX_WIDTH }}
          >
            {children}
          </View>
        </Container>
      </SafeAreaView>
    </LinearGradient>
  );
}
