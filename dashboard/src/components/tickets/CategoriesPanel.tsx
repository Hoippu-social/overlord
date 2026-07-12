'use client';

import React, { useMemo, useState } from 'react';
import {
    ArrowRight,
    ChatCircleDots,
    Hash,
    ListChecks,
    Lock,
    MagnifyingGlass,
    Plus,
    Ticket as TicketGlyph,
    Trash,
} from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { InteractiveSelect } from '@/components/moderation/ui';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';
import { EmojiField } from '@/components/economy/primitives';
import type { DiscordChannelRef, DiscordEmojiRef } from '@/lib/economy/types';
import type { DiscordRoleRef, IntakeField, IntakeFieldType, PriorityDef, TicketCategoryDef, ThreadBehavior } from '@/lib/tickets/types';
import { sendTicketPanelPreview } from '@/lib/tickets/api';
import { createDefaultTicketPanelDesign, parseTicketPanelMessageDesign, serializeTicketPanelMessageDesign } from '@/lib/tickets/messageDesign';
import { Chip, EmptyState, PriorityTag, RolePill, SectionHeading, TermHint } from './primitives';
import { TicketPanelMessageDesigner } from './TicketPanelMessageDesigner';
import { TicketCategoryFlowEditor } from './TicketCategoryFlowEditor';

interface CategoriesPanelProps {
    guildId: string;
    categories: TicketCategoryDef[];
    priorities: PriorityDef[];
    roles: DiscordRoleRef[];
    channels: DiscordChannelRef[];
    serverEmojis: DiscordEmojiRef[];
    locale: LocaleCode;
    onSave: (categories: TicketCategoryDef[]) => Promise<void>;
}

const BEHAVIORS: ThreadBehavior[] = ['channel', 'public_thread', 'private_thread'];
const FIELD_TYPES: IntakeFieldType[] = ['short', 'paragraph', 'number', 'select'];

