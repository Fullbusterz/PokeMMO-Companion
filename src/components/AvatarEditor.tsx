import { useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import { AvatarPickerUnavailable, MAX_AVATAR_CHARS, pickAvatar } from '@/lib/avatarPicker';
import { successHaptic } from '@/lib/haptics';
import { clearViewerAvatar, setViewerAvatar, type ViewerIdentity } from '@/lib/onlineTournament';
import { surfaceTransition } from '@/lib/webMotion';

// Your own picture, on your own row. Deliberately placed next to "you are X"
// rather than on a settings screen of its own: the only moment anyone thinks
// about this is right after entering by the link, and a picture nobody finds
// is the same as no picture.

export function AvatarEditor({
  code,
  identity,
  currentUri,
  onChanged,
}: {
  code: string;
  identity: ViewerIdentity;
  currentUri?: string | null;
  onChanged: () => void;
}) {
  const [state, setState] = useState<'idle' | 'working' | 'error' | 'unavailable' | 'tooBig'>('idle');

  async function handlePick() {
    setState('working');
    try {
      const image = await pickAvatar();
      if (!image) return setState('idle');
      if (image.length > MAX_AVATAR_CHARS) return setState('tooBig');
      await setViewerAvatar(code, identity, image);
      setState('idle');
      successHaptic();
      onChanged();
    } catch (error) {
      setState(error instanceof AvatarPickerUnavailable ? 'unavailable' : 'error');
    }
  }

  async function handleClear() {
    setState('working');
    try {
      await clearViewerAvatar(code, identity);
      setState('idle');
      onChanged();
    } catch {
      setState('error');
    }
  }

  return (
    <View>
      <View className="flex-row items-center gap-3">
        <Avatar name={identity.name} uri={currentUri} size={44} tone="gold" viewable />
        <View className="flex-1 flex-row flex-wrap gap-2">
          <PressScale
            haptic="tap"
            scaleTo={0.97}
            disabled={state === 'working'}
            onPress={() => void handlePick()}
            className="rounded-lg border border-gold/40 px-3 py-2"
            style={surfaceTransition()}
          >
            <Text className="text-xs font-semibold text-gold">
              {state === 'working'
                ? t('avatar.working')
                : currentUri
                  ? t('avatar.change')
                  : t('avatar.add')}
            </Text>
          </PressScale>
          {currentUri && state !== 'working' && (
            <PressScale
              haptic="tap"
              scaleTo={0.97}
              onPress={() => void handleClear()}
              className="rounded-lg border border-ink-600 px-3 py-2"
              style={surfaceTransition()}
            >
              <Text className="text-xs text-ink-400">{t('avatar.remove')}</Text>
            </PressScale>
          )}
        </View>
      </View>
      {state === 'error' && <Text className="mt-2 text-xs text-pokeRed">{t('avatar.error')}</Text>}
      {state === 'tooBig' && <Text className="mt-2 text-xs text-pokeRed">{t('avatar.tooBig')}</Text>}
      {state === 'unavailable' && (
        <Text className="mt-2 text-xs text-ink-400">{t('avatar.unavailable')}</Text>
      )}
    </View>
  );
}
