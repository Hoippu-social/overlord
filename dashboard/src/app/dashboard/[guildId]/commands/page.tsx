'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, Keyboard, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { ConfigState } from '@/app/dashboard/[guildId]/moderation/types';
import { emptyConfig } from '@/app/dashboard/[guildId]/moderation/constants';
import { buildConfigStateFromResponse, buildModerationSavePayload } from '@/app/dashboard/[guildId]/moderation/configState';
import { CommandOverridesPanel } from '@/components/commands/CommandOverridesPanel';

const STRINGS = {
    en: {
        loading: 'Loading command settings...',
        failed: 'Failed to load command settings.',
        saved: 'Command settings saved successfully.',
        saveFailed: 'Failed to save command settings.',
        save: 'Save Changes',
        saving: 'Saving...',
        reset: 'Reset Changes',
        title: 'All application commands with shared override rules and module filters.',
    },
    ru: {
        loading: 'Загрузка настроек команд...',
        failed: 'Не удалось загрузить настройки команд.',
        saved: 'Настройки команд успешно сохранены.',
        saveFailed: 'Не удалось сохранить настройки команд.',
        save: 'Сохранить изменения',
        saving: 'Сохранение...',
        reset: 'Сбросить изменения',
        title: 'Все application-команды с общими override-правилами и фильтрами по модулю.',
    },
} as const;

export default function CommandsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale } = useGuildLocale(guildId);
    const text = STRINGS[locale];

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [config, setConfig] = useState<ConfigState>(emptyConfig());
    const initialConfigRef = useRef<ConfigState | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/guilds/${guildId}/moderation/config`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(text.failed);
            }

            const data = await response.json();
            const loadedConfig = buildConfigStateFromResponse(data);
            setConfig(loadedConfig);
            initialConfigRef.current = loadedConfig;
        } catch (loadError) {
            console.error(loadError);
            setError(text.failed);
        } finally {
            setLoading(false);
        }
    }, [guildId, text.failed]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const isDirty = useMemo(() => {
        if (!initialConfigRef.current) return false;
        return JSON.stringify(config) !== JSON.stringify(initialConfigRef.current);
    }, [config]);

    const tr = useCallback((ru: string, en: string) => (locale === 'ru' ? ru : en), [locale]);

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
            await loadData();
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

    if (loading) {
        return (
            <div className="flex h-[400px] w-full animate-pulse flex-col items-center justify-center gap-4">
                <Keyboard size={48} className="text-[var(--color-primary-1)] opacity-50" />
                <p className="text-sm font-semibold tracking-wide text-[var(--text-muted)]">{text.loading}</p>
            </div>
        );
    }

    return (
        <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-6 animate-fade-in pb-32">
            <div className="px-2 pt-6 md:px-6">
                <div className="rounded-[24px] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                            <Keyboard size={24} weight="duotone" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-white/90">{tr('Команды', 'Commands')}</h2>
                            <p className="mt-1 text-sm text-white/50">{text.title}</p>
                        </div>
                    </div>
                </div>
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

            <div className="px-2 md:px-6">
                <CommandOverridesPanel
                    config={config}
                    setConfig={setConfig}
                    locale={locale}
                    tr={tr}
                    showModuleFilter
                    title={tr('Команды', 'Commands')}
                    subtitle={tr('Настройки ниже применяются ко всем application-командам и сохраняются в те же commandRules, что и во вкладке модерации.', 'These settings apply to all application commands and are saved into the same commandRules used by the moderation page.')}
                />
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
