import { prisma } from '../utils/database';

export type AppealIntakeQuestion = {
    id: string;
    label: string;
    placeholder: string;
    required: boolean;
    long: boolean;
};

export type AppealSettings = {
    threadChannelId: string;
    logChannelId: string;
    triageRoleIds: string[];
    reviewerRoleIds: string[];
    mentionRoleIds: string[];
    allowedActionTypes: string[];
    appealWindowDays: number;
    oneOpenAppealPerCase: boolean;
    firstResponseSlaHours: number;
    autoCloseHours: number;
    dedicatedPanel: {
        enabled: boolean;
        channelId: string;
        title: string;
        description: string;
        buttonLabel: string;
        buttonEmoji: string;
    };
    sharedPlacement: {
        enabled: boolean;
        channelId: string;
        label: string;
        description: string;
        emoji: string;
        sortOrder: number;
    };
    firstEmbed: {
        title: string;
        intro: string;
        footer: string;
    };
    intakeQuestions: AppealIntakeQuestion[];
};

export const DEFAULT_APPEAL_SETTINGS: AppealSettings = {
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
        title: '\u041e\u0431\u0436\u0430\u043b\u043e\u0432\u0430\u043d\u0438\u0435 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u044f',
        description: '\u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435, \u0447\u0442\u043e\u0431\u044b \u043e\u0441\u043f\u043e\u0440\u0438\u0442\u044c \u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438 \u0438 \u043e\u0442\u0441\u043b\u0435\u0434\u0438\u0442\u044c \u043f\u0440\u043e\u0446\u0435\u0441\u0441 \u0432\u043d\u0443\u0442\u0440\u0438 Discord.',
        buttonLabel: '\u041f\u043e\u0434\u0430\u0442\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e',
        buttonEmoji: '\u2696\uFE0F',
    },
    sharedPlacement: {
        enabled: false,
        channelId: '',
        label: '\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u044f',
        description: '\u041e\u0441\u043f\u043e\u0440\u0438\u0442\u044c \u0432\u044b\u0434\u0430\u043d\u043d\u043e\u0435 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u0435 \u0438 \u043f\u0440\u0435\u0434\u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0441\u0432\u043e\u0438 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442\u044b.',
        emoji: '\u2696\uFE0F',
        sortOrder: 90,
    },
    firstEmbed: {
        title: '\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f #{appealId} \u2022 \u041a\u0435\u0439\u0441 #{caseNumber}',
        intro: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043f\u0440\u0438\u043d\u044f\u0442. \u0421\u043b\u0435\u0434\u0438\u0442\u0435 \u0437\u0430 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435\u043c \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u0432 \u044d\u0442\u043e\u043c \u0442\u0440\u0435\u0434\u0435 \u0438 \u043f\u0440\u0438 \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e\u0441\u0442\u0438 \u0434\u043e\u043f\u043e\u043b\u043d\u044f\u0439\u0442\u0435 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044e.',
        footer: '\u041c\u044b \u043e\u0431\u043d\u043e\u0432\u0438\u043c \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0434\u0435\u0441\u044c, \u043a\u0430\u043a \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f \u043f\u0435\u0440\u0435\u0439\u0434\u0451\u0442 \u043a \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u043c\u0443 \u044d\u0442\u0430\u043f\u0443.',
    },
    intakeQuestions: [
        {
            id: 'disagreement',
            label: '\u0421 \u0447\u0435\u043c \u0438\u043c\u0435\u043d\u043d\u043e \u0432\u044b \u043d\u0435 \u0441\u043e\u0433\u043b\u0430\u0441\u043d\u044b?',
            placeholder: '\u041a\u0440\u0430\u0442\u043a\u043e \u043e\u043f\u0438\u0448\u0438\u0442\u0435, \u043a\u0430\u043a\u043e\u0435 \u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u0432\u044b \u043e\u0441\u043f\u0430\u0440\u0438\u0432\u0430\u0435\u0442\u0435.',
            required: true,
            long: false,
        },
        {
            id: 'reasoning',
            label: '\u041f\u043e\u0447\u0435\u043c\u0443 \u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u043d\u0443\u0436\u043d\u043e \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c?',
            placeholder: '\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u0432\u043e\u044e \u043f\u043e\u0437\u0438\u0446\u0438\u044e \u0438 \u043e\u0431\u0441\u0442\u043e\u044f\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0430 \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u0435\u0435.',
            required: true,
            long: true,
        },
        {
            id: 'outcome',
            label: '\u041a\u0430\u043a\u043e\u0433\u043e \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0430 \u0432\u044b \u043e\u0436\u0438\u0434\u0430\u0435\u0442\u0435?',
            placeholder: '\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u0441\u043d\u044f\u0442\u044c \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u0435, \u0441\u043e\u043a\u0440\u0430\u0442\u0438\u0442\u044c \u0441\u0440\u043e\u043a, \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u043f\u0440\u0438\u0447\u0438\u043d\u0443.',
            required: true,
            long: false,
        },
        {
            id: 'evidence',
            label: '\u0414\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0430 \u0438\u043b\u0438 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0441\u0441\u044b\u043b\u043a\u0438',
            placeholder: '\u041f\u0440\u0438\u043b\u043e\u0436\u0438\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0438, \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442 \u0438\u043b\u0438 \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u044f, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043f\u043e\u043c\u043e\u0433\u0443\u0442 \u0432 \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u0438\u0438.',
            required: false,
            long: true,
        },
    ],
};

