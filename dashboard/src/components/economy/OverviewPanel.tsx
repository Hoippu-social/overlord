'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Coins, Wallet, Bank, Users, ArrowUp, ArrowDown, Sparkle } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import type { EconomyWorkspaceData, OverviewData } from '@/lib/economy/types';
import { getEconomyCopy, LEDGER_TYPE_LABELS } from '@/lib/economy/i18n';
import { loadOverview } from '@/lib/economy/api';
import { formatMoney, formatMoneyCompact, formatCurrency, formatDate, currencySymbolText } from '@/lib/economy/format';
import { StatsCard } from '@/components/stats/StatsCard';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';
import { Panel, EmptyState, LoadingBlock } from './primitives';

const PERIODS: Array<'24h' | '7d' | '30d' | '90d'> = ['24h', '7d', '30d', '90d'];

function toNum(value: string): number {
    try {
        return Number(BigInt(value.split('.')[0] || '0'));
    } catch {
        return Number(value) || 0;
    }
}

function BreakdownList({
    rows,
    total,
    locale,
    variant,
}: {
    rows: { type: OverviewData['sources'][number]['type']; amount: string }[];
    total: string;
    locale: LocaleCode;
    variant: 'source' | 'sink';
}) {
    const totalN = toNum(total) || 1;
    const barColor = variant === 'source' ? 'var(--color-primary-1)' : 'var(--color-primary-2)';
    return (
        <ul className="flex flex-col gap-3">
            {rows.map((row) => {
                const amountN = toNum(row.amount);
                const pct = Math.max(2, Math.min(100, (amountN / totalN) * 100));
                return (
                    <li key={row.type} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-xs font-semibold text-[var(--text-secondary)]">
                                {LEDGER_TYPE_LABELS[locale][row.type]}
                            </span>
                            <span className="shrink-0 font-akony text-xs tabular-nums text-white">
                                {formatMoney(row.amount)}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                            <div
                                className="h-full rounded-full transition-[width] duration-500"
                                style={{ width: `${pct}%`, backgroundColor: barColor }}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

export function OverviewPanel({ guildId, data, locale }: { guildId: string; data: EconomyWorkspaceData; locale: LocaleCode }) {
    const t = getEconomyCopy(locale);
    const currency = { name: data.config.currencyName, emoji: data.config.currencyEmoji };

    const [period, setPeriod] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const reqRef = useRef(0);

    useEffect(() => {
        if (!guildId) return;
        const reqId = ++reqRef.current;
        Promise.resolve()
            .then(() => {
                if (reqRef.current === reqId) setLoading(true);
                return loadOverview(guildId, period);
            })
            .then((res) => {
                if (reqRef.current === reqId) {
                    setOverview(res);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (reqRef.current === reqId) {
                    setOverview(null);
                    setLoading(false);
                }
            });
    }, [guildId, period]);

    const trendData = (overview?.trend ?? []).map((point) => ({
        date: formatDate(point.date, locale),
        emission: toNum(point.emission),
        sink: toNum(point.sink),
    }));

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex w-full flex-col gap-1.5 sm:max-w-[34rem]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t.overview.period}
                </span>
                <SegmentedTabs
                    active={period}
                    onChange={(next) => setPeriod(next as typeof period)}
                    labels={t.overview.periods}
                    tabs={PERIODS}
                    density="compact"
                />
            </div>

            {loading && !overview ? (
                <LoadingBlock label={t.loading} />
            ) : (
                <>
                    {/* KPI row */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                        <StatsCard
                            title={t.overview.totalSupply}
                            value={formatMoneyCompact(overview?.totalSupply ?? '0')}
                            subValue={currencySymbolText(currency)}
                            icon={<Coins size={20} weight="duotone" />}
                        />
                        <StatsCard
                            title={t.overview.wallet}
                            value={formatMoneyCompact(overview?.totalWallet ?? '0')}
                            subValue={currencySymbolText(currency)}
                            icon={<Wallet size={20} weight="duotone" />}
                        />
                        <StatsCard
                            title={t.overview.bank}
                            value={formatMoneyCompact(overview?.totalBank ?? '0')}
                            subValue={currencySymbolText(currency)}
                            icon={<Bank size={20} weight="duotone" />}
                        />
                        <StatsCard
                            title={t.overview.members}
                            value={overview?.memberCount ?? data.counts.members}
                            icon={<Users size={20} weight="duotone" />}
                        />
                        <StatsCard
                            title={t.overview.emission}
                            value={formatMoneyCompact(overview?.emissionTotal ?? '0')}
                            subValue={currencySymbolText(currency)}
                            icon={<ArrowUp size={20} weight="bold" />}
                            accentColor="var(--color-primary-1)"
                        />
                        <StatsCard
                            title={t.overview.sinks}
                            value={formatMoneyCompact(overview?.sinkTotal ?? '0')}
                            subValue={currencySymbolText(currency)}
                            icon={<ArrowDown size={20} weight="bold" />}
                            accentColor="var(--color-destructive)"
                        />
                        <StatsCard
                            title={t.overview.activeEvents}
                            value={overview?.activeEventCount ?? 0}
                            icon={<Sparkle size={20} weight="duotone" />}
                            accentColor="var(--color-primary-2)"
                        />
                    </div>

                    {/* Breakdowns */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <Panel title={t.overview.sources} icon={<ArrowUp weight="bold" />}>
                            {overview && overview.sources.length > 0 ? (
                                <BreakdownList
                                    rows={overview.sources}
                                    total={overview.emissionTotal}
                                    locale={locale}
                                    variant="source"
                                />
                            ) : (
                                <p className="py-6 text-center text-xs text-[var(--text-secondary)]">{t.overview.noData}</p>
                            )}
                        </Panel>
                        <Panel title={t.overview.sinksBreakdown} icon={<ArrowDown weight="bold" />}>
                            {overview && overview.sinks.length > 0 ? (
                                <BreakdownList
                                    rows={overview.sinks}
                                    total={overview.sinkTotal}
                                    locale={locale}
                                    variant="sink"
                                />
                            ) : (
                                <p className="py-6 text-center text-xs text-[var(--text-secondary)]">{t.overview.noData}</p>
                            )}
                        </Panel>
                    </div>

                    {/* Trend */}
                    <Panel title={t.overview.trend} icon={<Coins weight="duotone" />}>
                        {trendData.length > 0 ? (
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="ecoEmission" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-primary-1)" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="var(--color-primary-1)" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="ecoSink" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-divider)" vertical={false} />
                                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis
                                            stroke="var(--text-muted)"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => formatMoneyCompact(v)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--surface-card)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: 12,
                                                fontSize: 12,
                                            }}
                                            formatter={(v: number) => formatCurrency(String(v), currency)}
                                            labelStyle={{ color: 'var(--text-muted)' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        <Area
                                            type="monotone"
                                            name={t.overview.emission}
                                            dataKey="emission"
                                            stroke="var(--color-primary-1)"
                                            strokeWidth={2}
                                            fill="url(#ecoEmission)"
                                        />
                                        <Area
                                            type="monotone"
                                            name={t.overview.sinks}
                                            dataKey="sink"
                                            stroke="var(--color-destructive)"
                                            strokeWidth={2}
                                            fill="url(#ecoSink)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <EmptyState title={t.overview.noData} />
                        )}
                    </Panel>
                </>
            )}
        </div>
    );
}
