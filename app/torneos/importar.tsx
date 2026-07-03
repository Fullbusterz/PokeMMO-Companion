import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import colors from '@/theme/colors';
import { useTournamentStore } from '@/store/tournamentStore';

export default function ImportTournament() {
  const importTournament = useTournamentStore((s) => s.importTournament);
  const [code, setCode] = useState('');

  function handleImport() {
    const imported = importTournament(code);
    if (!imported) {
      Alert.alert(t('exportImport.invalidCode'));
      return;
    }
    router.replace(`/torneos/${imported.id}`);
  }

  return (
    <Screen>
      <Header title={t('exportImport.importTitle')} />
      <Text className="mb-4 text-ink-300">{t('exportImport.importSubtitle')}</Text>

      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder={t('exportImport.importPlaceholder')}
        placeholderTextColor={colors.ink[400]}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        className="mb-5 min-h-32 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
      />

      <Button onPress={handleImport}>{t('exportImport.importButton')}</Button>
    </Screen>
  );
}
