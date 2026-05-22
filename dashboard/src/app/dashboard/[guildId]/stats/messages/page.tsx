'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
    MessengerLogo,
    Hash,
    User,
    Users,
    CalendarCheck,
} from "@phosphor-icons/react";
import { useGuildLocale, useGuildTimezone } from "@/lib/i18n";
import { useStats } from "@/hooks/useStats";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { formatLocaleNumber, formatYAxis } from "@/lib/utils";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { StatsTopWidget } from "@/components/stats/StatsTopWidget";
import { ChartTooltip } from "@/components/stats/ChartTooltip";
import { StatsHeatmap, StatsPageHeader, StatsPageShell } from "@/components/stats/StatsPageScaffold";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const strings = {
    en: {
        title: 'Messages',
        subtitle: 'Activity analysis & top contributors',
        heatmap: 'Activity Heatmap',
        heatmapDesc: 'Hourly message distribution',
        topChannels: 'Top Channels',
        topMembers: 'Top Members',
        messagesOverTime: 'Messages Volume',
        uniqueUsers: 'Unique Members',
        uniqueChannels: 'Unique Channels',
        period: 'Period',
        day1: '24 Hours',
        day3: '3 Days',
        day7: '7 Days',
        day14: '14 Days',
        day30: '30 Days',
        month3: '90 Days',
        year1: '365 Days',
        monday: 'Mon',
        tuesday: 'Tue',
        wednesday: 'Wed',
        thursday: 'Thu',
        friday: 'Fri',
        saturday: 'Sat',
        sunday: 'Sun',
        median: 'Median',
        totalMessages: 'Total Messages',
        avgDaily: 'Avg. Daily',
        messagesUnit: 'messages',
        other: 'Other',
        msgs: 'msgs',
        messagesLabel: 'Messages',
    },
    ru: {
        title: '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f',
        subtitle: '\u0410\u043d\u0430\u043b\u0438\u0437 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438 \u0438 \u0442\u043e\u043f \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432',
        heatmap: '\u041a\u0430\u0440\u0442\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438',
        heatmapDesc: '\u041f\u043e\u0447\u0430\u0441\u043e\u0432\u043e\u0435 \u0440\u0430\u0441\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439',
        topChannels: '\u0422\u043e\u043f \u043a\u0430\u043d\u0430\u043b\u043e\u0432',
        topMembers: '\u0422\u043e\u043f \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432',
        messagesOverTime: '\u0414\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439',
        uniqueUsers: '\u0423\u043d\u0438\u043a. \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432',
        uniqueChannels: '\u0423\u043d\u0438\u043a. \u043a\u0430\u043d\u0430\u043b\u043e\u0432',
        period: '\u041f\u0435\u0440\u0438\u043e\u0434',
        day1: '24 \u0447\u0430\u0441\u0430',
        day3: '3 \u0434\u043d\u044f',
        day7: '7 \u0434\u043d\u0435\u0439',
        day14: '14 \u0434\u043d\u0435\u0439',
        day30: '30 \u0434\u043d\u0435\u0439',
        month3: '90 \u0434\u043d\u0435\u0439',
        year1: '365 \u0434\u043d\u0435\u0439',
        monday: '\u041f\u043d',
        tuesday: '\u0412\u0442',
        wednesday: '\u0421\u0440',
        thursday: '\u0427\u0442',
        friday: '\u041f\u0442',
        saturday: '\u0421\u0431',
        sunday: '\u0412\u0441',
        median: '\u041c\u0435\u0434\u0438\u0430\u043d\u0430',
        totalMessages: '\u0412\u0441\u0435\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439',
        avgDaily: '\u0421\u0440\u0435\u0434\u043d\u0435\u0435 / \u0414\u0435\u043d\u044c',
        messagesUnit: '\u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439',
        other: '\u041f\u0440\u043e\u0447\u0438\u0435',
        msgs: '\u0441\u043e\u043e\u0431\u0449.',
        messagesLabel: '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f',
    },
} as const;

