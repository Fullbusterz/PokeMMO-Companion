import { isNative } from './animation';

// Reanimated's post-mount reactivity is broken on web in this setup (see
// animation.ts), which is why every entering/layout animation in the app is
// wrapped in nativeOnly() — and why the PWA, the build most people actually
// use, has had no motion at all.
//
// CSS transitions are the way back. react-native-web maps `transitionProperty`
// / `transitionDuration` / `transitionTimingFunction` straight onto the CSS
// properties, so a style value that changes between renders animates instead
// of snapping, with no shared values and nothing to get stuck. On native these
// props are meaningless, so the helpers return undefined there and the
// existing Reanimated/PressScale paths keep doing the work.

/** Curve used across the app: quick out, gentle settle. */
export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export type TransitionStyle = Record<string, string | number> | undefined;

/**
 * Web-only CSS transition. Pass the properties that change with state —
 * usually colors and transforms — and they'll ease instead of jumping.
 *
 *   style={transition(['background-color', 'border-color'])}
 */
export function transition(properties: string[], durationMs = 180): TransitionStyle {
  if (isNative) return undefined;
  return {
    transitionProperty: properties.join(', '),
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: EASE,
  };
}

/** The common case: a surface whose colours change when selected or hovered. */
export function surfaceTransition(durationMs = 180): TransitionStyle {
  return transition(['background-color', 'border-color', 'color', 'opacity', 'transform'], durationMs);
}
