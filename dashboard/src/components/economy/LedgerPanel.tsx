'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { LocaleCode } from '@/lib/i18n';
import type { EconomyWorkspaceData, LedgerRow, LedgerType } from '@/lib/economy/types';
import { getEconomyCopy, LEDGER_TYPE_LABELS } from '@/lib/economy/i18n';
import { loadLedger } from '@/lib/economy/api';
import { formatMoney, formatRelative, isEmission } from '@/lib/economy/format';
import { EmptyState, LoadingBlock, Chip, ActionButton, LabeledField, TextField, SelectField } from './primitives';

const LEDGER_TYPES: LedgerType[] = [
    'MESSAGE_EARN', 'VOICE_EARN', 'REACTION_EARN', 'DAILY', 'WORK', 'CRIME', 'CRIME_FINE',
    'ROB_STEAL', 'ROB_FAIL', 'INVITE_REWARD', 'SALARY', 'ROLE_TAX', 'FINE',
    'CONFISCATION', 'TRANSFER_OUT', 'TRANSFER_IN', 'COMMISSION', 'SHOP_PURCHASE',
    'ITEM_USE', 'MARKET_SALE', 'MARKET_PURCHASE', 'MARKET_TAX', 'LOTTERY_TICKET',
    'LOTTERY_WIN', 'BET', 'BET_PAYOUT', 'DUEL_STAKE', 'DUEL_WIN', 'RENT_UPKEEP',
    'ADMIN_GRANT', 'ADMIN_DEDUCT', 'AIRDROP', 'LOOT_DROP', 'QUEST_REWARD',
    'ACHIEVEMENT_REWARD', 'SEASON_REWARD', 'SEASON_RESET', 'DEPOSIT', 'WITHDRAW',
    'TICKET_BONUS', 'STATS_TOP_REWARD', 'CLEAN_RECORD_REWARD', 'BIRTHDAY_REWARD',
    'WORLD_EVENT_REWARD', 'BOOSTER_BONUS',
];

export function LedgerPanel({
    guildId,
    locale,
}: {
    guildId: string;
    data: EconomyWorkspaceData;
    locale: LocaleCode;
}) {
    const t = getEconomyCopy(locale);

    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [type, setType] = useState<LedgerType | ''>('');
    const [userId, setUserId] = useState('');
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const reqRef = useRef(0);

    // Debounce the userId filter input.
    useEffect(() => {
        const id = setTimeout(() => setUserId(userInput.trim()), 300);
        return () => clearTimeout(id);
    }, [userInput]);

    // Initial load + reset on filter change.
    useEffect(() => {
        if (!guildId) return;
        const reqId = ++reqRef.current;
        setLoading(true);
        setRows([]);
        loadLedger(guildId, { type: type || null, userId: userId || null })
            .then((res) => {
                if (reqRef.current !== reqId) return;
                setRows(res.rows);
                setCursor(res.nextCursor);
                setHasMore(!!res.nextCursor);
                setLoading(false);
            })
            .catch(() => {
                if (reqRef.current !== reqId) return;
                setRows([]);
                setCursor(null);
                setHasMore(false);
                setLoading(false);
            });
    }, [guildId, type, userId]);

    const loadMore = async () => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const res = await loadLedger(guildId, { cursor, type: type || null, userId: userId || null });
            setRows((prev) => [...prev, ...res.rows]);
            setCursor(res.nextCursor);
            setHasMore(!!res.nextCursor);
        } catch {
            /* keep current rows */
        } finally {
            setLoadingMore(false);
        }
    };

    const typeOptions = [
        { value: '' as LedgerType | '', label: t.ledger.allTypes },
        ...LEDGER_TYPES.map((lt) => ({ value: lt as LedgerType | '', label: LEDGER_TYPE_LABELS[locale][lt] })),
    ];

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Filters */}
            <div className="grid grid-cols-1 gap-3 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:grid-cols-2">
                <LabeledField label={t.ledger.filterType}>
                    <SelectField value={type} onChange={(v) => setType(v)} options={typeOptions} />
                </LabeledField>
                <LabeledField label={t.ledger.filterUser}>
                    <TextField value={userInput} onChange={setUserInput} placeholder={t.ledger.filterUser} />
                </LabeledField>
            </div>

            {loading ? (
                <LoadingBlock label={t.loading} />
            ) : rows.length === 0 ? (
                <EmptyState title={t.ledger.empty} />
            ) : (
                <div className="overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                    {/* Header */}
                    <div className="hidden items-center gap-3 border-b border-[var(--border-divider)] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] lg:flex">
                        <span className="w-40">{t.ledger.type}</span>
                        <span className="flex-1">{t.ledger.user}</span>
                        <span className="w-32 text-right">{t.ledger.amount}</span>
                        <span className="w-32 text-right">{t.ledger.balance}</span>
                        <span className="w-32">{t.ledger.actor}</span>
                        <span className="w-24 text-right">{t.ledger.date}</span>
                    </div>

                    <ul className="divide-y divide-[var(--border-divider)]">
                        {rows.map((row) => {
                            const emission = isEmission(row.amount);
                            const userLabel = row.userId === 'SYSTEM' ? t.ledger.system : row.displayName || row.userId;
                            const amountColor = emission ? 'var(--color-primary-1)' : 'var(--color-destructive)';
                            const sign = emission ? '+' : '';
                            return (
                                <li
                                    key={row.id}
                                    className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] lg:flex-row lg:items-center lg:gap-3"
                                >
                                    <div className="w-full shrink-0 lg:w-40">
                                        <Chip tone={emission ? 'primary' : 'danger'}>{LEDGER_TYPE_LABELS[locale][row.type]}</Chip>
                                    </div>
                                    <div className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{userLabel}</div>
                                    <div
                                        className="w-full shrink-0 text-left font-akony text-sm tabular-nums lg:w-32 lg:text-right"
                                        style={{ color: amountColor }}
                                    >
                                        {sign}
                                        {formatMoney(row.amount)}
                                    </div>
                                    <div className="w-full shrink-0 text-left font-akony text-sm tabular-nums text-[var(--text-secondary)] lg:w-32 lg:text-right">
                                        {formatMoney(row.balanceAfter)}
                                    </div>
                                    <div className="w-full shrink-0 truncate font-akony text-[11px] text-[var(--text-secondary)] lg:w-32">
                                        {row.actorId || '—'}
                                    </div>
                                    <div className="w-full shrink-0 text-left text-[11px] font-medium text-[var(--text-secondary)] tabular-nums lg:w-24 lg:text-right">
                                        {formatRelative(row.createdAt, locale)}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {hasMore && (
                        <div className="flex justify-center border-t border-[var(--border-divider)] px-4 py-3">
                            <ActionButton onClick={loadMore} disabled={loadingMore}>
                                {loadingMore ? t.loading : t.ledger.loadMore}
                            </ActionButton>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
