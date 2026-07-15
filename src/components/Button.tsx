import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, type PressableProps } from 'react-native';

import { PressScale } from '@/components/PressScale';
import colors from '@/theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

// Radios y estados via Claude Design (sesión 2026-07-02): radio 12px, alto
// táctil >=46px. El danger usa un tinte translúcido al pulsar en vez de
// rellenarse de rojo sólido — evita depender de que el texto cambie de color
// junto al fondo del padre (nativewind's group-active no está verificado en
// nativo y esta variante no tenía ningún uso real que lo probara).
const VARIANT_CONFIG: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container:
      'min-h-[46px] rounded-xl overflow-hidden p-4 shadow-md shadow-pokeRed/40 disabled:opacity-40 disabled:shadow-none',
    text: 'text-center text-base font-bold text-white',
  },
  secondary: {
    container: 'min-h-[46px] rounded-xl border border-gold/40 p-3 active:bg-ink-700 disabled:opacity-40',
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
    <PressScale {...pressableProps} scaleTo={0.96} className={`${config.container} ${className ?? ''}`}>
      {variant === 'primary' && (
        <LinearGradient
          colors={[colors.pokeRed[400], colors.pokeRed.DEFAULT, colors.pokeRed[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text className={config.text}>{children}</Text>
    </PressScale>
  );
}
