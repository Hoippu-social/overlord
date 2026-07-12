import type { TourDefinition } from '../types';

export const musicTour: TourDefinition = {
    id: 'music',
    match: (ctx) => ctx.path === 'music',
    steps: [
        {
            id: 'music-player',
            anchor: '[data-tour="music-player"]',
            placement: 'bottom',
            title: { ru: 'Плеер', en: 'Player' },
            body: {
                ru: 'Управляйте воспроизведением музыки бота прямо из дешборда.',
                en: 'Control the bot’s music playback right from the dashboard.',
            },
        },
        {
            id: 'music-volume',
            anchor: '[data-tour="music-volume"]',
            placement: 'top',
            title: { ru: 'Громкость и длительность', en: 'Volume & duration' },
            body: {
                ru: 'Громкость по умолчанию и ограничение на длительность треков.',
                en: 'Default volume and a limit on track duration.',
            },
        },
        {
            id: 'music-access',
            anchor: '[data-tour="music-access"]',
            placement: 'top',
            title: { ru: 'Доступ и роли', en: 'Access & roles' },
            body: {
                ru: 'Роли DJ и ограничения по голосовым каналам для музыки.',
                en: 'DJ roles and voice channel restrictions for music.',
            },
        },
    ],
};
