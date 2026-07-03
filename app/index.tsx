import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { t } from '@/i18n';

export default function Home() {
  return (
    <Screen>
      <Text className="mb-6 mt-2 text-3xl font-bold text-ink-100">{t('home.title')}</Text>

      <Link href="/torneos" asChild>
        <Pressable className="mb-3 rounded-2xl bg-pokeRed p-5 shadow-md shadow-pokeRed/40 active:bg-pokeRed-600">
          <Text className="text-lg font-bold text-white">{t('home.tournamentsCard')}</Text>
          <Text className="mt-1 text-white/80">{t('home.tournamentsCardSubtitle')}</Text>
        </Pressable>
      </Link>

      <Link href="/pokedex" asChild>
        <Pressable className="rounded-2xl border border-ink-600 bg-ink-800 p-5 active:bg-ink-700">
          <Text className="text-lg font-bold text-ink-100">{t('home.pokedexCard')}</Text>
          <Text className="mt-1 text-ink-400">{t('home.pokedexCardSubtitle')}</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}
