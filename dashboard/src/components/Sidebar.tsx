'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    CaretDown,
    ChartBar,
    ChatsTeardrop,
    Coins,
    Gear,
    Keyboard,
    List,
    MusicNote,
    Scroll,
    ShieldCheck,
    SquaresFour,
    Ticket,
    Translate,
    X,
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@nextui-org/react';
import { getBrowserPublicHost, getDashboardHomePath } from '@/lib/publicDashboard';
import { hyphenateServerName } from '@/lib/textHyphenation';

interface SidebarProps {
    guildId: string;
    guildName?: string | null;
    guildIcon?: string | null;
}

interface GuildSummary {
    id: string;
    name: string;
    icon: string | null;
}

const strings = {
    en: {
        hub: 'Hub',
        stats: 'Statistics',
        moderation: 'Moderation',
        commands: 'Commands',
        audit: 'Audit Logs',
        economy: 'Economy',
        music: 'Music',
        tempVoice: 'Voice Rooms',
        tickets: 'Tickets',
        settings: 'Settings',
        back: 'Back to Servers',
        menu: 'Menu',
        other: 'Other',
        loading: 'Loading...',
    },
    ru: {
        hub: 'Главная',
        stats: 'Статистика',
        moderation: 'Модерация',
        commands: 'Команды',
        audit: 'Журнал аудита',
        economy: 'Экономика',
        music: 'Музыка',
        tempVoice: 'Войс-румы',
        tickets: 'Тикеты',
        settings: 'Настройки',
        back: 'К серверам',
        menu: 'Меню',
        other: 'Прочее',
        loading: 'Загрузка...',
    },
} as const;

