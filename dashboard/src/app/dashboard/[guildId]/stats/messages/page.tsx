'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Select, SelectItem, Skeleton, Avatar } from "@nextui-org/react";
import {
    MessengerLogo,
    Hash,
    User,
    Users,
    ArrowsClockwise,
    CalendarCheck,
} from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";
import { useStats } from "@/hooks/useStats";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { formatYAxis } from "@/lib/utils";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { StatsTopWidget } from "@/components/stats/StatsTopWidget";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';

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
    },
    ru: {
        title: 'Сообщения',
        subtitle: 'Анализ активности и топ участников',
        heatmap: 'Карта активности',
        heatmapDesc: 'Почасовое распределение сообщений',
        topChannels: 'Топ каналов',
        topMembers: 'Топ участников',
        messagesOverTime: 'Динамика сообщений',
        uniqueUsers: 'Уник. участников',
        uniqueChannels: 'Уник. каналов',
        period: 'Период',
        day1: '24 часа',
        day3: '3 дня',
        day7: '7 дней',
        day14: '14 дней',
        day30: '30 дней',
        month3: '90 дней',
        year1: '365 дней',
        monday: 'Пн',
        tuesday: 'Вт',
        wednesday: 'Ср',
        thursday: 'Чт',
        friday: 'Пт',
        saturday: 'Сб',
        sunday: 'Вс',
        median: 'Медиана',
    },
} as const;

export default function MessagesPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    const [period, setPeriod] = usePersistentPeriod('7d');
    const { data, loading, refresh } = useStats({ guildId, type: 'messages', period });
    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        try {
            let days = 90;
            if (period === 'all') days = 365;
            else if (period.endsWith('d')) days = parseInt(period);

            await fetch(`/api/guilds/${guildId}/stats/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days })
            });
            await new Promise(r => setTimeout(r, 1000));
            refresh();
        } catch (error) {
            console.error(error);
        } finally {
            setSyncing(false);
        }
    };

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
                const jsDay = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                // Convert to Monday-first: Mon=0, Tue=1, ..., Sun=6
                const day = jsDay === 0 ? 6 : jsDay - 1;
                const hour = date.getHours();
                grid[day][hour] += h.count;
            });
            max = Math.max(...grid.flat()) || 1;
        }
        return { heatmapGrid: grid, maxHeatmapValue: max };
    }, [data]);

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
        <div className="p-6 space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                        <MessengerLogo size={32} weight="fill" className="text-violet-500 drop-shadow-lg" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">{text.title}</h1>
                        <p className="text-default-400 font-medium">{text.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-[#18181b]/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md w-full md:w-auto">
                    <Button
                        isIconOnly
                        variant="flat"
                        color="primary"
                        isLoading={syncing}
                        onPress={handleSync}
                        className="bg-primary/10 text-primary w-10 h-10 flex-shrink-0"
                    >
                        {!syncing && <ArrowsClockwise size={20} weight="bold" />}
                    </Button>
                    <div className="h-6 w-px bg-white/10 mx-1" />
                    <Select
                        labelPlacement="outside"
                        selectedKeys={[period]}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="flex-1 md:w-40"
                        classNames={{
                            trigger: "bg-transparent shadow-none hover:bg-white/5 border-0 min-h-10 h-10 justify-between",
                            value: "text-small font-medium group-data-[has-value=true]:text-white",
                            popoverContent: "bg-[#18181b] border border-white/10 dark"
                        }}
                        startContent={<CalendarCheck className="text-default-400" size={16} />}
                        disallowEmptySelection
                    >
                        <SelectItem key="24h">{text.day1}</SelectItem>
                        <SelectItem key="3d">{text.day3}</SelectItem>
                        <SelectItem key="7d">{text.day7}</SelectItem>
                        <SelectItem key="14d">{text.day14}</SelectItem>
                        <SelectItem key="30d">{text.day30}</SelectItem>
                        <SelectItem key="90d">{text.month3}</SelectItem>
                        <SelectItem key="365d">{text.year1}</SelectItem>
                    </Select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Messages"
                    value={totalMessages.toLocaleString()}
                    icon={<MessengerLogo size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title="Avg. Daily"
                    value={avgMessages.toLocaleString()}
                    icon={<CalendarCheck size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.uniqueUsers}
                    value={uniqueUsers.toLocaleString()}
                    icon={<Users size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.uniqueChannels}
                    value={uniqueChannels.toLocaleString()}
                    icon={<Hash size={24} weight="fill" />}
                    loading={loading}
                />
            </div>

            {/* Line Chart & Heatmap - 50/50 layout */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartContainer
                    title={text.messagesOverTime}
                    className="h-full"
                    loading={loading}
                    height={350}
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
                                contentStyle={{
                                    backgroundColor: 'rgba(24, 24, 27, 0.9)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="messages"
                                stroke="url(#lineColor)"
                                strokeWidth={3}
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
                    height={350}
                >
                    <div className="h-full flex flex-col justify-center overflow-x-auto">
                        <div className="min-w-max">
                            {/* Hour labels - aligned with cells */}
                            <div className="flex mb-2">
                                <div className="w-8 flex-shrink-0" />
                                <div className="flex flex-1">
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 text-[10px] text-default-400 text-center min-w-[12px]"
                                        >
                                            {i % 2 === 0 ? i : ''}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Heatmap grid */}
                            {heatmapGrid.map((row, dayIndex) => (
                                <div key={dayIndex} className="flex items-center mb-1">
                                    <div className="w-8 flex-shrink-0 text-xs text-default-400 font-medium">{days[dayIndex].slice(0, 3)}</div>
                                    <div className="flex flex-1">
                                        {row.map((value, hour) => {
                                            const intensity = value / maxHeatmapValue;
                                            return (
                                                <div
                                                    key={`${dayIndex}-${hour}`}
                                                    className="group/cell relative h-6 flex-1 mx-[1px] min-w-[12px] rounded-sm transition-transform hover:scale-110 hover:z-20 cursor-pointer"
                                                    style={{
                                                        backgroundColor: value > 0
                                                            ? `rgba(139, 92, 246, ${0.15 + intensity * 0.85})`
                                                            : 'rgba(255, 255, 255, 0.02)',
                                                    }}
                                                >
                                                    {/* CSS-only tooltip */}
                                                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-[#18181b]/95 border border-white/10 backdrop-blur-md shadow-xl opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 transition-all duration-100 whitespace-nowrap z-50">
                                                        <div className="font-bold text-white text-sm">{days[dayIndex]} {hour}:00</div>
                                                        <div className="text-xs text-default-300">{value} messages</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </ChartContainer>
            </div>

            {/* Top Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatsTopWidget
                    title={text.topChannels}
                    data={topChannels.map((ch: any) => ({
                        id: ch.channelId || ch.id,
                        name: ch.name || ch.channelId || ch.id,
                        value: ch.value,
                        discordUrl: ch.discordUrl
                    }))}
                    valueFormatter={(v) => `${v.toLocaleString()} msgs`}
                    type="list"
                    icon={<Hash size={20} />}
                    totalValue={totalChannelValue}
                    isChannel
                />

                <StatsTopWidget
                    title={text.topMembers}
                    data={topMembers.map((m: any) => ({
                        id: m.userId || m.id,
                        name: m.name || m.userId || m.id,
                        value: m.value,
                        avatar: m.avatar
                    }))}
                    valueFormatter={(v) => `${v.toLocaleString()} msgs`}
                    type="list"
                    icon={<User size={20} />}
                    totalValue={totalMemberValue}
                />
            </div>
        </div>
    );
}
