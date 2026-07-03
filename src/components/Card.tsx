import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

type CardProps = ViewProps & {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className, ...viewProps }: CardProps) {
  return (
    <View {...viewProps} className={`rounded-xl border border-ink-600 bg-ink-800 ${className ?? ''}`}>
      {children}
    </View>
  );
}
