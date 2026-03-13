import {
    ConfigState,
    CasesState,
    AiIncidentState,
    AppealTicketState,
    AnalyticsState,
    CustomRule,
    AppealReviewDecision,
    CommandRule,
} from './types';

export const BUILTIN_RULE_LABELS: Record<string, string> = {
    flood: 'Flood',
    duplicate_messages: 'Duplicate spam',
    repeated_strings: 'Repeated strings',
    mentions_spam: 'Mass mentions',
    links: 'Links',
    advertising: 'Advertising',
    emoji_spam: 'Emoji spam',
    zalgo: 'Zalgo',
    command_only: 'Command-only channels',
    image_filter: 'Image filter',
};

export const BUILTIN_RULE_LABELS_RU: Record<string, string> = {
    flood: 'Флуд',
    duplicate_messages: 'Повторы сообщений',
    repeated_strings: 'Повторяющиеся строки',
    mentions_spam: 'Спам упоминаниями',
    links: 'Ссылки',
    advertising: 'Реклама',
    emoji_spam: 'Спам эмодзи',
    zalgo: 'Залго',
    command_only: 'Каналы только для команд',
    image_filter: 'Фильтр изображений',
};

export const CATEGORY_LABELS: Record<string, string> = {
    toxicity: 'Toxicity',
    harassment: 'Harassment',
    hate_discrimination: 'Hate / discrimination',
    threats_violence: 'Threats / violence',
    sexual_explicit: 'Sexual explicit',
    scam_fraud: 'Scam / fraud',
    self_harm_crisis: 'Self-harm / crisis',
    doxxing_personal_data: 'Personal data',
};

export const CATEGORY_LABELS_RU: Record<string, string> = {
    toxicity: 'Токсичность',
    harassment: 'Травля',
    hate_discrimination: 'Ненависть / дискриминация',
    threats_violence: 'Угрозы / насилие',
    sexual_explicit: 'Откровенный сексуальный контент',
    scam_fraud: 'Скам / мошенничество',
    self_harm_crisis: 'Самоповреждение / кризис',
    doxxing_personal_data: 'Личные данные',
};

export const ACCESS_PRESETS = ['Helper', 'Moderator', 'Control', 'Administrator'];
export const MODERATION_COMMANDS = [
    {
        key: 'appeals',
        label: { en: 'Appeals', ru: 'Апелляции' },
        description: { en: 'Review and resolve moderation appeals.', ru: 'Просмотр и разбор апелляций модерации.' },
    },
    {
        key: 'ban',
        label: { en: 'Ban', ru: 'Бан' },
        description: { en: 'Ban a member from the server.', ru: 'Блокировка участника на сервере.' },
    },
    {
        key: 'case',
        label: { en: 'Case', ru: 'Кейс' },
        description: { en: 'Inspect a specific moderation case.', ru: 'Просмотр конкретного модерационного кейса.' },
    },
    {
        key: 'cases',
        label: { en: 'Cases', ru: 'Кейсы' },
        description: { en: 'Browse moderation case history.', ru: 'Просмотр истории модерационных кейсов.' },
    },
    {
        key: 'clear',
        label: { en: 'Clear', ru: 'Очистка' },
        description: { en: 'Bulk delete messages in a channel.', ru: 'Массовое удаление сообщений в канале.' },
    },
    {
        key: 'kick',
        label: { en: 'Kick', ru: 'Кик' },
        description: { en: 'Kick a member from the server.', ru: 'Исключение участника с сервера.' },
    },
    {
        key: 'lock',
        label: { en: 'Lock', ru: 'Лок' },
        description: { en: 'Lock a channel from sending messages.', ru: 'Закрытие канала для отправки сообщений.' },
    },
    {
        key: 'mute',
        label: { en: 'Mute', ru: 'Мьют' },
        description: { en: 'Apply the configured mute role.', ru: 'Выдача настроенной роли мута.' },
    },
    {
        key: 'note',
        label: { en: 'Notes', ru: 'Заметки' },
        description: { en: 'Manage internal moderation notes.', ru: 'Управление внутренними заметками модерации.' },
    },
    {
        key: 'slowmode',
        label: { en: 'Slowmode', ru: 'Медленный режим' },
        description: { en: 'Configure channel slowmode.', ru: 'Настройка медленного режима канала.' },
    },
    {
        key: 'tempban',
        label: { en: 'Tempban', ru: 'Временный бан' },
        description: { en: 'Temporarily ban a user.', ru: 'Временная блокировка пользователя.' },
    },
    {
        key: 'timeout',
        label: { en: 'Timeout', ru: 'Таймаут' },
        description: { en: 'Temporarily timeout a member.', ru: 'Временное ограничение участника.' },
    },
    {
        key: 'unban',
        label: { en: 'Unban', ru: 'Разбан' },
        description: { en: 'Remove an active ban.', ru: 'Снятие активной блокировки.' },
    },
    {
        key: 'unlock',
        label: { en: 'Unlock', ru: 'Разлок' },
        description: { en: 'Re-open a locked channel.', ru: 'Повторное открытие закрытого канала.' },
    },
    {
        key: 'unmute',
        label: { en: 'Unmute', ru: 'Размьют' },
        description: { en: 'Remove the configured mute role.', ru: 'Снятие настроенной роли мута.' },
    },
    {
        key: 'untimeout',
        label: { en: 'Untimeout', ru: 'Снять таймаут' },
        description: { en: 'Remove an active timeout.', ru: 'Снятие активного таймаута.' },
    },
    {
        key: 'unwarn',
        label: { en: 'Unwarn', ru: 'Снять предупреждение' },
        description: { en: 'Clear a warning case.', ru: 'Снятие предупреждения по кейсу.' },
    },
    {
        key: 'voicekick',
        label: { en: 'Voice Kick', ru: 'Кик из голосового' },
        description: { en: 'Disconnect a member from voice.', ru: 'Отключение участника из голосового канала.' },
    },
    {
        key: 'voicemove',
        label: { en: 'Voice Move', ru: 'Перемещение в голосовом' },
        description: { en: 'Move a member between voice channels.', ru: 'Перемещение участника между голосовыми каналами.' },
    },
    {
        key: 'warn',
        label: { en: 'Warn', ru: 'Предупреждение' },
        description: { en: 'Issue a warning to a member.', ru: 'Выдача предупреждения участнику.' },
    },
    {
        key: 'warnings',
        label: { en: 'Warnings', ru: 'Предупреждения' },
        description: { en: 'List active warnings for a member.', ru: 'Просмотр активных предупреждений участника.' },
    },
] as const;

