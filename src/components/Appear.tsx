import { useEffect, useState, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { isNative } from '@/lib/animation';
import { EASE, prefersReducedMotion } from '@/lib/webMotion';

// Entrance animation for the web build.
//
// Every entering/exiting animation in this app is wrapped in nativeOnly(),
// because reanimated's post-mount updates never reach the DOM here — which
// left the PWA, the build almost everyone uses, with no motion whatsoever:
// screens appeared fully formed, all at once, which reads as a page load
// rather than as an app. A mounted-then-flipped style plus a CSS transition
// does reach the DOM, costs nothing, and cannot get stuck half-animated the
// way the reanimated path could.
//
// On native this renders a plain View: the reanimated entrances there already
// work and are the ones tuned for that platform.

export function Appear({
  children,
  delay = 0,
  distance = 10,
  duration = 320,
  className,
  style,
  ...viewProps
}: ViewProps & {
  children: ReactNode;
  /** Stagger, in ms — pass index * 50-ish for a list. */
  delay?: number;
  /** How far it travels up into place. */
  distance?: number;
  duration?: number;
}) {
  const skip = isNative || prefersReducedMotion;
  const [shown, setShown] = useState(skip);

  useEffect(() => {
    if (skip) return;
    // A timer rather than an rAF: the first paint has to land with the element
    // still at opacity 0, otherwise there is nothing to transition from.
    const timer = setTimeout(() => setShown(true), Math.max(delay, 16));
    return () => clearTimeout(timer);
  }, [delay, skip]);

  if (skip) {
    return (
      <View className={className} style={style} {...viewProps}>
        {children}
      </View>
    );
  }

  return (
    <View
      className={className}
      style={[
        {
          opacity: shown ? 1 : 0,
          transform: [{ translateY: shown ? 0 : distance }],
          transitionProperty: 'opacity, transform',
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: EASE,
        } as ViewProps['style'],
        style,
      ]}
      {...viewProps}
    >
      {children}
    </View>
  );
}
