import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import idTranslation from '../locales/id.json';
import enTranslation from '../locales/en.json';

const resources = {
    id: { translation: idTranslation },
    en: { translation: enTranslation },
};

// Detect browser language, default to Indonesian
const getBrowserLanguage = (): string => {
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'en' ? 'en' : 'id';
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getBrowserLanguage(),
        fallbackLng: 'id',
        interpolation: {
            escapeValue: false, // React already escapes
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
