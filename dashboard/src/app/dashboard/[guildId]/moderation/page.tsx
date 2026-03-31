'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, WarningCircle } from '@phosphor-icons/react';

import { useGuildLocale } from '@/lib/i18n';

import { AiIncidentState, AnalyticsState, AppealTicketState, CasesState, ConfigState } from '@/app/dashboard/[guildId]/moderation/types';
import { emptyAnalytics, emptyAppeals, emptyCases, emptyConfig, emptyIncidents } from '@/app/dashboard/[guildId]/moderation/constants';
import { buildConfigStateFromResponse, buildModerationSavePayload } from '@/app/dashboard/[guildId]/moderation/configState';

import { OverviewTab } from '@/components/moderation/tabs/OverviewTab';
import { AccessControlTab } from '@/components/moderation/tabs/AccessControlTab';
import { AutoModTab } from '@/components/moderation/tabs/AutoModTab';
import { AiModerationTab } from '@/components/moderation/tabs/AiModerationTab';
import { AppealsTab } from '@/components/moderation/tabs/AppealsTab';
import { RetentionTab } from '@/components/moderation/tabs/RetentionTab';
import { AnalyticsTab } from '@/components/moderation/tabs/AnalyticsTab';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';

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
        loading: 'Loading moderation systems...',
        failed: 'Failed to connect to backend API.',
        saved: 'Moderation settings saved successfully.',
        saveFailed: 'Failed to save. Check console for details.',
        save: 'Save Changes',
        saving: 'Saving...',
        reset: 'Reset Defaults',
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
        loading: 'Загрузка систем модерации...',
        failed: 'Не удалось подключиться к API бекенда.',
        saved: 'Настройки модерации успешно сохранены.',
        saveFailed: 'Ошибка сохранения. Проверьте консоль.',
        save: 'Сохранить изменения',
        saving: 'Сохранение...',
        reset: 'Сбросить изменения',
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

