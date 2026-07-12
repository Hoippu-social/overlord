'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
    MicrophoneStage,
    SpeakerHigh,
    Users,
    Hash,
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
import { StatsHeatmap, StatsPageHeader, StatsPageShell } from "@/components/stats/StatsPageScaffold";
import { StatsExportMenu } from "@/components/stats/StatsExportMenu";
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

    const [period] = usePersistentPeriod('7d');
    const { data, loading } = useStats({ guildId, type: 'voice', period });

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
        <StatsPageShell>
            <StatsPageHeader
                title={text.title}
                subtitle={text.subtitle}
                icon={<MicrophoneStage size={26} weight="fill" />}
                iconClassName="text-warning"
                actions={
                    <StatsExportMenu
                        locale={locale}
                        period={period}
                        filenamePrefix="voice"
                        data={data}
                        chart={{
                            title: text.voiceActivity,
                            labels: chartData.map((d: any) => d.date),
                            series: [
                                { name: text.activityTime, color: '#F97316', values: chartData.map((d: any) => d.voice) },
                                { name: text.median, color: '#10b981', values: chartData.map((d: any) => d.weeklyMedian ?? 0), dashed: true },
                            ],
                            valueFormatter: (v) => autoFormatMinutes(v, text),
                        }}
                    />
                }
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:gap-4 lg:gap-6" data-tour="stats-voice-cards">
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
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 sm:gap-6" data-tour="stats-voice-chart">
                <ChartContainer
                    title={text.voiceActivity}
                    loading={loading}
                    height={340}
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
                                activeDot={{ r: 6, stroke: '#f4f1ee', strokeWidth: 2 }}
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
                    height={340}
                >
                    <StatsHeatmap
                        days={days}
                        grid={heatmapGrid}
                        maxValue={maxHeatmapValue}
                        color="245, 158, 11"
                        valueLabel={(value, day, hour) => `${day} ${hour}:00 - ${autoFormatSeconds(value, text)}`}
                    />
                </ChartContainer>
            </div>

            {/* Top Channels & Members */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
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
        </StatsPageShell>
    );
}




