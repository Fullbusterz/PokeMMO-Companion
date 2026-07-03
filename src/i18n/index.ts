import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import es from './locales/es.json';

export const i18n = new I18n({ en, es });

const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'en';
i18n.locale = deviceLanguage === 'es' ? 'es' : 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}