export default function ModerationPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];
    const tr = (ru: string, en: string) => (locale === 'ru' ? ru : en);
    const renderDate = (value?: string | null) => formatDate(value, tr('Без срока', 'No expiry'));

    const currentTab = (searchParams.get('tab') || 'overview') as typeof TAB_KEYS[number];
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [config, setConfig] = useState<ConfigState>(emptyConfig());
    const initialConfigRef = useRef<ConfigState | null>(null);

    const [casesState, setCasesState] = useState<CasesState>(emptyCases());
    const [incidentState, setIncidentState] = useState<AiIncidentState>(emptyIncidents());
    const [appealState, setAppealState] = useState<AppealTicketState>(emptyAppeals());
    const [analyticsState, setAnalyticsState] = useState<AnalyticsState>(emptyAnalytics());

    const rawSelectedCaseId = searchParams.get('case');
    const [selectedCaseId, setSelectedCaseId] = useState<number | null>(rawSelectedCaseId ? parseInt(rawSelectedCaseId, 10) : null);
    const [caseFilter, setCaseFilter] = useState('');
    const [caseNumberFilter, setCaseNumberFilter] = useState('');
    const [caseStatusFilter, setCaseStatusFilter] = useState('');
    const [caseActionFilter, setCaseActionFilter] = useState('');
    const [analyticsWindowDays, setAnalyticsWindowDays] = useState('30');

    useEffect(() => {
        if (selectedCaseId !== null) {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('case', String(selectedCaseId));
            window.history.replaceState({}, '', currentUrl.toString());
        }
    }, [selectedCaseId]);

    const loadData = useCallback(async (showOverlay = true) => {
        if (showOverlay) setLoading(true);
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
                fetch(`/api/guilds/${guildId}/moderation/appeals/tickets?limit=25`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/analytics?windowDays=${encodeURIComponent(analyticsWindowDays)}`, { cache: 'no-store' }),
            ]);

            if (!configRes.ok || !casesRes.ok || !incidentsRes.ok || !appealsRes.ok || !analyticsRes.ok) {
                throw new Error(text.failed);
            }

            const configData = await configRes.json();
            const loadedConfig = buildConfigStateFromResponse(configData);

            setConfig(loadedConfig);
            initialConfigRef.current = loadedConfig;

            const casesData = await casesRes.json();
            setCasesState({
                summary: casesData.summary ?? emptyCases().summary,
                cases: Array.isArray(casesData.cases) ? casesData.cases : [],
            });

            const incidentsData = await incidentsRes.json();
            setIncidentState({
                summary: incidentsData.summary ?? emptyIncidents().summary,
                incidents: Array.isArray(incidentsData.incidents) ? incidentsData.incidents : [],
            });

            const appealsData = await appealsRes.json();
            setAppealState({
                summary: appealsData.summary ?? emptyAppeals().summary,
                tickets: Array.isArray(appealsData.tickets) ? appealsData.tickets : [],
            });

            const analyticsData = await analyticsRes.json();
            setAnalyticsState({
                windowDays: Number(analyticsData.windowDays ?? 30),
                summary: analyticsData.summary ?? emptyAnalytics().summary,
                moderators: Array.isArray(analyticsData.moderators) ? analyticsData.moderators : [],
            });
        } catch (loadError) {
            console.error(loadError);
            setError(text.failed);
        } finally {
            if (showSpinner) {
                setLoading(false);
            }
        }
    }, [analyticsWindowDays, guildId, text.failed]);

    useEffect(() => {
        void load();
    }, [guildId, caseFilter, caseNumberFilter, caseStatusFilter, caseActionFilter, caseTargetFilter, caseActorFilter, caseSourceFilter, appealStatusFilter, analyticsWindowDays]);

    const isDirty = useMemo(() => {
        if (!initialLoaded || !initialConfigRef.current) return false;
        return JSON.stringify(config) !== JSON.stringify(initialConfigRef.current);
    }, [config, initialLoaded]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setNotice(null);

        try {
            const response = await fetch(`/api/guilds/${guildId}/moderation/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildModerationSavePayload(config)),
            });

            if (!response.ok) {
                throw new Error(text.saveFailed);
            }

            setNotice(text.saved);
            setTimeout(() => setNotice(null), 4000);
            void loadData(false);
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

    const handleTabChange = (tab: typeof currentTab) => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        router.push(url.toString(), { scroll: false });
    };

    const tr = useCallback((ru: string, en: string) => (locale === 'ru' ? ru : en), [locale]);

    if (loading) {
        return (
            <div className="flex h-[400px] w-full animate-pulse flex-col items-center justify-center gap-4">
                <ShieldCheck size={48} className="text-[var(--color-primary-1)] opacity-50" />
                <p className="text-sm font-semibold tracking-wide text-[var(--text-muted)]">{text.loading}</p>
            </div>
        );
    }

    return (
        <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-6 animate-fade-in pb-32">
            <div className="relative px-2 pt-6 md:px-6">
                <SegmentedTabs active={currentTab} onChange={(value) => handleTabChange(value as typeof currentTab)} labels={text.tabs} tabs={TAB_KEYS} />
            </div>

            {notice ? (
                <div className="mx-2 inline-flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-400 animate-slide-down md:mx-6">
                    <ShieldCheck size={20} weight="fill" />
                    {notice}
                </div>
            ) : null}

            {error ? (
                <div className="mx-2 inline-flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm font-medium text-rose-400 animate-slide-down md:mx-6">
                    <WarningCircle size={20} weight="fill" />
                    {error}
                </div>
            ) : null}

            <div className="min-h-[500px] px-2 md:px-6">
                {currentTab === 'overview' ? (
                    <OverviewTab
                        casesState={casesState}
                        locale={locale}
                        tr={tr}
                        caseFilter={caseFilter}
                        setCaseFilter={setCaseFilter}
                        caseNumberFilter={caseNumberFilter}
                        setCaseNumberFilter={setCaseNumberFilter}
                        caseStatusFilter={caseStatusFilter}
                        setCaseStatusFilter={setCaseStatusFilter}
                        caseActionFilter={caseActionFilter}
                        setCaseActionFilter={setCaseActionFilter}
                        selectedCaseId={selectedCaseId}
                        setSelectedCaseId={setSelectedCaseId}
                    />
                ) : null}
                {currentTab === 'access' ? <AccessControlTab config={config} setConfig={setConfig} locale={locale} tr={tr} /> : null}
                {currentTab === 'automod' ? <AutoModTab config={config} setConfig={setConfig} locale={locale} tr={tr} /> : null}
                {currentTab === 'ai' ? <AiModerationTab config={config} setConfig={setConfig} incidentState={incidentState} locale={locale} tr={tr} /> : null}
                {currentTab === 'appeals' ? <AppealsTab config={config} setConfig={setConfig} appealState={appealState} locale={locale} tr={tr} /> : null}
                {currentTab === 'retention' ? <RetentionTab config={config} setConfig={setConfig} locale={locale} tr={tr} /> : null}
                {currentTab === 'analytics' ? <AnalyticsTab guildId={guildId} analyticsState={analyticsState} locale={locale} tr={tr} windowDays={analyticsWindowDays} setWindowDays={setAnalyticsWindowDays} /> : null}
            </div>

            <FloatingSaveBar
                visible={isDirty}
                saving={saving}
                saveLabel={text.save}
                savingLabel={text.saving}
                resetLabel={text.reset}
                onSave={handleSave}
                onReset={handleReset}
            />
        </div>
    );
}
