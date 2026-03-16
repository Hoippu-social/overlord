'use client';

import React, { useState } from 'react';
import { use } from 'react';
import { useGuildLocale } from '@/lib/i18n';
import { Wallet, Coins, ArrowUpRight, ArrowDownRight, MagnifyingGlass, Funnel, Plus, ChartLineUp, CurrencyDollar } from '@phosphor-icons/react';
import { Button } from '@nextui-org/react';

const strings = {
    en: {
        title: 'Economy',
        search: 'Search users or wallets...',
        filter: 'Filter',
        action: 'Transaction',
        give: 'Add Balance',
        take: 'Deduct Balance',
        shop: 'Shop items',
        user: 'User',
        balance: 'Balance',
        role: 'Role',
        recentAction: 'Recent Activity',
        noResults: 'No users found matching your criteria.',
        overview: 'Overview',
        totalCirculation: 'Total in Circulation',
        '24hVolume': '24h Volume',
        topHolders: 'Top Holders',
    },
    ru: {
        title: 'Экономика',
        search: 'Поиск пользователей или кошельков...',
        filter: 'Фильтр',
        action: 'Транзакция',
        give: 'Выдать баланс',
        take: 'Забрать баланс',
        shop: 'Товары магазина',
        user: 'Пользователь',
        balance: 'Баланс',
        role: 'Роль',
        recentAction: 'Последняя активность',
        noResults: 'Пользователи не найдены.',
        overview: 'Обзор',
        totalCirculation: 'Всего в обороте',
        '24hVolume': 'Объем за 24ч',
        topHolders: 'Топ богачей',
    }
} as const;

// Dummy data for visual development
const dummyUsers = [
    { id: '1', name: 'AlexTheGreat', avatar: null, balance: 145000, role: 'VIP', lastAction: 'Bought "Color Role"' },
    { id: '2', name: 'CryptoKing', avatar: null, balance: 1210500, role: 'Admin', lastAction: 'Daily reward' },
    { id: '3', name: 'SilentObserver', avatar: null, balance: 450, role: 'Member', lastAction: 'Transferred 50 to User4' },
    { id: '4', name: 'NormalUser', avatar: null, balance: 12050, role: 'Member', lastAction: 'Received 50 from User3' },
    { id: '5', name: 'Troublemaker99', avatar: null, balance: 0, role: 'Member', lastAction: 'Lost 100 on roulette' },
];

export default function EconomyPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = use(params);
    const { locale } = useGuildLocale(guildId);
    const t = strings[locale];

    const [search, setSearch] = useState('');

    const filteredUsers = dummyUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="animate-fade-in pb-12 w-full max-w-[1200px] mx-auto space-y-8">
            {/* Top KPI row imitating Coinbase Pro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 rounded-[24px] shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)] flex items-center justify-center shrink-0">
                        <Coins size={24} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-1">{t.totalCirculation}</div>
                        <div className="text-2xl font-bold font-akony text-[var(--text-primary)] tracking-wide">1,380,450</div>
                    </div>
                </div>

                <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 rounded-[24px] shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-primary-2)]/10 text-[var(--color-primary-2)] flex items-center justify-center shrink-0">
                        <ChartLineUp size={24} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-1">{t['24hVolume']}</div>
                        <div className="text-2xl font-bold font-akony text-[var(--text-primary)] tracking-wide flex items-center gap-2">
                            <span>24,500</span>
                            <span className="text-sm text-[var(--color-primary-1)] flex items-center"><ArrowUpRight size={14} /> 12%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 rounded-[24px] shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)] flex items-center justify-center shrink-0">
                        <CurrencyDollar size={24} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-1">{t.shop}</div>
                        <div className="text-2xl font-bold font-akony text-[var(--text-primary)] tracking-wide">14 Items</div>
                    </div>
                </div>
            </div>

            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 w-full max-w-md relative">
                    <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                        type="text"
                        placeholder={t.search}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-11 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-full pl-11 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary-1)]/50 transition-colors shadow-inner"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        className="bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] h-11 rounded-full px-5 transition-colors shadow-sm"
                        startContent={<Funnel size={16} />}
                        variant="flat"
                    >
                        {t.filter}
                    </Button>
                    <Button
                        className="bg-[var(--color-primary-1)] text-black font-bold h-11 rounded-full px-6 shadow-[0_0_20px_rgba(117,241,106,0.2)] hover:shadow-[0_0_25px_rgba(117,241,106,0.4)] transition-all"
                        startContent={<Plus size={16} weight="bold" />}
                    >
                        {t.action}
                    </Button>
                </div>
            </div>

            {/* Data Grid / Table */}
            <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] overflow-hidden shadow-sm shadow-black/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--border-divider)]">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">{t.user}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">{t.role}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap text-right">{t.balance}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap hidden md:table-cell">{t.recentAction}</th>
                                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">{t.action}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-divider)]">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-[var(--surface-hover)] transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] border border-[var(--border-divider)] flex items-center justify-center text-[var(--text-muted)] font-akony text-sm">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-[var(--text-primary)]">{user.name}</span>
                                                    <span className="text-xs text-[var(--text-muted)] tabular-nums">{user.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-1 rounded-md border border-[var(--border-subtle)]">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-akony tabular-nums text-[var(--text-primary)] flex items-center gap-1">
                                                    <Coins size={14} className="text-[var(--color-primary-1)]" weight="duotone" />
                                                    {user.balance.toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell text-sm text-[var(--text-secondary)]">
                                            {user.lastAction}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--color-primary-1)]/10 hover:text-[var(--color-primary-1)] transition-colors" title={t.give}>
                                                    <ArrowUpRight size={16} weight="bold" />
                                                </button>
                                                <button className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] transition-colors" title={t.take}>
                                                    <ArrowDownRight size={16} weight="bold" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)] text-sm">
                                        {t.noResults}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Visual only for now) */}
                <div className="px-6 py-4 border-t border-[var(--border-divider)] flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Showing 1 to {filteredUsers.length} of {filteredUsers.length}</span>
                    <div className="flex items-center gap-1">
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50" disabled>1</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
