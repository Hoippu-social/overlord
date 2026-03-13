'use client';

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowClockwise, ShieldCheck, WarningCircle } from '@phosphor-icons/react';

import { useGuildLocale } from '@/lib/i18n';
import { SegmentedTabs } from '@/components/moderation/ui';

import { 
    ConfigState, CasesState, AiIncidentState, 
    AppealTicketState, AnalyticsState, CommandRule
} from '@/app/dashboard/[guildId]/moderation/types';
import { 
    emptyConfig, emptyCases, emptyIncidents, 
    emptyAppeals, emptyAnalytics, createDefaultCommandRules, getDefaultCommandRule
} from '@/app/dashboard/[guildId]/moderation/constants';

import { OverviewTab } from '@/components/moderation/tabs/OverviewTab';
import { AccessControlTab } from '@/components/moderation/tabs/AccessControlTab';
import { AutoModTab } from '@/components/moderation/tabs/AutoModTab';
import { AiModerationTab } from '@/components/moderation/tabs/AiModerationTab';
import { AppealsTab } from '@/components/moderation/tabs/AppealsTab';
import { RetentionTab } from '@/components/moderation/tabs/RetentionTab';
import { AnalyticsTab } from '@/components/moderation/tabs/AnalyticsTab';

const STRINGS = {
    en: {
        title: 'Moderation',
        subtitle: 'Configure access, automod, AI review and view case history.',
        loading: 'Loading moderation systems...',
        failed: 'Failed to connect to backend API.',
        saved: 'Moderation settings saved successfully.',
        saveFailed: 'Failed to save. Check console for details.',
        reload: 'Refresh',
        save: 'Save Changes',
        saving: 'Saving...',
        reset: 'Reset Defaults',
        tabs: {
            overview: 'Overview',
            access: 'Access Control',
            automod: 'AutoMod',
            ai: 'AI Review',
            appeals: 'Appeals',
            retention: 'Retention',
            analytics: 'Analytics',
        },
    },
    ru: {
        title: 'Модерация',
        subtitle: 'Настройка доступа, автомодерации, ИИ-проверки и истории кейсов.',
        loading: 'Загрузка систем модерации...',
        failed: 'Не удалось подключиться к API бекенда.',
        saved: 'Настройки модерации успешно сохранены.',
        saveFailed: 'Ошибка сохранения. Проверьте консоль.',
        reload: 'Обновить',
        save: 'Сохранить изменения',
        saving: 'Сохранение...',
        reset: 'Сбросить изменения',
        tabs: {
            overview: 'Обзор',
            access: 'Доступ',
            automod: 'Автомод',
            ai: 'AI-проверка',
            appeals: 'Апелляции',
            retention: 'Хранение',
            analytics: 'Аналитика',
        },
    },
} as const;

const TAB_KEYS = ['overview', 'access', 'automod', 'ai', 'appeals', 'retention', 'analytics'] as const;

const normalizeCommandRules = (rules: any, grants: any): CommandRule[] => {
    const defaults = createDefaultCommandRules();

    if (Array.isArray(rules)) {
        const saved = rules.map((rule: any) => ({
            commandKey: typeof rule?.commandKey === 'string' ? rule.commandKey : '',
            enabled: rule?.enabled !== false,
            roleMode: rule?.roleMode === 'WHITELIST' ? ('WHITELIST' as const) : ('BLACKLIST' as const),
            roleIds: Array.isArray(rule?.roleIds) ? rule.roleIds.filter((item: unknown): item is string => typeof item === 'string') : [],
            channelMode: rule?.channelMode === 'WHITELIST' ? ('WHITELIST' as const) : ('BLACKLIST' as const),
            channelIds: Array.isArray(rule?.channelIds) ? rule.channelIds.filter((item: unknown): item is string => typeof item === 'string') : [],
            requiredAccessLevel: typeof rule?.requiredAccessLevel === 'number' ? Number(rule.requiredAccessLevel) : undefined,
        })).filter((rule) => rule.commandKey);

        const savedMap = new Map(saved.map((rule) => [rule.commandKey, rule]));
        return defaults.map((defaultRule) => {
            const savedRule = savedMap.get(defaultRule.commandKey);
            if (!savedRule) {
                return defaultRule;
            }

            return {
                ...defaultRule,
                ...savedRule,
                requiredAccessLevel:
                    typeof savedRule.requiredAccessLevel === 'number'
                        ? savedRule.requiredAccessLevel
                        : defaultRule.requiredAccessLevel,
            };
        });
    }

    if (!Array.isArray(grants)) {
        return defaults;
    }

    const byCommand = new Map<string, CommandRule>();

    for (const grant of grants) {
        if (grant?.scopeType !== 'COMMAND' || typeof grant?.scopeKey !== 'string' || typeof grant?.roleId !== 'string' || !grant.roleId) {
            continue;
        }

        const current: CommandRule = byCommand.get(grant.scopeKey) ?? {
            commandKey: grant.scopeKey,
            enabled: true,
            roleMode: grant.effect === 'ALLOW' ? 'WHITELIST' : 'BLACKLIST',
            roleIds: [],
            channelMode: 'BLACKLIST' as const,
            channelIds: [],
            requiredAccessLevel: getDefaultCommandRule(grant.scopeKey).requiredAccessLevel,
        };

        current.enabled = true;
        current.roleMode = grant.effect === 'ALLOW' ? 'WHITELIST' : 'BLACKLIST';
        if (!current.roleIds.includes(grant.roleId)) {
            current.roleIds.push(grant.roleId);
        }
        byCommand.set(grant.scopeKey, current);
    }

    const legacyMap = new Map(Array.from(byCommand.values()).map((rule) => [rule.commandKey, rule]));
    return defaults.map((defaultRule) => legacyMap.get(defaultRule.commandKey) ?? defaultRule);
};

