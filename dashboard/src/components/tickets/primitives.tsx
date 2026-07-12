'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Question, WarningCircle, Tray } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { readableOn, slaTone, statusTone, transferTone } from '@/lib/tickets/format';
import type { PriorityDef, SlaState, TicketStatus, TransferStatus } from '@/lib/tickets/types';

export type Tone = 'primary' | 'warning' | 'danger' | 'info' | 'neutral';

/** Inline explanation for jargon. Hover/focus opens it on desktop; tap toggles it on touch devices. */
export function TermHint({ explanation, label = 'Что это значит?' }: { explanation: string; label?: string }) {
    const [open, setOpen] = React.useState(false);
    const [position, setPosition] = React.useState({ top: 0, left: 0, width: 256 });
    const hintId = React.useId();
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const tooltipRef = React.useRef<HTMLSpanElement | null>(null);

    const updatePosition = React.useCallback(() => {
        const button = buttonRef.current;
        if (!button) return;
        const rect = button.getBoundingClientRect();
        const viewportPadding = 12;
        const gap = 8;
        const width = Math.min(288, window.innerWidth - viewportPadding * 2);
        const measuredHeight = tooltipRef.current?.offsetHeight ?? 112;
        const left = Math.min(
            Math.max(viewportPadding, rect.left + rect.width / 2 - width / 2),
            window.innerWidth - width - viewportPadding,
        );
        const top = rect.top >= measuredHeight + gap + viewportPadding
            ? rect.top - measuredHeight - gap
            : Math.min(rect.bottom + gap, window.innerHeight - measuredHeight - viewportPadding);
        setPosition({ top: Math.max(viewportPadding, top), left, width });
    }, []);

    React.useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
        const frame = window.requestAnimationFrame(updatePosition);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open, updatePosition]);

    React.useEffect(() => {
        if (!open) return;
        const closeOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!buttonRef.current?.contains(target) && !tooltipRef.current?.contains(target)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => document.removeEventListener('pointerdown', closeOutside);
    }, [open]);

    return (
        <span className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                aria-describedby={open ? hintId : undefined}
                aria-expanded={open}
                onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
                className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--color-primary-1)]/60 hover:text-[var(--color-primary-1)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-1)]/30"
            >
                <Question size={10} weight="bold" />
            </button>
            {open && typeof document !== 'undefined' && createPortal(
                <span
                    ref={tooltipRef}
                    id={hintId}
                    role="tooltip"
                    className="pointer-events-none fixed z-[100] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-left font-sans text-xs font-medium normal-case leading-relaxed tracking-normal text-[var(--text-secondary)] shadow-2xl"
                    style={{
                        top: position.top,
                        left: position.left,
                        width: position.width,
                        maxHeight: 'calc(100vh - 24px)',
                        overflowY: 'auto',
                        visibility: position.top > 0 ? 'visible' : 'hidden',
                    }}
                >
                    {explanation}
                </span>,
                document.body,
            )}
        </span>
    );
}

// Tone → token-driven chip classes. Green primary, violet as info accent.
const TONE_CHIP: Record<Tone, string> = {
    primary: 'border-[var(--color-primary-1)]/25 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)] shadow-[0_0_12px_rgba(117,241,106,0.08)]',
    warning: 'border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)] shadow-[0_0_12px_rgba(245,158,11,0.08)]',
    danger: 'border-[var(--color-destructive)]/25 bg-[var(--color-destructive)]/12 text-[var(--color-destructive)] shadow-[0_0_12px_rgba(244,63,94,0.08)]',
    info: 'border-[var(--color-primary-2)]/30 bg-[var(--color-primary-2)]/12 text-[#c4b5fd] shadow-[0_0_12px_rgba(143,94,255,0.08)]',
    neutral: 'border-white/[0.07] bg-white/[0.04] text-[var(--text-secondary)]',
};

const TONE_DOT: Record<Tone, string> = {
    primary: 'bg-[var(--color-primary-1)] shadow-[0_0_6px_var(--color-primary-1)]',
    warning: 'bg-[var(--color-warning)] shadow-[0_0_6px_var(--color-warning)]',
    danger: 'bg-[var(--color-destructive)] shadow-[0_0_6px_var(--color-destructive)]',
    info: 'bg-[var(--color-primary-2)] shadow-[0_0_6px_var(--color-primary-2)]',
    neutral: 'bg-[var(--text-muted)]',
};

