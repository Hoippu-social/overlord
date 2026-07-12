'use client';

import React, { useMemo, useState } from 'react';
import {
    MagnifyingGlass,
    CheckSquare,
    Square,
    ArrowsClockwise,
    UserCircleMinus,
    X,
    CaretUpDown,
    SlidersHorizontal,
} from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { InteractiveSelect } from '@/components/moderation/ui';
import { lookups, matchesQuickFilter, isOpen } from '@/lib/tickets/selectors';
import { formatRelative, formatSlaRemaining } from '@/lib/tickets/format';
import type { InboxSortKey, QuickFilterKey, Ticket, TicketStatus, TicketsWorkspaceData } from '@/lib/tickets/types';
import { AgentAvatar, Chip, EmptyState, PriorityTag, SlaBadge, StatusPill, TermHint, TransferBadge } from './primitives';

const QUICK_FILTERS: QuickFilterKey[] = ['open', 'mine', 'unassigned', 'waiting_user', 'waiting_support', 'overdue', 'escalated'];
const SORTS: InboxSortKey[] = ['priority', 'sla', 'last_activity'];
const STATUSES: TicketStatus[] = ['open', 'waiting_support', 'waiting_user', 'on_hold', 'escalated', 'closed'];

interface InboxPanelProps {
    data: TicketsWorkspaceData;
    locale: LocaleCode;
    initialQuickFilter?: QuickFilterKey | null;
    onOpenTicket: (ticket: Ticket) => void;
    onCloseTickets: (ticketIds: string[]) => Promise<void>;
}

