'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowClockwise, ShieldCheck, WarningCircle } from '@phosphor-icons/react';

import { useGuildLocale } from '@/lib/i18n';
import { SegmentedTabs } from '@/components/moderation/ui';

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

const STRINGS = {
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
            access: 'Access Control',
            automod: 'AutoMod',
            ai: 'AI Review',
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
            ai: 'AI-проверка',
            appeals: 'Апелляции',
            retention: 'Хранение',
            analytics: 'Аналитика',
        },
    },
} as const;

const TAB_KEYS = ['overview', 'access', 'automod', 'ai', 'appeals', 'retention', 'analytics'] as const;

export default function ModerationPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { locale } = useGuildLocale(guildId);
    const text = STRINGS[locale];

    const currentTab = (searchParams.get('tab') || 'overview') as typeof TAB_KEYS[number];
    const [loading, setLoading] = useState(true);
    const [initialLoaded, setInitialLoaded] = useState(false);
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
            const [configRes, casesRes, incidentsRes, appealsRes, analyticsRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/moderation/config`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/moderation/cases?limit=50`, { cache: 'no-store' }),
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
            if (showOverlay) setLoading(false);
            setInitialLoaded(true);
        }
    }, [analyticsWindowDays, guildId, text.failed]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

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

            <div className={`fixed bottom-8 left-1/2 z-50 flex w-full max-w-lg -translate-x-1/2 justify-center px-4 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isDirty ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-24 scale-95 opacity-0'}`}>
                <div className="flex w-full gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)]/90 p-2 shadow-2xl backdrop-blur-2xl">
                    <button
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-primary-1)] text-sm font-bold text-black transition-colors hover:bg-[var(--color-primary-2)]"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? text.saving : text.save}
                    </button>
                    <button
                        className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-divider)] hover:text-white"
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
