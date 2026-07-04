'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import {
    UsersThree,
    UserPlus,
    UserMinus,
    TrendUp,
    TrendDown
} from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";
import { useStats } from "@/hooks/useStats";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { formatLocaleNumber, formatYAxis } from "@/lib/utils";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { ChartTooltip } from "@/components/stats/ChartTooltip";
import { StatsPageHeader, StatsPageShell } from "@/components/stats/StatsPageScaffold";
import { StatsExportMenu } from "@/components/stats/StatsExportMenu";
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
        joined: 'Joined',
        leftLabel: 'Left',
    },
    ru: {
        title: '\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438',
        subtitle: '\u0410\u043d\u0430\u043b\u0438\u0437 \u0440\u043e\u0441\u0442\u0430 \u0438 \u0443\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u044f',
        memberGrowth: '\u0420\u043e\u0441\u0442 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432',
        joinLeave: '\u0412\u0445\u043e\u0434\u044b \u0438 \u0432\u044b\u0445\u043e\u0434\u044b',
        totalMembers: '\u0412\u0441\u0435\u0433\u043e \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432',
        newMembers: '\u041d\u043e\u0432\u044b\u0435 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438',
        membersLeft: '\u0412\u044b\u0448\u043b\u0438',
        period: '\u041f\u0435\u0440\u0438\u043e\u0434',
        day1: '24 \u0447\u0430\u0441\u0430',
        day3: '3 \u0434\u043d\u044f',
        day7: '7 \u0434\u043d\u0435\u0439',
        day14: '14 \u0434\u043d\u0435\u0439',
        day30: '30 \u0434\u043d\u0435\u0439',
        month3: '90 \u0434\u043d\u0435\u0439',
        year1: '365 \u0434\u043d\u0435\u0439',
        netChange: '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435',
        joined: '\u0412\u0441\u0442\u0443\u043f\u0438\u043b\u0438',
        leftLabel: '\u0412\u044b\u0448\u043b\u0438',
    },
} as const;

export default function MembersPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    // Default to 30d for trends
    const [period] = usePersistentPeriod('7d');
    const { data, loading } = useStats({ guildId, type: 'members', period });

    const growthData = data?.growthChart || [];
    const joinLeaveData = data?.joinLeaveChart || [];
    const stats = data?.stats || { total: 0, new: 0, left: 0 };

    const netChange = stats.new - stats.left;
    const isNetPositive = netChange >= 0;

    const joinedTrend = (stats as any).joinedTrend ?? 0;
    const leftTrend = (stats as any).leftTrend ?? 0;
    const netTrend = (stats as any).netTrend ?? 0;

    return (
        <StatsPageShell>
            <StatsPageHeader
                title={text.title}
                subtitle={text.subtitle}
                icon={<UsersThree size={26} weight="fill" />}
                iconClassName="text-success"
                actions={
                    <StatsExportMenu
                        locale={locale}
                        period={period}
                        filenamePrefix="members"
                        data={data}
                        chart={{
                            title: text.memberGrowth,
                            labels: growthData.map((d: any) => d.date),
                            series: [
                                { name: text.totalMembers, color: '#10B981', values: growthData.map((d: any) => d.count) },
                            ],
                        }}
                    />
                }
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 lg:gap-6">
                <StatsCard
                    title={text.totalMembers}
                    value={formatLocaleNumber(stats.total, locale)}
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
                    className={isNetPositive ? "border-success/20" : "border-danger/20"}
                    loading={loading}
                    trend={{ value: Math.abs(netTrend), isPositive: isNetPositive }}
                />
            </div>

            {/* Growth & Activity Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
                <ChartContainer title={text.memberGrowth} loading={loading} height={380}>
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
                                cursor={{ stroke: 'rgba(244,241,238,0.1)', strokeWidth: 2 }}
                                content={(props: any) => (
                                    <ChartTooltip
                                        {...props}
                                        locale={locale}
                                        order={['count']}
                                        colorOverrides={{ count: '#10B981' }}
                                    />
                                )}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="#10B981"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#growthColor)"
                                activeDot={{ r: 6, stroke: '#f4f1ee', strokeWidth: 2 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title={text.joinLeave} loading={loading} height={380}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={joinLeaveData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => formatYAxis(v, locale as 'ru' | 'en')} />
                            <RechartsTooltip
                                cursor={{ fill: 'rgba(244,241,238,0.05)' }}
                                content={(props: any) => (
                                    <ChartTooltip
                                        {...props}
                                        locale={locale}
                                        order={['joined', 'left']}
                                        colorOverrides={{ joined: '#10B981', left: '#F43F5E' }}
                                    />
                                )}
                            />
                            <Legend />
                            <Bar dataKey="joined" name={text.joined} fill="#10B981" radius={[12, 12, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="left" name={text.leftLabel} fill="#F43F5E" radius={[12, 12, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>
        </StatsPageShell>
    );
}


