import {
    AiIncidentState,
    AnalyticsState,
    AppealReviewDecision,
    AppealTicketState,
    CasesState,
    ConfigState,
    CustomRule,
} from './types';
import { createDefaultCommandRules } from '@/lib/commandCatalog';

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
