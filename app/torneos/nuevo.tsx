import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { DeleteText } from '@/components/DeleteText';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { isValidDoubleElimSize } from '@/lib/doubleElimBracket';
import colors from '@/theme/colors';
import { useTournamentStore } from '@/store/tournamentStore';
import type { TournamentFormat } from '@/types/tournament';

const NEXT_VALID_DOUBLE_ELIM_SIZES = [4, 8, 16, 32];

function nextValidDoubleElimSize(count: number): number {
  return NEXT_VALID_DOUBLE_ELIM_SIZES.find((size) => size >= count) ?? NEXT_VALID_DOUBLE_ELIM_SIZES[NEXT_VALID_DOUBLE_ELIM_SIZES.length - 1];
}

export default function NewTournament() {
  const createTournament = useTournamentStore((s) => s.createTournament);
  const [name, setName] = useState('');
  const [participantDraft, setParticipantDraft] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [format, setFormat] = useState<TournamentFormat>('single');

  function addParticipant() {
    const trimmed = participantDraft.trim();
    if (!trimmed) return;
    const isDuplicate = participants.some((p) => p.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      Alert.alert(t('newTournament.duplicateNameError', { name: trimmed }));
      return;
    }
    setParticipants((prev) => [...prev, trimmed]);
    setParticipantDraft('');
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCreate() {
    if (!name.trim()) {
      Alert.alert(t('newTournament.nameRequiredError'));
      return;
    }
    if (participants.length < 2) {
      Alert.alert(t('newTournament.minParticipantsError'));
      return;
    }
    if (format === 'double' && !isValidDoubleElimSize(participants.length)) {
      Alert.alert(
        t('newTournament.doubleElimSizeError', { size: nextValidDoubleElimSize(participants.length) })
      );
      return;
    }
    const tournament = createTournament(name, participants, format);
    router.replace(`/torneos/${tournament.id}`);
  }

  return (
    <Screen>
      <Header title={t('newTournament.title')} />

      <Text className="mb-1 font-medium text-ink-300">{t('newTournament.nameLabel')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('newTournament.namePlaceholder')}
        placeholderTextColor={colors.ink[400]}
        className="mb-5 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
      />

      <Text className="mb-1 font-medium text-ink-300">{t('newTournament.formatLabel')}</Text>
      <View className="mb-5 flex-row gap-2">
        {(['single', 'double'] as const).map((option) => {
          const isSelected = format === option;
          return (
            <Pressable
              key={option}
              onPress={() => setFormat(option)}
              className={`flex-1 rounded-xl border p-3 ${isSelected ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600'}`}
            >
              <Text className={`text-center font-semibold ${isSelected ? 'text-pokeRed' : 'text-ink-300'}`}>
                {option === 'single' ? t('newTournament.formatSingle') : t('newTournament.formatDouble')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {format === 'double' && (
        <Text className="mb-5 text-xs text-ink-400">{t('newTournament.formatDoubleHint')}</Text>
      )}

      <Text className="mb-1 font-medium text-ink-300">{t('newTournament.participantsLabel')}</Text>
      <View className="mb-3 flex-row gap-2">
        <TextInput
          value={participantDraft}
          onChangeText={setParticipantDraft}
          placeholder={t('newTournament.participantPlaceholder')}
          placeholderTextColor={colors.ink[400]}
          onSubmitEditing={addParticipant}
          returnKeyType="done"
          className="flex-1 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
        />
        <Pressable onPress={addParticipant} className="justify-center rounded-xl bg-ink-700 px-4 active:bg-ink-600">
          <Text className="font-semibold text-ink-100">{t('newTournament.addParticipant')}</Text>
        </Pressable>
      </View>

      {participants.map((p, index) => (
        <View key={`${p}-${index}`} className="mb-2 flex-row items-center justify-between rounded-lg bg-ink-800 px-4 py-3">
          <Text className="text-ink-100">{p}</Text>
          <DeleteText onPress={() => removeParticipant(index)}>{t('common.delete')}</DeleteText>
        </View>
      ))}

      <Button onPress={handleCreate} className="mt-6">
        {t('newTournament.create')}
      </Button>
    </Screen>
  );
}
