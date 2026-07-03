import { Platform } from 'react-native';

// Verified in this project's `expo start --web` setup: Reanimated's
// post-mount reactivity is broken across the board on web — not just
// entering/exiting/layout (which leaves elements stuck at
// `visibility: hidden`), but plain useSharedValue -> useAnimatedStyle
// mutations too (a shared value changed after mount, even a bare assignment
// with no timing function, never reaches the DOM; only the value baked in
// at first render shows up). Likely a version-specific web-engine bug in
// this Reanimated 4.5.0 setup — native (the actual target platform) is
// unaffected and uses the full animation code paths below.
export const isNative = Platform.OS !== 'web';

/** Wrap any entering/exiting/layout animation builder with this — returns undefined on web so the prop is simply omitted there. */
export function nativeOnly<T>(animation: T): T | undefined {
  return isNative ? animation : undefined;
}
