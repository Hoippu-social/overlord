import { CommandRule } from '@/app/dashboard/[guildId]/moderation/types';

export type CommandModuleKey = 'general' | 'moderation' | 'music' | 'voice' | 'admin';
export type CommandKind = 'slash' | 'context';

export type LocalizedText = {
    en: string;
    ru: string;
};

export type CommandCatalogEntry = {
    commandKey: string;
    moduleKey: CommandModuleKey;
    kind: CommandKind;
    hidden: boolean;
    label: LocalizedText;
    description: LocalizedText;
    defaultRequiredAccessLevel: number | null;
};

export type CommandModuleDefinition = {
    key: CommandModuleKey;
    label: LocalizedText;
};

export const COMMAND_MODULES: readonly CommandModuleDefinition[] = [
    { key: 'general', label: { en: 'General', ru: 'Общие' } },
    { key: 'moderation', label: { en: 'Moderation', ru: 'Модерация' } },
    { key: 'music', label: { en: 'Music', ru: 'Музыка' } },
    { key: 'voice', label: { en: 'Voice', ru: 'Голос' } },
    { key: 'admin', label: { en: 'Administration', ru: 'Администрирование' } },
] as const;

export const COMMAND_CATALOG: readonly CommandCatalogEntry[] = [
    {
        commandKey: 'help',
        moduleKey: 'general',
        kind: 'slash',
        hidden: false,
        label: { en: 'Help', ru: 'Справка' },
        description: { en: 'Show the bot help menu.', ru: 'Показать справку по командам бота.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'ping',
        moduleKey: 'general',
        kind: 'slash',
        hidden: false,
        label: { en: 'Ping', ru: 'Пинг' },
        description: { en: 'Check whether the bot is responding.', ru: 'Проверить, отвечает ли бот.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'appeal',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Appeal', ru: 'Апелляция' },
        description: { en: 'Submit a moderation appeal.', ru: 'Подать апелляцию на действие модерации.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'appeals',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Appeals', ru: 'Апелляции' },
        description: { en: 'Review and resolve moderation appeals.', ru: 'Просмотр и разбор апелляций модерации.' },
        defaultRequiredAccessLevel: 70,
    },
    {
        commandKey: 'ban',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Ban', ru: 'Бан' },
        description: { en: 'Ban a member from the server.', ru: 'Блокировка участника на сервере.' },
        defaultRequiredAccessLevel: 80,
    },
    {
        commandKey: 'case',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Case', ru: 'Кейс' },
        description: { en: 'Inspect a specific moderation case.', ru: 'Просмотр конкретного модерационного кейса.' },
        defaultRequiredAccessLevel: 30,
    },
    {
        commandKey: 'cases',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Cases', ru: 'Кейсы' },
        description: { en: 'Browse moderation case history.', ru: 'Просмотр истории модерационных кейсов.' },
        defaultRequiredAccessLevel: 30,
    },
    {
        commandKey: 'clear',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Clear', ru: 'Очистка' },
        description: { en: 'Bulk delete messages in a channel.', ru: 'Массовое удаление сообщений в канале.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'kick',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Kick', ru: 'Кик' },
        description: { en: 'Kick a member from the server.', ru: 'Исключение участника с сервера.' },
        defaultRequiredAccessLevel: 70,
    },
    {
        commandKey: 'lock',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Lock', ru: 'Лок' },
        description: { en: 'Lock a channel from sending messages.', ru: 'Закрытие канала для отправки сообщений.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'mute',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Mute', ru: 'Мьют' },
        description: { en: 'Apply the configured mute role.', ru: 'Выдача настроенной роли мута.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'note',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Notes', ru: 'Заметки' },
        description: { en: 'Manage internal moderation notes.', ru: 'Управление внутренними заметками модерации.' },
        defaultRequiredAccessLevel: 30,
    },
    {
        commandKey: 'slowmode',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Slowmode', ru: 'Медленный режим' },
        description: { en: 'Configure channel slowmode.', ru: 'Настройка медленного режима канала.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'timeout',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Timeout', ru: 'Таймаут' },
        description: { en: 'Temporarily timeout a member.', ru: 'Временное ограничение участника.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'unban',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Unban', ru: 'Разбан' },
        description: { en: 'Remove an active ban.', ru: 'Снятие активной блокировки.' },
        defaultRequiredAccessLevel: 80,
    },
    {
        commandKey: 'unlock',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Unlock', ru: 'Разлок' },
        description: { en: 'Re-open a locked channel.', ru: 'Повторное открытие закрытого канала.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'unmute',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Unmute', ru: 'Размьют' },
        description: { en: 'Remove the configured mute role.', ru: 'Снятие настроенной роли мута.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'untimeout',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Untimeout', ru: 'Снять таймаут' },
        description: { en: 'Remove an active timeout.', ru: 'Снятие активного таймаута.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'unwarn',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Unwarn', ru: 'Снять предупреждение' },
        description: { en: 'Clear a warning case.', ru: 'Снятие предупреждения по кейсу.' },
        defaultRequiredAccessLevel: 70,
    },
    {
        commandKey: 'voicekick',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Voice Kick', ru: 'Кик из голосового' },
        description: { en: 'Disconnect a member from voice.', ru: 'Отключение участника из голосового канала.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'voicemove',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Voice Move', ru: 'Перемещение в голосовом' },
        description: { en: 'Move a member between voice channels.', ru: 'Перемещение участника между голосовыми каналами.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'warn',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Warn', ru: 'Предупреждение' },
        description: { en: 'Issue a warning to a member.', ru: 'Выдача предупреждения участнику.' },
        defaultRequiredAccessLevel: 50,
    },
    {
        commandKey: 'warns',
        moduleKey: 'moderation',
        kind: 'slash',
        hidden: false,
        label: { en: 'Warnings', ru: 'История наказаний' },
        description: {
            en: 'Show punishment history (warns, mutes, timeouts, kicks, bans) for yourself or a specified user.',
            ru: 'Показать историю наказаний (варны, муты, тайм-ауты, кики, баны) для себя или указанного пользователя.',
        },
        defaultRequiredAccessLevel: 30,
    },
    {
        commandKey: 'loop',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Loop', ru: 'Повтор' },
        description: { en: 'Repeat the current track or queue.', ru: 'Повторять текущий трек или очередь.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'nowplaying',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Now Playing', ru: 'Сейчас играет' },
        description: { en: 'Show the current track.', ru: 'Показать текущий трек.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'pause',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Pause', ru: 'Пауза' },
        description: { en: 'Pause playback.', ru: 'Поставить воспроизведение на паузу.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'play',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Play', ru: 'Играть' },
        description: { en: 'Queue a track or playlist.', ru: 'Добавить трек или плейлист в очередь.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'queue',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Queue', ru: 'Очередь' },
        description: { en: 'Show the music queue.', ru: 'Показать очередь музыки.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'resume',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Resume', ru: 'Продолжить' },
        description: { en: 'Resume playback.', ru: 'Продолжить воспроизведение.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'seek',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Seek', ru: 'Перемотка' },
        description: { en: 'Jump to a position in the current track.', ru: 'Перейти к позиции в текущем треке.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'shuffle',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Shuffle', ru: 'Перемешать' },
        description: { en: 'Shuffle the queue.', ru: 'Перемешать очередь.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'skip',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Skip', ru: 'Пропуск' },
        description: { en: 'Skip the current track.', ru: 'Пропустить текущий трек.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'stop',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Stop', ru: 'Стоп' },
        description: { en: 'Stop playback and clear the queue.', ru: 'Остановить воспроизведение и очистить очередь.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'volume',
        moduleKey: 'music',
        kind: 'slash',
        hidden: false,
        label: { en: 'Volume', ru: 'Громкость' },
        description: { en: 'Set the playback volume.', ru: 'Изменить громкость воспроизведения.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'setupv',
        moduleKey: 'voice',
        kind: 'slash',
        hidden: false,
        label: { en: 'Setup Voice', ru: 'Настроить голос' },
        description: { en: 'Configure temporary voice rooms.', ru: 'Настроить временные голосовые комнаты.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'audit_config',
        moduleKey: 'admin',
        kind: 'context',
        hidden: false,
        label: { en: 'Audit Config', ru: 'Audit Config' },
        description: { en: 'Open the audit configuration menu.', ru: 'Открыть меню настройки аудита.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'shutdown',
        moduleKey: 'admin',
        kind: 'slash',
        hidden: true,
        label: { en: 'Shutdown', ru: 'Отключение' },
        description: { en: 'Shut the bot down.', ru: 'Остановить бота.' },
        defaultRequiredAccessLevel: null,
    },
    {
        commandKey: 'tempvoice',
        moduleKey: 'admin',
        kind: 'slash',
        hidden: false,
        label: { en: 'Tempvoice', ru: 'Войс-румы' },
        description: { en: 'Manage temporary voice module settings.', ru: 'Управлять настройками модуля временных голосовых комнат.' },
        defaultRequiredAccessLevel: null,
    },
] as const;

const COMMAND_ENTRY_MAP = new Map(COMMAND_CATALOG.map((entry) => [entry.commandKey, entry]));

export function getCommandCatalogEntry(commandKey: string) {
    return COMMAND_ENTRY_MAP.get(commandKey) ?? null;
}

export function getDefaultCommandRule(commandKey: string): CommandRule {
    const entry = getCommandCatalogEntry(commandKey);

    return {
        commandKey,
        enabled: true,
        roleMode: 'WHITELIST',
        roleIds: [],
        channelMode: 'WHITELIST',
        channelIds: [],
        requiredAccessLevel: entry?.defaultRequiredAccessLevel ?? null,
    };
}

export function createDefaultCommandRules(): CommandRule[] {
    return COMMAND_CATALOG.map((command) => getDefaultCommandRule(command.commandKey));
}
