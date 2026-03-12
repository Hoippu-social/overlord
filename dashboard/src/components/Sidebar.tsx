'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    SquaresFour, ChartBar, Scroll, MusicNote, Ticket,
    ChatsTeardrop, Coins, ShieldCheck, Gear, ArrowLeft,
    List, X, Translate
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { Tooltip } from '@nextui-org/react';

interface SidebarProps {
    guildId: string;
    guildName?: string | null;
    guildIcon?: string | null;
}

const strings = {
    en: {
        hub: 'Hub',
        stats: 'Statistics',
        moderation: 'Moderation',
        audit: 'Audit Logs',
        economy: 'Economy',
        music: 'Music',
        tempVoice: 'Voice Rooms',
        tickets: 'Tickets',
        settings: 'Settings',
        back: 'Back to Servers',
    },
    ru: {
        hub: 'Главная',
        stats: 'Статистика',
        moderation: 'Модерация',
        audit: 'Журнал аудита',
        economy: 'Экономика',
        music: 'Музыка',
        tempVoice: 'Войс-румы',
        tickets: 'Тикеты',
        settings: 'Настройки',
        back: 'К серверам',
    },
} as const;

export const Sidebar: React.FC<SidebarProps> = ({ guildId, guildName, guildIcon }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { locale, setLocale } = useGuildLocale(guildId);
    const text = strings[locale];

    const [mobileOpen, setMobileOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [mobileLangOpen, setMobileLangOpen] = useState(false);

    // Close on mobile nav
    useEffect(() => { setMobileOpen(false); }, [pathname]);

    const isActive = (href: string) =>
        pathname === href || (href !== `/dashboard/${guildId}` && pathname.startsWith(href));

    const navItems = [
        { label: text.hub, href: `/dashboard/${guildId}`, icon: SquaresFour },
        { label: text.stats, href: `/dashboard/${guildId}/stats`, icon: ChartBar },
        { label: text.moderation, href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck },
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

    const SidebarBody = ({ mobile = false }: { mobile?: boolean }) => (
        <div className="flex h-full w-full flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-sidebar)] text-white">
            <div className="flex h-24 w-full flex-shrink-0 items-center justify-start gap-3 px-6">
                <img src="/logos/logo-color.svg" alt="Overlord Logo" className="h-9 w-9 flex-shrink-0 object-contain" />
                <span className="mt-1 whitespace-nowrap font-akony text-[15px] tracking-[.12em] text-white">OVERLORD</span>
            </div>

            <div className="mb-8 mt-2 px-6">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="group flex w-full items-center justify-between rounded-full border border-[var(--border-divider)] bg-[var(--surface-card)] p-2 pr-4 transition-all hover:bg-[var(--surface-hover)]"
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        {guildIcon ? (
                            <img
                                src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=64`}
                                alt=""
                                className="h-8 w-8 rounded-full border border-white/10"
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                <span className="text-[11px] font-akony">{guildName?.charAt(0) ?? '?'}</span>
                            </div>
                        )}
                        <span className="truncate text-sm font-bold text-white/90">{guildName || text.loading}</span>
                    </div>
                </button>
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
                    onClick={() => router.push('/dashboard')}
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
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-[280px] h-screen flex-shrink-0 relative z-20">
                <div className="flex flex-col h-full bg-[var(--surface-sidebar)] text-white w-full border-r border-[var(--border-subtle)]">
                    {/* Logo area */}
                    <div className="h-24 px-6 flex items-center justify-start gap-3 flex-shrink-0 w-full">
                        <img src="/logos/logo-color.svg" alt="Overlord Logo" className="w-9 h-9 object-contain flex-shrink-0" />
                        <span className="font-akony text-[15px] tracking-[.12em] text-white mt-1 whitespace-nowrap">
                            OVERLORD
                        </span>
                    </div>

                    {/* Server chip - Clean capsule */}
                    <div className="px-6 mb-8 mt-2">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="flex w-full items-center justify-between bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border-divider)] p-2 pr-4 rounded-full group cursor-pointer"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                {guildIcon ? (
                                    <img
                                        src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=64`}
                                        alt=""
                                        className="w-8 h-8 rounded-full border border-white/10"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)] flex items-center justify-center border border-[var(--color-primary-1)]/20">
                                        <span className="text-[11px] font-akony">{guildName?.charAt(0) ?? '?'}</span>
                                    </div>
                                )}
                                <span className="text-sm font-bold truncate text-white/90">{guildName || (locale === 'ru' ? 'Загрузка...' : 'Loading...')}</span>
                            </div>
                        </button>
                    </div>

                    {/* Navigation links - Massive pill styling */}
                    <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-2 pb-6">
                        <div className="text-[10px] font-akony tracking-widest text-white/30 uppercase px-4 mb-3 mt-2">{locale === 'ru' ? 'Меню' : 'Menu'}</div>
                        {navItems.map(item => {
                            const active = isActive(item.href);
                            return (
                                <Link key={item.href} href={item.href} className="block group">
                                    <div className={`
                                        flex items-center gap-4 px-4 py-3.5 rounded-full text-sm font-bold transition-all
                                        ${active
                                            ? 'bg-[var(--surface-hover)] text-white shadow-inner border border-[var(--border-subtle)]'
                                            : 'text-white/40 hover:text-white hover:bg-[var(--surface-card)] border border-transparent'}
                                    `}>
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${active ? 'bg-[var(--color-primary-1)] text-black shadow-[0_0_20px_rgba(117,241,106,0.2)]' : 'bg-transparent text-white/40 group-hover:text-white'}`}>
                                            <item.icon size={18} weight={active ? 'fill' : 'regular'} />
                                        </div>
                                        <span className={active ? 'text-white' : ''}>{item.label}</span>
                                    </div>
                                </Link>
                            );
                        })}

                        <div className="h-4"></div>
                        <div className="text-[10px] font-akony tracking-widest text-white/30 uppercase px-4 mb-3">{locale === 'ru' ? 'Прочее' : 'Other'}</div>

                        <Link href={`/dashboard/${guildId}/server-settings`} className="block group">
                            {(() => {
                                const active = isActive(`/dashboard/${guildId}/server-settings`);
                                return (
                                    <div className={`
                                        flex items-center gap-4 px-4 py-3.5 rounded-full text-sm font-bold transition-all
                                        ${active
                                            ? 'bg-[var(--surface-hover)] text-white shadow-inner border border-[var(--border-subtle)]'
                                            : 'text-white/40 hover:text-white hover:bg-[var(--surface-card)] border border-transparent'}
                                    `}>
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${active ? 'bg-[var(--color-primary-1)] text-black shadow-[0_0_20px_rgba(117,241,106,0.2)]' : 'bg-transparent text-white/40 group-hover:text-white'}`}>
                                            <Gear size={18} weight={active ? 'fill' : 'regular'} />
                                        </div>
                                        <span className={active ? 'text-white' : ''}>{text.settings}</span>
                                    </div>
                                );
                            })()}
                        </Link>
                    </div>

                    {/* Bottom Actions */}
                    <div className="p-6 border-t border-[var(--border-divider)] flex gap-2">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-3 flex-1 bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] transition-all px-4 py-3 rounded-full text-white/50 hover:text-white text-sm font-bold justify-center border border-[var(--border-divider)]"
                        >
                            <ArrowLeft size={18} />
                            <span>{text.back}</span>
                        </button>
                        <div
                            className="flex flex-col bg-[var(--surface-card)] border border-[var(--border-divider)] rounded-full p-1 justify-center relative w-12 items-center hover:bg-[var(--surface-hover)] cursor-pointer"
                            onMouseEnter={() => setLangOpen(true)}
                            onMouseLeave={() => setLangOpen(false)}
                        >
                            <span className="text-white/50 text-[10px] uppercase font-bold text-center mt-0.5">{locale}</span>
                            <Translate size={14} className="text-white/30" />
                            {langOpen && (
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 pt-10 z-50" style={{paddingBottom: '100%'}}>
                                    <div className="bg-[var(--surface-hover)] rounded-2xl border border-[var(--border-subtle)] p-2 shadow-xl">
                                        <button onClick={() => setLocale('ru')} className={`block w-full text-left px-3 py-2 rounded-xl text-xs font-bold ${locale === 'ru' ? 'bg-[var(--color-primary-1)] text-black' : 'text-white/60 hover:text-white'}`}>RU</button>
                                        <button onClick={() => setLocale('en')} className={`block w-full text-left px-3 py-2 rounded-xl text-xs font-bold mt-1 ${locale === 'en' ? 'bg-[var(--color-primary-1)] text-black' : 'text-white/60 hover:text-white'}`}>EN</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Header trigger */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#060606]/80 backdrop-blur-xl border-b border-white/[0.04] flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-2">
                    <img src="/logos/logo-color.svg" alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                    <span className="font-akony text-sm tracking-[.1em] text-white mt-1">
                        OVERLORD
                    </span>
                </div>
                <button onClick={() => setMobileOpen(true)} className="w-10 h-10 flex items-center justify-center bg-white/[0.04] text-white rounded-full">
                    <List size={20} />
                </button>
            </div>

            {/* Mobile Sidebar overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
                    <div className="relative w-[300px] h-full bg-[#0B0B0B] animate-fade-in shadow-2xl flex flex-col">
                        <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-full transition-colors z-10">
                            <X size={20} />
                        </button>
                        <div className="flex flex-col h-full bg-[var(--surface-sidebar)] text-white w-full border-r border-[var(--border-subtle)]">
                            {/* Logo area */}
                            <div className="h-24 px-6 flex items-center justify-start gap-3 flex-shrink-0 w-full">
                                <img src="/logos/logo-color.svg" alt="Overlord Logo" className="w-9 h-9 object-contain flex-shrink-0" />
                                <span className="font-akony text-[15px] tracking-[.12em] text-white mt-1 whitespace-nowrap">
                                    OVERLORD
                                </span>
                            </div>

                            {/* Server chip - Clean capsule */}
                            <div className="px-6 mb-8 mt-2">
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="flex w-full items-center justify-between bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border-divider)] p-2 pr-4 rounded-full group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {guildIcon ? (
                                            <img
                                                src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=64`}
                                                alt=""
                                                className="w-8 h-8 rounded-full border border-white/10"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)] flex items-center justify-center border border-[var(--color-primary-1)]/20">
                                                <span className="text-[11px] font-akony">{guildName?.charAt(0) ?? '?'}</span>
                                            </div>
                                        )}
                                        <span className="text-sm font-bold truncate text-white/90">{guildName || (locale === 'ru' ? 'Загрузка...' : 'Loading...')}</span>
                                    </div>
                                </button>
                            </div>

                            {/* Navigation links - Massive pill styling */}
                            <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-2 pb-6">
                                <div className="text-[10px] font-akony tracking-widest text-white/30 uppercase px-4 mb-3 mt-2">{locale === 'ru' ? 'Меню' : 'Menu'}</div>
                                {navItems.map(item => {
                                    const active = isActive(item.href);
                                    return (
                                        <Link key={item.href} href={item.href} className="block group">
                                            <div className={`
                                                flex items-center gap-4 px-4 py-3.5 rounded-full text-sm font-bold transition-all
                                                ${active
                                                    ? 'bg-[var(--surface-hover)] text-white shadow-inner border border-[var(--border-subtle)]'
                                                    : 'text-white/40 hover:text-white hover:bg-[var(--surface-card)] border border-transparent'}
                                            `}>
                                                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${active ? 'bg-[var(--color-primary-1)] text-black shadow-[0_0_20px_rgba(117,241,106,0.2)]' : 'bg-transparent text-white/40 group-hover:text-white'}`}>
                                                    <item.icon size={18} weight={active ? 'fill' : 'regular'} />
                                                </div>
                                                <span className={active ? 'text-white' : ''}>{item.label}</span>
                                            </div>
                                        </Link>
                                    );
                                })}

                                <div className="h-4"></div>
                                <div className="text-[10px] font-akony tracking-widest text-white/30 uppercase px-4 mb-3">{locale === 'ru' ? 'Прочее' : 'Other'}</div>

                                <Link href={`/dashboard/${guildId}/server-settings`} className="block group">
                                    {(() => {
                                        const active = isActive(`/dashboard/${guildId}/server-settings`);
                                        return (
                                            <div className={`
                                                flex items-center gap-4 px-4 py-3.5 rounded-full text-sm font-bold transition-all
                                                ${active
                                                    ? 'bg-[var(--surface-hover)] text-white shadow-inner border border-[var(--border-subtle)]'
                                                    : 'text-white/40 hover:text-white hover:bg-[var(--surface-card)] border border-transparent'}
                                            `}>
                                                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${active ? 'bg-[var(--color-primary-1)] text-black shadow-[0_0_20px_rgba(117,241,106,0.2)]' : 'bg-transparent text-white/40 group-hover:text-white'}`}>
                                                    <Gear size={18} weight={active ? 'fill' : 'regular'} />
                                                </div>
                                                <span className={active ? 'text-white' : ''}>{text.settings}</span>
                                            </div>
                                        );
                                    })()}
                                </Link>
                            </div>

                            {/* Bottom Actions */}
                            <div className="p-6 border-t border-[var(--border-divider)] flex gap-2">
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="flex items-center gap-3 flex-1 bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] transition-all px-4 py-3 rounded-full text-white/50 hover:text-white text-sm font-bold justify-center border border-[var(--border-divider)]"
                                >
                                    <ArrowLeft size={18} />
                                    <span>{text.back}</span>
                                </button>
                                <div
                                    className="flex flex-col bg-[var(--surface-card)] border border-[var(--border-divider)] rounded-full p-1 justify-center relative w-12 items-center hover:bg-[var(--surface-hover)] cursor-pointer"
                                    onMouseEnter={() => setMobileLangOpen(true)}
                                    onMouseLeave={() => setMobileLangOpen(false)}
                                >
                                    <span className="text-white/50 text-[10px] uppercase font-bold text-center mt-0.5">{locale}</span>
                                    <Translate size={14} className="text-white/30" />
                                    {mobileLangOpen && (
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 pt-10 z-50" style={{paddingBottom: '100%'}}>
                                            <div className="bg-[var(--surface-hover)] rounded-2xl border border-[var(--border-subtle)] p-2 shadow-xl">
                                                <button onClick={() => setLocale('ru')} className={`block w-full text-left px-3 py-2 rounded-xl text-xs font-bold ${locale === 'ru' ? 'bg-[var(--color-primary-1)] text-black' : 'text-white/60 hover:text-white'}`}>RU</button>
                                                <button onClick={() => setLocale('en')} className={`block w-full text-left px-3 py-2 rounded-xl text-xs font-bold mt-1 ${locale === 'en' ? 'bg-[var(--color-primary-1)] text-black' : 'text-white/60 hover:text-white'}`}>EN</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
