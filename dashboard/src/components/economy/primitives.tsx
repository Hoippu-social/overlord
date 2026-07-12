'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Broadcast, CaretDown, Check, CircleNotch, Coins, FolderSimple, Hash, Megaphone, SpeakerHigh, X, WarningCircle } from '@phosphor-icons/react';
import type { DiscordRoleRef, DiscordChannelRef, DiscordEmojiRef } from '@/lib/economy/types';

export function Panel({
    title,
    icon,
    action,
    children,
    className = '',
    bodyClassName = '',
}: {
    title?: React.ReactNode;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={`overflow-visible rounded-[24px] border border-[var(--border-divider)] bg-[var(--surface-card)] shadow-xl shadow-black/20 ${className}`}>
            {(title || action) && (
                <header className="flex min-h-[4.5rem] flex-wrap items-center gap-3 border-b border-[var(--border-divider)] px-5 py-4">
                    {icon && (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-divider)] bg-[var(--surface-hover)] text-[var(--color-primary-1)] [&>svg]:h-5 [&>svg]:w-5">
                            {icon}
                        </span>
                    )}
                    {title && (
                        <h3 className="min-w-0 flex-1 text-sm font-bold leading-tight text-[var(--text-primary)]">
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

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 px-6 py-14 text-center">
            <span className="mb-1 text-[var(--text-secondary)]">{icon ?? <Coins size={40} weight="duotone" />}</span>
            <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
            {hint && <p className="max-w-sm text-xs leading-relaxed text-[var(--text-secondary)]">{hint}</p>}
        </div>
    );
}

export function LoadingBlock({ label }: { label: string }) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
            <CircleNotch size={30} className="animate-spin text-[var(--color-primary-1)]" weight="bold" />
            <p className="text-sm font-semibold">{label}</p>
        </div>
    );
}

export function ErrorState({ label, onRetry, retryLabel }: { label: string; onRetry?: () => void; retryLabel: string }) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
            <WarningCircle size={40} weight="duotone" className="text-[var(--color-destructive)]" />
            <p className="text-sm font-bold text-[var(--text-primary)]">{label}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--border-focus)]"
                >
                    {retryLabel}
                </button>
            )}
        </div>
    );
}

export type Tone = 'primary' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_CHIP: Record<Tone, string> = {
    primary: 'border-[var(--color-primary-1)]/25 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]',
    warning: 'border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    danger: 'border-[var(--color-destructive)]/25 bg-[var(--color-destructive)]/12 text-[var(--color-destructive)]',
    info: 'border-[var(--color-primary-2)]/30 bg-[var(--color-primary-2)]/12 text-[var(--color-primary-2)]',
    neutral: 'border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)]',
};

export function Chip({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${TONE_CHIP[tone]} ${className}`}>
            {children}
        </span>
    );
}

export function RolePill({ name, color }: { name: string; color?: string | number | null }) {
    const hex = typeof color === 'number' && color > 0 ? `#${color.toString(16).padStart(6, '0')}` : typeof color === 'string' && color ? color : null;

    if (!hex) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-primary-2)]/30 bg-[var(--color-primary-2)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary-2)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-2)]" />
                {name}
            </span>
        );
    }

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

