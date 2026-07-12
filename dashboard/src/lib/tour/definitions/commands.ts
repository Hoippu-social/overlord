import type { TourDefinition } from '../types';

export const commandsTour: TourDefinition = {
    id: 'commands',
    match: (ctx) => ctx.path === 'commands',
    steps: [
        {
            id: 'commands-channel-mode',
            anchor: '[data-tour="commands-channel-mode"]',
            placement: 'bottom',
            title: { ru: 'Каналы для команд', en: 'Command channels' },
            body: {
                ru: 'Ограничьте, в каких каналах и категориях доступны команды бота.',
                en: 'Restrict which channels and categories the bot’s commands are available in.',
            },
        },
        {
            id: 'commands-mode-toggle',
            anchor: '[data-tour="commands-mode-toggle"]',
            placement: 'bottom',
            title: { ru: 'Белый / чёрный список', en: 'Whitelist / blacklist' },
            body: {
                ru: 'Переключите режим: разрешить команды только в списке или запретить их там.',
                en: 'Toggle the mode: allow commands only in the list, or block them there.',
            },
        },
        {
            id: 'commands-overrides',
            anchor: '[data-tour="commands-overrides"]',
            placement: 'top',
            title: { ru: 'Настройки команд', en: 'Command overrides' },
            body: {
                ru: 'Точечные ограничения по ролям и каналам для отдельных команд.',
                en: 'Per-command restrictions by role and channel.',
            },
        },
    ],
};
