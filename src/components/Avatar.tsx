import { Image, Text, View } from 'react-native';

import { useAvatarViewer } from '@/components/AvatarViewer';
import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';

// One disc, two states: a photo if the person uploaded one, their initial if
// not. The initial version is exactly what the match cards already drew, so
// adding pictures changed nothing for anyone who never uploads one — the
// layout is identical either way, which is what keeps a round of matches from
// jumping around as people add their faces mid-event.

export type AvatarTone = 'winner' | 'loser' | 'neutral' | 'gold';

const TONE_RING: Record<AvatarTone, string> = {
  winner: 'border-pokeRed/60 bg-pokeRed/20',
  loser: 'border-ink-700 bg-transparent',
  neutral: 'border-ink-600 bg-ink-800',
  gold: 'border-gold/60 bg-ink-800',
};

const TONE_TEXT: Record<AvatarTone, string> = {
  winner: 'text-pokeRed',
  loser: 'text-ink-400',
  neutral: 'text-ink-300',
  gold: 'text-gold',
};

export function Avatar({
  name,
  uri,
  size = 28,
  tone = 'neutral',
  viewable = false,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  tone?: AvatarTone;
  /**
   * Tap to see the picture full size. Only pass this where the surrounding row
   * is NOT itself pressable — see the note in AvatarViewer: a nested press does
   * not reliably win on touch, and in a match card the outer press records a
   * result.
   */
  viewable?: boolean;
}) {
  const openViewer = useAvatarViewer();
  const radius = size / 2;

  const disc = (
    <View
      className={`items-center justify-center overflow-hidden rounded-full border ${TONE_RING[tone]}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
          accessibilityLabel={name}
        />
      ) : (
        <Text
          className={`font-bold ${TONE_TEXT[tone]}`}
          style={{ fontSize: Math.max(10, Math.round(size * 0.42)) }}
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );

  if (!viewable || !uri || !openViewer) return disc;

  return (
    <PressScale
      haptic="select"
      scaleTo={0.92}
      onPress={() => openViewer({ uri, name })}
      accessibilityRole="button"
      accessibilityLabel={t('avatar.viewOf', { name })}
    >
      {disc}
    </PressScale>
  );
}
