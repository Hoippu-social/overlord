'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button, Select, SelectItem, Avatar, ButtonGroup } from "@nextui-org/react";
import {
    MicrophoneStage,
    SpeakerHigh,
    User,
    Users,
    Hash,
    ArrowsClockwise,
    CalendarCheck,
    Clock,
    Timer
} from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";
import { useStats } from "@/hooks/useStats";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { StatsTopWidget } from "@/components/stats/StatsTopWidget";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Line } from 'recharts';



const strings = {
    en: {
        title: 'Voice',
        subtitle: 'Voice channel activity & top speakers',
        voiceActivity: 'Voice Activity',
        topChannels: 'Top Channels',
        topMembers: 'Top Speakers',
        period: 'Period',
        day1: '24 Hours',
        day3: '3 Days',
        day7: '7 Days',
        day30: '30 Days',
        month3: '90 Days',
        year1: '365 Days',
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
    },
    ru: {
        title: 'Голос',
        subtitle: 'Активность в голосовых каналах',
        voiceActivity: 'Голосовая активность',
        topChannels: 'Топ каналов',
        topMembers: 'Топ говорунов',
        period: 'Период',
        day1: '24 часа',
        day3: '3 дня',
        day7: '7 дней',
        day30: '30 дней',
        month3: '90 дней',
        year1: '365 дней',
        totalTime: 'Всего времени',
        avgSession: 'Ср. сессия',
        mostActive: 'Пик. час',
        uniqueUsers: 'Уник. участников',
        uniqueChannels: 'Уник. каналов',
        minutes: 'мин',
        hours: 'ч',
        heatmap: 'Карта активности',
        heatmapDesc: 'Почасовое распределение голоса',
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

type TimeUnit = 'minutes' | 'hours';

export default function VoicePage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    const [period, setPeriod] = useState('7d');
    const [timeUnit, setTimeUnit] = useState<TimeUnit>('hours');
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
                const jsDay = date.getDay(); // 0=Sun, 1=Mon...
                const day = jsDay === 0 ? 6 : jsDay - 1;
                const hour = date.getHours();
                grid[day][hour] += h.voice; // voice is in seconds
            });
            max = Math.max(...grid.flat()) || 1;
        }
        return { heatmapGrid: grid, maxHeatmapValue: max };
    }, [data]);

    const areaChartData = data?.areaChart || [];
    const topChannels = data?.topChannels || [];
    const topMembers = data?.topMembers || [];
    const totalChannelValue = data?.totalChannelValue || 0;
    const totalMemberValue = data?.totalMemberValue || 0;

    // Calculate metrics based on selected time unit
    const totalMinutes = areaChartData.reduce((acc: number, curr: any) => acc + curr.voice, 0);
    const uniqueUsers = data?.uniqueUsers ?? 0;
    const uniqueChannels = data?.uniqueChannels ?? 0;

    const formatTime = (minutes: number) => {
        if (timeUnit === 'hours') {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours}${text.hours} ${mins}${text.minutes}`;
        }
        return `${minutes} ${text.minutes}`;
    };

    const formatChartValue = (minutes: number) => {
        if (timeUnit === 'hours') {
            return Math.round(minutes / 60 * 10) / 10; // 1 decimal
        }
        return minutes;
    };

    // Transform chart data based on time unit
    const chartData = areaChartData.map((d: any) => ({
        date: d.date,
        voice: formatChartValue(d.voice),
        weeklyMedian: d.weeklyMedian ? formatChartValue(d.weeklyMedian) : undefined
    }));

    // Format top lists value based on time unit
    const formatTopValue = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        if (timeUnit === 'hours') {
            const hours = Math.floor(mins / 60);
            const remainingMins = mins % 60;
            return `${hours}${text.hours} ${remainingMins}${text.minutes}`;
        }
        return `${mins} ${text.minutes}`;
    };

    return (
        <div className="p-6 space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                        <MicrophoneStage size={32} weight="fill" className="text-orange-500 drop-shadow-lg" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">{text.title}</h1>
                        <p className="text-default-400 font-medium">{text.subtitle}</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3 bg-[#18181b]/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md w-full md:w-auto">
                    {/* Time Unit Toggle */}
                    <div className="w-full md:w-auto flex justify-center">
                        <ButtonGroup size="sm" className="w-full md:w-auto">
                            <Button
                                variant={timeUnit === 'minutes' ? 'solid' : 'flat'}
                                color={timeUnit === 'minutes' ? 'primary' : 'default'}
                                onPress={() => setTimeUnit('minutes')}
                                className={`flex-1 md:flex-none ${timeUnit === 'minutes' ? '' : 'bg-transparent hover:bg-white/5'}`}
                            >
                                <Timer size={16} weight="bold" />
                                {text.minutes}
                            </Button>
                            <Button
                                variant={timeUnit === 'hours' ? 'solid' : 'flat'}
                                color={timeUnit === 'hours' ? 'primary' : 'default'}
                                onPress={() => setTimeUnit('hours')}
                                className={`flex-1 md:flex-none ${timeUnit === 'hours' ? '' : 'bg-transparent hover:bg-white/5'}`}
                            >
                                <Clock size={16} weight="bold" />
                                {text.hours}
                            </Button>
                        </ButtonGroup>
                    </div>

                    <div className="hidden md:block h-6 w-px bg-white/10 mx-1" />

                    <div className="flex items-center gap-2 w-full md:w-auto">
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
                        <div className="hidden md:block h-6 w-px bg-white/10 mx-1" />
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
                            <SelectItem key="30d">{text.day30}</SelectItem>
                            <SelectItem key="90d">{text.month3}</SelectItem>
                            <SelectItem key="365d">{text.year1}</SelectItem>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <StatsCard
                    title={text.totalTime}
                    value={formatTime(totalMinutes)}
                    icon={<Clock size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.avgSession}
                    value={data?.avgSession ? `${Math.floor(data.avgSession / 60)} ${text.minutes}` : '—'}
                    icon={<SpeakerHigh size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.mostActive}
                    value={data?.peakHour || '—'}
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

            {/* Voice Activity Chart & Heatmap */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartContainer
                    title={text.voiceActivity}
                    loading={loading}
                    height={350}
                    className="h-full"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                dx={-10}
                                tickFormatter={(v) => timeUnit === 'hours' ? `${v}h` : `${v}m`}
                            />
                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(24, 24, 27, 0.9)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number) => [timeUnit === 'hours' ? `${value}h` : `${value} min`, text.voiceActivity]}
                            />
                            <Area
                                type="monotone"
                                dataKey="voice"
                                stroke="#F97316"
                                strokeWidth={3}
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
                                                    className="group/cell relative h-6 flex-1 mx-[1px] min-w-[12px] rounded-sm transition-transform hover:scale-110 hover:z-20 cursor-pointer"
                                                    style={{
                                                        backgroundColor: value > 0
                                                            ? `rgba(249, 115, 22, ${0.15 + intensity * 0.85})` // Orange for Voice
                                                            : 'rgba(255, 255, 255, 0.02)',
                                                    }}
                                                >
                                                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-[#18181b]/95 border border-white/10 backdrop-blur-md shadow-xl opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 transition-all duration-100 whitespace-nowrap z-50">
                                                        <div className="font-bold text-white text-sm">{days[dayIndex]} {hour}:00</div>
                                                        <div className="text-xs text-default-300">
                                                            {formatTopValue(value)}
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
                        discordUrl: c.discordUrl
                    }))}
                    type="list"
                    valueFormatter={(v) => {
                        const mins = Math.floor(v / 60);
                        if (timeUnit === 'hours') {
                            const hours = Math.floor(mins / 60);
                            const remainingMins = mins % 60;
                            return `${hours}${text.hours} ${remainingMins}${text.minutes}`;
                        }
                        return `${mins} ${text.minutes}`;
                    }}
                    totalValue={totalChannelValue}
                    isChannel
                />
                <StatsTopWidget
                    title={text.topMembers}
                    data={topMembers.map((m: any) => ({
                        id: m.userId || m.id,
                        name: m.name || m.userId?.slice(-6) || 'unknown',
                        value: m.value,
                        avatar: m.avatar
                    }))}
                    type="list"
                    valueFormatter={(v) => {
                        const mins = Math.floor(v / 60);
                        if (timeUnit === 'hours') {
                            const hours = Math.floor(mins / 60);
                            const remainingMins = mins % 60;
                            return `${hours}${text.hours} ${remainingMins}${text.minutes}`;
                        }
                        return `${mins} ${text.minutes}`;
                    }}
                    totalValue={totalMemberValue}
                />
            </div>
        </div>
    );
}
