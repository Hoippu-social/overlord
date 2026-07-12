import type { TourDefinition } from '../types';

export const serverSettingsTour: TourDefinition = {
    id: 'server-settings',
    match: (ctx) => ctx.path === 'server-settings',
    steps: [
        {
            id: 'settings-general',
            anchor: '[data-tour="settings-general"]',
            placement: 'right',
            title: { ru: 'Общие настройки', en: 'General settings' },
            body: {
                ru: 'Префикс команд, язык бота и часовой пояс сервера.',
                en: 'Command prefix, bot language and the server timezone.',
            },
        },
        {
            id: 'settings-admins',
            anchor: '[data-tour="settings-admins"]',
            placement: 'right',
            title: { ru: 'Администраторы', en: 'Admins' },
            body: {
                ru: 'Роли, которым выдан полный административный доступ к дешборду.',
                en: 'Roles granted full administrative access to the dashboard.',
            },
        },
        {
            id: 'settings-recovery',
            anchor: '[data-tour="settings-recovery"]',
            placement: 'left',
            title: { ru: 'Восстановление при возврате', en: 'Rejoin recovery' },
            body: {
                ru: 'Возвращать ли роли и никнейм участнику при повторном входе на сервер.',
                en: 'Whether to restore roles and nickname when a member rejoins.',
            },
        },
        {
            id: 'settings-channels',
            anchor: '[data-tour="settings-channels"]',
            placement: 'left',
            title: { ru: 'Каналы бота', en: 'Bot channels' },
            body: {
                ru: 'Общий белый/чёрный список каналов, где бот активен.',
                en: 'A global whitelist/blacklist of channels where the bot is active.',
            },
        },
    ],
};
