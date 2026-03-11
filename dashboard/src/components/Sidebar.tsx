'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, ButtonGroup, Tooltip, ScrollShadow, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import {
    SquaresFour,
    ShieldCheck,
    Scroll,
    Coins,
    MusicNote,
    Ticket,
    Buildings,
    Gear,
    CaretLeft,
    List,
    ChatsTeardrop,
    Translate,
    ChartBar,
    Globe,
    X,
} from "@phosphor-icons/react";
import { cn } from "@nextui-org/react";
import { useGuildLocale } from "@/lib/i18n";

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    guildId: string;
    mobileOpen: boolean;
    onMobileClose: () => void;
}

const strings = {
    en: {
        title: 'Overlord',
        hub: 'Hub',
        moderation: 'Moderation',
        auditLogs: 'Audit Logs',
        stats: 'Statistics',
        economy: 'Economy',
        music: 'Music',
        tempVoice: 'Temp Voice',
        tickets: 'Tickets',
        botSettings: 'Bot settings',
        serverSettings: 'Server settings',
        serverSelection: 'Server selection',
    },
    ru: {
        title: 'Overlord',
        hub: 'Главная',
        moderation: 'Модерация',
        auditLogs: 'Журнал аудита',
        stats: 'Статистика',
        economy: 'Экономика',
        music: 'Музыка',
        tempVoice: 'Временные комнаты',
        tickets: 'Тикеты',
        botSettings: 'Настройки бота',
        serverSettings: 'Настройки сервера',
        serverSelection: 'Выбор сервера',
    },
} as const;

