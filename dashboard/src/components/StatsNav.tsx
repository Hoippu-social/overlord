'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import {
    SquaresFour, ChatsTeardrop, MicrophoneStage, UsersThree,
    Hash, UserCircle, Gear, GameController, Graph, ArrowsClockwise,
} from '@phosphor-icons/react';
import { Button, Select, SelectItem } from '@nextui-org/react';
import { useGuildLocale } from '@/lib/i18n';
import { useSession } from 'next-auth/react';
import { BOT_OWNER_ID } from '@/lib/constants';
import { HistoricalSyncModal } from '@/components/stats/HistoricalSyncModal';

const strings = {
    en: {
        overview: 'Overview', messages: 'Messages', voice: 'Voice',
        members: 'Members', channels: 'Channels', users: 'Users',
        activities: 'Activities', settings: 'Settings', contacts: 'Contacts',
        day1: '24h', day3: '3d', day7: '7d', day14: '14d',
        day30: '30d', month3: '90d', month6: '180d', year1: '365d',
        minutes: 'min', hours: 'h',
    },
    ru: {
        overview: 'Обзор', messages: 'Сообщения', voice: 'Голос',
        members: 'Участники', channels: 'Каналы', users: 'Пользователь',
        activities: 'Активности', settings: 'Настройки', contacts: 'Связи',
        day1: '24ч', day3: '3д', day7: '7д', day14: '14д',
        day30: '30д', month3: '90д', month6: '180д', year1: '365д',
        minutes: 'мин', hours: 'ч',
    },
} as const;

function StatsNavContent({ guildId }: { guildId: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { locale } = useGuildLocale(guildId);
    const t = strings[locale];
    const [syncing, setSyncing] = useState(false);

    const period = searchParams.get('period') || '7d';

    const { data: session } = useSession();
    const isOwner = (session?.user as any)?.id === BOT_OWNER_ID || (session?.user as any)?.role === 'admin';

    const items = [
        { key: 'overview', label: t.overview, icon: SquaresFour, href: `/dashboard/${guildId}/stats` },
        { key: 'messages', label: t.messages, icon: ChatsTeardrop, href: `/dashboard/${guildId}/stats/messages` },
        { key: 'voice', label: t.voice, icon: MicrophoneStage, href: `/dashboard/${guildId}/stats/voice` },
        { key: 'members', label: t.members, icon: UsersThree, href: `/dashboard/${guildId}/stats/members` },
        { key: 'channels', label: t.channels, icon: Hash, href: `/dashboard/${guildId}/stats/channels` },
        { key: 'users', label: t.users, icon: UserCircle, href: `/dashboard/${guildId}/stats/users` },
        { key: 'activity', label: t.activities, icon: GameController, href: `/dashboard/${guildId}/stats/activities` },
        { key: 'contacts', label: t.contacts, icon: Graph, href: `/dashboard/${guildId}/stats/contacts` },
        ...(isOwner ? [{ key: 'settings', label: t.settings, icon: Gear, href: `/dashboard/${guildId}/stats/settings` }] : []),
    ];

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(key, value);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const [syncModalOpen, setSyncModalOpen] = useState(false);

    const handleSync = () => {
        setSyncModalOpen(true);
    };

    const selectedDays = (() => {
        if (period === 'all' || period === '365d') return 90;
        if (period.endsWith('d')) return Math.min(parseInt(period), 90);
        if (period === '24h') return 1;
        return 90;
    })();

    return (
        <div className="flex items-start gap-3">
            {/* Nav tabs pill — takes all available space */}
            <div className="flex items-center gap-1 flex-wrap bg-[#111111] border border-white/[0.04] rounded-2xl p-1.5 shadow-sm shadow-black/20 flex-1 min-w-0">
                {items.map(item => {
                    const active = pathname === item.href;
                    const href = `${item.href}?period=${period}`;
                    return (
                        <Link
                            key={item.key}
                            href={href}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                                ${active
                                    ? 'bg-[#75F16A] text-[#0a0a0a] shadow-[0_0_20px_rgba(117,241,106,0.3)]'
                                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'}
                            `}
                        >
                            <item.icon size={16} weight={active ? 'fill' : 'regular'} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Right column: period pill, then voice toggle below (stacked) */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {/* Period selector pill */}
                <div className="flex items-center gap-2 bg-[#111111] border border-white/[0.04] rounded-full p-1.5 shadow-sm shadow-black/20">
                    <Button
                        isIconOnly
                        variant="light"
                        isLoading={syncing}
                        onPress={handleSync}
                        className="text-white/40 hover:text-[#75F16A] hover:bg-[#75F16A]/10 w-9 h-9 rounded-full transition-all"
                        title="Sync"
                    >
                        {!syncing && <ArrowsClockwise size={18} />}
                    </Button>
                    <div className="w-px h-5 bg-white/[0.06]" />
                    <Select
                        selectedKeys={[period]}
                        onChange={(e) => setParam('period', e.target.value)}
                        className="w-28"
                        classNames={{
                            trigger: "bg-transparent shadow-none hover:bg-white/[0.04] border-0 h-9 min-h-9 rounded-full transition-colors px-3",
                            value: "text-sm text-white/80 font-bold",
                            popoverContent: "bg-[#111111] border border-white/[0.08] rounded-2xl shadow-2xl",
                        }}
                        disallowEmptySelection
                        aria-label="Period"
                    >
                        <SelectItem key="24h">{t.day1}</SelectItem>
                        <SelectItem key="3d">{t.day3}</SelectItem>
                        <SelectItem key="7d">{t.day7}</SelectItem>
                        <SelectItem key="14d">{t.day14}</SelectItem>
                        <SelectItem key="30d">{t.day30}</SelectItem>
                        <SelectItem key="90d">{t.month3}</SelectItem>
                        <SelectItem key="180d">{t.month6}</SelectItem>
                        <SelectItem key="365d">{t.year1}</SelectItem>
                    </Select>
                </div>


            </div>
            <HistoricalSyncModal
                isOpen={syncModalOpen}
                onClose={() => { setSyncModalOpen(false); router.refresh(); }}
                guildId={guildId}
                selectedDays={selectedDays}
            />
        </div>
    );
}

export function StatsNav({ guildId }: { guildId: string }) {
    return (
        <Suspense fallback={<div className="h-[46px] rounded-xl skeleton" />}>
            <StatsNavContent guildId={guildId} />
        </Suspense>
    );
}