export function AgentAvatar({ name, avatar, size = 28 }: { name: string; avatar?: string | null; size?: number }) {
    const initials = name.split(/[\s#]/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
    if (avatar) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={avatar} alt={name} className="shrink-0 rounded-full border border-[var(--border-subtle)] object-cover" style={{ width: size, height: size }} />;
    }
    return (
        <span
            className="flex shrink-0 items-center justify-center rounded-full border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 font-akony text-[var(--color-primary-1)]"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {initials || '?'}
        </span>
    );
}

const inputClass =
    'h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-3 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors hover:border-[var(--border-divider)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-1)]/10';

export function LabeledField({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
            {children}
            {hint && <span className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{hint}</span>}
        </div>
    );
}

export function TextField({
    value,
    onChange,
    placeholder,
    type = 'text',
    className = '',
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    className?: string;
}) {
    return (
        <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} ${className}`}
        />
    );
}

export function NumberField({
    value,
    onChange,
    placeholder,
    min,
    max,
    step,
    allowNull = false,
    className = '',
}: {
    value: number | null;
    onChange: (v: number | null) => void;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    allowNull?: boolean;
    className?: string;
}) {
    return (
        <input
            type="number"
            value={value ?? ''}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return onChange(allowNull ? null : 0);
                const n = Number(raw);
                onChange(Number.isFinite(n) ? n : allowNull ? null : 0);
            }}
            className={`${inputClass} ${className}`}
        />
    );
}

export function MoneyField({
    value,
    onChange,
    placeholder,
    allowNull = false,
    className = '',
}: {
    value: string | null;
    onChange: (v: string | null) => void;
    placeholder?: string;
    allowNull?: boolean;
    className?: string;
}) {
    return (
        <input
            type="text"
            inputMode="numeric"
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9-]/g, '');
                if (cleaned === '' || cleaned === '-') return onChange(allowNull ? (cleaned === '' ? null : cleaned) : '0');
                onChange(cleaned);
            }}
            className={`${inputClass} ${className}`}
        />
    );
}

type SelectOption<T extends string | number> = {
    value: T;
    label: string;
    description?: string;
    disabled?: boolean;
    leading?: React.ReactNode;
};

export function SelectField<T extends string | number>({
    value,
    onChange,
    options,
    className = '',
    searchable = false,
    searchPlaceholder = 'Search...',
    renderValue,
    renderOption,
}: {
    value: T;
    onChange: (v: T) => void;
    options: SelectOption<T>[];
    className?: string;
    searchable?: boolean;
    searchPlaceholder?: string;
    renderValue?: (option: SelectOption<T>) => React.ReactNode;
    renderOption?: (option: SelectOption<T>, state: { selected: boolean }) => React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const selected = options.find((option) => String(option.value) === String(value));
    const visibleOptions = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase();
        if (!normalized) return options;
        return options.filter((option) =>
            [option.label, option.description]
                .filter(Boolean)
                .some((text) => text!.toLocaleLowerCase().includes(normalized))
        );
    }, [options, query]);

    const syncMenuPosition = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setMenuStyle({
            left: rect.left,
            top: rect.bottom + 6,
            width: rect.width,
        });
    };

    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setQuery('');
                setOpen(false);
            }
        };
        const handleReposition = () => syncMenuPosition();
        document.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={`relative min-w-0 ${className}`}>
            <button
                type="button"
                ref={triggerRef}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => {
                    if (open) {
                        setQuery('');
                    } else {
                        syncMenuPosition();
                    }
                    setOpen((next) => !next);
                }}
                className={`${inputClass} flex items-center justify-between gap-3 text-left`}
            >
                <span className="min-w-0 flex-1 truncate">
                    {selected ? renderValue?.(selected) ?? selected.label : '—'}
                </span>
                <CaretDown size={15} weight="bold" className={`shrink-0 text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div
                    className="fixed z-[80] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1.5 shadow-2xl shadow-black/40"
                    style={menuStyle}
                >
                    {searchable && (
                        <div className="border-b border-[var(--border-divider)] p-1.5">
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
                                className="h-9 w-full rounded-xl border border-[var(--border-divider)] bg-[var(--surface-hover)] px-3 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--border-focus)]"
                            />
                        </div>
                    )}
                    <div role="listbox" className="max-h-72 space-y-1 overflow-y-auto p-1">
                        {visibleOptions.map((option) => {
                            const isSelected = String(option.value) === String(value);
                            return (
                                <button
                                    key={String(option.value)}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    disabled={option.disabled}
                                    onClick={() => {
                                        if (option.disabled) return;
                                        onChange(option.value);
                                        setQuery('');
                                        setOpen(false);
                                    }}
                                    className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                                        isSelected
                                            ? 'border-[var(--border-focus)] bg-[var(--color-primary-1)]/10 text-[var(--text-primary)]'
                                            : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                                        {renderOption ? renderOption(option, { selected: isSelected }) : (
                                            <>
                                                {option.leading}
                                                <span className="min-w-0 truncate">{option.label}</span>
                                            </>
                                        )}
                                    </span>
                                    {isSelected && <Check size={14} weight="bold" className="shrink-0 text-[var(--color-primary-1)]" />}
                                </button>
                            );
                        })}
                        {visibleOptions.length === 0 && (
                            <div className="px-3 py-4 text-center text-xs font-semibold text-[var(--text-secondary)]">
                                —
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function normalizeDiscordColor(color?: string | number | null) {
    if (typeof color === 'number' && color > 0) return `#${color.toString(16).padStart(6, '0')}`;
    if (typeof color === 'string' && color && color !== '#0e0e0e' && color !== '0') {
        return color.startsWith('#') ? color : `#${color}`;
    }
    return null;
}

function RoleGlyph({ color }: { color?: string | number | null }) {
    const hex = normalizeDiscordColor(color);
    return (
        <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--border-divider)] bg-[var(--surface-hover)]"
            style={hex ? { borderColor: `${hex}55`, backgroundColor: `${hex}18` } : undefined}
        >
            <span className="h-2 w-2 rounded-full bg-[var(--text-secondary)]" style={hex ? { backgroundColor: hex } : undefined} />
        </span>
    );
}

export function RoleSelect({
    value,
    onChange,
    roles,
    placeholder = '—',
    className = '',
}: {
    value: string | null;
    onChange: (v: string | null) => void;
    roles: DiscordRoleRef[];
    placeholder?: string;
    className?: string;
}) {
    const options = useMemo(
        () => roles.map((role) => ({
            value: role.id,
            label: role.name,
            leading: <RoleGlyph color={role.color} />,
        })),
        [roles]
    );

    return (
        <SelectField
            value={value ?? ''}
            onChange={(next) => onChange(next || null)}
            options={[{ value: '', label: placeholder }, ...options]}
            className={className}
            searchable
            renderValue={(option) => (
                <span className="flex min-w-0 items-center gap-2">
                    {option.leading}
                    <span className="min-w-0 truncate">{option.label}</span>
                </span>
            )}
        />
    );
}

function getChannelKind(type?: string | number | null): 'category' | 'voice' | 'stage' | 'announcement' | 'forum' | 'media' | 'text' {
    switch (type) {
        case 4:
        case 'category':
        case 'GUILD_CATEGORY':
            return 'category';
        case 2:
        case 'voice':
        case 'GUILD_VOICE':
            return 'voice';
        case 13:
        case 'stage':
        case 'stage_voice':
        case 'GUILD_STAGE_VOICE':
        case 'cast':
            return 'stage';
        case 5:
        case 'announcement':
        case 'news':
        case 'GUILD_NEWS':
            return 'announcement';
        case 15:
        case 'forum':
        case 'GUILD_FORUM':
            return 'forum';
        case 16:
        case 'media':
        case 'GUILD_MEDIA':
            return 'media';
        default:
            return 'text';
    }
}

function ChannelGlyph({ type }: { type?: string | number | null }) {
    const kind = getChannelKind(type);
    const Icon = kind === 'category'
        ? FolderSimple
        : kind === 'voice'
            ? SpeakerHigh
            : kind === 'stage'
                ? Broadcast
                : kind === 'announcement'
                    ? Megaphone
                    : Hash;
    return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--border-divider)] bg-[var(--surface-hover)] text-[var(--text-secondary)]">
            <Icon size={14} weight="bold" />
        </span>
    );
}