export function Chip({
    tone = 'neutral',
    dot = false,
    children,
    className = '',
}: {
    tone?: Tone;
    dot?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${TONE_CHIP[tone]} ${className}`}>
            {dot && <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />}
            {children}
        </span>
    );
}

export function StatusPill({ status, locale }: { status: TicketStatus; locale: LocaleCode }) {
    const t = getTicketsCopy(locale);
    return <Chip tone={statusTone(status)} dot>{t.status[status]}</Chip>;
}

export function PriorityTag({ priority }: { priority: PriorityDef }) {
    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide"
            style={{
                borderColor: `${priority.color}55`,
                backgroundColor: `${priority.color}1f`,
                color: priority.color,
                boxShadow: `0 0 12px ${priority.color}14`,
            }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priority.color, boxShadow: `0 0 6px ${priority.color}` }} />
            {priority.name}
        </span>
    );
}

export function PriorityDotSwatch({ color, size = 12 }: { color: string; size?: number }) {
    return (
        <span
            className="inline-flex items-center justify-center rounded-full"
            style={{ width: size, height: size, backgroundColor: color, boxShadow: `0 0 10px ${color}88` }}
        />
    );
}

export function SlaBadge({ state, label, locale }: { state: SlaState; label?: string; locale: LocaleCode }) {
    const t = getTicketsCopy(locale);
    return (
        <Chip tone={slaTone(state)} dot>
            {label ?? t.sla[state]}
        </Chip>
    );
}

export function TransferBadge({ status, locale }: { status: TransferStatus; locale: LocaleCode }) {
    const t = getTicketsCopy(locale);
    if (status === 'none') return null;
    return <Chip tone={transferTone(status)}>{t.transfer[status]}</Chip>;
}

/** Colored badge for a Discord role using its native color. */
export function RolePill({ name, color }: { name: string; color?: string | number | null }) {
    const hex = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color || '#8f5eff';
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
            style={{ borderColor: `${hex}55`, backgroundColor: `${hex}1a`, color: hex }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hex }} />
            {name}
        </span>
    );
}

/** Compact avatar bubble with initials fallback (no external image dependency). */
export function AgentAvatar({ name, avatar, size = 28 }: { name: string; avatar?: string | null; size?: number }) {
    const initials = name.split(/[\s#]/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
    if (avatar) {
        return <img src={avatar} alt={name} className="shrink-0 rounded-full border border-white/10 object-cover shadow-[0_2px_8px_rgba(0,0,0,0.4)]" style={{ width: size, height: size }} />;
    }
    return (
        <span
            className="flex shrink-0 items-center justify-center rounded-full border border-[var(--color-primary-1)]/25 bg-[linear-gradient(135deg,rgba(117,241,106,0.14),rgba(143,94,255,0.1))] font-akony text-[var(--color-primary-1)]"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {initials || '?'}
        </span>
    );
}

/** Horizontal load meter used for assignee capacity. */
export function LoadBar({ value, capacity }: { value: number; capacity: number }) {
    const pct = capacity > 0 ? Math.min(100, Math.round((value / capacity) * 100)) : 0;
    const tone = pct >= 90 ? 'var(--color-destructive)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-primary-1)';
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, color-mix(in srgb, ${tone} 70%, transparent), ${tone})`,
                    boxShadow: `0 0 10px color-mix(in srgb, ${tone} 45%, transparent)`,
                }}
            />
        </div>
    );
}

/** Glassy operational surface panel with optional accent hairline. */
export function Panel({
    title,
    icon,
    action,
    accent,
    children,
    className = '',
    bodyClassName = '',
}: {
    title?: React.ReactNode;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    accent?: string;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={`relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)] transition-colors duration-300 hover:border-white/[0.1] ${className}`}>
            <span
                aria-hidden
                className="pointer-events-none absolute inset-x-4 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${accent ?? 'rgba(244,241,238,0.14)'}, transparent)` }}
            />
            {(title || action) && (
                <header className="flex items-center gap-2.5 border-b border-white/[0.05] px-5 py-3.5">
                    {icon && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.05] text-white/35 [&>svg]:h-3.5 [&>svg]:w-3.5">
                            {icon}
                        </span>
                    )}
                    {title && (
                        <h3 className="flex-1 font-akony text-[11px] uppercase tracking-[0.18em] text-white/45">
                            {title}
                        </h3>
                    )}
                    {action && <div className="shrink-0">{action}</div>}
                </header>
            )}
            <div className={bodyClassName || 'p-5'}>{children}</div>
        </section>
    );
}

