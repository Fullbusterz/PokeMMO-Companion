import * as Clipboard from 'expo-clipboard';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import { ScrollView, Share, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { BackupParseError, type BackupParseErrorReason } from '@/lib/backup';
import { exportAllData, importAllData } from '@/lib/backupStorage';
import { confirmDestructive } from '@/lib/confirmDialog';
import { successHaptic } from '@/lib/haptics';
import colors from '@/theme/colors';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
// Custom-wrapped component — see src/lib/animatedNativewind.ts for why this is necessary.
cssInterop(AnimatedTextInput, { className: 'style' });

const IMPORT_ERROR_KEYS: Record<BackupParseErrorReason, string> = {
  'invalid-code': 'backup.importErrorInvalidCode',
  'invalid-shape': 'backup.importErrorInvalidShape',
  'unsupported-version': 'backup.importErrorUnsupportedVersion',
  'unknown-store-key': 'backup.importErrorUnknownKey',
  'invalid-store-value': 'backup.importErrorInvalidStore',
  'corrupt-tournament': 'backup.importErrorCorruptTournament',
};

function messageForImportError(error: unknown): string {
  if (error instanceof BackupParseError) return t(IMPORT_ERROR_KEYS[error.reason]);
  return t('backup.importErrorGeneric');
}

export default function BackupScreen() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [importCode, setImportCode] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  async function handleGenerate() {
    setExporting(true);
    try {
      setCode(await exportAllData());
      setCopied(false);
    } finally {
      setExporting(false);
    }
  }

  async function handleCopy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    successHaptic();
  }

  async function handleImport() {
    if (!importCode.trim() || importing) return;
    setImportError(null);
    setImportSuccess(false);

    const confirmed = await confirmDestructive({
      title: t('backup.importConfirmTitle'),
      message: t('backup.importConfirmMessage'),
      confirmLabel: t('backup.importConfirmButton'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;

    setImporting(true);
    try {
      await importAllData(importCode);
      successHaptic();
      setImportSuccess(true);
      setImportCode('');
    } catch (error) {
      setImportError(messageForImportError(error));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Screen>
      <Header title={t('backup.title')} backHref="/" />
      <Text className="mb-6 text-ink-300">{t('backup.subtitle')}</Text>

      <Card className="mb-6 p-4">
        <Text className="mb-1 text-base font-bold text-ink-100">{t('backup.exportSectionTitle')}</Text>
        <Text className="mb-4 text-sm text-ink-400">{t('backup.exportSectionSubtitle')}</Text>

        <Button onPress={handleGenerate} disabled={exporting}>
          {exporting ? t('backup.exportGenerating') : t('backup.exportButton')}
        </Button>

        {code && (
          <Animated.View entering={nativeOnly(FadeInDown.duration(280).springify().damping(18))} className="mt-4">
            <Text className="mb-1 text-sm font-semibold text-ink-400">{t('backup.codeGenerated')}</Text>
            <Card className="mb-3 max-h-48">
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
          </Animated.View>
        )}
      </Card>

      <Card className="p-4">
        <Text className="mb-1 text-base font-bold text-ink-100">{t('backup.importSectionTitle')}</Text>
        <Text className="mb-3 text-sm text-ink-400">{t('backup.importSectionSubtitle')}</Text>

        <AnimatedTextInput
          value={importCode}
          onChangeText={(value) => {
            setImportCode(value);
            setImportError(null);
            setImportSuccess(false);
          }}
          placeholder={t('backup.importPlaceholder')}
          placeholderTextColor={colors.ink[400]}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          className="mb-3 min-h-32 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
        />

        <Text className="mb-3 text-xs text-ink-400">{t('backup.importWarning')}</Text>

        {importError && <Text className="mb-3 text-sm font-semibold text-pokeRed">{importError}</Text>}
        {importSuccess && <Text className="mb-3 text-sm font-semibold text-type-grass" style={{ color: colors.status.progress }}>{t('backup.importSuccess')}</Text>}

        <Button variant="danger" onPress={handleImport} disabled={importing || !importCode.trim()}>
          {t('backup.importButton')}
        </Button>
      </Card>
    </Screen>
  );
}