export const MODERATION_COMMAND_DEFAULT_LEVELS: Record<string, number> = {
    appeals: 70,
    ban: 85,
    case: 35,
    cases: 35,
    clear: 55,
    kick: 65,
    lock: 55,
    mute: 55,
    note: 30,
    slowmode: 55,
    tempban: 80,
    timeout: 60,
    unban: 80,
    unlock: 55,
    unmute: 55,
    untimeout: 60,
    unwarn: 60,
    voicekick: 45,
    voicemove: 45,
    warn: 45,
    warnings: 35,
};

export const getDefaultCommandRule = (commandKey: string): CommandRule => ({
    commandKey,
    enabled: true,
    roleMode: 'WHITELIST',
    roleIds: [],
    channelMode: 'WHITELIST',
    channelIds: [],
    requiredAccessLevel: MODERATION_COMMAND_DEFAULT_LEVELS[commandKey] ?? 50,
});

export const createDefaultCommandRules = (): CommandRule[] =>
    MODERATION_COMMANDS.map((command) => getDefaultCommandRule(command.key));
export const SANCTION_ACTIONS = ['WARN', 'TIMEOUT', 'MUTE', 'KICK', 'BAN'];
export const CUSTOM_RULE_TYPES = ['regex', 'keyword-list'];
export const CUSTOM_RULE_ACTIONS = ['DELETE', 'WARN', 'TIMEOUT', 'MUTE', 'KICK'];
export const APPEAL_REVIEW_OPTIONS: AppealReviewDecision[] = ['IN_REVIEW', 'ACCEPTED', 'REJECTED', 'PARDONED'];
export const AI_PROVIDER_OPTIONS = [
    { id: '', name: 'Disabled / not selected' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'gemini', name: 'Gemini' },
];

export const RETENTION_CATEGORIES = [
    'AI_DISMISSED_INCIDENTS',
    'AI_CONFIRMED_INCIDENTS',
    'AUTOMOD_CASE_METADATA',
    'APPEAL_MESSAGES',
    'APPEAL_RESOLUTION_NOTES',
    'CLEARED_CASE_METADATA',
] as const;

export const RETENTION_STRATEGIES = ['KEEP', 'TRIM', 'DELETE'] as const;

