import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    Collection,
    EmbedBuilder,
    GuildMember,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import { createModeratorAccessEvaluator, type CommandAccessOptions } from '../services/ModerationService';
import { LocaleCode, t } from './i18n';
import { getCommandDefaultMemberPermissions } from './commandPermissions';
import { Command } from './types';

type LocalizedText = { en: string; ru: string };

type ModuleCommandBase = {
    name: string;
    usage?: string;
    summary: LocalizedText;
    details: LocalizedText;
    roles: string;
};

type HelpModuleBase = {
    id: string;
    label: LocalizedText;
    emoji?: string;
    menuHint: LocalizedText;
    description: LocalizedText;
    color?: number;
    commands: ModuleCommandBase[];
};

export type ModuleCommand = {
    name: string;
    usage: string;
    summary: string;
    details: string;
    roles: string;
};

export type HelpModule = {
    id: string;
    label: string;
    emoji?: string;
    menuHint: string;
    description: string;
    color?: number;
    commands: ModuleCommand[];
};

export type HelpView = {
    modules: HelpModule[];
    commandNames: string[];
};

export type HelpCommandLookupResult =
    | { state: 'not_found' }
    | { state: 'denied' }
    | { state: 'allowed'; module: HelpModule; command: ModuleCommand };

const EMBED_COLOR = 0x5865f2;

export const HELP_MENU_CUSTOM_ID = 'help_modules';

