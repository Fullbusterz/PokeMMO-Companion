import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Modal, Text, View, useWindowDimensions } from 'react-native';

import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import { EASE, prefersReducedMotion } from '@/lib/webMotion';
import { isNative } from '@/lib/animation';
import colors from '@/theme/colors';

// Tap a face, see the face. Profile pictures are 128px and drawn at 22-44px in
// the lists, which is enough to recognise someone you already know and not
// enough to actually look at the photo they chose — and choosing one is half
// the fun of having them.
//
// It lives behind a context rather than a prop on every screen because the
// avatars are scattered (roster rows, chip leaderboard, your own card) and a
// single modal at the root avoids each of those screens owning its own copy of
// the same thing.
//
// IMPORTANT: only make an avatar viewable where its row is NOT itself
// pressable. On touch, a Pressable inside another Pressable does not reliably
// win the responder (see the 2026-07-15 note in CLAUDE.md), and in a match card
// the surrounding press is what picks the winner — a mis-hit there would record
// a result. Match cards therefore keep plain, non-tappable avatars.

type OpenArgs = { uri: string; name: string };

const AvatarViewerContext = createContext<((args: OpenArgs) => void) | null>(null);

export function useAvatarViewer(): ((args: OpenArgs) => void) | null {
  return useContext(AvatarViewerContext);
}

export function AvatarViewerProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<OpenArgs | null>(null);
  // Separate from `shown` so the content can mount small and transparent and
  // then flip: a transition needs two states, and setting both at once would
  // just snap (the same lesson as Appear).
  const [entered, setEntered] = useState(false);
  const open = useCallback((args: OpenArgs) => setShown(args), []);
  const close = useCallback(() => {
    setEntered(false);
    setShown(null);
  }, []);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setEntered(true), 16);
    return () => clearTimeout(timer);
  }, [shown]);

  // Big, but never bigger than the screen or than the picture itself has
  // pixels to fill: a 128px JPEG blown up to 400 is just a blurry 128px JPEG.
  // Guarded against a zero-sized window (it happens: a hidden browser pane
  // reports innerWidth 0, and a 0px avatar is not a useful thing to render).
  const shortest = Math.min(width || 360, height || 640);
  const size = Math.max(180, Math.min(320, Math.round(shortest * 0.7)));

  const entrance =
    isNative || prefersReducedMotion
      ? undefined
      : ({
          opacity: entered ? 1 : 0,
          transform: [{ scale: entered ? 1 : 0.94 }],
          transitionProperty: 'transform, opacity',
          transitionDuration: '220ms',
          transitionTimingFunction: EASE,
        } as const);

  return (
    <AvatarViewerContext.Provider value={open}>
      {children}
      <Modal
        visible={shown !== null}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <PressScale
          haptic="none"
          scaleTo={1}
          onPress={close}
          className="flex-1 items-center justify-center p-6"
          // Explicit colour rather than a Tailwind class: a NEW class does not
          // reach the compiled CSS in this project without a dev-server restart
          // (documented in CLAUDE.md), and a backdrop that silently comes out
          // transparent is exactly the failure you do not want in the one
          // component whose whole job is to darken everything behind it.
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.92)' }}
        >
          {shown && (
            <View className="items-center" style={entrance}>
              <View
                className="overflow-hidden border-2 border-gold/50"
                style={{ width: size, height: size, borderRadius: size / 2 }}
              >
                <Image
                  source={{ uri: shown.uri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityLabel={shown.name}
                />
              </View>
              <Text className="mt-4 text-lg font-semibold text-ink-100">{shown.name}</Text>
              <Text className="mt-1 text-xs text-ink-400">{t('avatar.tapToClose')}</Text>
            </View>
          )}
          <PressScale
            haptic="select"
            scaleTo={0.9}
            onPress={close}
            hitSlop={12}
            className="absolute right-5 top-10 rounded-full p-2.5"
            style={{ backgroundColor: colors.ink[800] }}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={20} color={colors.ink[100]} />
          </PressScale>
        </PressScale>
      </Modal>
    </AvatarViewerContext.Provider>
  );
}
