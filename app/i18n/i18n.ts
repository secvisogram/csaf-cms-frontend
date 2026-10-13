import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'

/**
 * Statically-imported English dictionary only (see ticket 05/11): no runtime
 * HTTP fetch, no browser-language detection, no `de` dictionary.
 */
if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}
