'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowClockwise,
    ClockCounterClockwise,
    FloppyDisk,
    ShieldCheck,
    SlidersHorizontal,
    WarningCircle,
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';

type RoleOption = { id: string; name: string };
type ChannelOption = { id: string; name: string };

type RoleBinding = {
    roleId: string;
    title: string;
    accessLevel: number;
    enabled: boolean;
    sortOrder: number;
};

type CommandGrant = {
    roleId: string;
    scopeType: 'COMMAND' | 'GROUP';
    scopeKey: string;
    effect: 'ALLOW' | 'DENY';
};

type AutomodRule = {
    ruleKey: string;
    enabled: boolean;
    configText: string;
};

type CustomRule = {
    name: string;
    ruleType: string;
    pattern: string;
    enabled: boolean;
    action: string;
    strikeWeight: number;
    notes: string;
};

type SanctionStep = {
    triggerStrikeCount: number;
    actionType: string;
    durationMinutes: number | null;
    enabled: boolean;
    sortOrder: number;
};

type AiConfig = {
    enabled: boolean;
    provider: string;
    model: string;
    defaultThreshold: number;
    scanEdits: boolean;
    includedChannels: string[];
    excludedChannels: string[];
    exemptRoles: string[];
    exemptUsers: string[];
    customPolicyPrompt: string;
};

type AiCategoryRule = {
    category: string;
    enabled: boolean;
    threshold: number;
    sortOrder: number;
};

type ModerationConfig = {
    muteRoleId: string;
    ignoredChannels: string[];
    ignoredRoles: string[];
    ignoredUsers: string[];
    commandOnlyChannels: string[];
};

type AppealConfig = {
    enabled: boolean;
    appealChannelId: string;
    pardonLogChannelId: string;
    allowUserAppeals: boolean;
    allowDirectPardon: boolean;
};

type RetentionPolicy = {
    category: string;
    strategy: string;
    ttlDays: number | null;
    enabled: boolean;
};

type ConfigState = {
    roles: RoleOption[];
    channels: ChannelOption[];
    moderationConfig: ModerationConfig;
    roleBindings: RoleBinding[];
    commandGrants: CommandGrant[];
    automodRules: AutomodRule[];
    customRules: CustomRule[];
    sanctionSteps: SanctionStep[];
    aiConfig: AiConfig;
    aiCategories: AiCategoryRule[];
    appealConfig: AppealConfig;
    retentionPolicies: RetentionPolicy[];
};

type CaseNote = {
    id: number;
    actorUserId: string;
    note: string;
    createdAt: string;
};

type ModerationCase = {
    id: number;
    caseNumber: number;
    actionType: string;
    status: string;
    source: string;
    actorUserId: string | null;
    targetUserId: string;
    reason: string | null;
    createdAt: string;
    expiresAt?: string | null;
    relatedCaseId?: number | null;
    relatedCase?: {
        id: number;
        caseNumber: number;
        actionType: string;
        status: string;
    } | null;
    linkedCases?: Array<{
        id: number;
        caseNumber: number;
        actionType: string;
        status: string;
        source: string;
        targetUserId: string;
        actorUserId: string | null;
        createdAt: string;
        relatedCaseId?: number | null;
    }>;
    metadata?: Record<string, unknown> | null;
    notes?: CaseNote[];
};

type CasesState = {
    summary: {
        total: number;
        active: number;
        warnings: number;
        timed: number;
    };
    cases: ModerationCase[];
};

type AiIncidentCategory = {
    category: string;
    score: number;
};

type AiIncident = {
    id: number;
    messageId: string;
    channelId: string;
    authorId: string;
    excerpt: string | null;
    summary: string | null;
    categories: AiIncidentCategory[];
    provider: string | null;
    model: string | null;
    confidence: number | null;
    status: string;
    reviewerId?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
};

type AiIncidentState = {
    summary: {
        total: number;
        open: number;
        falsePositive: number;
        confirmed: number;
    };
    incidents: AiIncident[];
};

type AppealTicket = {
    id: number;
    caseId: number;
    caseNumber: number;
    userId: string;
    appealType: string;
    status: string;
    message: string;
    resolutionNote?: string | null;
    reviewerId?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
    moderationCase: {
        id: number;
        caseNumber: number;
        actionType: string;
        status: string;
        targetUserId: string;
    };
};

type AppealTicketState = {
    summary: {
        total: number;
        open: number;
        inReview: number;
        accepted: number;
        rejected: number;
    };
    tickets: AppealTicket[];
};

type AppealReviewDecision = 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'PARDONED';

type ModeratorAnalyticsRow = {
    moderatorId: string;
    totalActions: number;
    warns: number;
    timeouts: number;
    bans: number;
    mutes: number;
    kicks: number;
    reversals: number;
    aiReviews: number;
    falsePositives: number;
    falsePositiveRate: number;
    appealsReviewed: number;
    acceptedAppeals: number;
    rejectedAppeals: number;
    avgAiReviewMinutes: number | null;
    avgAppealReviewHours: number | null;
};

type AnalyticsState = {
    windowDays: number;
    summary: {
        totalModeratorActions: number;
        totalAiReviews: number;
        totalAppealReviews: number;
        uniqueModerators: number;
    };
    moderators: ModeratorAnalyticsRow[];
};

