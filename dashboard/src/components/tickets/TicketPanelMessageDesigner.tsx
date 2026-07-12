'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
    ArrowClockwise,
    ArrowCounterClockwise,
    CaretDown,
    CaretRight,
    CaretUp,
    Check,
    Code,
    Copy,
    Eye,
    PaperPlaneTilt,
    Plus,
    Trash,
    X,
} from '@phosphor-icons/react';
import {
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
} from '@nextui-org/react';
import type { LocaleCode } from '@/lib/i18n';
import type { DiscordEmojiRef } from '@/lib/economy/types';
import type { TicketCategoryDef } from '@/lib/tickets/types';
import {
    COMPONENTS_V2_FLAG,
    createComponentsV2TicketPanelDesign,
    createDefaultTicketPanelDesign,
    legacyFieldsFromDesign,
    parseTicketPanelMessageDesign,
    serializeTicketPanelMessageDesign,
    validateTicketPanelMessageDesign,
    type APIEmbed,
    type TicketButtonStyle,
    type TicketPanelMessageDesign,
    type V2ActionRow,
    type V2Container,
    type V2LinkButton,
    type V2MediaGallery,
    type V2MediaItem,
    type V2Section,
    type V2TextDisplay,
    type V2Thumbnail,
    type V2TopLevelComponent,
} from '@/lib/tickets/messageDesign';
import { EmojiField } from '@/components/economy/primitives';
import { InteractiveSelect } from '@/components/moderation/ui';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { TermHint } from './primitives';
import { TicketPanelDesignPreview } from './TicketPanelDesignPreview';

type PreviewState = 'idle' | 'sending' | 'sent' | 'error';
type EditableV2Component = V2TopLevelComponent | V2Container['components'][number];
type V2Kind = 'action_row' | 'section' | 'text' | 'gallery' | 'separator' | 'container';

type Props = {
    category: TicketCategoryDef;
    locale: LocaleCode;
    serverEmojis?: DiscordEmojiRef[];
    onChange: (patch: Partial<TicketCategoryDef>) => void;
    onSendPreview?: (messageDesignJson: string) => Promise<void>;
    previewState?: PreviewState;
    previewDisabled?: boolean;
};

const BUTTON_STYLES: TicketButtonStyle[] = ['PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER'];
const INPUT = 'w-full rounded-xl border border-[var(--border-divider)] bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--color-primary-1)]/10';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]';
const MINI_BUTTON = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-divider)] bg-black/20 px-2.5 text-[11px] font-bold text-[var(--text-secondary)] transition-colors hover:border-white/10 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30';

let idSequence = 0;
function nextId() {
    idSequence += 1;
    return `${Date.now()}-${idSequence}`;
}

function text(locale: LocaleCode, ru: string, en: string) {
    return locale === 'ru' ? ru : en;
}

function colorToHex(color?: number) {
    return `#${(color ?? 7729514).toString(16).padStart(6, '0')}`;
}

function hexToColor(value: string) {
    const parsed = Number.parseInt(value.trim().replace('#', ''), 16);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function commitDesign(design: TicketPanelMessageDesign, onChange: Props['onChange']) {
    const normalized = parseTicketPanelMessageDesign(design, {});
    const legacy = legacyFieldsFromDesign(normalized);
    onChange({
        messageDesignJson: serializeTicketPanelMessageDesign(normalized),
        messageText: legacy.messageText,
        messageEmbeds: legacy.messageEmbeds,
        buttonText: legacy.buttonText,
        buttonStyle: legacy.buttonStyle,
        emoji: legacy.buttonEmoji,
        description: legacy.messageText,
    });
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

function duplicateWithFreshIds<T>(value: T): T {
    const clone = JSON.parse(JSON.stringify(value)) as T;
    const visit = (entry: unknown) => {
        if (!entry || typeof entry !== 'object') return;
        const record = entry as Record<string, unknown>;
        if ('id' in record) record.id = nextId();
        Object.values(record).forEach((child) => {
            if (Array.isArray(child)) child.forEach(visit);
            else visit(child);
        });
    };
    visit(clone);
    return clone;
}

function defaultEmbed(category: TicketCategoryDef): APIEmbed {
    return {
        title: category.name || 'Create Ticket',
        description: category.description || 'Click the button below to create a ticket.',
        color: 7729514,
        fields: [],
    };
}

function createV2Block(kind: V2Kind): EditableV2Component {
    if (kind === 'action_row') {
        return {
            id: nextId(),
            type: 1,
            components: [{ id: nextId(), type: 2, style: 5, label: 'Open link', url: 'https://example.com' }],
        };
    }
    if (kind === 'section') {
        return {
            id: nextId(),
            type: 9,
            components: [{ id: nextId(), type: 10, content: '### New section\nAdd useful details here.' }],
            accessory: { id: nextId(), type: 11, media: { url: 'https://cdn.discordapp.com/embed/avatars/0.png' }, description: 'Preview' },
        };
    }
    if (kind === 'gallery') {
        return {
            id: nextId(),
            type: 12,
            items: [{ media: { url: 'https://cdn.discordapp.com/embed/avatars/0.png' }, description: 'Gallery item' }],
        };
    }
    if (kind === 'separator') return { id: nextId(), type: 14, divider: true, spacing: 1 };
    if (kind === 'container') {
        return {
            id: nextId(),
            type: 17,
            accent_color: 7729514,
            components: [
                { id: nextId(), type: 10, content: '## Ticket center' },
                { id: nextId(), type: 10, content: 'Choose this route to contact support.' },
                { id: nextId(), type: 14, divider: true, spacing: 1 },
            ],
        };
    }
    return { id: nextId(), type: 10, content: 'New text display' };
}

function ensureClassic(design: TicketPanelMessageDesign, category: TicketCategoryDef) {
    if (design.mode === 'classic_embed') return design;
    const next = createDefaultTicketPanelDesign(category.name) as Extract<TicketPanelMessageDesign, { mode: 'classic_embed' }>;
    return { ...next, opener: design.opener };
}

function ensureV2(design: TicketPanelMessageDesign, category: TicketCategoryDef) {
    if (design.mode === 'components_v2') return design;
    const title = design.embeds[0]?.title || category.name;
    const description = design.embeds[0]?.description || design.content || category.description || '';
    const next = createComponentsV2TicketPanelDesign(title) as Extract<TicketPanelMessageDesign, { mode: 'components_v2' }>;
    const container = next.components[0];
    if (container?.type === 17) {
        container.id = nextId();
        container.components = [
            { id: nextId(), type: 10, content: `## ${title}` },
            { id: nextId(), type: 10, content: description || 'Click the button below to create a ticket.' },
            { id: nextId(), type: 14, divider: true, spacing: 1 },
        ];
    }
    return { ...next, opener: design.opener };
}

function IconButton({ label, disabled, onClick, children, danger = false }: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={(event) => { event.stopPropagation(); onClick(); }}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors hover:bg-white/[0.05] ${danger ? 'hover:text-[var(--color-destructive)]' : 'hover:text-white'} disabled:cursor-not-allowed disabled:opacity-25`}
        >
            {children}
        </button>
    );
}

function EditorCard({
    title,
    summary,
    accent,
    defaultOpen = false,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onRemove,
    children,
}: {
    title: string;
    summary?: string;
    accent?: string;
    defaultOpen?: boolean;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onDuplicate?: () => void;
    onRemove?: () => void;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="overflow-visible rounded-2xl border border-[var(--border-divider)] bg-black/15" style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}>
            <div className="flex min-h-12 items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <CaretRight size={16} weight="bold" className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-90' : ''}`} />
                    <span className="shrink-0 text-sm font-bold text-white">{title}</span>
                    {summary && <span className="min-w-0 truncate text-xs text-[var(--text-muted)]">— {summary}</span>}
                </button>
                <div className="flex shrink-0 items-center">
                    {onMoveUp && <IconButton label="Move up" disabled={!canMoveUp} onClick={onMoveUp}><CaretUp size={16} /></IconButton>}
                    {onMoveDown && <IconButton label="Move down" disabled={!canMoveDown} onClick={onMoveDown}><CaretDown size={16} /></IconButton>}
                    {onDuplicate && <IconButton label="Duplicate" onClick={onDuplicate}><Copy size={15} /></IconButton>}
                    {onRemove && <IconButton label="Remove" danger onClick={onRemove}><Trash size={15} /></IconButton>}
                </div>
            </div>
            {open && <div className="border-t border-[var(--border-divider)] px-3 pb-3 pt-3">{children}</div>}
        </div>
    );
}

