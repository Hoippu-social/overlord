'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar } from '@nextui-org/react';
import {
    ArrowRight,
    ChartBar,
    ChatsTeardrop,
    Coins,
    Gear,
    Hash,
    Keyboard,
    MagnifyingGlass,
    MusicNote,
    Scroll,
    ShieldCheck,
    SpeakerHigh,
    SquaresFour,
    Ticket,
    UserCircle,
    X,
} from '@phosphor-icons/react';
import {
    DashboardSearchIcon,
    DashboardSearchLocale,
    searchDashboardCatalog,
} from '@/lib/dashboardSearch';

type RemoteUser = {
    id: string;
    name: string;
    username?: string | null;
    globalName?: string | null;
    tag?: string | null;
    avatar?: string | null;
    roleName?: string | null;
    roleColor?: number | string | null;
};

type RemoteChannel = {
    id: string;
    name: string;
    type?: string | number | null;
    categoryName?: string | null;
};

type SearchResult = {
    id: string;
    type: 'menu' | 'channel' | 'user';
    icon: DashboardSearchIcon;
    title: string;
    subtitle?: string;
    breadcrumb: string;
    href: string;
    avatar?: string | null;
};

type SearchGroup = {
    id: string;
    label: string;
    items: SearchResult[];
};

type DashboardSearchProps = {
    guildId: string;
    locale: DashboardSearchLocale;
    sessionUserId: string;
};

const strings = {
    en: {
        search: 'Search...',
        mobileLabel: 'Open search',
        clear: 'Clear search',
        menu: 'Menu',
        channels: 'Channels',
        users: 'Users',
        recent: 'Recent',
        noResults: 'Nothing found',
        loading: 'Searching...',
        empty: 'Settings? Menu module? Maybe a channel or user? Everything can be found!',
        userBreadcrumb: 'Menu > Statistics > About User',
        channelBreadcrumb: 'Menu > Statistics > About Channel',
        resultCount: (count: number) => `${count} search result${count === 1 ? '' : 's'}`,
    },
    ru: {
        search: 'Поиск...',
        mobileLabel: 'Открыть поиск',
        clear: 'Очистить поиск',
        menu: 'Меню',
        channels: 'Каналы',
        users: 'Пользователи',
        recent: 'Последние',
        noResults: 'Ничего не найдено',
        loading: 'Ищем...',
        empty: 'Настройка? Модуль меню? Может канал или пользователь? Найдётся всё!',
        userBreadcrumb: 'Меню > Статистика > О пользователе',
        channelBreadcrumb: 'Меню > Статистика > О канале',
        resultCount: (count: number) => `${count} результатов поиска`,
    },
} as const;

const iconMap = {
    audit: Scroll,
    channel: Hash,
    commands: Keyboard,
    economy: Coins,
    hub: SquaresFour,
    moderation: ShieldCheck,
    music: MusicNote,
    settings: Gear,
    stats: ChartBar,
    tickets: Ticket,
    user: UserCircle,
    voice: ChatsTeardrop,
} satisfies Record<DashboardSearchIcon, React.ElementType>;

function getCurrentPeriod() {
    if (typeof window === 'undefined') {
        return '7d';
    }

    return new URLSearchParams(window.location.search).get('period') || '7d';
}

function isVoiceChannelType(type: RemoteChannel['type']) {
    return type === 2 || type === 13 || type === 'voice' || type === 'stage_voice' || type === 'GUILD_VOICE' || type === 'GUILD_STAGE_VOICE';
}

function trimRecent(items: SearchResult[], next: SearchResult) {
    const deduped = [next, ...items.filter((item) => item.href !== next.href)];
    return deduped.slice(0, 3);
}

