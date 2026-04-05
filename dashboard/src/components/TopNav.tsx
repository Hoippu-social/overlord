'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, MagnifyingGlass, Question } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { Avatar, Button } from '@nextui-org/react';
import { useSession } from 'next-auth/react';

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
    const { data: session } = useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id || 'viewer';
    const [stableProfile, setStableProfile] = useState<{ image?: string; name: string }>({ name: 'User' });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const storageKey = `dashboard-profile:${sessionUserId}`;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                setStableProfile({ name: 'User' });
                return;
            }

            const cached = JSON.parse(raw) as { image?: string; name?: string };
            setStableProfile({
                name: cached.name?.trim() || 'User',
                image: cached.image?.trim() || undefined,
            });
        } catch {
            // Ignore malformed local profile cache.
        }
    }, [sessionUserId]);

    useEffect(() => {
        const nextName = session?.user?.name?.trim();
        const nextImage = session?.user?.image?.trim();

        if (!nextName && !nextImage) {
            return;
        }

        setStableProfile((current) => {
            const updated = {
                name: nextName || current.name,
                image: nextImage || current.image,
            };

            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem(`dashboard-profile:${sessionUserId}`, JSON.stringify(updated));
                } catch {
                    // Ignore quota or privacy-mode failures.
                }
            }

            return updated;
        });
    }, [session?.user?.image, session?.user?.name, sessionUserId]);

    const userImage = stableProfile.image;
    const userName = stableProfile.name;
    const avatarKey = `${sessionUserId}:${userImage || userName}`;

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
        <header className="relative z-10 mt-16 flex min-h-[5.5rem] w-full flex-shrink-0 items-center justify-between gap-4 px-4 py-3 md:mt-0 md:h-24 md:px-8 md:py-0">
            <div className="min-w-0 flex-1">
                <h1 className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.55rem,7.2vw,2.35rem)] font-akony leading-none tracking-tight text-[var(--text-primary)] drop-shadow-sm md:text-3xl">
                    {pageTitle}
                </h1>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3 md:gap-4">
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
                        <Avatar
                            key={avatarKey}
                            src={userImage}
                            name={userName}
                            showFallback
                            className="h-full w-full rounded-full border-2 border-[var(--bg-base)] bg-[var(--bg-base)]"
                            imgProps={{ referrerPolicy: 'no-referrer' }}
                        />
                    </div>
                </div>
            </div>
        </header>
    );
};
