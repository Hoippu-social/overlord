import {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import { LocaleCode, t } from './i18n';

type LocalizedText = { en: string; ru: string };

type ModuleCommandBase = {
    name: string;
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
                summary: { en: 'Opens the help menu.', ru: 'Открывает меню помощи.' },
                details: {
                    en: 'Shows the full command list or details for a specific command when you pass its name.',
                    ru: 'Показывает список команд или подробности по конкретной команде, если указать её имя.',
                },
                roles: '@everyone',
            },
            {
                name: 'ping',
                summary: { en: 'Checks bot availability.', ru: 'Проверяет доступность бота.' },
                details: { en: 'Replies with Pong! to confirm the bot is online.', ru: 'Отвечает Pong!, чтобы убедиться, что бот онлайн.' },
                roles: '@everyone',
            },
        ],
    },
    {
        id: 'music',
        label: { en: 'Music', ru: 'Музыка' },
        emoji: '🎵',
        menuHint: { en: 'Queue, volume, loops', ru: 'Очередь, громкость, повторы' },
        description: {
            en: 'Music player controls: queue, volume, loops, quick search.',
            ru: 'Управление плеером: очередь, громкость, повторы и быстрый поиск.',
        },
        commands: [
            {
                name: 'play',
                summary: { en: 'Play by link or search.', ru: 'Воспроизводит по ссылке или поиску.' },
                details: {
                    en: 'Accepts a URL or text; search mode shows platform/track pickers and enqueues the choice. Playlists supported.',
                    ru: 'Принимает ссылку или текст; при поиске покажет выбор платформы/трека и добавит выбранное. Поддерживает плейлисты.',
                },
                roles: '@everyone (DJ/канальные ограничения учитываются)',
            },
            {
                name: 'pause',
                summary: { en: 'Pauses current track.', ru: 'Ставит текущий трек на паузу.' },
                details: {
                    en: 'Works when you share the voice channel with the bot. Updates now playing status.',
                    ru: 'Работает, если вы в том же голосовом канале. Обновляет статус now playing.',
                },
                roles: '@everyone',
            },
            {
                name: 'resume',
                summary: { en: 'Resumes playback.', ru: 'Возобновляет паузу.' },
                details: {
                    en: 'Brings playback back if it was paused and you are in the correct voice channel.',
                    ru: 'Возвращает воспроизведение, если плеер был на паузе и вы в нужном канале.',
                },
                roles: '@everyone',
            },
            {
                name: 'skip',
                summary: { en: 'Skips current track.', ru: 'Пропускает текущий трек.' },
                details: {
                    en: 'Moves to the next queue item when you are in the voice channel with the bot.',
                    ru: 'Переключает на следующий элемент очереди, если вы в голосовом канале вместе с ботом.',
                },
                roles: '@everyone',
            },
            {
                name: 'stop',
                summary: { en: 'Stops music and clears queue.', ru: 'Останавливает музыку и очищает очередь.' },
                details: {
                    en: 'Disconnects from the voice channel and clears the playback queue.',
                    ru: 'Разрывает соединение с голосовым каналом и очищает очередь воспроизведения.',
                },
                roles: '@everyone',
            },
            {
                name: 'queue',
                summary: { en: 'Shows the queue.', ru: 'Показывает очередь.' },
                details: {
                    en: 'Paginated by 10 tracks; shows current track, total count, and total duration.',
                    ru: 'Пагинация по 10 треков; отображает текущий трек, общее количество и суммарную длительность.',
                },
                roles: '@everyone',
            },
            {
                name: 'nowplaying',
                summary: { en: 'Displays the current track.', ru: 'Показывает текущий трек.' },
                details: {
                    en: 'Shows progress bar, volume, loop mode, queue size, and artwork if available.',
                    ru: 'Показывает прогресс-бар, громкость, режим повтора, размер очереди и обложку, если есть.',
                },
                roles: '@everyone',
            },
            {
                name: 'loop',
                summary: { en: 'Switches loop mode.', ru: 'Переключает режим повтора.' },
                details: {
                    en: 'No args: off → track → queue. You can pick a mode via the option.',
                    ru: 'Без параметров: выкл → трек → очередь. Опцией можно задать режим вручную.',
                },
                roles: '@everyone',
            },
            {
                name: 'shuffle',
                summary: { en: 'Shuffles the queue.', ru: 'Перемешивает очередь.' },
                details: {
                    en: 'Requires at least two tracks in queue; keeps the currently playing track.',
                    ru: 'Нужно минимум два трека в очереди; текущий трек не трогается.',
                },
                roles: '@everyone',
            },
            {
                name: 'seek',
                summary: { en: 'Seeks inside the track.', ru: 'Перематывает трек.' },
                details: {
                    en: 'Accepts formats 1:30, 90, or 1m30s; moves within track duration.',
                    ru: 'Принимает 1:30, 90 или 1m30s и перематывает в пределах трека.',
                },
                roles: '@everyone',
            },
            {
                name: 'volume',
                summary: { en: 'Sets player volume.', ru: 'Устанавливает громкость.' },
                details: {
                    en: 'Shows current volume without params; accepts 0–150 and applies immediately.',
                    ru: 'Показывает текущую громкость без параметров; принимает 0–150 и применяет сразу.',
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
            en: 'Set up temporary voice rooms and a control panel channel.',
            ru: 'Настройка временных голосовых комнат и панели управления.',
        },
        commands: [
            {
                name: 'setupv',
                summary: { en: 'Quick temp-room setup.', ru: 'Быстрая настройка временных комнат.' },
                details: {
                    en: 'Creates category, lobby, and text panel with control buttons; lets you set names, {user} template, and limits.',
                    ru: 'Создаёт категорию, лобби и текстовый канал с кнопками; можно задать названия, шаблон {user} и лимит.',
                },
                roles: 'Manage Channels',
            },
        ],
    },
    {
        id: 'admin',
        label: { en: 'Administration', ru: 'Администрирование' },
        emoji: '🛠️',
        menuHint: { en: 'System settings', ru: 'Системные настройки' },
        description: {
            en: 'Administration tools for the bot and server.',
            ru: 'Инструменты администрирования бота и сервера.',
        },
        commands: [
            {
                name: 'tempvoice',
                summary: { en: 'Manage private temp rooms.', ru: 'Управление системой приватных комнат.' },
                details: {
                    en: 'Subcommands: setup — lobby, category, template, limit; status — view config; disable — turn off and clean active rooms. Requires Manage Channels.',
                    ru: 'Подкоманды: setup — лобби, категория, шаблон, лимит; status — показать конфиг; disable — выключить и очистить активные комнаты. Требует Manage Channels.',
                },
                roles: 'Manage Channels',
            },
        ],
    },
];

const localizeText = (text: LocalizedText, locale: LocaleCode) => text[locale] ?? text.ru ?? text.en;

export const VISIBLE_COMMANDS = HELP_MODULES_BASE.flatMap((module) =>
    module.commands.map((cmd) => cmd.name)
);

const formatCommandLines = (commands: ModuleCommand[]) =>
    commands.map((cmd) => `• \`/${cmd.name}\` — ${cmd.summary}`).join('\n');

const toLocalizedModules = (locale: LocaleCode): HelpModule[] =>
    HELP_MODULES_BASE.map((module) => ({
        id: module.id,
        label: localizeText(module.label, locale),
        emoji: module.emoji,
        menuHint: localizeText(module.menuHint, locale),
        description: localizeText(module.description, locale),
        color: module.color,
        commands: module.commands.map((cmd) => ({
            name: cmd.name,
            summary: localizeText(cmd.summary, locale),
            details: localizeText(cmd.details, locale),
            roles: cmd.roles,
        })),
    }));

export const buildHelpSelectRow = (userId: string, locale: LocaleCode, activeValue = 'all') => {
    const modules = toLocalizedModules(locale);
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

export const buildHelpOverviewEmbed = (locale: LocaleCode) => {
    const modules = toLocalizedModules(locale);
    const embed = new EmbedBuilder()
        .setTitle(locale === 'ru' ? 'Справочник команд' : 'Command reference')
        .setDescription(t(locale, 'help.overviewDescription'))
        .setColor(EMBED_COLOR)
        .setFooter({ text: t(locale, 'help.footer') });

    modules.forEach((module) => {
        embed.addFields({
            name: `${module.emoji ? `${module.emoji} ` : ''}${module.label}`,
            value: formatCommandLines(module.commands),
            inline: false,
        });
    });

    return embed;
};

export const buildHelpModuleEmbed = (moduleId: string, locale: LocaleCode) => {
    const modules = toLocalizedModules(locale);
    const module = modules.find((item) => item.id === moduleId);
    if (!module) return buildHelpOverviewEmbed(locale);

    const embed = new EmbedBuilder()
        .setTitle(`${module.emoji ? `${module.emoji} ` : ''}${module.label}`)
        .setDescription(module.description)
        .setColor(module.color ?? EMBED_COLOR)
        .addFields({
            name: locale === 'ru' ? 'Команды' : 'Commands',
            value: formatCommandLines(module.commands),
        })
        .setFooter({
            text: locale === 'ru'
                ? 'Используй меню ниже, чтобы переключаться между модулями'
                : 'Use the menu below to switch modules',
        });

    return embed;
};

export const findCommandInfo = (commandName: string, locale: LocaleCode) => {
    const modules = toLocalizedModules(locale);
    const normalized = commandName.toLowerCase();
    for (const module of modules) {
        const cmd = module.commands.find((c) => c.name.toLowerCase() === normalized);
        if (cmd) return { module, command: cmd };
    }
    return null;
};

export const buildCommandDetailEmbed = (commandName: string, locale: LocaleCode) => {
    const info = findCommandInfo(commandName, locale);
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
            { name: t(locale, 'help.details.more'), value: command.details, inline: false },
        )
        .setColor(module.color ?? EMBED_COLOR);
};
