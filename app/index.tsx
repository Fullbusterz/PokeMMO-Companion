import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { LanguageToggle } from '@/components/LanguageToggle';
import { PokemonSprite } from '@/components/PokemonSprite';
import { PressScale } from '@/components/PressScale';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { getPokemonById } from '@/lib/pokedex';
import { useShinyStore } from '@/store/shinyStore';
import colors from '@/theme/colors';
import { displayFont } from '@/theme/fonts';

function ShinyWidget() {
  const hunts = useShinyStore((s) => s.hunts);
  const activeHuntId = useShinyStore((s) => s.activeHuntId);
  const increment = useShinyStore((s) => s.increment);
  const activeHunt = hunts.find((h) => h.id === activeHuntId);
  if (!activeHunt) return null;

  const pokemon = getPokemonById(activeHunt.pokemonId);
  if (!pokemon) return null;

  return (
    <Animated.View entering={nativeOnly(FadeInDown.delay(40).duration(320))} className="mb-4">
      <Link href="/shinies" asChild>
        <PressScale
          scaleTo={0.98}
          className="flex-row items-center gap-3 rounded-2xl border border-gold/30 bg-ink-800 p-3 active:bg-ink-700"
        >
          <PokemonSprite id={pokemon.id} types={pokemon.types} size={44} />
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t('home.shinyWidgetTitle')}</Text>
            <Text className="text-sm font-bold text-ink-100">{pokemon.name.es}</Text>
            <Text className="text-xs text-ink-400">{t('home.shinyWidgetEncounters', { count: activeHunt.count })}</Text>
          </View>
        </PressScale>
      </Link>
      <PressScale
        haptic="select"
        scaleTo={0.9}
        onPress={() => increment(activeHunt.id)}
        className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-pokeRed"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={18} color="white" />
      </PressScale>
    </Animated.View>
  );
}

/** Diamond icon frame (rotated square border) — the "waypoint marker" motif of the map direction, used instead of a filled circular badge. */
function WaypointIcon({ name, color, tone = 'default' }: { name: keyof typeof Ionicons.glyphMap; color: string; tone?: 'default' | 'onDark' }) {
  return (
    <View
      className="mb-2 h-9 w-9 items-center justify-center"
      style={{
        transform: [{ rotate: '45deg' }],
        borderWidth: 1.5,
        borderColor: tone === 'onDark' ? 'rgba(255,255,255,0.55)' : colors.gold.DEFAULT,
        backgroundColor: tone === 'onDark' ? 'rgba(255,255,255,0.12)' : 'rgba(201,164,107,0.08)',
      }}
    >
      <View style={{ transform: [{ rotate: '-45deg' }] }}>
        <Ionicons name={name} size={16} color={color} />
      </View>
    </View>
  );
}

/** One waypoint on the home "trail" — a pin on the dotted line plus its destination card. */
function Waypoint({
  href,
  icon,
  iconColor,
  title,
  subtitle,
  index,
}: {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  index: number;
}) {
  return (
    <Animated.View
      entering={nativeOnly(FadeInDown.delay(80 + index * 80).duration(320).springify().damping(18))}
      className="relative mb-3 pl-5"
    >
      <View
        className="absolute rounded-full bg-pokeRed"
        style={{ left: 1, top: 22, width: 9, height: 9 }}
      />
      <Link href={href} asChild>
        <PressScale
          scaleTo={0.98}
          className="rounded-2xl border border-gold/30 bg-ink-800 p-5 shadow-md shadow-black/30 active:bg-ink-700"
        >
          <WaypointIcon name={icon} color={iconColor} />
          <Text className="text-lg text-ink-100" style={{ fontFamily: displayFont.regular }}>
            {title}
          </Text>
          <Text className="mt-1 text-ink-400">{subtitle}</Text>
        </PressScale>
      </Link>
    </Animated.View>
  );
}

export default function Home() {
  return (
    <Screen>
      <Animated.View
        entering={nativeOnly(FadeInUp.duration(320))}
        className="mb-6 mt-2 flex-row items-center justify-between gap-2"
      >
        <View className="flex-row items-center gap-2">
          <View
            className="h-9 w-9 items-center justify-center"
            style={{ transform: [{ rotate: '45deg' }], borderWidth: 1.5, borderColor: colors.gold.DEFAULT }}
          >
            <View style={{ transform: [{ rotate: '-45deg' }] }}>
              <Ionicons name="game-controller" size={18} color={colors.pokeRed.DEFAULT} />
            </View>
          </View>
          <Text className="text-3xl text-ink-100" style={{ fontFamily: displayFont.regular }}>
            {t('home.title')}
          </Text>
        </View>
        <LanguageToggle />
      </Animated.View>

      <ShinyWidget />

      <View className="relative">
        <View
          className="absolute"
          style={{ left: 6, top: 8, bottom: 30, borderLeftWidth: 2, borderLeftColor: colors.gold.DEFAULT, borderStyle: 'dashed', opacity: 0.35 }}
        />

        <Animated.View
          entering={nativeOnly(FadeInDown.delay(80).duration(320).springify().damping(18))}
          className="relative mb-3 pl-5"
        >
          <View className="absolute rounded-full bg-pokeRed" style={{ left: 1, top: 22, width: 9, height: 9 }} />
          <Link href="/torneos" asChild>
            <PressScale
              scaleTo={0.98}
              className="overflow-hidden rounded-2xl border border-gold/50 p-5 shadow-md shadow-pokeRed/40"
            >
              <LinearGradient
                colors={[colors.pokeRed[400], colors.pokeRed.DEFAULT, colors.pokeRed[600]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <WaypointIcon name="trophy" color="white" tone="onDark" />
              <Text className="text-lg text-white" style={{ fontFamily: displayFont.regular }}>
                {t('home.tournamentsCard')}
              </Text>
              <Text className="mt-1 text-white/80">{t('home.tournamentsCardSubtitle')}</Text>
            </PressScale>
          </Link>
        </Animated.View>

        <Waypoint href="/pokedex" icon="book" iconColor={colors.type.grass} title={t('home.pokedexCard')} subtitle={t('home.pokedexCardSubtitle')} index={1} />
        <Waypoint href="/guia" icon="map" iconColor={colors.type.electric} title={t('home.guideCard')} subtitle={t('home.guideCardSubtitle')} index={2} />
        <Waypoint href="/equipos" icon="people" iconColor={colors.type.psychic} title={t('home.teamsCard')} subtitle={t('home.teamsCardSubtitle')} index={3} />
        <Waypoint href="/cria" icon="heart" iconColor={colors.type.fire} title={t('home.breedingCard')} subtitle={t('home.breedingCardSubtitle')} index={4} />
        <Waypoint href="/shinies" icon="sparkles" iconColor={colors.type.rock} title={t('home.shinyTrackerCard')} subtitle={t('home.shinyTrackerCardSubtitle')} index={5} />
        <Waypoint href="/danio" icon="flash" iconColor={colors.type.dragon} title={t('home.damageCard')} subtitle={t('home.damageCardSubtitle')} index={6} />
        <Waypoint href="/entreno" icon="fitness" iconColor={colors.type.fighting} title={t('home.evTrainingCard')} subtitle={t('home.evTrainingCardSubtitle')} index={7} />
        <Waypoint href="/backup" icon="save" iconColor={colors.type.steel} title={t('home.backupCard')} subtitle={t('home.backupCardSubtitle')} index={8} />
        <Waypoint href="/caja" icon="file-tray-full" iconColor={colors.type.water} title={t('home.boxCard')} subtitle={t('home.boxCardSubtitle')} index={9} />
      </View>
    </Screen>
  );
}
