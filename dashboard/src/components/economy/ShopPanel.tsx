'use client';

import React, { useState } from 'react';
import { Plus, PencilSimple, Trash, Package, Infinity as InfinityIcon, SquaresFour, ListBullets } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getEconomyCopy } from '@/lib/economy/i18n';
import { formatMoney } from '@/lib/economy/format';
import { saveShopItem, deleteShopItem } from '@/lib/economy/api';
import type { EconomyWorkspaceData, ShopItem, ShopItemType } from '@/lib/economy/types';
import {
    Panel,
    EmptyState,
    Chip,
    Toggle,
    EmojiField,
    EmojiPreview,
    LabeledField,
    TextField,
    NumberField,
    MoneyField,
    SelectField,
    RoleSelect,
    ActionButton,
    ModalShell,
    RolePill,
} from './primitives';

interface ShopPanelProps {
    guildId: string;
    data: EconomyWorkspaceData;
    locale: LocaleCode;
    onSaved: () => void;
}

const SHOP_TYPES: ShopItemType[] = ['ROLE', 'TEMP_ROLE', 'BADGE', 'USABLE', 'CUSTOM'];

const TYPE_TONE: Record<ShopItemType, 'primary' | 'info' | 'warning' | 'neutral'> = {
    ROLE: 'primary',
    TEMP_ROLE: 'info',
    BADGE: 'warning',
    USABLE: 'info',
    CUSTOM: 'neutral',
};

function blankDraft(sortOrder: number): Partial<ShopItem> {
    return {
        name: '',
        description: '',
        emoji: '',
        type: 'ROLE',
        price: '0',
        roleId: null,
        tempRoleHours: null,
        useEffect: null,
        stock: null,
        maxPerUser: null,
        requiredRoleIds: [],
        deniedRoleIds: [],
        resellable: false,
        rentUpkeepAmount: null,
        rentUpkeepIntervalHours: null,
        enabled: true,
        sortOrder,
    };
}

