import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import { answerQuery, type OracleAnswer } from '@/lib/oracle/intents';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';

const EXAMPLE_KEYS = ['oracle.example1', 'oracle.example2', 'oracle.example3', 'oracle.example4', 'oracle.example5'] as const;

function OracleModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const locale = useLocaleStore((s) => s.locale);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<OracleAnswer | null>(null);

  const runQuery = (text: string) => {
    setAnswer(answerQuery(text, locale));
    setQuery('');
  };

  const handleClose = () => {
    onClose();
    setQuery('');
    setAnswer(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <PressScale haptic="none" onPress={handleClose} className="flex-1 items-center justify-end bg-black/70 p-4">
        <PressScale
          haptic="none"
          onPress={(e) => e.stopPropagation()}
          className="max-h-[85%] w-full max-w-lg rounded-2xl border border-ink-600 bg-ink-800 p-5"
        >
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="help-buoy" size={20} color={colors.pokeRed.DEFAULT} />
              <Text className="text-lg font-bold text-ink-100">{t('oracle.title')}</Text>
            </View>
            <PressScale
              haptic="select"
              scaleTo={0.9}
              onPress={handleClose}
              hitSlop={12}
              className="rounded-full bg-ink-700 p-2"
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={18} color={colors.ink[100]} />
            </PressScale>
          </View>

          <Text className="mb-3 text-xs text-ink-400">{t('oracle.subtitle')}</Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runQuery(query)}
            placeholder={t('oracle.placeholder')}
            placeholderTextColor={colors.ink[400]}
            returnKeyType="search"
            className="mb-3 rounded-xl border border-ink-600 bg-ink-900 px-3 py-2.5 text-sm text-ink-100"
          />

          <PressScale
            haptic="select"
            scaleTo={0.97}
            onPress={() => runQuery(query)}
            className="mb-4 items-center rounded-xl bg-pokeRed py-2.5"
            accessibilityRole="button"
          >
            <Text className="text-sm font-bold text-white">{t('oracle.ask')}</Text>
          </PressScale>

          <ScrollView>
            {answer ? (
              <View className="rounded-xl border border-ink-600 bg-ink-900 p-3">
                <Text className="text-sm leading-5 text-ink-200">{answer.text}</Text>
                {answer.images?.map((uri) => (
                  <Image key={uri} source={{ uri }} className="mt-3 h-40 w-full rounded-lg" resizeMode="contain" />
                ))}
              </View>
            ) : (
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {t('oracle.examplesTitle')}
                </Text>
                {EXAMPLE_KEYS.map((key) => (
                  <PressScale
                    key={key}
                    haptic="select"
                    scaleTo={0.98}
                    onPress={() => runQuery(t(key))}
                    className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2"
                  >
                    <Text className="text-sm text-ink-300">{t(key)}</Text>
                  </PressScale>
                ))}
              </View>
            )}
          </ScrollView>
        </PressScale>
      </PressScale>
    </Modal>
  );
}

export function OracleButton() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <View style={{ position: 'absolute', right: 16, bottom: insets.bottom + 16, pointerEvents: 'box-none' }}>
        <PressScale
          haptic="select"
          scaleTo={0.9}
          onPress={() => setVisible(true)}
          className="h-14 w-14 items-center justify-center rounded-full bg-pokeRed shadow-lg shadow-black/40"
          accessibilityRole="button"
          accessibilityLabel={t('oracle.buttonLabel')}
        >
          <Ionicons name="help" size={26} color="white" />
        </PressScale>
      </View>
      <OracleModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}