type AppealConfigRow = {
    settingsJson?: string | null;
    panelChannelId?: string | null;
    panelMessageId?: string | null;
    sharedPanelChannelId?: string | null;
    sharedPanelMessageId?: string | null;
};

export type AppealPanelMeta = {
    panelChannelId: string | null;
    panelMessageId: string | null;
};

export type AppealSharedPanelMeta = {
    sharedPanelChannelId: string | null;
    sharedPanelMessageId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
        : [];
}

function asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function asInteger(value: unknown, fallback: number, min: number, max: number): number {
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeQuestion(value: unknown, fallbackIndex: number): AppealIntakeQuestion {
    const record = asRecord(value);
    return {
        id: asString(record.id, `question_${fallbackIndex + 1}`),
        label: asString(record.label, `\u0412\u043e\u043f\u0440\u043e\u0441 ${fallbackIndex + 1}`),
        placeholder: asString(record.placeholder),
        required: asBoolean(record.required, true),
        long: asBoolean(record.long, false),
    };
}

export function normalizeAppealSettings(value: unknown): AppealSettings {
    const raw = asRecord(value);
    const dedicatedPanel = asRecord(raw.dedicatedPanel);
    const sharedPlacement = asRecord(raw.sharedPlacement);
    const firstEmbed = asRecord(raw.firstEmbed);
    const intakeQuestions = Array.isArray(raw.intakeQuestions)
        ? raw.intakeQuestions.map((question, index) => normalizeQuestion(question, index))
        : DEFAULT_APPEAL_SETTINGS.intakeQuestions;

    return {
        threadChannelId: asString(raw.threadChannelId),
        logChannelId: asString(raw.logChannelId),
        triageRoleIds: asStringArray(raw.triageRoleIds),
        reviewerRoleIds: asStringArray(raw.reviewerRoleIds),
        mentionRoleIds: asStringArray(raw.mentionRoleIds),
        allowedActionTypes: asStringArray(raw.allowedActionTypes).length
            ? asStringArray(raw.allowedActionTypes)
            : DEFAULT_APPEAL_SETTINGS.allowedActionTypes,
        appealWindowDays: asInteger(raw.appealWindowDays, DEFAULT_APPEAL_SETTINGS.appealWindowDays, 1, 365),
        oneOpenAppealPerCase: asBoolean(raw.oneOpenAppealPerCase, DEFAULT_APPEAL_SETTINGS.oneOpenAppealPerCase),
        firstResponseSlaHours: asInteger(raw.firstResponseSlaHours, DEFAULT_APPEAL_SETTINGS.firstResponseSlaHours, 1, 168),
        autoCloseHours: asInteger(raw.autoCloseHours, DEFAULT_APPEAL_SETTINGS.autoCloseHours, 1, 720),
        dedicatedPanel: {
            enabled: asBoolean(dedicatedPanel.enabled, DEFAULT_APPEAL_SETTINGS.dedicatedPanel.enabled),
            channelId: asString(dedicatedPanel.channelId),
            title: asString(dedicatedPanel.title, DEFAULT_APPEAL_SETTINGS.dedicatedPanel.title),
            description: asString(dedicatedPanel.description, DEFAULT_APPEAL_SETTINGS.dedicatedPanel.description),
            buttonLabel: asString(dedicatedPanel.buttonLabel, DEFAULT_APPEAL_SETTINGS.dedicatedPanel.buttonLabel),
            buttonEmoji: asString(dedicatedPanel.buttonEmoji, DEFAULT_APPEAL_SETTINGS.dedicatedPanel.buttonEmoji),
        },
        sharedPlacement: {
            enabled: asBoolean(sharedPlacement.enabled, DEFAULT_APPEAL_SETTINGS.sharedPlacement.enabled),
            channelId: asString(sharedPlacement.channelId),
            label: asString(sharedPlacement.label, DEFAULT_APPEAL_SETTINGS.sharedPlacement.label),
            description: asString(sharedPlacement.description, DEFAULT_APPEAL_SETTINGS.sharedPlacement.description),
            emoji: asString(sharedPlacement.emoji, DEFAULT_APPEAL_SETTINGS.sharedPlacement.emoji),
            sortOrder: asInteger(sharedPlacement.sortOrder, DEFAULT_APPEAL_SETTINGS.sharedPlacement.sortOrder, 0, 999),
        },
        firstEmbed: {
            title: asString(firstEmbed.title, DEFAULT_APPEAL_SETTINGS.firstEmbed.title),
            intro: asString(firstEmbed.intro, DEFAULT_APPEAL_SETTINGS.firstEmbed.intro),
            footer: asString(firstEmbed.footer, DEFAULT_APPEAL_SETTINGS.firstEmbed.footer),
        },
        intakeQuestions,
    };
}

export async function getAppealRuntimeSettings(guildId: string): Promise<AppealSettings> {
    const config = await prisma.appealConfig.findUnique({
        where: { guildId },
        select: { settingsJson: true },
    });

    const settingsJson = config?.settingsJson;
    if (!settingsJson) {
        return DEFAULT_APPEAL_SETTINGS;
    }

    try {
        return normalizeAppealSettings(JSON.parse(settingsJson));
    } catch {
        return DEFAULT_APPEAL_SETTINGS;
    }
}

export async function readAppealPanelMeta(guildId: string): Promise<AppealPanelMeta> {
    const config = await prisma.appealConfig.findUnique({
        where: { guildId },
        select: { panelChannelId: true, panelMessageId: true },
    });

    return {
        panelChannelId: config?.panelChannelId ?? null,
        panelMessageId: config?.panelMessageId ?? null,
    };
}

export async function writeAppealPanelMeta(guildId: string, meta: AppealPanelMeta) {
    await prisma.appealConfig.update({
        where: { guildId },
        data: {
            panelChannelId: meta.panelChannelId,
            panelMessageId: meta.panelMessageId,
        },
    });
}

export async function readAppealSharedPanelMeta(guildId: string): Promise<AppealSharedPanelMeta> {
    const config = await prisma.appealConfig.findUnique({
        where: { guildId },
        select: { sharedPanelChannelId: true, sharedPanelMessageId: true },
    });

    return {
        sharedPanelChannelId: config?.sharedPanelChannelId ?? null,
        sharedPanelMessageId: config?.sharedPanelMessageId ?? null,
    };
}

export async function writeAppealSharedPanelMeta(guildId: string, meta: AppealSharedPanelMeta) {
    await prisma.appealConfig.update({
        where: { guildId },
        data: {
            sharedPanelChannelId: meta.sharedPanelChannelId,
            sharedPanelMessageId: meta.sharedPanelMessageId,
        },
    });
}
