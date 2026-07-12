'use client';

import React, { useState } from 'react';
import {
    CaretDown,
    ChatCircleDots,
    DotsSixVertical,
    ListBullets,
    Plus,
    Question,
    Trash,
} from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { InteractiveSelect } from '@/components/moderation/ui';
import { EmojiField, EmojiPreview } from '@/components/economy/primitives';
import type { DiscordEmojiRef } from '@/lib/economy/types';
import type {
    IntakeField,
    IntakeFieldType,
    TicketButtonStyle,
    TicketCategoryDef,
    TicketEntryPoint,
    TicketEntryPresentation,
    TicketGhostReply,
} from '@/lib/tickets/types';

type Props = {
    category: TicketCategoryDef;
    locale: LocaleCode;
    serverEmojis: DiscordEmojiRef[];
    onChange: (patch: Partial<TicketCategoryDef>) => void;
};

const INPUT = 'h-10 w-full rounded-xl border border-[var(--border-divider)] bg-black/20 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[var(--border-focus)]';
const TEXTAREA = 'min-h-24 w-full resize-y rounded-xl border border-[var(--border-divider)] bg-black/20 px-3 py-2.5 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 focus:border-[var(--border-focus)]';
const LABEL = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]';

const FIELD_TYPES: IntakeFieldType[] = ['short', 'paragraph', 'number', 'select'];
const STYLES: TicketButtonStyle[] = ['PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER'];
const PRESENTATIONS: TicketEntryPresentation[] = ['button', 'select', 'both'];

function copy(locale: LocaleCode) {
    return locale === 'ru' ? {
        entryTitle: 'Точки входа',
        entryDesc: 'Каждая кнопка или пункт списка открывает свой сценарий и собственную форму.',
        addEntry: 'Добавить сценарий',
        quickTitle: 'Быстрые ответы · ghost',
        quickDesc: 'Ответ показывается только пользователю и не создаёт тикет.',
        addQuick: 'Добавить ответ',
        name: 'Название', description: 'Короткое описание', surface: 'Где показать', style: 'Стиль кнопки', emoji: 'Эмодзи',
        button: 'Кнопка', select: 'Dropdown', both: 'Кнопка + dropdown',
        fields: 'Поля формы', addField: 'Добавить поле', question: 'Вопрос', format: 'Формат ответа',
        required: 'Обязательно', optional: 'Необязательно', options: 'Варианты ответа', addOption: 'Добавить вариант',
        response: 'Автоответ', responsePlaceholder: 'Текст, ссылки, упоминания и Discord Markdown…',
        emptyQuick: 'Добавьте ответы на частые вопросы — пользователь увидит их без создания обращения.',
        fieldTypes: { short: 'Короткий текст', paragraph: 'Развёрнутый текст', number: 'Число', select: 'Выбор из списка' },
    } : {
        entryTitle: 'Entry points', entryDesc: 'Each button or select option opens its own flow and form.', addEntry: 'Add entry point',
        quickTitle: 'Quick answers · ghost', quickDesc: 'The answer is visible only to the user and does not create a ticket.', addQuick: 'Add answer',
        name: 'Name', description: 'Short description', surface: 'Show as', style: 'Button style', emoji: 'Emoji',
        button: 'Button', select: 'Dropdown', both: 'Button + dropdown', fields: 'Form fields', addField: 'Add field', question: 'Question', format: 'Answer format',
        required: 'Required', optional: 'Optional', options: 'Answer options', addOption: 'Add option', response: 'Automatic answer',
        responsePlaceholder: 'Text, links, mentions, and Discord Markdown…', emptyQuick: 'Add common answers users can read without creating a ticket.',
        fieldTypes: { short: 'Short text', paragraph: 'Long text', number: 'Number', select: 'Select list' },
    };
}

function freshField(index: number): IntakeField {
    return { id: `field-${Date.now()}-${index}`, label: 'Describe your issue', type: 'paragraph', required: true };
}

