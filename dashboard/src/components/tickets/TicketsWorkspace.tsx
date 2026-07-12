'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Ticket as TicketGlyph,
    Tray,
    Stack,
    Flag,
    BellRinging,
    ShieldCheck,
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import {
    loadTicketDetail,
    loadTicketsWorkspace,
    runTicketAction,
    saveTicketCategories,
    saveTicketNotifications,
    saveTicketPermissions,
    saveTicketPriorities,
} from '@/lib/tickets/api';
import type { NotificationRule, PermissionAssignment, PriorityDef, QuickFilterKey, TicketCategoryDef, TicketsWorkspaceData } from '@/lib/tickets/types';
import { ErrorState, LoadingBlock } from './primitives';
import { OverviewPanel } from './OverviewPanel';
import { InboxPanel } from './InboxPanel';
import { TicketDetailDrawer } from './TicketDetailDrawer';
import { CategoriesPanel } from './CategoriesPanel';
import { PrioritiesPanel } from './PrioritiesPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { AccessPanel } from './AccessPanel';

type WorkspaceTab = 'overview' | 'inbox' | 'categories' | 'priorities' | 'notifications' | 'access';
const TAB_KEYS: WorkspaceTab[] = ['overview', 'inbox', 'categories', 'priorities', 'notifications', 'access'];

