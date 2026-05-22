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
    zalgo: 'Zalgo',
    emoji: 'Emoji Channels',
    repeated_messages: 'Spam',
    repeated_mentions: 'Mention spam',
    lines: 'Lines',
    links: 'Links',
    banwords: 'Banwords',
    advertising: 'Advertising',
    emoji_spam: 'Emoji spam',
    command_channels: 'Command channels',
    image_filter: 'Image filtering',
};

export const BUILTIN_RULE_LABELS_RU: Record<string, string> = {
    flood: '\u0424\u043b\u0443\u0434',
    repeated_messages: '\u0421\u043f\u0430\u043c',
    banwords: '\u0417\u0430\u043f\u0440\u0435\u0449\u0451\u043d\u043d\u044b\u0435 \u0441\u043b\u043e\u0432\u0430',
    zalgo: '\u0417\u0430\u043b\u044c\u0433\u043e',
    links: '\u0421\u0441\u044b\u043b\u043a\u0438',
    advertising: '\u0420\u0435\u043a\u043b\u0430\u043c\u0430',
    emoji_spam: '\u0421\u043f\u0430\u043c \u044d\u043c\u043e\u0434\u0437\u0438',
    repeated_mentions: '\u0421\u043f\u0430\u043c \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439',
    emoji: '\u041a\u0430\u043d\u0430\u043b\u044b \u044d\u043c\u043e\u0434\u0437\u0438',
    command_channels: '\u041a\u0430\u043d\u0430\u043b\u044b \u0434\u043b\u044f \u043a\u043e\u043c\u0430\u043d\u0434',
    lines: '\u0421\u0442\u0440\u043e\u043a\u0438',
    image_filter: '\u0424\u0438\u043b\u044c\u0442\u0440\u0430\u0446\u0438\u044f \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0439',
};

export const BUILTIN_RULE_DESCRIPTIONS: Record<string, string> = {
    flood: 'Tracks how frequently a user sends messages within a configured time window.',
    zalgo: 'Flags messages with excessive combining marks and visual distortion.',
    emoji: 'Configures emoji-only channels, no-emoji channels, and the response steps.',
    repeated_messages: 'Responds when a user repeats identical messages within a time window.',
    repeated_mentions: 'Responds to repeated user or role mentions within the configured time window.',
    lines: 'Detects messages with too many line breaks.',
    links: 'Blocks links and invites in messages.',
    banwords: 'Detects forbidden words or phrases in messages and applies the configured punishment.',
    advertising: 'Detects promotional, referral, and scam-like advertising text.',
    emoji_spam: 'Triggers when a message contains too many emoji.',
    command_channels: 'Keeps designated command channels clean from regular chat.',
    image_filter: 'Manages channels where images are forbidden and channels where only images are allowed.',
};

