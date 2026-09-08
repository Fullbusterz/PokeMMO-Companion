import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { AvatarEditor } from '@/components/AvatarEditor';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import { successHaptic } from '@/lib/haptics';
import { joinAsViewer, type ViewerIdentity, type ViewerRow } from '@/lib/onlineTournament';
import { useAvatars } from '@/lib/useAvatars';
import { loadViewerIdentity, saveViewerIdentity } from '@/lib/viewerIdentity';
import { surfaceTransition } from '@/lib/webMotion';
import colors from '@/theme/colors';
import type { Participant } from '@/types/tournament';

// The organizer's own place in their own tournament.
//
// This used to live inside the betting block, which only appears once betting
// is on AND a round has been paired — so while setting the event up, the one
// person who could not find anywhere to put their photo was the organizer,
// on the screen they were staring at. It is now its own card in the online
// section, visible from the moment the tournament is published.
//
// The credential is the shared one (viewerIdentity), so registering here is
// the same as having opened your own link on this device: the betting panel
// recognises it, and no second viewer row is created.

export function OrganizerIdentity({
  code,
  participants,
  viewerRows,
  nameById,
  onChanged,
}: {
  code: string;
  participants: Participant[];
  viewerRows: ViewerRow[];
  nameById: Map<string, string>;
  onChanged: () => void;
}) {
  const [identity, setIdentity] = useState<ViewerIdentity | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [slotDraft, setSlotDraft] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'taken' | 'error'>('idle');

  useEffect(() => {
    loadViewerIdentity(code)
      .then(setIdentity)
      .finally(() => setLoaded(true));
  }, [code]);

  const avatarByViewer = useAvatars(code, viewerRows);
  const claimedSlots = useMemo(
    () => new Set(viewerRows.map((v) => v.participant_id).filter(Boolean) as string[]),
    [viewerRows]
  );
  const freeSlots = participants.filter((p) => !claimedSlots.has(p.id));
  const isRegistered = Boolean(identity && viewerRows.some((v) => v.id === identity.viewerId));

  async function handleJoin() {
    const displayName = slotDraft ? (nameById.get(slotDraft) ?? '') : nameDraft.trim();
    if (!displayName) return;
    setState('sending');
    try {
      const next = await joinAsViewer(code, displayName, slotDraft);
      await saveViewerIdentity(code, next);
      setIdentity(next);
      setOpen(false);
      setState('idle');
      successHaptic();
      onChanged();
    } catch {
      setState('error');
    }
  }

  if (!loaded) return null;

  if (isRegistered && identity) {
    return (
      <Card skipEntrance className="mb-3 px-3 py-3">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          {t('online.youInTournament')}
        </Text>
        <Text className="mb-2 text-sm text-ink-100">{identity.name}</Text>
        <AvatarEditor
          code={code}
          identity={identity}
          currentUri={avatarByViewer.get(identity.viewerId)}
          onChanged={onChanged}
        />
      </Card>
    );
  }

  return (
    <Card skipEntrance className="mb-3 px-3 py-3">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {t('online.youInTournament')}
      </Text>
      {!open ? (
        <>
          <Text className="mb-2 text-xs text-ink-400">{t('online.organizerPhotoHint')}</Text>
          <PressScale
            haptic="tap"
            scaleTo={0.98}
            onPress={() => setOpen(true)}
            className="rounded-lg border border-gold/40 px-3 py-2.5"
            style={surfaceTransition()}
          >
            <Text className="text-center text-sm font-semibold text-gold">
              {t('online.organizerJoin')}
            </Text>
          </PressScale>
        </>
      ) : (
        <>
          <Text className="mb-2 text-xs text-ink-400">{t('online.organizerPickSlot')}</Text>
          {freeSlots.length > 0 && (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {freeSlots.map((p) => (
                <PressScale
                  key={p.id}
                  haptic="select"
                  scaleTo={0.97}
                  onPress={() => setSlotDraft((current) => (current === p.id ? null : p.id))}
                  className={`rounded-lg border px-3 py-2 ${
                    slotDraft === p.id ? 'border-pokeRed bg-pokeRed/10' : 'border-ink-600'
                  }`}
                  style={surfaceTransition()}
                >
                  <Text className="text-sm text-ink-100">{p.name}</Text>
                </PressScale>
              ))}
            </View>
          )}

          {!slotDraft && (
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t('online.yourNamePlaceholder')}
              placeholderTextColor={colors.ink[400]}
              onSubmitEditing={() => void handleJoin()}
              returnKeyType="done"
              className="mb-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-base text-ink-100"
            />
          )}

          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              disabled={state === 'sending' || (!slotDraft && !nameDraft.trim())}
              onPress={() => void handleJoin()}
            >
              {t('online.enterButton')}
            </Button>
            <Button variant="secondary" className="flex-1" onPress={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </View>
          {state === 'taken' && <Text className="mt-2 text-sm text-pokeRed">{t('online.nameTaken')}</Text>}
          {state === 'error' && <Text className="mt-2 text-sm text-pokeRed">{t('online.joinError')}</Text>}
        </>
      )}
    </Card>
  );
}