export const RETENTION_LABELS: Record<string, string> = {
    AI_DISMISSED_INCIDENTS: 'Dismissed / false-positive AI incidents',
    AI_CONFIRMED_INCIDENTS: 'Confirmed AI incidents payload',
    AUTOMOD_CASE_METADATA: 'AutoMod case metadata',
    APPEAL_MESSAGES: 'Appeal user messages',
    APPEAL_RESOLUTION_NOTES: 'Appeal resolution notes',
    CLEARED_CASE_METADATA: 'Cleared / expired case metadata',
};

export const RETENTION_LABELS_RU: Record<string, string> = {
    AI_DISMISSED_INCIDENTS: 'Отклоненные / false-positive AI-инциденты',
    AI_CONFIRMED_INCIDENTS: 'Payload подтвержденных AI-инцидентов',
    AUTOMOD_CASE_METADATA: 'Метаданные automod-кейсов',
    APPEAL_MESSAGES: 'Сообщения апелляций',
    APPEAL_RESOLUTION_NOTES: 'Заметки по решениям апелляций',
    CLEARED_CASE_METADATA: 'Метаданные снятых / истекших кейсов',
};

export const CUSTOM_RULE_TEMPLATES: CustomRule[] = [
    {
        name: 'Hidden phishing links',
        ruleType: 'regex',
        pattern: String.raw`\[(?:https?:\/\/|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})[^\]]*\]\((https?:\/\/[^)]+)\)`,
        enabled: true,
        action: 'DELETE',
        strikeWeight: 1,
        notes: 'Blocks disguised markdown phishing links.',
    },
    {
        name: 'Crypto ads',
        ruleType: 'keyword-list',
        pattern: 'crypto|bitcoin|ethereum|investment|passive income|easy money',
        enabled: true,
        action: 'DELETE',
        strikeWeight: 1,
        notes: 'Quick catch for common scam ad wording.',
    },
    {
        name: 'Shortener links',
        ruleType: 'regex',
        pattern: String.raw`(bit\.ly|tinyurl\.com|short\.link|ow\.ly)`,
        enabled: true,
        action: 'DELETE',
        strikeWeight: 1,
        notes: 'Blocks shortened links often used in phishing chains.',
    },
];

export const emptyConfig = (): ConfigState => ({
    roles: [],
    channels: [],
    moderationConfig: {
        muteRoleId: '',
        ignoredChannels: [],
        ignoredRoles: [],
        ignoredUsers: [],
        commandOnlyChannels: [],
    },
    roleBindings: [],
    commandGrants: [],
    commandRules: createDefaultCommandRules(),
    automodRules: [],
    customRules: [],
    sanctionSteps: [],
    aiConfig: {
        enabled: false,
        provider: '',
        model: '',
        defaultThreshold: 80,
        scanEdits: true,
        includedChannels: [],
        excludedChannels: [],
        exemptRoles: [],
        exemptUsers: [],
        customPolicyPrompt: '',
    },
    aiCategories: [],
    appealConfig: {
        enabled: false,
        appealChannelId: '',
        pardonLogChannelId: '',
        allowUserAppeals: true,
        allowDirectPardon: true,
    },
    retentionPolicies: [],
});

export const emptyCases = (): CasesState => ({
    summary: { total: 0, active: 0, warnings: 0, timed: 0 },
    cases: [],
});

export const emptyIncidents = (): AiIncidentState => ({
    summary: { total: 0, open: 0, falsePositive: 0, confirmed: 0 },
    incidents: [],
});

export const emptyAppeals = (): AppealTicketState => ({
    summary: { total: 0, open: 0, inReview: 0, accepted: 0, rejected: 0 },
    tickets: [],
});

export const emptyAnalytics = (): AnalyticsState => ({
    windowDays: 30,
    summary: {
        totalModeratorActions: 0,
        totalAiReviews: 0,
        totalAppealReviews: 0,
        uniqueModerators: 0,
    },
    moderators: [],
});

export function formatDate(value?: string | null, emptyLabel = 'No expiry') {
    if (!value) return emptyLabel;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

export function joinIds(ids: string[]) {
    return ids.join(', ');
}

export function splitIds(value: string) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function updateAtIndex<T>(items: T[], index: number, nextItem: T) {
    return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

export function removeAtIndex<T>(items: T[], index: number) {
    return items.filter((_, itemIndex) => itemIndex !== index);
}
