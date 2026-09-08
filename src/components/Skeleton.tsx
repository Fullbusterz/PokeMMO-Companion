import { useEffect, useState } from 'react';
import { View, type ViewProps } from 'react-native';

import { isNative } from '@/lib/animation';
import { EASE, prefersReducedMotion } from '@/lib/webMotion';

// Placeholder blocks in the shape of the content that is coming, instead of a
// spinner. A spinner says "something is happening"; a skeleton says "this is
// what you are about to get", which is the difference between a screen that
// feels slow and one that feels like it is already loading your tournament.
//
// The pulse is driven by ONE module-level ticker shared by every skeleton on
// screen, rather than a timer each: a dozen placeholders should not mean a
// dozen intervals, and sharing it also keeps them in phase, which is what
// makes the group read as one loading surface.

const subscribers = new Set<(on: boolean) => void>();
let pulseOn = false;
let ticker: ReturnType<typeof setInterval> | undefined;

function usePulse(): boolean {
  const [on, setOn] = useState(pulseOn);

  useEffect(() => {
    if (isNative || prefersReducedMotion) return;
    subscribers.add(setOn);
    ticker ??= setInterval(() => {
      pulseOn = !pulseOn;
      subscribers.forEach((notify) => notify(pulseOn));
    }, 800);
    return () => {
      subscribers.delete(setOn);
      if (subscribers.size === 0 && ticker) {
        clearInterval(ticker);
        ticker = undefined;
      }
    };
  }, []);

  return on;
}

export function Skeleton({
  height = 14,
  width,
  radius = 8,
  className,
  style,
  ...viewProps
}: ViewProps & { height?: number; width?: number | string; radius?: number }) {
  const on = usePulse();
  const animated = !isNative && !prefersReducedMotion;

  return (
    <View
      className={`bg-ink-700 ${className ?? ''}`}
      style={[
        {
          height,
          width: (width ?? '100%') as number,
          borderRadius: radius,
          opacity: animated ? (on ? 0.75 : 0.4) : 0.5,
          ...(animated
            ? {
                transitionProperty: 'opacity',
                transitionDuration: '800ms',
                transitionTimingFunction: EASE,
              }
            : null),
        } as ViewProps['style'],
        style,
      ]}
      {...viewProps}
    />
  );
}

/** The shape of the join screen while its tournament is on the way. */
export function TournamentSkeleton() {
  return (
    <View>
      <Skeleton height={12} width={140} className="mb-4" />
      <View className="mb-6 rounded-xl border border-ink-700 p-4">
        <Skeleton height={16} width={120} className="mb-3" />
        <Skeleton height={54} radius={12} className="mb-2" />
        <Skeleton height={54} radius={12} className="mb-3" />
        <Skeleton height={44} radius={12} />
      </View>
      <Skeleton height={12} width={110} className="mb-3" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={46} radius={10} className="mb-2" />
      ))}
    </View>
  );
}
