import type { ReactNode } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

// Radios y estados via Claude Design (sesión 2026-07-02): radio 12px, alto
// táctil >=46px. El danger usa un tinte translúcido al pulsar en vez de
// rellenarse de rojo sólido — evita depender de que el texto cambie de color
// junto al fondo del padre (nativewind's group-active no está verificado en
// nativo y esta variante no tenía ningún uso real que lo probara).
const VARIANT_CONFIG: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container:
      'min-h-[46px] rounded-xl bg-pokeRed p-4 shadow-md shadow-pokeRed/40 active:bg-pokeRed-600 disabled:opacity-40 disabled:shadow-none',
    text: 'text-center text-base font-bold text-white',
  },
  secondary: {
    container: 'min-h-[46px] rounded-xl border border-ink-600 p-3 active:bg-ink-700 disabled:opacity-40',
    text: 'text-center font-semibold text-ink-100',
  },
  danger: {
    container: 'min-h-[46px] rounded-xl border-2 border-pokeRed p-3 active:bg-pokeRed/20 disabled:opacity-40',
    text: 'text-center font-semibold text-pokeRed',
  },
};

type ButtonProps = Omit<PressableProps, 'children'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

export function Button({ children, variant = 'primary', className, ...pressableProps }: ButtonProps) {
  const config = VARIANT_CONFIG[variant];
  return (
    <Pressable {...pressableProps} className={`${config.container} ${className ?? ''}`}>
      <Text className={config.text}>{children}</Text>
    </Pressable>
  );
}