export function CategoriesPanel({ guildId, categories, priorities, roles, channels, serverEmojis, locale, onSave }: CategoriesPanelProps) {
    const t = getTicketsCopy(locale);
    const [draft, setDraft] = useState<TicketCategoryDef[]>(categories);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [previewStateById, setPreviewStateById] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({});

    const priorityById = useMemo(() => new Map(priorities.map((p) => [p.id, p])), [priorities]);
    const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
    const roleOptions = roles.map((r) => ({ id: r.id, name: r.name, color: typeof r.color === 'string' ? r.color : undefined }));
    const channelOptions = channels.map((channel) => ({ id: channel.id, name: channel.name, type: channel.type, parentId: channel.parentId }));

    const behaviorOptions = BEHAVIORS.map((b) => ({ id: b, name: t.threadBehavior[b] }));
    const fieldTypeLabel = t.categories.fieldTypes;

    const update = (id: string, patch: Partial<TicketCategoryDef>) => {
        setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
        setDirty(true);
    };

    const updateCategoryEmoji = (id: string, emoji: string | null) => {
        setDraft((prev) => prev.map((category) => {
            if (category.id !== id) return category;
            const design = parseTicketPanelMessageDesign(category.messageDesignJson, {
                name: category.name,
                messageText: category.messageText ?? category.description ?? null,
                messageEmbeds: category.messageEmbeds ?? null,
                buttonText: category.buttonText ?? null,
                buttonEmoji: category.emoji ?? null,
                buttonStyle: category.buttonStyle ?? null,
            });
            return {
                ...category,
                emoji,
                messageDesignJson: serializeTicketPanelMessageDesign({ ...design, opener: { ...design.opener, emoji } }),
            };
        }));
        setDirty(true);
    };

    const updateField = (catId: string, fieldId: string, patch: Partial<IntakeField>) => {
        setDraft((prev) => prev.map((c) => c.id === catId ? { ...c, intakeFields: c.intakeFields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) } : c));
        setDirty(true);
    };

    const updateFieldOption = (catId: string, fieldId: string, optionIndex: number, value: string) => {
        setDraft((prev) => prev.map((category) => category.id === catId ? {
            ...category,
            intakeFields: category.intakeFields.map((field) => {
                if (field.id !== fieldId) return field;
                return { ...field, options: (field.options ?? []).map((option, index) => index === optionIndex ? value : option) };
            }),
        } : category));
        setDirty(true);
    };

    const addFieldOption = (catId: string, fieldId: string) => {
        setDraft((prev) => prev.map((category) => category.id === catId ? {
            ...category,
            intakeFields: category.intakeFields.map((field) => field.id === fieldId ? { ...field, options: [...(field.options ?? []), ''] } : field),
        } : category));
        setDirty(true);
    };

    const removeFieldOption = (catId: string, fieldId: string, optionIndex: number) => {
        setDraft((prev) => prev.map((category) => category.id === catId ? {
            ...category,
            intakeFields: category.intakeFields.map((field) => field.id === fieldId ? { ...field, options: (field.options ?? []).filter((_, index) => index !== optionIndex) } : field),
        } : category));
        setDirty(true);
    };

    const addField = (catId: string) => {
        setDraft((prev) => prev.map((c) => c.id === catId ? { ...c, intakeFields: [...c.intakeFields, { id: `f-${Date.now()}`, label: t.categories.newFieldLabel, type: 'short', required: false }] } : c));
        setDirty(true);
    };

    const removeField = (catId: string, fieldId: string) => {
        setDraft((prev) => prev.map((c) => c.id === catId ? { ...c, intakeFields: c.intakeFields.filter((f) => f.id !== fieldId) } : c));
        setDirty(true);
    };

    const addCategory = () => {
        const name = t.categories.newCategoryName;
        const messageDesignJson = serializeTicketPanelMessageDesign(createDefaultTicketPanelDesign(name));
        setDraft((prev) => [...prev, {
            id: `c-${Date.now()}`,
            name,
            emoji: '🎫',
            description: '',
            messageText: null,
            messageEmbeds: JSON.stringify([]),
            messageDesignJson,
            buttonText: t.categories.createTicketButton,
            buttonStyle: 'PRIMARY',
            defaultPriorityId: priorities.find((p) => p.system)?.id ?? priorities[0]?.id ?? 'p-normal',
            defaultOwnerRoleId: null,
            discordChannelId: null,
            discordChannelName: null,
            threadBehavior: 'private_thread',
            intakeFields: [{ id: `f-${Date.now()}`, label: t.categories.defaultIntakeLabel, type: 'paragraph', required: true }],
            entryPoints: [{
                id: `entry-${Date.now()}`,
                label: t.categories.createTicketButton,
                emoji: null,
                style: 'PRIMARY',
                presentation: 'button',
                fields: [{ id: `f-${Date.now()}`, label: t.categories.defaultIntakeLabel, type: 'paragraph', required: true }],
            }],
            ghostReplies: [],
            openCount: 0,
            totalCount: 0,
        }]);
        setDirty(true);
    };

    const removeCategory = (id: string) => {
        setDraft((prev) => prev.filter((c) => c.id !== id));
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

    const sendPreview = async (category: TicketCategoryDef, messageDesignJson: string) => {
        setPreviewStateById((prev) => ({ ...prev, [category.id]: 'sending' }));
        try {
            await sendTicketPanelPreview(guildId, category.id, {
                messageDesignJson,
                channelId: category.discordChannelId ?? null,
            });
            setPreviewStateById((prev) => ({ ...prev, [category.id]: 'sent' }));
            window.setTimeout(() => setPreviewStateById((prev) => ({ ...prev, [category.id]: 'idle' })), 2500);
        } catch {
            setPreviewStateById((prev) => ({ ...prev, [category.id]: 'error' }));
            window.setTimeout(() => setPreviewStateById((prev) => ({ ...prev, [category.id]: 'idle' })), 3500);
        }
    };

    const visible = draft.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
    return (
        <div className="space-y-5 animate-fade-in">
            <SectionHeading
                icon={<TicketGlyph weight="duotone" />}
                title={<span className="inline-flex items-center">{t.categories.heading}<TermHint explanation={t.terms.routing} /></span>}
                desc={t.categories.desc}
                action={
                    <>
                        <div className="relative">
                            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={15} />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.categories.search} className="h-9 w-44 rounded-full border border-white/[0.07] bg-white/[0.03] pl-9 pr-3 text-xs text-white outline-none transition-colors placeholder:text-white/30 hover:border-white/[0.14] focus:border-[var(--color-primary-1)]/50" />
                        </div>
                        <button onClick={addCategory} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#75f16a] to-[#9dff94] px-4 py-2 text-xs font-bold text-black shadow-[0_0_20px_rgba(117,241,106,0.25)] transition-shadow hover:shadow-[0_0_30px_rgba(117,241,106,0.4)]">
                            <Plus size={14} weight="bold" /> {t.categories.add}
                        </button>
                    </>
                }
            />

            <div className="space-y-4">
                {visible.length === 0 ? (
                    <EmptyState
                        title={search.trim() ? t.categories.noSearchResults : t.categories.noCategories}
                        hint={search.trim() ? undefined : t.categories.noCategoriesHint}
                        icon={<TicketGlyph size={26} weight="light" />}
                        action={!search.trim() ? (
                            <button onClick={addCategory} className="rounded-full bg-[var(--color-primary-1)] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[var(--color-primary-2)] hover:text-white">
                                {t.categories.add}
                            </button>
                        ) : undefined}
                    />
                ) : visible.map((category) => {
                    const priority = priorityById.get(category.defaultPriorityId);
                    const owner = category.defaultOwnerRoleId ? roleById.get(category.defaultOwnerRoleId) : null;
                    const isAppeals = category.systemManagedBy === 'appeals';
                    return (
                        <div key={category.id} className={`relative rounded-[20px] border p-5 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)] transition-colors duration-300 ${isAppeals ? 'border-[var(--color-primary-1)]/25 bg-[linear-gradient(180deg,rgba(117,241,106,0.05),rgba(117,241,106,0.015))]' : 'border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] hover:border-white/[0.1]'}`}>
                            <span aria-hidden className="pointer-events-none absolute inset-x-4 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${isAppeals ? 'rgba(117,241,106,0.4)' : 'rgba(244,241,238,0.14)'}, transparent)` }} />
                            <div className="mb-4 flex items-start gap-3">
                                <div className="w-20 shrink-0" aria-label={t.categories.emoji}>
                                    <EmojiField
                                        value={category.emoji ?? null}
                                        onChange={(emoji) => updateCategoryEmoji(category.id, emoji)}
                                        customLabel={locale === 'ru' ? 'Свой эмодзи' : 'Custom emoji'}
                                        serverLabel={locale === 'ru' ? 'Эмодзи сервера' : 'Server emoji'}
                                        serverEmojis={serverEmojis}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            value={category.name}
                                            onChange={(e) => update(category.id, { name: e.target.value })}
                                            disabled={isAppeals}
                                            aria-label={locale === 'ru' ? 'Название категории' : 'Category name'}
                                            className="w-full max-w-md rounded-xl border border-[var(--border-divider)] bg-black/20 px-3 py-2 text-base font-bold text-white outline-none transition-colors hover:border-white/20 focus:border-[var(--border-focus)] disabled:opacity-70"
                                        />
                                        {isAppeals && <Chip tone="primary">{t.categories.managedByAppeals}</Chip>}
                                    </div>
                                    <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                                        <span>{t.categories.openTickets}: <b className="text-[var(--color-primary-1)]">{category.openCount}</b></span>
                                        <span className="h-1 w-1 rounded-full bg-[var(--border-divider)]" />
                                        <span>{t.categories.totalTickets}: <b className="text-white">{category.totalCount}</b></span>
                                    </div>
                                </div>
                                {!isAppeals && (
                                    <button onClick={() => removeCategory(category.id)} className="shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--color-destructive)]" aria-label="remove category"><Trash size={16} /></button>
                                )}
                            </div>

                            {isAppeals ? (
                                <div className="flex items-center gap-2 rounded-xl border border-[var(--border-divider)] bg-[var(--surface-hover)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                                    <Lock size={14} className="text-[var(--color-primary-1)]" /> {category.description}
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <div><div className="mb-1 inline-flex items-center text-xs font-semibold text-[var(--text-muted)]">{t.categories.categoryChannel}</div><InteractiveSelect
                                            label=""
                                            value={category.discordChannelId ?? ''}
                                            onChange={(value) => {
                                                const channel = channels.find((item) => item.id === value);
                                                update(category.id, { discordChannelId: value || null, discordChannelName: channel?.name ?? null });
                                            }}
                                            placeholder={t.categories.selectChannel}
                                            icon={<Hash size={16} />}
                                            options={channelOptions}
                                        /></div>
                                        <div><div className="mb-1 inline-flex items-center text-xs font-semibold text-[var(--text-muted)]">{t.categories.channelBehavior}<TermHint explanation={t.terms.thread} /></div><InteractiveSelect
                                            label=""
                                            value={category.threadBehavior}
                                            onChange={(v) => update(category.id, { threadBehavior: (v as ThreadBehavior) || 'private_thread' })}
                                            icon={category.threadBehavior === 'channel' ? <Hash size={16} /> : <ChatCircleDots size={16} />}
                                            options={behaviorOptions}
                                        /></div>
                                        <div><div className="mb-1 inline-flex items-center text-xs font-semibold text-[var(--text-muted)]">{t.categories.defaultOwner}<TermHint explanation={t.terms.assignee} /></div><InteractiveSelect
                                            label=""
                                            value={category.defaultOwnerRoleId ?? ''}
                                            onChange={(v) => update(category.id, { defaultOwnerRoleId: v || null })}
                                            placeholder={t.access.assignRoles}
                                            options={roleOptions}
                                        /></div>
                                        <div><div className="mb-1 inline-flex items-center text-xs font-semibold text-[var(--text-muted)]">{t.categories.defaultPriority}<TermHint explanation={t.terms.priority} /></div><InteractiveSelect
                                            label=""
                                            value={category.defaultPriorityId}
                                            onChange={(v) => update(category.id, { defaultPriorityId: v })}
                                            options={priorities.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                                        /></div>
                                    </div>

                                    <div className="mt-4 space-y-4 border-t border-[var(--border-divider)] pt-4">
                                        <TicketCategoryFlowEditor category={category} locale={locale} serverEmojis={serverEmojis} onChange={(patch) => update(category.id, patch)} />
                                        <div className="hidden">
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"><ListChecks size={13} /> {t.categories.intakeFields}<TermHint explanation={t.terms.intakeFields} /></span>
                                                <button onClick={() => addField(category.id)} className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary-1)] hover:underline"><Plus size={12} weight="bold" /> {t.categories.addField}</button>
                                            </div>
                                            <div className="space-y-3">
                                                {category.intakeFields.map((field, index) => (
                                                    <div key={field.id} className="rounded-xl border border-[var(--border-divider)] bg-[var(--surface-hover)] p-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/20 text-[11px] font-bold text-[var(--text-muted)]">{index + 1}</span>
                                                            <input value={field.label} onChange={(e) => updateField(category.id, field.id, { label: e.target.value })} aria-label={t.categories.fieldLabel} className="min-w-0 flex-1 rounded-lg border border-transparent bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--border-focus)]" />
                                                            <button onClick={() => removeField(category.id, field.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]" aria-label="remove field"><Trash size={15} /></button>
                                                        </div>
                                                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                                            <div>
                                                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t.categories.fieldType}</span>
                                                                <InteractiveSelect
                                                                    value={field.type}
                                                                    onChange={(v) => {
                                                                        const type = (v as IntakeFieldType) || 'short';
                                                                        updateField(category.id, field.id, {
                                                                            type,
                                                                            options: type === 'select' ? (field.options?.length ? field.options : ['']) : undefined,
                                                                        });
                                                                    }}
                                                                    options={FIELD_TYPES.map((ft) => ({ id: ft, name: fieldTypeLabel[ft] }))}
                                                                />
                                                            </div>
                                                            <button onClick={() => updateField(category.id, field.id, { required: !field.required })} className={`mt-auto h-[52px] rounded-xl border px-3 text-xs font-bold transition-colors ${field.required ? 'border-[var(--color-primary-1)]/35 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]' : 'border-[var(--border-divider)] bg-black/20 text-[var(--text-muted)] hover:text-white'}`}>
                                                                {field.required ? t.categories.fieldRequired : t.categories.fieldOptional}
                                                            </button>
                                                        </div>
                                                        {field.type === 'select' && (
                                                            <div className="mt-3 border-t border-[var(--border-divider)] pt-3">
                                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t.categories.fieldOptions}</span>
                                                                    <button onClick={() => addFieldOption(category.id, field.id)} className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary-1)] hover:underline"><Plus size={12} weight="bold" /> {t.categories.addOption}</button>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {(field.options ?? []).map((option, optionIndex) => (
                                                                        <div key={`${field.id}-option-${optionIndex}`} className="flex items-center gap-2">
                                                                            <span className="w-5 shrink-0 text-center text-[11px] font-bold text-[var(--text-muted)]">{optionIndex + 1}</span>
                                                                            <input value={option} onChange={(event) => updateFieldOption(category.id, field.id, optionIndex, event.target.value)} aria-label={`${t.categories.optionLabel} ${optionIndex + 1}`} className="min-w-0 flex-1 rounded-lg border border-transparent bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--border-focus)]" />
                                                                            <button onClick={() => removeFieldOption(category.id, field.id, optionIndex)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]" aria-label={`${t.categories.optionLabel} ${optionIndex + 1}`}><Trash size={14} /></button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="min-w-0">
                                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                                <ArrowRight size={13} /> {t.detail.userView}
                                            </div>
                                            <TicketPanelMessageDesigner
                                                category={category}
                                                locale={locale}
                                                serverEmojis={serverEmojis}
                                                onChange={(patch) => update(category.id, patch)}
                                                onSendPreview={(messageDesignJson) => sendPreview(category, messageDesignJson)}
                                                previewState={previewStateById[category.id] ?? 'idle'}
                                                previewDisabled={!/^\d+$/.test(category.id) || !category.discordChannelId}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-divider)] pt-4 text-xs text-[var(--text-muted)]">
                                        <span className="font-semibold text-[var(--text-secondary)]">{t.categories.destination}:</span>
                                        <Chip tone="neutral"><Hash size={11} className="mr-0.5" />{category.discordChannelName ?? category.discordChannelId ?? 'channel'}</Chip>
                                        <ArrowRight size={12} />
                                        {owner ? <RolePill name={owner.name} color={owner.color} /> : <span className="text-[var(--text-muted)]">{t.access.noRoles}</span>}
                                        {priority && <><ArrowRight size={12} /><PriorityTag priority={priority} /></>}
                                    </div>
                                </>
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
                onReset={() => { setDraft(categories); setDirty(false); }}
            />
        </div>
    );
}
