import type { ReactNode } from 'react';
import { type ViewProps } from 'react-native';
import Animated, { FadeInDown, type AnimatedProps } from 'react-native-reanimated';

import { nativeOnly } from '@/lib/animation';

type CardProps = AnimatedProps<ViewProps> & {
  children: ReactNode;
  className?: string;
  /** Position in a list — staggers the entrance so rows cascade in instead of popping together. */
  index?: number;
  /** Set true for cards that get captured/measured (e.g. share-as-image) — skips the entrance so the capture never catches a mid-animation frame. */
  skipEntrance?: boolean;
};

export function Card({ children, className, index, skipEntrance, ...viewProps }: CardProps) {
  const baseClassName = `rounded-xl border border-gold/30 bg-ink-800 shadow-md shadow-black/30 ${className ?? ''}`;

  if (skipEntrance) {
    return (
      <Animated.View {...viewProps} className={baseClassName}>
        {children}
      </Animated.View>
    );
  }
  return (
    <Animated.View
      {...viewProps}
      entering={nativeOnly(
        FadeInDown.delay((index ?? 0) * 60)
          .duration(280)
          .springify()
          .damping(18)
      )}
      className={baseClassName}
    >
      {children}
    </Animated.View>
  );
}
