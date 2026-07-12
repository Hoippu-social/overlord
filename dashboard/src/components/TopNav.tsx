'use client';

import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Question } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { Avatar, Button } from '@nextui-org/react';
import { useSession } from 'next-auth/react';
import { DashboardSearch } from '@/components/common/DashboardSearch';
import { FitSingleLineText } from '@/components/common/FitSingleLineText';
import { useTour } from '@/components/tour/TourProvider';
import { getTourCopy } from '@/lib/tour/i18n';

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

type StableProfile = {
    image?: string;
    name: string;
};

const DEFAULT_PROFILE: StableProfile = { name: 'User' };
const PROFILE_EVENT = 'dashboardProfileChange';

const subscribeClientReady = () => () => undefined;
const getClientReadySnapshot = () => true;
const getServerReadySnapshot = () => false;
const getProfileStorageKey = (sessionUserId: string) => `dashboard-profile:${sessionUserId}`;

function getStoredProfileSnapshot(sessionUserId: string) {
    if (typeof window === 'undefined') {
        return '';
    }

    try {
        return window.localStorage.getItem(getProfileStorageKey(sessionUserId)) || '';
    } catch {
        return '';
    }
}

function parseProfileSnapshot(raw: string): StableProfile {
    if (!raw) {
        return DEFAULT_PROFILE;
    }

    try {
        const cached = JSON.parse(raw) as { image?: string; name?: string };
        return {
            name: cached.name?.trim() || DEFAULT_PROFILE.name,
            image: cached.image?.trim() || undefined,
        };
    } catch {
        return DEFAULT_PROFILE;
    }
}

function subscribeStoredProfile(sessionUserId: string, onStoreChange: () => void) {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    const storageKey = getProfileStorageKey(sessionUserId);
    const handleProfileChange = (event: Event) => {
        const detail = (event as CustomEvent<{ sessionUserId?: string }>).detail;
        if (!detail?.sessionUserId || detail.sessionUserId === sessionUserId) {
            onStoreChange();
        }
    };
    const handleStorage = (event: StorageEvent) => {
        if (event.key === storageKey) {
            onStoreChange();
        }
    };

    window.addEventListener(PROFILE_EVENT, handleProfileChange);
    window.addEventListener('storage', handleStorage);
    return () => {
        window.removeEventListener(PROFILE_EVENT, handleProfileChange);
        window.removeEventListener('storage', handleStorage);
    };
}

function writeStoredProfile(sessionUserId: string, profile: StableProfile) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(getProfileStorageKey(sessionUserId), JSON.stringify(profile));
        window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: { sessionUserId } }));
    } catch {
        // Ignore quota or privacy-mode failures.
    }
}

export const TopNav: React.FC<TopNavProps> = ({ guildId }) => {
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];
    const tourCopy = getTourCopy(locale);
    const { start: startTour, available: tourAvailable } = useTour();
    const pathname = usePathname();
    const { data: session } = useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id || 'viewer';
    const tourTriggerReady = useSyncExternalStore(
        subscribeClientReady,
        getClientReadySnapshot,
        getServerReadySnapshot,
    );
    const rawCachedProfile = useSyncExternalStore(
        useCallback((onStoreChange) => subscribeStoredProfile(sessionUserId, onStoreChange), [sessionUserId]),
        useCallback(() => getStoredProfileSnapshot(sessionUserId), [sessionUserId]),
        () => '',
    );
    const cachedProfile = useMemo(() => parseProfileSnapshot(rawCachedProfile), [rawCachedProfile]);
    const sessionProfile = useMemo<StableProfile | null>(() => {
        const nextName = session?.user?.name?.trim();
        const nextImage = session?.user?.image?.trim();

        if (!nextName && !nextImage) {
            return null;
        }

        return {
            name: nextName || cachedProfile.name,
            image: nextImage || cachedProfile.image,
        };
    }, [cachedProfile.image, cachedProfile.name, session?.user?.image, session?.user?.name]);

    useEffect(() => {
        if (sessionProfile) {
            writeStoredProfile(sessionUserId, sessionProfile);
        }
    }, [sessionProfile, sessionUserId]);

    const stableProfile = sessionProfile ?? cachedProfile;

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
        <header className="relative z-30 mt-16 flex min-h-[5.5rem] w-full flex-shrink-0 items-center justify-between gap-4 px-4 py-3 md:mt-0 md:h-24 md:px-8 md:py-0">
            <div className="min-w-0 flex-1">
                <h1 className="max-w-full overflow-hidden whitespace-nowrap text-[var(--text-primary)] drop-shadow-sm">
                    <FitSingleLineText
                        className="font-akony leading-none tracking-tight"
                        minFontSize={15}
                        maxFontSize={38}
                        mobileOnly
                    >
                        {pageTitle}
                    </FitSingleLineText>
                </h1>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3 md:gap-4">
                <DashboardSearch guildId={guildId} locale={locale} sessionUserId={sessionUserId} />

                <div className="mx-1 hidden h-6 w-px bg-[var(--border-subtle)] sm:block" />

                {tourTriggerReady ? (
                    <button
                        type="button"
                        data-tour-trigger
                        onClick={startTour}
                        disabled={!tourAvailable}
                        title={tourAvailable ? tourCopy.startTour : tourCopy.noTour}
                        aria-label={tourAvailable ? tourCopy.startTour : tourCopy.noTour}
                        className="flex h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-divider)] bg-[var(--surface-card)] p-0 text-[var(--text-secondary)] shadow-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11 sm:min-w-11"
                    >
                        <Question size={20} weight="bold" />
                    </button>
                ) : (
                    <span
                        aria-hidden="true"
                        className="block h-10 w-10 min-w-10 shrink-0 rounded-full border border-transparent sm:h-11 sm:w-11 sm:min-w-11"
                    />
                )}

                <div className="hidden items-center gap-3 sm:flex">
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
