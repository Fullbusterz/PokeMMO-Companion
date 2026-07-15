import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { i18n } from '@/i18n';

export type AppLocale = 'es' | 'en';

type LocaleStore = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

// i18n-js's `i18n.locale` isn't reactive by itself — it's a plain mutable
// field read synchronously by every `t()` call. Screens re-render when this
// store's `locale` changes (RootLayout remounts the tree on it), and each
// `setLocale` call also flips `i18n.locale` directly so `t()` returns the
// new language immediately, even before that remount finishes.
export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: (i18n.locale as AppLocale) ?? 'en',
      setLocale: (locale) => {
        i18n.locale = locale;
        set({ locale });
      },
    }),
    {
      name: 'pokemmo-locale',
      storage: createJSONStorage(() => AsyncStorage),
      // Rehydration (reading the persisted choice back from AsyncStorage) is
      // async, so on cold start `i18n.locale` briefly holds the device-language
      // guess from src/i18n/index.ts until this fires and applies the user's
      // actual saved choice, if they'd set one before.
      onRehydrateStorage: () => (state) => {
        if (state) i18n.locale = state.locale;
      },
    }
  )
);
