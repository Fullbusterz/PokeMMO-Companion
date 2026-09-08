import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { isNative, nativeOnly } from '@/lib/animation';
import { EASE, prefersReducedMotion } from '@/lib/webMotion';
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

// Every screen fades and rises very slightly on arrival. On native that is
// reanimated's FadeIn; on web reanimated's post-mount updates never reach the
// DOM (see animation.ts), so it is a mounted-then-flipped style with a CSS
// transition — the same trick as Appear, applied here so it reaches all ~20
// screens at once instead of asking each to opt in. Deliberately quick and
// small: this is the difference between a screen that arrives and one that is
// abruptly just there, not an effect anyone should notice.
function useScreenEntrance() {
  const skip = isNative || prefersReducedMotion;
  const [shown, setShown] = useState(skip);
  useEffect(() => {
    if (skip) return;
    const timer = setTimeout(() => setShown(true), 16);
    return () => clearTimeout(timer);
  }, [skip]);

  if (skip) return undefined;
  return {
    opacity: shown ? 1 : 0,
    transform: [{ translateY: shown ? 0 : 6 }],
    transitionProperty: 'opacity, transform',
    transitionDuration: '260ms',
    transitionTimingFunction: EASE,
  } as const;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const Container = scroll ? AnimatedScrollView : Animated.View;
  const entrance = useScreenEntrance();
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
            style={[{ maxWidth: CONTENT_MAX_WIDTH }, entrance]}
          >
            {children}
          </View>
        </Container>
      </SafeAreaView>
    </LinearGradient>
  );
}