export function DashboardSearch({ guildId, locale, sessionUserId }: DashboardSearchProps) {
    const text = strings[locale];
    const router = useRouter();
    const pathname = usePathname();
    const listboxId = React.useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [period, setPeriod] = useState('7d');
    const [loading, setLoading] = useState(false);
    const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
    const [remoteChannels, setRemoteChannels] = useState<RemoteChannel[]>([]);
    const [recent, setRecent] = useState<SearchResult[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const desktopRootRef = useRef<HTMLDivElement | null>(null);
    const mobileRootRef = useRef<HTMLDivElement | null>(null);
    const mobileInputRef = useRef<HTMLInputElement | null>(null);

    const storageKey = `dashboard-search:${guildId}:${sessionUserId}`;
    const trimmedQuery = query.trim();

    useEffect(() => {
        setPeriod(getCurrentPeriod());
    }, [pathname, open]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                setRecent([]);
                return;
            }

            const parsed = JSON.parse(raw) as SearchResult[];
            setRecent(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
        } catch {
            setRecent([]);
        }
    }, [storageKey]);

    const menuResults = useMemo(
        () => searchDashboardCatalog(trimmedQuery, locale, guildId, period, 7),
        [guildId, locale, period, trimmedQuery],
    );

    useEffect(() => {
        if (!trimmedQuery) {
            setRemoteUsers([]);
            setRemoteChannels([]);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    `/api/guilds/${guildId}/global-search?q=${encodeURIComponent(trimmedQuery)}&limit=8`,
                    { cache: 'no-store', signal: controller.signal },
                );

                if (!response.ok) {
                    throw new Error(`Search failed with ${response.status}`);
                }

                const data = (await response.json()) as { users?: RemoteUser[]; channels?: RemoteChannel[] };
                setRemoteUsers(Array.isArray(data.users) ? data.users : []);
                setRemoteChannels(Array.isArray(data.channels) ? data.channels : []);
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    setRemoteUsers([]);
                    setRemoteChannels([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }, 180);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [guildId, trimmedQuery]);

    const groups = useMemo<SearchGroup[]>(() => {
        if (!trimmedQuery) {
            return recent.length ? [{ id: 'recent', label: text.recent, items: recent }] : [];
        }

        const channelResults: SearchResult[] = remoteChannels.map((channel) => ({
            id: `channel:${channel.id}`,
            type: 'channel',
            icon: isVoiceChannelType(channel.type) ? 'voice' : 'channel',
            title: channel.name,
            subtitle: channel.categoryName ? `${channel.categoryName} | ${channel.id}` : channel.id,
            breadcrumb: text.channelBreadcrumb,
            href: `/dashboard/${guildId}/stats/channels?channelId=${encodeURIComponent(channel.id)}&period=${encodeURIComponent(period)}`,
        }));

        const userResults: SearchResult[] = remoteUsers.map((user) => {
            const globalLabel = user.globalName || user.username || user.tag || user.id;
            return {
                id: `user:${user.id}`,
                type: 'user',
                icon: 'user',
                title: user.name || user.id,
                subtitle: `${globalLabel} | ${user.id}`,
                breadcrumb: text.userBreadcrumb,
                href: `/dashboard/${guildId}/stats/users?userId=${encodeURIComponent(user.id)}&period=${encodeURIComponent(period)}`,
                avatar: user.avatar || null,
            };
        });

        return [
            { id: 'menu', label: text.menu, items: menuResults },
            { id: 'channels', label: text.channels, items: channelResults },
            { id: 'users', label: text.users, items: userResults },
        ].filter((group) => group.items.length > 0);
    }, [guildId, menuResults, period, recent, remoteChannels, remoteUsers, text.channelBreadcrumb, text.channels, text.menu, text.recent, text.userBreadcrumb, text.users, trimmedQuery]);

    const flatResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);

    useEffect(() => {
        setActiveIndex(flatResults.length ? 0 : -1);
    }, [flatResults.length, trimmedQuery]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (desktopRootRef.current?.contains(target) || mobileRootRef.current?.contains(target)) {
                return;
            }

            setOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    const closeSearch = () => {
        setOpen(false);
        setMobileOpen(false);
        setActiveIndex(-1);
    };

    const rememberAndNavigate = (item: SearchResult) => {
        const nextRecent = trimRecent(recent, item);
        setRecent(nextRecent);
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(nextRecent));
        } catch {
            // Ignore localStorage privacy or quota failures.
        }

        closeSearch();
        setQuery('');
        router.push(item.href);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            closeSearch();
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => (flatResults.length ? (current + 1 + flatResults.length) % flatResults.length : -1));
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => (flatResults.length ? (current - 1 + flatResults.length) % flatResults.length : -1));
            return;
        }

        if (event.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
            event.preventDefault();
            rememberAndNavigate(flatResults[activeIndex]);
        }
    };

    const renderIcon = (item: SearchResult, selected: boolean) => {
        if (item.type === 'user') {
            return (
                <Avatar
                    src={item.avatar || undefined}
                    name={item.title}
                    size="sm"
                    showFallback
                    className={`h-9 w-9 flex-shrink-0 border transition-colors ${selected ? 'border-primary/50' : 'border-white/10'}`}
                />
            );
        }

        const Icon = item.icon === 'voice' && item.type === 'channel' ? SpeakerHigh : iconMap[item.icon];
        return (
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${selected ? 'border-primary/35 bg-primary/15 text-primary' : 'border-divider bg-surface-hover text-[var(--text-secondary)]'}`}>
                <Icon size={18} weight={selected ? 'fill' : 'regular'} />
            </div>
        );
    };

    const renderResultsPanel = (mobile = false) => {
        const showEmptyPrompt = !trimmedQuery && recent.length === 0;
        const showNoResults = trimmedQuery && !loading && flatResults.length === 0;

        return (
            <div
                id={listboxId}
                role="listbox"
                className={`${mobile ? 'mt-2 max-h-[min(68vh,34rem)]' : 'absolute right-0 top-full mt-2 max-h-[min(70vh,34rem)] w-[min(36rem,calc(100vw-2rem))]'} z-50 overflow-hidden rounded-[24px] border border-divider bg-surface shadow-[0_24px_70px_rgba(14,14,14,0.55)]`}
            >
                {groups.length > 0 ? (
                    <div className="max-h-[inherit] overflow-y-auto p-2 no-scrollbar">
                        {groups.map((group) => (
                            <div key={group.id} className="py-1">
                                <div className="px-3 pb-1 pt-2 text-[10px] font-akony uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                    {group.label}
                                </div>
                                <div className="space-y-1">
                                    {group.items.map((item) => {
                                        const resultIndex = flatResults.findIndex((result) => result.id === item.id && result.href === item.href);
                                        const selected = resultIndex === activeIndex;
                                        return (
                                            <button
                                                key={`${item.id}:${item.href}`}
                                                id={`${listboxId}-${resultIndex}`}
                                                type="button"
                                                role="option"
                                                aria-selected={selected}
                                                onMouseEnter={() => setActiveIndex(resultIndex)}
                                                onClick={() => rememberAndNavigate(item)}
                                                className={`flex w-full items-center gap-3 rounded-[18px] border px-3 py-2.5 text-left transition-colors ${selected ? 'border-primary/25 bg-primary/10' : 'border-transparent hover:border-divider hover:bg-surface-hover'}`}
                                            >
                                                {renderIcon(item, selected)}
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-bold text-white">{item.title}</div>
                                                    {item.subtitle ? (
                                                        <div className="mt-0.5 truncate text-[11px] font-medium text-[var(--text-secondary)]">{item.subtitle}</div>
                                                    ) : null}
                                                    <div className="mt-1 truncate text-[11px] font-medium text-[var(--text-muted)]">{item.breadcrumb}</div>
                                                </div>
                                                <ArrowRight size={16} className={`flex-shrink-0 transition-colors ${selected ? 'text-primary' : 'text-[var(--text-muted)]'}`} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}

                {loading ? (
                    <div className="border-t border-divider px-5 py-4 text-sm font-medium text-[var(--text-secondary)]">{text.loading}</div>
                ) : null}

                {showEmptyPrompt ? (
                    <div className="px-5 py-5 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{text.empty}</div>
                ) : null}

                {showNoResults ? (
                    <div className="px-5 py-5 text-sm font-semibold text-[var(--text-secondary)]">{text.noResults}</div>
                ) : null}
            </div>
        );
    };

    const renderInput = (mobile = false) => (
        <div className={`${mobile ? 'h-12' : 'h-11'} flex w-full items-center rounded-full border border-divider bg-surface px-4 shadow-inner transition-colors focus-within:border-[var(--border-focus)]`}>
            <MagnifyingGlass size={18} className="flex-shrink-0 text-[var(--text-muted)]" />
            <input
                ref={mobile ? mobileInputRef : undefined}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
                aria-label={text.search}
                placeholder={text.search}
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => {
                    setPeriod(getCurrentPeriod());
                    setOpen(true);
                }}
                onKeyDown={handleKeyDown}
                className="min-w-0 flex-1 border-none bg-transparent px-3 text-sm font-medium text-white outline-none placeholder:text-[var(--text-muted)]"
            />
            {query ? (
                <button
                    type="button"
                    aria-label={text.clear}
                    onClick={() => {
                        setQuery('');
                        setRemoteUsers([]);
                        setRemoteChannels([]);
                        setOpen(true);
                    }}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-surface-hover hover:text-white"
                >
                    <X size={14} weight="bold" />
                </button>
            ) : null}
        </div>
    );

    const resultCount = flatResults.length;

    return (
        <>
            <div ref={desktopRootRef} className="relative hidden w-72 lg:block">
                {renderInput(false)}
                {open ? renderResultsPanel(false) : null}
            </div>

            <button
                type="button"
                aria-label={text.mobileLabel}
                onClick={() => {
                    setMobileOpen(true);
                    setOpen(true);
                    window.setTimeout(() => mobileInputRef.current?.focus(), 0);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-divider bg-surface text-[var(--text-secondary)] shadow-sm transition-colors hover:bg-surface-hover hover:text-white lg:hidden"
            >
                <MagnifyingGlass size={20} weight="bold" />
            </button>

            {mobileOpen ? (
                <div className="fixed inset-0 z-[70] lg:hidden">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeSearch} />
                    <div ref={mobileRootRef} className="absolute left-3 right-3 top-20">
                        {renderInput(true)}
                        {open ? renderResultsPanel(true) : null}
                    </div>
                </div>
            ) : null}

            <div className="sr-only" aria-live="polite">
                {open && trimmedQuery ? text.resultCount(resultCount) : ''}
            </div>
        </>
    );
}
