'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Select, SelectItem } from "@nextui-org/react";
import {
    UsersThree,
    UserPlus,
    UserMinus,
    ArrowsClockwise,
    CalendarCheck,
    TrendUp,
    TrendDown
} from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";
import { useStats } from "@/hooks/useStats";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { formatYAxis } from "@/lib/utils";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';



const strings = {
    en: {
        title: 'Members',
        subtitle: 'Growth & retention analysis',
        memberGrowth: 'Member Growth',
        joinLeave: 'Joins vs Leaves',
        totalMembers: 'Total Members',
        newMembers: 'New Members',
        membersLeft: 'Members Left',
        period: 'Period',
        day1: '24 Hours',
        day3: '3 Days',
        day7: '7 Days',
        day14: '14 Days',
        day30: '30 Days',
        month3: '90 Days',
        year1: '365 Days',
        netChange: 'Net Change',
    },
    ru: {
        title: 'Участники',
        subtitle: 'Анализ роста и удержания',
        memberGrowth: 'Рост участников',
        joinLeave: 'Входы и выходы',
        totalMembers: 'Всего участников',
        newMembers: 'Новые участники',
        membersLeft: 'Вышли',
        period: 'Период',
        day1: '24 часа',
        day3: '3 дня',
        day7: '7 дней',
        day14: '14 дней',
        day30: '30 дней',
        month3: '90 дней',
        year1: '365 дней',
        netChange: 'Изменение',
    },
} as const;

export default function MembersPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    // Default to 30d for trends
    const [period, setPeriod] = usePersistentPeriod('7d');
    const { data, loading, refresh } = useStats({ guildId, type: 'members', period });
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

    const growthData = data?.growthChart || [];
    const joinLeaveData = data?.joinLeaveChart || [];
    const stats = data?.stats || { total: 0, new: 0, left: 0 };

    const netChange = stats.new - stats.left;
    const isNetPositive = netChange >= 0;

    const joinedTrend = (stats as any).joinedTrend ?? 0;
    const leftTrend = (stats as any).leftTrend ?? 0;
    const netTrend = (stats as any).netTrend ?? 0;

    return (
        <div className="p-6 space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                        <UsersThree size={32} weight="fill" className="text-emerald-500 drop-shadow-lg" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title={text.totalMembers}
                    value={stats.total.toLocaleString()}
                    icon={<UsersThree size={24} weight="fill" />}
                    loading={loading}
                />
                <StatsCard
                    title={text.newMembers}
                    value={`+${stats.new}`}
                    icon={<UserPlus size={24} weight="fill" />}
                    loading={loading}
                    trend={{ value: Math.abs(joinedTrend), isPositive: joinedTrend >= 0 }}
                />
                <StatsCard
                    title={text.membersLeft}
                    value={`-${stats.left}`}
                    icon={<UserMinus size={24} weight="fill" />}
                    loading={loading}
                    trend={{ value: Math.abs(leftTrend), isPositive: leftTrend <= 0 }}
                />
                <StatsCard
                    title={text.netChange}
                    value={`${isNetPositive ? '+' : ''}${netChange}`}
                    icon={isNetPositive ? <TrendUp size={24} weight="bold" /> : <TrendDown size={24} weight="bold" />}
                    className={isNetPositive ? "border-emerald-500/20" : "border-rose-500/20"}
                    loading={loading}
                    trend={{ value: Math.abs(netTrend), isPositive: isNetPositive }}
                />
            </div>

            {/* Growth & Activity Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartContainer title={text.memberGrowth} loading={loading} height={400}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={growthData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="growthColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} width={55}
                                tickFormatter={(v) => formatYAxis(v, locale as 'ru' | 'en')}
                                domain={growthData.length > 0
                                    ? [Math.max(0, Math.min(...growthData.map((d: { count: number }) => d.count)) - 5), 'auto']
                                    : ['auto', 'auto']}
                            />
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
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="#10B981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#growthColor)"
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title={text.joinLeave} loading={loading} height={400}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={joinLeaveData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => formatYAxis(v, locale as 'ru' | 'en')} />
                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(24, 24, 27, 0.9)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Legend />
                            <Bar dataKey="joined" name="Joined" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="left" name="Left" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>
        </div>
    );
}
