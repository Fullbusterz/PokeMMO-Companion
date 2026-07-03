import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { useTournamentStore } from '@/store/tournamentStore';

export default function ExportTournament() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournament = useTournamentStore((s) => s.tournaments.find((tt) => tt.id === id));
  const exportTournament = useTournamentStore((s) => s.exportTournament);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!tournament) {
    return (
      <Screen>
        <Header title={t('exportImport.exportTitle')} />
        <Text className="text-ink-400">{t('tournaments.empty')}</Text>
      </Screen>
    );
  }

  const tournamentId = tournament.id;

  function handleGenerate() {
    setCode(exportTournament(tournamentId));
    setCopied(false);
  }

  async function handleCopy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
  }

  return (
    <Screen scroll={false}>
      <Header title={tournament.name} />
      <Text className="mb-6 text-ink-300">{t('exportImport.exportSubtitle')}</Text>

      {!code && <Button onPress={handleGenerate}>{t('exportImport.exportButton')}</Button>}

      {code && (
        <View className="flex-1">
          <Text className="mb-1 text-sm font-semibold text-ink-400">{t('exportImport.codeGenerated')}</Text>
          <Card className="mb-4 max-h-48">
            <ScrollView contentContainerClassName="p-3">
              <Text selectable className="font-mono text-xs text-ink-100">
                {code}
              </Text>
            </ScrollView>
          </Card>

          <View className="flex-row gap-3">
            <Button variant="secondary" onPress={handleCopy} className="flex-1">
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
            <Button onPress={() => Share.share({ message: code })} className="flex-1">
              {t('common.share')}
            </Button>
          </View>
        </View>
      )}
    </Screen>
  );
}