export default function MessagesPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const guildTimezone = useGuildTimezone(guildId);
    const text = strings[locale];

    const [period] = usePersistentPeriod('7d');
    const { data, loading } = useStats({ guildId, type: 'messages', period });

    // Days starting from Monday
    const days = [text.monday, text.tuesday, text.wednesday, text.thursday, text.friday, text.saturday, text.sunday];

    // Heatmap data transformation - reordered to start from Monday
    const { heatmapGrid, maxHeatmapValue } = useMemo(() => {
        // Grid indexed 0=Mon, 1=Tue, ..., 6=Sun
        const grid: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
        let max = 1;

        if (data?.heatmap) {
            data.heatmap.forEach((h: any) => {
                const date = new Date(h.date);
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone: guildTimezone,
                    weekday: 'short',
                    hour: 'numeric',
                    hour12: false
                }).formatToParts(date);

                let day = 0;
                let hour = 0;
                parts.forEach(p => {
                    if (p.type === 'weekday') {
                        const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        const jsDay = daysMap.indexOf(p.value);
                        day = jsDay === 0 ? 6 : jsDay - 1;
                    }
                    if (p.type === 'hour') {
                        hour = parseInt(p.value, 10);
                        if (hour === 24) hour = 0;
                    }
                });
                grid[day][hour] += h.count;
            });
            max = Math.max(...grid.flat()) || 1;
        }
        return { heatmapGrid: grid, maxHeatmapValue: max };
    }, [data, guildTimezone]);

    const lineChartData = data?.lineChart || [];
    const topChannels = data?.topChannels || [];
    const topMembers = data?.topMembers || [];
    const totalChannelValue = data?.totalChannelValue || 0;
    const totalMemberValue = data?.totalMemberValue || 0;

    // Aggregates for Cards
    const totalMessages = lineChartData.reduce((acc: number, curr: any) => acc + curr.messages, 0);
    const avgMessages = lineChartData.length ? Math.round(totalMessages / lineChartData.length) : 0;
    const uniqueUsers = data?.uniqueUsers ?? 0;
    const uniqueChannels = data?.uniqueChannels ?? 0;

    return (
        <StatsPageShell>
            <StatsPageHeader
                title={text.title}
                subtitle={text.subtitle}
                icon={<MessengerLogo size={26} weight="fill" />}
                iconClassName="text-[var(--color-primary-2)]"
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 lg:gap-6">
                <StatsCard
                    title={text.totalMessages}
                    value={formatLocaleNumber(totalMessages, locale)}
                    icon={<MessengerLogo size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.avgDaily}
                    value={formatLocaleNumber(avgMessages, locale)}
                    icon={<CalendarCheck size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.uniqueUsers}
                    value={formatLocaleNumber(uniqueUsers, locale)}
                    icon={<Users size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.uniqueChannels}
                    value={formatLocaleNumber(uniqueChannels, locale)}
                    icon={<Hash size={24} weight="fill" />}
                    loading={loading}
                />
            </div>

            {/* Line Chart & Heatmap - 50/50 layout */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 sm:gap-6">
                <ChartContainer
                    title={text.messagesOverTime}
                    className="h-full"
                    loading={loading}
                    height={340}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#8B5CF6" />
                                    <stop offset="100%" stopColor="#EC4899" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} width={50} tickFormatter={(value) => formatYAxis(value, locale as 'ru' | 'en')} />
                            <RechartsTooltip
                                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                                content={(props) => (
                                    <ChartTooltip
                                        {...props}
                                        locale={locale}
                                        order={['messages', 'weeklyMedian']}
                                        colorOverrides={{ messages: '#8B5CF6' }}
                                    />
                                )}
                            />
                            <Line
                                type="monotone"
                                dataKey="messages"
                                name={text.messagesLabel}
                                stroke="url(#lineColor)"
                                strokeWidth={4}
                                dot={{ fill: '#8B5CF6', strokeWidth: 0, r: 4 }}
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="weeklyMedian"
                                stroke="#10b981"
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={false}
                                connectNulls
                                strokeWidth={2}
                                name={text.median}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer
                    title={text.heatmap}
                    subtitle={text.heatmapDesc}
                    className="h-full"
                    loading={loading}
                    height={340}
                >
                    <StatsHeatmap
                        days={days}
                        grid={heatmapGrid}
                        maxValue={maxHeatmapValue}
                        color="143, 94, 255"
                        valueLabel={(value, day, hour) => `${day} ${hour}:00 - ${formatLocaleNumber(value, locale)} ${text.messagesUnit}`}
                    />
                </ChartContainer>
            </div>

            {/* Top Lists */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
                <StatsTopWidget
                    title={text.topChannels}
                    data={topChannels.map((ch: any) => ({
                        id: ch.channelId || ch.id,
                        name: ch.name || ch.channelId || ch.id,
                        value: ch.value,
                        discordUrl: ch.discordUrl,
                        drilldownUrl: ch.drilldownUrl
                    }))}
                    valueFormatter={(v) => `${formatLocaleNumber(v, locale)} ${text.msgs}`}
                    type="list"
                    icon={<Hash size={20} />}
                    totalValue={totalChannelValue}
                    locale={locale}
                    isChannel
                    othersLabel={text.other}
                />

                <StatsTopWidget
                    title={text.topMembers}
                    data={topMembers.map((m: any) => ({
                        id: m.userId || m.id,
                        name: m.name || m.userId || m.id,
                        value: m.value,
                        avatar: m.avatar,
                        username: m.username,
                        drilldownUrl: m.drilldownUrl
                    }))}
                    valueFormatter={(v) => `${formatLocaleNumber(v, locale)} ${text.msgs}`}
                    type="list"
                    icon={<User size={20} />}
                    totalValue={totalMemberValue}
                    locale={locale}
                    othersLabel={text.other}
                />
            </div>
        </StatsPageShell>
    );
}


