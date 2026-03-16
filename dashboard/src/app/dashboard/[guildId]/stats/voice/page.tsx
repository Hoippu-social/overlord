'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
    MicrophoneStage,
    SpeakerHigh,
    Users,
    Hash,
    ArrowsClockwise,
    CalendarCheck,
    Clock,
} from "@phosphor-icons/react";
import { useGuildLocale, useGuildTimezone } from "@/lib/i18n";
import { useStats } from "@/hooks/useStats";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { formatLocaleNumber, formatYAxis } from "@/lib/utils";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { StatsTopWidget } from "@/components/stats/StatsTopWidget";
import { ChartTooltip } from "@/components/stats/ChartTooltip";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Line } from 'recharts';



const strings = {
    en: {
        title: 'Voice',
        subtitle: 'Voice channel activity & top speakers',
        voiceActivity: 'Voice Activity',
        topChannels: 'Top Channels',
        topMembers: 'Top Speakers',
        totalTime: 'Total Voice Time',
        avgSession: 'Avg. Session',
        mostActive: 'Peak Hour',
        uniqueUsers: 'Unique Speakers',
        uniqueChannels: 'Unique Channels',
        minutes: 'min',
        hours: 'h',
        heatmap: 'Activity Heatmap',
        heatmapDesc: 'Hourly voice distribution',
        monday: 'Mon',
        tuesday: 'Tue',
        wednesday: 'Wed',
        thursday: 'Thu',
        friday: 'Fri',
        saturday: 'Sat',
        sunday: 'Sun',
        median: 'Median',
        other: 'Other',
        activityTime: 'Activity Time',
    },
    ru: {
        title: '\u0413\u043e\u043b\u043e\u0441',
        subtitle: '\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c \u0432 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u044b\u0445 \u043a\u0430\u043d\u0430\u043b\u0430\u0445',
        voiceActivity: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u044f \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c',
        topChannels: '\u0422\u043e\u043f \u043a\u0430\u043d\u0430\u043b\u043e\u0432',
        topMembers: '\u0422\u043e\u043f \u0433\u043e\u0432\u043e\u0440\u0443\u043d\u043e\u0432',
        totalTime: '\u0412\u0441\u0435\u0433\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438',
        avgSession: '\u0421\u0440. \u0441\u0435\u0441\u0441\u0438\u044f',
        mostActive: '\u041f\u0438\u043a. \u0447\u0430\u0441',
        uniqueUsers: '\u0423\u043d\u0438\u043a. \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432',
        uniqueChannels: '\u0423\u043d\u0438\u043a. \u043a\u0430\u043d\u0430\u043b\u043e\u0432',
        minutes: '\u043c\u0438\u043d',
        hours: '\u0447',
        heatmap: '\u041a\u0430\u0440\u0442\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438',
        heatmapDesc: '\u041f\u043e\u0447\u0430\u0441\u043e\u0432\u043e\u0435 \u0440\u0430\u0441\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0433\u043e\u043b\u043e\u0441\u0430',
        monday: '\u041f\u043d',
        tuesday: '\u0412\u0442',
        wednesday: '\u0421\u0440',
        thursday: '\u0427\u0442',
        friday: '\u041f\u0442',
        saturday: '\u0421\u0431',
        sunday: '\u0412\u0441',
        median: '\u041c\u0435\u0434\u0438\u0430\u043d\u0430',
        other: '\u041f\u0440\u043e\u0447\u0438\u0435',
        activityTime: '\u0412\u0440\u0435\u043c\u044f \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438',
    },
} as const;

/** Smart auto-format: if total minutes <= 59 -> "X min", else -> "X h Y min" */
function autoFormatMinutes(minutes: number, text: { minutes: string; hours: string }): string {
    if (minutes <= 59) return `${minutes}\u00A0${text.minutes}`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    // \u00A0 = non-breaking space: keeps number+unit together, allows wrap only between the two pairs
    return m > 0 ? `${h}\u00A0${text.hours} ${m}\u00A0${text.minutes}` : `${h}\u00A0${text.hours}`;
}

/** Smart auto-format for seconds (raw voice values from top lists) */
function autoFormatSeconds(seconds: number, text: { minutes: string; hours: string }): string {
    const minutes = Math.floor(seconds / 60);
    return autoFormatMinutes(minutes, text);
}

