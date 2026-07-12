import type { TourDefinition } from '../types';

const navSteps = [
    {
        id: 'stats-tabs',
        anchor: '[data-tour="stats-tabs"]',
        placement: 'bottom' as const,
        title: { ru: 'Разделы статистики', en: 'Stats sections' },
        body: {
            ru: 'Переключайтесь между сообщениями, войсом, участниками и другими срезами статистики.',
            en: 'Switch between messages, voice, members and other stats slices.',
        },
    },
    {
        id: 'stats-sync',
        anchor: '[data-tour="stats-sync"]',
        placement: 'bottom' as const,
        title: { ru: 'Синхронизация', en: 'Sync' },
        body: {
            ru: 'Запустите пересчёт исторических данных, если статистика выглядит неполной.',
            en: 'Trigger a historical resync if the stats look incomplete.',
        },
    },
    {
        id: 'stats-period',
        anchor: '[data-tour="stats-period"]',
        placement: 'bottom' as const,
        title: { ru: 'Период', en: 'Period' },
        body: {
            ru: 'Выберите временной диапазон для графиков и карточек на странице.',
            en: 'Pick the time range for the charts and cards on this page.',
        },
    },
];

export const statsTours: TourDefinition[] = [
    {
        id: 'stats-overview',
        match: (ctx) => ctx.path === 'stats',
        steps: [
            ...navSteps,
            {
                id: 'stats-cards',
                anchor: '[data-tour="stats-cards"]',
                placement: 'bottom',
                title: { ru: 'Ключевые метрики', en: 'Key metrics' },
                body: {
                    ru: 'Сообщения, голосовое время и изменение числа участников за период.',
                    en: 'Messages, voice time and member change over the period.',
                },
            },
            {
                id: 'stats-chart',
                anchor: '[data-tour="stats-chart"]',
                placement: 'top',
                title: { ru: 'График активности', en: 'Activity chart' },
                body: {
                    ru: 'Динамика активности сервера во времени.',
                    en: 'Server activity over time.',
                },
            },
        ],
    },
    {
        id: 'stats-messages',
        match: (ctx) => ctx.path === 'stats/messages',
        steps: [
            ...navSteps,
            {
                id: 'stats-messages-cards',
                anchor: '[data-tour="stats-messages-cards"]',
                placement: 'bottom',
                title: { ru: 'Метрики сообщений', en: 'Message metrics' },
                body: {
                    ru: 'Общее число сообщений и активность по каналам.',
                    en: 'Total message count and per-channel activity.',
                },
            },
            {
                id: 'stats-messages-chart',
                anchor: '[data-tour="stats-messages-chart"]',
                placement: 'top',
                title: { ru: 'График сообщений', en: 'Messages chart' },
                body: {
                    ru: 'Распределение сообщений по времени.',
                    en: 'Message volume over time.',
                },
            },
        ],
    },
    {
        id: 'stats-voice',
        match: (ctx) => ctx.path === 'stats/voice',
        steps: [
            ...navSteps,
            {
                id: 'stats-voice-cards',
                anchor: '[data-tour="stats-voice-cards"]',
                placement: 'bottom',
                title: { ru: 'Метрики голоса', en: 'Voice metrics' },
                body: {
                    ru: 'Суммарное время в голосовых каналах и активность.',
                    en: 'Total voice time and activity.',
                },
            },
            {
                id: 'stats-voice-chart',
                anchor: '[data-tour="stats-voice-chart"]',
                placement: 'top',
                title: { ru: 'График голосовой активности', en: 'Voice activity chart' },
                body: {
                    ru: 'Динамика голосовой активности во времени.',
                    en: 'Voice activity over time.',
                },
            },
        ],
    },
    {
        id: 'stats-members',
        match: (ctx) => ctx.path === 'stats/members',
        steps: [
            ...navSteps,
            {
                id: 'stats-members-cards',
                anchor: '[data-tour="stats-members-cards"]',
                placement: 'bottom',
                title: { ru: 'Метрики участников', en: 'Member metrics' },
                body: {
                    ru: 'Рост, отток и текущее число участников сервера.',
                    en: 'Growth, churn and current member count.',
                },
            },
            {
                id: 'stats-members-chart',
                anchor: '[data-tour="stats-members-chart"]',
                placement: 'top',
                title: { ru: 'Динамика участников', en: 'Member growth' },
                body: {
                    ru: 'График присоединений и выходов участников.',
                    en: 'Join/leave trend over time.',
                },
            },
        ],
    },
    {
        id: 'stats-channels',
        match: (ctx) => ctx.path === 'stats/channels',
        steps: [
            ...navSteps,
            {
                id: 'stats-channels-search',
                anchor: '[data-tour="stats-channels-search"]',
                placement: 'bottom',
                title: { ru: 'Поиск канала', en: 'Channel search' },
                body: {
                    ru: 'Найдите канал, чтобы посмотреть подробную статистику по нему.',
                    en: 'Find a channel to see detailed stats for it.',
                },
            },
        ],
    },
    {
        id: 'stats-users',
        match: (ctx) => ctx.path === 'stats/users',
        steps: [
            ...navSteps,
            {
                id: 'stats-users-search',
                anchor: '[data-tour="stats-users-search"]',
                placement: 'bottom',
                title: { ru: 'Поиск участника', en: 'User search' },
                body: {
                    ru: 'Найдите участника, чтобы посмотреть подробную статистику по нему.',
                    en: 'Find a member to see detailed stats for them.',
                },
            },
        ],
    },
    {
        id: 'stats-activities',
        match: (ctx) => ctx.path === 'stats/activities',
        steps: [
            ...navSteps,
            {
                id: 'stats-activities-cards',
                anchor: '[data-tour="stats-activities-cards"]',
                placement: 'bottom',
                title: { ru: 'Метрики активностей', en: 'Activity metrics' },
                body: {
                    ru: 'Статистика по играм и активностям Discord участников.',
                    en: 'Stats on Discord games and activities members use.',
                },
            },
            {
                id: 'stats-activities-top',
                anchor: '[data-tour="stats-activities-top"]',
                placement: 'top',
                title: { ru: 'Топ активностей', en: 'Top activities' },
                body: {
                    ru: 'Самые популярные активности на сервере.',
                    en: 'The most popular activities on the server.',
                },
            },
        ],
    },
    {
        id: 'stats-contacts',
        match: (ctx) => ctx.path === 'stats/contacts',
        steps: [
            ...navSteps,
            {
                id: 'stats-contacts-graph',
                anchor: '[data-tour="stats-contacts-graph"]',
                placement: 'top',
                title: { ru: 'Граф связей', en: 'Contacts graph' },
                body: {
                    ru: 'Кто с кем чаще всего взаимодействует на сервере.',
                    en: 'Who interacts with whom the most on the server.',
                },
            },
        ],
    },
];
