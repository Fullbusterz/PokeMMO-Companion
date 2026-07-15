import { Image, Text, View } from 'react-native';

import { LOCAL_POKEMON_SPRITES } from '@/lib/localPokemonSprites';
import type { PokeType } from '@/lib/typeChart';
import colors from '@/theme/colors';

/**
 * Renders a Pokémon's visual — real fan art where we have it (bundled
 * locally, licensed from KingOfThe-X-Roads on DeviantArt for this
 * non-commercial project), otherwise an "unrevealed" silhouette card: dark
 * fill, a ring in the Pokémon's own type color, and a plain "?" — the same
 * visual language the official games use for a Pokémon you haven't seen yet.
 *
 * The project's own rule (CLAUDE.md, "Qué NO hacer en v1") is to avoid
 * official Nintendo/Game Freak assets, and a second fan-art source was
 * evaluated and rejected (2026-07-11 — the only other candidates found were
 * either fakemon or bare compilations of the official sprites, i.e. exactly
 * what this is meant to avoid). So for the ~464 of 649 entries with no
 * licensed art yet, this draws no likeness of any specific Pokémon at all —
 * just its type(s), which are game data, not character art.
 */
export function PokemonSprite({ id, types, size = 40 }: { id?: number; types: string[]; size?: number }) {
  const localSource = id != null ? LOCAL_POKEMON_SPRITES[id] : undefined;
  if (localSource) {
    return <Image source={localSource} style={{ width: size, height: size }} resizeMode="contain" />;
  }

  const validTypes = types.filter((t): t is PokeType => t in colors.type);
  const primary = colors.type[validTypes[0]] ?? colors.ink[400];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        borderWidth: Math.max(1.5, size * 0.035),
        borderColor: primary,
        backgroundColor: colors.ink[800],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: '700', color: primary }}>?</Text>
    </View>
  );
}
