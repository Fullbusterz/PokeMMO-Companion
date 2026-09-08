import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import type { AnimatedStyle } from 'react-native-reanimated';

import { isNative } from '@/lib/animation';
import { selectHaptic, tapHaptic } from '@/lib/haptics';
import { EASE } from '@/lib/webMotion';

type PressScaleProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  scaleTo?: number;
  /** 'tap' for actions, 'select' for toggling a choice (lighter buzz), 'none' to opt out (e.g. destructive rows that already confirm via Alert). */
  haptic?: 'tap' | 'select' | 'none';
  style?: PressableProps['style'] | AnimatedStyle<ViewStyle>;
};

/**
 * Shared press-feedback wrapper: every tappable surface in the app compresses
 * slightly instead of just flipping colour.
 *
 * Both platforms render a plain Pressable, for different reasons.
 *
 * NATIVE: reanimated >=4.1.1 + nativewind 4.x drops className-derived styles on
 * Animated-wrapped components (upstream regression, see the 2026-07-17 entry in
 * CLAUDE.md) — every PressScale surface rendered unstyled in the release APK.
 * Correct beats animated, so native keeps its styles and loses the scale.
 *
 * WEB: reanimated's post-mount updates never reach the DOM in this project
 * (see animation.ts), so the animated path here was dead code — the PWA, the
 * build almost everybody actually uses, had no press feedback at all. A plain
 * state change plus a CSS transition does reach the DOM, and it is cheaper:
 * pressing in is quick, releasing eases back, which is what makes a tap feel
 * answered rather than merely registered.
 */
// react-native-web waits 50ms before reporting a press start (its
// DEFAULT_PRESS_DELAY_MS, meant to stop things flashing while you scroll). For
// a press scale that is the wrong trade: the feedback should be under the
// finger immediately, and a scroll cancels the press anyway. The prop is
// react-native-web's own, so it is not in the react-native typings.
const NO_PRESS_DELAY = { delayPressIn: 0 } as unknown as PressableProps;

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
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handlePress: PressableProps['onPress'] = (event) => {
    if (haptic === 'tap') tapHaptic();
    else if (haptic === 'select') selectHaptic();
    onPress?.(event);
  };

  if (isNative) {
    return (
      <Pressable
        {...pressableProps}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style as PressableProps['style']}
      >
        {children}
      </Pressable>
    );
  }

  const idle = pressableProps.disabled;
  const motion: ViewStyle = {
    // Press wins over hover: a card that is being clicked should compress, not
    // sit lifted. Hover is a one-pixel rise — enough to answer the cursor on a
    // laptop, small enough that a list does not appear to wobble.
    transform: [
      { scale: pressed && !idle ? scaleTo : 1 },
      { translateY: !pressed && hovered && !idle ? -1 : 0 },
    ],
    // Faster in than out: the compression should feel instant under the
    // finger, the release should settle.
    transitionProperty: 'transform',
    transitionDuration: pressed ? '90ms' : '220ms',
    transitionTimingFunction: EASE,
  } as ViewStyle;

  return (
    <Pressable
      {...pressableProps}
      {...NO_PRESS_DELAY}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPress={handlePress}
      style={[motion, style] as PressableProps['style']}
    >
      {children}
    </Pressable>
  );
}
