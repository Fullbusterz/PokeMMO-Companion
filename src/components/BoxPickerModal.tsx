import { Ionicons } from '@expo/vector-icons';
import { Modal, ScrollView, Text, View } from 'react-native';

import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { t } from '@/i18n';
import { getPokemonById } from '@/lib/pokedex';
import { localizedNatureName } from '@/lib/showdown';
import { useBoxStore, type BoxBuild } from '@/store/boxStore';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';
import type { PokemonEntry } from '@/types/pokemon';

/**
 * Shared "pick a build from Mi caja" picker — used both by the damage
 * calculator (app/danio/index.tsx, preloading a side from a saved build) and
 * the team builder (app/equipos/index.tsx, adding a member from a saved
 * build). Kept as one component instead of two near-identical modals since
 * both callers need the exact same list (sprite + nickname/species + nature
 * + move count) and the same "species no longer resolvable" guard.
 */
export function BoxPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (build: BoxBuild, pokemon: PokemonEntry) => void;
}) {
  const builds = useBoxStore((s) => s.builds);
  const locale = useLocaleStore((s) => s.locale);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <PressScale haptic="none" onPress={onClose} className="flex-1 items-center justify-end bg-black/70 p-4">
        <PressScale
          haptic="none"
          onPress={(e) => e.stopPropagation()}
          className="max-h-[80%] w-full max-w-lg rounded-2xl border border-ink-600 bg-ink-800 p-5"
        >
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-lg font-bold text-ink-100">{t('box.pickerTitle')}</Text>
            <PressScale
              haptic="select"
              scaleTo={0.9}
              onPress={onClose}
              hitSlop={12}
              className="rounded-full bg-ink-700 p-2"
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={18} color={colors.ink[100]} />
            </PressScale>
          </View>

          <ScrollView>
            {builds.length === 0 ? (
              <Text className="text-sm text-ink-400">{t('box.pickerEmpty')}</Text>
            ) : (
              builds.map((build) => {
                const pokemon = getPokemonById(build.pokemonId);
                if (!pokemon) return null;
                return (
                  <PressScale
                    key={build.id}
                    haptic="select"
                    scaleTo={0.98}
                    onPress={() => onSelect(build, pokemon)}
                    className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-900 p-2 active:bg-ink-700"
                  >
                    <PokemonSprite id={pokemon.id} types={pokemon.types} size={36} />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-ink-100">
                        {build.nickname.trim() || pokemon.name.es}
                      </Text>
                      <Text className="text-xs text-ink-400">
                        {pokemon.name.es} · {localizedNatureName(build.nature, locale)} · {t('box.movesCount', { count: build.moves.length })}
                      </Text>
                    </View>
                  </PressScale>
                );
              })
            )}
          </ScrollView>
        </PressScale>
      </PressScale>
    </Modal>
  );
}
