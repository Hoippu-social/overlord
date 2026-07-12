'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    X,
    ArrowSquareOut,
    Hash,
    ChatCircleDots,
    ArrowsLeftRight,
    ArrowRight,
    Timer,
    WarningOctagon,
    ArrowsClockwise,
    Note as NoteIcon,
    ClipboardText,
    PaperPlaneTilt,
    Check,
    UserCircleMinus,
} from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';
import { InteractiveSelect } from '@/components/moderation/ui';
import { lookups } from '@/lib/tickets/selectors';
import { formatDateTime, formatRelative, formatSlaRemaining } from '@/lib/tickets/format';
import type { Ticket, TicketsWorkspaceData } from '@/lib/tickets/types';
import { AgentAvatar, Field, PriorityTag, SlaBadge, StatusPill, TermHint, TransferBadge } from './primitives';
import { DiscordOpsPreview } from './DiscordOpsPreview';

type DetailTab = 'overview' | 'timeline' | 'notes' | 'audit' | 'discord';
const DETAIL_TABS: DetailTab[] = ['overview', 'timeline', 'notes', 'audit', 'discord'];

interface TicketDetailDrawerProps {
    ticket: Ticket | null;
    data: TicketsWorkspaceData;
    locale: LocaleCode;
    onClose: () => void;
    onConfirmTransfer: (ticketId: string) => Promise<void>;
    onDeclineTransfer: (ticketId: string) => Promise<void>;
    onStartTransfer: (ticketId: string, toAgentId: string) => Promise<void>;
    onAddNote: (ticketId: string, body: string) => Promise<void>;
    onCloseTicket: (ticketId: string) => Promise<void>;
    onEscalateTicket: (ticketId: string, priorityId: string) => Promise<void>;
}

