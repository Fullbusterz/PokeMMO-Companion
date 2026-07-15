import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { memo, useState } from 'react';
import { Alert, FlatList, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import { Card } from '@/components/Card';
import { DeleteText } from '@/components/DeleteText';
import { Header } from '@/components/Header';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { EV_CAP_TOTAL, totalEvs } from '@/lib/evTraining';
import { useEvSessionStore, type EvSession } from '@/store/evSessionStore';
import colors from '@/theme/colors';

const SessionRow = memo(function SessionRow({
  session,
  index,
  onDelete,
}: {
  session: EvSession;
  index: number;
  onDelete: (id: string) => void;
}) {
  const total = totalEvs(session.current);
  const overLimit = total > EV_CAP_TOTAL;

  function confirmDelete() {
    Alert.alert(t('entreno.deleteConfirmTitle'), t('entreno.deleteConfirmMessage', { name: session.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(session.id) },
    ]);
  }

  return (
    <Card index={index} layout={nativeOnly(Layout.springify().damping(18))} className="mb-3 flex-row items-center">
      <Link href={`/entreno/${session.id}`} asChild>
        <PressScale haptic="select" scaleTo={0.985} className="flex-1 p-4 active:bg-ink-700">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-base font-semibold text-ink-100">{session.name}</Text>
            {overLimit && <Ionicons name="warning" size={16} color={colors.pokeRed.DEFAULT} />}
          </View>
          <Text className="mt-1 text-sm text-ink-400">{t('entreno.totalEvs', { current: total })}</Text>
        </PressScale>
      </Link>
      <DeleteText onPress={confirmDelete} className="px-4 py-4">
        {t('common.delete')}
      </DeleteText>
    </Card>
  );
});

export default function EvTrainingSessions() {
  const sessions = useEvSessionStore((s) => s.sessions);
  const createSession = useEvSessionStore((s) => s.createSession);
  const deleteSession = useEvSessionStore((s) => s.deleteSession);
  const [name, setName] = useState('');

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t('entreno.nameRequiredError'));
      return;
    }
    const session = createSession(trimmed);
    setName('');
    router.push(`/entreno/${session.id}`);
  }

  return (
    <Screen scroll={false}>
      <Header title={t('entreno.title')} />
      <Text className="mb-4 text-sm text-ink-300">{t('entreno.subtitle')}</Text>

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('entreno.newSessionLabel')}</Text>
      <View className="mb-4 flex-row gap-2">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('entreno.namePlaceholder')}
          placeholderTextColor={colors.ink[400]}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
          className="flex-1 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
        />
        <PressScale
          haptic="tap"
          onPress={handleCreate}
          className="items-center justify-center rounded-xl bg-pokeRed px-4 active:bg-pokeRed/80"
          accessibilityRole="button"
          accessibilityLabel={t('entreno.create')}
        >
          <Ionicons name="add" size={20} color="white" />
        </PressScale>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <SessionRow session={item} index={index} onDelete={deleteSession} />}
        ListEmptyComponent={
          <Animated.View entering={nativeOnly(FadeInDown.duration(280))} className="mt-12 items-center">
            <View className="mb-3 rounded-full bg-ink-800 p-4">
              <Ionicons name="barbell-outline" size={28} color={colors.ink[400]} />
            </View>
            <Text className="text-center text-ink-400">{t('entreno.empty')}</Text>
          </Animated.View>
        }
      />
    </Screen>
  );
}
