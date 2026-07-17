import type { ReactNode } from 'react';
import { cssInterop } from 'nativewind';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type AnimatedStyle,
} from 'react-native-reanimated';

import { isNative } from '@/lib/animation';
import { selectHaptic, tapHaptic } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Nativewind only auto-wires `className` -> `style` for components it
// recognizes out of the box (View, Text, Pressable, Animated.View, ...) — a
// freshly created Animated.createAnimatedComponent() result isn't one of
// those, so without this it silently renders with zero Tailwind styles
// applied (verified: every PressScale-based button rendered as an unstyled
// box in the web preview until this was added).
cssInterop(AnimatedPressable, { className: 'style' });

// Snappy in, slightly slower out — reads as a deliberate press rather than a
// toggle. Tuned by feel, not against a spec.
const PRESS_IN_SPRING = { stiffness: 500, damping: 30 };
const PRESS_OUT_SPRING = { stiffness: 300, damping: 20 };

type PressScaleProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  scaleTo?: number;
  /** 'tap' for actions, 'select' for toggling a choice (lighter buzz), 'none' to opt out (e.g. destructive rows that already confirm via Alert). */
  haptic?: 'tap' | 'select' | 'none';
  style?: PressableProps['style'] | AnimatedStyle<ViewStyle>;
};

/** Shared press-feedback wrapper: every tappable surface in the app should compress slightly instead of just flipping color instantly. */
export function PressScale({
  children,
  scaleTo = 0.97,
  haptic = 'tap',
  style,
  onPressIn,
  onPressOut,
  onPress,
  ...pressableProps
}: PressScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // reanimated >=4.1.1 + nativewind 4.x drops className-derived styles on
  // Animated-wrapped components ON NATIVE (upstream regression, see the
  // 2026-07-17 entry in CLAUDE.md) — every PressScale surface rendered
  // unstyled in the release APK. Until upstream fixes it, native renders a
  // plain Pressable: no press-scale animation, but haptics and (crucially)
  // Tailwind styles work. Web keeps the animated path, which is unaffected.
  if (isNative) {
    return (
      <Pressable
        {...pressableProps}
        onPress={(e) => {
          if (haptic === 'tap') tapHaptic();
          else if (haptic === 'select') selectHaptic();
          onPress?.(e);
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style as PressableProps['style']}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <AnimatedPressable
      {...pressableProps}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, PRESS_IN_SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, PRESS_OUT_SPRING);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic === 'tap') tapHaptic();
        else if (haptic === 'select') selectHaptic();
        onPress?.(e);
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
