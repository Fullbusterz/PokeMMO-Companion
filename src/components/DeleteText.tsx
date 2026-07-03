import type { ReactNode } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

type DeleteTextProps = PressableProps & { children: ReactNode };

export function DeleteText({ children, ...pressableProps }: DeleteTextProps) {
  return (
    <Pressable hitSlop={8} {...pressableProps}>
      <Text className="font-semibold text-pokeRed">{children}</Text>
    </Pressable>
  );
}