export function ChannelSelect({
    value,
    onChange,
    channels,
    placeholder = '—',
    className = '',
}: {
    value: string | null;
    onChange: (v: string | null) => void;
    channels: DiscordChannelRef[];
    placeholder?: string;
    className?: string;
}) {
    const options = useMemo(() => {
        const categoryNames = new Map(
            channels
                .filter((channel) => getChannelKind(channel.type) === 'category')
                .map((channel) => [channel.id, channel.name])
        );
        return channels
            .filter((channel) => getChannelKind(channel.type) !== 'category')
            .map((channel) => ({
                value: channel.id,
                label: `#${channel.name}`,
                description: channel.parentId ? categoryNames.get(channel.parentId) : undefined,
                leading: <ChannelGlyph type={channel.type} />,
            }));
    }, [channels]);

    return (
        <SelectField
            value={value ?? ''}
            onChange={(next) => onChange(next || null)}
            options={[{ value: '', label: placeholder }, ...options]}
            className={className}
            searchable
            renderValue={(option) => (
                <span className="flex min-w-0 items-center gap-2">
                    {option.leading}
                    <span className="min-w-0 truncate">{option.label}</span>
                </span>
            )}
            renderOption={(option) => (
                <>
                    {option.leading}
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.description && (
                            <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                {option.description}
                            </span>
                        )}
                    </span>
                </>
            )}
        />
    );
}