export default function VoicePage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const guildTimezone = useGuildTimezone(guildId);
    const text = strings[locale];

    const [period, setPeriod] = usePersistentPeriod('7d');
    const { data, loading, refresh } = useStats({ guildId, type: 'voice', period });
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
            console.error("Sync failed:", error);
        } finally {
            setSyncing(false);
        }
    };

    // Days starting from Monday
    const days = [text.monday, text.tuesday, text.wednesday, text.thursday, text.friday, text.saturday, text.sunday];

    // Heatmap data transformation
    const { heatmapGrid, maxHeatmapValue } = useMemo(() => {
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
                grid[day][hour] += h.voice;
            });
            max = Math.max(...grid.flat()) || 1;
        }
        return { heatmapGrid: grid, maxHeatmapValue: max };
    }, [data, guildTimezone]);

    const areaChartData = data?.areaChart || [];
    const topChannels = data?.topChannels || [];
    const topMembers = data?.topMembers || [];
    const totalChannelValue = data?.totalChannelValue || 0;
    const totalMemberValue = data?.totalMemberValue || 0;

    const totalMinutes = areaChartData.reduce((acc: number, curr: any) => acc + curr.voice, 0);
    const uniqueUsers = data?.uniqueUsers ?? 0;
    const uniqueChannels = data?.uniqueChannels ?? 0;

    // Chart data (always in minutes, formatting handled by axis/tooltip)
    const chartData = areaChartData.map((d: any) => ({
        date: d.date,
        voice: d.voice,
        weeklyMedian: d.weeklyMedian ?? undefined
    }));

    return (
        <div className="p-6 space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                    <MicrophoneStage size={32} weight="fill" className="text-orange-500 drop-shadow-lg" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{text.title}</h1>
                    <p className="text-default-400 font-medium">{text.subtitle}</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <StatsCard
                    title={text.totalTime}
                    value={autoFormatMinutes(totalMinutes, text)}
                    icon={<Clock size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.avgSession}
                    value={data?.avgSession ? autoFormatSeconds(data.avgSession, text) : '-'}
                    icon={<SpeakerHigh size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.mostActive}
                    value={data?.peakHour || '-'}
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

            {/* Voice Activity Chart & Heatmap */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartContainer
                    title={text.voiceActivity}
                    loading={loading}
                    height={350}
                    className="h-full"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="voiceColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.5} />
                                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis
                                stroke="#52525b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={50}
                                tickFormatter={(v) => {
                                    if (v >= 60) return `${formatYAxis(Math.floor(v / 60), locale as 'ru' | 'en')}\u00A0${text.hours}`;
                                    return `${formatYAxis(v, locale as 'ru' | 'en')}\u00A0${text.minutes}`;
                                }}
                            />
                            <RechartsTooltip
                                content={(props: any) => (
                                    <ChartTooltip
                                        {...props}
                                        locale={locale}
                                        order={['voice', 'weeklyMedian']}
                                        colorOverrides={{ voice: '#F97316' }}
                                        formatters={{
                                            voice: (v) => autoFormatMinutes(v as number, text),
                                            weeklyMedian: (v) => autoFormatMinutes(v as number, text)
                                        }}
                                    />
                                )}
                            />
                            <Area
                                type="monotone"
                                dataKey="voice"
                                name={text.activityTime}
                                stroke="#F97316"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#voiceColor)"
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
                        </AreaChart>
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
                            {/* Hour labels */}
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
                                                    className="group/cell relative h-6 flex-1 mx-[1px] min-w-[12px] rounded-full transition-transform hover:scale-110 hover:z-20 cursor-pointer"
                                                    style={{
                                                        backgroundColor: value > 0
                                                            ? `rgba(249, 115, 22, ${0.15 + intensity * 0.85})`
                                                            : 'rgba(255, 255, 255, 0.03)',
                                                    }}
                                                >
                                                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 rounded-2xl bg-[#111111]/95 border border-white/[0.04] backdrop-blur-xl shadow-2xl opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 transition-all duration-100 whitespace-nowrap z-50">
                                                        <div className="font-bold text-white text-sm">{days[dayIndex]} {hour}:00</div>
                                                        <div className="text-xs text-default-300">
                                                            {autoFormatSeconds(value, text)}
                                                        </div>
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

            {/* Top Channels & Members */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatsTopWidget
                    title={text.topChannels}
                    data={topChannels.map((c: any) => ({
                        id: c.channelId || c.id,
                        name: c.name || `#${c.channelId?.slice(-4) || 'unknown'}`,
                        value: c.value,
                        discordUrl: c.discordUrl,
                        drilldownUrl: c.drilldownUrl
                    }))}
                    type="list"
                    valueFormatter={(v) => autoFormatSeconds(v, text)}
                    totalValue={totalChannelValue}
                    locale={locale}
                    othersLabel={text.other}
                    isChannel
                />
                <StatsTopWidget
                    title={text.topMembers}
                    data={topMembers.map((m: any) => ({
                        id: m.userId || m.id,
                        name: m.name || m.userId?.slice(-6) || 'unknown',
                        value: m.value,
                        avatar: m.avatar,
                        username: m.username,
                        drilldownUrl: m.drilldownUrl
                    }))}
                    type="list"
                    valueFormatter={(v) => autoFormatSeconds(v, text)}
                    totalValue={totalMemberValue}
                    locale={locale}
                    othersLabel={text.other}
                />
            </div>
        </div>
    );
}




