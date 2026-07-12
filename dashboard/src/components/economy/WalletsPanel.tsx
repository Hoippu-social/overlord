'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MagnifyingGlass, ArrowUp, ArrowDown, Prohibit } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import type { EconomyWorkspaceData, WalletsPage, WalletRow } from '@/lib/economy/types';
import { getEconomyCopy } from '@/lib/economy/i18n';
import { loadWallets, adjustBalance, setBlacklist } from '@/lib/economy/api';
import { formatMoney } from '@/lib/economy/format';
import {
    EmptyState,
    LoadingBlock,
    Chip,
    RolePill,
    AgentAvatar,
    ActionButton,
    ModalShell,
    LabeledField,
    MoneyField,
    TextField,
    SelectField,
    EmojiPreview,
} from './primitives';

const PAGE_SIZE = 25;

interface GrantState {
    row: WalletRow;
    mode: 'grant' | 'deduct';
    account: 'WALLET' | 'BANK';
    amount: string | null;
    reason: string;
    error: string | null;
    saving: boolean;
}

export function WalletsPanel({
    guildId,
    data,
    locale,
}: {
    guildId: string;
    data: EconomyWorkspaceData;
    locale: LocaleCode;
}) {
    const t = getEconomyCopy(locale);
    const roleById = new Map(data.roles.map((r) => [r.id, r]));
    const CurrencySymbol = () =>
        data.config.currencyEmoji ? (
            <EmojiPreview value={data.config.currencyEmoji} serverEmojis={data.emojis} className="h-3.5 w-3.5" />
        ) : (
            <span>{data.config.currencyName}</span>
        );

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageData, setPageData] = useState<WalletsPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [grant, setGrant] = useState<GrantState | null>(null);
    const reqRef = useRef(0);

    // Debounce search (~300ms); reset to page 1 on new query.
    useEffect(() => {
        const id = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(id);
    }, [search]);

    const fetchPage = () => {
        if (!guildId) return;
        const reqId = ++reqRef.current;
        setLoading(true);
        loadWallets(guildId, { page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined })
            .then((res) => {
                if (reqRef.current === reqId) {
                    setPageData(res);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (reqRef.current === reqId) {
                    setPageData(null);
                    setLoading(false);
                }
            });
    };

    useEffect(() => {
        fetchPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guildId, page, debouncedSearch]);

    const openGrant = (row: WalletRow, mode: 'grant' | 'deduct') => {
        setGrant({ row, mode, account: 'WALLET', amount: null, reason: '', error: null, saving: false });
    };

    const toggleBlacklist = async (row: WalletRow) => {
        try {
            await setBlacklist(guildId, { userId: row.userId, blacklisted: !row.blacklisted });
            fetchPage();
        } catch {
            /* keep table as-is on failure */
        }
    };

    const submitGrant = async () => {
        if (!grant) return;
        if (!grant.reason.trim()) {
            setGrant({ ...grant, error: t.wallets.reasonRequired });
            return;
        }
        setGrant({ ...grant, saving: true, error: null });
        try {
            await adjustBalance(guildId, {
                userId: grant.row.userId,
                account: grant.account,
                amount: grant.amount ?? '0',
                reason: grant.reason.trim(),
                mode: grant.mode,
            });
            setGrant(null);
            fetchPage();
        } catch (err) {
            setGrant((prev) =>
                prev ? { ...prev, saving: false, error: err instanceof Error ? err.message : t.saveFailed } : prev
            );
        }
    };

    const rows = pageData?.rows ?? [];
    const total = pageData?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Search */}
            <div className="relative max-w-md">
                <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.wallets.search}
                    className="h-11 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] pl-10 pr-4 text-sm font-medium text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] hover:border-[var(--border-divider)] focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20"
                />
            </div>

            {loading && !pageData ? (
                <LoadingBlock label={t.loading} />
            ) : rows.length === 0 ? (
                <EmptyState title={t.wallets.empty} />
            ) : (
                <div className="overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                    {/* Header */}
                    <div className="hidden items-center gap-3 border-b border-[var(--border-divider)] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] lg:flex">
                        <span className="flex-1">{t.wallets.user}</span>
                        <span className="w-32">{t.wallets.role}</span>
                        <span className="w-28 text-right">{t.wallets.wallet}</span>
                        <span className="w-28 text-right">{t.wallets.bank}</span>
                        <span className="w-28 text-right">{t.wallets.total}</span>
                        <span className="w-28 text-right">{t.wallets.actions}</span>
                    </div>

                    <ul className="divide-y divide-[var(--border-divider)]">
                        {rows.map((row) => {
                            const role = row.topRoleId ? roleById.get(row.topRoleId) : undefined;
                            const name = row.displayName || row.userId;
                            return (
                                <li
                                    key={row.userId}
                                    className="group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] lg:flex-row lg:items-center"
                                >
                                    {/* User */}
                                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                        <AgentAvatar name={name} avatar={row.avatar} size={30} />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-semibold text-white">{name}</p>
                                                {row.blacklisted && <Chip tone="danger">{t.wallets.blacklisted}</Chip>}
                                            </div>
                                            <p className="truncate font-akony text-[11px] text-[var(--text-secondary)]">{row.userId}</p>
                                        </div>
                                    </div>

                                    {/* Role */}
                                    <div className="w-full shrink-0 lg:w-32">
                                        {role && <RolePill name={role.name} color={role.color} />}
                                    </div>

                                    {/* Wallet */}
                                    <div className="w-full shrink-0 text-left font-akony text-sm tabular-nums text-white lg:w-28 lg:text-right">
                                        <span className="mb-1 block font-sans text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] lg:hidden">{t.wallets.wallet}</span>
                                        <span className="inline-flex items-center gap-1">
                                            {formatMoney(row.wallet)} <span className="text-[var(--text-secondary)]"><CurrencySymbol /></span>
                                        </span>
                                    </div>
                                    {/* Bank */}
                                    <div className="w-full shrink-0 text-left font-akony text-sm tabular-nums text-[var(--text-primary)] lg:w-28 lg:text-right">
                                        <span className="mb-1 block font-sans text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] lg:hidden">{t.wallets.bank}</span>
                                        {formatMoney(row.bank)}
                                    </div>
                                    {/* Total earned */}
                                    <div className="w-full shrink-0 text-left font-akony text-sm tabular-nums text-[var(--text-primary)] lg:w-28 lg:text-right">
                                        <span className="mb-1 block font-sans text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] lg:hidden">{t.wallets.total}</span>
                                        {formatMoney(row.totalEarned)}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex w-full shrink-0 items-center justify-start gap-1 lg:w-28 lg:justify-end lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
                                        <button
                                            onClick={() => openGrant(row, 'grant')}
                                            title={t.wallets.grant}
                                            aria-label={t.wallets.grant}
                                            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--color-primary-1)] transition-colors hover:bg-[var(--color-primary-1)]/15"
                                        >
                                            <ArrowUp size={15} weight="bold" />
                                        </button>
                                        <button
                                            onClick={() => openGrant(row, 'deduct')}
                                            title={t.wallets.deduct}
                                            aria-label={t.wallets.deduct}
                                            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive)]/15"
                                        >
                                            <ArrowDown size={15} weight="bold" />
                                        </button>
                                        <button
                                            onClick={() => toggleBlacklist(row)}
                                            title={row.blacklisted ? t.wallets.unblacklist : t.wallets.blacklist}
                                            aria-label={row.blacklisted ? t.wallets.unblacklist : t.wallets.blacklist}
                                            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                                                row.blacklisted
                                                    ? 'border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]'
                                                    : 'border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-white'
                                            }`}
                                        >
                                            <Prohibit size={15} weight="bold" />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Pagination */}
                    <div className="flex items-center justify-between gap-3 border-t border-[var(--border-divider)] px-4 py-3">
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            {t.wallets.page} {page} {t.wallets.of} {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <ActionButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                                9
                            </ActionButton>
                            <ActionButton onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                                :
                            </ActionButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Grant / Deduct modal */}
            {grant && (
                <ModalShell
                    title={t.wallets.grantTitle}
                    onClose={() => setGrant(null)}
                    footer={
                        <>
                            <ActionButton onClick={() => setGrant(null)}>{t.wallets.cancel}</ActionButton>
                            <ActionButton variant="primary" onClick={submitGrant} disabled={grant.saving}>
                                {grant.saving ? t.saving : t.wallets.confirm}
                            </ActionButton>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex items-center gap-2.5">
                            <AgentAvatar name={grant.row.displayName || grant.row.userId} avatar={grant.row.avatar} size={32} />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                    {grant.row.displayName || grant.row.userId}
                                </p>
                                <p className="font-akony text-[11px] text-[var(--text-secondary)]">
                                    {grant.mode === 'grant' ? t.wallets.grant : t.wallets.deduct}
                                </p>
                            </div>
                        </div>
                        <LabeledField label={t.wallets.grantAccount}>
                            <SelectField
                                value={grant.account}
                                onChange={(v) => setGrant({ ...grant, account: v })}
                                options={[
                                    { value: 'WALLET', label: t.wallets.accountWallet },
                                    { value: 'BANK', label: t.wallets.accountBank },
                                ]}
                            />
                        </LabeledField>
                        <LabeledField label={t.wallets.grantAmount}>
                            <MoneyField value={grant.amount} onChange={(v) => setGrant({ ...grant, amount: v })} placeholder="0" />
                        </LabeledField>
                        <LabeledField label={t.wallets.grantReason}>
                            <TextField value={grant.reason} onChange={(v) => setGrant({ ...grant, reason: v })} />
                        </LabeledField>
                        {grant.error && <p className="text-xs font-semibold text-[var(--color-destructive)]">{grant.error}</p>}
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
