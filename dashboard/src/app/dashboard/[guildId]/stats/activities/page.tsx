'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Select, SelectItem, Progress } from "@nextui-org/react";
import {
    GameController,
    ArrowsClockwise,
    CalendarCheck,
    Clock,
    Trophy
} from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";
import { useStats } from "@/hooks/useStats";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";

import { StatsTopWidget, COLORS } from "@/components/stats/StatsTopWidget";




const strings = {
    en: {
        title: 'Activities',
        subtitle: 'Gameplay & application usage stats',
        topActivities: 'Most Played Games',
        activityDistribution: 'Time Distribution',
        period: 'Period',
        day1: '24 Hours',
        day3: '3 Days',
        day7: '7 Days',
        day14: '14 Days',
        day30: '30 Days',
        month3: '90 Days',
        year1: '365 Days',
        totalPlaytime: 'Total Playtime',
        topGame: 'Top Game',
        hours: 'h',
        minutes: 'min',
    },
    ru: {
        title: 'Активности',
        subtitle: 'Статистика игр и приложений',
        topActivities: 'Популярные игры',
        activityDistribution: 'Распределение времени',
        period: 'Период',
        day1: '24 часа',
        day3: '3 дня',
        day7: '7 дней',
        day14: '14 дней',
        day30: '30 дней',
        month3: '90 дней',
        year1: '365 дней',
        totalPlaytime: 'Всего наиграно',
        topGame: 'Топ игра',
        hours: 'ч',
        minutes: 'мин',
    },
} as const;



export default function ActivitiesPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [period, setPeriod] = usePersistentPeriod('7d');
    const { data, loading, refresh } = useStats({ guildId, type: 'activities', period });
    const [syncing, setSyncing] = useState(false);

    const formatSeconds = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}\u00A0${text.hours} ${m}\u00A0${text.minutes}`;
        return `${m}\u00A0${text.minutes}`;
    };

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

    const topActivities = data?.topActivities || [];

    // Aggregates
    const totalSeconds = topActivities.reduce((acc: number, curr: any) => acc + curr.seconds, 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const topGameName = topActivities.length > 0 ? topActivities[0].name : '-';



    return (
        <div className="p-6 space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                    <GameController size={32} weight="fill" className="text-cyan-500 drop-shadow-lg" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{text.title}</h1>
                    <p className="text-default-400 font-medium">{text.subtitle}</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatsCard
                    title={text.totalPlaytime}
                    value={`${totalHours}\u00A0${text.hours}`}
                    icon={<Clock size={24} weight="fill" />}
                    loading={loading}
                    className="border-cyan-500/20"
                />
                <StatsCard
                    title={text.topGame}
                    value={topGameName}
                    icon={<Trophy size={24} weight="fill" />}
                    loading={loading}
                    className="border-amber-500/20"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6">
                <ChartContainer title={text.topActivities} loading={loading} height={isMobile ? 'auto' : 500}>
                    <div className="flex flex-col-reverse lg:flex-row gap-8 h-full">
                        {/* List Section */}
                        <div className="w-full lg:flex-1 h-auto lg:h-full lg:overflow-y-auto pr-2 pl-2 custom-scrollbar">
                            <div className="space-y-4 lg:space-y-6">
                                {topActivities.slice(0, isMobile ? 10 : undefined).map((activity: any, i: number) => {
                                    const maxVal = topActivities[0]?.seconds || 1;
                                    const hours = Math.floor(activity.seconds / 3600);
                                    const mins = Math.floor((activity.seconds % 3600) / 60);
                                    const color = COLORS[i % COLORS.length];

                                    return (
                                        <div key={i} className="group overflow-visible">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
                                                    <div
                                                        className="w-6 h-6 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center text-xs lg:text-sm font-bold text-white shadow-lg transition-transform group-hover:scale-110 flex-shrink-0"
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm lg:text-lg text-white group-hover:text-cyan-400 transition-colors truncate">
                                                            {activity.name}
                                                        </div>
                                                        <div className="text-xs text-default-400 font-mono">
                                                            {hours}\u00A0{text.hours} {mins}\u00A0{text.minutes}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right ml-4">
                                                    <span
                                                        className="text-lg lg:text-2xl font-black transition-colors"
                                                        style={{ color: `${color}aa` }}
                                                    >
                                                        {Math.round((activity.seconds / totalSeconds) * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 lg:h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500 ease-out"
                                                    style={{
                                                        width: `${(activity.seconds / maxVal) * 100}%`,
                                                        backgroundColor: color
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="w-full lg:w-[500px] h-[300px] lg:h-auto flex-shrink-0 flex items-center justify-center relative">
                            {/* Decorative background glow */}
                            <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full transform scale-75 pointer-events-none" />

                            <StatsTopWidget
                                title={text.activityDistribution}
                                data={topActivities.map((act: any) => ({
                                    id: act.name,
                                    name: act.name,
                                    value: act.seconds,
                                }))}
                                type="pie"
                                valueFormatter={formatSeconds}
                                totalValue={totalSeconds}
                                locale={locale}
                                icon={<Clock size={20} />}
                                hideLegend
                                hideHeader
                                hideControls
                                largeText={!isMobile}
                                className="bg-transparent border-none shadow-none w-full h-full"
                                pieRadius={isMobile ? [60, 90] : [110, 150]}
                            />
                        </div>
                    </div>
                </ChartContainer>
            </div>
        </div>
    );
}