export function TicketDetailDrawer({
    ticket,
    data,
    locale,
    onClose,
    onConfirmTransfer,
    onDeclineTransfer,
    onStartTransfer,
    onAddNote,
    onCloseTicket,
    onEscalateTicket,
}: TicketDetailDrawerProps) {
    const t = getTicketsCopy(locale);
    const maps = useMemo(() => lookups(data), [data]);
    const [tab, setTab] = useState<DetailTab>('overview');
    const [noteDraft, setNoteDraft] = useState('');
    const [transferTo, setTransferTo] = useState('');
    const [showTransferForm, setShowTransferForm] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    const [actionPending, setActionPending] = useState<'close' | 'escalate' | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!ticket) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [onClose, ticket]);

    if (!ticket) return null;

    const priority = maps.priorityById.get(ticket.priorityId);
    const escalationPriority = priority
        ? [...data.priorities].filter((item) => item.order > priority.order && /^\d+$/.test(item.id)).sort((a, b) => a.order - b.order)[0]
        : undefined;
    const category = maps.categoryById.get(ticket.categoryId);
    const agent = ticket.assigneeId ? maps.agentById.get(ticket.assigneeId) : null;
    const fromAgent = ticket.transfer.fromAgentId ? maps.agentById.get(ticket.transfer.fromAgentId) : null;
    const toAgent = ticket.transfer.toAgentId ? maps.agentById.get(ticket.transfer.toAgentId) : null;

    const tabLabels: Record<DetailTab, string> = {
        overview: t.detail.overview,
        timeline: t.detail.timeline,
        notes: t.detail.notes,
        audit: t.detail.audit,
        discord: t.detail.discord,
    };

    const submitNote = () => {
        const body = noteDraft.trim();
        if (!body) return;
        onAddNote(ticket.id, body);
        setNoteDraft('');
    };

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />

            <aside
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ticket-drawer-title"
                tabIndex={-1}
                className="relative flex h-full w-full max-w-2xl flex-col border-l border-white/[0.07] bg-[var(--bg-base)] shadow-[-24px_0_80px_rgba(0,0,0,0.6)]"
                style={{ animation: 'tkSlideInRight 0.28s cubic-bezier(0.16,1,0.3,1) both' }}
            >
                {priority && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px]"
                        style={{ background: `linear-gradient(90deg, ${priority.color}, transparent 70%)`, boxShadow: `0 0 12px ${priority.color}66` }}
                    />
                )}
                <span aria-hidden className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-[var(--color-primary-2)] opacity-[0.04] blur-[90px]" />

                {/* Header */}
                <header className="flex items-start gap-3 border-b border-white/[0.05] bg-[linear-gradient(180deg,rgba(244,241,238,0.03),transparent)] px-6 py-5">
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-akony text-xs text-[var(--text-muted)]">{ticket.code}</span>
                            <StatusPill status={ticket.status} locale={locale} />
                            {priority && <PriorityTag priority={priority} />}
                            <TransferBadge status={ticket.transfer.status} locale={locale} />
                        </div>
                        <h2 id="ticket-drawer-title" className="line-clamp-2 font-sans text-lg font-bold leading-snug text-white">{ticket.subject}</h2>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {category?.emoji} {category?.name} · {ticket.requester.name}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {ticket.ref.url && (
                            <a
                                href={ticket.ref.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--surface-hover)]"
                            >
                                <ArrowSquareOut size={14} /> {t.detail.openInDiscord}
                            </a>
                        )}
                        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:text-white" aria-label={t.detail.closePanel}>
                            <X size={18} />
                        </button>
                    </div>
                </header>

                {/* Tabs */}
                <div className="px-6 pt-4">
                    <SegmentedTabs
                        active={tab}
                        onChange={(v) => setTab(v as DetailTab)}
                        tabs={DETAIL_TABS}
                        labels={tabLabels}
                        density="compact"
                    />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {tab === 'overview' && (
                        <div className="space-y-5">
                            {/* Metadata grid */}
                            <div className="grid grid-cols-2 gap-4 rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-5">
                                <Field label={t.detail.requester}>{ticket.requester.name}</Field>
                                <Field label={t.detail.category}>{category?.emoji} {category?.name}</Field>
                                <Field label={<span className="inline-flex items-center">{t.detail.assignee}<TermHint explanation={t.terms.assignee} /></span>}>
                                    {agent ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <AgentAvatar name={agent.name} size={20} /> {agent.name}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)]"><UserCircleMinus size={16} /> {t.inbox.unassigned}</span>
                                    )}
                                </Field>
                                <Field label={t.detail.status}><StatusPill status={ticket.status} locale={locale} /></Field>
                                <Field label={t.detail.created}>{formatDateTime(ticket.createdAt, locale)}</Field>
                                <Field label={t.detail.lastActivity}>{formatRelative(ticket.lastActivityAt, locale)}</Field>
                            </div>

                            {/* SLA / priority panel */}
                            <div className="rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-5">
                                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                                    <Timer size={16} className="text-[var(--text-muted)]" /> {t.detail.slaPanel}<TermHint explanation={t.terms.sla} />
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    {priority && <PriorityTag priority={priority} />}
                                    <SlaBadge state={ticket.sla.state} locale={locale} />
                                    <div className="text-xs text-[var(--text-muted)]">
                                        {t.detail.remaining}:{' '}
                                        <span className="font-bold text-white">{formatSlaRemaining(ticket.sla.remainingMinutes, locale)}</span>
                                        {ticket.sla.dueAt && <> · {t.detail.deadline}: <span className="font-semibold text-[var(--text-secondary)]">{formatDateTime(ticket.sla.dueAt, locale)}</span></>}
                                    </div>
                                </div>
                            </div>

                            {/* Transfer / responsibility */}
                            <div className="rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-5">
                                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                                    <ArrowsLeftRight size={16} className="text-[var(--text-muted)]" /> {t.detail.transferTitle}<TermHint explanation={t.terms.transfer} />
                                </div>

                                {ticket.transfer.status === 'pending' ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <AgentAvatar name={fromAgent?.name ?? '—'} size={26} />
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t.detail.transferFrom}</div>
                                                    <div className="text-sm font-bold text-white">{fromAgent?.name ?? '—'}</div>
                                                </div>
                                            </div>
                                            <ArrowRight size={18} className="text-[var(--color-warning)]" weight="bold" />
                                            <div className="flex items-center gap-2">
                                                <AgentAvatar name={toAgent?.name ?? '—'} size={26} />
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t.detail.transferTo}</div>
                                                    <div className="text-sm font-bold text-[var(--color-primary-1)]">{toAgent?.name ?? '—'}</div>
                                                </div>
                                            </div>
                                            {ticket.transfer.requestedAt && (
                                                <span className="ml-auto text-[11px] text-[var(--text-muted)]">
                                                    {t.detail.transferRequested} {formatRelative(ticket.transfer.requestedAt, locale)}
                                                </span>
                                            )}
                                        </div>
                                        {ticket.transfer.note && (
                                            <p className="rounded-xl border border-[var(--border-divider)] bg-[var(--surface-hover)] px-3 py-2 text-xs italic text-[var(--text-secondary)]">
                                                “{ticket.transfer.note}”
                                            </p>
                                        )}
                                        <div className="rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/[0.07] px-3 py-2 text-[11px] text-[var(--color-warning)]">
                                            {t.detail.transferPendingNote}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => onConfirmTransfer(ticket.id)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-1)] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[var(--color-primary-2)] hover:text-white">
                                                <Check size={14} weight="bold" /> {t.detail.confirmTransfer}
                                            </button>
                                            <button onClick={() => onDeclineTransfer(ticket.id)} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--surface-card)]">
                                                {t.detail.declineTransfer}
                                            </button>
                                        </div>
                                    </div>
                                ) : showTransferForm ? (
                                    <div className="space-y-3">
                                        <InteractiveSelect
                                            value={transferTo}
                                            onChange={setTransferTo}
                                            placeholder={t.detail.transferTo}
                                            options={data.agents.filter((a) => a.id !== ticket.assigneeId).map((a) => ({ id: a.id, name: `${a.name} · ${a.roleLabel ?? ''}` }))}
                                        />
                                        <p className="text-[11px] text-[var(--text-muted)]">{t.detail.transferHint}</p>
                                        <div className="flex gap-2">
                                            <button
                                                disabled={!transferTo}
                                                onClick={() => { onStartTransfer(ticket.id, transferTo); setShowTransferForm(false); }}
                                                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-1)] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[var(--color-primary-2)] hover:text-white disabled:pointer-events-none disabled:opacity-50"
                                            >
                                                <ArrowsLeftRight size={14} weight="bold" /> {t.detail.startTransfer}
                                            </button>
                                            <button onClick={() => setShowTransferForm(false)} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2 text-xs font-bold text-white">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-[var(--text-muted)]">{t.detail.transferHint}</p>
                                        <button onClick={() => setShowTransferForm(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--surface-card)]">
                                            <ArrowsLeftRight size={14} /> {t.detail.startTransfer}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Quick actions */}
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setShowTransferForm(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--surface-hover)]">
                                    <ArrowsClockwise size={14} /> {t.detail.reassign}
                                </button>
                                <button
                                    disabled={!escalationPriority || actionPending !== null}
                                    title={!escalationPriority ? t.detail.noHigherPriority : undefined}
                                    onClick={async () => {
                                        if (!escalationPriority) return;
                                        setActionPending('escalate'); setActionError(null);
                                        try { await onEscalateTicket(ticket.id, escalationPriority.id); }
                                        catch { setActionError(t.detail.actionFailed); }
                                        finally { setActionPending(null); }
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-2 text-xs font-bold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <WarningOctagon size={14} /> {t.detail.escalate}
                                </button>
                                <TermHint explanation={t.terms.escalation} />
                                {confirmClose ? (
                                    <>
                                        <button disabled={actionPending !== null} onClick={async () => { setActionPending('close'); setActionError(null); try { await onCloseTicket(ticket.id); } catch { setActionError(t.detail.actionFailed); setActionPending(null); } }} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-destructive)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                                            <Check size={14} /> {t.detail.confirmClose}
                                        </button>
                                        <button disabled={actionPending !== null} onClick={() => setConfirmClose(false)} className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold text-white">{t.detail.cancel}</button>
                                    </>
                                ) : (
                                    <button onClick={() => setConfirmClose(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 px-4 py-2 text-xs font-bold text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive)]/20">
                                        <Check size={14} /> {t.detail.close}
                                    </button>
                                )}
                            </div>
                            {actionError && <p role="alert" className="text-xs text-[var(--color-destructive)]">{actionError}</p>}
                        </div>
                    )}

                    {tab === 'timeline' && (
                        <div>
                        <div className="mb-4 inline-flex items-center text-xs font-semibold text-[var(--text-muted)]">{t.detail.timeline}<TermHint explanation={t.terms.timeline} /></div>
                        <ol className="relative space-y-4 border-l border-white/[0.06] pl-5">
                            {[...ticket.timeline].reverse().map((event) => (
                                <li key={event.id} className="relative">
                                    <span className="absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-[var(--bg-base)] bg-[var(--color-primary-1)] shadow-[0_0_10px_rgba(117,241,106,0.55)]" />
                                    <div className="text-sm font-semibold text-white">{event.summary}</div>
                                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                                        {event.actor && <span className="font-semibold text-[var(--text-secondary)]">{event.actor}</span>}
                                        <span>· {formatRelative(event.at, locale)}</span>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        </div>
                    )}

                    {tab === 'notes' && (
                        <div className="space-y-4">
                            <div className="inline-flex items-center text-xs font-semibold text-[var(--text-muted)]">{t.detail.notes}<TermHint explanation={t.terms.internalNote} /></div>
                            <div className="rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-3">
                                <textarea
                                    value={noteDraft}
                                    onChange={(e) => setNoteDraft(e.target.value)}
                                    rows={3}
                                    placeholder={t.detail.notePlaceholder}
                                    className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/90 outline-none transition-all placeholder:text-white/30 focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20"
                                />
                                <div className="mt-2 flex justify-end">
                                    <button
                                        onClick={submitNote}
                                        disabled={!noteDraft.trim()}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-1)] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[var(--color-primary-2)] hover:text-white disabled:pointer-events-none disabled:opacity-50"
                                    >
                                        <PaperPlaneTilt size={14} weight="fill" /> {t.detail.addNote}
                                    </button>
                                </div>
                            </div>
                            {ticket.notes.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-8 text-[var(--text-muted)]">
                                    <NoteIcon size={28} weight="duotone" />
                                    <p className="text-sm">{t.detail.noNotes}</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {[...ticket.notes].reverse().map((note) => (
                                        <li key={note.id} className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
                                            <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                                                <span className="font-bold text-[var(--text-secondary)]">{note.author}</span>
                                                <span>· {formatRelative(note.at, locale)}</span>
                                            </div>
                                            <p className="text-sm text-white">{note.body}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {tab === 'audit' && (
                        <div>
                        <div className="mb-4 inline-flex items-center text-xs font-semibold text-[var(--text-muted)]">{t.detail.audit}<TermHint explanation={t.terms.audit} /></div>
                        {ticket.audit.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-8 text-[var(--text-muted)]">
                                <ClipboardText size={28} weight="duotone" />
                                <p className="text-sm">{t.detail.noAudit}</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {[...ticket.audit].reverse().map((entry) => (
                                    <li key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.025] px-4 py-3">
                                        <ClipboardText size={16} className="shrink-0 text-[var(--text-muted)]" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <code className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--color-primary-1)]">{entry.action}</code>
                                                {entry.detail && <span className="truncate text-xs text-[var(--text-secondary)]">{entry.detail}</span>}
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{entry.actor} · {formatDateTime(entry.at, locale)}</div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                        </div>
                    )}

                    {tab === 'discord' && (
                        <div className="space-y-5">
                            {/* Refs */}
                            <div className="grid grid-cols-1 gap-2 rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-4 sm:grid-cols-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <Hash size={16} className="text-[var(--text-muted)]" />
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t.detail.channel}</div>
                                        <div className="truncate font-semibold text-white">#{ticket.ref.channelName}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <ChatCircleDots size={16} className="text-[var(--text-muted)]" />
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t.detail.thread}</div>
                                        <div className="truncate font-semibold text-white">{ticket.ref.threadName}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <ArrowSquareOut size={16} className="text-[var(--text-muted)]" />
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t.detail.message}</div>
                                        <div className="truncate font-mono text-xs font-semibold text-[var(--text-secondary)]">{ticket.ref.messageId}</div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 text-xs font-bold text-[var(--text-secondary)]">{t.detail.supportView}</div>
                                <DiscordOpsPreview
                                    channelName={ticket.ref.channelName}
                                    accent={priority?.color ?? '#75f16a'}
                                    title={`${ticket.code} · ${ticket.subject}`}
                                    description={`${t.detail.requester}: ${ticket.requester.name}`}
                                    fields={[
                                        { name: t.detail.priority, value: priority?.name ?? '—' },
                                        { name: t.detail.assignee, value: agent?.name ?? t.inbox.unassigned },
                                    ]}
                                    mentions={agent ? [agent.name] : undefined}
                                    buttons={[
                                        { label: t.detail.close, style: 'danger' },
                                        { label: t.detail.reassign, style: 'secondary' },
                                        { label: t.detail.escalate, style: 'secondary' },
                                    ]}
                                    footer={`SLA · ${formatSlaRemaining(ticket.sla.remainingMinutes, locale)}`}
                                />
                            </div>
                            <div>
                                <div className="mb-2 text-xs font-bold text-[var(--text-secondary)]">{t.detail.userView}</div>
                                <DiscordOpsPreview
                                    channelName={ticket.ref.channelName}
                                    accent={priority?.color ?? '#75f16a'}
                                    title={ticket.subject}
                                    description={locale === 'ru' ? 'Мы получили ваше обращение. Команда поддержки скоро ответит.' : 'We received your ticket. The support team will reply shortly.'}
                                    buttons={[{ label: locale === 'ru' ? 'Закрыть обращение' : 'Close ticket', style: 'secondary' }]}
                                    footer={category?.name}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