/** KPI tile with accent glow — tickets-scoped alternative to the stats module card. */
export function KpiCard({
    title,
    value,
    icon,
    accent,
}: {
    title: React.ReactNode;
    value: number | string;
    icon: React.ReactNode;
    accent: string;
}) {
    return (
        <div className="group relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-4 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] sm:p-5">
            <span
                aria-hidden
                className="pointer-events-none absolute inset-x-4 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accent} 55%, transparent), transparent)` }}
            />
            <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-[42px] transition-opacity duration-500 group-hover:opacity-50"
                style={{ background: accent }}
            />
            <div className="relative min-h-9 pr-12">
                <p className="min-w-0 break-words text-[11px] font-bold uppercase leading-[1.45] tracking-wider text-white/40">{title}</p>
                <span
                    className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5"
                    style={{
                        backgroundColor: `color-mix(in srgb, ${accent} 13%, transparent)`,
                        color: accent,
                        boxShadow: `0 0 22px color-mix(in srgb, ${accent} 22%, transparent)`,
                    }}
                >
                    {icon}
                </span>
            </div>
            <div className="mt-2 font-akony text-3xl tracking-tight text-white tabular-nums">{value}</div>
        </div>
    );
}

/** Section heading with glowing icon tile — used by config panels. */
export function SectionHeading({
    icon,
    title,
    desc,
    action,
}: {
    icon: React.ReactNode;
    title: React.ReactNode;
    desc?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-primary-1)]/20 bg-[linear-gradient(135deg,rgba(117,241,106,0.13),rgba(143,94,255,0.09))] text-[var(--color-primary-1)] shadow-[0_0_24px_rgba(117,241,106,0.12)] [&>svg]:h-[18px] [&>svg]:w-[18px]">
                    {icon}
                </span>
                <div className="min-w-0">
                    <h2 className="max-w-full break-words font-sans text-[15px] font-bold leading-snug text-white sm:text-base">{title}</h2>
                    {desc && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--text-muted)]">{desc}</p>}
                </div>
            </div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
    );
}

export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-14 text-center">
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage: 'radial-gradient(rgba(244,241,238,0.05) 1px, transparent 1.2px)',
                    backgroundSize: '22px 22px',
                    maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%)',
                }}
            />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03] text-white/30">
                {icon ?? <Tray size={26} weight="light" />}
            </span>
            <p className="relative text-sm font-bold text-white">{title}</p>
            {hint && <p className="relative max-w-sm text-xs text-[var(--text-muted)]">{hint}</p>}
            {action && <div className="relative mt-1">{action}</div>}
        </div>
    );
}

export function LoadingBlock({ label }: { label: string }) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-5 text-[var(--text-muted)]">
            <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-[var(--color-primary-1)]/25" style={{ animation: 'tkPulseRing 1.8s cubic-bezier(0,0,0.2,1) infinite' }} />
                <span className="absolute inset-0 rounded-full border border-[var(--color-primary-2)]/25" style={{ animation: 'tkPulseRing 1.8s cubic-bezier(0,0,0.2,1) infinite 0.6s' }} />
                <span className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--color-primary-1)]/15 border-t-[var(--color-primary-1)]" />
            </div>
            <p className="text-sm font-semibold">{label}</p>
        </div>
    );
}

export function ErrorState({ label, onRetry, retryLabel }: { label: string; onRetry?: () => void; retryLabel: string }) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-[var(--color-destructive)]/25" style={{ animation: 'tkPulseRing 2.2s cubic-bezier(0,0,0.2,1) infinite' }} />
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/[0.07] text-[var(--color-destructive)]">
                    <WarningCircle size={26} weight="duotone" />
                </span>
            </div>
            <p className="text-sm font-bold text-white">{label}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2 text-xs font-bold text-white transition-all hover:border-[var(--color-primary-1)]/40 hover:bg-[var(--color-primary-1)]/10 hover:shadow-[0_0_20px_rgba(117,241,106,0.15)]"
                >
                    {retryLabel}
                </button>
            )}
        </div>
    );
}

/** Small labeled metric used inside detail panels. */
export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
            <div className="text-sm font-semibold text-white">{children}</div>
        </div>
    );
}

export { readableOn };