const COMMON_EMOJIS = ['🪙', '💎', '⭐', '🏆', '🎟️', '🎁', '📦', '🔥', '⚡', '✨', '🛡️', '👑', '💰', '🎲', '🎯', '🔮'];

function resolveServerEmoji(value: string | null, serverEmojis: DiscordEmojiRef[]): DiscordEmojiRef | null {
    if (!value) return null;
    const direct = serverEmojis.find((emoji) => emoji.value === value);
    if (direct) return direct;

    const match = value.match(/^<a?:([A-Za-z0-9_~]+):(\d+)>$/);
    if (!match) return null;
    const [, name, id] = match;
    const known = serverEmojis.find((emoji) => emoji.id === id);
    if (known) return known;
    const animated = value.startsWith('<a:');
    return {
        id,
        name,
        animated,
        available: true,
        url: `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=48&quality=lossless`,
        value,
    };
}

export function EmojiPreview({ value, serverEmojis, className = '' }: { value: string | null; serverEmojis: DiscordEmojiRef[]; className?: string }) {
    const serverEmoji = resolveServerEmoji(value, serverEmojis);
    if (serverEmoji) {
        return (
            <span
                className={`inline-flex shrink-0 rounded-md bg-center bg-contain bg-no-repeat ${className}`}
                style={{ backgroundImage: `url(${serverEmoji.url})` }}
                role="img"
                aria-label={serverEmoji.name}
                title={serverEmoji.name}
            />
        );
    }
    return <span className={className}>{value || '-'}</span>;
}