const HELP_MODULES_BASE: HelpModuleBase[] = [
    {
        id: 'general',
        label: { en: 'General', ru: 'Общие' },
        emoji: '📌',
        menuHint: { en: 'Basic bot commands', ru: 'Базовые команды бота' },
        description: {
            en: 'Quick access to help and connectivity checks.',
            ru: 'Быстрый доступ к справке и диагностике доступности.',
        },
        commands: [
            {
                name: 'help',
                summary: { en: 'Open the help menu.', ru: 'Открыть меню помощи.' },
                details: {
                    en: 'Shows the full command list or details for a specific command when you pass its name.',
                    ru: 'Показывает список команд или подробности по конкретной команде, если передать её имя.',
                },
                roles: '@everyone',
            },
            {
                name: 'ping',
                summary: { en: 'Check bot availability.', ru: 'Проверить доступность бота.' },
                details: {
                    en: 'Replies with Pong! to confirm the bot is online.',
                    ru: 'Отвечает Pong!, чтобы подтвердить, что бот онлайн.',
                },
                roles: '@everyone',
            },
        ],
    },
    {
        id: 'moderation',
        label: { en: 'Moderation', ru: 'Модерация' },
        emoji: '🛡️',
        menuHint: { en: 'Appeals, cases, punishments', ru: 'Апелляции, кейсы, наказания' },
        description: {
            en: 'Moderation workflow: user appeals, case browsing, sanctions, channel controls, and voice actions.',
            ru: 'Модуль модерации: апелляции пользователей, кейсы, санкции, управление каналами и голосовые действия.',
        },
        commands: [
            {
                name: 'appeal',
                summary: { en: 'Submit or view your appeals.', ru: 'Подать апелляцию или посмотреть свои.' },
                details: {
                    en: 'Use submit to create an appeal for a moderation case and mine to list your recent appeal tickets.',
                    ru: 'Используйте submit, чтобы создать апелляцию по кейсу модерации, и mine, чтобы посмотреть свои последние тикеты.',
                },
                roles: '@everyone (when appeals are enabled)',
            },
            {
                name: 'appeals',
                summary: { en: 'Review appeal tickets.', ru: 'Просматривать тикеты апелляций.' },
                details: {
                    en: 'Staff command for listing and reviewing moderation appeals.',
                    ru: 'Команда для персонала: список и разбор апелляций модерации.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'case',
                summary: { en: 'Show one moderation case.', ru: 'Показать один кейс модерации.' },
                details: {
                    en: 'Displays details and metadata for a specific moderation case number.',
                    ru: 'Показывает детали и метаданные для конкретного номера кейса.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'cases',
                summary: { en: 'Browse user case history.', ru: 'Посмотреть историю кейсов пользователя.' },
                details: {
                    en: 'Lists moderation history for a target user.',
                    ru: 'Показывает историю модерационных кейсов для выбранного пользователя.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'note',
                summary: { en: 'Manage staff notes.', ru: 'Управлять заметками модерации.' },
                details: {
                    en: 'Creates or clears internal moderation notes tied to a user.',
                    ru: 'Создаёт или очищает внутренние заметки модерации, привязанные к пользователю.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'warn',
                summary: { en: 'Issue a warning.', ru: 'Выдать предупреждение.' },
                details: {
                    en: 'Creates a warning case for the target user.',
                    ru: 'Создаёт кейс предупреждения для выбранного пользователя.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'warns',
                summary: { en: 'Show punishment history.', ru: 'Показать историю наказаний.' },
                details: {
                    en: 'Shows full punishment history (warns, mutes, timeouts, kicks, bans) for you or for a specified user.',
                    ru: 'Показывает полную историю наказаний (варны, муты, тайм-ауты, кики, баны) для вас или указанного пользователя.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'unwarn',
                summary: { en: 'Clear a warning case.', ru: 'Снять предупреждение.' },
                details: {
                    en: 'Clears an active warning by case number.',
                    ru: 'Снимает активное предупреждение по номеру кейса.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'mute',
                summary: { en: 'Apply the mute role.', ru: 'Выдать роль мута.' },
                details: {
                    en: 'Applies the configured mute role to the member.',
                    ru: 'Выдаёт участнику настроенную роль мута.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'unmute',
                summary: { en: 'Remove the mute role.', ru: 'Снять роль мута.' },
                details: {
                    en: 'Removes the configured mute role from the member.',
                    ru: 'Снимает с участника настроенную роль мута.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'timeout',
                summary: { en: 'Timeout a member.', ru: 'Выдать таймаут.' },
                details: {
                    en: 'Applies a timed communication timeout to the target member.',
                    ru: 'Выдаёт выбранному участнику временный таймаут.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'untimeout',
                summary: { en: 'Remove a timeout.', ru: 'Снять таймаут.' },
                details: {
                    en: 'Removes an active timeout from the member.',
                    ru: 'Снимает активный таймаут с участника.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'kick',
                summary: { en: 'Kick a member.', ru: 'Кикнуть участника.' },
                details: {
                    en: 'Removes a member from the server without banning them.',
                    ru: 'Удаляет участника с сервера без бана.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'ban',
                summary: { en: 'Ban a member.', ru: 'Забанить участника.' },
                details: {
                    en: 'Bans the target member from the server.',
                    ru: 'Банит выбранного участника на сервере.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'unban',
                summary: { en: 'Remove a ban.', ru: 'Разбанить пользователя.' },
                details: {
                    en: 'Removes an active ban for a user ID.',
                    ru: 'Снимает активный бан по ID пользователя.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'clear',
                summary: { en: 'Bulk delete messages.', ru: 'Массово удалить сообщения.' },
                details: {
                    en: 'Deletes recent messages in a channel, with optional filters depending on the subcommand.',
                    ru: 'Удаляет последние сообщения в канале, при необходимости с фильтрами по подкоманде.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'slowmode',
                summary: { en: 'Set channel slowmode.', ru: 'Настроить slowmode канала.' },
                details: {
                    en: 'Configures or clears channel slowmode.',
                    ru: 'Настраивает или сбрасывает slowmode для канала.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'lock',
                summary: { en: 'Lock a channel.', ru: 'Закрыть канал.' },
                details: {
                    en: 'Blocks message sending in the selected channel.',
                    ru: 'Запрещает отправку сообщений в выбранном канале.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'unlock',
                summary: { en: 'Unlock a channel.', ru: 'Открыть канал.' },
                details: {
                    en: 'Restores sending permissions in the selected channel.',
                    ru: 'Возвращает возможность писать в выбранном канале.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'voicekick',
                summary: { en: 'Disconnect from voice.', ru: 'Кикнуть из голосового.' },
                details: {
                    en: 'Disconnects the target member from their current voice channel.',
                    ru: 'Отключает выбранного участника от текущего голосового канала.',
                },
                roles: 'Moderation staff',
            },
            {
                name: 'voicemove',
                summary: { en: 'Move between voice channels.', ru: 'Переместить между голосовыми каналами.' },
                details: {
                    en: 'Moves a member to another voice or stage channel.',
                    ru: 'Перемещает участника в другой голосовой или stage-канал.',
                },
                roles: 'Moderation staff',
            },
        ],
    },
    {
        id: 'music',
        label: { en: 'Music', ru: 'Музыка' },
        emoji: '🎵',
        menuHint: { en: 'Queue, volume, loops', ru: 'Очередь, громкость, повторы' },
        description: {
            en: 'Music player controls: queue, volume, loops, search, and track navigation.',
            ru: 'Управление плеером: очередь, громкость, повторы, поиск и навигация по трекам.',
        },
        commands: [
            {
                name: 'play',
                summary: { en: 'Play by link or search.', ru: 'Воспроизвести по ссылке или поиску.' },
                details: {
                    en: 'Accepts a URL or text; search mode shows platform and track pickers and enqueues the result. Playlists are supported.',
                    ru: 'Принимает ссылку или текст; режим поиска показывает выбор платформы и трека и добавляет результат в очередь. Плейлисты поддерживаются.',
                },
                roles: '@everyone (music restrictions may apply)',
            },
            {
                name: 'pause',
                summary: { en: 'Pause playback.', ru: 'Поставить воспроизведение на паузу.' },
                details: {
                    en: 'Works when you share the voice channel with the bot.',
                    ru: 'Работает, если вы находитесь в одном голосовом канале с ботом.',
                },
                roles: '@everyone',
            },
            {
                name: 'resume',
                summary: { en: 'Resume playback.', ru: 'Продолжить воспроизведение.' },
                details: {
                    en: 'Resumes the paused player when you are in the correct voice channel.',
                    ru: 'Возобновляет воспроизведение, если вы в нужном голосовом канале.',
                },
                roles: '@everyone',
            },
            {
                name: 'skip',
                summary: { en: 'Skip the current track.', ru: 'Пропустить текущий трек.' },
                details: {
                    en: 'Moves the player to the next queue item.',
                    ru: 'Переключает плеер на следующий элемент очереди.',
                },
                roles: '@everyone',
            },
            {
                name: 'stop',
                summary: { en: 'Stop music and clear queue.', ru: 'Остановить музыку и очистить очередь.' },
                details: {
                    en: 'Destroys the current player and clears the queue.',
                    ru: 'Останавливает текущий плеер и очищает очередь.',
                },
                roles: '@everyone',
            },
            {
                name: 'queue',
                summary: { en: 'Show the queue.', ru: 'Показать очередь.' },
                details: {
                    en: 'Displays the current track, queue contents, total count, and total duration.',
                    ru: 'Показывает текущий трек, содержимое очереди, общее количество и суммарную длительность.',
                },
                roles: '@everyone',
            },
            {
                name: 'nowplaying',
                summary: { en: 'Show current track info.', ru: 'Показать информацию о текущем треке.' },
                details: {
                    en: 'Shows progress, queue size, loop mode, and artwork when available.',
                    ru: 'Показывает прогресс, размер очереди, режим повтора и обложку, если она доступна.',
                },
                roles: '@everyone',
            },
            {
                name: 'loop',
                summary: { en: 'Switch loop mode.', ru: 'Переключить режим повтора.' },
                details: {
                    en: 'Lets you cycle or explicitly set off, track, or queue loop mode.',
                    ru: 'Позволяет переключать или явно задавать режимы off, track и queue.',
                },
                roles: '@everyone',
            },
            {
                name: 'shuffle',
                summary: { en: 'Shuffle the queue.', ru: 'Перемешать очередь.' },
                details: {
                    en: 'Randomizes queued tracks while leaving the currently playing one intact.',
                    ru: 'Перемешивает треки в очереди, не трогая текущий воспроизводимый.',
                },
                roles: '@everyone',
            },
            {
                name: 'seek',
                summary: { en: 'Seek inside a track.', ru: 'Перемотать трек.' },
                details: {
                    en: 'Accepts formats like 1:30, 90, or 1m30s and seeks inside the current track.',
                    ru: 'Принимает форматы вроде 1:30, 90 или 1m30s и перематывает текущий трек.',
                },
                roles: '@everyone',
            },
            {
                name: 'volume',
                summary: { en: 'Set player volume.', ru: 'Изменить громкость плеера.' },
                details: {
                    en: 'Shows the current volume without params or applies a new level immediately.',
                    ru: 'Показывает текущую громкость без параметров или сразу применяет новый уровень.',
                },
                roles: '@everyone',
            },
        ],
    },
    {
        id: 'voice',
        label: { en: 'Voice rooms', ru: 'Голосовые комнаты' },
        emoji: '🎙️',
        menuHint: { en: 'Temp rooms and control panel', ru: 'Временные комнаты и панель управления' },
        description: {
            en: 'Set up temporary voice rooms and the control panel channel.',
            ru: 'Настройка временных голосовых комнат и канала панели управления.',
        },
        commands: [
            {
                name: 'setupv',
                summary: { en: 'Quick temp-room setup.', ru: 'Быстрая настройка временных комнат.' },
                details: {
                    en: 'Creates a category, join-to-create hub, and text control panel with buttons. Lets you set names, template, and room limit.',
                    ru: 'Создаёт категорию, join-to-create хаб и текстовую панель управления с кнопками. Позволяет настроить названия, шаблон и лимит комнат.',
                },
                roles: 'Manage Channels',
            },
        ],
    },
    {
        id: 'admin',
        label: { en: 'Administration', ru: 'Администрирование' },
        emoji: '🛠️',
        menuHint: { en: 'System and server tools', ru: 'Системные и серверные инструменты' },
        description: {
            en: 'Administration tools for temp voice management and audit configuration.',
            ru: 'Инструменты администрирования для temp voice и настройки аудита.',
        },
        commands: [
            {
                name: 'tempvoice',
                summary: { en: 'Manage private temp rooms.', ru: 'Управлять системой приватных комнат.' },
                details: {
                    en: 'Subcommands: setup to bind a hub and category, status to inspect config, and disable to turn the module off and clean active rooms.',
                    ru: 'Подкоманды: setup для привязки хаба и категории, status для просмотра конфига и disable для выключения модуля и очистки активных комнат.',
                },
                roles: 'Manage Channels',
            },
            {
                name: 'Audit Config',
                usage: 'Message context menu: Audit Config',
                summary: { en: 'Open audit configuration UI.', ru: 'Открыть интерфейс настройки аудита.' },
                details: {
                    en: 'Message context-menu action that opens the audit configuration panel for the server.',
                    ru: 'Действие контекстного меню сообщения, которое открывает панель настройки аудита сервера.',
                },
                roles: 'Manage Guild',
            },
        ],
    },
];

const localizeText = (text: LocalizedText, locale: LocaleCode) => text[locale] ?? text.ru ?? text.en;

const normalizeCommandName = (commandName: string) => commandName.trim().toLowerCase();

const collectNestedOptionNames = (options: any[] | undefined): string[] => {
    if (!options?.length) return [];

    const names = new Set<string>();
    for (const option of options) {
        if (option.type === ApplicationCommandOptionType.Subcommand) {
            for (const nested of option.options ?? []) {
                names.add(nested.name);
            }
            continue;
        }

        if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
            for (const subcommand of option.options ?? []) {
                for (const nested of subcommand.options ?? []) {
                    names.add(nested.name);
                }
            }
            continue;
        }

        names.add(option.name);
    }

    return Array.from(names);
};

const buildUsageFromCommand = (command: Command<any>) => {
    const json: any = command.data.toJSON();

    if (json.type === ApplicationCommandType.Message) {
        return `Message context menu: ${json.name}`;
    }

    if (json.type === ApplicationCommandType.User) {
        return `User context menu: ${json.name}`;
    }

    const options = Array.isArray(json.options) ? json.options : [];
    if (!options.length) {
        return `/${json.name}`;
    }

    const subcommandNames = options.flatMap((option: any) => {
        if (option.type === ApplicationCommandOptionType.Subcommand) {
            return [option.name];
        }

        if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
            return (option.options ?? []).map((nested: any) => `${option.name}:${nested.name}`);
        }

        return [];
    });

    const optionNames = collectNestedOptionNames(options);
    const parts = [`/${json.name}`];

    if (subcommandNames.length) {
        parts.push(`[${subcommandNames.join('|')}]`);
    }

    optionNames.forEach((name) => {
        parts.push(`[${name}]`);
    });

    return parts.join(' ');
};

const COMMAND_FIELD_LIMIT = 1024;

const getCommandLines = (commands: ModuleCommand[], detailedUsage: boolean) =>
    commands.map((command) => `• \`${detailedUsage ? command.usage : `/${command.name}`}\` — ${command.summary}`);

const splitCommandLines = (commands: ModuleCommand[], detailedUsage: boolean, limit = COMMAND_FIELD_LIMIT) => {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of getCommandLines(commands, detailedUsage)) {
        const nextChunk = currentChunk ? `${currentChunk}\n${line}` : line;
        if (nextChunk.length <= limit) {
            currentChunk = nextChunk;
            continue;
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        currentChunk = line.length <= limit ? line : line.slice(0, limit - 1);
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks.length ? chunks : ['-'];
};

export const getHelpModules = (locale: LocaleCode, commands?: Collection<string, Command<any>>): HelpModule[] =>
    withCommandUsages(HELP_MODULES_BASE.map((module) => ({
        id: module.id,
        label: localizeText(module.label, locale),
        emoji: module.emoji,
        menuHint: localizeText(module.menuHint, locale),
        description: localizeText(module.description, locale),
        color: module.color,
        commands: module.commands.map((command) => ({
            name: command.name,
            usage: command.usage ?? `/${command.name}`,
            summary: localizeText(command.summary, locale),
            details: localizeText(command.details, locale),
            roles: command.roles,
        })),
    })), commands);

export const getHelpCommandNames = (modules: HelpModule[]) =>
    modules.flatMap((module) => module.commands.map((command) => command.name));

const buildCommandRegistry = (commands: Collection<string, Command<any>>) =>
    new Map(
        Array.from(commands.values()).map((command) => [
            normalizeCommandName(command.data.name),
            command,
        ]),
    );

const withCommandUsages = (modules: HelpModule[], commands?: Collection<string, Command<any>>) => {
    if (!commands) {
        return modules;
    }

    const registry = buildCommandRegistry(commands);
    return modules.map((module) => ({
        ...module,
        commands: module.commands.map((helpCommand) => {
            const command = registry.get(normalizeCommandName(helpCommand.name));
            return {
                ...helpCommand,
                usage: command ? buildUsageFromCommand(command) : helpCommand.usage,
            };
        }),
    }));
};

const filterHelpModules = (modules: HelpModule[], visibleCommandNames: Set<string>): HelpModule[] =>
    modules
        .map((module) => ({
            ...module,
            commands: module.commands.filter((command) => visibleCommandNames.has(normalizeCommandName(command.name))),
        }))
        .filter((module) => module.commands.length > 0);

const toAccessOptions = (
    command: Command<any>,
    context: Pick<CommandAccessOptions, 'channelId' | 'parentChannelId'>,
): CommandAccessOptions => ({
    accessGroup: command.accessGroup,
    accessKey: command.accessKey ?? command.data.name,
    requiredAccessLevel: command.requiredAccessLevel,
    requiredDiscordPermissions: getCommandDefaultMemberPermissions(command),
    channelId: context.channelId,
    parentChannelId: context.parentChannelId,
});

export const buildHelpSelectRow = (userId: string, locale: LocaleCode, modules: HelpModule[], activeValue = 'all') => {
    const moduleOptions = modules.map((module) => {
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(module.label)
            .setValue(module.id)
            .setDescription(module.menuHint)
            .setDefault(activeValue === module.id);

        if (module.emoji) option.setEmoji(module.emoji);
        return option;
    });

    const select = new StringSelectMenuBuilder()
        .setCustomId(`${HELP_MENU_CUSTOM_ID}:${userId}`)
        .setPlaceholder(locale === 'ru' ? 'Выберите модуль, чтобы увидеть команды' : 'Choose a module to see commands')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(locale === 'ru' ? 'Общий список' : 'All commands')
                .setValue('all')
                .setDescription(locale === 'ru' ? 'Краткий обзор всех модулей' : 'Overview of all modules')
                .setEmoji('📚')
                .setDefault(activeValue === 'all'),
            ...moduleOptions,
        );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
};

export const buildHelpOverviewEmbed = (locale: LocaleCode, modules: HelpModule[]) => {
    const embed = new EmbedBuilder()
        .setTitle(locale === 'ru' ? 'Справочник команд' : 'Command reference')
        .setDescription(t(locale, 'help.overviewDescription'))
        .setColor(EMBED_COLOR)
        .setFooter({ text: t(locale, 'help.footer') });

    modules.forEach((module) => {
        const fieldName = `${module.emoji ? `${module.emoji} ` : ''}${module.label}`;
        splitCommandLines(module.commands, false).forEach((value, index) => {
            embed.addFields({
                name: index === 0 ? fieldName : '\u200b',
                value,
                inline: false,
            });
        });
    });

    return embed;
};

export const buildHelpModuleEmbed = (moduleId: string, locale: LocaleCode, modules: HelpModule[]) => {
    const module = modules.find((item) => item.id === moduleId);
    if (!module) return buildHelpOverviewEmbed(locale, modules);

    const embed = new EmbedBuilder()
        .setTitle(`${module.emoji ? `${module.emoji} ` : ''}${module.label}`)
        .setDescription(module.description)
        .setColor(module.color ?? EMBED_COLOR)
        .setFooter({
            text: locale === 'ru'
                ? 'Используй меню ниже, чтобы переключаться между модулями'
                : 'Use the menu below to switch modules',
        });

    splitCommandLines(module.commands, true).forEach((value, index) => {
        embed.addFields({
            name: index === 0
                ? (locale === 'ru' ? 'Команды' : 'Commands')
                : '\u200b',
            value,
        });
    });

    return embed;
};

export const findCommandInfo = (commandName: string, modules: HelpModule[]) => {
    const normalized = normalizeCommandName(commandName);

    for (const module of modules) {
        const command = module.commands.find((item) => normalizeCommandName(item.name) === normalized);
        if (command) return { module, command };
    }

    return null;
};

export const buildCommandDetailEmbed = (commandName: string, locale: LocaleCode, modules: HelpModule[]) => {
    const info = findCommandInfo(commandName, modules);
    if (!info) {
        return new EmbedBuilder()
            .setTitle(locale === 'ru' ? 'Команда не найдена' : 'Command not found')
            .setDescription(t(locale, 'help.commandNotFound', { command: commandName }))
            .setColor(0xff5555);
    }

    const { module, command } = info;
    return new EmbedBuilder()
        .setTitle(t(locale, 'help.details.title', { command: command.name }))
        .setDescription(command.summary)
        .addFields(
            { name: t(locale, 'help.details.module'), value: `${module.emoji ? `${module.emoji} ` : ''}${module.label}`, inline: true },
            { name: t(locale, 'help.details.access'), value: command.roles || '@everyone', inline: true },
            { name: locale === 'ru' ? 'Использование' : 'Usage', value: `\`${command.usage}\``, inline: false },
            { name: t(locale, 'help.details.more'), value: command.details, inline: false },
        )
        .setColor(module.color ?? EMBED_COLOR);
};

export const buildHelpAccessDeniedEmbed = (locale: LocaleCode) =>
    new EmbedBuilder()
        .setTitle(t(locale, 'help.insufficientAccess'))
        .setColor(0xff5555);

export async function buildGuildHelpView(
    locale: LocaleCode,
    commands: Collection<string, Command<any>>,
    member: GuildMember,
    context: Pick<CommandAccessOptions, 'channelId' | 'parentChannelId'>,
): Promise<HelpView> {
    const modules = getHelpModules(locale, commands);
    const registry = buildCommandRegistry(commands);
    const evaluateAccess = await createModeratorAccessEvaluator(member.guild.id, member);
    const visibleCommandNames = new Set<string>();

    for (const module of modules) {
        for (const helpCommand of module.commands) {
            const command = registry.get(normalizeCommandName(helpCommand.name));
            if (!command || command.hidden) {
                continue;
            }

            if (!evaluateAccess(toAccessOptions(command, context))) {
                continue;
            }

            visibleCommandNames.add(normalizeCommandName(helpCommand.name));
        }
    }

    const filteredModules = filterHelpModules(modules, visibleCommandNames);
    return {
        modules: filteredModules,
        commandNames: getHelpCommandNames(filteredModules),
    };
}

export async function resolveGuildHelpCommand(
    locale: LocaleCode,
    commandName: string,
    commands: Collection<string, Command<any>>,
    member: GuildMember,
    context: Pick<CommandAccessOptions, 'channelId' | 'parentChannelId'>,
): Promise<HelpCommandLookupResult> {
    const modules = getHelpModules(locale, commands);
    const info = findCommandInfo(commandName, modules);
    if (!info) {
        return { state: 'not_found' };
    }

    const registry = buildCommandRegistry(commands);
    const command = registry.get(normalizeCommandName(commandName));
    if (!command || command.hidden) {
        return { state: 'not_found' };
    }

    const evaluateAccess = await createModeratorAccessEvaluator(member.guild.id, member);
    if (!evaluateAccess(toAccessOptions(command, context))) {
        return { state: 'denied' };
    }

    return {
        state: 'allowed',
        module: info.module,
        command: info.command,
    };
}