export const Sidebar: React.FC<SidebarProps> = ({ guildId, guildName, guildIcon }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { locale, setLocale } = useGuildLocale(guildId);
    const text = strings[locale];
    const guildMenuText =
        locale === 'ru'
            ? {
                  servers: '\u0421\u0435\u0440\u0432\u0435\u0440\u044b',
                  current: '\u0422\u0435\u043a\u0443\u0449\u0438\u0439',
                  empty: '\u0421\u0435\u0440\u0432\u0435\u0440\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b',
              }
            : {
                  servers: 'Servers',
                  current: 'Current',
                  empty: 'No servers available',
              };

    const [mobileOpen, setMobileOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [mobileLangOpen, setMobileLangOpen] = useState(false);
    const [guildMenuOpen, setGuildMenuOpen] = useState(false);
    const [guilds, setGuilds] = useState<GuildSummary[]>([]);
    const [guildsLoading, setGuildsLoading] = useState(true);
    const [dashboardHomePath, setDashboardHomePath] = useState('/dashboard');

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        setDashboardHomePath(getDashboardHomePath(getBrowserPublicHost()));
    }, []);

    useEffect(() => {
        let active = true;

        const loadGuilds = async () => {
            try {
                const response = await fetch('/api/guilds', { cache: 'no-store' });
                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                if (active && Array.isArray(data)) {
                    setGuilds(data);
                }
            } catch (error) {
                console.error('Failed to load guild list for sidebar:', error);
            } finally {
                if (active) {
                    setGuildsLoading(false);
                }
            }
        };

        void loadGuilds();

        return () => {
            active = false;
        };
    }, []);

    const isActive = (href: string) => pathname === href || (href !== `/dashboard/${guildId}` && pathname.startsWith(href));

    const navItems = [
        { label: text.hub, href: `/dashboard/${guildId}`, icon: SquaresFour },
        { label: text.stats, href: `/dashboard/${guildId}/stats`, icon: ChartBar },
        { label: text.moderation, href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck },
        { label: text.commands, href: `/dashboard/${guildId}/commands`, icon: Keyboard },
        { label: text.audit, href: `/dashboard/${guildId}/audit`, icon: Scroll },
        { label: text.economy, href: `/dashboard/${guildId}/economy`, icon: Coins },
        { label: text.music, href: `/dashboard/${guildId}/music`, icon: MusicNote },
        { label: text.tempVoice, href: `/dashboard/${guildId}/tempvoice`, icon: ChatsTeardrop },
        { label: text.tickets, href: `/dashboard/${guildId}/tickets`, icon: Ticket },
    ];

    const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
        const active = isActive(href);

        return (
            <Link href={href} className="block group">
                <div
                    className={`flex items-center gap-4 rounded-full border px-4 py-3.5 text-sm font-bold transition-all ${
                        active
                            ? 'border-[var(--border-subtle)] bg-[var(--surface-hover)] text-white shadow-inner'
                            : 'border-transparent text-white/40 hover:bg-[var(--surface-card)] hover:text-white'
                    }`}
                >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-[var(--color-primary-1)] text-black shadow-[0_0_20px_rgba(117,241,106,0.2)]' : 'bg-transparent text-white/40 group-hover:text-white'}`}>
                        <Icon size={18} weight={active ? 'fill' : 'regular'} />
                    </div>
                    <span className={active ? 'text-white' : ''}>{label}</span>
                </div>
            </Link>
        );
    };

    const SettingsLink = () => {
        const href = `/dashboard/${guildId}/server-settings`;
        const active = isActive(href);

        return (
            <Link href={href} className="block group">
                <div
                    className={`flex items-center gap-4 rounded-full border px-4 py-3.5 text-sm font-bold transition-all ${
                        active
                            ? 'border-[var(--border-subtle)] bg-[var(--surface-hover)] text-white shadow-inner'
                            : 'border-transparent text-white/40 hover:bg-[var(--surface-card)] hover:text-white'
                    }`}
                >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-[var(--color-primary-1)] text-black shadow-[0_0_20px_rgba(117,241,106,0.2)]' : 'bg-transparent text-white/40 group-hover:text-white'}`}>
                        <Gear size={18} weight={active ? 'fill' : 'regular'} />
                    </div>
                    <span className={active ? 'text-white' : ''}>{text.settings}</span>
                </div>
            </Link>
        );
    };

    const LanguageSwitcher = ({ mobile = false }: { mobile?: boolean }) => {
        const open = mobile ? mobileLangOpen : langOpen;
        const setOpen = mobile ? setMobileLangOpen : setLangOpen;

        return (
            <div
                className="relative flex w-12 cursor-pointer flex-col items-center justify-center rounded-full border border-[var(--border-divider)] bg-[var(--surface-card)] p-1 hover:bg-[var(--surface-hover)]"
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
            >
                <span className="mt-0.5 text-center text-[10px] font-bold uppercase text-white/50">{locale}</span>
                <Translate size={14} className="text-white/30" />
                {open ? (
                    <div className="absolute bottom-0 left-1/2 z-50 w-24 -translate-x-1/2 pt-10" style={{ paddingBottom: '100%' }}>
                        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-2 shadow-xl">
                            <button onClick={() => setLocale('ru')} className={`block w-full rounded-xl px-3 py-2 text-left text-xs font-bold ${locale === 'ru' ? 'bg-[var(--color-primary-1)] text-black' : 'text-white/60 hover:text-white'}`}>RU</button>
                            <button onClick={() => setLocale('en')} className={`mt-1 block w-full rounded-xl px-3 py-2 text-left text-xs font-bold ${locale === 'en' ? 'bg-[var(--color-primary-1)] text-black' : 'text-white/60 hover:text-white'}`}>EN</button>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    };

    const GuildOption = ({ guild, mobile = false }: { guild: GuildSummary; mobile?: boolean }) => {
        const active = guild.id === guildId;
        const href = `/dashboard/${guild.id}`;

        return (
            <button
                type="button"
                onClick={() => {
                    setGuildMenuOpen(false);
                    if (mobile) {
                        setMobileOpen(false);
                    }
                    router.push(href);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                    active
                        ? 'border-[var(--color-primary-1)]/25 bg-[var(--color-primary-1)]/10 text-white'
                        : 'border-transparent bg-transparent text-white/70 hover:border-[var(--border-divider)] hover:bg-[var(--surface-hover)] hover:text-white'
                }`}
            >
                {guild.icon ? (
                    <img
                        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                        alt=""
                        className="h-9 w-9 rounded-full border border-white/10 object-cover"
                    />
                ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                        <span className="text-[12px] font-akony">{guild.name?.charAt(0) ?? '?'}</span>
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-bold ${active ? 'text-white' : 'text-inherit'}`}>{hyphenateServerName(guild.name)}</div>
                    {active ? (
                        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-primary-1)]">
                            {guildMenuText.current}
                        </div>
                    ) : null}
                </div>
            </button>
        );
    };

    const GuildSwitcher = ({ mobile = false }: { mobile?: boolean }) => (
        <Popover
            placement="bottom-start"
            isOpen={guildMenuOpen}
            onOpenChange={setGuildMenuOpen}
            offset={10}
            triggerScaleOnOpen={false}
        >
            <PopoverTrigger>
                <button
                    type="button"
                    className="group flex w-full items-center justify-between rounded-full border border-[var(--border-divider)] bg-[var(--surface-card)] p-2 pr-4 transition-colors duration-200 transform-none hover:bg-[var(--surface-hover)] active:scale-100 active:bg-[var(--surface-card)] data-[pressed=true]:scale-100 data-[pressed=true]:bg-[var(--surface-card)] data-[pressed=true]:opacity-100 data-[pressed=true]:shadow-none"
                >
                    <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                        {guildIcon ? (
                            <img
                                src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=64`}
                                alt=""
                                className="h-8 w-8 rounded-full border border-white/10 object-cover"
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                <span className="text-[11px] font-akony">{guildName?.charAt(0) ?? '?'}</span>
                            </div>
                        )}
                        <span className="truncate text-sm font-bold text-white/90">{guildName ? hyphenateServerName(guildName) : text.loading}</span>
                    </div>
                    <CaretDown
                        size={16}
                        weight="bold"
                        className={`ml-3 flex-shrink-0 text-white/35 transition-transform duration-200 ${guildMenuOpen ? 'rotate-180 text-white/70' : 'group-hover:text-white/60'}`}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(320px,calc(100vw-2rem))] rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0 shadow-[0_24px_60px_rgba(14,14,14,0.45)]">
                <div className="w-full p-3">
                    <div className="px-2 pb-2 pt-1 text-[10px] font-akony uppercase tracking-[0.22em] text-white/30">
                        {guildMenuText.servers}
                    </div>
                    <div className="max-h-[320px] space-y-1 overflow-y-auto no-scrollbar">
                        {guildsLoading ? (
                            <div className="space-y-2 px-1 py-1">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="h-[58px] rounded-2xl skeleton" />
                                ))}
                            </div>
                        ) : guilds.length > 0 ? (
                            guilds.map((guild) => <GuildOption key={guild.id} guild={guild} mobile={mobile} />)
                        ) : (
                            <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--surface-sidebar)] px-4 py-4 text-sm font-medium text-white/45">
                                {guildMenuText.empty}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );

    const SidebarBody = ({ mobile = false }: { mobile?: boolean }) => (
        <div className="flex h-full w-full flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-sidebar)] text-white">
            <div className="flex h-24 w-full flex-shrink-0 items-center justify-start gap-3 px-6">
                <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-85">
                    <img src="/logos/logo-color.svg" alt="Overlord Logo" className="h-9 w-9 flex-shrink-0 object-contain" />
                    <span className="mt-1 whitespace-nowrap font-akony text-[15px] tracking-[.12em] text-white">OVERLORD</span>
                </Link>
            </div>

            <div className="mb-8 mt-2 px-6">
                <GuildSwitcher mobile={mobile} />
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-6 pb-6 no-scrollbar">
                <div className="mb-3 mt-2 px-4 text-[10px] font-akony uppercase tracking-widest text-white/30">{text.menu}</div>
                {navItems.map((item) => (
                    <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
                ))}

                <div className="h-4" />
                <div className="mb-3 px-4 text-[10px] font-akony uppercase tracking-widest text-white/30">{text.other}</div>
                <SettingsLink />
            </div>

            <div className="flex gap-2 border-t border-[var(--border-divider)] p-6">
                <button
                    onClick={() => router.push(dashboardHomePath)}
                    className="flex flex-1 items-center justify-center gap-3 rounded-full border border-[var(--border-divider)] bg-[var(--surface-card)] px-4 py-3 text-sm font-bold text-white/50 transition-all hover:bg-[var(--surface-hover)] hover:text-white"
                >
                    <ArrowLeft size={18} />
                    <span>{text.back}</span>
                </button>
                <LanguageSwitcher mobile={mobile} />
            </div>
        </div>
    );

    return (
        <>
            <aside className="relative z-20 hidden h-screen w-[280px] flex-shrink-0 md:flex">
                <SidebarBody />
            </aside>

            <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.04] bg-[#060606]/80 px-4 backdrop-blur-xl md:hidden">
                <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-85">
                    <img src="/logos/logo-color.svg" alt="" className="h-8 w-8 flex-shrink-0 object-contain" />
                    <span className="mt-1 font-akony text-sm tracking-[.1em] text-white">OVERLORD</span>
                </Link>
                <button onClick={() => setMobileOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-white">
                    <List size={20} />
                </button>
            </div>

            {mobileOpen ? (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="relative h-full w-[300px] animate-fade-in shadow-2xl">
                        <button onClick={() => setMobileOpen(false)} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white transition-colors hover:bg-white/[0.1]">
                            <X size={20} />
                        </button>
                        <SidebarBody mobile />
                    </div>
                </div>
            ) : null}
        </>
    );
};