export default function ModerationPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { locale } = useGuildLocale(guildId);
    const text = STRINGS[locale];

    const currentTab = (searchParams.get('tab') || 'overview') as typeof TAB_KEYS[number];
    
    // Global UI states
    const [loading, setLoading] = useState(true);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // Business Logic states
    const [config, setConfig] = useState<ConfigState>(emptyConfig());
    const initialConfigRef = useRef<ConfigState | null>(null);

    const [casesState, setCasesState] = useState<CasesState>(emptyCases());
    const [incidentState, setIncidentState] = useState<AiIncidentState>(emptyIncidents());
    const [appealState, setAppealState] = useState<AppealTicketState>(emptyAppeals());
    const [analyticsState, setAnalyticsState] = useState<AnalyticsState>(emptyAnalytics());

    // Overview Tab local UI/URL states
    const rawSelectedCaseId = searchParams.get('case');
    const [selectedCaseId, setSelectedCaseId] = useState<number | null>(rawSelectedCaseId ? parseInt(rawSelectedCaseId, 10) : null);
    const [caseFilter, setCaseFilter] = useState('');
    const [caseNumberFilter, setCaseNumberFilter] = useState('');
    const [caseStatusFilter, setCaseStatusFilter] = useState('');
    const [caseActionFilter, setCaseActionFilter] = useState('');
    
    // Auto sync URL param when user clicks a case
    useEffect(() => {
        if (selectedCaseId !== null) {
            const currentObj = new URL(window.location.href);
            currentObj.searchParams.set('case', String(selectedCaseId));
            window.history.replaceState({}, '', currentObj.toString());
        }
    }, [selectedCaseId]);

    // Local filter state for analytics endpoint
    const [analyticsWindowDays, setAnalyticsWindowDays] = useState('30');

    const loadData = useCallback(async (showOverlay = true) => {
        if (showOverlay) setLoading(true);
        setError(null);

        try {
            const [configRes, casesRes, incidentsRes, appealsRes, analyticsRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/moderation/config`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/cases?limit=50`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/ai/incidents?limit=25`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/appeals/tickets?limit=25`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/analytics?windowDays=${encodeURIComponent(analyticsWindowDays)}`, { cache: 'no-store' })
            ]);

            if (!configRes.ok || !casesRes.ok || !incidentsRes.ok || !appealsRes.ok || !analyticsRes.ok) {
                throw new Error(text.failed);
            }

            const cData = await configRes.json();
            const loadedConfig: ConfigState = {
                roles: cData.roles ?? [],
                channels: cData.channels ?? [],
                moderationConfig: {
                    muteRoleId: cData.moderationConfig?.muteRoleId ?? '',
                    ignoredChannels: cData.moderationConfig?.ignoredChannels ?? [],
                    ignoredRoles: cData.moderationConfig?.ignoredRoles ?? [],
                    ignoredUsers: cData.moderationConfig?.ignoredUsers ?? [],
                    commandOnlyChannels: cData.moderationConfig?.commandOnlyChannels ?? [],
                },
                roleBindings: (cData.roleBindings ?? []).map((b: any, i: number) => ({
                    roleId: b.roleId ?? '',
                    title: b.title ?? 'Moderator',
                    accessLevel: Number(b.accessLevel ?? 50),
                    enabled: b.enabled !== false,
                    sortOrder: Number(b.sortOrder ?? i),
                })),
                commandGrants: (cData.commandGrants ?? []).map((g: any) => ({
                    roleId: g.roleId ?? '',
                    scopeType: g.scopeType === 'GROUP' ? 'GROUP' : 'COMMAND',
                    scopeKey: g.scopeKey ?? '',
                    effect: g.effect === 'DENY' ? 'DENY' : 'ALLOW',
                })),
                commandRules: normalizeCommandRules(cData.commandRules, cData.commandGrants),
                automodRules: (cData.automodRules ?? []).map((r: any) => ({
                    ruleKey: r.ruleKey,
                    enabled: r.enabled === true,
                    configText: r.config ? JSON.stringify(r.config, null, 2) : '',
                })),
                customRules: (cData.customRules ?? []).map((cr: any) => ({
                    name: cr.name ?? '',
                    ruleType: cr.ruleType ?? 'regex',
                    pattern: cr.pattern ?? '',
                    enabled: cr.enabled !== false,
                    action: cr.action ?? 'DELETE',
                    strikeWeight: Number(cr.strikeWeight ?? 1),
                    notes: cr.notes ?? '',
                })),
                sanctionSteps: (cData.sanctionSteps ?? []).map((s: any, i: number) => ({
                    triggerStrikeCount: Number(s.triggerStrikeCount ?? i + 1),
                    actionType: s.actionType ?? 'TIMEOUT',
                    durationMinutes: s.durationMinutes === null ? null : Number(s.durationMinutes),
                    enabled: s.enabled !== false,
                    sortOrder: Number(s.sortOrder ?? i),
                })),
                aiConfig: {
                    enabled: cData.aiConfig?.enabled === true,
                    provider: cData.aiConfig?.provider ?? '',
                    model: cData.aiConfig?.model ?? '',
                    defaultThreshold: Number(cData.aiConfig?.defaultThreshold ?? 80),
                    scanEdits: cData.aiConfig?.scanEdits !== false,
                    includedChannels: cData.aiConfig?.includedChannels ?? [],
                    excludedChannels: cData.aiConfig?.excludedChannels ?? [],
                    exemptRoles: cData.aiConfig?.exemptRoles ?? [],
                    exemptUsers: cData.aiConfig?.exemptUsers ?? [],
                    customPolicyPrompt: cData.aiConfig?.customPolicyPrompt ?? '',
                },
                aiCategories: (cData.aiCategories ?? []).map((c: any, i: number) => ({
                    category: c.category ?? `category_${i}`,
                    enabled: c.enabled === true,
                    threshold: Number(c.threshold ?? 80),
                    sortOrder: Number(c.sortOrder ?? i),
                })),
                appealConfig: {
                    enabled: cData.appealConfig?.enabled === true,
                    appealChannelId: cData.appealConfig?.appealChannelId ?? '',
                    pardonLogChannelId: cData.appealConfig?.pardonLogChannelId ?? '',
                    allowUserAppeals: cData.appealConfig?.allowUserAppeals !== false,
                    allowDirectPardon: cData.appealConfig?.allowDirectPardon !== false,
                },
                retentionPolicies: (cData.retentionPolicies ?? []).map((rp: any) => ({
                    category: rp.category ?? '',
                    strategy: rp.strategy ?? 'KEEP',
                    ttlDays: rp.ttlDays === null ? null : Number(rp.ttlDays),
                    enabled: rp.enabled === true,
                })),
            };

            setConfig(loadedConfig);
            initialConfigRef.current = loadedConfig;

            const csData = await casesRes.json();
            setCasesState({
                summary: csData.summary ?? emptyCases().summary,
                cases: Array.isArray(csData.cases) ? csData.cases : [],
            });

            const iData = await incidentsRes.json();
            setIncidentState({
                summary: iData.summary ?? emptyIncidents().summary,
                incidents: Array.isArray(iData.incidents) ? iData.incidents : [],
            });

            const apData = await appealsRes.json();
            setAppealState({
                summary: apData.summary ?? emptyAppeals().summary,
                tickets: Array.isArray(apData.tickets) ? apData.tickets : [],
            });

            const anData = await analyticsRes.json();
            setAnalyticsState({
                windowDays: Number(anData.windowDays ?? 30),
                summary: anData.summary ?? emptyAnalytics().summary,
                moderators: Array.isArray(anData.moderators) ? anData.moderators : [],
            });

        } catch (err) {
            console.error(err);
            setError(text.failed);
        } finally {
            if (showOverlay) setLoading(false);
            setInitialLoaded(true);
        }
    }, [guildId, text.failed, analyticsWindowDays]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const isDirty = useMemo(() => {
        if (!initialLoaded || !initialConfigRef.current) return false;
        return JSON.stringify(config) !== JSON.stringify(initialConfigRef.current);
    }, [initialLoaded, config]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            // Re-map automod rules into JSON for backend payload
            const automodRules = config.automodRules.map((r) => ({
                ruleKey: r.ruleKey,
                enabled: r.enabled,
                config: r.configText.trim() ? JSON.parse(r.configText) : null,
            }));

            const payload = { ...config, automodRules };
            
            const response = await fetch(`/api/guilds/${guildId}/moderation/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error(text.saveFailed);
            
            setNotice(text.saved);
            setTimeout(() => setNotice(null), 4000); // clear notice after 4s
            
            // Soft reload data (which also updates initialConfigRef)
            void loadData(false); 
        } catch (err) {
            console.error(err);
            setError(text.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (initialConfigRef.current) {
            setConfig(initialConfigRef.current);
        }
    };

    const handleTabChange = (tab: typeof currentTab) => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        router.push(url.toString(), { scroll: false });
    };

    // Shared translation helper for sub-components
    const tr = useCallback((ru: string, en: string) => locale === 'ru' ? ru : en, [locale]);

    if (loading) {
        return (
            <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 animate-pulse">
                <ShieldCheck size={48} className="text-[var(--color-primary-1)] opacity-50" />
                <p className="text-sm font-semibold tracking-wide text-[var(--text-muted)]">{text.loading}</p>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 pb-32 animate-fade-in relative">
            
            {/* TABS MENU ONLY (Aligned with stats/page.tsx logic of no hero content except menu) */}
            <div className="relative pt-6 px-2 md:px-6">
                <SegmentedTabs 
                    active={currentTab} 
                    onChange={(val) => handleTabChange(val as typeof currentTab)} 
                    labels={text.tabs} 
                    tabs={TAB_KEYS} 
                />
            </div>

            {/* BANNERS */}
            {notice && (
                <div className="mx-2 md:mx-6 inline-flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-400 animate-slide-down">
                    <ShieldCheck size={20} weight="fill" />
                    {notice}
                </div>
            )}
            
            {error && (
                <div className="mx-2 md:mx-6 inline-flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm font-medium text-rose-400 animate-slide-down">
                    <WarningCircle size={20} weight="fill" />
                    {error}
                </div>
            )}

            {/* TAB CONTENT RENDERING */}
            <div className="min-h-[500px] px-2 md:px-6">
                {currentTab === 'overview' && (
                    <OverviewTab 
                        casesState={casesState} 
                        locale={locale} 
                        tr={tr} 
                        caseFilter={caseFilter} setCaseFilter={setCaseFilter}
                        caseNumberFilter={caseNumberFilter} setCaseNumberFilter={setCaseNumberFilter}
                        caseStatusFilter={caseStatusFilter} setCaseStatusFilter={setCaseStatusFilter}
                        caseActionFilter={caseActionFilter} setCaseActionFilter={setCaseActionFilter}
                        selectedCaseId={selectedCaseId} setSelectedCaseId={setSelectedCaseId}
                    />
                )}
                {currentTab === 'access' && <AccessControlTab config={config} setConfig={setConfig} locale={locale} tr={tr} />}
                {currentTab === 'automod' && <AutoModTab config={config} setConfig={setConfig} locale={locale} tr={tr} />}
                {currentTab === 'ai' && <AiModerationTab config={config} setConfig={setConfig} incidentState={incidentState} locale={locale} tr={tr} />}
                {currentTab === 'appeals' && <AppealsTab config={config} setConfig={setConfig} appealState={appealState} locale={locale} tr={tr} />}
                {currentTab === 'retention' && <RetentionTab config={config} setConfig={setConfig} locale={locale} tr={tr} />}
                {currentTab === 'analytics' && <AnalyticsTab analyticsState={analyticsState} locale={locale} tr={tr} windowDays={analyticsWindowDays} setWindowDays={setAnalyticsWindowDays} />}
            </div>

            {/* Floating Action Bar (Aligned with music/page.tsx) */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex justify-center px-4 w-full max-w-lg transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isDirty ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-95 pointer-events-none'}`}>
                <div className="bg-[var(--surface-card)]/90 backdrop-blur-2xl border border-[var(--border-subtle)] shadow-2xl rounded-full p-2 flex gap-2 w-full">
                    <button
                        className="flex-1 h-12 rounded-full font-bold text-sm bg-[var(--color-primary-1)] text-black hover:bg-[var(--color-primary-2)] transition-colors flex items-center justify-center gap-2"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? text.saving : text.save}
                    </button>
                    <button
                        className="h-12 w-12 min-w-12 rounded-full bg-[var(--surface-hover)] hover:bg-[var(--border-divider)] text-[var(--text-secondary)] hover:text-white transition-colors flex items-center justify-center"
                        onClick={handleReset}
                        title={text.reset}
                    >
                        <ArrowClockwise size={20} weight="bold" />
                    </button>
                </div>
            </div>

        </div>
    );
}
