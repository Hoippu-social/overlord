'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown, Check, DotsSixVertical, Flag, Plus, Trash, Timer, WarningOctagon, SlidersHorizontal } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { MultiSelectField, SmoothToggle } from '@/components/moderation/ui';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';
import { formatDurationSeconds } from '@/lib/tickets/format';
import type { DiscordRoleRef, PriorityDef } from '@/lib/tickets/types';
import { Chip, EmptyState, SectionHeading, TermHint } from './primitives';

interface PrioritiesPanelProps {
    priorities: PriorityDef[];
    roles: DiscordRoleRef[];
    locale: LocaleCode;
    onSave: (priorities: PriorityDef[]) => Promise<void>;
}

const SWATCHES = ['#64748b', '#75f16a', '#8f5eff', '#38bdf8', '#f59e0b', '#f43f5e', '#22d3ee', '#e879f9'];
type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';
const UNIT_TO_SECONDS: Record<DurationUnit, number> = { seconds: 1, minutes: 60, hours: 3_600, days: 86_400 };

function DurationUnitSelect({ value, onChange, locale, compact = false }: { value: DurationUnit; onChange: (unit: DurationUnit) => void; locale: LocaleCode; compact?: boolean }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const short = getTicketsCopy(locale).priorities;
    const names: Record<DurationUnit, string> = locale === 'ru'
        ? { seconds: 'Секунды', minutes: 'Минуты', hours: 'Часы', days: 'Дни' }
        : { seconds: 'Seconds', minutes: 'Minutes', hours: 'Hours', days: 'Days' };
    const units: DurationUnit[] = ['seconds', 'minutes', 'hours', 'days'];

    useEffect(() => {
        if (!open) return;
        const closeOnOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('pointerdown', closeOnOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    React.useLayoutEffect(() => {
        if (!open) {
            setPosition(null);
            return;
        }
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const padding = 8;
            const width = Math.min(compact ? 180 : 220, window.innerWidth - padding * 2);
            const left = Math.min(Math.max(rect.right - width, padding), window.innerWidth - width - padding);
            const menuHeight = 224;
            const roomBelow = window.innerHeight - rect.bottom - padding;
            const top = roomBelow >= menuHeight || roomBelow >= rect.top
                ? rect.bottom + 6
                : Math.max(padding, rect.top - menuHeight - 6);
            setPosition({ top, left, width });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [compact, open]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={short.unit}
                onClick={() => setOpen((current) => !current)}
                className={`flex h-[42px] w-full items-center gap-1.5 rounded-xl border bg-black/20 text-left text-xs font-semibold text-white/90 outline-none transition-all ${compact ? 'px-2' : 'px-3'} ${open ? 'border-[var(--color-primary-1)] ring-2 ring-[var(--color-primary-1)]/20' : 'border-white/10 hover:border-white/20 hover:bg-black/40'}`}
            >
                <Timer size={compact ? 14 : 16} weight="duotone" className="shrink-0 text-[var(--color-primary-1)]" />
                <span className="min-w-0 flex-1 truncate">{short[value]}</span>
                <CaretDown size={13} weight="bold" className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && position && createPortal(
                <div
                    ref={menuRef}
                    role="listbox"
                    aria-label={short.unit}
                    style={{ top: position.top, left: position.left, width: position.width }}
                    className="fixed z-[200] rounded-2xl border border-white/10 bg-[#111111] p-2 shadow-2xl shadow-black/60"
                >
                    {units.map((unit) => {
                        const selected = unit === value;
                        return (
                            <button
                                key={unit}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                    onChange(unit);
                                    setOpen(false);
                                    triggerRef.current?.focus();
                                }}
                                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-[var(--color-primary-1)]/35 bg-[var(--color-primary-1)]/10 text-white' : 'border-transparent text-white/75 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'}`}
                            >
                                <Timer size={18} weight="duotone" className={selected ? 'text-[var(--color-primary-1)]' : 'text-white/40'} />
                                <span className="min-w-0 flex-1 text-sm font-semibold">{names[unit]}</span>
                                {selected && <Check size={16} weight="bold" className="shrink-0 text-[var(--color-primary-1)]" />}
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </>
    );
}

function DurationField({ valueSeconds, onChange, locale, label, compact = false }: { valueSeconds: number; onChange: (seconds: number) => void; locale: LocaleCode; label: string; compact?: boolean }) {
    const [unit, setUnit] = useState<DurationUnit>(() => valueSeconds > 0 && valueSeconds % 86_400 === 0 ? 'days' : valueSeconds >= 3_600 && valueSeconds % 3_600 === 0 ? 'hours' : valueSeconds >= 60 && valueSeconds % 60 === 0 ? 'minutes' : 'seconds');
    const displayValue = valueSeconds / UNIT_TO_SECONDS[unit];
    return (
        <div className={`grid w-full min-w-0 items-center gap-1.5 ${compact ? 'grid-cols-[minmax(72px,1fr)_88px]' : 'grid-cols-[minmax(84px,1fr)_112px]'}`}>
            <input type="number" min={unit === 'seconds' ? 1 : 0} step={1} value={Number.isFinite(displayValue) ? displayValue : 0} onChange={(event) => onChange(Math.max(unit === 'seconds' ? 1 : 0, Math.round(Number(event.target.value) * UNIT_TO_SECONDS[unit])))} className="h-[42px] min-w-0 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white/90 outline-none transition-all focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20" aria-label={label} />
            <div className="min-w-0">
                <DurationUnitSelect value={unit} onChange={setUnit} locale={locale} compact={compact} />
            </div>
        </div>
    );
}

function HexColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center gap-3">
            <label className="relative flex h-9 shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-black/20 px-2.5">
                <span className="h-4 w-4 rounded-[5px]" style={{ backgroundColor: value }} />
                <span className="font-mono text-[10px] font-bold uppercase text-white/50">{value}</span>
                <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="color" />
            </label>
            <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map((c) => (
                    <button
                        key={c}
                        onClick={() => onChange(c)}
                        className={`h-4 w-4 rounded-[5px] border transition-transform hover:scale-110 ${value === c ? 'border-white/70' : 'border-white/10'}`}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                    />
                ))}
            </div>
        </div>
    );
}

export function PrioritiesPanel({ priorities, roles, locale, onSave }: PrioritiesPanelProps) {
    const t = getTicketsCopy(locale);
    const [draft, setDraft] = useState<PriorityDef[]>(priorities);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const roleOptions = roles.map((r) => ({ id: r.id, name: r.name, color: typeof r.color === 'string' ? r.color : undefined }));

    const update = (id: string, patch: Partial<PriorityDef>) => {
        setDraft((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
        setDirty(true);
    };
    const updateAutomation = (id: string, patch: Partial<PriorityDef['automation']>) => {
        setDraft((prev) => prev.map((p) => (p.id === id ? { ...p, automation: { ...p.automation, ...patch } } : p)));
        setDirty(true);
    };
    const addPriority = () => {
        const id = `p-custom-${Date.now()}`;
        setDraft((prev) => [
            ...prev,
            { id, name: locale === 'ru' ? 'Новый приоритет' : 'New priority', color: '#38bdf8', slaMinutes: 480, slaSeconds: 28_800, escalateAfterMinutes: null, escalateAfterSeconds: null, notifyRoleIds: [], order: prev.length, system: false, automation: { autoAssign: false, lockOnResolve: false, pageOnBreach: false } },
        ]);
        setDirty(true);
    };
    const removePriority = (id: string) => {
        setDraft((prev) => prev.filter((p) => p.id !== id));
        setDirty(true);
    };
    const toggleCollapsed = (id: string) => {
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const reorderPriorities = (sourceId: string, targetId: string) => {
        if (sourceId === targetId) return;
        setDraft((prev) => {
            const visual = [...prev].sort((a, b) => b.order - a.order);
            const sourceIndex = visual.findIndex((priority) => priority.id === sourceId);
            const targetIndex = visual.findIndex((priority) => priority.id === targetId);
            if (sourceIndex < 0 || targetIndex < 0) return prev;
            const [moved] = visual.splice(sourceIndex, 1);
            visual.splice(targetIndex, 0, moved);
            return visual.map((priority, index) => ({ ...priority, order: visual.length - index - 1 }));
        });
        setDirty(true);
    };
    const save = async () => {
        setSaving(true);
        try {
            await onSave(draft);
            setDirty(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <SectionHeading
                icon={<Flag weight="duotone" />}
                title={t.priorities.heading}
                desc={t.priorities.desc}
                action={
                    <button onClick={addPriority} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#75f16a] to-[#9dff94] px-4 py-2 text-xs font-bold text-black shadow-[0_0_20px_rgba(117,241,106,0.25)] transition-shadow hover:shadow-[0_0_30px_rgba(117,241,106,0.4)]">
                        <Plus size={14} weight="bold" /> {t.priorities.add}
                    </button>
                }
            />

            <div className="space-y-3">
                {draft.length === 0 ? (
                    <EmptyState
                        title={t.priorities.noPriorities}
                        hint={t.priorities.noPrioritiesHint}
                        icon={<Flag size={26} weight="light" />}
                        action={<button onClick={addPriority} className="rounded-full bg-[var(--color-primary-1)] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[var(--color-primary-2)] hover:text-white">{t.priorities.add}</button>}
                    />
                ) : [...draft].sort((a, b) => b.order - a.order).map((priority) => {
                    const collapsed = collapsedIds.has(priority.id);
                    const dragging = draggedId === priority.id;
                    const dragTarget = dragOverId === priority.id && !dragging;
                    return (
                    <div
                        key={priority.id}
                        onDragOver={(event) => { event.preventDefault(); setDragOverId(priority.id); }}
                        onDrop={(event) => { event.preventDefault(); if (draggedId) reorderPriorities(draggedId, priority.id); setDraggedId(null); setDragOverId(null); }}
                        className={`relative overflow-hidden rounded-[20px] border bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] pl-6 pr-5 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)] transition-all duration-200 ${collapsed ? 'py-3' : 'py-5'} ${dragging ? 'scale-[0.99] border-[var(--color-primary-1)]/30 opacity-55' : dragTarget ? 'border-[var(--color-primary-1)]/60 shadow-[0_0_0_2px_rgba(117,241,106,0.12)]' : 'border-white/[0.06] hover:border-white/[0.1]'}`}
                    >
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 left-3 w-1"
                            style={{ background: priority.color }}
                        />
                        <div className={`flex items-center gap-3 ${collapsed ? '' : 'mb-4 border-b border-[var(--border-divider)] pb-3'}`}>
                            <button
                                type="button"
                                draggable
                                onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', priority.id); setDraggedId(priority.id); }}
                                onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                                className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-white/25 transition-colors hover:bg-white/[0.05] hover:text-white/65 active:cursor-grabbing"
                                aria-label={locale === 'ru' ? 'Перетащить приоритет' : 'Drag priority'}
                            >
                                <DotsSixVertical size={18} weight="bold" />
                            </button>
                            <button type="button" onClick={() => toggleCollapsed(priority.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: priority.color, boxShadow: `0 0 10px ${priority.color}66` }} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-white">{priority.name}</span>
                                    <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">SLA · {formatDurationSeconds(priority.slaSeconds, locale)}{priority.escalateAfterSeconds ? ` · ${t.priorities.escalateAfter.toLowerCase()} ${formatDurationSeconds(priority.escalateAfterSeconds, locale)}` : ''}</span>
                                </span>
                                {priority.system && <Chip tone="neutral">{t.priorities.systemTemplate}</Chip>}
                                <CaretDown size={16} className={`shrink-0 text-[var(--text-muted)] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                            </button>
                        </div>
                        {!collapsed && (
                        <div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
                            {/* Name + color */}
                            <div className="sm:col-span-2 lg:col-span-4">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t.priorities.name}</label>
                                    <span />
                                </div>
                                <input
                                    value={priority.name}
                                    onChange={(e) => update(priority.id, { name: e.target.value })}
                                    className="mb-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20"
                                />
                                <HexColorField value={priority.color} onChange={(v) => update(priority.id, { color: v })} />
                            </div>

                            {/* SLA */}
                            <div className="sm:col-span-1 lg:col-span-4">
                                <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                    <Timer size={12} /> {t.priorities.slaTarget}<TermHint explanation={t.terms.sla} />
                                </label>
                                <DurationField valueSeconds={priority.slaSeconds} onChange={(slaSeconds) => update(priority.id, { slaSeconds, slaMinutes: Math.ceil(slaSeconds / 60) })} locale={locale} label={t.priorities.slaTarget} />
                                <p className="mt-1 text-[11px] text-[var(--text-muted)]">≈ {formatDurationSeconds(priority.slaSeconds, locale)}</p>
                            </div>

                            {/* Escalate */}
                            <div className="sm:col-span-1 lg:col-span-4">
                                <label className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                    <span className="inline-flex items-center gap-1.5"><WarningOctagon size={12} /> {t.priorities.escalateAfter}<TermHint explanation={t.terms.escalation} /></span>
                                    {priority.escalateAfterMinutes !== null && <button onClick={() => update(priority.id, { escalateAfterMinutes: null, escalateAfterSeconds: null })} className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]" aria-label="disable escalation"><Trash size={13} /></button>}
                                </label>
                                {priority.escalateAfterMinutes === null ? (
                                    <button onClick={() => update(priority.id, { escalateAfterMinutes: 1, escalateAfterSeconds: 60 })} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:text-white">
                                        {t.priorities.escalateOff}
                                    </button>
                                ) : (
                                    <DurationField valueSeconds={priority.escalateAfterSeconds ?? 60} onChange={(escalateAfterSeconds) => update(priority.id, { escalateAfterSeconds, escalateAfterMinutes: Math.ceil(escalateAfterSeconds / 60) })} locale={locale} label={t.priorities.escalateAfter} />
                                )}
                            </div>

                        </div>

                        {/* Notify roles */}
                        <div className="mt-4 border-t border-[var(--border-divider)] pt-4">
                            <MultiSelectField
                                label={t.priorities.notifyRoles}
                                options={roleOptions}
                                selected={priority.notifyRoleIds}
                                onChange={(ids) => update(priority.id, { notifyRoleIds: ids })}
                                placeholder={t.notifications.noRoles}
                            />
                        </div>

                        {/* Automation */}
                        <div className="mt-4 border-t border-[var(--border-divider)] pt-4">
                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                <SlidersHorizontal size={12} /> {t.priorities.automation}<TermHint explanation={t.terms.automation} />
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <SmoothToggle label={<span className="inline-flex items-center">{t.priorities.autoAssign}<TermHint explanation={t.terms.autoAssign} /></span>} checked={priority.automation.autoAssign} onChange={(v) => updateAutomation(priority.id, { autoAssign: v })} />
                                <SmoothToggle label={<span className="inline-flex items-center">{t.priorities.lockOnResolve}<TermHint explanation={t.terms.lockOnResolve} /></span>} checked={priority.automation.lockOnResolve} onChange={(v) => updateAutomation(priority.id, { lockOnResolve: v })} />
                                <SmoothToggle label={<span className="inline-flex items-center">{t.priorities.pageOnBreach}<TermHint explanation={t.terms.paging} /></span>} checked={priority.automation.pageOnBreach} onChange={(v) => updateAutomation(priority.id, { pageOnBreach: v })} />
                            </div>
                        </div>

                        {!priority.system && (
                            <div className="mt-3 flex justify-end">
                                <button onClick={() => removePriority(priority.id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--color-destructive)]">
                                    <Trash size={13} /> {t.priorities.remove}
                                </button>
                            </div>
                        )}
                        </div>
                        )}
                    </div>
                    );
                })}
            </div>

            <FloatingSaveBar
                visible={dirty}
                saving={saving}
                saveLabel={t.save}
                savingLabel={t.saving}
                resetLabel={t.reset}
                onSave={save}
                onReset={() => { setDraft(priorities); setDirty(false); }}
            />
        </div>
    );
}
