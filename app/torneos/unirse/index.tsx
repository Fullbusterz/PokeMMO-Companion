import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { normalizeJoinCode } from '@/lib/onlineTournament';
import { isOnlineConfigured } from '@/lib/supabase';
import colors from '@/theme/colors';

// The manual way in, for someone who was read the code out loud instead of
// being sent the link. The link itself lands straight on /torneos/unirse/CODE.
export default function JoinByCode() {
  const [code, setCode] = useState('');
  const normalized = normalizeJoinCode(code);

  return (
    <Screen>
      <Header title={t('online.joinTitle')} backHref="/torneos" />

      {!isOnlineConfigured() ? (
        <Text className="text-ink-300">{t('online.notConfigured')}</Text>
      ) : (
        <View>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t('online.joinCodePlaceholder')}
            placeholderTextColor={colors.ink[400]}
            onSubmitEditing={() => normalized && router.push(`/torneos/unirse/${normalized}`)}
            returnKeyType="go"
            className="mb-4 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-center text-xl font-bold tracking-widest text-ink-100"
          />
          <Button disabled={normalized.length < 6} onPress={() => router.push(`/torneos/unirse/${normalized}`)}>
            {t('online.joinButton')}
          </Button>
        </View>
      )}
    </Screen>
  );
}
