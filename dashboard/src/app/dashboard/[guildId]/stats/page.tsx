'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';

import {
    ChatsTeardrop,
    MicrophoneStage,
    TrendDown,
    TrendUp,
} from "@phosphor-icons/react";

import { useStats } from "@/hooks/useStats";
import { useGuildLocale, useGuildTimezone } from "@/lib/i18n";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { formatLocaleNumber, formatYAxis } from "@/lib/utils";
import { buildStatsBucketLabels } from "@/lib/stats";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { ChartTooltip } from "@/components/stats/ChartTooltip";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';


const strings = {
    en: {
        title: 'Overview',
        subtitle: 'General server performance metrics',
        period: 'Period',
        day1: '24 Hours',
        day3: '3 Days',
        day7: '7 Days',
        day14: '14 Days',
        day30: '30 Days',
        month3: '90 Days',
        year1: '365 Days',
        messages: 'Messages',
        voice: 'Voice',
        members: 'Members',
        totalMessages: 'Total Messages',
        totalVoice: 'Voice Time',
        memberChange: 'Change',
        messagesDesc: 'sent in text channels',
        voiceDesc: 'spent in voice channels',
        memberChangeDesc: 'member count change for the period',
        synced: 'Synced',
        activityChart: 'Server Activity',
        activityChartDesc: 'Messages & Voice over time',
        minutes: 'min',
        hours: 'h',
    },
    ru: {
        title: 'Обзор',
        subtitle: 'Общие показатели эффективности сервера',
        period: 'Период',
        day1: '24 часа',
        day3: '3 дня',
        day7: '7 дней',
        day14: '14 дней',
        day30: '30 дней',
        month3: '90 дней',
        year1: '365 дней',
        messages: 'Сообщения',
        voice: 'Голос',
        members: 'Участники',
        totalMessages: 'Всего сообщений',
        totalVoice: 'Время в голосе',
        memberChange: 'Изменение',
        messagesDesc: 'отправлено в текстовых каналах',
        voiceDesc: 'проведено в голосовых каналах',
        memberChangeDesc: 'изменение числа участников за период',
        synced: 'Синхронизировано',
        activityChart: 'Активность сервера',
        activityChartDesc: 'Сообщения и голос за всё время',
        minutes: 'мин',
        hours: 'ч',
    },
} as const;


export default function StatsOverview() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const guildTimezone = useGuildTimezone(guildId);
    const text = strings[locale];

    const [period, setPeriod] = usePersistentPeriod('7d');

    const { data, loading } = useStats({ guildId, type: 'overview', period });

    const activityData = useMemo(() => {
        if (data?.activityData?.length) {
            return data.activityData;
        }

        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 6);

        return buildStatsBucketLabels(start, now, '7d', guildTimezone).map((date) => ({
            date,
            messages: 0,
            voice: 0,
        }));
    }, [data?.activityData, guildTimezone]);

    const cards = data?.cards || { totalMessages: 0, totalVoiceSeconds: 0, memberChange: 0 };
    const memberChange = Number(cards.memberChange || 0);
    const memberChangeLabel = memberChange > 0
        ? `+${formatLocaleNumber(memberChange, locale)}`
        : formatLocaleNumber(memberChange, locale);
    const isMemberChangePositive = memberChange >= 0;

    return (
        <div className="space-y-6 animate-fade-in">

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6">
                <StatsCard
                    title={text.totalMessages}
                    value={formatLocaleNumber(cards.totalMessages, locale)}
                    description={text.messagesDesc}
                    icon={<ChatsTeardrop size={20} weight="fill" />}
                    loading={loading}
                    accentColor="var(--color-primary-2)"
                />
                <StatsCard
                    title={text.totalVoice}
                    value={(() => {
                        const s = cards.totalVoiceSeconds || 0;
                        const h = Math.floor(s / 3600);
                        const m = Math.floor((s % 3600) / 60);
                        if (h > 0) return `${h}\u00A0${text.hours} ${m}\u00A0${text.minutes}`;
                        return `${m}\u00A0${text.minutes}`;
                    })()}
                    description={text.voiceDesc}
                    icon={<MicrophoneStage size={20} weight="fill" />}
                    loading={loading}
                    accentColor="var(--color-primary-1)"
                />
                <StatsCard
                    title={text.memberChange}
                    value={memberChangeLabel}
                    description={text.memberChangeDesc}
                    icon={isMemberChangePositive ? <TrendUp size={20} weight="fill" /> : <TrendDown size={20} weight="fill" />}
                    loading={loading}
                    accentColor={isMemberChangePositive ? "var(--color-success)" : "var(--color-danger)"}
                />
            </div>

            {/* Activity Chart */}
            <div className="px-6">
                <ChartContainer
                    title={text.activityChart}
                    subtitle={text.activityChartDesc}
                    loading={loading}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-primary-2)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--color-primary-2)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorVoice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-warning)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--color-warning)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-divider)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="var(--text-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="var(--text-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => formatYAxis(value, locale)}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="var(--text-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => {
                                    if (value >= 60) return `${formatYAxis(Math.floor(value / 60), locale as 'ru' | 'en')}\u00A0${text.hours}`;
                                    return `${formatYAxis(value, locale as 'ru' | 'en')}\u00A0${text.minutes}`;
                                }}
                            />
                            <Tooltip 
                                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                                content={(props: any) => (
                                    <ChartTooltip
                                        {...props}
                                        locale={locale}
                                        order={['messages', 'voice']}
                                        colorOverrides={{
                                            messages: 'var(--color-primary-2)',
                                            voice: 'var(--color-warning)'
                                        }}
                                        formatters={{
                                            voice: (v) => {
                                                const h = Math.floor(v / 60);
                                                const m = v % 60;
                                                if (h > 0) return `${h}\u00A0${text.hours} ${m}\u00A0${text.minutes}`;
                                                return `${m}\u00A0${text.minutes}`;
                                            }
                                        }}
                                    />
                                )}
                            />
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="messages"
                                name={text.messages}
                                stroke="var(--color-primary-2)"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorMessages)"
                            />
                            <Area
                                yAxisId="right"
                                type="monotone"
                                dataKey="voice"
                                name={text.voice}
                                stroke="var(--color-warning)"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorVoice)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>
        </div>
    );
}
