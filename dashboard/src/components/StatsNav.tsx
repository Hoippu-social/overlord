'use client';

import React, { Suspense, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowsClockwise,
} from '@phosphor-icons/react';
import { Button, Select, SelectItem } from '@nextui-org/react';
import { useGuildLocale } from '@/lib/i18n';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { HistoricalSyncModal } from '@/components/stats/HistoricalSyncModal';

const strings = {
    en: {
        overview: 'Overview',
        messages: 'Messages',
        voice: 'Voice',
        members: 'Members',
        channels: 'Channels',
        users: 'Users',
        activities: 'Activities',
        contacts: 'Contacts',
        day1: '24h',
        day3: '3d',
        day7: '7d',
        day14: '14d',
        day30: '30d',
        month3: '90d',
        month6: '180d',
        year1: '365d',
    },
    ru: {
        overview: 'Обзор',
        messages: 'Сообщения',
        voice: 'Голос',
        members: 'Участники',
        channels: 'Каналы',
        users: 'Пользователи',
        activities: 'Активности',
        contacts: 'Связи',
        day1: '24ч',
        day3: '3д',
        day7: '7д',
        day14: '14д',
        day30: '30д',
        month3: '90д',
        month6: '180д',
        year1: '365д',
    },
} as const;

function StatsNavContent({ guildId }: { guildId: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { locale } = useGuildLocale(guildId);
    const t = strings[locale];
    const [syncing, setSyncing] = useState(false);
    const [syncModalOpen, setSyncModalOpen] = useState(false);

    const period = searchParams.get('period') || '7d';

    const tabs = ['overview', 'messages', 'voice', 'members', 'channels', 'users', 'activities', 'contacts'] as const;

    const labels = {
        overview: t.overview,
        messages: t.messages,
        voice: t.voice,
        members: t.members,
        channels: t.channels,
        users: t.users,
        activities: t.activities,
        contacts: t.contacts,
    } satisfies Record<(typeof tabs)[number], string>;

    const hrefs = {
        overview: `/dashboard/${guildId}/stats`,
        messages: `/dashboard/${guildId}/stats/messages`,
        voice: `/dashboard/${guildId}/stats/voice`,
        members: `/dashboard/${guildId}/stats/members`,
        channels: `/dashboard/${guildId}/stats/channels`,
        users: `/dashboard/${guildId}/stats/users`,
        activities: `/dashboard/${guildId}/stats/activities`,
        contacts: `/dashboard/${guildId}/stats/contacts`,
    } satisfies Record<(typeof tabs)[number], string>;

    const activeTab = tabs.find((tab) => pathname === hrefs[tab]) || 'overview';

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(key, value);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleSync = () => {
        setSyncing(true);
        setSyncModalOpen(true);
    };

    const handleTabChange = (tab: string) => {
        const key = tab as (typeof tabs)[number];
        router.push(`${hrefs[key]}?period=${period}`, { scroll: false });
    };

    const selectedDays = (() => {
        if (period === 'all' || period === '365d') return 90;
        if (period.endsWith('d')) return Math.min(parseInt(period), 90);
        if (period === '24h') return 1;
        return 90;
    })();

    return (
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start">
            <SegmentedTabs
                active={activeTab}
                onChange={handleTabChange}
                labels={labels}
                tabs={tabs}
                className="flex-1"
                dataTour="stats-tabs"
            />

            <div className="flex w-full flex-shrink-0 flex-col items-stretch gap-2 sm:w-auto xl:items-end">
                <div className="flex w-full items-center gap-2 rounded-2xl border border-divider bg-surface p-1.5 shadow-sm shadow-black/20 sm:w-auto sm:rounded-full">
                    <Button
                        isIconOnly
                        variant="light"
                        isLoading={syncing}
                        onPress={handleSync}
                        aria-label="Sync"
                        data-tour="stats-sync"
                        className="h-10 w-10 rounded-full text-white/40 transition-all hover:bg-white/[0.04] hover:text-[var(--color-primary-1)]"
                        title="Sync"
                    >
                        {!syncing && <ArrowsClockwise size={18} />}
                    </Button>
                    <div className="h-5 w-px bg-white/[0.06]" />
                    <Select
                        selectedKeys={[period]}
                        onChange={(e) => setParam('period', e.target.value)}
                        data-tour="stats-period"
                        className="min-w-0 flex-1 sm:w-28 sm:flex-none"
                        classNames={{
                            trigger: 'h-10 min-h-10 rounded-full border-0 bg-transparent px-3 shadow-none transition-colors hover:bg-white/[0.04]',
                            value: 'text-sm font-bold text-white/80',
                            popoverContent: 'rounded-2xl border border-divider bg-surface shadow-2xl',
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
                onClose={() => {
                    setSyncModalOpen(false);
                    setSyncing(false);
                    router.refresh();
                }}
                guildId={guildId}
                selectedDays={selectedDays}
            />
        </div>
    );
}

export function StatsNav({ guildId }: { guildId: string }) {
    return (
        <Suspense fallback={<LoadingSkeleton className="h-[110px] rounded-2xl sm:h-[46px]" />}>
            <StatsNavContent guildId={guildId} />
        </Suspense>
    );
}