function freshEntry(locale: LocaleCode, index: number): TicketEntryPoint {
    return {
        id: `entry-${Date.now()}-${index}`,
        label: locale === 'ru' ? 'Создать обращение' : 'Create ticket',
        description: '',
        emoji: null,
        style: 'PRIMARY',
        presentation: index < 5 ? 'button' : 'select',
        fields: [freshField(0)],
    };
}

function freshGhost(locale: LocaleCode, index: number): TicketGhostReply {
    return {
        id: `ghost-${Date.now()}-${index}`,
        label: locale === 'ru' ? 'Частый вопрос' : 'Common question',
        description: '',
        emoji: null,
        response: '',
    };
}

function PanelHeader({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-b border-[var(--border-divider)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">{icon}</span>
                <div className="min-w-0"><h3 className="text-sm font-bold text-white">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{description}</p></div>
            </div>
            {action}
        </div>
    );
}

function FormFields({ fields, locale, onChange }: { fields: IntakeField[]; locale: LocaleCode; onChange: (fields: IntakeField[]) => void }) {
    const t = copy(locale);
    const update = (id: string, patch: Partial<IntakeField>) => onChange(fields.map((field) => field.id === id ? { ...field, ...patch } : field));
    return (
        <div className="rounded-2xl border border-[var(--border-divider)] bg-black/10 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]"><ListBullets size={15} />{t.fields}<span className="text-[var(--text-muted)]">{fields.length}/5</span></span>
                <button type="button" disabled={fields.length >= 5} onClick={() => onChange([...fields, freshField(fields.length)])} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-primary-1)]/25 bg-[var(--color-primary-1)]/10 px-3 text-[11px] font-bold text-[var(--color-primary-1)] disabled:opacity-30"><Plus size={12} weight="bold" />{t.addField}</button>
            </div>
            <div className="space-y-2">
                {fields.map((field, index) => (
                    <div key={field.id} className="rounded-xl border border-white/[0.06] bg-[var(--surface-hover)] p-3">
                        <div className="flex items-center gap-2">
                            <DotsSixVertical size={15} className="shrink-0 text-white/20" />
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/25 text-[10px] font-bold text-[var(--text-muted)]">{index + 1}</span>
                            <input value={field.label} onChange={(event) => update(field.id, { label: event.target.value })} aria-label={t.question} className={`${INPUT} min-w-0 flex-1`} />
                            <button type="button" onClick={() => onChange(fields.filter((item) => item.id !== field.id))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]"><Trash size={14} /></button>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px]">
                            <InteractiveSelect value={field.type} onChange={(value) => { const type = value as IntakeFieldType; update(field.id, { type, options: type === 'select' ? field.options?.length ? field.options : ['Option 1'] : undefined }); }} options={FIELD_TYPES.map((type) => ({ id: type, name: t.fieldTypes[type] }))} />
                            <button type="button" onClick={() => update(field.id, { required: !field.required })} className={`h-[52px] rounded-xl border px-3 text-xs font-bold ${field.required ? 'border-[var(--color-primary-1)]/35 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]' : 'border-[var(--border-divider)] bg-black/20 text-[var(--text-muted)]'}`}>{field.required ? t.required : t.optional}</button>
                        </div>
                        {field.type === 'select' && (
                            <div className="mt-3 border-t border-[var(--border-divider)] pt-3">
                                <div className="mb-2 flex items-center justify-between"><span className={LABEL}>{t.options}</span><button type="button" onClick={() => update(field.id, { options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })} className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary-1)]"><Plus size={11} />{t.addOption}</button></div>
                                <div className="space-y-2">{(field.options ?? []).map((option, optionIndex) => <div key={`${field.id}-${optionIndex}`} className="flex gap-2"><input value={option} onChange={(event) => update(field.id, { options: (field.options ?? []).map((item, indexValue) => indexValue === optionIndex ? event.target.value : item) })} className={INPUT} /><button type="button" onClick={() => update(field.id, { options: (field.options ?? []).filter((_, indexValue) => indexValue !== optionIndex) })} className="h-10 w-10 shrink-0 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-destructive)]"><Trash size={14} className="mx-auto" /></button></div>)}</div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TicketCategoryFlowEditor({ category, locale, serverEmojis, onChange }: Props) {
    const t = copy(locale);
    const [openEntry, setOpenEntry] = useState<string | null>(category.entryPoints[0]?.id ?? null);
    const [openGhost, setOpenGhost] = useState<string | null>(null);
    const updateEntry = (id: string, patch: Partial<TicketEntryPoint>) => onChange({ entryPoints: category.entryPoints.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) });
    const updateGhost = (id: string, patch: Partial<TicketGhostReply>) => onChange({ ghostReplies: category.ghostReplies.map((reply) => reply.id === id ? { ...reply, ...patch } : reply) });

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <section className="min-w-0 rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-3 sm:p-4">
                <PanelHeader icon={<ListBullets size={19} weight="duotone" />} title={t.entryTitle} description={t.entryDesc} action={<button type="button" disabled={category.entryPoints.length >= 25} onClick={() => { const entry = freshEntry(locale, category.entryPoints.length); onChange({ entryPoints: [...category.entryPoints, entry] }); setOpenEntry(entry.id); }} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-primary-1)] px-3.5 text-[11px] font-bold text-black disabled:opacity-30"><Plus size={13} weight="bold" />{t.addEntry}</button>} />
                <div className="mt-3 space-y-2">
                    {category.entryPoints.map((entry, index) => {
                        const open = openEntry === entry.id;
                        const presentationLabel = entry.presentation === 'button' ? t.button : entry.presentation === 'select' ? t.select : t.both;
                        return (
                            <div key={entry.id} className={`overflow-hidden rounded-2xl border transition-colors ${open ? 'border-[var(--color-primary-1)]/25 bg-[var(--surface-hover)]' : 'border-white/[0.06] bg-black/10'}`}>
                                <div className="flex items-center gap-2 p-2.5 sm:p-3">
                                    <DotsSixVertical size={16} className="shrink-0 text-white/20" />
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/25 text-sm">{entry.emoji ? <EmojiPreview value={entry.emoji} serverEmojis={serverEmojis} className="h-5 w-5 text-sm leading-none" /> : index + 1}</span>
                                    <button type="button" onClick={() => setOpenEntry(open ? null : entry.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold text-white">{entry.label}</span><span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{presentationLabel} · {entry.fields.length} {t.fields.toLowerCase()}</span></button>
                                    <button type="button" onClick={() => onChange({ entryPoints: category.entryPoints.filter((item) => item.id !== entry.id) })} disabled={category.entryPoints.length === 1} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--color-destructive)] disabled:opacity-20"><Trash size={14} /></button>
                                    <button type="button" onClick={() => setOpenEntry(open ? null : entry.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)]"><CaretDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} /></button>
                                </div>
                                {open && (
                                    <div className="space-y-3 border-t border-[var(--border-divider)] p-3 sm:p-4">
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                                            <label><span className={LABEL}>{t.name}</span><input value={entry.label} maxLength={80} onChange={(event) => updateEntry(entry.id, { label: event.target.value })} className={INPUT} /></label>
                                            <div><span className={LABEL}>{t.emoji}</span><EmojiField value={entry.emoji ?? null} onChange={(emoji) => updateEntry(entry.id, { emoji })} customLabel="Custom emoji" serverLabel="Server emoji" serverEmojis={serverEmojis} /></div>
                                        </div>
                                        <label><span className={LABEL}>{t.description}</span><input value={entry.description ?? ''} maxLength={100} onChange={(event) => updateEntry(entry.id, { description: event.target.value })} className={INPUT} /></label>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div><span className={LABEL}>{t.surface}</span><InteractiveSelect value={entry.presentation} onChange={(value) => updateEntry(entry.id, { presentation: value as TicketEntryPresentation })} options={PRESENTATIONS.map((value) => ({ id: value, name: value === 'button' ? t.button : value === 'select' ? t.select : t.both }))} /></div>
                                            <div><span className={LABEL}>{t.style}</span><InteractiveSelect value={entry.style} onChange={(value) => updateEntry(entry.id, { style: value as TicketButtonStyle })} options={STYLES.map((value) => ({ id: value, name: value }))} /></div>
                                        </div>
                                        <FormFields fields={entry.fields} locale={locale} onChange={(fields) => updateEntry(entry.id, { fields })} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="min-w-0 rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(143,94,255,0.045),rgba(244,241,238,0.012))] p-3 sm:p-4">
                <PanelHeader icon={<ChatCircleDots size={19} weight="duotone" />} title={t.quickTitle} description={t.quickDesc} action={<button type="button" disabled={category.ghostReplies.length >= 24} onClick={() => { const reply = freshGhost(locale, category.ghostReplies.length); onChange({ ghostReplies: [...category.ghostReplies, reply] }); setOpenGhost(reply.id); }} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-primary-2)]/35 bg-[var(--color-primary-2)]/10 px-3.5 text-[11px] font-bold text-[#c4b5fd] disabled:opacity-30"><Plus size={13} weight="bold" />{t.addQuick}</button>} />
                {category.ghostReplies.length === 0 ? <div className="mt-3 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-5 text-center"><Question size={24} className="text-[var(--color-primary-2)]" /><p className="mt-3 max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">{t.emptyQuick}</p></div> : <div className="mt-3 space-y-2">{category.ghostReplies.map((reply) => { const open = openGhost === reply.id; return <div key={reply.id} className={`overflow-hidden rounded-2xl border ${open ? 'border-[var(--color-primary-2)]/30 bg-[var(--surface-hover)]' : 'border-white/[0.06] bg-black/10'}`}><div className="flex items-center gap-2 p-2.5 sm:p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-2)]/10 text-sm">{reply.emoji || <Question size={14} />}</span><button type="button" onClick={() => setOpenGhost(open ? null : reply.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold text-white">{reply.label}</span><span className="block truncate text-[10px] text-[var(--text-muted)]">{reply.description || t.quickDesc}</span></button><button type="button" onClick={() => onChange({ ghostReplies: category.ghostReplies.filter((item) => item.id !== reply.id) })} className="flex h-8 w-8 items-center justify-center text-[var(--text-muted)] hover:text-[var(--color-destructive)]"><Trash size={14} /></button><button type="button" onClick={() => setOpenGhost(open ? null : reply.id)} className="flex h-8 w-8 items-center justify-center text-[var(--text-muted)]"><CaretDown size={15} className={open ? 'rotate-180' : ''} /></button></div>{open && <div className="space-y-3 border-t border-[var(--border-divider)] p-3"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]"><label><span className={LABEL}>{t.name}</span><input value={reply.label} maxLength={100} onChange={(event) => updateGhost(reply.id, { label: event.target.value })} className={INPUT} /></label><div><span className={LABEL}>{t.emoji}</span><EmojiField value={reply.emoji ?? null} onChange={(emoji) => updateGhost(reply.id, { emoji })} customLabel="Custom emoji" serverLabel="Server emoji" serverEmojis={serverEmojis} /></div></div><label><span className={LABEL}>{t.description}</span><input value={reply.description ?? ''} maxLength={100} onChange={(event) => updateGhost(reply.id, { description: event.target.value })} className={INPUT} /></label><label><span className={LABEL}>{t.response}</span><textarea value={reply.response} maxLength={4000} onChange={(event) => updateGhost(reply.id, { response: event.target.value })} placeholder={t.responsePlaceholder} className={TEXTAREA} /></label></div>}</div>; })}</div>}
            </section>
        </div>
    );
}