export const BUILTIN_RULE_DESCRIPTIONS_RU: Record<string, string> = {
    flood: '\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442 \u0447\u0430\u0441\u0442\u043e\u0442\u0443 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0437\u0430 \u0443\u043a\u0430\u0437\u0430\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434 \u0432\u0440\u0435\u043c\u0435\u043d\u0438.',
    zalgo: '\u041b\u043e\u0432\u0438\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0441 \u0447\u0440\u0435\u0437\u043c\u0435\u0440\u043d\u044b\u043c \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e\u043c \u0434\u0438\u0430\u043a\u0440\u0438\u0442\u0438\u043a\u0438 \u0438 \u0432\u0438\u0437\u0443\u0430\u043b\u044c\u043d\u044b\u043c \u0448\u0443\u043c\u043e\u043c.',
    emoji: '\u041d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442 \u043a\u0430\u043d\u0430\u043b\u044b \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u044d\u043c\u043e\u0434\u0437\u0438, \u043a\u0430\u043d\u0430\u043b\u044b \u0431\u0435\u0437 \u044d\u043c\u043e\u0434\u0437\u0438 \u0438 \u0441\u0442\u0443\u043f\u0435\u043d\u0438 \u0440\u0435\u0430\u043a\u0446\u0438\u0438.',
    repeated_messages: '\u0420\u0435\u0430\u0433\u0438\u0440\u0443\u0435\u0442 \u043d\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u0435 \u043e\u0434\u0438\u043d\u0430\u043a\u043e\u0432\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u043c \u0437\u0430 \u043f\u0435\u0440\u0438\u043e\u0434 \u0432\u0440\u0435\u043c\u0435\u043d\u0438.',
    repeated_mentions: '\u0420\u0435\u0430\u0433\u0438\u0440\u0443\u0435\u0442 \u043d\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u044e\u0449\u0438\u0435\u0441\u044f \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439 \u0438\u043b\u0438 \u0440\u043e\u043b\u0435\u0439 \u0437\u0430 \u0443\u043a\u0430\u0437\u0430\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434 \u0432\u0440\u0435\u043c\u0435\u043d\u0438.',
    lines: '\u0421\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u0435\u0442 \u043d\u0430 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0431\u043e\u043b\u044c\u0448\u043e\u0435 \u0447\u0438\u0441\u043b\u043e \u043f\u0435\u0440\u0435\u043d\u043e\u0441\u043e\u0432 \u0441\u0442\u0440\u043e\u043a\u0438.',
    links: '\u0411\u043b\u043e\u043a\u0438\u0440\u0443\u0435\u0442 \u0441\u0441\u044b\u043b\u043a\u0438 \u0438 \u0438\u043d\u0432\u0430\u0439\u0442\u044b \u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u0445.',
    banwords: '\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442 \u0437\u0430\u043f\u0440\u0435\u0449\u0451\u043d\u043d\u044b\u0435 \u0441\u043b\u043e\u0432\u0430 \u0438 \u0444\u0440\u0430\u0437\u044b \u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u0445 \u0438 \u0432\u044b\u0434\u0430\u0451\u0442 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u0435 \u043f\u043e \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0435.',
    advertising: '\u041b\u043e\u0432\u0438\u0442 \u0440\u0435\u043a\u043b\u0430\u043c\u043d\u044b\u0435, \u0440\u0435\u0444\u0435\u0440\u0430\u043b\u044c\u043d\u044b\u0435 \u0438 scam-\u043f\u043e\u0434\u043e\u0431\u043d\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f.',
    emoji_spam: '\u0421\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u0435\u0442, \u043a\u043e\u0433\u0434\u0430 \u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0438 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u044d\u043c\u043e\u0434\u0437\u0438.',
    command_channels: '\u0414\u0435\u0440\u0436\u0438\u0442 \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0435 \u043a\u0430\u043d\u0430\u043b\u044b \u043a\u043e\u043c\u0430\u043d\u0434 \u0447\u0438\u0441\u0442\u044b\u043c\u0438 \u043e\u0442 \u043e\u0431\u044b\u0447\u043d\u043e\u0433\u043e \u0447\u0430\u0442\u0430.',
    image_filter: '\u041d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442 \u043a\u0430\u043d\u0430\u043b\u044b, \u0433\u0434\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u044b, \u0438 \u043a\u0430\u043d\u0430\u043b\u044b, \u0433\u0434\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b \u0442\u043e\u043b\u044c\u043a\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f.',
};

export const AUTOMOD_ACTION_OPTIONS = ['DELETE', 'WARN', 'MUTE', 'TIMEOUT', 'KICK', 'BAN'] as const;

export const AUTOMOD_ACTION_LABELS: Record<(typeof AUTOMOD_ACTION_OPTIONS)[number], string> = {
    DELETE: 'Delete',
    WARN: 'Warn',
    MUTE: 'Mute',
    TIMEOUT: 'Timeout',
    KICK: 'Kick',
    BAN: 'Ban',
};

export const AUTOMOD_ACTION_LABELS_RU: Record<(typeof AUTOMOD_ACTION_OPTIONS)[number], string> = {
    DELETE: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
    WARN: '\u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u0435',
    MUTE: '\u041c\u0443\u0442',
    TIMEOUT: '\u0422\u0430\u0439\u043c-\u0430\u0443\u0442',
    KICK: '\u041a\u0438\u043a',
    BAN: '\u0411\u0430\u043d',
};

export const FLOOD_WINDOW_UNITS = ['seconds', 'minutes', 'hours', 'days'] as const;

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
    toxicity: '\u0422\u043e\u043a\u0441\u0438\u0447\u043d\u043e\u0441\u0442\u044c',
    harassment: '\u0422\u0440\u0430\u0432\u043b\u044f',
    hate_discrimination: '\u041d\u0435\u043d\u0430\u0432\u0438\u0441\u0442\u044c / \u0434\u0438\u0441\u043a\u0440\u0438\u043c\u0438\u043d\u0430\u0446\u0438\u044f',
    threats_violence: '\u0423\u0433\u0440\u043e\u0437\u044b / \u043d\u0430\u0441\u0438\u043b\u0438\u0435',
    sexual_explicit: '\u041e\u0442\u043a\u0440\u043e\u0432\u0435\u043d\u043d\u044b\u0439 \u0441\u0435\u043a\u0441\u0443\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u043e\u043d\u0442\u0435\u043d\u0442',
    scam_fraud: '\u0421\u043a\u0430\u043c / \u043c\u043e\u0448\u0435\u043d\u043d\u0438\u0447\u0435\u0441\u0442\u0432\u043e',
    self_harm_crisis: '\u0421\u0430\u043c\u043e\u043f\u043e\u0432\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u0435 / \u043a\u0440\u0438\u0437\u0438\u0441',
    doxxing_personal_data: '\u041b\u0438\u0447\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435',
};

