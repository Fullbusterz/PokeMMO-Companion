import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import colors from '@/theme/colors';

export default function Home() {
  return (
    <Screen>
      <Animated.View
        entering={nativeOnly(FadeInUp.duration(320))}
        className="mb-6 mt-2 flex-row items-center gap-2"
      >
        <View className="rounded-lg bg-pokeRed/15 p-1.5">
          <Ionicons name="game-controller" size={20} color={colors.pokeRed.DEFAULT} />
        </View>
        <Text className="text-3xl font-bold text-ink-100">{t('home.title')}</Text>
      </Animated.View>

      <Animated.View entering={nativeOnly(FadeInDown.delay(80).duration(320).springify().damping(18))}>
        <Link href="/torneos" asChild>
          <PressScale scaleTo={0.98} className="mb-3 overflow-hidden rounded-2xl p-5 shadow-md shadow-pokeRed/40">
            <LinearGradient
              colors={[colors.pokeRed[400], colors.pokeRed.DEFAULT, colors.pokeRed[600]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View className="mb-2 h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <Ionicons name="trophy" size={18} color="white" />
            </View>
            <Text className="text-lg font-bold text-white">{t('home.tournamentsCard')}</Text>
            <Text className="mt-1 text-white/80">{t('home.tournamentsCardSubtitle')}</Text>
          </PressScale>
        </Link>
      </Animated.View>

      <Animated.View entering={nativeOnly(FadeInDown.delay(160).duration(320).springify().damping(18))}>
        <Link href="/pokedex" asChild>
          <PressScale
            scaleTo={0.98}
            className="rounded-2xl border border-ink-600 bg-ink-800 p-5 shadow-md shadow-black/30 active:bg-ink-700"
          >
            <View className="mb-2 h-9 w-9 items-center justify-center rounded-full bg-type-grass/15">
              <Ionicons name="book" size={18} color={colors.type.grass} />
            </View>
            <Text className="text-lg font-bold text-ink-100">{t('home.pokedexCard')}</Text>
            <Text className="mt-1 text-ink-400">{t('home.pokedexCardSubtitle')}</Text>
          </PressScale>
        </Link>
      </Animated.View>
    </Screen>
  );
}
