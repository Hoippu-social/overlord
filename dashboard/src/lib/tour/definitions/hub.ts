import type { TourDefinition } from '../types';

export const hubTour: TourDefinition = {
    id: 'hub',
    match: (ctx) => ctx.path === '',
    steps: [
        {
            id: 'nav-sidebar',
            anchor: '[data-tour="nav-sidebar"]',
            placement: 'right',
            title: { ru: 'Навигация', en: 'Navigation' },
            body: {
                ru: 'Здесь собраны все разделы дешборда — переключайтесь между модулями сервера.',
                en: 'All dashboard sections live here — switch between server modules.',
            },
        },
        {
            id: 'topnav-search',
            anchor: '[data-tour="topnav-search"]',
            placement: 'bottom',
            title: { ru: 'Поиск', en: 'Search' },
            body: {
                ru: 'Быстрый поиск по страницам и настройкам дешборда.',
                en: 'Quickly search across dashboard pages and settings.',
            },
        },
        {
            id: 'hub-server-card',
            anchor: '[data-tour="hub-server-card"]',
            placement: 'bottom',
            title: { ru: 'Карточка сервера', en: 'Server card' },
            body: {
                ru: 'Название, иконка и число участников онлайн — общий статус сервера.',
                en: 'Server name, icon and online member count — the overall server status.',
            },
        },
        {
            id: 'hub-audio-player',
            anchor: '[data-tour="hub-audio-player"]',
            placement: 'top',
            title: { ru: 'Аудиоплеер', en: 'Audio player' },
            body: {
                ru: 'Управляйте музыкой бота прямо из дешборда, не заходя в Discord.',
                en: 'Control the bot’s music playback right from the dashboard.',
            },
        },
        {
            id: 'hub-bot-events',
            anchor: '[data-tour="hub-bot-events"]',
            placement: 'top',
            title: { ru: 'События бота', en: 'Bot events' },
            body: {
                ru: 'Лента последних действий и системных событий бота.',
                en: 'A feed of recent bot actions and system events.',
            },
        },
        {
            id: 'hub-server-events',
            anchor: '[data-tour="hub-server-events"]',
            placement: 'top',
            title: { ru: 'События сервера', en: 'Server events' },
            body: {
                ru: 'Модерационные и структурные события сервера: баны, роли, каналы.',
                en: 'Moderation and structural server events: bans, roles, channels.',
            },
        },
        {
            id: 'hub-summary',
            anchor: '[data-tour="hub-summary"]',
            placement: 'left',
            title: { ru: 'Сводка', en: 'Summary' },
            body: {
                ru: 'Быстрые ссылки на открытые тикеты и активные войс-румы.',
                en: 'Quick links to open tickets and active voice rooms.',
            },
        },
        {
            id: 'hub-quick-launch',
            anchor: '[data-tour="hub-quick-launch"]',
            placement: 'left',
            title: { ru: 'Быстрый запуск', en: 'Quick launch' },
            body: {
                ru: 'Переход в часто используемые разделы одним кликом.',
                en: 'Jump into frequently used sections in one click.',
            },
        },
    ],
};