function ToggleField({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
    return (
        <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <span className={`relative h-5 w-9 rounded-full border transition-colors ${checked ? 'border-[var(--color-primary-1)]/40 bg-[var(--color-primary-1)]/25' : 'border-white/10 bg-black/30'}`}>
                <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform ${checked ? 'translate-x-[17px] bg-[var(--color-primary-1)]' : 'translate-x-0.5 bg-white/45'}`} />
            </span>
            {label}
        </button>
    );
}

function RichTextarea({ label, value, onChange, maxLength, rows = 4, placeholder }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    maxLength: number;
    rows?: number;
    placeholder?: string;
}) {
    const ref = useRef<HTMLTextAreaElement | null>(null);
    const wrap = (prefix: string, suffix = prefix) => {
        const element = ref.current;
        if (!element) return;
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const selected = value.slice(start, end) || 'text';
        onChange(`${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`);
        requestAnimationFrame(() => element.focus());
    };
    return (
        <label className="block space-y-1.5">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <span className={LABEL}>{label} <span className="ml-1 font-medium normal-case tracking-normal text-white/30">{value.length} / {maxLength}</span></span>
                <span className="flex items-center gap-1">
                    <button type="button" onClick={() => wrap('**')} className={MINI_BUTTON} aria-label="Bold"><b>B</b></button>
                    <button type="button" onClick={() => wrap('*')} className={MINI_BUTTON} aria-label="Italic"><i>I</i></button>
                    <button type="button" onClick={() => wrap('__')} className={MINI_BUTTON} aria-label="Underline"><u>U</u></button>
                    <button type="button" onClick={() => wrap('~~')} className={MINI_BUTTON} aria-label="Strikethrough"><s>S</s></button>
                </span>
            </div>
            <textarea
                ref={ref}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                maxLength={maxLength}
                rows={rows}
                placeholder={placeholder}
                className={`${INPUT} resize-y leading-relaxed`}
            />
        </label>
    );
}

function ColorField({ value, onChange, label }: { value?: number; onChange: (value?: number) => void; label: string }) {
    const hex = colorToHex(value);
    return (
        <label className="block space-y-1.5">
            <span className={LABEL}>{label}</span>
            <span className="flex gap-2">
                <span className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--border-divider)] bg-black/25 focus-within:border-[var(--border-focus)]">
                    <span className="flex items-center border-r border-[var(--border-divider)] px-2 text-white/35">#</span>
                    <input value={hex.slice(1)} onChange={(event) => onChange(hexToColor(event.target.value))} maxLength={6} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none" />
                </span>
                <input type="color" value={hex} onChange={(event) => onChange(hexToColor(event.target.value))} className="h-11 w-12 cursor-pointer rounded-xl border border-[var(--border-divider)] bg-black/25 p-1" />
            </span>
        </label>
    );
}

function EmbedEditor({ embed, index, count, locale, onChange, onMove, onDuplicate, onRemove }: {
    embed: APIEmbed;
    index: number;
    count: number;
    locale: LocaleCode;
    onChange: (embed: APIEmbed) => void;
    onMove: (direction: -1 | 1) => void;
    onDuplicate: () => void;
    onRemove: () => void;
}) {
    const fields = embed.fields ?? [];
    const updateField = (fieldIndex: number, patch: Partial<(typeof fields)[number]>) => {
        const next = [...fields];
        next[fieldIndex] = { ...next[fieldIndex], ...patch };
        onChange({ ...embed, fields: next });
    };
    return (
        <EditorCard
            title={`${text(locale, 'Embed', 'Embed')} ${index + 1}`}
            summary={embed.author?.name || embed.title || undefined}
            accent={colorToHex(embed.color)}
            defaultOpen={index === 0}
            canMoveUp={index > 0}
            canMoveDown={index < count - 1}
            onMoveUp={() => onMove(-1)}
            onMoveDown={() => onMove(1)}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
        >
            <div className="space-y-3">
                <EditorCard title={text(locale, 'Автор', 'Author')} summary={embed.author?.name} defaultOpen>
                    <div className="space-y-3">
                        <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Имя автора', 'Author name')} <span className="ml-1 text-white/30">{embed.author?.name?.length ?? 0} / 256</span></span><input value={embed.author?.name ?? ''} maxLength={256} onChange={(event) => onChange({ ...embed, author: { ...embed.author, name: event.target.value } })} className={INPUT} /></label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Ссылка автора', 'Author URL')}</span><input type="url" value={embed.author?.url ?? ''} onChange={(event) => onChange({ ...embed, author: { name: embed.author?.name ?? '', ...embed.author, url: event.target.value || undefined } })} className={INPUT} /></label>
                            <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Иконка автора', 'Author icon URL')}</span><input type="url" value={embed.author?.icon_url ?? ''} onChange={(event) => onChange({ ...embed, author: { name: embed.author?.name ?? '', ...embed.author, icon_url: event.target.value || undefined } })} className={INPUT} /></label>
                        </div>
                    </div>
                </EditorCard>

                <EditorCard title={text(locale, 'Содержимое', 'Body')} summary={embed.title} defaultOpen>
                    <div className="space-y-3">
                        <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Заголовок', 'Title')} <span className="ml-1 text-white/30">{embed.title?.length ?? 0} / 256</span></span><input value={embed.title ?? ''} maxLength={256} onChange={(event) => onChange({ ...embed, title: event.target.value })} className={INPUT} /></label>
                        <RichTextarea label={text(locale, 'Описание', 'Description')} value={embed.description ?? ''} onChange={(value) => onChange({ ...embed, description: value })} maxLength={4096} />
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                            <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Ссылка заголовка', 'Title URL')}</span><input type="url" value={embed.url ?? ''} onChange={(event) => onChange({ ...embed, url: event.target.value || undefined })} className={INPUT} /></label>
                            <ColorField label={text(locale, 'Цвет', 'Color')} value={embed.color} onChange={(value) => onChange({ ...embed, color: value })} />
                        </div>
                    </div>
                </EditorCard>

                <EditorCard title={text(locale, 'Изображения', 'Images')} summary={embed.image?.url || embed.thumbnail?.url}>
                    <div className="space-y-3">
                        <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'URL изображения', 'Image URL')}</span><input type="url" value={embed.image?.url ?? ''} onChange={(event) => onChange({ ...embed, image: event.target.value ? { url: event.target.value } : undefined })} className={INPUT} /></label>
                        <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'URL миниатюры', 'Thumbnail URL')}</span><input type="url" value={embed.thumbnail?.url ?? ''} onChange={(event) => onChange({ ...embed, thumbnail: event.target.value ? { url: event.target.value } : undefined })} className={INPUT} /></label>
                    </div>
                </EditorCard>

                <EditorCard title={text(locale, 'Подвал', 'Footer')} summary={embed.footer?.text}>
                    <div className="space-y-3">
                        <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Текст подвала', 'Footer text')} <span className="ml-1 text-white/30">{embed.footer?.text?.length ?? 0} / 2048</span></span><input value={embed.footer?.text ?? ''} maxLength={2048} onChange={(event) => onChange({ ...embed, footer: { ...embed.footer, text: event.target.value } })} className={INPUT} /></label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Иконка подвала', 'Footer icon URL')}</span><input type="url" value={embed.footer?.icon_url ?? ''} onChange={(event) => onChange({ ...embed, footer: { text: embed.footer?.text ?? '', ...embed.footer, icon_url: event.target.value || undefined } })} className={INPUT} /></label>
                            <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Временная метка', 'Timestamp')}</span><input type="datetime-local" value={embed.timestamp ? embed.timestamp.slice(0, 16) : ''} onChange={(event) => onChange({ ...embed, timestamp: event.target.value ? new Date(event.target.value).toISOString() : undefined })} className={INPUT} /></label>
                        </div>
                    </div>
                </EditorCard>

                <EditorCard title={text(locale, 'Поля', 'Fields')} summary={`${fields.length} / 25`}>
                    <div className="space-y-2">
                        {fields.map((field, fieldIndex) => (
                            <EditorCard
                                key={`${fieldIndex}-${field.name}`}
                                title={`${text(locale, 'Поле', 'Field')} ${fieldIndex + 1}`}
                                summary={field.name}
                                canMoveUp={fieldIndex > 0}
                                canMoveDown={fieldIndex < fields.length - 1}
                                onMoveUp={() => onChange({ ...embed, fields: moveItem(fields, fieldIndex, -1) })}
                                onMoveDown={() => onChange({ ...embed, fields: moveItem(fields, fieldIndex, 1) })}
                                onDuplicate={() => onChange({ ...embed, fields: [...fields.slice(0, fieldIndex + 1), { ...field }, ...fields.slice(fieldIndex + 1)] })}
                                onRemove={() => onChange({ ...embed, fields: fields.filter((_, itemIndex) => itemIndex !== fieldIndex) })}
                            >
                                <div className="space-y-3">
                                    <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                        <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Название', 'Name')} <span className="ml-1 text-white/30">{field.name.length} / 256</span></span><input value={field.name} maxLength={256} onChange={(event) => updateField(fieldIndex, { name: event.target.value })} className={INPUT} /></label>
                                        <div className="pb-2"><ToggleField checked={Boolean(field.inline)} onChange={(value) => updateField(fieldIndex, { inline: value })} label={text(locale, 'В строку', 'Inline')} /></div>
                                    </div>
                                    <RichTextarea label={text(locale, 'Значение', 'Value')} value={field.value} onChange={(value) => updateField(fieldIndex, { value })} maxLength={1024} rows={3} />
                                </div>
                            </EditorCard>
                        ))}
                        <div className="flex flex-wrap gap-2 pt-1">
                            <button type="button" disabled={fields.length >= 25} onClick={() => onChange({ ...embed, fields: [...fields, { name: 'New field', value: 'Field value', inline: false }] })} className={MINI_BUTTON}><Plus size={13} />{text(locale, 'Добавить поле', 'Add field')}</button>
                            <button type="button" disabled={!fields.length} onClick={() => onChange({ ...embed, fields: [] })} className={`${MINI_BUTTON} hover:border-[var(--color-destructive)]/30 hover:text-[var(--color-destructive)]`}><Trash size={13} />{text(locale, 'Очистить поля', 'Clear fields')}</button>
                        </div>
                    </div>
                </EditorCard>
            </div>
        </EditorCard>
    );
}

function AddComponentMenu({ locale, context, disabled, onAdd }: {
    locale: LocaleCode;
    context: 'root' | 'container';
    disabled?: boolean;
    onAdd: (kind: V2Kind) => void;
}) {
    const [open, setOpen] = useState(false);
    const items: Array<{ kind: V2Kind; ru: string; en: string }> = [
        { kind: 'action_row', ru: 'Ряд кнопок', en: 'Button row' },
        { kind: 'section', ru: 'Секция', en: 'Section' },
        { kind: 'text', ru: 'Текстовый блок', en: 'Text display' },
        { kind: 'gallery', ru: 'Медиа-галерея', en: 'Media gallery' },
        { kind: 'separator', ru: 'Разделитель', en: 'Separator' },
        ...(context === 'root' ? [{ kind: 'container' as const, ru: 'Контейнер', en: 'Container' }] : []),
    ];
    return (
        <div className="relative">
            <button type="button" disabled={disabled} onClick={() => setOpen((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-primary-1)] px-3.5 text-xs font-bold text-black shadow-[0_0_20px_rgba(117,241,106,0.1)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30"><Plus size={15} weight="bold" />{text(locale, 'Добавить компонент', 'Add component')}<CaretUp size={13} className={open ? '' : 'rotate-180'} /></button>
            {open && (
                <div className="absolute bottom-full left-0 z-30 mb-2 min-w-56 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1.5 shadow-2xl">
                    {items.map((item) => (
                        <button key={item.kind} type="button" onClick={() => { onAdd(item.kind); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-white"><Plus size={13} />{text(locale, item.ru, item.en)}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

function LinkButtonEditor({ button, index, count, locale, serverEmojis, onChange, onMove, onDuplicate, onRemove }: {
    button: V2LinkButton;
    index: number;
    count: number;
    locale: LocaleCode;
    serverEmojis: DiscordEmojiRef[];
    onChange: (button: V2LinkButton) => void;
    onMove: (direction: -1 | 1) => void;
    onDuplicate: () => void;
    onRemove: () => void;
}) {
    const emojiValue = typeof button.emoji === 'string' ? button.emoji : null;
    return (
        <EditorCard title={`${text(locale, 'Кнопка', 'Button')} ${index + 1}`} summary={button.label} canMoveUp={index > 0} canMoveDown={index < count - 1} onMoveUp={() => onMove(-1)} onMoveDown={() => onMove(1)} onDuplicate={onDuplicate} onRemove={onRemove}>
            <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
                    <div className="space-y-1.5"><span className={LABEL}>{text(locale, 'Эмодзи', 'Emoji')}</span><EmojiField value={emojiValue} onChange={(emoji) => onChange({ ...button, emoji })} serverEmojis={serverEmojis} customLabel={text(locale, 'Свой эмодзи', 'Custom emoji')} serverLabel={text(locale, 'Эмодзи сервера', 'Server emoji')} /></div>
                    <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Текст', 'Label')} <span className="ml-1 text-white/30">{button.label?.length ?? 0} / 80</span></span><input value={button.label ?? ''} maxLength={80} onChange={(event) => onChange({ ...button, label: event.target.value })} className={INPUT} /></label>
                </div>
                <label className="block space-y-1.5"><span className={LABEL}>URL</span><input type="url" value={button.url} onChange={(event) => onChange({ ...button, url: event.target.value })} className={INPUT} /></label>
                <ToggleField checked={Boolean(button.disabled)} onChange={(value) => onChange({ ...button, disabled: value })} label={text(locale, 'Отключена', 'Disabled')} />
            </div>
        </EditorCard>
    );
}

function V2ComponentEditor({ component, index, count, locale, serverEmojis, onChange, onMove, onDuplicate, onRemove }: {
    component: EditableV2Component;
    index: number;
    count: number;
    locale: LocaleCode;
    serverEmojis: DiscordEmojiRef[];
    onChange: (component: EditableV2Component) => void;
    onMove: (direction: -1 | 1) => void;
    onDuplicate: () => void;
    onRemove: () => void;
}) {
    const common = {
        canMoveUp: index > 0,
        canMoveDown: index < count - 1,
        onMoveUp: () => onMove(-1),
        onMoveDown: () => onMove(1),
        onDuplicate,
        onRemove,
    };

    if (component.type === 10) {
        return <EditorCard title={text(locale, 'Текстовый блок', 'Text display')} summary={component.content.split('\n')[0]} defaultOpen {...common}><RichTextarea label={text(locale, 'Содержимое', 'Content')} value={component.content} onChange={(content) => onChange({ ...component, content })} maxLength={4000} /></EditorCard>;
    }

    if (component.type === 14) {
        return (
            <EditorCard title={text(locale, 'Разделитель', 'Separator')} summary={component.divider === false ? text(locale, 'Отступ', 'Spacing only') : text(locale, 'Линия', 'Divider')} {...common}>
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Отступ', 'Spacing')}</span><select value={component.spacing ?? 1} onChange={(event) => onChange({ ...component, spacing: Number(event.target.value) === 2 ? 2 : 1 })} className={INPUT}><option value={1}>{text(locale, 'Маленький', 'Small')}</option><option value={2}>{text(locale, 'Большой', 'Large')}</option></select></label>
                    <div className="pb-2.5"><ToggleField checked={component.divider !== false} onChange={(divider) => onChange({ ...component, divider })} label={text(locale, 'Показывать линию', 'Show divider')} /></div>
                </div>
            </EditorCard>
        );
    }

    if (component.type === 1) {
        const row = component as V2ActionRow;
        const updateButtons = (components: V2LinkButton[]) => onChange({ ...row, components });
        return (
            <EditorCard title={text(locale, 'Ряд кнопок', 'Button row')} summary={`${row.components.length} / 5`} defaultOpen {...common}>
                <div className="space-y-2">
                    {row.components.map((button, buttonIndex) => (
                        <LinkButtonEditor
                            key={button.id ?? buttonIndex}
                            button={button}
                            index={buttonIndex}
                            count={row.components.length}
                            locale={locale}
                            serverEmojis={serverEmojis}
                            onChange={(next) => updateButtons(row.components.map((item, itemIndex) => itemIndex === buttonIndex ? next : item))}
                            onMove={(direction) => updateButtons(moveItem(row.components, buttonIndex, direction))}
                            onDuplicate={() => updateButtons([...row.components.slice(0, buttonIndex + 1), duplicateWithFreshIds(button), ...row.components.slice(buttonIndex + 1)])}
                            onRemove={() => updateButtons(row.components.filter((_, itemIndex) => itemIndex !== buttonIndex))}
                        />
                    ))}
                    <button type="button" disabled={row.components.length >= 5} onClick={() => updateButtons([...row.components, { id: nextId(), type: 2, style: 5, label: 'Open link', url: 'https://example.com' }])} className={MINI_BUTTON}><Plus size={13} />{text(locale, 'Добавить кнопку', 'Add button')}</button>
                </div>
            </EditorCard>
        );
    }

    if (component.type === 12) {
        const gallery = component as V2MediaGallery;
        const updateItems = (items: V2MediaItem[]) => onChange({ ...gallery, items });
        return (
            <EditorCard title={text(locale, 'Медиа-галерея', 'Media gallery')} summary={`${gallery.items.length} / 10`} defaultOpen {...common}>
                <div className="space-y-2">
                    {gallery.items.map((item, itemIndex) => (
                        <EditorCard key={`${item.media.url}-${itemIndex}`} title={`${text(locale, 'Изображение', 'Item')} ${itemIndex + 1}`} summary={item.description || item.media.url} canMoveUp={itemIndex > 0} canMoveDown={itemIndex < gallery.items.length - 1} onMoveUp={() => updateItems(moveItem(gallery.items, itemIndex, -1))} onMoveDown={() => updateItems(moveItem(gallery.items, itemIndex, 1))} onDuplicate={() => updateItems([...gallery.items.slice(0, itemIndex + 1), { ...item, media: { ...item.media } }, ...gallery.items.slice(itemIndex + 1)])} onRemove={() => updateItems(gallery.items.filter((_, indexToRemove) => indexToRemove !== itemIndex))}>
                            <div className="space-y-3">
                                <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Ссылка на файл', 'File URL')}</span><input type="url" value={item.media.url} onChange={(event) => updateItems(gallery.items.map((entry, entryIndex) => entryIndex === itemIndex ? { ...entry, media: { url: event.target.value } } : entry))} className={INPUT} /></label>
                                <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Описание', 'Description')} <span className="ml-1 text-white/30">{item.description?.length ?? 0} / 80</span></span><input value={item.description ?? ''} maxLength={80} onChange={(event) => updateItems(gallery.items.map((entry, entryIndex) => entryIndex === itemIndex ? { ...entry, description: event.target.value } : entry))} className={INPUT} /></label>
                                <ToggleField checked={Boolean(item.spoiler)} onChange={(spoiler) => updateItems(gallery.items.map((entry, entryIndex) => entryIndex === itemIndex ? { ...entry, spoiler } : entry))} label={text(locale, 'Спойлер', 'Spoiler')} />
                            </div>
                        </EditorCard>
                    ))}
                    <button type="button" disabled={gallery.items.length >= 10} onClick={() => updateItems([...gallery.items, { media: { url: 'https://cdn.discordapp.com/embed/avatars/0.png' }, description: 'Gallery item' }])} className={MINI_BUTTON}><Plus size={13} />{text(locale, 'Добавить изображение', 'Add item')}</button>
                </div>
            </EditorCard>
        );
    }

    if (component.type === 9) {
        const section = component as V2Section;
        const accessoryType = section.accessory?.type === 2 ? 'button' : 'thumbnail';
        const setAccessoryType = (type: 'thumbnail' | 'button') => {
            const accessory: V2Thumbnail | V2LinkButton = type === 'button'
                ? { id: nextId(), type: 2, style: 5, label: 'Open link', url: 'https://example.com' }
                : { id: nextId(), type: 11, media: { url: 'https://cdn.discordapp.com/embed/avatars/0.png' }, description: 'Thumbnail' };
            onChange({ ...section, accessory });
        };
        return (
            <EditorCard title={text(locale, 'Секция', 'Section')} summary={`${section.components.length} / 3`} defaultOpen {...common}>
                <div className="space-y-3">
                    <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Аксессуар', 'Accessory')}</span><select value={accessoryType} onChange={(event) => setAccessoryType(event.target.value as 'thumbnail' | 'button')} className={INPUT}><option value="thumbnail">{text(locale, 'Миниатюра', 'Thumbnail')}</option><option value="button">{text(locale, 'Кнопка-ссылка', 'Link button')}</option></select></label>
                    {section.accessory?.type === 11 && (
                        <EditorCard title={text(locale, 'Миниатюра', 'Thumbnail')} summary={section.accessory.description} defaultOpen>
                            <div className="space-y-3"><label className="block space-y-1.5"><span className={LABEL}>URL</span><input type="url" value={section.accessory.media.url} onChange={(event) => onChange({ ...section, accessory: { ...section.accessory as V2Thumbnail, media: { url: event.target.value } } })} className={INPUT} /></label><label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Описание', 'Description')}</span><input value={section.accessory.description ?? ''} maxLength={80} onChange={(event) => onChange({ ...section, accessory: { ...section.accessory as V2Thumbnail, description: event.target.value } })} className={INPUT} /></label><ToggleField checked={Boolean(section.accessory.spoiler)} onChange={(spoiler) => onChange({ ...section, accessory: { ...section.accessory as V2Thumbnail, spoiler } })} label={text(locale, 'Спойлер', 'Spoiler')} /></div>
                        </EditorCard>
                    )}
                    {section.accessory?.type === 2 && <LinkButtonEditor button={section.accessory} index={0} count={1} locale={locale} serverEmojis={serverEmojis} onChange={(accessory) => onChange({ ...section, accessory })} onMove={() => undefined} onDuplicate={() => undefined} onRemove={() => setAccessoryType('thumbnail')} />}
                    <EditorCard title={text(locale, 'Текстовые блоки', 'Text displays')} summary={`${section.components.length} / 3`} defaultOpen>
                        <div className="space-y-2">
                            {section.components.map((display, displayIndex) => (
                                <V2ComponentEditor key={display.id ?? displayIndex} component={display} index={displayIndex} count={section.components.length} locale={locale} serverEmojis={serverEmojis} onChange={(next) => onChange({ ...section, components: section.components.map((item, itemIndex) => itemIndex === displayIndex ? next as V2TextDisplay : item) })} onMove={(direction) => onChange({ ...section, components: moveItem(section.components, displayIndex, direction) })} onDuplicate={() => onChange({ ...section, components: [...section.components.slice(0, displayIndex + 1), duplicateWithFreshIds(display), ...section.components.slice(displayIndex + 1)] })} onRemove={() => onChange({ ...section, components: section.components.filter((_, itemIndex) => itemIndex !== displayIndex) })} />
                            ))}
                            <button type="button" disabled={section.components.length >= 3} onClick={() => onChange({ ...section, components: [...section.components, { id: nextId(), type: 10, content: 'New text display' }] })} className={MINI_BUTTON}><Plus size={13} />{text(locale, 'Добавить текст', 'Add text')}</button>
                        </div>
                    </EditorCard>
                </div>
            </EditorCard>
        );
    }

    const container = component as V2Container;
    const updateChildren = (components: V2Container['components']) => onChange({ ...container, components });
    return (
        <EditorCard title={text(locale, 'Контейнер', 'Container')} summary={`${container.components.length} / 10`} accent={colorToHex(container.accent_color)} defaultOpen {...common}>
            <div className="space-y-3">
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><ColorField value={container.accent_color} onChange={(accent_color) => onChange({ ...container, accent_color })} label={text(locale, 'Акцентный цвет', 'Accent color')} /><div className="pb-2.5"><ToggleField checked={Boolean(container.spoiler)} onChange={(spoiler) => onChange({ ...container, spoiler })} label={text(locale, 'Спойлер', 'Spoiler')} /></div></div>
                <EditorCard title={text(locale, 'Компоненты', 'Components')} summary={`${container.components.length} / 10`} defaultOpen>
                    <div className="space-y-2">
                        {container.components.map((child, childIndex) => (
                            <V2ComponentEditor key={child.id ?? childIndex} component={child} index={childIndex} count={container.components.length} locale={locale} serverEmojis={serverEmojis} onChange={(next) => updateChildren(container.components.map((item, itemIndex) => itemIndex === childIndex ? next as V2Container['components'][number] : item))} onMove={(direction) => updateChildren(moveItem(container.components, childIndex, direction))} onDuplicate={() => updateChildren([...container.components.slice(0, childIndex + 1), duplicateWithFreshIds(child), ...container.components.slice(childIndex + 1)])} onRemove={() => updateChildren(container.components.filter((_, itemIndex) => itemIndex !== childIndex))} />
                        ))}
                        <div className="flex flex-wrap gap-2 pt-1"><AddComponentMenu locale={locale} context="container" disabled={container.components.length >= 10} onAdd={(kind) => updateChildren([...container.components, createV2Block(kind) as V2Container['components'][number]])} /><button type="button" disabled={!container.components.length} onClick={() => updateChildren([])} className={`${MINI_BUTTON} h-10 hover:border-[var(--color-destructive)]/30 hover:text-[var(--color-destructive)]`}><Trash size={13} />{text(locale, 'Очистить', 'Clear')}</button></div>
                    </div>
                </EditorCard>
            </div>
        </EditorCard>
    );
}

function JsonModal({ open, locale, value, onClose, onApply }: { open: boolean; locale: LocaleCode; value: string; onClose: () => void; onApply: (value: string) => string | null }) {
    const [draft, setDraft] = useState(value);
    const [error, setError] = useState<string | null>(null);
    return (
        <Modal isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }} size="3xl" scrollBehavior="inside" backdrop="blur" classNames={{ base: 'bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px]', header: 'border-b border-[var(--border-divider)]', footer: 'border-t border-[var(--border-divider)]', closeButton: 'text-white/60 hover:bg-white/10' }}>
            <ModalContent>
                <ModalHeader className="font-sans text-lg text-white">{text(locale, 'JSON сообщения', 'Message JSON')}</ModalHeader>
                <ModalBody className="py-4"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={22} spellCheck={false} className={`${INPUT} resize-y font-mono text-xs leading-relaxed`} />{error && <div className="rounded-xl border border-[var(--color-destructive)]/25 bg-[var(--color-destructive)]/10 px-3 py-2 text-xs text-[var(--color-destructive)]">{error}</div>}</ModalBody>
                <ModalFooter><button type="button" onClick={() => navigator.clipboard?.writeText(draft)} className={MINI_BUTTON}><Copy size={14} />{text(locale, 'Копировать', 'Copy')}</button><button type="button" onClick={onClose} className={MINI_BUTTON}>{text(locale, 'Отмена', 'Cancel')}</button><button type="button" onClick={() => { const nextError = onApply(draft); setError(nextError); if (!nextError) onClose(); }} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--color-primary-1)] px-4 text-xs font-bold text-black"><Check size={14} />{text(locale, 'Применить', 'Apply')}</button></ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export function TicketPanelMessageDesigner({ category, locale, serverEmojis = [], onChange, onSendPreview, previewState = 'idle', previewDisabled = false }: Props) {
    const ticketCopy = getTicketsCopy(locale);
    const legacy = useMemo(() => ({ name: category.name, messageText: category.messageText ?? category.description ?? null, messageEmbeds: category.messageEmbeds ?? null, buttonText: category.buttonText ?? null, buttonEmoji: category.emoji ?? null, buttonStyle: category.buttonStyle ?? null }), [category]);
    const design = useMemo(() => parseTicketPanelMessageDesign(category.messageDesignJson, legacy), [category.messageDesignJson, legacy]);
    const errors = validateTicketPanelMessageDesign(design);
    const [history, setHistory] = useState<string[]>([]);
    const [future, setFuture] = useState<string[]>([]);
    const [jsonOpen, setJsonOpen] = useState(false);
    const [clearOpen, setClearOpen] = useState(false);
    const [pendingMode, setPendingMode] = useState<TicketPanelMessageDesign['mode'] | null>(null);
    const [mobilePreview, setMobilePreview] = useState(false);

    const commit = (next: TicketPanelMessageDesign, track = true) => {
        const currentJson = serializeTicketPanelMessageDesign(design);
        const nextJson = serializeTicketPanelMessageDesign(next);
        if (currentJson === nextJson) return;
        if (track) {
            setHistory((items) => [...items.slice(-49), currentJson]);
            setFuture([]);
        }
        commitDesign(next, onChange);
    };

    const undo = () => {
        const previous = history.at(-1);
        if (!previous) return;
        setHistory((items) => items.slice(0, -1));
        setFuture((items) => [serializeTicketPanelMessageDesign(design), ...items].slice(0, 50));
        commitDesign(parseTicketPanelMessageDesign(previous, legacy), onChange);
    };
    const redo = () => {
        const next = future[0];
        if (!next) return;
        setFuture((items) => items.slice(1));
        setHistory((items) => [...items.slice(-49), serializeTicketPanelMessageDesign(design)]);
        commitDesign(parseTicketPanelMessageDesign(next, legacy), onChange);
    };

    const updateOpener = (patch: Partial<TicketPanelMessageDesign['opener']>) => commit({ ...design, opener: { ...design.opener, ...patch } } as TicketPanelMessageDesign);
    const switchMode = (mode: TicketPanelMessageDesign['mode']) => {
        const next = mode === 'components_v2' ? ensureV2(design, category) : ensureClassic(design, category);
        commit(next);
        setPendingMode(null);
    };
    const updateClassic = (patch: Partial<Extract<TicketPanelMessageDesign, { mode: 'classic_embed' }>>) => commit({ ...ensureClassic(design, category), ...patch });
    const updateV2 = (components: V2TopLevelComponent[]) => commit({ ...ensureV2(design, category), components, flags: COMPONENTS_V2_FLAG });
    const sendPreview = async () => { if (onSendPreview && !previewDisabled && !errors.length) await onSendPreview(serializeTicketPanelMessageDesign(design)); };
    const clearDesign = () => { const next = design.mode === 'components_v2' ? { ...ensureV2(design, category), components: [] } : { ...ensureClassic(design, category), content: '', embeds: [] }; commit(next); setClearOpen(false); };

    const preview = <TicketPanelDesignPreview designJson={serializeTicketPanelMessageDesign(design)} legacy={legacy} entryPoints={category.entryPoints} ghostReplies={category.ghostReplies} />;

    return (
        <div className="overflow-visible rounded-[24px] border border-[var(--border-divider)] bg-[var(--surface-hover)]/70 p-3 sm:p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
                <div className="min-w-0 space-y-4">
                    <div className="flex flex-col-reverse gap-3 border-b border-[var(--border-divider)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <IconButton label={text(locale, 'Отменить', 'Undo')} disabled={!history.length} onClick={undo}><ArrowCounterClockwise size={18} /></IconButton>
                            <IconButton label={text(locale, 'Повторить', 'Redo')} disabled={!future.length} onClick={redo}><ArrowClockwise size={18} /></IconButton>
                            <IconButton label={text(locale, 'Очистить сообщение', 'Clear message')} danger onClick={() => setClearOpen(true)}><Trash size={17} /></IconButton>
                            <IconButton label="JSON" onClick={() => setJsonOpen(true)}><Code size={18} /></IconButton>
                            <button type="button" onClick={() => setMobilePreview(true)} className="xl:hidden"><span className={`${MINI_BUTTON} h-8`}><Eye size={15} />{text(locale, 'Превью', 'Preview')}</span></button>
                        </div>
                        <div className="inline-flex w-fit rounded-xl border border-[var(--border-divider)] bg-black/25 p-1">
                            {(['classic_embed', 'components_v2'] as const).map((mode) => (
                                <button key={mode} type="button" onClick={() => design.mode !== mode && setPendingMode(mode)} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${design.mode === mode ? 'bg-[var(--surface-hover)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-white'}`}>{mode === 'classic_embed' ? 'Embeds V1' : 'Components V2'}</button>
                            ))}
                        </div>
                    </div>

                    {category.entryPoints.length === 0 && <div className="grid gap-3 rounded-2xl border border-[var(--border-divider)] bg-black/10 p-3 sm:grid-cols-[minmax(0,1fr)_120px_minmax(170px,220px)]">
                        <label className="block space-y-1.5"><span className={LABEL}>{text(locale, 'Текст кнопки открытия', 'Opener label')} <span className="ml-1 text-white/30">{design.opener.label.length} / 80</span></span><input value={design.opener.label} maxLength={80} onChange={(event) => updateOpener({ label: event.target.value })} className={INPUT} /></label>
                        <div className="space-y-1.5"><span className={LABEL}>{text(locale, 'Эмодзи', 'Emoji')}</span><EmojiField value={design.opener.emoji ?? null} onChange={(emoji) => updateOpener({ emoji })} customLabel={text(locale, 'Свой эмодзи', 'Custom emoji')} serverLabel={text(locale, 'Эмодзи сервера', 'Server emoji')} serverEmojis={serverEmojis} /></div>
                        <div className="space-y-1.5"><span className={LABEL}>{text(locale, 'Стиль кнопки', 'Button style')}</span><InteractiveSelect value={design.opener.style} onChange={(style) => updateOpener({ style: style as TicketButtonStyle })} options={BUTTON_STYLES.map((style) => ({ id: style, name: style }))} /></div>
                    </div>}

                    {design.mode === 'classic_embed' ? (
                        <div className="space-y-3">
                            <RichTextarea label={text(locale, 'Текст сообщения', 'Message content')} value={design.content} onChange={(content) => updateClassic({ content })} maxLength={2000} rows={5} />
                            <EditorCard title="Embeds" summary={`${design.embeds.length} / 10`} defaultOpen>
                                <div className="space-y-2">
                                    {design.embeds.map((embed, index) => (
                                        <EmbedEditor key={`${index}-${embed.title}`} embed={embed} index={index} count={design.embeds.length} locale={locale} onChange={(next) => updateClassic({ embeds: design.embeds.map((item, itemIndex) => itemIndex === index ? next : item) })} onMove={(direction) => updateClassic({ embeds: moveItem(design.embeds, index, direction) })} onDuplicate={() => updateClassic({ embeds: [...design.embeds.slice(0, index + 1), duplicateWithFreshIds(embed), ...design.embeds.slice(index + 1)] })} onRemove={() => updateClassic({ embeds: design.embeds.filter((_, itemIndex) => itemIndex !== index) })} />
                                    ))}
                                    <div className="flex flex-wrap gap-2 pt-1"><button type="button" disabled={design.embeds.length >= 10} onClick={() => updateClassic({ embeds: [...design.embeds, defaultEmbed(category)] })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-primary-1)] px-3.5 text-xs font-bold text-black disabled:opacity-30"><Plus size={15} />{text(locale, 'Добавить embed', 'Add embed')}</button><button type="button" disabled={!design.embeds.length} onClick={() => updateClassic({ embeds: [] })} className={`${MINI_BUTTON} h-10 hover:border-[var(--color-destructive)]/30 hover:text-[var(--color-destructive)]`}><Trash size={14} />{text(locale, 'Очистить embeds', 'Clear embeds')}</button></div>
                                </div>
                            </EditorCard>
                        </div>
                    ) : (
                        <EditorCard title={text(locale, 'Компоненты', 'Components')} summary={`${design.components.length} / 4`} defaultOpen>
                            <div className="space-y-2">
                                {design.components.map((component, index) => (
                                    <V2ComponentEditor key={component.id ?? index} component={component} index={index} count={design.components.length} locale={locale} serverEmojis={serverEmojis} onChange={(next) => updateV2(design.components.map((item, itemIndex) => itemIndex === index ? next as V2TopLevelComponent : item))} onMove={(direction) => updateV2(moveItem(design.components, index, direction))} onDuplicate={() => updateV2([...design.components.slice(0, index + 1), duplicateWithFreshIds(component), ...design.components.slice(index + 1)].slice(0, 4))} onRemove={() => updateV2(design.components.filter((_, itemIndex) => itemIndex !== index))} />
                                ))}
                                <div className="flex flex-wrap gap-2 pt-1"><AddComponentMenu locale={locale} context="root" disabled={design.components.length >= 4} onAdd={(kind) => updateV2([...design.components, createV2Block(kind) as V2TopLevelComponent])} /><button type="button" disabled={!design.components.length} onClick={() => updateV2([])} className={`${MINI_BUTTON} h-10 hover:border-[var(--color-destructive)]/30 hover:text-[var(--color-destructive)]`}><Trash size={14} />{text(locale, 'Очистить компоненты', 'Clear components')}</button></div>
                            </div>
                        </EditorCard>
                    )}

                    {errors.length > 0 && <div className="space-y-1 rounded-2xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 p-3 text-xs leading-relaxed text-[var(--color-warning)]">{errors.map((error) => <div key={error}>• {error}</div>)}</div>}
                    <div className="flex items-center justify-end"><button type="button" onClick={sendPreview} disabled={!onSendPreview || previewDisabled || errors.length > 0 || previewState === 'sending'} className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--color-primary-1)] px-4 text-xs font-bold text-black shadow-[0_0_20px_rgba(117,241,106,0.12)] disabled:cursor-not-allowed disabled:opacity-35"><PaperPlaneTilt size={15} weight="bold" />{previewState === 'sending' ? text(locale, 'Отправляем…', 'Sending…') : previewState === 'sent' ? text(locale, 'Отправлено', 'Sent') : previewState === 'error' ? text(locale, 'Ошибка отправки', 'Send failed') : text(locale, 'Тестовая отправка', 'Test send')}</button></div>
                </div>

                <aside className="hidden min-w-0 xl:block"><div className="sticky top-4 space-y-2"><div className="flex items-center justify-between"><span className={`${LABEL} inline-flex items-center gap-1.5`}><Eye size={13} />{text(locale, 'Предпросмотр Discord', 'Discord preview')}</span><span className="text-[10px] font-semibold text-[var(--text-muted)]">LIVE</span></div>{preview}</div></aside>
            </div>

            {mobilePreview && <div className="fixed inset-0 z-[90] flex items-end bg-black/70 backdrop-blur-sm xl:hidden" onClick={() => setMobilePreview(false)}><div className="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" /><IconButton label={text(locale, 'Закрыть', 'Close')} onClick={() => setMobilePreview(false)}><X size={17} /></IconButton></div>{preview}</div></div>}

            {jsonOpen && <JsonModal open locale={locale} value={serializeTicketPanelMessageDesign(design)} onClose={() => setJsonOpen(false)} onApply={(value) => { try { const parsed = JSON.parse(value) as TicketPanelMessageDesign; if (parsed?.mode !== 'classic_embed' && parsed?.mode !== 'components_v2') return text(locale, 'Ожидался объект сообщения с mode.', 'Expected a message object with mode.'); commit(parsed); return null; } catch (error) { return error instanceof Error ? error.message : text(locale, 'Некорректный JSON', 'Invalid JSON'); } }} />}

            <Modal isOpen={clearOpen} onOpenChange={setClearOpen} size="sm" backdrop="blur" classNames={{ base: 'bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px]', header: 'border-b border-[var(--border-divider)]', footer: 'border-t border-[var(--border-divider)]', closeButton: 'text-white/60 hover:bg-white/10' }}><ModalContent><ModalHeader className="font-sans text-lg text-white">{text(locale, 'Очистить сообщение?', 'Clear message?')}</ModalHeader><ModalBody className="py-5 text-sm leading-relaxed text-[var(--text-secondary)]">{text(locale, 'Содержимое текущего режима будет удалено. Действие можно отменить кнопкой истории.', 'The current mode content will be removed. You can still undo it from the history toolbar.')}</ModalBody><ModalFooter><button type="button" onClick={() => setClearOpen(false)} className={MINI_BUTTON}>{text(locale, 'Отмена', 'Cancel')}</button><button type="button" onClick={clearDesign} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--color-destructive)] px-4 text-xs font-bold text-white"><Trash size={14} />{text(locale, 'Очистить', 'Clear')}</button></ModalFooter></ModalContent></Modal>

            <Modal isOpen={Boolean(pendingMode)} onOpenChange={(open) => { if (!open) setPendingMode(null); }} size="sm" backdrop="blur" classNames={{ base: 'bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px]', header: 'border-b border-[var(--border-divider)]', footer: 'border-t border-[var(--border-divider)]', closeButton: 'text-white/60 hover:bg-white/10' }}><ModalContent><ModalHeader className="font-sans text-lg text-white">{pendingMode === 'components_v2' ? text(locale, 'Включить Components V2?', 'Enable Components V2?') : text(locale, 'Вернуться к Embeds V1?', 'Switch back to Embeds V1?')}</ModalHeader><ModalBody className="space-y-3 py-5 text-sm leading-relaxed text-[var(--text-secondary)]"><p>{text(locale, 'Структура сообщения будет преобразована под выбранный формат. Кнопка открытия тикета сохранится.', 'The message will be converted to the selected format. The ticket opener action will be preserved.')}</p><p className="inline-flex items-center">{pendingMode === 'components_v2' ? ticketCopy.terms.componentsV2 : ticketCopy.terms.embed}<TermHint explanation={pendingMode === 'components_v2' ? ticketCopy.terms.componentsV2 : ticketCopy.terms.embed} /></p></ModalBody><ModalFooter><button type="button" onClick={() => setPendingMode(null)} className={MINI_BUTTON}>{text(locale, 'Отмена', 'Cancel')}</button><button type="button" onClick={() => pendingMode && switchMode(pendingMode)} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--color-primary-1)] px-4 text-xs font-bold text-black"><Check size={14} />{text(locale, 'Переключить', 'Switch')}</button></ModalFooter></ModalContent></Modal>
        </div>
    );
}