const BUILTIN_RULE_LABELS: Record<string, string> = {
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
const BUILTIN_RULE_LABELS_RU: Record<string, string> = {
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

const CATEGORY_LABELS: Record<string, string> = {
    toxicity: 'Toxicity',
    harassment: 'Harassment',
    hate_discrimination: 'Hate / discrimination',
    threats_violence: 'Threats / violence',
    sexual_explicit: 'Sexual explicit',
    scam_fraud: 'Scam / fraud',
    self_harm_crisis: 'Self-harm / crisis',
    doxxing_personal_data: 'Personal data',
};
const CATEGORY_LABELS_RU: Record<string, string> = {
    toxicity: 'Токсичность',
    harassment: 'Травля',
    hate_discrimination: 'Ненависть / дискриминация',
    threats_violence: 'Угрозы / насилие',
    sexual_explicit: 'Откровенный сексуальный контент',
    scam_fraud: 'Скам / мошенничество',
    self_harm_crisis: 'Самоповреждение / кризис',
    doxxing_personal_data: 'Личные данные',
};

const ACCESS_PRESETS = ['Helper', 'Moderator', 'Control', 'Administrator'];
const SANCTION_ACTIONS = ['WARN', 'TIMEOUT', 'MUTE', 'KICK', 'BAN'];
const CUSTOM_RULE_TYPES = ['regex', 'keyword-list'];
const CUSTOM_RULE_ACTIONS = ['DELETE', 'WARN', 'TIMEOUT', 'MUTE', 'KICK'];
const APPEAL_REVIEW_OPTIONS: AppealReviewDecision[] = ['IN_REVIEW', 'ACCEPTED', 'REJECTED', 'PARDONED'];
const PARDONABLE_ACTIONS = new Set(['WARN', 'TIMEOUT', 'MUTE', 'BAN', 'TEMPBAN']);
const AI_PROVIDER_OPTIONS = [
    { id: '', name: 'Disabled / not selected' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'gemini', name: 'Gemini' },
];
const RETENTION_STRATEGIES = ['KEEP', 'TRIM', 'DELETE'];
const RETENTION_LABELS: Record<string, string> = {
    AI_DISMISSED_INCIDENTS: 'Dismissed / false-positive AI incidents',
    AI_CONFIRMED_INCIDENTS: 'Confirmed AI incidents payload',
    AUTOMOD_CASE_METADATA: 'AutoMod case metadata',
    APPEAL_MESSAGES: 'Appeal user messages',
    APPEAL_RESOLUTION_NOTES: 'Appeal resolution notes',
    CLEARED_CASE_METADATA: 'Cleared / expired case metadata',
};
const RETENTION_LABELS_RU: Record<string, string> = {
    AI_DISMISSED_INCIDENTS: 'Отклоненные / false-positive AI-инциденты',
    AI_CONFIRMED_INCIDENTS: 'Payload подтвержденных AI-инцидентов',
    AUTOMOD_CASE_METADATA: 'Метаданные automod-кейсов',
    APPEAL_MESSAGES: 'Сообщения апелляций',
    APPEAL_RESOLUTION_NOTES: 'Заметки по решениям апелляций',
    CLEARED_CASE_METADATA: 'Метаданные снятых / истекших кейсов',
};
const CUSTOM_RULE_TEMPLATES: CustomRule[] = [
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

const emptyConfig = (): ConfigState => ({
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

const emptyCases = (): CasesState => ({
    summary: { total: 0, active: 0, warnings: 0, timed: 0 },
    cases: [],
});

const emptyIncidents = (): AiIncidentState => ({
    summary: { total: 0, open: 0, falsePositive: 0, confirmed: 0 },
    incidents: [],
});

const emptyAppeals = (): AppealTicketState => ({
    summary: { total: 0, open: 0, inReview: 0, accepted: 0, rejected: 0 },
    tickets: [],
});

const emptyAnalytics = (): AnalyticsState => ({
    windowDays: 30,
    summary: {
        totalModeratorActions: 0,
        totalAiReviews: 0,
        totalAppealReviews: 0,
        uniqueModerators: 0,
    },
    moderators: [],
});

const strings = {
    en: {
        title: 'Moderation',
        subtitle: 'Configure access, automod, AI review and case history.',
        loading: 'Loading moderation settings...',
        failed: 'Failed to load moderation settings.',
        saved: 'Moderation settings saved.',
        saveFailed: 'Failed to save moderation settings.',
        reload: 'Reload',
        save: 'Save',
        tabs: {
            overview: 'Overview',
            access: 'Access',
            automod: 'AutoMod',
            ai: 'AI',
            appeals: 'Appeals',
            retention: 'Retention',
            analytics: 'Analytics',
        },
    },
    ru: {
        title: 'Модерация',
        subtitle: 'Настройка доступа, автомодерации, ИИ-проверки и истории кейсов.',
        loading: 'Загрузка настроек модерации...',
        failed: 'Не удалось загрузить настройки модерации.',
        saved: 'Настройки модерации сохранены.',
        saveFailed: 'Не удалось сохранить настройки модерации.',
        reload: 'Обновить',
        save: 'Сохранить',
        tabs: {
            overview: 'Обзор',
            access: 'Доступ',
            automod: 'Автомод',
            ai: 'AI',
            appeals: 'Апелляции',
            retention: 'Хранение',
            analytics: 'Аналитика',
        },
    },
} as const;

function formatDate(value?: string | null, emptyLabel = 'No expiry') {
    if (!value) return emptyLabel;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function joinIds(ids: string[]) {
    return ids.join(', ');
}

function splitIds(value: string) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function formatJson(value: unknown) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function updateAtIndex<T>(items: T[], index: number, nextItem: T) {
    return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

function removeAtIndex<T>(items: T[], index: number) {
    return items.filter((_, itemIndex) => itemIndex !== index);
}

function SectionCard(props: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm shadow-black/20">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{props.title}</h2>
                {props.subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{props.subtitle}</p> : null}
            </div>
            {props.children}
        </section>
    );
}

function StatCard(props: { title: string; value: string | number; icon: React.ReactNode }) {
    return (
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{props.title}</div>
                <div className="text-[var(--text-muted)]">{props.icon}</div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-[var(--text-primary)]">{props.value}</div>
        </div>
    );
}

function SegmentedTabs(props: {
    active: string;
    onChange: (value: 'overview' | 'access' | 'automod' | 'ai' | 'appeals' | 'retention' | 'analytics') => void;
    labels: Record<'overview' | 'access' | 'automod' | 'ai' | 'appeals' | 'retention' | 'analytics', string>;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {(['overview', 'access', 'automod', 'ai', 'appeals', 'retention', 'analytics'] as const).map((tab) => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => props.onChange(tab)}
                    className={`rounded-full px-4 py-2 text-sm transition-colors ${
                        props.active === tab
                            ? 'bg-[var(--color-primary-1)] text-black'
                            : 'border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                    }`}
                >
                    {props.labels[tab]}
                </button>
            ))}
        </div>
    );
}

function SelectField(props: {
    label: string;
    value: string;
    options: Array<{ id: string; name: string }>;
    placeholder?: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">{props.label}</span>
            <select
                value={props.value}
                onChange={(event) => props.onChange(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-black/10 px-4 py-3 text-sm text-[var(--text-primary)]"
            >
                <option value="">{props.placeholder ?? 'Select option'}</option>
                {props.options.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.name}
                    </option>
                ))}
            </select>
        </label>
    );
}

function TextField(props: {
    label: string;
    value: string;
    placeholder?: string;
    type?: 'text' | 'number';
    onChange: (value: string) => void;
}) {
    return (
        <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">{props.label}</span>
            <input
                type={props.type ?? 'text'}
                value={props.value}
                onChange={(event) => props.onChange(event.target.value)}
                placeholder={props.placeholder}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-black/10 px-4 py-3 text-sm text-[var(--text-primary)]"
            />
        </label>
    );
}

function TextAreaField(props: {
    label: string;
    value: string;
    placeholder?: string;
    rows?: number;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">{props.label}</span>
            <textarea
                value={props.value}
                rows={props.rows ?? 4}
                onChange={(event) => props.onChange(event.target.value)}
                placeholder={props.placeholder}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-black/10 px-4 py-3 text-sm text-[var(--text-primary)]"
            />
        </label>
    );
}

function ToggleField(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-black/10 px-4 py-3 text-sm text-[var(--text-secondary)]">
            <span>{props.label}</span>
            <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
        </label>
    );
}

function MultiPillSelector(props: {
    label: string;
    options: Array<{ id: string; name: string }>;
    selected: string[];
    onToggle: (id: string) => void;
}) {
    return (
        <div className="space-y-2">
            <div className="text-sm font-medium text-[var(--text-secondary)]">{props.label}</div>
            <div className="flex flex-wrap gap-2">
                {props.options.map((option) => {
                    const active = props.selected.includes(option.id);
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => props.onToggle(option.id)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                active
                                    ? 'border-[var(--color-primary-1)] bg-[var(--color-primary-1)]/15 text-[var(--text-primary)]'
                                    : 'border-[var(--border-subtle)] bg-black/10 text-[var(--text-muted)]'
                            }`}
                        >
                            {option.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AccessLevelBadge({ accessLevel }: { accessLevel: number }) {
    const tier = Math.min(Math.floor(accessLevel / 25), ACCESS_PRESETS.length - 1);
    return <div className="text-xs text-[var(--text-muted)]">Level {accessLevel} - {ACCESS_PRESETS[tier]}</div>;
}

export default function ModerationPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];
    const tr = (ru: string, en: string) => (locale === 'ru' ? ru : en);
    const renderDate = (value?: string | null) => formatDate(value, tr('Без срока', 'No expiry'));

    const [tab, setTab] = useState<'overview' | 'access' | 'automod' | 'ai' | 'appeals' | 'retention' | 'analytics'>('overview');
    const [config, setConfig] = useState<ConfigState>(emptyConfig);
    const [casesState, setCasesState] = useState<CasesState>(emptyCases);
    const [incidentState, setIncidentState] = useState<AiIncidentState>(emptyIncidents);
    const [appealState, setAppealState] = useState<AppealTicketState>(emptyAppeals);
    const [analyticsState, setAnalyticsState] = useState<AnalyticsState>(emptyAnalytics);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [caseFilter, setCaseFilter] = useState('');
    const [caseNumberFilter, setCaseNumberFilter] = useState('');
    const [caseStatusFilter, setCaseStatusFilter] = useState('');
    const [caseActionFilter, setCaseActionFilter] = useState('');
    const [caseTargetFilter, setCaseTargetFilter] = useState('');
    const [caseActorFilter, setCaseActorFilter] = useState('');
    const [caseSourceFilter, setCaseSourceFilter] = useState('');
    const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
    const [appealStatusFilter, setAppealStatusFilter] = useState('');
    const [appealNotes, setAppealNotes] = useState<Record<number, string>>({});
    const [appealActionKey, setAppealActionKey] = useState<string | null>(null);
    const [analyticsWindowDays, setAnalyticsWindowDays] = useState('30');

    const activeTimedCases = useMemo(
        () => casesState.cases.filter((item) => item.status === 'ACTIVE' && item.expiresAt),
        [casesState.cases]
    );
    const selectedCase = useMemo(
        () => casesState.cases.find((item) => item.id === selectedCaseId) ?? casesState.cases[0] ?? null,
        [casesState.cases, selectedCaseId]
    );
    const load = async (showSpinner = true) => {
        if (showSpinner) {
            setLoading(true);
        }
        setError(null);
        try {
            const caseParams = new URLSearchParams({ limit: '50' });
            if (caseFilter.trim()) caseParams.set('q', caseFilter.trim());
            if (caseNumberFilter.trim()) caseParams.set('caseNumber', caseNumberFilter.trim());
            if (caseStatusFilter) caseParams.set('status', caseStatusFilter);
            if (caseActionFilter) caseParams.set('actionType', caseActionFilter);
            if (caseTargetFilter.trim()) caseParams.set('targetUserId', caseTargetFilter.trim());
            if (caseActorFilter.trim()) caseParams.set('actorUserId', caseActorFilter.trim());
            if (caseSourceFilter) caseParams.set('source', caseSourceFilter);
            const appealParams = new URLSearchParams({ limit: '25' });
            if (appealStatusFilter) appealParams.set('status', appealStatusFilter);

            const [configRes, casesRes, incidentsRes, appealsRes, analyticsRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/moderation/config`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/cases?${caseParams.toString()}`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/ai/incidents?limit=25`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/appeals/tickets?${appealParams.toString()}`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/analytics?windowDays=${encodeURIComponent(analyticsWindowDays)}`, { cache: 'no-store' }),
            ]);

            if (!configRes.ok || !casesRes.ok || !incidentsRes.ok || !appealsRes.ok || !analyticsRes.ok) {
                throw new Error(text.failed);
            }

            const configPayload = await configRes.json();
            const casesPayload = await casesRes.json();
            const incidentsPayload = await incidentsRes.json();
            const appealsPayload = await appealsRes.json();
            const analyticsPayload = await analyticsRes.json();

            setConfig({
                roles: configPayload.roles ?? [],
                channels: configPayload.channels ?? [],
                moderationConfig: {
                    muteRoleId: configPayload.moderationConfig?.muteRoleId ?? '',
                    ignoredChannels: configPayload.moderationConfig?.ignoredChannels ?? [],
                    ignoredRoles: configPayload.moderationConfig?.ignoredRoles ?? [],
                    ignoredUsers: configPayload.moderationConfig?.ignoredUsers ?? [],
                    commandOnlyChannels: configPayload.moderationConfig?.commandOnlyChannels ?? [],
                },
                roleBindings: (configPayload.roleBindings ?? []).map((item: any, index: number) => ({
                    roleId: item.roleId ?? '',
                    title: item.title ?? 'Moderator',
                    accessLevel: Number(item.accessLevel ?? 50),
                    enabled: item.enabled !== false,
                    sortOrder: Number(item.sortOrder ?? index),
                })),
                commandGrants: (configPayload.commandGrants ?? []).map((item: any) => ({
                    roleId: item.roleId ?? '',
                    scopeType: item.scopeType === 'GROUP' ? 'GROUP' : 'COMMAND',
                    scopeKey: item.scopeKey ?? '',
                    effect: item.effect === 'DENY' ? 'DENY' : 'ALLOW',
                })),
                automodRules: (configPayload.automodRules ?? []).map((item: any) => ({
                    ruleKey: item.ruleKey,
                    enabled: item.enabled === true,
                    configText: item.config ? JSON.stringify(item.config, null, 2) : '',
                })),
                customRules: (configPayload.customRules ?? []).map((item: any) => ({
                    name: item.name ?? '',
                    ruleType: item.ruleType ?? 'regex',
                    pattern: item.pattern ?? '',
                    enabled: item.enabled !== false,
                    action: item.action ?? 'DELETE',
                    strikeWeight: Number(item.strikeWeight ?? 1),
                    notes: item.notes ?? '',
                })),
                sanctionSteps: (configPayload.sanctionSteps ?? []).map((item: any, index: number) => ({
                    triggerStrikeCount: Number(item.triggerStrikeCount ?? index + 1),
                    actionType: item.actionType ?? 'TIMEOUT',
                    durationMinutes: item.durationMinutes === null || item.durationMinutes === undefined ? null : Number(item.durationMinutes),
                    enabled: item.enabled !== false,
                    sortOrder: Number(item.sortOrder ?? index),
                })),
                aiConfig: {
                    enabled: configPayload.aiConfig?.enabled === true,
                    provider: configPayload.aiConfig?.provider ?? '',
                    model: configPayload.aiConfig?.model ?? '',
                    defaultThreshold: Number(configPayload.aiConfig?.defaultThreshold ?? 80),
                    scanEdits: configPayload.aiConfig?.scanEdits !== false,
                    includedChannels: configPayload.aiConfig?.includedChannels ?? [],
                    excludedChannels: configPayload.aiConfig?.excludedChannels ?? [],
                    exemptRoles: configPayload.aiConfig?.exemptRoles ?? [],
                    exemptUsers: configPayload.aiConfig?.exemptUsers ?? [],
                    customPolicyPrompt: configPayload.aiConfig?.customPolicyPrompt ?? '',
                },
                aiCategories: (configPayload.aiCategories ?? []).map((item: any, index: number) => ({
                    category: item.category ?? `category_${index}`,
                    enabled: item.enabled === true,
                    threshold: Number(item.threshold ?? 80),
                    sortOrder: Number(item.sortOrder ?? index),
                })),
                appealConfig: {
                    enabled: configPayload.appealConfig?.enabled === true,
                    appealChannelId: configPayload.appealConfig?.appealChannelId ?? '',
                    pardonLogChannelId: configPayload.appealConfig?.pardonLogChannelId ?? '',
                    allowUserAppeals: configPayload.appealConfig?.allowUserAppeals !== false,
                    allowDirectPardon: configPayload.appealConfig?.allowDirectPardon !== false,
                },
                retentionPolicies: (configPayload.retentionPolicies ?? []).map((item: any) => ({
                    category: item.category ?? '',
                    strategy: item.strategy ?? 'KEEP',
                    ttlDays: item.ttlDays === null || item.ttlDays === undefined ? null : Number(item.ttlDays),
                    enabled: item.enabled === true,
                })),
            });

            setCasesState({
                summary: casesPayload.summary ?? emptyCases().summary,
                cases: Array.isArray(casesPayload.cases) ? casesPayload.cases : [],
            });
            setSelectedCaseId((current) => {
                const nextCases = Array.isArray(casesPayload.cases) ? casesPayload.cases : [];
                if (!nextCases.length) return null;
                if (current && nextCases.some((item: ModerationCase) => item.id === current)) {
                    return current;
                }
                return nextCases[0].id;
            });
            setIncidentState({
                summary: incidentsPayload.summary ?? emptyIncidents().summary,
                incidents: Array.isArray(incidentsPayload.incidents) ? incidentsPayload.incidents : [],
            });
            setAppealState({
                summary: appealsPayload.summary ?? emptyAppeals().summary,
                tickets: Array.isArray(appealsPayload.tickets) ? appealsPayload.tickets : [],
            });
            setAnalyticsState({
                windowDays: Number(analyticsPayload.windowDays ?? 30),
                summary: analyticsPayload.summary ?? emptyAnalytics().summary,
                moderators: Array.isArray(analyticsPayload.moderators) ? analyticsPayload.moderators : [],
            });
        } catch (loadError) {
            console.error(loadError);
            setError(text.failed);
        } finally {
            if (showSpinner) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        void load();
    }, [guildId, caseFilter, caseNumberFilter, caseStatusFilter, caseActionFilter, caseTargetFilter, caseActorFilter, caseSourceFilter, appealStatusFilter, analyticsWindowDays]);

    const save = async () => {
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const automodRules = config.automodRules.map((rule) => ({
                ruleKey: rule.ruleKey,
                enabled: rule.enabled,
                config: rule.configText.trim() ? JSON.parse(rule.configText) : null,
            }));

            const response = await fetch(`/api/guilds/${guildId}/moderation/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, automodRules }),
            });

            if (!response.ok) {
                throw new Error(text.saveFailed);
            }

            setNotice(text.saved);
            await load();
        } catch (saveError) {
            console.error(saveError);
            setError(text.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    const handleAppealDecision = async (ticketId: number, decision: AppealReviewDecision) => {
        const note = appealNotes[ticketId] ?? '';
        const actionKey = `${ticketId}:${decision}`;
        setAppealActionKey(actionKey);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/guilds/${guildId}/moderation/appeals/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId,
                    decision,
                    note,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to review appeal ticket.');
            }

            setAppealNotes((current) => ({ ...current, [ticketId]: '' }));
            setNotice(`Appeal ticket #${ticketId} updated to ${decision}.`);
            await load(false);
        } catch (actionError) {
            console.error(actionError);
            setError(actionError instanceof Error ? actionError.message : 'Failed to review appeal ticket.');
        } finally {
            setAppealActionKey(null);
        }
    };

    if (loading) {
        return <div className="py-12 text-sm text-[var(--text-muted)]">{text.loading}</div>;
    }

    return (
        <div className="mx-auto flex w-full max-w-[1450px] flex-col gap-6 pb-16">
            <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6 shadow-sm shadow-black/20">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-4xl font-semibold text-[var(--text-primary)]">{text.title}</h1>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">{text.subtitle}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-secondary)]"
                        >
                            <ArrowClockwise size={16} />
                            {text.reload}
                        </button>
                        <button
                            type="button"
                            onClick={() => void save()}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-1)] px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
                        >
                            <FloppyDisk size={16} />
                            {saving ? '...' : text.save}
                        </button>
                    </div>
                </div>
                <div className="mt-5">
                    <SegmentedTabs active={tab} onChange={setTab} labels={text.tabs} />
                </div>
            </div>

            {notice ? <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div> : null}
            {error ? <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

            {tab === 'overview' ? (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <StatCard title={tr('Недавние кейсы', 'Recent cases')} value={casesState.summary.total} icon={<ShieldCheck size={20} />} />
                        <StatCard title={tr('Активные кейсы', 'Active cases')} value={casesState.summary.active} icon={<WarningCircle size={20} />} />
                        <StatCard title={tr('Предупреждения', 'Warnings')} value={casesState.summary.warnings} icon={<SlidersHorizontal size={20} />} />
                        <StatCard title={tr('Временные наказания', 'Timed punishments')} value={casesState.summary.timed} icon={<ClockCounterClockwise size={20} />} />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                        <SectionCard title={tr('Активные временные наказания', 'Active timed punishments')} subtitle={tr('Кейсы с истечением срока, которые все еще активны в текущей выборке.', 'Cases with expiry that still look active in the current feed.')}>
                            <div className="space-y-3">
                                {activeTimedCases.map((item) => (
                                    <div key={item.id} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-sm font-semibold text-[var(--text-primary)]">#{item.caseNumber} · {item.actionType}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{item.status}</div>
                                        </div>
                                        <div className="mt-2 text-sm text-[var(--text-secondary)]">{tr('Цель', 'Target')}: {item.targetUserId}</div>
                                        <div className="mt-1 text-xs text-[var(--text-muted)]">{tr('Истекает', 'Expires')}: {renderDate(item.expiresAt)}</div>
                                        {item.reason ? <div className="mt-2 text-sm text-[var(--text-secondary)]">{item.reason}</div> : null}
                                    </div>
                                ))}
                                {!activeTimedCases.length ? <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">{tr('В текущей выборке нет активных временных наказаний.', 'No active timed cases in the recent feed.')}</div> : null}
                            </div>
                        </SectionCard>

                        <SectionCard title={tr('Управление кейсами', 'Case management')} subtitle={tr('Ищите историю модерации, просматривайте связанные отмены и заметки по кейсам в одном месте.', 'Search moderation history, inspect linked reversals and review case notes in one place.')}>
                            <div className="mb-4 grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
                                <TextField label={tr('Поиск по кейсам', 'Search cases')} value={caseFilter} placeholder={tr('причина / модератор / статус', 'reason / actor / status')} onChange={setCaseFilter} />
                                <TextField label={tr('Кейс #', 'Case #')} value={caseNumberFilter} placeholder="1284" onChange={setCaseNumberFilter} />
                                <TextField label={tr('ID цели', 'Target user id')} value={caseTargetFilter} placeholder="1234567890" onChange={setCaseTargetFilter} />
                                <TextField label={tr('ID модератора', 'Actor user id')} value={caseActorFilter} placeholder="9876543210" onChange={setCaseActorFilter} />
                                <SelectField
                                    label={tr('Статус', 'Status')}
                                    value={caseStatusFilter}
                                    options={[
                                        { id: '', name: tr('Все статусы', 'All statuses') },
                                        { id: 'ACTIVE', name: 'ACTIVE' },
                                        { id: 'CLEARED', name: 'CLEARED' },
                                        { id: 'EXPIRED', name: 'EXPIRED' },
                                        { id: 'INFO', name: 'INFO' },
                                        { id: 'REVERTED', name: 'REVERTED' },
                                    ]}
                                    onChange={setCaseStatusFilter}
                                />
                                <TextField label={tr('Тип действия', 'Action type')} value={caseActionFilter} placeholder="WARN / TIMEOUT / BAN" onChange={setCaseActionFilter} />
                            </div>
                            <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                                <SelectField
                                    label={tr('Источник', 'Source')}
                                    value={caseSourceFilter}
                                    options={[
                                        { id: '', name: tr('Все источники', 'All sources') },
                                        { id: 'manual', name: 'manual' },
                                        { id: 'automod', name: 'automod' },
                                        { id: 'ai_review', name: 'ai_review' },
                                        { id: 'appeal_review', name: 'appeal_review' },
                                        { id: 'pardon', name: 'pardon' },
                                        { id: 'lifecycle', name: 'lifecycle' },
                                        { id: 'system', name: 'system' },
                                    ]}
                                    onChange={setCaseSourceFilter}
                                />
                                <div className="flex flex-wrap items-end gap-2 text-xs text-[var(--text-muted)]">
                                    <button type="button" onClick={() => { setCaseFilter(''); setCaseNumberFilter(''); setCaseStatusFilter(''); setCaseActionFilter(''); setCaseTargetFilter(''); setCaseActorFilter(''); setCaseSourceFilter(''); }} className="rounded-full border border-[var(--border-subtle)] px-3 py-2 text-[var(--text-secondary)]">{tr('Сбросить фильтры', 'Reset filters')}</button>
                                    <div>{casesState.cases.length} {tr('кейсов в текущей выборке', 'cases in current feed')}</div>
                                </div>
                            </div>
                            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                                <div className="space-y-3">
                                    {casesState.cases.map((item) => {
                                        const active = selectedCase?.id === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setSelectedCaseId(item.id)}
                                                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                                                    active
                                                        ? 'border-[var(--color-primary-1)] bg-[var(--color-primary-1)]/10'
                                                        : 'border-[var(--border-subtle)] bg-black/10'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">#{item.caseNumber}</span>
                                                        <span className="text-sm font-semibold text-[var(--text-primary)]">{item.actionType}</span>
                                                        <span className="text-xs text-[var(--text-muted)]">{item.status}</span>
                                                    </div>
                                                    <div className="text-xs text-[var(--text-muted)]">{renderDate(item.createdAt)}</div>
                                                </div>
                                                <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-3">
                                                    <div>{tr('Цель', 'Target')}: {item.targetUserId}</div>
                                                    <div>{tr('Модератор', 'Actor')}: {item.actorUserId ?? tr('система', 'system')}</div>
                                                    <div>{tr('Источник', 'Source')}: {item.source}</div>
                                                </div>
                                                {item.reason ? <div className="mt-3 line-clamp-2 text-sm text-[var(--text-secondary)]">{item.reason}</div> : null}
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                                                    {item.relatedCase ? <span>{tr('Родительский кейс', 'Parent case')} #{item.relatedCase.caseNumber}</span> : null}
                                                    {item.linkedCases?.length ? <span>{item.linkedCases.length} {tr('связанных кейсов', 'follow-up case(s)')}</span> : null}
                                                    {item.notes?.length ? <span>{item.notes.length} {tr('заметок', 'recent note(s)')}</span> : null}
                                                    {item.expiresAt ? <span>{tr('Истекает', 'Expires')} {renderDate(item.expiresAt)}</span> : null}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {!casesState.cases.length ? <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">{tr('Нет кейсов, подходящих под текущий фильтр.', 'No cases match the current filter.')}</div> : null}
                                </div>
                                <div className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    {selectedCase ? (
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{tr('Выбранный кейс', 'Focused case')}</div>
                                                    <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">#{selectedCase.caseNumber} · {selectedCase.actionType}</div>
                                                </div>
                                                <div className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-xs text-[var(--text-primary)]">{selectedCase.status}</div>
                                            </div>

                                            <div className="grid gap-3 text-sm text-[var(--text-secondary)]">
                                                <div>{tr('Цель', 'Target')}: {selectedCase.targetUserId}</div>
                                                <div>{tr('Модератор', 'Actor')}: {selectedCase.actorUserId ?? tr('система', 'system')}</div>
                                                <div>{tr('Источник', 'Source')}: {selectedCase.source}</div>
                                                <div>{tr('Создан', 'Created')}: {renderDate(selectedCase.createdAt)}</div>
                                                {selectedCase.expiresAt ? <div>{tr('Истекает', 'Expires')}: {renderDate(selectedCase.expiresAt)}</div> : null}
                                            </div>

                                            {selectedCase.reason ? (
                                                <div className="rounded-xl border border-[var(--border-subtle)] bg-black/10 p-3">
                                                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{tr('Причина', 'Reason')}</div>
                                                    <div className="mt-2 text-sm text-[var(--text-secondary)]">{selectedCase.reason}</div>
                                                </div>
                                            ) : null}

                                            {selectedCase.relatedCase ? (
                                                <div className="rounded-xl border border-[var(--border-subtle)] bg-black/10 p-3">
                                                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{tr('Родительский кейс', 'Parent case')}</div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCaseNumberFilter(String(selectedCase.relatedCase?.caseNumber ?? ''))}
                                                        className="mt-2 text-sm text-[var(--text-primary)] underline underline-offset-4"
                                                    >
                                                        #{selectedCase.relatedCase.caseNumber} · {selectedCase.relatedCase.actionType} ({selectedCase.relatedCase.status})
                                                    </button>
                                                </div>
                                            ) : null}

                                            {selectedCase.linkedCases?.length ? (
                                                <div className="rounded-xl border border-[var(--border-subtle)] bg-black/10 p-3">
                                                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{tr('Связанные / отменяющие кейсы', 'Follow-up / reversal cases')}</div>
                                                    <div className="mt-3 space-y-2">
                                                        {selectedCase.linkedCases.map((linked) => (
                                                            <button
                                                                key={linked.id}
                                                                type="button"
                                                                onClick={() => setCaseNumberFilter(String(linked.caseNumber))}
                                                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-black/10 px-3 py-2 text-left text-sm text-[var(--text-secondary)]"
                                                            >
                                                                <div className="font-medium text-[var(--text-primary)]">#{linked.caseNumber} · {linked.actionType}</div>
                                                                <div className="mt-1 text-xs text-[var(--text-muted)]">{linked.status} · {linked.source} · {renderDate(linked.createdAt)}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {selectedCase.notes?.length ? (
                                                <div className="rounded-xl border border-[var(--border-subtle)] bg-black/10 p-3">
                                                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{tr('Последние заметки', 'Recent notes')}</div>
                                                    <div className="mt-3 space-y-2">
                                                        {selectedCase.notes.map((note) => (
                                                            <div key={note.id} className="rounded-xl border border-[var(--border-subtle)] bg-black/10 p-3">
                                                                <div className="text-xs text-[var(--text-muted)]">{note.actorUserId} · {renderDate(note.createdAt)}</div>
                                                                <div className="mt-2 text-sm text-[var(--text-secondary)]">{note.note}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {selectedCase.metadata ? (
                                                <div className="rounded-xl border border-[var(--border-subtle)] bg-black/10 p-3">
                                                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{tr('Метаданные', 'Metadata')}</div>
                                                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">{formatJson(selectedCase.metadata)}</pre>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">{tr('Выберите кейс, чтобы посмотреть заметки, метаданные и связанную историю.', 'Select a case to inspect its notes, metadata and linked history.')}</div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            ) : null}

            {tab === 'access' ? (
                <div className="space-y-6">
                    <SectionCard title={tr('Базовая область модерации', 'Core moderation scope')} subtitle={tr('Mute-роль, игнорируемые сущности и базовые исключения.', 'Mute role, ignored entities and baseline exclusions.')}>
                        <div className="grid gap-6 lg:grid-cols-2">
                            <SelectField
                                label={tr('Mute-роль', 'Mute role')}
                                value={config.moderationConfig.muteRoleId}
                                options={config.roles}
                                placeholder={tr('Mute-роль не настроена', 'Mute role not configured')}
                                onChange={(value) => setConfig((current) => ({ ...current, moderationConfig: { ...current.moderationConfig, muteRoleId: value } }))}
                            />
                            <TextField
                                label={tr('Игнорируемые ID пользователей', 'Ignored user IDs')}
                                value={joinIds(config.moderationConfig.ignoredUsers)}
                                placeholder="123, 456"
                                onChange={(value) => setConfig((current) => ({ ...current, moderationConfig: { ...current.moderationConfig, ignoredUsers: splitIds(value) } }))}
                            />
                        </div>
                        <div className="mt-6 grid gap-6 xl:grid-cols-2">
                            <MultiPillSelector
                                label={tr('Игнорируемые каналы', 'Ignored channels')}
                                options={config.channels.map((channel) => ({ id: channel.id, name: `#${channel.name}` }))}
                                selected={config.moderationConfig.ignoredChannels}
                                onToggle={(id) => setConfig((current) => ({ ...current, moderationConfig: { ...current.moderationConfig, ignoredChannels: current.moderationConfig.ignoredChannels.includes(id) ? current.moderationConfig.ignoredChannels.filter((item) => item !== id) : [...current.moderationConfig.ignoredChannels, id] } }))}
                            />
                            <MultiPillSelector
                                label={tr('Игнорируемые роли', 'Ignored roles')}
                                options={config.roles}
                                selected={config.moderationConfig.ignoredRoles}
                                onToggle={(id) => setConfig((current) => ({ ...current, moderationConfig: { ...current.moderationConfig, ignoredRoles: current.moderationConfig.ignoredRoles.includes(id) ? current.moderationConfig.ignoredRoles.filter((item) => item !== id) : [...current.moderationConfig.ignoredRoles, id] } }))}
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title={tr('Связки ролей модерации', 'Moderator role bindings')} subtitle={tr('Числовой уровень доступа используется как резервная иерархия поверх явных overrides.', 'Numeric access is the fallback hierarchy under explicit overrides.')}>
                        <div className="space-y-4">
                            {config.roleBindings.map((binding, index) => (
                                <div key={`${binding.roleId}-${index}`} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1fr_auto]">
                                        <SelectField label={tr('Роль', 'Role')} value={binding.roleId} options={config.roles} onChange={(value) => setConfig((current) => ({ ...current, roleBindings: updateAtIndex(current.roleBindings, index, { ...binding, roleId: value }) }))} />
                                        <TextField label={tr('Титул', 'Title')} value={binding.title} placeholder="Control" onChange={(value) => setConfig((current) => ({ ...current, roleBindings: updateAtIndex(current.roleBindings, index, { ...binding, title: value }) }))} />
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-[var(--text-secondary)]">{tr('Уровень доступа', 'Access level')}</div>
                                            <input type="range" min={0} max={100} value={binding.accessLevel} onChange={(event) => setConfig((current) => ({ ...current, roleBindings: updateAtIndex(current.roleBindings, index, { ...binding, accessLevel: Number(event.target.value) }) }))} className="w-full" />
                                            <AccessLevelBadge accessLevel={binding.accessLevel} />
                                        </div>
                                        <div className="flex items-end justify-end gap-3">
                                            <ToggleField label={tr('Включено', 'Enabled')} checked={binding.enabled} onChange={(checked) => setConfig((current) => ({ ...current, roleBindings: updateAtIndex(current.roleBindings, index, { ...binding, enabled: checked }) }))} />
                                            <button type="button" onClick={() => setConfig((current) => ({ ...current, roleBindings: removeAtIndex(current.roleBindings, index) }))} className="rounded-full border border-red-500/40 px-3 py-2 text-sm text-red-300">{tr('Удалить', 'Remove')}</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setConfig((current) => ({ ...current, roleBindings: [...current.roleBindings, { roleId: '', title: 'Moderator', accessLevel: 50, enabled: true, sortOrder: current.roleBindings.length }].slice(0, 15) }))} className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">{tr('Добавить связку роли', 'Add role binding')}</button>
                        </div>
                    </SectionCard>

                    <SectionCard title={tr('Overrides команд', 'Command overrides')} subtitle={tr('Явные ALLOW и DENY по роли для конкретной команды или группы команд.', 'Explicit ALLOW and DENY by role over command or command group.')}>
                        <div className="space-y-4">
                            {config.commandGrants.map((grant, index) => (
                                <div key={`${grant.roleId}-${grant.scopeKey}-${index}`} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.8fr_1fr_0.8fr_auto]">
                                        <SelectField label={tr('Роль', 'Role')} value={grant.roleId} options={config.roles} onChange={(value) => setConfig((current) => ({ ...current, commandGrants: updateAtIndex(current.commandGrants, index, { ...grant, roleId: value }) }))} />
                                        <SelectField label={tr('Тип области', 'Scope type')} value={grant.scopeType} options={[{ id: 'COMMAND', name: 'COMMAND' }, { id: 'GROUP', name: 'GROUP' }]} onChange={(value) => setConfig((current) => ({ ...current, commandGrants: updateAtIndex(current.commandGrants, index, { ...grant, scopeType: value as 'COMMAND' | 'GROUP' }) }))} />
                                        <TextField label={tr('Ключ области', 'Scope key')} value={grant.scopeKey} placeholder={grant.scopeType === 'GROUP' ? 'moderation' : 'ban'} onChange={(value) => setConfig((current) => ({ ...current, commandGrants: updateAtIndex(current.commandGrants, index, { ...grant, scopeKey: value }) }))} />
                                        <SelectField label={tr('Эффект', 'Effect')} value={grant.effect} options={[{ id: 'ALLOW', name: 'ALLOW' }, { id: 'DENY', name: 'DENY' }]} onChange={(value) => setConfig((current) => ({ ...current, commandGrants: updateAtIndex(current.commandGrants, index, { ...grant, effect: value as 'ALLOW' | 'DENY' }) }))} />
                                        <div className="flex items-end justify-end">
                                            <button type="button" onClick={() => setConfig((current) => ({ ...current, commandGrants: removeAtIndex(current.commandGrants, index) }))} className="rounded-full border border-red-500/40 px-3 py-2 text-sm text-red-300">{tr('Удалить', 'Remove')}</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setConfig((current) => ({ ...current, commandGrants: [...current.commandGrants, { roleId: '', scopeType: 'COMMAND', scopeKey: '', effect: 'ALLOW' }] }))} className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">{tr('Добавить override', 'Add override')}</button>
                        </div>
                    </SectionCard>
                </div>
            ) : null}

            {tab === 'automod' ? (
                <div className="space-y-6">
                    <SectionCard title={tr('Область автомода', 'AutoMod scope')} subtitle={tr('Выбирайте исключения и каналы только для команд прямо из списков ролей и каналов.', 'Choose exclusions and command-only channels directly from channel and role lists.')}>
                        <div className="grid gap-6 xl:grid-cols-2">
                            <MultiPillSelector
                                label={tr('Игнорируемые каналы', 'Ignored channels')}
                                options={config.channels.map((channel) => ({ id: channel.id, name: `#${channel.name}` }))}
                                selected={config.moderationConfig.ignoredChannels}
                                onToggle={(id) => setConfig((current) => ({ ...current, moderationConfig: { ...current.moderationConfig, ignoredChannels: current.moderationConfig.ignoredChannels.includes(id) ? current.moderationConfig.ignoredChannels.filter((item) => item !== id) : [...current.moderationConfig.ignoredChannels, id] } }))}
                            />
                            <MultiPillSelector
                                label={tr('Каналы только для команд', 'Command-only channels')}
                                options={config.channels.map((channel) => ({ id: channel.id, name: `#${channel.name}` }))}
                                selected={config.moderationConfig.commandOnlyChannels}
                                onToggle={(id) => setConfig((current) => ({ ...current, moderationConfig: { ...current.moderationConfig, commandOnlyChannels: current.moderationConfig.commandOnlyChannels.includes(id) ? current.moderationConfig.commandOnlyChannels.filter((item) => item !== id) : [...current.moderationConfig.commandOnlyChannels, id] } }))}
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title={tr('Встроенные фильтры', 'Built-in filters')} subtitle={tr('Включайте базовые правила и задавайте JSON-конфиг там, где нужны пороги или allowlist.', 'Toggle core rules and attach JSON config when a rule needs thresholds or allowlists.')}>
                        <div className="grid gap-4 xl:grid-cols-2">
                            {config.automodRules.map((rule, index) => (
                                <div key={rule.ruleKey} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-[var(--text-primary)]">{locale === 'ru' ? (BUILTIN_RULE_LABELS_RU[rule.ruleKey] ?? rule.ruleKey) : (BUILTIN_RULE_LABELS[rule.ruleKey] ?? rule.ruleKey)}</div>
                                        <input type="checkbox" checked={rule.enabled} onChange={(event) => setConfig((current) => ({ ...current, automodRules: updateAtIndex(current.automodRules, index, { ...rule, enabled: event.target.checked }) }))} />
                                    </div>
                                    <div className="mt-4">
                                        <TextAreaField label={tr('JSON-конфиг правила', 'Rule config JSON')} value={rule.configText} rows={4} placeholder='{"threshold": 5, "windowMs": 10000}' onChange={(value) => setConfig((current) => ({ ...current, automodRules: updateAtIndex(current.automodRules, index, { ...rule, configText: value }) }))} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard title={tr('Пользовательские фильтры', 'Custom filters')} subtitle={tr('Правила по keyword-list или regex с действием и весом страйка.', 'Keyword-list or regex rules with action and strike weight.')}>
                        <div className="mb-4 flex flex-wrap gap-2">
                            {CUSTOM_RULE_TEMPLATES.map((template) => (
                                <button
                                    key={template.name}
                                    type="button"
                                    onClick={() =>
                                        setConfig((current) => ({
                                            ...current,
                                            customRules: [...current.customRules, { ...template }].slice(0, 10),
                                        }))
                                    }
                                    className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--color-primary-1)] hover:text-[var(--text-primary)]"
                                >
                                    + {template.name}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-4">
                            {config.customRules.map((rule, index) => (
                                <div key={`${rule.name}-${index}`} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr_1fr_0.8fr_0.7fr_auto]">
                                        <TextField label={tr('Название', 'Name')} value={rule.name} placeholder={tr('Фишинговые ссылки', 'Phishing links')} onChange={(value) => setConfig((current) => ({ ...current, customRules: updateAtIndex(current.customRules, index, { ...rule, name: value }) }))} />
                                        <SelectField label={tr('Тип правила', 'Rule type')} value={rule.ruleType} options={CUSTOM_RULE_TYPES.map((type) => ({ id: type, name: type }))} onChange={(value) => setConfig((current) => ({ ...current, customRules: updateAtIndex(current.customRules, index, { ...rule, ruleType: value }) }))} />
                                        <TextField label={tr('Паттерн', 'Pattern')} value={rule.pattern} placeholder="(bit\\.ly|tinyurl)" onChange={(value) => setConfig((current) => ({ ...current, customRules: updateAtIndex(current.customRules, index, { ...rule, pattern: value }) }))} />
                                        <SelectField label={tr('Действие', 'Action')} value={rule.action} options={CUSTOM_RULE_ACTIONS.map((action) => ({ id: action, name: action }))} onChange={(value) => setConfig((current) => ({ ...current, customRules: updateAtIndex(current.customRules, index, { ...rule, action: value }) }))} />
                                        <TextField label={tr('Вес страйка', 'Strike weight')} type="number" value={String(rule.strikeWeight)} onChange={(value) => setConfig((current) => ({ ...current, customRules: updateAtIndex(current.customRules, index, { ...rule, strikeWeight: Number(value) || 0 }) }))} />
                                        <div className="flex items-end justify-end">
                                            <button type="button" onClick={() => setConfig((current) => ({ ...current, customRules: removeAtIndex(current.customRules, index) }))} className="rounded-full border border-red-500/40 px-3 py-2 text-sm text-red-300">{tr('Удалить', 'Remove')}</button>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
                                        <ToggleField label={tr('Включено', 'Enabled')} checked={rule.enabled} onChange={(checked) => setConfig((current) => ({ ...current, customRules: updateAtIndex(current.customRules, index, { ...rule, enabled: checked }) }))} />
                                        <TextAreaField label={tr('Заметки', 'Notes')} value={rule.notes} rows={2} placeholder={tr('Необязательные заметки', 'Optional notes')} onChange={(value) => setConfig((current) => ({ ...current, customRules: updateAtIndex(current.customRules, index, { ...rule, notes: value }) }))} />
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setConfig((current) => ({ ...current, customRules: [...current.customRules, { name: '', ruleType: 'regex', pattern: '', enabled: true, action: 'DELETE', strikeWeight: 1, notes: '' }].slice(0, 10) }))} className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">{tr('Добавить пользовательское правило', 'Add custom rule')}</button>
                        </div>
                    </SectionCard>

                    <SectionCard title={tr('Штрафные санкции', 'Strike sanctions')} subtitle={tr('Упорядоченные действия, которые срабатывают при достижении порога страйков.', 'Ordered actions that fire when strike count reaches a threshold.')}>
                        <div className="space-y-4">
                            {config.sanctionSteps.map((step, index) => (
                                <div key={`${step.triggerStrikeCount}-${step.actionType}-${index}`} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="grid gap-4 xl:grid-cols-[0.8fr_1fr_1fr_auto]">
                                        <TextField label={tr('Кол-во страйков', 'Strike count')} type="number" value={String(step.triggerStrikeCount)} onChange={(value) => setConfig((current) => ({ ...current, sanctionSteps: updateAtIndex(current.sanctionSteps, index, { ...step, triggerStrikeCount: Number(value) || 1 }) }))} />
                                        <SelectField label={tr('Действие', 'Action')} value={step.actionType} options={SANCTION_ACTIONS.map((action) => ({ id: action, name: action }))} onChange={(value) => setConfig((current) => ({ ...current, sanctionSteps: updateAtIndex(current.sanctionSteps, index, { ...step, actionType: value }) }))} />
                                        <TextField label={tr('Длительность в минутах', 'Duration minutes')} type="number" value={String(step.durationMinutes ?? 0)} onChange={(value) => setConfig((current) => ({ ...current, sanctionSteps: updateAtIndex(current.sanctionSteps, index, { ...step, durationMinutes: value ? Number(value) : null }) }))} />
                                        <div className="flex items-end justify-end gap-3">
                                            <ToggleField label={tr('Включено', 'Enabled')} checked={step.enabled} onChange={(checked) => setConfig((current) => ({ ...current, sanctionSteps: updateAtIndex(current.sanctionSteps, index, { ...step, enabled: checked }) }))} />
                                            <button type="button" onClick={() => setConfig((current) => ({ ...current, sanctionSteps: removeAtIndex(current.sanctionSteps, index) }))} className="rounded-full border border-red-500/40 px-3 py-2 text-sm text-red-300">{tr('Удалить', 'Remove')}</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setConfig((current) => ({ ...current, sanctionSteps: [...current.sanctionSteps, { triggerStrikeCount: current.sanctionSteps.length + 1, actionType: 'TIMEOUT', durationMinutes: 60, enabled: true, sortOrder: current.sanctionSteps.length }] }))} className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">{tr('Добавить шаг санкции', 'Add sanction step')}</button>
                        </div>
                    </SectionCard>
                </div>
            ) : null}

            {tab === 'ai' ? (
                <div className="space-y-6">
                    <SectionCard title={tr('ИИ-модерация', 'AI moderation')} subtitle={tr('Настройка провайдера, области мониторинга и политики проверки.', 'Provider setup, scope and review policy.')}>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <ToggleField label={tr('ИИ-модерация включена', 'AI moderation enabled')} checked={config.aiConfig.enabled} onChange={(checked) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, enabled: checked } }))} />
                            <ToggleField label={tr('Проверять отредактированные сообщения', 'Scan edited messages')} checked={config.aiConfig.scanEdits} onChange={(checked) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, scanEdits: checked } }))} />
                            <SelectField label={tr('Провайдер', 'Provider')} value={config.aiConfig.provider} options={AI_PROVIDER_OPTIONS} onChange={(value) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, provider: value } }))} />
                            <TextField label={tr('Модель', 'Model')} value={config.aiConfig.model} placeholder="gpt-5-mini / gemini-2.5-flash" onChange={(value) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, model: value } }))} />
                            <TextField label={tr('Базовый порог', 'Default threshold')} type="number" value={String(config.aiConfig.defaultThreshold)} onChange={(value) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, defaultThreshold: Number(value) || 0 } }))} />
                            <TextField label={tr('Исключенные ID пользователей', 'Exempt user IDs')} value={joinIds(config.aiConfig.exemptUsers)} placeholder="123, 456" onChange={(value) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, exemptUsers: splitIds(value) } }))} />
                        </div>
                        <div className="mt-6 grid gap-6 xl:grid-cols-2">
                            <MultiPillSelector label={tr('Включенные каналы', 'Included channels')} options={config.channels.map((channel) => ({ id: channel.id, name: `#${channel.name}` }))} selected={config.aiConfig.includedChannels} onToggle={(id) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, includedChannels: current.aiConfig.includedChannels.includes(id) ? current.aiConfig.includedChannels.filter((item) => item !== id) : [...current.aiConfig.includedChannels, id] } }))} />
                            <MultiPillSelector label={tr('Исключенные каналы', 'Excluded channels')} options={config.channels.map((channel) => ({ id: channel.id, name: `#${channel.name}` }))} selected={config.aiConfig.excludedChannels} onToggle={(id) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, excludedChannels: current.aiConfig.excludedChannels.includes(id) ? current.aiConfig.excludedChannels.filter((item) => item !== id) : [...current.aiConfig.excludedChannels, id] } }))} />
                            <MultiPillSelector label={tr('Исключенные роли', 'Exempt roles')} options={config.roles} selected={config.aiConfig.exemptRoles} onToggle={(id) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, exemptRoles: current.aiConfig.exemptRoles.includes(id) ? current.aiConfig.exemptRoles.filter((item) => item !== id) : [...current.aiConfig.exemptRoles, id] } }))} />
                            <TextAreaField label={tr('Пользовательский policy prompt', 'Custom policy prompt')} value={config.aiConfig.customPolicyPrompt} rows={4} placeholder={tr('Необязательные локальные правила сервера', 'Optional server-specific review rules')} onChange={(value) => setConfig((current) => ({ ...current, aiConfig: { ...current.aiConfig, customPolicyPrompt: value } }))} />
                        </div>
                    </SectionCard>

                    <SectionCard title={tr('Матрица AI-категорий', 'AI category matrix')} subtitle={tr('Только включенные категории могут создавать инциденты и алерты.', 'Only enabled categories can trigger incidents and alerts.')}>
                        <div className="grid gap-4 xl:grid-cols-2">
                            {config.aiCategories.map((category, index) => (
                                <div key={category.category} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-[var(--text-primary)]">{locale === 'ru' ? (CATEGORY_LABELS_RU[category.category] ?? category.category) : (CATEGORY_LABELS[category.category] ?? category.category)}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{category.category}</div>
                                        </div>
                                        <input type="checkbox" checked={category.enabled} onChange={(event) => setConfig((current) => ({ ...current, aiCategories: updateAtIndex(current.aiCategories, index, { ...category, enabled: event.target.checked }) }))} />
                                    </div>
                                    <div className="mt-4">
                                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{tr('Порог', 'Threshold')}</div>
                                        <input type="range" min={0} max={100} value={category.threshold} onChange={(event) => setConfig((current) => ({ ...current, aiCategories: updateAtIndex(current.aiCategories, index, { ...category, threshold: Number(event.target.value) }) }))} className="mt-2 w-full" />
                                        <div className="mt-1 text-sm text-[var(--text-secondary)]">{category.threshold}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard title={tr('Недавние AI-инциденты', 'Recent AI incidents')} subtitle={tr('Последние элементы очереди на проверку и уже решенные AI-кейсы.', 'Latest review queue and resolved AI decisions.')}>
                        <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <StatCard title={tr('Всего инцидентов', 'Total incidents')} value={incidentState.summary.total} icon={<ShieldCheck size={20} />} />
                            <StatCard title={tr('Открытые', 'Open')} value={incidentState.summary.open} icon={<WarningCircle size={20} />} />
                            <StatCard title={tr('Ложные срабатывания', 'False positives')} value={incidentState.summary.falsePositive} icon={<SlidersHorizontal size={20} />} />
                            <StatCard title={tr('Подтвержденные', 'Confirmed')} value={incidentState.summary.confirmed} icon={<ClockCounterClockwise size={20} />} />
                        </div>
                        <div className="space-y-3">
                            {incidentState.incidents.map((incident) => (
                                <div key={incident.id} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">{incident.status}</span>
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">{incident.provider ?? 'provider'} / {incident.model ?? 'model'}</span>
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">{renderDate(incident.createdAt)}</div>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-3">
                                        <div>{tr('Автор', 'Author')}: {incident.authorId}</div>
                                        <div>{tr('Канал', 'Channel')}: {incident.channelId}</div>
                                        <div>{tr('Уверенность', 'Confidence')}: {incident.confidence ?? tr('н/д', 'n/a')}</div>
                                    </div>
                                    {incident.summary ? <div className="mt-3 text-sm text-[var(--text-secondary)]">{incident.summary}</div> : null}
                                    {incident.excerpt ? <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-black/10 p-3 text-xs text-[var(--text-muted)]">{incident.excerpt}</div> : null}
                                    {incident.categories.length ? <div className="mt-3 text-xs text-[var(--text-muted)]">{tr('Категории', 'Categories')}: {incident.categories.map((entry) => `${locale === 'ru' ? (CATEGORY_LABELS_RU[entry.category] ?? entry.category) : (CATEGORY_LABELS[entry.category] ?? entry.category)} (${entry.score})`).join(', ')}</div> : null}
                                    {incident.reviewerId ? <div className="mt-2 text-xs text-[var(--text-muted)]">{tr('Проверил', 'Reviewed by')}: {incident.reviewerId} {incident.reviewedAt ? `- ${renderDate(incident.reviewedAt)}` : ''}</div> : null}
                                </div>
                            ))}
                            {!incidentState.incidents.length ? <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">{tr('В недавней ленте нет AI-инцидентов.', 'No AI incidents in the recent feed.')}</div> : null}
                        </div>
                    </SectionCard>
                </div>
            ) : null}

            {tab === 'appeals' ? (
                <div className="space-y-6">
                    <SectionCard title={tr('Настройки апелляций и помилования', 'Appeals & pardon config')} subtitle={tr('Выберите, куда отправлять апелляции и могут ли модераторы выдавать прямое помилование.', 'Choose where appeal tickets go and whether staff can issue direct pardons.')}>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <ToggleField label={tr('Апелляции включены', 'Appeals enabled')} checked={config.appealConfig.enabled} onChange={(checked) => setConfig((current) => ({ ...current, appealConfig: { ...current.appealConfig, enabled: checked } }))} />
                            <ToggleField label={tr('Разрешить пользовательские апелляции', 'Allow user appeals')} checked={config.appealConfig.allowUserAppeals} onChange={(checked) => setConfig((current) => ({ ...current, appealConfig: { ...current.appealConfig, allowUserAppeals: checked } }))} />
                            <ToggleField label={tr('Разрешить прямое помилование', 'Allow direct pardon workflow')} checked={config.appealConfig.allowDirectPardon} onChange={(checked) => setConfig((current) => ({ ...current, appealConfig: { ...current.appealConfig, allowDirectPardon: checked } }))} />
                            <div />
                            <SelectField
                                label={tr('Канал проверки апелляций', 'Appeal review channel')}
                                value={config.appealConfig.appealChannelId}
                                options={config.channels.map((channel) => ({ id: channel.id, name: `#${channel.name}` }))}
                                placeholder={tr('Канал апелляций не выбран', 'No appeal channel selected')}
                                onChange={(value) => setConfig((current) => ({ ...current, appealConfig: { ...current.appealConfig, appealChannelId: value } }))}
                            />
                            <SelectField
                                label={tr('Канал логов решений / помилований', 'Pardon / resolution log channel')}
                                value={config.appealConfig.pardonLogChannelId}
                                options={config.channels.map((channel) => ({ id: channel.id, name: `#${channel.name}` }))}
                                placeholder={tr('Иначе будет использоваться канал апелляций', 'Fallback to appeal channel')}
                                onChange={(value) => setConfig((current) => ({ ...current, appealConfig: { ...current.appealConfig, pardonLogChannelId: value } }))}
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title={tr('Последние тикеты апелляций', 'Recent appeal tickets')} subtitle={tr('Последние апелляции и решения по помилованию, связанные с moderation cases.', 'Latest appeal and pardon decisions linked to moderation cases.')}>
                        <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                            <StatCard title={tr('Всего тикетов', 'Total tickets')} value={appealState.summary.total} icon={<ShieldCheck size={20} />} />
                            <StatCard title={tr('Открытые', 'Open')} value={appealState.summary.open} icon={<WarningCircle size={20} />} />
                            <StatCard title={tr('На проверке', 'In review')} value={appealState.summary.inReview} icon={<ClockCounterClockwise size={20} />} />
                            <StatCard title={tr('Приняты', 'Accepted')} value={appealState.summary.accepted} icon={<SlidersHorizontal size={20} />} />
                            <StatCard title={tr('Отклонены', 'Rejected')} value={appealState.summary.rejected} icon={<WarningCircle size={20} />} />
                        </div>
                        <div className="mb-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                            <SelectField
                                label={tr('Фильтр по статусу тикета', 'Ticket status filter')}
                                value={appealStatusFilter}
                                options={[
                                        { id: '', name: tr('Все статусы', 'All statuses') },
                                    { id: 'OPEN', name: 'OPEN' },
                                    { id: 'IN_REVIEW', name: 'IN_REVIEW' },
                                    { id: 'ACCEPTED', name: 'ACCEPTED' },
                                    { id: 'PARDONED', name: 'PARDONED' },
                                    { id: 'REJECTED', name: 'REJECTED' },
                                ]}
                                onChange={setAppealStatusFilter}
                            />
                            <div className="flex items-end text-sm text-[var(--text-muted)]">
                                {tr('Действия проверки выполняются через bot API, чтобы все отмены наказаний происходили на стороне бота.', 'Review actions are executed through the bot API so reversals still happen on the bot side.')}
                            </div>
                        </div>
                        <div className="space-y-3">
                            {appealState.tickets.map((ticket) => (
                                <div key={ticket.id} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">#{ticket.id}</span>
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">{ticket.appealType}</span>
                                            <span className="text-xs text-[var(--text-muted)]">{ticket.status}</span>
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">{renderDate(ticket.createdAt)}</div>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-3">
                                        <div>{tr('Пользователь', 'User')}: {ticket.userId}</div>
                                        <div>{tr('Кейс', 'Case')}: #{ticket.caseNumber}</div>
                                        <div>{tr('Действие', 'Action')}: {ticket.moderationCase.actionType}</div>
                                    </div>
                                    <div className="mt-3 text-sm text-[var(--text-secondary)]">{ticket.message}</div>
                                    {['OPEN', 'IN_REVIEW'].includes(ticket.status) ? (
                                        <div className="mt-4 space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                            <TextAreaField
                                                label={tr('Заметка модератора', 'Staff note')}
                                                value={appealNotes[ticket.id] ?? ''}
                                                rows={3}
                                                placeholder={tr('Необязательная заметка или причина помилования', 'Optional review note or pardon reason')}
                                                onChange={(value) => setAppealNotes((current) => ({ ...current, [ticket.id]: value }))}
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                {APPEAL_REVIEW_OPTIONS
                                                    .filter((decision) => decision !== 'PARDONED' || (config.appealConfig.allowDirectPardon && PARDONABLE_ACTIONS.has(ticket.moderationCase.actionType)))
                                                    .map((decision) => {
                                                        const busy = appealActionKey === `${ticket.id}:${decision}`;
                                                        return (
                                                            <button
                                                                key={decision}
                                                                type="button"
                                                                disabled={busy}
                                                                onClick={() => void handleAppealDecision(ticket.id, decision)}
                                                                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                                                                    decision === 'REJECTED'
                                                                        ? 'border border-red-500/40 text-red-300'
                                                                        : decision === 'PARDONED'
                                                                            ? 'border border-emerald-500/40 text-emerald-300'
                                                                            : 'border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                                                                }`}
                                                            >
                                                                {busy ? '...' : decision}
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    ) : null}
                                    {ticket.resolutionNote ? <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-black/10 p-3 text-xs text-[var(--text-muted)]">{ticket.resolutionNote}</div> : null}
                                    {ticket.reviewerId ? <div className="mt-2 text-xs text-[var(--text-muted)]">{tr('Проверил', 'Reviewed by')}: {ticket.reviewerId}{ticket.reviewedAt ? ` - ${renderDate(ticket.reviewedAt)}` : ''}</div> : null}
                                </div>
                            ))}
                            {!appealState.tickets.length ? <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">{tr('Тикетов апелляций пока нет.', 'No appeal tickets yet.')}</div> : null}
                        </div>
                    </SectionCard>
                </div>
            ) : null}

            {tab === 'retention' ? (
                <div className="space-y-6">
                    <SectionCard title={tr('Политики хранения', 'Retention policies')} subtitle={tr('Управляйте тем, как долго некритичные moderation payload-данные хранятся в базе.', 'Control how long non-critical moderation payloads stay in the database.')}>
                        <div className="space-y-4">
                            {config.retentionPolicies.map((policy, index) => (
                                <div key={policy.category} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.8fr_0.7fr_auto]">
                                        <div>
                                            <div className="text-sm font-semibold text-[var(--text-primary)]">{locale === 'ru' ? (RETENTION_LABELS_RU[policy.category] ?? policy.category) : (RETENTION_LABELS[policy.category] ?? policy.category)}</div>
                                            <div className="mt-1 text-xs text-[var(--text-muted)]">{policy.category}</div>
                                        </div>
                                        <SelectField
                                            label={tr('Стратегия', 'Strategy')}
                                            value={policy.strategy}
                                            options={RETENTION_STRATEGIES.map((strategy) => ({ id: strategy, name: strategy }))}
                                            onChange={(value) => setConfig((current) => ({ ...current, retentionPolicies: updateAtIndex(current.retentionPolicies, index, { ...policy, strategy: value }) }))}
                                        />
                                        <TextField
                                            label={tr('TTL в днях', 'TTL days')}
                                            type="number"
                                            value={policy.ttlDays === null ? '' : String(policy.ttlDays)}
                                            placeholder="30"
                                            onChange={(value) => setConfig((current) => ({ ...current, retentionPolicies: updateAtIndex(current.retentionPolicies, index, { ...policy, ttlDays: value ? Number(value) : null }) }))}
                                        />
                                        <div className="flex items-end">
                                            <ToggleField
                                                label={tr('Включено', 'Enabled')}
                                                checked={policy.enabled}
                                                onChange={(checked) => setConfig((current) => ({ ...current, retentionPolicies: updateAtIndex(current.retentionPolicies, index, { ...policy, enabled: checked }) }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            ) : null}

            {tab === 'analytics' ? (
                <div className="space-y-6">
                    <SectionCard title={tr('Аналитика модераторов', 'Moderator analytics')} subtitle={tr('Операционные метрики по ручной модерации, AI review и апелляциям.', 'Operational metrics for manual moderation, AI review and appeals.')}>
                        <div className="mb-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                            <TextField
                                label={tr('Окно в днях', 'Window days')}
                                type="number"
                                value={analyticsWindowDays}
                                placeholder="30"
                                onChange={setAnalyticsWindowDays}
                            />
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <StatCard title={tr('Действия модераторов', 'Moderator actions')} value={analyticsState.summary.totalModeratorActions} icon={<ShieldCheck size={20} />} />
                                <StatCard title={tr('AI-проверки', 'AI reviews')} value={analyticsState.summary.totalAiReviews} icon={<WarningCircle size={20} />} />
                                <StatCard title={tr('Проверки апелляций', 'Appeal reviews')} value={analyticsState.summary.totalAppealReviews} icon={<ClockCounterClockwise size={20} />} />
                                <StatCard title={tr('Активные модераторы', 'Active moderators')} value={analyticsState.summary.uniqueModerators} icon={<SlidersHorizontal size={20} />} />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {analyticsState.moderators.map((row) => (
                                <div key={row.moderatorId} className="rounded-2xl border border-[var(--border-subtle)] bg-black/10 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-[var(--text-primary)]">{row.moderatorId}</div>
                                        <div className="text-xs text-[var(--text-muted)]">{analyticsState.windowDays} {tr('дн. окно', 'day window')}</div>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-3 xl:grid-cols-6">
                                        <div>{tr('Действия', 'Actions')}: {row.totalActions}</div>
                                        <div>{tr('Варны', 'Warns')}: {row.warns}</div>
                                        <div>{tr('Тайм-ауты', 'Timeouts')}: {row.timeouts}</div>
                                        <div>{tr('Баны', 'Bans')}: {row.bans}</div>
                                        <div>{tr('Муты', 'Mutes')}: {row.mutes}</div>
                                        <div>{tr('Кики', 'Kicks')}: {row.kicks}</div>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-3 xl:grid-cols-6">
                                        <div>{tr('Отмены', 'Reversals')}: {row.reversals}</div>
                                        <div>{tr('AI-проверки', 'AI reviews')}: {row.aiReviews}</div>
                                        <div>{tr('Ложные срабатывания', 'False positives')}: {row.falsePositives}</div>
                                        <div>{tr('Доля FP', 'FP rate')}: {row.falsePositiveRate}%</div>
                                        <div>{tr('Апелляций проверено', 'Appeals reviewed')}: {row.appealsReviewed}</div>
                                        <div>{tr('Принято', 'Accepted')}: {row.acceptedAppeals}</div>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-3">
                                        <div>{tr('Отклоненные апелляции', 'Rejected appeals')}: {row.rejectedAppeals}</div>
                                        <div>{tr('Среднее AI review', 'Avg AI review')}: {row.avgAiReviewMinutes === null ? tr('н/д', 'n/a') : `${row.avgAiReviewMinutes.toFixed(1)} ${tr('мин', 'min')}`}</div>
                                        <div>{tr('Среднее review апелляций', 'Avg appeal review')}: {row.avgAppealReviewHours === null ? tr('н/д', 'n/a') : `${row.avgAppealReviewHours.toFixed(1)} ${tr('ч', 'h')}`}</div>
                                    </div>
                                </div>
                            ))}
                            {!analyticsState.moderators.length ? <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">{tr('Для этого окна нет данных по аналитике модераторов.', 'No moderator analytics data for this window.')}</div> : null}
                        </div>
                    </SectionCard>
                </div>
            ) : null}
        </div>
    );
}