export const ACCESS_PRESETS = ['Helper', 'Moderator', 'Control', 'Admin'];
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

export const BUILTIN_RULE_ORDER = [
    'flood',
    'repeated_messages',
    'banwords',
    'zalgo',
    'links',
    'advertising',
    'emoji_spam',
    'repeated_mentions',
    'emoji',
    'command_channels',
    'lines',
    'image_filter',
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
    AI_DISMISSED_INCIDENTS: '??????????? / false-positive AI-?????????',
    AI_CONFIRMED_INCIDENTS: 'Payload ?????????????? AI-??????????',
    AUTOMOD_CASE_METADATA: '?????????? automod-??????',
    APPEAL_MESSAGES: '????????? ?????????',
    APPEAL_RESOLUTION_NOTES: '??????? ?? ???????? ?????????',
    CLEARED_CASE_METADATA: '?????????? ?????? / ???????? ??????',
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
        threadChannelId: '',
        logChannelId: '',
        triageRoleIds: [],
        reviewerRoleIds: [],
        mentionRoleIds: [],
        allowedActionTypes: ['WARN', 'TIMEOUT', 'MUTE', 'BAN', 'TEMPBAN'],
        appealWindowDays: 14,
        oneOpenAppealPerCase: true,
        firstResponseSlaHours: 24,
        autoCloseHours: 72,
        dedicatedPanel: {
            enabled: false,
            channelId: '',
            title: 'ÐžÐ±Ð¶Ð°Ð»Ð¾Ð²Ð°Ð½Ð¸Ðµ Ð½Ð°ÐºÐ°Ð·Ð°Ð½Ð¸Ñ',
            description: 'Ð¡Ð¾Ð·Ð´Ð°Ð¹Ñ‚Ðµ Ð¾Ð±Ñ€Ð°Ñ‰ÐµÐ½Ð¸Ðµ, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð¾ÑÐ¿Ð¾Ñ€Ð¸Ñ‚ÑŒ Ñ€ÐµÑˆÐµÐ½Ð¸Ðµ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ†Ð¸Ð¸ Ð¸ Ð¾Ñ‚ÑÐ»ÐµÐ´Ð¸Ñ‚ÑŒ Ð²ÐµÑÑŒ Ð¿Ñ€Ð¾Ñ†ÐµÑÑ Ð²Ð½ÑƒÑ‚Ñ€Ð¸ Discord.',
            buttonLabel: 'ÐŸÐ¾Ð´Ð°Ñ‚ÑŒ Ð°Ð¿ÐµÐ»Ð»ÑÑ†Ð¸ÑŽ',
            buttonEmoji: 'âš–ï¸',
        },
        sharedPlacement:
        {
            enabled: false,
            channelId: '',
            label: 'ÐÐ¿ÐµÐ»Ð»ÑÑ†Ð¸Ñ Ð½Ð°ÐºÐ°Ð·Ð°Ð½Ð¸Ñ',
            description: 'ÐžÑÐ¿Ð¾Ñ€Ð¸Ñ‚ÑŒ Ð²Ñ‹Ð´Ð°Ð½Ð½Ð¾Ðµ Ð½Ð°ÐºÐ°Ð·Ð°Ð½Ð¸Ðµ Ð¸ Ð¿Ñ€ÐµÐ´Ð¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ ÑÐ²Ð¾Ð¸ Ð°Ñ€Ð³ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹.',
            emoji: 'âš–ï¸',
            sortOrder: 90,
        },
        firstEmbed: {
            title: 'ÐÐ¿ÐµÐ»Ð»ÑÑ†Ð¸Ñ #{appealId} â€¢ ÐšÐµÐ¹Ñ #{caseNumber}',
            intro: 'Ð—Ð°Ð¿Ñ€Ð¾Ñ Ð¿Ñ€Ð¸Ð½ÑÑ‚. Ð¡Ð»ÐµÐ´Ð¸Ñ‚Ðµ Ð·Ð° Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸ÐµÐ¼ ÑÑ‚Ð°Ñ‚ÑƒÑÐ° Ð² ÑÑ‚Ð¾Ð¼ Ñ‚Ñ€ÐµÐ´Ðµ Ð¸ Ð¿Ñ€Ð¸ Ð½ÐµÐ¾Ð±Ñ…Ð¾Ð´Ð¸Ð¼Ð¾ÑÑ‚Ð¸ Ð´Ð¾Ð¿Ð¾Ð»Ð½ÑÐ¹Ñ‚Ðµ Ð¸Ð½Ñ„Ð¾Ñ€Ð¼Ð°Ñ†Ð¸ÑŽ.',
            footer: 'ÐœÑ‹ Ð¾Ð±Ð½Ð¾Ð²Ð¸Ð¼ ÑÑ‚Ð°Ñ‚ÑƒÑ Ð·Ð´ÐµÑÑŒ, ÐºÐ°Ðº Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð°Ð¿ÐµÐ»Ð»ÑÑ†Ð¸Ñ Ð¿ÐµÑ€ÐµÐ¹Ð´Ñ‘Ñ‚ Ðº ÑÐ»ÐµÐ´ÑƒÑŽÑ‰ÐµÐ¼Ñƒ ÑÑ‚Ð°Ð¿Ñƒ.',
        },
        intakeQuestions: [
            {
                id: 'disagreement',
                label: 'Ð¡ Ñ‡ÐµÐ¼ Ð¸Ð¼ÐµÐ½Ð½Ð¾ Ð²Ñ‹ Ð½Ðµ ÑÐ¾Ð³Ð»Ð°ÑÐ½Ñ‹?',
                placeholder: 'ÐšÑ€Ð°Ñ‚ÐºÐ¾ Ð¾Ð¿Ð¸ÑˆÐ¸Ñ‚Ðµ, ÐºÐ°ÐºÐ¾Ðµ Ñ€ÐµÑˆÐµÐ½Ð¸Ðµ Ð²Ñ‹ Ð¾ÑÐ¿Ð°Ñ€Ð¸Ð²Ð°ÐµÑ‚Ðµ.',
                required: true,
                long: false,
            },
            {
                id: 'reasoning',
                label: 'ÐŸÐ¾Ñ‡ÐµÐ¼Ñƒ Ñ€ÐµÑˆÐµÐ½Ð¸Ðµ Ð½ÑƒÐ¶Ð½Ð¾ Ð¿ÐµÑ€ÐµÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ?',
                placeholder: 'ÐžÐ¿Ð¸ÑˆÐ¸Ñ‚Ðµ ÑÐ²Ð¾ÑŽ Ð¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽ Ð¸ Ð¾Ð±ÑÑ‚Ð¾ÑÑ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð° Ð¿Ð¾Ð´Ñ€Ð¾Ð±Ð½ÐµÐµ.',
                required: true,
                long: true,
            },
            {
                id: 'outcome',
                label: 'ÐšÐ°ÐºÐ¾Ð³Ð¾ Ñ€ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚Ð° Ð²Ñ‹ Ð¾Ð¶Ð¸Ð´Ð°ÐµÑ‚Ðµ?',
                placeholder: 'ÐÐ°Ð¿Ñ€Ð¸Ð¼ÐµÑ€: ÑÐ½ÑÑ‚ÑŒ Ð½Ð°ÐºÐ°Ð·Ð°Ð½Ð¸Ðµ, ÑÐ¾ÐºÑ€Ð°Ñ‚Ð¸Ñ‚ÑŒ ÑÑ€Ð¾Ðº, Ð¿ÐµÑ€ÐµÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ Ð¿Ñ€Ð¸Ñ‡Ð¸Ð½Ñƒ.',
                required: true,
                long: false,
            },
            {
                id: 'evidence',
                label: 'Ð”Ð¾ÐºÐ°Ð·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð° Ð¸Ð»Ð¸ Ð´Ð¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ñ‹Ðµ ÑÑÑ‹Ð»ÐºÐ¸',
                placeholder: 'ÐŸÑ€Ð¸Ð»Ð¾Ð¶Ð¸Ñ‚Ðµ ÑÑÑ‹Ð»ÐºÐ¸, ÐºÐ¾Ð½Ñ‚ÐµÐºÑÑ‚ Ð¸Ð»Ð¸ ÑƒÑ‚Ð¾Ñ‡Ð½ÐµÐ½Ð¸Ñ, ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ðµ Ð¿Ð¾Ð¼Ð¾Ð³ÑƒÑ‚ Ð² Ñ€Ð°ÑÑÐ¼Ð¾Ñ‚Ñ€ÐµÐ½Ð¸Ð¸.',
                required: false,
                long: true,
            },
        ],
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

