import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View } from 'react-native';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView className="flex-1 bg-ink-900">
      <Container className="flex-1 px-5 py-4" contentContainerClassName={scroll ? 'pb-10' : undefined}>
        {children}
      </Container>
    </SafeAreaView>
  );
}
