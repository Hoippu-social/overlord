'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Coins,
    Wallet,
    TrendUp,
    Storefront,
    UsersThree,
    Trophy,
    Sparkle,
    Scroll,
    Gear,
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';
import { getEconomyCopy } from '@/lib/economy/i18n';
import { loadEconomyWorkspace } from '@/lib/economy/api';
import { WORKSPACE_TAB_KEYS, type EconomyWorkspaceData, type WorkspaceTab } from '@/lib/economy/types';
import { ErrorState, LoadingBlock } from './primitives';
import { OverviewPanel } from './OverviewPanel';
import { WalletsPanel } from './WalletsPanel';
import { EarnSourcesPanel } from './EarnSourcesPanel';
import { ShopPanel } from './ShopPanel';
import { RoleRulesPanel } from './RoleRulesPanel';
import { QuestsPanel } from './QuestsPanel';
import { EventsPanel } from './EventsPanel';
import { LedgerPanel } from './LedgerPanel';
import { ConfigPanel } from './ConfigPanel';

export function EconomyWorkspace({ guildId }: { guildId: string }) {
    const { locale } = useGuildLocale(guildId);
    const t = getEconomyCopy(locale);

    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [data, setData] = useState<EconomyWorkspaceData | null>(null);
    const [tab, setTab] = useState<WorkspaceTab>('overview');
    const [reloadKey, setReloadKey] = useState(0);

    const reload = useCallback(() => {
        setReloadKey((key) => key + 1);
    }, []);

    const retry = useCallback(() => {
        setStatus('loading');
        setReloadKey((key) => key + 1);
    }, []);

    useEffect(() => {
        if (!guildId) return;
        let cancelled = false;
        (async () => {
            try {
                const next = await loadEconomyWorkspace(guildId);
                if (!cancelled) {
                    setData(next);
                    setStatus('ready');
                }
            } catch {
                if (!cancelled) setStatus('error');
            }
        })();
        return () => { cancelled = true; };
    }, [guildId, reloadKey]);

    const tabLabels = useMemo(() => t.tabs, [t]);

    const tabIcons: Record<WorkspaceTab, React.ReactNode> = {
        overview: <Coins size={16} weight="duotone" />,
        wallets: <Wallet size={16} weight="duotone" />,
        earn: <TrendUp size={16} weight="duotone" />,
        shop: <Storefront size={16} weight="duotone" />,
        roles: <UsersThree size={16} weight="duotone" />,
        quests: <Trophy size={16} weight="duotone" />,
        events: <Sparkle size={16} weight="duotone" />,
        ledger: <Scroll size={16} weight="duotone" />,
        config: <Gear size={16} weight="duotone" />,
    };

    return (
        <div className="mx-auto w-full max-w-[1320px] space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                    <Coins size={26} weight="duotone" />
                </div>
                <div className="min-w-0">
                    <h1 className="max-w-full font-akony text-lg font-black leading-tight tracking-tight text-white sm:text-2xl">{t.workspaceTitle}</h1>
                    <p className="mt-0.5 max-w-2xl text-sm text-[var(--text-secondary)]">{t.subtitle}</p>
                </div>
            </div>

            {/* Disabled banner */}
            {status === 'ready' && data && data.config.enabled === false && (
                <div className="rounded-2xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-3 text-sm font-semibold text-[var(--color-warning)]">
                    {t.disabledBanner}
                </div>
            )}

            {/* Tabs */}
            <SegmentedTabs
                active={tab}
                onChange={(value) => setTab(value as WorkspaceTab)}
                tabs={WORKSPACE_TAB_KEYS}
                labels={tabLabels}
                icons={tabIcons}
                density="compact"
                dataTour="economy-tabs"
            />

            {/* Body */}
            {status === 'loading' && <LoadingBlock label={t.loading} />}
            {status === 'error' && <ErrorState label={t.error} retryLabel={t.retry} onRetry={retry} />}
            {status === 'ready' && data && (
                <>
                    {tab === 'overview' && <div data-tour="economy-overview"><OverviewPanel guildId={guildId} data={data} locale={locale} /></div>}
                    {tab === 'wallets' && <div data-tour="economy-wallets"><WalletsPanel guildId={guildId} data={data} locale={locale} /></div>}
                    {tab === 'earn' && <div data-tour="economy-earn"><EarnSourcesPanel guildId={guildId} data={data} locale={locale} onSaved={reload} /></div>}
                    {tab === 'shop' && <div data-tour="economy-shop"><ShopPanel guildId={guildId} data={data} locale={locale} onSaved={reload} /></div>}
                    {tab === 'roles' && <div data-tour="economy-roles"><RoleRulesPanel guildId={guildId} data={data} locale={locale} onSaved={reload} /></div>}
                    {tab === 'quests' && <div data-tour="economy-quests"><QuestsPanel guildId={guildId} data={data} locale={locale} onSaved={reload} /></div>}
                    {tab === 'events' && <div data-tour="economy-events"><EventsPanel guildId={guildId} data={data} locale={locale} onSaved={reload} /></div>}
                    {tab === 'ledger' && <div data-tour="economy-ledger"><LedgerPanel guildId={guildId} data={data} locale={locale} /></div>}
                    {tab === 'config' && <div data-tour="economy-config"><ConfigPanel guildId={guildId} data={data} locale={locale} onSaved={reload} /></div>}
                </>
            )}
        </div>
    );
}
