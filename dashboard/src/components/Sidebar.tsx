'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, Tooltip, ScrollShadow } from "@nextui-org/react";
import {
    SquaresFour,
    ShieldCheck,
    Scroll,
    Coins,
    MusicNote,
    Ticket,
    Gear,
    CaretLeft,
    List
} from "@phosphor-icons/react";
import { cn } from "@nextui-org/react";

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    guildId: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, guildId }) => {
    const pathname = usePathname();

    const navItems = [
        { label: 'Hub', href: `/dashboard/${guildId}`, icon: SquaresFour },
        { label: 'Moderation', href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck },
        { label: 'Audit Logs', href: `/dashboard/${guildId}/audit`, icon: Scroll },
        { label: 'Economy', href: `/dashboard/${guildId}/economy`, icon: Coins },
        { label: 'Music', href: `/dashboard/${guildId}/music`, icon: MusicNote },
        { label: 'Tickets', href: `/dashboard/${guildId}/tickets`, icon: Ticket },
        { label: 'Settings', href: `/dashboard/${guildId}/settings`, icon: Gear },
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
                        Dashboard
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

            {/* Footer / User Profile could go here */}
        </aside>
    );
};
