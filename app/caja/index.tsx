import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { confirmDestructive } from '@/lib/confirmDialog';
import { getPokemonById } from '@/lib/pokedex';
import { localizedNatureName } from '@/lib/showdown';
import { useBoxStore, type BoxBuild } from '@/store/boxStore';
import { useLocaleStore } from '@/store/localeStore';
import colors from '@/theme/colors';

function BuildRow({ build }: { build: BoxBuild }) {
  const deleteBuild = useBoxStore((s) => s.deleteBuild);
  const duplicateBuild = useBoxStore((s) => s.duplicateBuild);
  const locale = useLocaleStore((s) => s.locale);
  const pokemon = getPokemonById(build.pokemonId);
  if (!pokemon) return null;

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('box.deleteConfirmTitle'),
      message: t('box.deleteConfirmMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (confirmed) deleteBuild(build.id);
  }

  return (
    <PressScale
      haptic="select"
      scaleTo={0.98}
      onPress={() => router.push(`/caja/${build.id}`)}
      className="mb-2 flex-row items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-3 active:bg-ink-700"
    >
      <PokemonSprite id={pokemon.id} types={pokemon.types} size={44} />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink-100">{build.nickname.trim() || pokemon.name.es}</Text>
        <Text className="text-xs text-ink-400">
          {pokemon.name.es} · {localizedNatureName(build.nature, locale)} · {t('box.movesCount', { count: build.moves.length })}
        </Text>
      </View>
      <PressScale
        haptic="select"
        scaleTo={0.9}
        onPress={() => duplicateBuild(build.id)}
        hitSlop={8}
        className="p-1.5"
        accessibilityRole="button"
        accessibilityLabel={t('box.duplicate')}
      >
        <Ionicons name="copy-outline" size={18} color={colors.ink[300]} />
      </PressScale>
      <PressScale
        haptic="select"
        scaleTo={0.9}
        onPress={handleDelete}
        hitSlop={8}
        className="p-1.5"
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
      >
        <Ionicons name="trash-outline" size={18} color={colors.ink[400]} />
      </PressScale>
    </PressScale>
  );
}

export default function BoxList() {
  const builds = useBoxStore((s) => s.builds);

  return (
    <Screen>
      <Header title={t('box.title')} />
      <Text className="mb-4 text-sm text-ink-300">{t('box.subtitle')}</Text>

      <Button onPress={() => router.push('/caja/nuevo')} className="mb-4">
        {t('box.newButton')}
      </Button>

      {builds.length === 0 ? (
        <View className="rounded-xl border border-ink-600 bg-ink-800 p-4">
          <Text className="text-sm text-ink-400">{t('box.empty')}</Text>
        </View>
      ) : (
        builds.map((build) => <BuildRow key={build.id} build={build} />)
      )}
    </Screen>
  );
}
