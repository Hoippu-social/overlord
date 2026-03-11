'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Button, Select, SelectItem } from "@nextui-org/react";
import {
    SquaresFour,
    ChatsTeardrop,
    MicrophoneStage,
    UsersThree,
    ArrowsClockwise,
    CalendarCheck,
    TrendUp
} from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";
import { useStats } from "@/hooks/useStats";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { formatYAxis } from "@/lib/utils";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { HistoricalSyncModal } from "@/components/stats/HistoricalSyncModal";
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
        custom: 'Custom Range...',
        messages: 'Messages',
        voice: 'Voice',
        members: 'Members',
        activity: 'Server Activity',
        totalMessages: 'Total Messages',
        totalVoice: 'Voice Time',
        newMembers: 'New Members',
        messagesDesc: 'sent in text channels',
        voiceDesc: 'spent in voice channels',
        membersDesc: 'joined the server',
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
        custom: 'Выбрать даты...',
        messages: 'Сообщения',
        voice: 'Голос',
        members: 'Участники',
        activity: 'Активность сервера',
        totalMessages: 'Всего сообщений',
        totalVoice: 'Время в голосе',
        newMembers: 'Новых участников',
        messagesDesc: 'отправлено в текстовых каналах',
        voiceDesc: 'проведено в голосовых каналах',
        membersDesc: 'присоединилось к серверу',
    },
} as const;

export default function StatsOverview() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    // Manage state via custom hook to persist in URL
    const [period, setPeriod] = usePersistentPeriod('7d');
    const [syncModalOpen, setSyncModalOpen] = React.useState(false);

    // Use the custom hook
    const { data, loading, refresh } = useStats({ guildId, type: 'overview', period });

    // Calculate days from period for historical sync
    const getDaysFromPeriod = (p: string): number => {
        if (p === '24h') return 1;
        if (p.endsWith('d')) return parseInt(p);
        return 30;
    };

    const activityData = (data?.activityData?.length ? data.activityData : Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
        const dd = d.getDate().toString().padStart(2, '0');
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = d.getFullYear();
        return {
            date: `${dd}.${mm}.${yyyy}`,
            messages: 0,
            voice: 0
        };
    }));
    const cards = data?.cards || { totalMessages: 0, totalVoice: 0, newMembers: 0 };

    return (
        <div className="p-6 space-y-6 min-h-screen bg-transparent">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                        <SquaresFour size={32} weight="fill" className="text-blue-500 drop-shadow-lg" />
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
                        onPress={() => setSyncModalOpen(true)}
                        className="bg-primary/10 text-primary w-10 h-10 flex-shrink-0"
                        title="Собрать исторические данные"
                    >
                        <ArrowsClockwise size={20} weight="bold" />
                    </Button>

                    <div className="h-6 w-px bg-white/10 mx-1" />

                    <Select
                        labelPlacement="outside"
                        selectedKeys={[period]}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="flex-1 md:w-40"
                        classNames={{
                            trigger: "bg-transparent shadow-none hover:bg-white/5 border-0 min-h-10 h-10 data-[focus=true]:bg-white/5 justify-between",
                            value: "text-small font-medium group-data-[has-value=true]:text-white",
                            popoverContent: "bg-[#18181b] border border-white/10 dark"
                        }}
                        aria-label={text.period}
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

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title={text.totalMessages}
                    value={cards.totalMessages.toLocaleString()}
                    description={text.messagesDesc}
                    icon={<ChatsTeardrop size={24} weight="fill" />}
                    loading={loading}
                // trend={{ value: 0, isPositive: true }}
                />

                <StatsCard
                    title={text.totalVoice}
                    value={`${Math.floor((cards.totalVoiceSeconds || 0) / 3600).toString().padStart(2, '0')}:${Math.floor(((cards.totalVoiceSeconds || 0) % 3600) / 60).toString().padStart(2, '0')}`}
                    description={text.voiceDesc}
                    icon={<MicrophoneStage size={24} weight="fill" />}
                    loading={loading}
                // trend={{ value: 0, isPositive: true }}
                />

                <StatsCard
                    title={text.newMembers}
                    value={`+${cards.newMembers}`}
                    description={text.membersDesc}
                    icon={<UsersThree size={24} weight="fill" />}
                    loading={loading}
                // trend={{ value: 0, isPositive: false }}
                />
            </div>

            {/* Main Chart */}
            <ChartContainer
                title={text.activity}
                subtitle={`${text.messages} & ${text.voice}`}
                loading={loading}
                height={400}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorVoice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F97316" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#52525b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            stroke="#52525b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            width={50}
                            tickFormatter={(value) => formatYAxis(value, locale as 'ru' | 'en')}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(24, 24, 27, 0.9)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                            }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="messages"
                            stroke="#8B5CF6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorMessages)"
                            name={text.messages}
                            activeDot={{ r: 6, strokeWidth: 0, fill: '#8B5CF6', stroke: '#fff' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="voice"
                            stroke="#F97316"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorVoice)"
                            name={text.voice}
                            activeDot={{ r: 6, strokeWidth: 0, fill: '#F97316', stroke: '#fff' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartContainer>

            {/* Historical Sync Modal */}
            <HistoricalSyncModal
                isOpen={syncModalOpen}
                onClose={() => {
                    setSyncModalOpen(false);
                    refresh(); // Refresh data after sync
                }}
                guildId={guildId}
                selectedDays={getDaysFromPeriod(period)}
            />
        </div>
    );
}