export function InboxPanel({ data, locale, initialQuickFilter, onOpenTicket, onCloseTickets }: InboxPanelProps) {
    const t = getTicketsCopy(locale);
    const maps = useMemo(() => lookups(data), [data]);

    const [quick, setQuick] = useState<QuickFilterKey | null>(initialQuickFilter ?? 'open');
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [priorityId, setPriorityId] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [status, setStatus] = useState('');
    const [sort, setSort] = useState<InboxSortKey>('priority');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [confirmBulkClose, setConfirmBulkClose] = useState(false);
    const [bulkClosing, setBulkClosing] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const rows = data.tickets.filter((ticket) => {
            if (quick && !matchesQuickFilter(ticket, quick, data.currentAgentId)) return false;
            if (!quick && !isOpen(ticket)) return false;
            if (categoryId && ticket.categoryId !== categoryId) return false;
            if (priorityId && ticket.priorityId !== priorityId) return false;
            if (assigneeId) {
                if (assigneeId === '__none' ? !!ticket.assigneeId : ticket.assigneeId !== assigneeId) return false;
            }
            if (status && ticket.status !== status) return false;
            if (query) {
                const haystack = `${ticket.code} ${ticket.subject} ${ticket.requester.name}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });

        return rows.sort((a, b) => {
            if (sort === 'priority') {
                return (maps.priorityById.get(b.priorityId)?.order ?? 0) - (maps.priorityById.get(a.priorityId)?.order ?? 0);
            }
            if (sort === 'sla') {
                return (a.sla.remainingMinutes ?? Number.MAX_SAFE_INTEGER) - (b.sla.remainingMinutes ?? Number.MAX_SAFE_INTEGER);
            }
            return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
        });
    }, [data.currentAgentId, data.tickets, quick, categoryId, priorityId, assigneeId, status, search, sort, maps]);

    const allSelected = filtered.length > 0 && filtered.every((ticket) => selected.has(ticket.id));

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelected(allSelected ? new Set() : new Set(filtered.map((ticket) => ticket.id)));
    };

    const resultsLabel = (() => {
        const n = filtered.length;
        if (locale === 'ru') {
            const mod10 = n % 10;
            const mod100 = n % 100;
            if (mod10 === 1 && mod100 !== 11) return t.inbox.resultsOne;
            if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return t.inbox.resultsFew;
            return t.inbox.resultsMany;
        }
        return n === 1 ? t.inbox.resultsOne : t.inbox.resultsMany;
    })();

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Quick filter chips + sort */}
            <div className="flex flex-wrap items-center gap-2">
                {QUICK_FILTERS.map((key) => {
                    const active = quick === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setQuick(active ? null : key)}
                            aria-pressed={active}
                            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all duration-300 ${
                                active
                                    ? 'border-[var(--color-primary-1)]/45 bg-[var(--color-primary-1)]/10 text-white shadow-[0_0_22px_rgba(117,241,106,0.18)]'
                                    : 'border-white/[0.07] bg-white/[0.03] text-[var(--text-secondary)] hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white'
                            }`}
                        >
                            {t.quickFilters[key]}
                        </button>
                    );
                })}
                <div className="ml-auto w-full sm:w-52">
                    <InteractiveSelect
                        value={sort}
                        onChange={(v) => setSort((v as InboxSortKey) || 'priority')}
                        icon={<CaretUpDown size={16} />}
                        options={SORTS.map((s) => ({ id: s, name: t.inbox.sort[s] }))}
                    />
                </div>
            </div>

            {/* Search + dropdown filters */}
            <div className="relative grid grid-cols-1 gap-3 overflow-hidden rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-4 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)] sm:grid-cols-2 xl:grid-cols-12">
                <div className="relative sm:col-span-2 xl:col-span-4">
                    <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t.inbox.searchPlaceholder}
                        className="h-[52px] w-full rounded-2xl border border-white/10 bg-black/20 pl-10 pr-28 text-sm text-white/90 outline-none transition-all placeholder:text-white/30 hover:border-white/20 focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20 sm:pr-4"
                    />
                    <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)} className="absolute right-2 top-1/2 inline-flex h-9 -translate-y-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-[var(--surface-card)] px-3 text-xs font-bold text-white sm:hidden">
                        <SlidersHorizontal size={14} /> {t.inbox.filters}
                    </button>
                </div>
                <div className={`${showFilters ? 'block' : 'hidden'} sm:block xl:col-span-2`}>
                    <InteractiveSelect
                        value={categoryId}
                        onChange={setCategoryId}
                        placeholder={t.inbox.anyCategory}
                        options={data.categories.map((c) => ({ id: c.id, name: `${c.emoji ?? ''} ${c.name}`.trim() }))}
                        disabled={data.categories.length === 0}
                    />
                </div>
                <div className={`${showFilters ? 'block' : 'hidden'} sm:block xl:col-span-2`}>
                    <InteractiveSelect
                        value={priorityId}
                        onChange={setPriorityId}
                        placeholder={t.inbox.anyPriority}
                        options={data.priorities.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                        disabled={data.priorities.length === 0}
                    />
                </div>
                <div className={`${showFilters ? 'block' : 'hidden'} sm:block xl:col-span-2`}>
                    <InteractiveSelect
                        value={assigneeId}
                        onChange={setAssigneeId}
                        placeholder={t.inbox.anyAssignee}
                        options={[{ id: '__none', name: t.inbox.unassigned }, ...data.agents.map((a) => ({ id: a.id, name: a.name, color: a.roleLabel?.includes('Admin') ? '#75f16a' : '#8f5eff' }))]}
                    />
                </div>
                <div className={`${showFilters ? 'block' : 'hidden'} sm:block xl:col-span-2`}>
                    <InteractiveSelect
                        value={status}
                        onChange={setStatus}
                        placeholder={t.inbox.anyStatus}
                        options={STATUSES.map((s) => ({ id: s, name: t.status[s] }))}
                    />
                </div>
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-primary-1)]/35 bg-[var(--color-primary-1)]/[0.06] px-4 py-3 shadow-[0_0_30px_rgba(117,241,106,0.1)]">
                    <span className="text-sm font-bold text-white">
                        {selected.size} {t.inbox.selected}
                    </span>
                    <div className="ml-auto flex flex-wrap gap-2">
                        {confirmBulkClose ? (
                            <>
                                <button disabled={bulkClosing} onClick={async () => { setBulkClosing(true); setBulkError(null); try { await onCloseTickets([...selected]); setSelected(new Set()); setConfirmBulkClose(false); } catch { setBulkError(t.detail.actionFailed); } finally { setBulkClosing(false); } }} className="rounded-full bg-[var(--color-destructive)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{t.detail.confirmClose}</button>
                                <button disabled={bulkClosing} onClick={() => setConfirmBulkClose(false)} className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-bold text-white">{t.detail.cancel}</button>
                            </>
                        ) : (
                            <button onClick={() => setConfirmBulkClose(true)} className="rounded-full border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 px-3 py-1.5 text-xs font-bold text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive)]/20">{t.inbox.bulkClose}</button>
                        )}
                        <button onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] transition-colors hover:text-white">
                            <X size={12} weight="bold" /> {t.inbox.clearSelection}
                        </button>
                    </div>
                </div>
            )}
            {bulkError && <p role="alert" className="px-1 text-xs text-[var(--color-destructive)]">{bulkError}</p>}

            {/* Table */}
            <div className="relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.03),rgba(244,241,238,0.01))] shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]">
                <span aria-hidden className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(244,241,238,0.14),transparent)]" />
                {/* Header row (desktop) */}
                <div className="hidden items-center gap-5 border-b border-white/[0.05] bg-white/[0.015] px-4 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] lg:flex">
                    <button onClick={toggleAll} className="flex h-5 w-5 items-center justify-center text-[var(--text-muted)] hover:text-white" aria-label="select all">
                        {allSelected ? <CheckSquare size={18} weight="fill" className="text-[var(--color-primary-1)]" /> : <Square size={18} />}
                    </button>
                    <span className="flex-1">{t.inbox.colTicket}</span>
                    <span className="w-28">{t.inbox.colCategory}</span>
                    <span className="inline-flex w-24 items-center">{t.inbox.colPriority}<TermHint explanation={t.terms.priority} /></span>
                    <span className="w-36">{t.inbox.colStatus}</span>
                    <span className="inline-flex w-28 items-center">{t.inbox.colAssignee}<TermHint explanation={t.terms.assignee} /></span>
                    <span className="inline-flex w-24 items-center">{t.inbox.colSla}<TermHint explanation={t.terms.sla} /></span>
                    <span className="w-20 text-right">{t.inbox.colActivity}</span>
                </div>

                {filtered.length === 0 ? (
                    <div className="p-4">
                        <EmptyState title={t.inbox.empty} hint={t.inbox.emptyHint} />
                    </div>
                ) : (
                    <ul className="divide-y divide-white/[0.04]">
                        {filtered.map((ticket) => {
                            const priority = maps.priorityById.get(ticket.priorityId);
                            const category = maps.categoryById.get(ticket.categoryId);
                            const agent = ticket.assigneeId ? maps.agentById.get(ticket.assigneeId) : null;
                            const isSelected = selected.has(ticket.id);
                            return (
                                <li
                                    key={ticket.id}
                                    onClick={() => onOpenTicket(ticket)}
                                    className={`relative flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] lg:items-center ${isSelected ? 'bg-[var(--color-primary-1)]/[0.04]' : ''}`}
                                >
                                    {priority && (
                                        <span
                                            aria-hidden
                                            className="absolute left-0 top-1/2 h-9 w-[3px] -translate-y-1/2 rounded-r-full"
                                            style={{ backgroundColor: priority.color, boxShadow: `0 0 8px ${priority.color}66` }}
                                        />
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleSelect(ticket.id); }}
                                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[var(--text-muted)] hover:text-white lg:mt-0"
                                        aria-label={`select ${ticket.code}`}
                                    >
                                        {isSelected ? <CheckSquare size={18} weight="fill" className="text-[var(--color-primary-1)]" /> : <Square size={18} />}
                                    </button>

                                    {/* Ticket identity + compact meta (below lg) */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            {ticket.unreadForSupport && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary-1)] shadow-[0_0_8px_rgba(117,241,106,0.6)]" />}
                                            <span className="whitespace-nowrap font-akony text-[11px] text-[var(--text-muted)]">{ticket.code}</span>
                                            <span className="truncate text-[11px] text-[var(--text-muted)]">· {ticket.requester.name}</span>
                                            {ticket.transfer.status === 'pending' && (
                                                <span className="hidden sm:inline-flex"><TransferBadge status="pending" locale={locale} /></span>
                                            )}
                                        </div>
                                        <p className="truncate font-sans text-sm font-semibold text-white">{ticket.subject}</p>

                                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 lg:hidden">
                                            <span className="whitespace-nowrap text-[11px] font-semibold text-[var(--text-muted)]">{category?.emoji} {category?.name}</span>
                                            {priority && <PriorityTag priority={priority} />}
                                            <StatusPill status={ticket.status} locale={locale} />
                                            <SlaBadge state={ticket.sla.state} label={formatSlaRemaining(ticket.sla.remainingMinutes, locale)} locale={locale} />
                                            <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                                {agent ? (
                                                    <>
                                                        <AgentAvatar name={agent.name} avatar={agent.avatar} size={16} />
                                                        <span className="max-w-24 truncate font-semibold text-[var(--text-secondary)]">{agent.name}</span>
                                                    </>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 font-semibold"><UserCircleMinus size={14} /> {t.inbox.unassigned}</span>
                                                )}
                                                <span>· {formatRelative(ticket.lastActivityAt, locale)}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Aligned columns (lg+) */}
                                    <div className="hidden shrink-0 items-center gap-5 lg:flex">
                                        <div className="w-28 truncate text-xs font-semibold text-[var(--text-secondary)]">
                                            <span className="mr-1">{category?.emoji}</span>{category?.name}
                                        </div>
                                        <div className="w-24">{priority && <PriorityTag priority={priority} />}</div>
                                        <div className="w-36"><StatusPill status={ticket.status} locale={locale} /></div>
                                        <div className="w-28">
                                            {agent ? (
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                    <AgentAvatar name={agent.name} avatar={agent.avatar} size={22} />
                                                    <span className="truncate text-xs font-semibold text-white">{agent.name}</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                                                    <UserCircleMinus size={16} /> {t.inbox.unassigned}
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-24">
                                            <SlaBadge state={ticket.sla.state} label={formatSlaRemaining(ticket.sla.remainingMinutes, locale)} locale={locale} />
                                        </div>
                                        <div className="w-20 text-right text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
                                            {formatRelative(ticket.lastActivityAt, locale)}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-[var(--text-muted)]">
                <ArrowsClockwise size={12} />
                <span>{filtered.length} {resultsLabel}</span>
                {quick && <Chip tone="neutral">{t.quickFilters[quick]}</Chip>}
            </div>
        </div>
    );
}
