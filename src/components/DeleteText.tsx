import type { ReactNode } from 'react';
import { Text, type PressableProps } from 'react-native';

import { PressScale } from '@/components/PressScale';

type DeleteTextProps = PressableProps & { children: ReactNode };

export function DeleteText({ children, ...pressableProps }: DeleteTextProps) {
  return (
    <PressScale hitSlop={8} scaleTo={0.9} {...pressableProps}>
      <Text className="font-semibold text-pokeRed">{children}</Text>
    </PressScale>
  );
}
