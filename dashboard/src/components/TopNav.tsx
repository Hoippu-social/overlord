'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { MagnifyingGlass, Bell, Question } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { Button, Avatar } from '@nextui-org/react';

interface TopNavProps {
    guildId: string;
    guildName?: string | null;
    guildIcon?: string | null;
}

const strings = {
    en: {
        search: 'Search...',
        dashboard: 'Dashboard',
        stats: 'Statistics',
        moderation: 'Moderation',
        economy: 'Economy',
        music: 'Music',
        voice: 'Voice Rooms',
        tickets: 'Tickets',
        audit: 'Audit Logs',
    },
    ru: {
        search: 'Поиск...',
        dashboard: 'Главная',
        stats: 'Статистика',
        moderation: 'Модерация',
        economy: 'Экономика',
        music: 'Музыка',
        voice: 'Войс-румы',
        tickets: 'Тикеты',
        audit: 'Журнал аудита',
    },
} as const;

export const TopNav: React.FC<TopNavProps> = ({ guildId }) => {
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];
    const pathname = usePathname();

    // Quick map for titles based on pathname
    let pageTitle: string = text.dashboard;
    if (pathname.includes('/stats')) pageTitle = text.stats;
    if (pathname.includes('/moderation')) pageTitle = text.moderation;
    if (pathname.includes('/economy')) pageTitle = text.economy;
    if (pathname.includes('/music')) pageTitle = text.music;
    if (pathname.includes('/tempvoice')) pageTitle = text.voice;
    if (pathname.includes('/tickets')) pageTitle = text.tickets;
    if (pathname.includes('/audit')) pageTitle = text.audit;

    return (
        <header className="h-24 px-4 md:px-8 mt-16 md:mt-0 flex items-center justify-between w-full flex-shrink-0 z-10 relative">
            {/* Title */}
            <div>
                <h1 className="text-3xl font-akony text-[var(--text-primary)] tracking-tight drop-shadow-sm">{pageTitle}</h1>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3 md:gap-4">
                {/* Search Bar */}
                <div className="hidden lg:flex items-center bg-[var(--surface-card)] border border-[var(--border-divider)] rounded-full px-4 h-11 focus-within:border-[var(--color-primary-1)]/50 transition-colors w-72 shadow-inner">
                    <MagnifyingGlass size={18} className="text-[var(--text-muted)]" />
                    <input
                        type="text"
                        placeholder={text.search}
                        className="bg-transparent border-none outline-none text-sm text-[var(--text-primary)] px-3 w-full placeholder:text-[var(--text-muted)] font-medium"
                    />
                </div>

                <div className="h-6 w-px bg-[var(--border-subtle)] mx-1 hidden sm:block" />

                <div className="hidden sm:flex items-center gap-3">
                    <Button
                        isIconOnly
                        variant="flat"
                        className="bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-white rounded-full w-11 h-11 border border-[var(--border-divider)] p-0 min-w-11 shadow-sm"
                    >
                        <Question size={20} weight="bold" />
                    </Button>

                    <Button
                        isIconOnly
                        variant="flat"
                        className="bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-white rounded-full w-11 h-11 border border-[var(--border-divider)] p-0 min-w-11 shadow-sm relative"
                    >
                        <Bell size={20} weight="bold" />
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[var(--color-primary-1)] ring-2 ring-[var(--bg-base)] shadow-[0_0_10px_rgba(117,241,106,1)]"></span>
                    </Button>
                </div>

                {/* Profile Placeholder */}
                <div className="flex items-center gap-3 pl-1 md:pl-2 cursor-pointer group">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[var(--color-primary-1)] to-[var(--color-primary-1)]/30 p-[2px] shadow-lg shadow-[var(--color-primary-1)]/10 hover:scale-105 transition-transform">
                        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" className="w-full h-full rounded-full border-2 border-[var(--bg-base)] bg-[var(--bg-base)]" />
                    </div>
                </div>
            </div>
        </header>
    );
};
