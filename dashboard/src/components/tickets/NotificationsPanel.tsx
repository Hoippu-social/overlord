'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash, BellRinging, Hash, PaperPlaneTilt, Check } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { InteractiveSelect, MultiSelectField, SmoothToggle } from '@/components/moderation/ui';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';
import type { DiscordRoleRef, NotificationRule, PriorityDef, TicketCategoryDef } from '@/lib/tickets/types';
import { EmptyState, PriorityDotSwatch, SectionHeading, TermHint } from './primitives';
import { DiscordOpsPreview } from './DiscordOpsPreview';

type EventKey = 'created' | 'escalated' | 'overdue' | 'transfer';
const EVENTS: EventKey[] = ['created', 'escalated', 'overdue', 'transfer'];

interface NotificationsPanelProps {
    rules: NotificationRule[];
    priorities: PriorityDef[];
    roles: DiscordRoleRef[];
    categories: TicketCategoryDef[];
    locale: LocaleCode;
    onSave: (rules: NotificationRule[]) => Promise<void>;
}

export function NotificationsPanel({ rules, priorities, roles, categories, locale, onSave }: NotificationsPanelProps) {
    const t = getTicketsCopy(locale);
    const [draft, setDraft] = useState<NotificationRule[]>(rules);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tested, setTested] = useState<string | null>(null);

    const priorityById = useMemo(() => new Map(priorities.map((p) => [p.id, p])), [priorities]);
    const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
    const roleOptions = roles.map((r) => ({ id: r.id, name: r.name, color: typeof r.color === 'string' ? r.color : undefined }));
    const channelOptions = useMemo(() => {
        const fromCategories = categories
            .filter((c) => c.discordChannelId)
            .map((c) => ({ id: c.discordChannelId!, name: `#${c.discordChannelName}` }));
        return [{ id: '1000000000000000009', name: '#support-alerts' }, ...fromCategories];
    }, [categories]);

    const update = (id: string, patch: Partial<NotificationRule>) => {
        setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
        setDirty(true);
    };
    const toggleEvent = (id: string, event: EventKey) => {
        setDraft((prev) => prev.map((r) => r.id === id ? { ...r, events: r.events.includes(event) ? r.events.filter((e) => e !== event) : [...r.events, event] } : r));
        setDirty(true);
    };
    const addRule = () => {
        const fallbackPriority = priorities[priorities.length - 1]?.id ?? 'p-normal';
        setDraft((prev) => [...prev, { id: `nr-${Date.now()}`, priorityId: fallbackPriority, roleIds: [], channelId: channelOptions[0]?.id ?? null, enabled: true, events: ['created'] }]);
        setDirty(true);
    };
    const removeRule = (id: string) => {
        setDraft((prev) => prev.filter((r) => r.id !== id));
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
                icon={<BellRinging weight="duotone" />}
                title={<span className="inline-flex items-center">{t.notifications.heading}<TermHint explanation={t.terms.notificationRule} /></span>}
                desc={t.notifications.desc}
                action={
                    <button onClick={addRule} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#75f16a] to-[#9dff94] px-4 py-2 text-xs font-bold text-black shadow-[0_0_20px_rgba(117,241,106,0.25)] transition-shadow hover:shadow-[0_0_30px_rgba(117,241,106,0.4)]">
                        <Plus size={14} weight="bold" /> {t.notifications.add}
                    </button>
                }
            />

            {draft.length === 0 ? (
                <EmptyState
                    title={t.notifications.noRules}
                    hint={t.notifications.noRulesHint}
                    icon={<BellRinging size={26} weight="light" />}
                    action={<button onClick={addRule} className="rounded-full bg-[var(--color-primary-1)] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[var(--color-primary-2)] hover:text-white">{t.notifications.add}</button>}
                />
            ) : (
                <div className="space-y-3">
                    {draft.map((rule) => {
                        const priority = priorityById.get(rule.priorityId);
                        const mentionNames = rule.roleIds.map((id) => roleById.get(id)?.name).filter(Boolean) as string[];
                        return (
                            <div key={rule.id} className="relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-5 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)] transition-colors duration-300 hover:border-white/[0.1]">
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-x-4 top-0 h-px"
                                    style={{ background: `linear-gradient(90deg, transparent, ${priority?.color ?? 'rgba(244,241,238,0.14)'}${priority ? '88' : ''}, transparent)` }}
                                />
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        {priority && <PriorityDotSwatch color={priority.color} />}
                                        <span className="truncate text-sm font-bold text-white">
                                            {t.notifications.whenPriority} <span style={{ color: priority?.color }}>{priority?.name}</span><TermHint explanation={t.terms.priority} />
                                        </span>
                                    </div>
                                    <SmoothToggle label="" checked={rule.enabled} onChange={(v) => update(rule.id, { enabled: v })} />
                                </div>

                                <div className={`transition-opacity duration-300 ${rule.enabled ? '' : 'pointer-events-none opacity-40'}`}>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                    <InteractiveSelect
                                        label={t.inbox.priority}
                                        value={rule.priorityId}
                                        onChange={(v) => update(rule.id, { priorityId: v })}
                                        options={priorities.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                                    />
                                    <div className="lg:col-span-1">
                                        <MultiSelectField
                                            label={t.notifications.notifyRoles}
                                            options={roleOptions}
                                            selected={rule.roleIds}
                                            onChange={(ids) => update(rule.id, { roleIds: ids })}
                                            placeholder={t.notifications.noRoles}
                                        />
                                    </div>
                                    <InteractiveSelect
                                        label={t.notifications.channel}
                                        value={rule.channelId ?? ''}
                                        onChange={(v) => update(rule.id, { channelId: v || null })}
                                        placeholder="#—"
                                        icon={<Hash size={16} />}
                                        options={channelOptions}
                                    />
                                </div>

                                {/* Events */}
                                <div className="mt-4">
                                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t.notifications.events}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {EVENTS.map((event) => {
                                            const active = rule.events.includes(event);
                                            return (
                                                <button
                                                    key={event}
                                                    onClick={() => toggleEvent(rule.id, event)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${active ? 'border-[var(--border-focus)] bg-[var(--color-primary-1)]/10 text-white' : 'border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-white'}`}
                                                >
                                                    {t.notifications.eventLabels[event]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-[var(--text-muted)]">
                                        <span className="inline-flex items-center">{t.notifications.eventLabels.escalated}<TermHint explanation={t.terms.escalation} /></span>
                                        <span className="inline-flex items-center">{t.notifications.eventLabels.transfer}<TermHint explanation={t.terms.transfer} /></span>
                                    </div>
                                </div>

                                {/* Ping preview */}
                                <div className="mt-4 border-t border-[var(--border-divider)] pt-4">
                                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t.notifications.preview}</div>
                                    <DiscordOpsPreview
                                        channelName={channelOptions.find((c) => c.id === rule.channelId)?.name.replace('#', '') ?? null}
                                        accent={priority?.color ?? '#75f16a'}
                                        title={`${priority?.name ?? ''} · ${t.notifications.eventLabels.created}`}
                                        description={locale === 'ru' ? 'Новое обращение ожидает ответа команды.' : 'A new ticket is waiting for the team.'}
                                        mentions={mentionNames.length > 0 ? mentionNames : undefined}
                                    />
                                    <div className="mt-3 flex items-center gap-3">
                                        <button
                                            onClick={() => { setTested(rule.id); setTimeout(() => setTested((cur) => (cur === rule.id ? null : cur)), 2000); }}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--surface-card)]"
                                        >
                                            <PaperPlaneTilt size={14} /> {t.notifications.test}
                                        </button>
                                        {tested === rule.id && <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary-1)]"><Check size={14} weight="bold" /> {t.notifications.testSent}</span>}
                                        <button onClick={() => removeRule(rule.id)} className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--color-destructive)]">
                                            <Trash size={13} /> {t.priorities.remove}
                                        </button>
                                    </div>
                                </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <FloatingSaveBar
                visible={dirty}
                saving={saving}
                saveLabel={t.save}
                savingLabel={t.saving}
                resetLabel={t.reset}
                onSave={save}
                onReset={() => { setDraft(rules); setDirty(false); }}
            />
        </div>
    );
}