export function ShopPanel({ guildId, data, locale, onSaved }: ShopPanelProps) {
    const t = getEconomyCopy(locale);
    const roleById = new Map(data.roles.map((r) => [r.id, r]));

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [draft, setDraft] = useState<Partial<ShopItem> | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const openNew = () => {
        setError(null);
        setDraft(blankDraft(data.shopItems.length));
    };

    const openEdit = (item: ShopItem) => {
        setError(null);
        setDraft({ ...item });
    };

    const patch = (p: Partial<ShopItem>) => setDraft((prev) => (prev ? { ...prev, ...p } : prev));

    const closeModal = () => {
        setDraft(null);
        setError(null);
    };

    const save = async () => {
        if (!draft) return;
        setSaving(true);
        setError(null);
        try {
            await saveShopItem(guildId, draft);
            setDraft(null);
            onSaved();
        } catch {
            setError(t.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    const toggleEnabled = async (item: ShopItem) => {
        setError(null);
        try {
            await saveShopItem(guildId, { ...item, enabled: !item.enabled });
            onSaved();
        } catch {
            setError(t.saveFailed);
        }
    };

    const remove = async (itemId: number) => {
        setDeletingId(itemId);
        setError(null);
        try {
            await deleteShopItem(guildId, itemId);
            setConfirmId(null);
            onSaved();
        } catch {
            setError(t.saveFailed);
        } finally {
            setDeletingId(null);
        }
    };

    const draftType = draft?.type ?? 'ROLE';

    return (
        <div className="space-y-5 animate-fade-in">
            <Panel
                title={t.tabs.shop}
                icon={<Package weight="duotone" />}
                action={
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                aria-label={t.shop.viewGrid}
                                title={t.shop.viewGrid}
                                className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-primary-1)] text-black' : 'text-[var(--text-secondary)] hover:text-white'}`}
                            >
                                <SquaresFour size={15} weight="bold" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                aria-label={t.shop.viewList}
                                title={t.shop.viewList}
                                className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${viewMode === 'list' ? 'bg-[var(--color-primary-1)] text-black' : 'text-[var(--text-secondary)] hover:text-white'}`}
                            >
                                <ListBullets size={15} weight="bold" />
                            </button>
                        </div>
                        <ActionButton variant="primary" onClick={openNew}>
                            <Plus size={14} weight="bold" /> {t.shop.add}
                        </ActionButton>
                    </div>
                }
                bodyClassName="p-4"
            >
                {data.shopItems.length === 0 ? (
                    <EmptyState title={t.shop.empty} icon={<Package size={40} weight="duotone" />} />
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {data.shopItems.map((item) => {
                            const role = item.roleId ? roleById.get(item.roleId) : null;
                            const isConfirming = confirmId === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className={`group relative flex flex-col gap-2.5 rounded-2xl border bg-[var(--surface-hover)] p-3.5 transition-colors ${item.enabled ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)] opacity-60'}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-divider)] bg-[var(--surface-card)] text-xl">
                                            {item.emoji ? (
                                                <EmojiPreview value={item.emoji} serverEmojis={data.emojis} className="h-7 w-7 text-xl leading-none" />
                                            ) : (
                                                '📦'
                                            )}
                                        </span>
                                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <button
                                                onClick={() => openEdit(item)}
                                                className="rounded-lg border border-transparent p-1.5 text-[var(--text-secondary)] transition-colors hover:border-[var(--border-divider)] hover:bg-[var(--surface-card)] hover:text-white"
                                                aria-label={t.shop.edit}
                                            >
                                                <PencilSimple size={14} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmId(isConfirming ? null : item.id)}
                                                className="rounded-lg border border-transparent p-1.5 text-[var(--text-secondary)] transition-colors hover:border-[var(--color-destructive)]/40 hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]"
                                                aria-label={t.shop.delete}
                                            >
                                                <Trash size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="truncate text-sm font-bold text-white">{item.name || '—'}</span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <Chip tone={TYPE_TONE[item.type]}>{t.shop.types[item.type]}</Chip>
                                            {role && <RolePill name={role.name} color={role.color} />}
                                        </div>
                                        {item.description && (
                                            <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{item.description}</p>
                                        )}
                                    </div>

                                    <div className="mt-auto flex items-center justify-between border-t border-[var(--border-divider)] pt-2.5">
                                        <span className="flex flex-col">
                                            <span className="flex items-center gap-1 tabular-nums text-sm font-bold text-white">
                                                {formatMoney(item.price)}
                                                {data.config.currencyEmoji ? (
                                                    <EmojiPreview value={data.config.currencyEmoji} serverEmojis={data.emojis} className="h-3.5 w-3.5" />
                                                ) : (
                                                    <span className="text-xs">{data.config.currencyName}</span>
                                                )}
                                            </span>
                                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                                                {t.shop.stockShort}:{' '}
                                                {item.stock === null ? <InfinityIcon size={12} weight="bold" /> : <span className="tabular-nums">{item.stock}</span>}
                                            </span>
                                        </span>
                                        <Toggle checked={item.enabled} onChange={() => void toggleEnabled(item)} label={t.shop.enabled} />
                                    </div>

                                    {isConfirming && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--surface-card)]/95 p-3 text-center">
                                            <p className="text-xs font-semibold text-white">{t.shop.deleteConfirm}</p>
                                            <div className="flex gap-2">
                                                <ActionButton variant="danger" onClick={() => void remove(item.id)} disabled={deletingId === item.id}>
                                                    {t.shop.delete}
                                                </ActionButton>
                                                <ActionButton variant="ghost" onClick={() => setConfirmId(null)}>
                                                    {t.shop.cancel}
                                                </ActionButton>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {data.shopItems.map((item) => {
                            const role = item.roleId ? roleById.get(item.roleId) : null;
                            const isConfirming = confirmId === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4 sm:flex-row sm:items-center"
                                >
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-divider)] bg-[var(--surface-card)] text-lg">
                                        {item.emoji ? (
                                            <EmojiPreview value={item.emoji} serverEmojis={data.emojis} className="h-6 w-6 text-lg leading-none" />
                                        ) : (
                                            '📦'
                                        )}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="truncate text-sm font-bold text-white">{item.name || '—'}</span>
                                            <Chip tone={TYPE_TONE[item.type]}>{t.shop.types[item.type]}</Chip>
                                            {!item.enabled && <Chip tone="danger">{t.shop.enabled}: —</Chip>}
                                            {role && <RolePill name={role.name} color={role.color} />}
                                        </div>
                                        {item.description && (
                                            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{item.description}</p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-4 text-xs">
                                        <span className="flex flex-col items-end">
                                            <span className="flex items-center gap-1 tabular-nums text-sm font-bold text-white">
                                                {formatMoney(item.price)}
                                                {data.config.currencyEmoji ? (
                                                    <EmojiPreview value={data.config.currencyEmoji} serverEmojis={data.emojis} className="h-4 w-4" />
                                                ) : (
                                                    <span>{data.config.currencyName}</span>
                                                )}
                                            </span>
                                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                                                {t.shop.stock.split(' (')[0]}:{' '}
                                                {item.stock === null ? <InfinityIcon size={13} weight="bold" /> : <span className="tabular-nums">{item.stock}</span>}
                                            </span>
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Toggle
                                                checked={item.enabled}
                                                onChange={() => void toggleEnabled(item)}
                                                label={t.shop.enabled}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <button
                                            onClick={() => openEdit(item)}
                                            className="rounded-lg border border-transparent p-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--border-divider)] hover:bg-[var(--surface-hover)] hover:text-white"
                                            aria-label={t.shop.edit}
                                        >
                                            <PencilSimple size={16} />
                                        </button>
                                        {isConfirming ? (
                                            <ActionButton
                                                variant="danger"
                                                onClick={() => void remove(item.id)}
                                                disabled={deletingId === item.id}
                                            >
                                                {t.shop.deleteConfirm}
                                            </ActionButton>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmId(item.id)}
                                                className="rounded-lg border border-transparent p-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--color-destructive)]/40 hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]"
                                                aria-label={t.shop.delete}
                                            >
                                                <Trash size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {error && !draft && <p className="mt-3 text-xs font-semibold text-[var(--color-destructive)]">{error}</p>}
            </Panel>

            {draft && (
                <ModalShell
                    title={draft.id ? t.shop.edit : t.shop.add}
                    onClose={closeModal}
                    footer={
                        <>
                            {error && <span className="mr-auto self-center text-xs font-semibold text-[var(--color-destructive)]">{error}</span>}
                            <ActionButton variant="ghost" onClick={closeModal}>
                                {t.shop.cancel}
                            </ActionButton>
                            <ActionButton variant="primary" onClick={() => void save()} disabled={saving}>
                                {saving ? t.saving : t.shop.save}
                            </ActionButton>
                        </>
                    }
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <LabeledField label={t.shop.name} className="sm:col-span-2">
                            <TextField value={draft.name ?? ''} onChange={(v) => patch({ name: v })} />
                        </LabeledField>
                        <LabeledField label={t.shop.description} className="sm:col-span-2">
                            <TextField value={draft.description ?? ''} onChange={(v) => patch({ description: v || null })} />
                        </LabeledField>
                        <LabeledField label={t.shop.emoji}>
                            <EmojiField
                                value={draft.emoji ?? null}
                                onChange={(v) => patch({ emoji: v })}
                                customLabel={t.shop.emojiCustom}
                                serverLabel={t.shop.emojiServer}
                                serverEmojis={data.emojis}
                            />
                        </LabeledField>
                        <LabeledField label={t.shop.type}>
                            <SelectField<ShopItemType>
                                value={draftType}
                                onChange={(v) => patch({ type: v })}
                                options={SHOP_TYPES.map((ty) => ({ value: ty, label: t.shop.types[ty] }))}
                            />
                        </LabeledField>
                        <LabeledField label={t.shop.price}>
                            <MoneyField value={draft.price ?? '0'} onChange={(v) => patch({ price: v ?? '0' })} />
                        </LabeledField>

                        {(draftType === 'ROLE' || draftType === 'TEMP_ROLE') && (
                            <LabeledField label={t.shop.role}>
                                <RoleSelect value={draft.roleId ?? null} onChange={(v) => patch({ roleId: v })} roles={data.roles} />
                            </LabeledField>
                        )}
                        {draftType === 'TEMP_ROLE' && (
                            <LabeledField label={t.shop.tempRoleHours}>
                                <NumberField value={draft.tempRoleHours ?? null} onChange={(v) => patch({ tempRoleHours: v })} min={1} allowNull />
                            </LabeledField>
                        )}
                        {draftType === 'USABLE' && (
                            <LabeledField label="useEffect" hint="JSON" className="sm:col-span-2">
                                <TextField value={draft.useEffect ?? ''} onChange={(v) => patch({ useEffect: v || null })} placeholder='{"type":"..."}' />
                            </LabeledField>
                        )}

                        <LabeledField label={t.shop.stock}>
                            <NumberField value={draft.stock ?? null} onChange={(v) => patch({ stock: v })} min={0} allowNull placeholder="∞" />
                        </LabeledField>
                        <LabeledField label={t.shop.maxPerUser}>
                            <NumberField value={draft.maxPerUser ?? null} onChange={(v) => patch({ maxPerUser: v })} min={0} allowNull />
                        </LabeledField>

                        <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-3 py-2.5">
                            <span className="text-xs font-bold text-[var(--text-secondary)]">{t.shop.resellable}</span>
                            <Toggle checked={draft.resellable ?? false} onChange={(v) => patch({ resellable: v })} label={t.shop.resellable} />
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-3 py-2.5">
                            <span className="text-xs font-bold text-[var(--text-secondary)]">{t.shop.enabled}</span>
                            <Toggle checked={draft.enabled ?? true} onChange={(v) => patch({ enabled: v })} label={t.shop.enabled} />
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