export function TicketsWorkspace() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const t = getTicketsCopy(locale);

    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [data, setData] = useState<TicketsWorkspaceData | null>(null);
    const [tab, setTab] = useState<WorkspaceTab>('overview');
    const [inboxFilter, setInboxFilter] = useState<QuickFilterKey | null>(null);
    const [openTicketId, setOpenTicketId] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [hydratedTicketIds, setHydratedTicketIds] = useState<Set<string>>(() => new Set());

    const reloadWorkspace = useCallback(async () => {
        const next = await loadTicketsWorkspace(guildId);
        setData(next);
        setStatus('ready');
        setHydratedTicketIds(new Set());
    }, [guildId]);

    useEffect(() => {
        if (!guildId) return;
        let cancelled = false;
        (async () => {
            try {
                const next = await loadTicketsWorkspace(guildId);
                if (!cancelled) {
                    setData(next);
                    setStatus('ready');
                    setHydratedTicketIds(new Set());
                }
            } catch {
                if (!cancelled) setStatus('error');
            }
        })();
        return () => { cancelled = true; };
    }, [guildId, reloadKey]);

    const retry = useCallback(() => {
        setStatus('loading');
        setReloadKey((key) => key + 1);
    }, []);

    const openTicket = data?.tickets.find((ticket) => ticket.id === openTicketId) ?? null;
    const fallbackPriorityId = data?.priorities.find((priority) => priority.isDefault)?.id ?? data?.priorities[0]?.id ?? '0';

    useEffect(() => {
        if (!guildId || !openTicketId || !data || hydratedTicketIds.has(openTicketId)) return;
        let cancelled = false;
        (async () => {
            try {
                const detail = await loadTicketDetail(guildId, openTicketId, fallbackPriorityId);
                if (cancelled) return;
                setData((prev) => prev ? {
                    ...prev,
                    tickets: prev.tickets.map((ticket) => ticket.id === openTicketId ? detail : ticket),
                    agents: prev.agents.some((agent) => agent.id === detail.assigneeId) || !detail.assigneeId
                        ? prev.agents
                        : [...prev.agents, { id: detail.assigneeId, name: detail.assigneeId, activeTickets: 1, capacity: 12 }],
                } : prev);
                setHydratedTicketIds((prev) => new Set(prev).add(openTicketId));
            } catch {
                setHydratedTicketIds((prev) => new Set(prev).add(openTicketId));
            }
        })();
        return () => { cancelled = true; };
    }, [data, fallbackPriorityId, guildId, hydratedTicketIds, openTicketId]);

    const selectTab = (nextTab: WorkspaceTab) => {
        setTab(nextTab);
        const url = new URL(window.location.href);
        if (nextTab === 'overview') url.searchParams.delete('tab');
        else url.searchParams.set('tab', nextTab);
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    };

    const handleQuickFilter = (filter: QuickFilterKey) => {
        setInboxFilter(filter);
        selectTab('inbox');
    };

    useEffect(() => {
        const syncFromUrl = () => {
            const requested = new URL(window.location.href).searchParams.get('tab');
            if (requested && TAB_KEYS.includes(requested as WorkspaceTab)) setTab(requested as WorkspaceTab);
        };
        syncFromUrl();
        window.addEventListener('popstate', syncFromUrl);
        return () => window.removeEventListener('popstate', syncFromUrl);
    }, []);

    const refreshAfterAction = useCallback(async () => {
        await reloadWorkspace();
    }, [reloadWorkspace]);

    const handleConfirmTransfer = useCallback(async (ticketId: string) => {
        const requestId = data?.tickets.find((ticket) => ticket.id === ticketId)?.transfer.requestId;
        if (!requestId) return;
        await runTicketAction(guildId, ticketId, { action: 'transfer_accept', requestId });
        await refreshAfterAction();
    }, [data?.tickets, guildId, refreshAfterAction]);

    const handleDeclineTransfer = useCallback(async (ticketId: string) => {
        const requestId = data?.tickets.find((ticket) => ticket.id === ticketId)?.transfer.requestId;
        if (!requestId) return;
        await runTicketAction(guildId, ticketId, { action: 'transfer_decline', requestId });
        await refreshAfterAction();
    }, [data?.tickets, guildId, refreshAfterAction]);

    const handleStartTransfer = useCallback(async (ticketId: string, toAgentId: string) => {
        await runTicketAction(guildId, ticketId, { action: 'transfer', toUserId: toAgentId });
        await refreshAfterAction();
    }, [guildId, refreshAfterAction]);

    const handleAddNote = useCallback(async (ticketId: string, body: string) => {
        await runTicketAction(guildId, ticketId, { action: 'note', note: body });
        setHydratedTicketIds((prev) => {
            const next = new Set(prev);
            next.delete(ticketId);
            return next;
        });
        await refreshAfterAction();
    }, [guildId, refreshAfterAction]);

    const handleCloseTicket = useCallback(async (ticketId: string) => {
        await runTicketAction(guildId, ticketId, { action: 'close' });
        setOpenTicketId(null);
        await refreshAfterAction();
    }, [guildId, refreshAfterAction]);

    const handleCloseTickets = useCallback(async (ticketIds: string[]) => {
        await Promise.all(ticketIds.map((ticketId) => runTicketAction(guildId, ticketId, { action: 'close' })));
        await refreshAfterAction();
    }, [guildId, refreshAfterAction]);

    const handleEscalateTicket = useCallback(async (ticketId: string, priorityId: string) => {
        const parsedPriorityId = Number(priorityId);
        if (!Number.isSafeInteger(parsedPriorityId)) throw new Error('Invalid priority');
        await runTicketAction(guildId, ticketId, { action: 'priority', priorityId: parsedPriorityId });
        await refreshAfterAction();
    }, [guildId, refreshAfterAction]);

    const handleSaveCategories = useCallback(async (categories: TicketCategoryDef[]) => {
        if (!data) return;
        await saveTicketCategories(guildId, categories, data.categories, fallbackPriorityId);
        await reloadWorkspace();
    }, [data, fallbackPriorityId, guildId, reloadWorkspace]);

    const handleSavePriorities = useCallback(async (priorities: PriorityDef[]) => {
        await saveTicketPriorities(guildId, priorities);
        await reloadWorkspace();
    }, [guildId, reloadWorkspace]);

    const handleSaveNotifications = useCallback(async (rules: NotificationRule[]) => {
        await saveTicketNotifications(guildId, rules);
        await reloadWorkspace();
    }, [guildId, reloadWorkspace]);

    const handleSavePermissions = useCallback(async (permissions: PermissionAssignment[]) => {
        await saveTicketPermissions(guildId, permissions);
        await reloadWorkspace();
    }, [guildId, reloadWorkspace]);

    const tabLabels: Record<WorkspaceTab, string> = useMemo(() => ({
        overview: t.tabs.overview,
        inbox: t.tabs.inbox,
        categories: t.tabs.categories,
        priorities: t.tabs.priorities,
        notifications: t.tabs.notifications,
        access: t.tabs.access,
    }), [t]);

    const tabIcons: Record<WorkspaceTab, React.ReactNode> = {
        overview: <Stack size={16} weight="duotone" />,
        inbox: <Tray size={16} weight="duotone" />,
        categories: <TicketGlyph size={16} weight="duotone" />,
        priorities: <Flag size={16} weight="duotone" />,
        notifications: <BellRinging size={16} weight="duotone" />,
        access: <ShieldCheck size={16} weight="duotone" />,
    };

    return (
        <div className="tickets-surface relative mx-auto w-full max-w-[1320px] space-y-5 pb-16 sm:space-y-6">
            {/* Ambient backdrop */}
            <div aria-hidden className="pointer-events-none absolute -inset-x-8 -top-20 -z-10 h-[520px]">
                <div className="absolute left-[6%] top-4 h-72 w-72 rounded-full bg-[var(--color-primary-1)] opacity-[0.045] blur-[110px]" />
                <div className="absolute right-[4%] top-28 h-80 w-80 rounded-full bg-[var(--color-primary-2)] opacity-[0.055] blur-[120px]" />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(rgba(244,241,238,0.045) 1px, transparent 1.2px)',
                        backgroundSize: '26px 26px',
                        maskImage: 'radial-gradient(ellipse 75% 60% at 50% 20%, black 10%, transparent 80%)',
                        WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at 50% 20%, black 10%, transparent 80%)',
                    }}
                />
            </div>

            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="relative hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-primary-1)]/25 bg-[linear-gradient(135deg,rgba(117,241,106,0.16),rgba(143,94,255,0.1))] text-[var(--color-primary-1)] shadow-[0_0_36px_rgba(117,241,106,0.16)] sm:flex">
                    <span aria-hidden className="absolute inset-0 rounded-2xl border border-[var(--color-primary-1)]/15" style={{ animation: 'tkPulseRing 3.2s cubic-bezier(0,0,0.2,1) infinite' }} />
                    <TicketGlyph size={28} weight="duotone" />
                </div>
                <div className="min-w-0">
                    <h1 className="hidden font-akony text-2xl font-black tracking-tight text-white sm:block">{t.title}</h1>
                    <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:mt-0.5">{t.subtitle}</p>
                </div>
            </div>

            {/* Tabs */}
            <SegmentedTabs
                active={tab}
                onChange={(value) => selectTab(value as WorkspaceTab)}
                tabs={TAB_KEYS}
                labels={tabLabels}
                icons={tabIcons}
                density="compact"
                dataTour="tickets-tabs"
            />

            {/* Body */}
            {status === 'loading' && <LoadingBlock label={t.loading} />}
            {status === 'error' && <ErrorState label={t.error} retryLabel={t.retry} onRetry={retry} />}
            {status === 'ready' && data && (
                <>
                    {tab === 'overview' && (
                        <div data-tour="tickets-overview">
                            <OverviewPanel data={data} locale={locale} onQuickFilter={handleQuickFilter} onOpenTicket={(ticket) => setOpenTicketId(ticket.id)} />
                        </div>
                    )}
                    {tab === 'inbox' && (
                        <div data-tour="tickets-inbox">
                            <InboxPanel data={data} locale={locale} initialQuickFilter={inboxFilter} onOpenTicket={(ticket) => setOpenTicketId(ticket.id)} onCloseTickets={handleCloseTickets} />
                        </div>
                    )}
                    {tab === 'categories' && (
                        <div data-tour="tickets-categories">
                            <CategoriesPanel guildId={guildId} categories={data.categories} priorities={data.priorities} roles={data.roles} channels={data.channels} serverEmojis={data.serverEmojis} locale={locale} onSave={handleSaveCategories} />
                        </div>
                    )}
                    {tab === 'priorities' && (
                        <div data-tour="tickets-priorities">
                            <PrioritiesPanel priorities={data.priorities} roles={data.roles} locale={locale} onSave={handleSavePriorities} />
                        </div>
                    )}
                    {tab === 'notifications' && (
                        <div data-tour="tickets-notifications">
                            <NotificationsPanel rules={data.notificationRules} priorities={data.priorities} roles={data.roles} categories={data.categories} locale={locale} onSave={handleSaveNotifications} />
                        </div>
                    )}
                    {tab === 'access' && (
                        <div data-tour="tickets-access">
                            <AccessPanel permissions={data.permissions} roles={data.roles} locale={locale} onSave={handleSavePermissions} />
                        </div>
                    )}
                </>
            )}

            {/* Ticket detail drawer — keyed per ticket so internal tab/draft state resets on open */}
            {data && (
                <TicketDetailDrawer
                    key={openTicketId ?? 'closed'}
                    ticket={openTicket}
                    data={data}
                    locale={locale}
                    onClose={() => setOpenTicketId(null)}
                    onConfirmTransfer={handleConfirmTransfer}
                    onDeclineTransfer={handleDeclineTransfer}
                    onStartTransfer={handleStartTransfer}
                    onAddNote={handleAddNote}
                    onCloseTicket={handleCloseTicket}
                    onEscalateTicket={handleEscalateTicket}
                />
            )}
        </div>
    );
}
