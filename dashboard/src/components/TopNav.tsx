'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Bell, MagnifyingGlass, Question } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { Avatar, Button } from '@nextui-org/react';

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
        commands: 'Commands',
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
        commands: 'Команды',
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

    let pageTitle: string = text.dashboard;
    if (pathname.includes('/stats')) pageTitle = text.stats;
    if (pathname.includes('/moderation')) pageTitle = text.moderation;
    if (pathname.includes('/commands')) pageTitle = text.commands;
    if (pathname.includes('/economy')) pageTitle = text.economy;
    if (pathname.includes('/music')) pageTitle = text.music;
    if (pathname.includes('/tempvoice')) pageTitle = text.voice;
    if (pathname.includes('/tickets')) pageTitle = text.tickets;
    if (pathname.includes('/audit')) pageTitle = text.audit;

    return (
        <header className="relative z-10 mt-16 flex h-24 w-full flex-shrink-0 items-center justify-between px-4 md:mt-0 md:px-8">
            <div>
                <h1 className="text-3xl font-akony tracking-tight text-[var(--text-primary)] drop-shadow-sm">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-3 md:gap-4">
                <div className="hidden h-11 w-72 items-center rounded-full border border-[var(--border-divider)] bg-[var(--surface-card)] px-4 shadow-inner transition-colors focus-within:border-[var(--color-primary-1)]/50 lg:flex">
                    <MagnifyingGlass size={18} className="text-[var(--text-muted)]" />
                    <input
                        type="text"
                        placeholder={text.search}
                        className="w-full border-none bg-transparent px-3 text-sm font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                    />
                </div>

                <div className="mx-1 hidden h-6 w-px bg-[var(--border-subtle)] sm:block" />

                <div className="hidden items-center gap-3 sm:flex">
                    <Button isIconOnly variant="flat" className="h-11 w-11 min-w-11 rounded-full border border-[var(--border-divider)] bg-[var(--surface-card)] p-0 text-[var(--text-secondary)] shadow-sm hover:text-white">
                        <Question size={20} weight="bold" />
                    </Button>

                    <Button isIconOnly variant="flat" className="relative h-11 w-11 min-w-11 rounded-full border border-[var(--border-divider)] bg-[var(--surface-card)] p-0 text-[var(--text-secondary)] shadow-sm hover:text-white">
                        <Bell size={20} weight="bold" />
                        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--color-primary-1)] ring-2 ring-[var(--bg-base)] shadow-[0_0_10px_rgba(117,241,106,1)]" />
                    </Button>
                </div>

                <div className="group flex cursor-pointer items-center gap-3 pl-1 md:pl-2">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-[var(--color-primary-1)] to-[var(--color-primary-1)]/30 p-[2px] shadow-lg shadow-[var(--color-primary-1)]/10 transition-transform hover:scale-105">
                        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" className="h-full w-full rounded-full border-2 border-[var(--bg-base)] bg-[var(--bg-base)]" />
                    </div>
                </div>
            </div>
        </header>
    );
};
