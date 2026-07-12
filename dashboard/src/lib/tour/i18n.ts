import type { LocaleCode } from '@/lib/i18n';

export const TOUR_STRINGS = {
    ru: {
        next: 'Далее',
        back: 'Назад',
        done: 'Готово',
        close: 'Закрыть',
        stepOf: (n: number, m: number) => `Шаг ${n} из ${m}`,
        noTour: 'Для этого раздела туториал пока недоступен',
        startTour: 'Показать туториал по разделу',
    },
    en: {
        next: 'Next',
        back: 'Back',
        done: 'Done',
        close: 'Close',
        stepOf: (n: number, m: number) => `Step ${n} of ${m}`,
        noTour: 'No tutorial available for this section yet',
        startTour: 'Show tutorial for this section',
    },
} as const;

export const getTourCopy = (locale: LocaleCode) => TOUR_STRINGS[locale];
