import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Appear } from '@/components/Appear';
import { isNative } from '@/lib/animation';

// One entrance, two engines: reanimated on native (where it works and is
// tuned), CSS on web (where reanimated's post-mount updates never reach the
// DOM). Callers just say "come in, after this delay" and stop caring which
// platform they are on.

export function Enter({
  children,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: ViewProps['style'];
}) {
  if (isNative) {
    return (
      <Animated.View
        entering={FadeInDown.delay(delay).duration(300).springify().damping(18)}
        className={className}
        style={style}
      >
        {children}
      </Animated.View>
    );
  }
  return (
    <Appear delay={delay} className={className} style={style}>
      {children}
    </Appear>
  );
}
