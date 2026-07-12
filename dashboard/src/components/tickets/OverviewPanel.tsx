'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    Ticket as TicketGlyph,
    WarningOctagon,
    Clock,
    UserCircleMinus,
    ArrowRight,
    ArrowsLeftRight,
    Gauge,
    Stack,
    UsersThree,
    Archive,
} from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { computeOverview, lookups, matchesQuickFilter } from '@/lib/tickets/selectors';
import { formatRelative } from '@/lib/tickets/format';
import type { QuickFilterKey, Ticket, TicketsWorkspaceData } from '@/lib/tickets/types';
import { AgentAvatar, Chip, KpiCard, LoadBar, Panel, PriorityTag, StatusPill, TermHint } from './primitives';

const QUICK_FILTERS: QuickFilterKey[] = ['open', 'mine', 'unassigned', 'waiting_user', 'waiting_support', 'overdue', 'escalated'];

interface OverviewPanelProps {
    data: TicketsWorkspaceData;
    locale: LocaleCode;
    onQuickFilter: (filter: QuickFilterKey) => void;
    onOpenTicket: (ticket: Ticket) => void;
}

export function OverviewPanel({ data, locale, onQuickFilter, onOpenTicket }: OverviewPanelProps) {
    const { guildId } = useParams<{ guildId: string }>();
    const t = getTicketsCopy(locale);
    const metrics = useMemo(() => computeOverview(data), [data]);
    const maps = useMemo(() => lookups(data), [data]);
    const maxCategory = Math.max(1, ...metrics.byCategory.map((row) => row.count));
    const quickCounts = useMemo(() => {
        const counts = {} as Record<QuickFilterKey, number>;
        for (const key of QUICK_FILTERS) {
            counts[key] = data.tickets.filter((ticket) => matchesQuickFilter(ticket, key, data.currentAgentId)).length;
        }
        return counts;
    }, [data.tickets, data.currentAgentId]);

    const slaColor = metrics.slaHealthPct >= 80 ? 'var(--color-primary-1)' : metrics.slaHealthPct >= 50 ? 'var(--color-warning)' : 'var(--color-destructive)';
    const slaStatus = metrics.slaHealthPct >= 80
        ? t.overview.slaHealthy
        : metrics.slaHealthPct >= 50
            ? t.overview.slaAttention
            : t.overview.slaCritical;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Quick filters — jump straight into the working queue, with live counts */}
            <div className="flex flex-wrap gap-2">
                {QUICK_FILTERS.map((key) => (
                    <button
                        key={key}
                        onClick={() => onQuickFilter(key)}
                        className="group inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] py-1.5 pl-3.5 pr-1.5 text-xs font-bold text-[var(--text-secondary)] transition-all duration-300 hover:border-[var(--color-primary-1)]/35 hover:bg-[var(--color-primary-1)]/[0.06] hover:text-white hover:shadow-[0_0_18px_rgba(117,241,106,0.1)]"
                    >
                        {t.quickFilters[key]}
                        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums transition-colors ${quickCounts[key] > 0 ? 'bg-white/[0.06] text-white/70 group-hover:bg-[var(--color-primary-1)]/15 group-hover:text-[var(--color-primary-1)]' : 'bg-transparent text-white/25'}`}>
                            {quickCounts[key]}
                        </span>
                    </button>
                ))}
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard title={t.overview.openNow} value={metrics.openNow} icon={<TicketGlyph size={20} weight="duotone" />} accent="var(--color-primary-1)" />
                <KpiCard title={<span className="inline-flex items-center">{t.overview.escalated}<TermHint explanation={t.terms.escalation} /></span>} value={metrics.escalated} icon={<WarningOctagon size={20} weight="duotone" />} accent="var(--color-destructive)" />
                <KpiCard title={t.overview.overdue} value={metrics.overdue} icon={<Clock size={20} weight="duotone" />} accent="var(--color-warning)" />
                <KpiCard title={<span className="inline-flex items-center">{t.overview.unassigned}<TermHint explanation={t.terms.assignee} /></span>} value={metrics.unassigned} icon={<UserCircleMinus size={20} weight="duotone" />} accent="var(--color-primary-2)" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* SLA health */}
                <Panel title={<span className="inline-flex items-center">{t.overview.slaHealth}<TermHint explanation={t.terms.sla} /></span>} icon={<Gauge weight="duotone" />} accent={slaColor} bodyClassName="p-4 sm:p-5">
                    <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-black/10 p-4">
                        <span aria-hidden className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full opacity-15 blur-[45px]" style={{ background: slaColor }} />
                        <div className="relative flex items-center gap-4">
                            <div
                                className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-[9px] shadow-[0_0_28px_rgba(117,241,106,0.1)]"
                                style={{
                                    background: `conic-gradient(${slaColor} 0 ${metrics.slaHealthPct}%, rgba(244,241,238,0.06) ${metrics.slaHealthPct}% 100%)`,
                                    boxShadow: `0 0 30px color-mix(in srgb, ${slaColor} 16%, transparent)`,
                                }}
                            >
                                <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border border-white/[0.06] bg-[var(--surface-card)] px-2 shadow-[inset_0_0_24px_rgba(0,0,0,0.4)]">
                                    <div className="flex h-7 w-[84px] items-end justify-center gap-0 whitespace-nowrap px-1 text-white tabular-nums">
                                        <span className={`inline-flex font-akony leading-none tracking-[-0.08em] ${metrics.slaHealthPct >= 100 ? 'text-[16px]' : 'text-[20px]'}`}>
                                            {metrics.slaHealthPct}
                                        </span>
                                        <span className="inline-flex pb-[1px] font-akony text-[7px] leading-none tracking-normal text-white/45">%</span>
                                    </div>
                                    <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: slaColor }}>{slaStatus}</span>
                                </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-2.5">
                                <div className="rounded-xl border border-[var(--color-primary-1)]/10 bg-[var(--color-primary-1)]/[0.035] px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                                            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary-1)] shadow-[0_0_8px_var(--color-primary-1)]" />
                                            <span className="truncate">{t.overview.withinSla}</span>
                                        </span>
                                        <span className="font-akony text-sm text-white tabular-nums">{metrics.withinSla}</span>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-[var(--color-destructive)]/10 bg-[var(--color-destructive)]/[0.035] px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                                            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-destructive)] shadow-[0_0_8px_var(--color-destructive)]" />
                                            <span className="truncate">{t.overview.breached}</span>
                                        </span>
                                        <span className="font-akony text-sm text-white tabular-nums">{metrics.breached}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="relative mt-4 flex items-start gap-2 border-t border-white/[0.05] pt-3 text-[10px] leading-relaxed text-[var(--text-muted)]">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: slaColor }} />
                            {t.overview.slaSummary}
                        </div>
                    </div>
                </Panel>

                {/* Queue by priority */}
                <Panel title={<span className="inline-flex items-center">{t.overview.queues} · {t.overview.byPriority}<TermHint explanation={t.terms.priority} /></span>} icon={<Stack weight="duotone" />}>
                    <div className="space-y-3.5">
                        {metrics.byPriority.map(({ priority, count }) => (
                            <div key={priority.id} className="flex items-center gap-3">
                                <div className="w-28 shrink-0"><PriorityTag priority={priority} /></div>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${(count / Math.max(1, metrics.openNow)) * 100}%`,
                                            background: `linear-gradient(90deg, ${priority.color}88, ${priority.color})`,
                                            boxShadow: `0 0 10px ${priority.color}55`,
                                        }}
                                    />
                                </div>
                                <span className="w-6 shrink-0 text-right text-sm font-bold text-white tabular-nums">{count}</span>
                            </div>
                        ))}
                    </div>
                </Panel>

                {/* Queue by category */}
                <Panel title={`${t.overview.queues} · ${t.overview.byCategory}`} icon={<Stack weight="duotone" />}>
                    <div className="space-y-3.5">
                        {metrics.byCategory.map(({ category, count }) => (
                            <button
                                key={category.id}
                                onClick={() => onQuickFilter('open')}
                                className="group flex w-full items-center gap-3 text-left"
                            >
                                <span className="w-32 shrink-0 truncate text-xs font-semibold text-[var(--text-secondary)] transition-colors group-hover:text-white">
                                    <span className="mr-1">{category.emoji}</span>{category.name}
                                </span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                                    <div
                                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(117,241,106,0.55),var(--color-primary-1))] shadow-[0_0_10px_rgba(117,241,106,0.35)] transition-all duration-700"
                                        style={{ width: `${(count / maxCategory) * 100}%` }}
                                    />
                                </div>
                                <span className="w-6 shrink-0 text-right text-sm font-bold text-white tabular-nums">{count}</span>
                            </button>
                        ))}
                    </div>
                </Panel>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {/* Assignee load */}
                <Panel title={<span className="inline-flex items-center">{t.overview.load}<TermHint explanation={t.terms.assignee} /></span>} icon={<UsersThree weight="duotone" />}>
                    <div className="space-y-4">
                        {metrics.load.map(({ agent, count }) => (
                            <div key={agent.id} className="flex items-center gap-3">
                                <AgentAvatar name={agent.name} avatar={agent.avatar} size={32} />
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-bold text-white">{agent.name}</span>
                                        <span className="shrink-0 text-[11px] font-semibold text-[var(--text-muted)]">
                                            {count}/{agent.capacity} {t.overview.capacity}
                                        </span>
                                    </div>
                                    <LoadBar value={count} capacity={agent.capacity} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

                {/* Pending transfers */}
                <Panel
                    title={<span className="inline-flex items-center">{t.overview.pendingTransfers}<TermHint explanation={t.terms.transfer} /></span>}
                    icon={<ArrowsLeftRight weight="duotone" />}
                    accent={metrics.pendingTransfers.length > 0 ? 'var(--color-warning)' : undefined}
                    action={metrics.pendingTransfers.length > 0 ? <Chip tone="warning">{metrics.pendingTransfers.length}</Chip> : null}
                >
                    {metrics.pendingTransfers.length === 0 ? (
                        <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t.overview.noTransfers}</p>
                    ) : (
                        <div className="space-y-2">
                            {metrics.pendingTransfers.map((ticket) => {
                                const from = ticket.transfer.fromAgentId ? maps.agentById.get(ticket.transfer.fromAgentId) : null;
                                const to = ticket.transfer.toAgentId ? maps.agentById.get(ticket.transfer.toAgentId) : null;
                                return (
                                    <button
                                        key={ticket.id}
                                        onClick={() => onOpenTicket(ticket)}
                                        className="group flex w-full items-center gap-3 rounded-xl border border-[var(--color-warning)]/15 bg-[var(--color-warning)]/[0.04] px-3.5 py-3 text-left transition-all duration-300 hover:border-[var(--color-warning)]/40 hover:bg-[var(--color-warning)]/[0.07] hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-akony text-xs text-[var(--text-muted)]">{ticket.code}</span>
                                                <StatusPill status={ticket.status} locale={locale} />
                                            </div>
                                            <p className="mt-0.5 truncate font-sans text-sm font-semibold text-white">{ticket.subject}</p>
                                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                                <span className="font-semibold text-[var(--text-secondary)]">{from?.name ?? '—'}</span>
                                                <ArrowRight size={11} weight="bold" className="text-[var(--color-warning)]" />
                                                <span className="font-semibold text-[var(--color-primary-1)]">{to?.name ?? '—'}</span>
                                                <span>· {ticket.transfer.requestedAt ? formatRelative(ticket.transfer.requestedAt, locale) : ''}</span>
                                            </div>
                                        </div>
                                        <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </Panel>
            </div>

            {/* Real navigation to the archive & analytics sub-pages (no fake alerts) */}
            <div>
                <div className="mb-2 font-akony text-[10px] uppercase tracking-[0.18em] text-white/35">{t.overview.tools}</div>
                <div className="grid grid-cols-1 gap-3">
                    <Link
                        href={`/dashboard/${guildId}/tickets/transcripts`}
                        className="group relative flex items-center gap-3 overflow-hidden rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-primary-2)]/35 hover:shadow-[0_0_30px_rgba(143,94,255,0.1)]"
                    >
                        <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--color-primary-2)] opacity-0 blur-[40px] transition-opacity duration-500 group-hover:opacity-30" />
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-primary-2)]/25 bg-[var(--color-primary-2)]/10 text-[var(--color-primary-2)] shadow-[0_0_18px_rgba(143,94,255,0.14)]">
                            <Archive size={20} weight="duotone" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="inline-flex items-center font-sans text-sm font-bold text-white">{t.overview.transcriptsLink}<TermHint explanation={t.terms.transcript} /></p>
                            <p className="truncate text-[11px] text-[var(--text-muted)]">{t.overview.transcriptsLinkDesc}</p>
                        </div>
                        <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
