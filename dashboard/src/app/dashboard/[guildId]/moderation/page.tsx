'use client';

import React, { useState } from 'react';
import { use } from 'react';
import { useParams } from 'next/navigation';
import { useGuildLocale } from '@/lib/i18n';
import { ShieldCheck, MagnifyingGlass, Warning, Prohibit, Hand, Funnel, Plus } from '@phosphor-icons/react';
import { Button, Input, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@nextui-org/react';

const strings = {
    en: {
        title: 'Moderation',
        search: 'Search users...',
        filter: 'Filter',
        action: 'Action',
        ban: 'Ban',
        kick: 'Kick',
        mute: 'Mute',
        warn: 'Warn',
        user: 'User',
        status: 'Status',
        warnings: 'Warnings',
        recentAction: 'Recent Action',
        noResults: 'No users found matching your criteria.',
        active: 'Active',
        muted: 'Muted',
    },
    ru: {
        title: 'Модерация',
        search: 'Поиск пользователей...',
        filter: 'Фильтр',
        action: 'Действие',
        ban: 'Забанить',
        kick: 'Выгнать',
        mute: 'Замутить',
        warn: 'Предупреждение',
        user: 'Пользователь',
        status: 'Статус',
        warnings: 'Варны',
        recentAction: 'Последнее действие',
        noResults: 'Пользователи не найдены.',
        active: 'Активен',
        muted: 'В муте',
    }
} as const;

// Dummy data for visual development
const dummyUsers = [
    { id: '1', name: 'AlexTheGreat', avatar: null, status: 'active', warnings: 0, lastAction: 'None' },
    { id: '2', name: 'CryptoKing', avatar: null, status: 'active', warnings: 2, lastAction: 'Warned for spam' },
    { id: '3', name: 'SilentObserver', avatar: null, status: 'muted', warnings: 1, lastAction: 'Muted for 2 hours' },
    { id: '4', name: 'NormalUser', avatar: null, status: 'active', warnings: 0, lastAction: 'None' },
    { id: '5', name: 'Troublemaker99', avatar: null, status: 'muted', warnings: 3, lastAction: 'Muted for 24 hours' },
];

export default function ModerationPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale } = useGuildLocale(guildId);
    const t = strings[locale];

    const [search, setSearch] = useState('');

    const filteredUsers = dummyUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="animate-fade-in pb-12 w-full max-w-[1200px] mx-auto">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
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
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">{t.status}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">{t.warnings}</th>
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
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${user.status === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-amber-500/10 text-amber-400'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                {user.status === 'active' ? t.active : t.muted}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-sm font-akony tabular-nums ${user.warnings > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--text-secondary)]'}`}>
                                                {user.warnings}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                            <span className="text-sm text-[var(--text-secondary)]">{user.lastAction}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--color-warning)]/10 hover:text-[var(--color-warning)] transition-colors" title={t.warn}>
                                                    <Warning size={16} weight="bold" />
                                                </button>
                                                <button className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-amber-500/10 hover:text-amber-500 transition-colors" title={t.mute}>
                                                    <Hand size={16} weight="bold" />
                                                </button>
                                                <button className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] transition-colors" title={t.kick}>
                                                    <Prohibit size={16} weight="bold" />
                                                </button>
                                                <button className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] transition-colors" title={t.ban}>
                                                    <ShieldCheck size={16} weight="bold" />
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
