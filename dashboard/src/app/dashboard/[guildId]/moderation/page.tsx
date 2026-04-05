'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, WarningCircle } from '@phosphor-icons/react';

import { useGuildLocale } from '@/lib/i18n';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';

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

const STRINGS = {
    en: {
        loading: 'Loading moderation systems...',
        failed: 'Failed to connect to backend API.',
        saved: 'Moderation settings saved successfully.',
        savedWithSyncWarning: 'Settings saved, but hiding commands in Discord requires Discord OAuth login.',
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
        savedWithSyncWarning: 'Настройки сохранены, но скрытие команд в Discord требует входа через Discord OAuth.',
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
                body: JSON.stringify({
                    ...buildModerationSavePayload(config),
                    guildChannels: config.channels,
                    syncDiscordCommandPermissions: true,
                }),
            });

            if (!response.ok) {
                const saveError = await response.json().catch(() => null);
                const message =
                    (saveError && typeof saveError.error === 'string' && saveError.error) ||
                    text.saveFailed;
                throw new Error(message);
            }

            const result = await response.json().catch(() => null);
            setNotice(result?.syncWarning === 'discord_oauth_required' ? text.savedWithSyncWarning : text.saved);
            setTimeout(() => setNotice(null), 4000);
            void loadData(false);
        } catch (saveError) {
            console.error(saveError);
            setError(saveError instanceof Error && saveError.message ? saveError.message : text.saveFailed);
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
                <SegmentedTabs active={currentTab} onChange={(value) => handleTabChange(value as typeof TAB_KEYS[number])} labels={text.tabs} tabs={TAB_KEYS} />
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
