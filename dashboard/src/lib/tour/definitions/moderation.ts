import type { TourDefinition, TourStep } from '../types';

const tabsStep: TourStep = {
    id: 'mod-tabs',
    anchor: '[data-tour="mod-tabs"]',
    placement: 'bottom',
    title: { ru: 'Разделы модерации', en: 'Moderation sections' },
    body: {
        ru: 'Обзор кейсов, доступ, автомод, AI-проверка, апелляции, хранение и аналитика.',
        en: 'Case overview, access control, automod, AI review, appeals, retention and analytics.',
    },
};

const tabDefs: Array<{ tab: string; steps: TourStep[] }> = [
    {
        tab: 'overview',
        steps: [
            {
                id: 'mod-overview-cards',
                anchor: '[data-tour="mod-overview-cards"]',
                placement: 'bottom',
                title: { ru: 'Сводка по кейсам', en: 'Case summary' },
                body: {
                    ru: 'Общее число кейсов, активные наказания, предупреждения и временные санкции.',
                    en: 'Total cases, active punishments, warnings and timed sanctions.',
                },
            },
            {
                id: 'mod-cases-feed',
                anchor: '[data-tour="mod-cases-feed"]',
                placement: 'right',
                title: { ru: 'Лента кейсов', en: 'Cases feed' },
                body: {
                    ru: 'Список всех модерационных действий с фильтрами по причине, номеру, статусу и типу.',
                    en: 'All moderation actions with filters by reason, number, status and action type.',
                },
            },
            {
                id: 'mod-case-details',
                anchor: '[data-tour="mod-case-details"]',
                placement: 'left',
                title: { ru: 'Детали кейса', en: 'Case details' },
                body: {
                    ru: 'Выберите кейс слева, чтобы увидеть подробности: нарушителя, модератора и заметки.',
                    en: 'Select a case on the left to see details: target user, moderator and staff notes.',
                },
            },
        ],
    },
    {
        tab: 'access',
        steps: [
            {
                id: 'mod-access',
                anchor: '[data-tour="mod-access"]',
                placement: 'top',
                title: { ru: 'Доступ и области модерации', en: 'Access & scope' },
                body: {
                    ru: 'Определите роли и каналы, где модерация применяется или игнорируется.',
                    en: 'Define roles and channels where moderation applies or is ignored.',
                },
            },
        ],
    },
    {
        tab: 'automod',
        steps: [
            {
                id: 'mod-automod',
                anchor: '[data-tour="mod-automod"]',
                placement: 'top',
                title: { ru: 'Автомодерация', en: 'AutoMod' },
                body: {
                    ru: 'Правила автоматической модерации и исключения для ролей/каналов.',
                    en: 'Automatic moderation rules and exclusions for roles/channels.',
                },
            },
        ],
    },
    {
        tab: 'ai',
        steps: [
            {
                id: 'mod-ai',
                anchor: '[data-tour="mod-ai"]',
                placement: 'top',
                title: { ru: 'AI-проверка', en: 'AI review' },
                body: {
                    ru: 'Настройка провайдера и правил ИИ-модерации, а также лента инцидентов.',
                    en: 'Configure the AI moderation provider and rules, plus the incidents feed.',
                },
            },
        ],
    },
    {
        tab: 'appeals',
        steps: [
            {
                id: 'mod-appeals',
                anchor: '[data-tour="mod-appeals"]',
                placement: 'top',
                title: { ru: 'Апелляции', en: 'Appeals' },
                body: {
                    ru: 'Настройки приёма апелляций и список поданных тикетов на обжалование.',
                    en: 'Appeal intake settings and the list of submitted appeal tickets.',
                },
            },
        ],
    },
    {
        tab: 'retention',
        steps: [
            {
                id: 'mod-retention',
                anchor: '[data-tour="mod-retention"]',
                placement: 'top',
                title: { ru: 'Хранение логов', en: 'Log retention' },
                body: {
                    ru: 'Как долго бот хранит разные типы модерационных логов.',
                    en: 'How long the bot retains different types of moderation logs.',
                },
            },
        ],
    },
    {
        tab: 'analytics',
        steps: [
            {
                id: 'mod-analytics',
                anchor: '[data-tour="mod-analytics"]',
                placement: 'top',
                title: { ru: 'Аналитика модерации', en: 'Moderation analytics' },
                body: {
                    ru: 'Сводная статистика и активность модераторов за выбранный период.',
                    en: 'Summary stats and moderator activity over the selected period.',
                },
            },
        ],
    },
];

export const moderationTours: TourDefinition[] = tabDefs.map(({ tab, steps }) => ({
    id: `moderation-${tab}`,
    match: (ctx) => ctx.path === 'moderation' && (ctx.searchParams.get('tab') || 'overview') === tab,
    steps: [tabsStep, ...steps],
}));
