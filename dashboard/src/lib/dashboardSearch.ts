export type DashboardSearchLocale = 'ru' | 'en';

export type DashboardSearchIcon =
    | 'audit'
    | 'channel'
    | 'commands'
    | 'economy'
    | 'hub'
    | 'moderation'
    | 'music'
    | 'settings'
    | 'stats'
    | 'tickets'
    | 'user'
    | 'voice';

type LocalizedText = Record<DashboardSearchLocale, string>;

type DashboardSearchCatalogEntry = {
    id: string;
    icon: DashboardSearchIcon;
    title: LocalizedText;
    breadcrumb: LocalizedText;
    href: string;
    aliases: Record<DashboardSearchLocale, string[]>;
    preservePeriod?: boolean;
};

export type DashboardSearchMenuResult = {
    id: string;
    type: 'menu';
    icon: DashboardSearchIcon;
    title: string;
    breadcrumb: string;
    href: string;
    score: number;
};

const makeHref = (guildId: string, href: string, period?: string) => {
    const path = href.replace('{guildId}', guildId);
    if (!period || !path.includes('/stats')) {
        return path;
    }

    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}period=${encodeURIComponent(period)}`;
};

const catalog: DashboardSearchCatalogEntry[] = [
    {
        id: 'hub',
        icon: 'hub',
        href: '/dashboard/{guildId}',
        title: { ru: 'Главная', en: 'Dashboard' },
        breadcrumb: { ru: 'Меню > Главная', en: 'Menu > Dashboard' },
        aliases: { ru: ['дашборд', 'главная', 'обзор сервера', 'сервер'], en: ['dashboard', 'home', 'hub', 'server overview'] },
    },
    {
        id: 'stats',
        icon: 'stats',
        href: '/dashboard/{guildId}/stats',
        preservePeriod: true,
        title: { ru: 'Статистика', en: 'Statistics' },
        breadcrumb: { ru: 'Меню > Статистика > Обзор', en: 'Menu > Statistics > Overview' },
        aliases: { ru: ['стата', 'аналитика', 'обзор статистики', 'метрики'], en: ['stats', 'analytics', 'overview', 'metrics'] },
    },
    {
        id: 'stats-messages',
        icon: 'stats',
        href: '/dashboard/{guildId}/stats/messages',
        preservePeriod: true,
        title: { ru: 'Сообщения', en: 'Messages' },
        breadcrumb: { ru: 'Меню > Статистика > Сообщения', en: 'Menu > Statistics > Messages' },
        aliases: { ru: ['сообщения', 'чаты', 'текст', 'активность сообщений'], en: ['messages', 'chat', 'text activity'] },
    },
    {
        id: 'stats-voice',
        icon: 'voice',
        href: '/dashboard/{guildId}/stats/voice',
        preservePeriod: true,
        title: { ru: 'Голос', en: 'Voice' },
        breadcrumb: { ru: 'Меню > Статистика > Голос', en: 'Menu > Statistics > Voice' },
        aliases: { ru: ['голос', 'войс', 'голосовая активность', 'войс статистика'], en: ['voice', 'voice activity', 'voice stats'] },
    },
    {
        id: 'stats-members',
        icon: 'user',
        href: '/dashboard/{guildId}/stats/members',
        preservePeriod: true,
        title: { ru: 'Участники', en: 'Members' },
        breadcrumb: { ru: 'Меню > Статистика > Участники', en: 'Menu > Statistics > Members' },
        aliases: { ru: ['участники', 'мемберы', 'пользователи сервера'], en: ['members', 'server members'] },
    },
    {
        id: 'stats-channels',
        icon: 'channel',
        href: '/dashboard/{guildId}/stats/channels',
        preservePeriod: true,
        title: { ru: 'О канале', en: 'About Channel' },
        breadcrumb: { ru: 'Меню > Статистика > О канале', en: 'Menu > Statistics > About Channel' },
        aliases: { ru: ['каналы', 'канал', 'о канале', 'статистика канала'], en: ['channels', 'channel', 'about channel', 'channel stats'] },
    },
    {
        id: 'stats-users',
        icon: 'user',
        href: '/dashboard/{guildId}/stats/users',
        preservePeriod: true,
        title: { ru: 'О пользователе', en: 'About User' },
        breadcrumb: { ru: 'Меню > Статистика > О пользователе', en: 'Menu > Statistics > About User' },
        aliases: { ru: ['пользователи', 'пользователь', 'юзер', 'о пользователе', 'статистика пользователя'], en: ['users', 'user', 'about user', 'member stats'] },
    },
    {
        id: 'stats-activities',
        icon: 'stats',
        href: '/dashboard/{guildId}/stats/activities',
        preservePeriod: true,
        title: { ru: 'Активности', en: 'Activities' },
        breadcrumb: { ru: 'Меню > Статистика > Активности', en: 'Menu > Statistics > Activities' },
        aliases: { ru: ['активности', 'активность', 'ивенты'], en: ['activities', 'activity', 'events'] },
    },
    {
        id: 'stats-contacts',
        icon: 'user',
        href: '/dashboard/{guildId}/stats/contacts',
        preservePeriod: true,
        title: { ru: 'Связи', en: 'Contacts' },
        breadcrumb: { ru: 'Меню > Статистика > Связи', en: 'Menu > Statistics > Contacts' },
        aliases: { ru: ['связи', 'контакты', 'граф', 'нетворк'], en: ['contacts', 'network', 'graph', 'connections'] },
    },
    {
        id: 'moderation',
        icon: 'moderation',
        href: '/dashboard/{guildId}/moderation',
        title: { ru: 'Модерация', en: 'Moderation' },
        breadcrumb: { ru: 'Меню > Модерация > Обзор', en: 'Menu > Moderation > Overview' },
        aliases: { ru: ['модерация', 'модерирование', 'модеры', 'санкции'], en: ['moderation', 'moderators', 'cases', 'sanctions'] },
    },
    {
        id: 'moderation-access',
        icon: 'moderation',
        href: '/dashboard/{guildId}/moderation?tab=access',
        title: { ru: 'Доступ модерации', en: 'Access Control' },
        breadcrumb: { ru: 'Меню > Модерация > Доступ', en: 'Menu > Moderation > Access Control' },
        aliases: { ru: ['доступ', 'права', 'роли модераторов', 'модуль доступа'], en: ['access', 'permissions', 'moderator roles'] },
    },
    {
        id: 'moderation-automod',
        icon: 'moderation',
        href: '/dashboard/{guildId}/moderation?tab=automod',
        title: { ru: 'Автомод', en: 'AutoMod' },
        breadcrumb: { ru: 'Меню > Модерация > Автомод', en: 'Menu > Moderation > AutoMod' },
        aliases: { ru: ['автомод', 'авто модерация', 'фильтры', 'правила'], en: ['automod', 'auto moderation', 'filters', 'rules'] },
    },
    {
        id: 'moderation-ai',
        icon: 'moderation',
        href: '/dashboard/{guildId}/moderation?tab=ai',
        title: { ru: 'AI-проверка', en: 'AI Review' },
        breadcrumb: { ru: 'Меню > Модерация > AI-проверка', en: 'Menu > Moderation > AI Review' },
        aliases: { ru: ['аи', 'ai', 'искусственный интеллект', 'проверка сообщений'], en: ['ai', 'ai review', 'machine review'] },
    },
    {
        id: 'moderation-appeals',
        icon: 'tickets',
        href: '/dashboard/{guildId}/moderation?tab=appeals',
        title: { ru: 'Апелляции', en: 'Appeals' },
        breadcrumb: { ru: 'Меню > Модерация > Апелляции', en: 'Menu > Moderation > Appeals' },
        aliases: { ru: ['апелляции', 'обжалования', 'жалобы'], en: ['appeals', 'appeal tickets'] },
    },
    {
        id: 'moderation-retention',
        icon: 'settings',
        href: '/dashboard/{guildId}/moderation?tab=retention',
        title: { ru: 'Хранение', en: 'Retention' },
        breadcrumb: { ru: 'Меню > Модерация > Хранение', en: 'Menu > Moderation > Retention' },
        aliases: { ru: ['хранение', 'ретеншн', 'сроки', 'очистка'], en: ['retention', 'storage', 'cleanup'] },
    },
    {
        id: 'moderation-analytics',
        icon: 'stats',
        href: '/dashboard/{guildId}/moderation?tab=analytics',
        title: { ru: 'Аналитика модерации', en: 'Moderation Analytics' },
        breadcrumb: { ru: 'Меню > Модерация > Аналитика', en: 'Menu > Moderation > Analytics' },
        aliases: { ru: ['аналитика модерации', 'эффективность модераторов'], en: ['moderation analytics', 'moderator analytics'] },
    },
    {
        id: 'commands',
        icon: 'commands',
        href: '/dashboard/{guildId}/commands',
        title: { ru: 'Команды', en: 'Commands' },
        breadcrumb: { ru: 'Меню > Команды', en: 'Menu > Commands' },
        aliases: { ru: ['команды', 'слеш команды', 'права команд', 'модуль команд'], en: ['commands', 'slash commands', 'command permissions'] },
    },
    {
        id: 'audit',
        icon: 'audit',
        href: '/dashboard/{guildId}/audit',
        title: { ru: 'Журнал аудита', en: 'Audit Log' },
        breadcrumb: { ru: 'Меню > Журнал аудита', en: 'Menu > Audit Log' },
        aliases: { ru: ['аудит', 'журнал', 'логи', 'маршруты аудита'], en: ['audit', 'audit log', 'logs', 'routes'] },
    },
    {
        id: 'economy',
        icon: 'economy',
        href: '/dashboard/{guildId}/economy',
        title: { ru: 'Экономика', en: 'Economy' },
        breadcrumb: { ru: 'Меню > Экономика', en: 'Menu > Economy' },
        aliases: { ru: ['экономика', 'монеты', 'баланс', 'кошельки'], en: ['economy', 'coins', 'balance', 'wallets'] },
    },
    {
        id: 'music',
        icon: 'music',
        href: '/dashboard/{guildId}/music',
        title: { ru: 'Музыка', en: 'Music' },
        breadcrumb: { ru: 'Меню > Музыка', en: 'Menu > Music' },
        aliases: { ru: ['музыка', 'плеер', 'очередь', 'треки'], en: ['music', 'player', 'queue', 'tracks'] },
    },
    {
        id: 'voice-rooms',
        icon: 'voice',
        href: '/dashboard/{guildId}/tempvoice',
        title: { ru: 'Войс-румы', en: 'Voice Rooms' },
        breadcrumb: { ru: 'Меню > Войс-румы', en: 'Menu > Voice Rooms' },
        aliases: { ru: ['войс', 'войс румы', 'временные комнаты', 'голосовые комнаты'], en: ['voice rooms', 'temporary voice', 'temp voice'] },
    },
    {
        id: 'tickets',
        icon: 'tickets',
        href: '/dashboard/{guildId}/tickets',
        title: { ru: 'Тикеты', en: 'Tickets' },
        breadcrumb: { ru: 'Меню > Тикеты > Обзор', en: 'Menu > Tickets > Overview' },
        aliases: { ru: ['тикеты', 'заявки', 'поддержка', 'категории тикетов'], en: ['tickets', 'support', 'service desk', 'categories'] },
    },
    {
        id: 'tickets-stats',
        icon: 'stats',
        href: '/dashboard/{guildId}/tickets/stats',
        title: { ru: 'Статистика тикетов', en: 'Ticket Stats' },
        breadcrumb: { ru: 'Меню > Тикеты > Статистика', en: 'Menu > Tickets > Stats' },
        aliases: { ru: ['статистика тикетов', 'метрики тикетов'], en: ['ticket stats', 'ticket metrics'] },
    },
    {
        id: 'tickets-transcripts',
        icon: 'tickets',
        href: '/dashboard/{guildId}/tickets/transcripts',
        title: { ru: 'Транскрипты', en: 'Transcripts' },
        breadcrumb: { ru: 'Меню > Тикеты > Транскрипты', en: 'Menu > Tickets > Transcripts' },
        aliases: { ru: ['транскрипты', 'история тикетов'], en: ['transcripts', 'ticket history'] },
    },
    {
        id: 'settings',
        icon: 'settings',
        href: '/dashboard/{guildId}/server-settings',
        title: { ru: 'Настройки сервера', en: 'Server Settings' },
        breadcrumb: { ru: 'Меню > Настройки сервера', en: 'Menu > Server Settings' },
        aliases: { ru: ['настройки', 'серверные настройки', 'параметры'], en: ['settings', 'server settings', 'configuration'] },
    },
    {
        id: 'settings-prefix',
        icon: 'commands',
        href: '/dashboard/{guildId}/server-settings',
        title: { ru: 'Префикс команд', en: 'Command Prefix' },
        breadcrumb: { ru: 'Меню > Настройки сервера > Префикс команд', en: 'Menu > Server Settings > Command Prefix' },
        aliases: { ru: ['префикс', 'префикс команд', 'текстовые команды'], en: ['prefix', 'command prefix', 'text commands'] },
    },
    {
        id: 'settings-command-channels',
        icon: 'channel',
        href: '/dashboard/{guildId}/server-settings',
        title: { ru: 'Каналы для команд', en: 'Command Channels' },
        breadcrumb: { ru: 'Меню > Настройки сервера > Каналы для команд', en: 'Menu > Server Settings > Command Channels' },
        aliases: { ru: ['каналы команд', 'командные каналы', 'разрешенные каналы'], en: ['command channels', 'allowed channels', 'blocked channels'] },
    },
    {
        id: 'settings-admins',
        icon: 'moderation',
        href: '/dashboard/{guildId}/server-settings',
        title: { ru: 'Администраторы бота', en: 'Bot Administrators' },
        breadcrumb: { ru: 'Меню > Настройки сервера > Администраторы бота', en: 'Menu > Server Settings > Bot Administrators' },
        aliases: { ru: ['администраторы', 'админы бота', 'роли админов'], en: ['bot admins', 'administrators', 'admin roles'] },
    },
    {
        id: 'settings-language',
        icon: 'settings',
        href: '/dashboard/{guildId}/server-settings',
        title: { ru: 'Язык', en: 'Language' },
        breadcrumb: { ru: 'Меню > Настройки сервера > Язык', en: 'Menu > Server Settings > Language' },
        aliases: { ru: ['язык', 'локаль', 'перевод'], en: ['language', 'locale', 'translation'] },
    },
    {
        id: 'settings-timezone',
        icon: 'settings',
        href: '/dashboard/{guildId}/server-settings',
        title: { ru: 'Часовой пояс', en: 'Timezone' },
        breadcrumb: { ru: 'Меню > Настройки сервера > Часовой пояс', en: 'Menu > Server Settings > Timezone' },
        aliases: { ru: ['часовой пояс', 'таймзона', 'время'], en: ['timezone', 'time zone', 'time'] },
    },
];

export function normalizeDashboardSearchText(value: string) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ё/g, 'е')
        .replace(/Ё/g, 'е')
        .replace(/[<@#!>]/g, ' ')
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/giu, ' ')
        .trim();
}

function levenshtein(left: string, right: string) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = new Array<number>(right.length + 1);

    for (let i = 1; i <= left.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost,
            );
        }

        for (let j = 0; j <= right.length; j += 1) {
            previous[j] = current[j];
        }
    }

    return previous[right.length];
}

function scoreCandidate(query: string, candidate: string) {
    const normalized = normalizeDashboardSearchText(candidate);
    if (!query || !normalized) return 0;
    if (normalized === query) return 1;
    if (normalized.startsWith(query)) return 0.94;
    if (normalized.includes(query)) return 0.88;

    const candidateWords = normalized.split(' ').filter(Boolean);
    const queryWords = query.split(' ').filter(Boolean);
    let best = 0;

    for (const queryWord of queryWords.length ? queryWords : [query]) {
        for (const candidateWord of candidateWords.length ? candidateWords : [normalized]) {
            const distance = levenshtein(queryWord, candidateWord);
            const longest = Math.max(queryWord.length, candidateWord.length);
            const similarity = longest === 0 ? 0 : 1 - distance / longest;
            if (similarity > best) {
                best = similarity;
            }
        }
    }

    return best * 0.8;
}

export function searchDashboardCatalog(
    rawQuery: string,
    locale: DashboardSearchLocale,
    guildId: string,
    period?: string,
    limit = 8,
): DashboardSearchMenuResult[] {
    const query = normalizeDashboardSearchText(rawQuery);
    if (!query) {
        return [];
    }

    const compactQueryLength = query.replace(/\s/g, '').length;
    const minScore = compactQueryLength <= 2 ? 0.72 : compactQueryLength <= 4 ? 0.6 : 0.48;

    return catalog
        .map((entry) => {
            const fallbackLocale = locale === 'ru' ? 'en' : 'ru';
            const candidates = [
                { value: entry.title[locale], weight: 1.08 },
                { value: entry.title[fallbackLocale], weight: 1.02 },
                { value: entry.breadcrumb[locale], weight: 0.9 },
                ...entry.aliases[locale].map((value) => ({ value, weight: 1.06 })),
                ...entry.aliases[fallbackLocale].map((value) => ({ value, weight: 1 })),
            ];
            const score = Math.max(
                ...candidates.map((candidate) => Math.min(1, scoreCandidate(query, candidate.value) * candidate.weight)),
            );

            return {
                id: entry.id,
                type: 'menu' as const,
                icon: entry.icon,
                title: entry.title[locale],
                breadcrumb: entry.breadcrumb[locale],
                href: makeHref(guildId, entry.href, entry.preservePeriod ? period : undefined),
                score,
            };
        })
        .filter((entry) => entry.score >= minScore)
        .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, locale))
        .slice(0, limit);
}