const localeOptions = [
    { key: 'ru', label: 'RU' },
    { key: 'en', label: 'EN' },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({ collapsed: desktopCollapsed, onToggle, guildId, mobileOpen, onMobileClose }) => {
    const pathname = usePathname();
    const { locale, setLocale } = useGuildLocale(guildId);
    const text = strings[locale];

    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const collapsed = desktopCollapsed && !isMobile;

    const navItems = [
        { label: text.hub, href: `/dashboard/${guildId}`, icon: SquaresFour },
        { label: text.moderation, href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck },
        { label: text.auditLogs, href: `/dashboard/${guildId}/audit`, icon: Scroll },
        { label: text.stats, href: `/dashboard/${guildId}/stats`, icon: ChartBar },
        { label: text.economy, href: `/dashboard/${guildId}/economy`, icon: Coins },
        { label: text.music, href: `/dashboard/${guildId}/music`, icon: MusicNote },
        { label: text.tempVoice, href: `/dashboard/${guildId}/tempvoice`, icon: ChatsTeardrop },
        { label: text.tickets, href: `/dashboard/${guildId}/tickets`, icon: Ticket },
        { label: text.serverSettings, href: `/dashboard/${guildId}/server-settings`, icon: Buildings },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={onMobileClose}
                />
            )}
            <aside
                className={cn(
                    "h-screen bg-surface border-r border-divider flex flex-col transition-transform duration-300 z-50 fixed left-0 top-0",
                    "max-md:w-72 max-md:-translate-x-full",
                    mobileOpen ? "max-md:translate-x-0" : "",
                    desktopCollapsed ? "md:w-20" : "md:w-72"
                )}
            >
                {/* Header */}
                <div className="h-16 flex flex-shrink-0 items-center justify-between px-4 border-b border-divider">
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <img src="/logos/logo-white.svg" alt="Overlord Logo" className="w-7 h-7 object-contain flex-shrink-0" />
                            <span className="text-[16px] font-akony bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-[0.05em] leading-none mt-1 whitespace-nowrap">
                                {text.title}
                            </span>
                        </div>
                    )}
                    <Button
                        isIconOnly
                        variant="light"
                        onPress={onToggle}
                        className={cn("hidden md:flex", collapsed ? "mx-auto" : "")}
                    >
                        {collapsed ? <List size={24} /> : <CaretLeft size={24} />}
                    </Button>
                    <Button
                        isIconOnly
                        variant="light"
                        onPress={onMobileClose}
                        className="md:hidden opacity-70 hover:opacity-100"
                    >
                        <X size={24} />
                    </Button>
                </div>

                {/* Navigation */}
                <ScrollShadow className="flex-1 p-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link key={item.href} href={item.href} className="block">
                                {collapsed ? (
                                    <Tooltip content={item.label} placement="right" color="foreground">
                                        <div
                                            className={cn(
                                                "w-12 h-12 flex items-center justify-center rounded-xl mx-auto transition-colors",
                                                isActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-foreground-500 hover:bg-surface-hover hover:text-foreground"
                                            )}
                                        >
                                            <Icon size={24} weight={isActive ? "fill" : "regular"} />
                                        </div>
                                    </Tooltip>
                                ) : (
                                    <div
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                                            isActive
                                                ? "bg-primary/10 text-primary"
                                                : "text-foreground-500 hover:bg-surface-hover hover:text-foreground"
                                        )}
                                    >
                                        <Icon size={24} weight={isActive ? "fill" : "regular"} />
                                        <span className="font-semibold">{item.label}</span>
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </ScrollShadow>

                <div className={cn("border-t border-divider p-4 pt-6 space-y-6", collapsed && "px-2 items-center")}>
                    {!collapsed ? (
                        <>
                            <div className="space-y-2">
                                <Link href={`/dashboard/${guildId}/settings`} className="block w-full group">
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground-500 hover:bg-surface-hover hover:text-foreground transition-all">
                                        <Gear size={20} weight="fill" />
                                        <span className="font-semibold text-sm">{text.botSettings}</span>
                                    </div>
                                </Link>
                                <Link href="/dashboard" className="block w-full group">
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground-500 hover:bg-surface-hover hover:text-foreground transition-all">
                                        <Globe size={20} weight="fill" />
                                        <span className="font-semibold text-sm">{text.serverSelection}</span>
                                    </div>
                                </Link>
                            </div>

                            <div className="flex items-center justify-between gap-3 px-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-default-400 uppercase tracking-widest">
                                    <Translate size={14} />
                                    <span>Language</span>
                                </div>
                                <ButtonGroup size="sm" variant="flat" className="bg-surface-hover p-1 rounded-xl">
                                    {localeOptions.map((option) => {
                                        const isActive = option.key === locale;
                                        return (
                                            <Button
                                                key={option.key}
                                                size="sm"
                                                variant={isActive ? "solid" : "light"}
                                                color={isActive ? "primary" : "default"}
                                                className={cn(
                                                    "min-w-10 h-8 rounded-lg text-[11px] font-bold px-2 gap-1.5",
                                                    isActive ? "bg-primary text-white shadow-sm" : "text-default-500 hover:bg-white/5"
                                                )}
                                                onPress={() => setLocale(option.key)}
                                                startContent={
                                                    <div className="w-4 h-4 rounded-full overflow-hidden border border-white/10">
                                                        <img
                                                            src={option.key === 'ru' ? "/icons/free_russia_flag.png" : "/icons/uk_flag.png"}
                                                            className="w-full h-full object-cover"
                                                            alt=""
                                                        />
                                                    </div>
                                                }
                                            >
                                                {option.label}
                                            </Button>
                                        );
                                    })}
                                </ButtonGroup>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col gap-4 items-center">
                            <Tooltip content={text.botSettings} placement="right">
                                <Link href={`/dashboard/${guildId}/settings`} className="w-10 h-10 flex items-center justify-center rounded-xl text-foreground-500 hover:bg-surface-hover hover:text-foreground transition-colors">
                                    <Gear size={24} weight="fill" />
                                </Link>
                            </Tooltip>
                            <Tooltip content={text.serverSelection} placement="right">
                                <Link href="/dashboard" className="w-10 h-10 flex items-center justify-center rounded-xl text-foreground-500 hover:bg-surface-hover hover:text-foreground transition-colors">
                                    <Globe size={24} weight="fill" />
                                </Link>
                            </Tooltip>
                            <Dropdown placement="right-end">
                                <DropdownTrigger>
                                    <Button isIconOnly variant="light" size="sm">
                                        <Translate size={20} />
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label="Language"
                                    selectionMode="single"
                                    selectedKeys={new Set([locale])}
                                    onSelectionChange={(keys) => {
                                        const [value] = Array.from(keys) as string[];
                                        if (value === 'ru' || value === 'en') setLocale(value);
                                    }}
                                >
                                    {localeOptions.map((option) => (
                                        <DropdownItem
                                            key={option.key}
                                            startContent={
                                                <img
                                                    src={option.key === 'ru' ? "/icons/free_russia_flag.png" : "/icons/uk_flag.png"}
                                                    className="w-4 h-4 rounded-sm object-contain"
                                                    alt=""
                                                />
                                            }
                                        >
                                            {option.label}
                                        </DropdownItem>
                                    ))}
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};