export function EmojiField({
    value,
    onChange,
    customLabel = 'Custom emoji',
    serverEmojis = [],
    serverLabel = 'Server emoji',
}: {
    value: string | null;
    onChange: (v: string | null) => void;
    customLabel?: string;
    serverEmojis?: DiscordEmojiRef[];
    serverLabel?: string;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const selectedServerEmoji = resolveServerEmoji(value, serverEmojis);
    const visibleDisplayValue = selectedServerEmoji ? `:${selectedServerEmoji.name}:` : value || '-';

    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    React.useLayoutEffect(() => {
        if (!open) {
            setMenuPosition(null);
            return;
        }

        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const viewportPadding = 8;
            const width = Math.min(Math.max(rect.width, 288), window.innerWidth - viewportPadding * 2);
            const left = Math.min(Math.max(rect.left, viewportPadding), window.innerWidth - width - viewportPadding);
            const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
            const roomAbove = rect.top - viewportPadding;
            const estimatedMenuHeight = Math.min(460, window.innerHeight - viewportPadding * 2);
            const top = roomBelow < 280 && roomAbove > roomBelow
                ? Math.max(viewportPadding, rect.top - estimatedMenuHeight - 6)
                : rect.bottom + 6;
            setMenuPosition({ top, left, width });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative min-w-0">
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((next) => !next)}
                className={`${inputClass} flex items-center justify-between gap-3 text-left`}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--border-divider)] bg-[var(--surface-card)] text-base">
                        <EmojiPreview value={value} serverEmojis={serverEmojis} className="h-5 w-5 text-base leading-none" />
                    </span>
                    <span className="min-w-0 truncate">{visibleDisplayValue}</span>
                </span>
                <CaretDown size={15} weight="bold" className={`shrink-0 text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && menuPosition && createPortal(
                <div
                    ref={menuRef}
                    role="dialog"
                    aria-label={customLabel}
                    style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
                    className="fixed z-[100] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 shadow-2xl shadow-black/40"
                >
                    <div className="grid grid-cols-8 gap-1.5">
                        {COMMON_EMOJIS.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                    onChange(emoji);
                                    setOpen(false);
                                }}
                                className={`flex h-9 items-center justify-center rounded-xl border text-lg transition-colors ${
                                    value === emoji
                                        ? 'border-[var(--border-focus)] bg-[var(--color-primary-1)]/10'
                                        : 'border-[var(--border-divider)] bg-[var(--surface-hover)] hover:border-[var(--border-focus)]'
                                }`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                    {serverEmojis.length > 0 && (
                        <div className="mt-3 border-t border-[var(--border-divider)] pt-3">
                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                {serverLabel}
                            </span>
                            <div className="grid max-h-32 grid-cols-8 gap-1.5 overflow-y-auto pr-1">
                                {serverEmojis.map((emoji) => {
                                    const selected = value === emoji.value || selectedServerEmoji?.id === emoji.id;
                                    return (
                                        <button
                                            key={emoji.id}
                                            type="button"
                                            title={`:${emoji.name}:`}
                                            disabled={emoji.available === false}
                                            onClick={() => {
                                                onChange(emoji.value);
                                                setOpen(false);
                                            }}
                                            className={`flex h-9 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed ${
                                                selected
                                                    ? 'border-[var(--border-focus)] bg-[var(--color-primary-1)]/10'
                                                    : 'border-[var(--border-divider)] bg-[var(--surface-hover)] hover:border-[var(--border-focus)]'
                                            } ${emoji.available === false ? 'opacity-45' : ''}`}
                                        >
                                            <span
                                                className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                                                style={{ backgroundImage: `url(${emoji.url})` }}
                                                role="img"
                                                aria-label={emoji.name}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="mt-3 border-t border-[var(--border-divider)] pt-3">
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            {customLabel}
                        </span>
                        <div className="flex gap-2">
                            <input
                                value={value ?? ''}
                                onChange={(event) => onChange(event.target.value || null)}
                                placeholder="emoji или <:name:id>"
                                className={inputClass}
                            />
                            <button
                                type="button"
                                onClick={() => onChange(null)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                aria-label="Clear emoji"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-1)]/20 ${
                checked
                    ? 'border-[var(--color-primary-1)] bg-[var(--color-primary-1)] shadow-[0_0_18px_rgba(117,241,106,0.2)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-hover)] hover:border-[var(--border-divider)]'
            }`}
        >
            <span
                className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
                    checked ? 'translate-x-6 bg-black' : 'translate-x-1 bg-[var(--text-secondary)]'
                }`}
            />
        </button>
    );
}

export function ActionButton({
    children,
    onClick,
    variant = 'ghost',
    disabled = false,
    type = 'button',
    className = '',
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'ghost' | 'danger';
    disabled?: boolean;
    type?: 'button' | 'submit';
    className?: string;
}) {
    const variantClass =
        variant === 'primary'
            ? 'border border-[var(--color-primary-1)]/30 bg-[var(--color-primary-1)] text-black shadow-[0_12px_28px_rgba(117,241,106,0.12)] hover:brightness-110'
            : variant === 'danger'
              ? 'border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/20'
              : 'border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:border-[var(--border-divider)] hover:text-[var(--text-primary)]';
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold transition-all disabled:pointer-events-none disabled:border-[var(--border-subtle)] disabled:bg-[var(--surface-hover)] disabled:text-[var(--text-secondary)] disabled:opacity-80 ${variantClass} ${className}`}
        >
            {children}
        </button>
    );
}

export function ModalShell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-lg overflow-hidden rounded-[26px] border border-[var(--border-divider)] bg-[var(--surface-card)] shadow-2xl shadow-black/50"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-center justify-between gap-4 border-b border-[var(--border-divider)] px-5 py-4">
                    <h3 className="min-w-0 truncate text-base font-bold text-[var(--text-primary)]">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                        aria-label="Close modal"
                    >
                        <X size={15} weight="bold" />
                    </button>
                </header>
                <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
                {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-divider)] px-5 py-4">{footer}</footer>}
            </div>
        </div>
    );
}
