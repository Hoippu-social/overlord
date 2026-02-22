'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    SquaresFour,
    ChatsTeardrop,
    MicrophoneStage,
    UsersThree,
    Hash,
    UserCircle,
    Gear,
    GameController
} from "@phosphor-icons/react";
import { cn, Tooltip } from "@nextui-org/react";
import { useGuildLocale } from "@/lib/i18n";
import { useSession } from "next-auth/react";
import { BOT_OWNER_ID } from "@/lib/constants";

const strings = {
    en: {
        overview: 'Overview',
        messages: 'Messages',
        voice: 'Voice',
        members: 'Members',
        channels: 'About Channel',
        users: 'About User',
        activities: 'Activities',
        settings: 'Settings',
    },
    ru: {
        overview: 'Обзор',
        messages: 'Сообщения',
        voice: 'Голос',
        members: 'Участники',
        channels: 'О канале',
        users: 'О пользователе',
        activities: 'Активности',
        settings: 'Настройки',
    },
} as const;

interface StatsNavProps {
    guildId: string;
}

export function StatsNav({ guildId }: StatsNavProps) {
    const pathname = usePathname();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    // Hover state for expansion
    const [isHovered, setIsHovered] = useState(false);
    const { data: session } = useSession();
    const isOwner = (session?.user as any)?.id === BOT_OWNER_ID || (session?.user as any)?.role === 'admin';

    const items = [
        { key: 'overview', label: text.overview, icon: SquaresFour, href: `/dashboard/${guildId}/stats` },
        { key: 'messages', label: text.messages, icon: ChatsTeardrop, href: `/dashboard/${guildId}/stats/messages` },
        { key: 'voice', label: text.voice, icon: MicrophoneStage, href: `/dashboard/${guildId}/stats/voice` },
        { key: 'members', label: text.members, icon: UsersThree, href: `/dashboard/${guildId}/stats/members` },
        { key: 'channels', label: text.channels, icon: Hash, href: `/dashboard/${guildId}/stats/channels` },
        { key: 'users', label: text.users, icon: UserCircle, href: `/dashboard/${guildId}/stats/users` },
        { key: 'activity', label: text.activities, icon: GameController, href: `/dashboard/${guildId}/stats/activities` },
        ...(isOwner ? [{ key: 'settings', label: text.settings, icon: Gear, href: `/dashboard/${guildId}/stats/settings` }] : []),
    ];

    return (
        <div className="flex flex-wrap items-center gap-2 mb-2 w-full overflow-x-auto scrollbar-hide pb-2">
            {items.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-300 border backdrop-blur-md shrink-0",
                            isActive
                                ? "bg-gradient-to-br from-primary to-primary-600 text-white border-white/10 shadow-lg shadow-primary/25 font-bold scale-[1.02]"
                                : "bg-[#181A20]/80 text-default-400 border-white/5 hover:text-white hover:bg-white/10 hover:border-white/10"
                        )}
                    >
                        <item.icon
                            size={20}
                            weight={isActive ? "fill" : "duotone"}
                            className={cn("transition-transform", isActive ? "scale-110" : "")}
                        />
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
