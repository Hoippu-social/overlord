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
    Translate
} from "@phosphor-icons/react";
import { cn } from "@nextui-org/react";
import { useGuildLocale } from "@/lib/i18n";

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    guildId: string;
}

const strings = {
    en: {
        title: 'Dashboard',
        hub: 'Hub',
        moderation: 'Moderation',
        auditLogs: 'Audit Logs',
        economy: 'Economy',
        music: 'Music',
        tempVoice: 'Temp Voice',
        tickets: 'Tickets',
        botSettings: 'Bot settings',
        serverSettings: 'Server settings',
    },
    ru: {
        title: 'Панель управления',
        hub: 'Главная',
        moderation: 'Модерация',
        auditLogs: 'Журнал аудита',
        economy: 'Экономика',
        music: 'Музыка',
        tempVoice: 'Временные комнаты',
        tickets: 'Тикеты',
        botSettings: 'Настройки бота',
        serverSettings: 'Настройки сервера',
    },
} as const;

const localeOptions = [
    { key: 'ru', label: 'RU' },
    { key: 'en', label: 'EN' },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, guildId }) => {
    const pathname = usePathname();
    const { locale, setLocale } = useGuildLocale(guildId);
    const text = strings[locale];

    const navItems = [
        { label: text.hub, href: `/dashboard/${guildId}`, icon: SquaresFour },
        { label: text.moderation, href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck },
        { label: text.auditLogs, href: `/dashboard/${guildId}/audit`, icon: Scroll },
        { label: text.economy, href: `/dashboard/${guildId}/economy`, icon: Coins },
        { label: text.music, href: `/dashboard/${guildId}/music`, icon: MusicNote },
        { label: text.tempVoice, href: `/dashboard/${guildId}/tempvoice`, icon: ChatsTeardrop },
        { label: text.tickets, href: `/dashboard/${guildId}/tickets`, icon: Ticket },
        { label: text.botSettings, href: `/dashboard/${guildId}/settings`, icon: Gear },
        { label: text.serverSettings, href: `/dashboard/${guildId}/server-settings`, icon: Buildings },
    ];

    return (
        <aside
            className={cn(
                "h-screen bg-surface border-r border-divider flex flex-col transition-all duration-300 z-50 fixed left-0 top-0",
                collapsed ? "w-20" : "w-72"
            )}
        >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-divider">
                {!collapsed && (
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent truncate">
                        {text.title}
                    </span>
                )}
                <Button
                    isIconOnly
                    variant="light"
                    onPress={onToggle}
                    className={collapsed ? "mx-auto" : ""}
                >
                    {collapsed ? <List size={24} /> : <CaretLeft size={24} />}
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

            <div className={cn("border-t border-divider", collapsed ? "p-3 flex items-center" : "p-4")}>
                {collapsed ? (
                    <Dropdown placement="top-start">
                        <DropdownTrigger>
                            <Button isIconOnly variant="light" aria-label="Language">
                                <Translate size={20} />
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label="Language"
                            selectionMode="single"
                            selectedKeys={new Set([locale])}
                            onSelectionChange={(keys) => {
                                const [value] = Array.from(keys) as string[];
                                if (value === 'ru' || value === 'en') {
                                    setLocale(value);
                                }
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
                ) : (
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-default-500 uppercase tracking-wide">
                            <Translate size={16} />
                            <span>Language</span>
                        </div>
                        <ButtonGroup size="sm" variant="bordered">
                            {localeOptions.map((option) => {
                                const isActive = option.key === locale;
                                return (
                                    <Button
                                        key={option.key}
                                        size="sm"
                                        color={isActive ? "primary" : "default"}
                                        variant={isActive ? "solid" : "bordered"}
                                        onPress={() => setLocale(option.key)}
                                        startContent={
                                            <img
                                                src={option.key === 'ru' ? "/icons/free_russia_flag.png" : "/icons/uk_flag.png"}
                                                className="w-4 h-4 rounded-sm object-contain"
                                                alt=""
                                            />
                                        }
                                    >
                                        {option.label}
                                    </Button>
                                );
                            })}
                        </ButtonGroup>
                    </div>
                )}
            </div>
        </aside>
    );
};
