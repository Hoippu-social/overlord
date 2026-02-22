'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    Button, Input, Card, CardBody, Chip, Skeleton, Avatar, Select, SelectItem,
    Tabs, Tab, ButtonGroup
} from "@nextui-org/react";
import {
    MagnifyingGlass, Hash, SpeakerHigh, MessengerLogo, Users,
    CalendarCheck, Clock, ChartBar, ArrowRight, MicrophoneStage
} from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import {
    BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const strings = {
    en: {
        title: 'About Channel',
        subtitle: 'Deep analysis of individual channels',
        searchPlaceholder: 'Search for a channel...',
        overview: 'Overview',
        messages: 'Messages',
        voice: 'Voice',
        totalMessages: 'Messages',
        avgPerDay: 'Avg / Day',
        uniqueMembers: 'Unique Members',
        totalVoice: 'Voice Time',
        voiceSessions: 'Voice Sessions',
        topMember: 'Top Member',
        mostRecent: 'Most Recent',
        recentMember: 'Recent Member',
        memberBreakdown: 'Member Breakdown',
        name: 'Name',
        count: 'Count',
        percentage: '%',
        msgsByDay: 'Messages by Day',
        voiceByDay: 'Voice by Day',
        period: 'Period',
        day7: '7 Days',
        day30: '30 Days',
        day90: '90 Days',
        day365: '365 Days',
        minutes: 'min',
        hours: 'h',
        noData: 'No data for this channel',
        selectChannel: 'Select a channel to see detailed statistics',
        msgs: 'msgs',

    },
    ru: {
        title: 'О канале',
        subtitle: 'Глубокий анализ отдельных каналов',
        searchPlaceholder: 'Искать канал...',
        overview: 'Обзор',
        messages: 'Сообщения',
        voice: 'Голос',
        totalMessages: 'Сообщений',
        avgPerDay: 'Среднее / День',
        uniqueMembers: 'Уник. участников',
        totalVoice: 'Время в голосе',
        voiceSessions: 'Голос. сессий',
        topMember: 'Топ участник',
        mostRecent: 'Последняя активность',
        recentMember: 'Последний участник',
        memberBreakdown: 'Распределение участников',
        name: 'Имя',
        count: 'Кол-во',
        percentage: '%',
        msgsByDay: 'Сообщения по дням',
        voiceByDay: 'Голос по дням',
        period: 'Период',
        day7: '7 дней',
        day30: '30 дней',
        day90: '90 дней',
        day365: '365 дней',
        minutes: 'мин',
        hours: 'ч',
        noData: 'Нет данных по этому каналу',
        selectChannel: 'Выберите канал для просмотра подробной статистики',
        msgs: 'сообщ.',

    },
} as const;

const PIE_COLORS = [
    '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#6b7280',
    '#ec4899', '#f97316', '#06b6d4', '#ef4444', '#84cc16'
];

interface ChannelItem {
    channelId: string;
    name: string;
    type: string;
    messages: number;
    voiceSessions: number;
    voiceSeconds: number;
}

export default function ChannelDrilldownPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<ChannelItem[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [selectedChannelName, setSelectedChannelName] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [period, setPeriod] = useState('30d');
    const [drilldownData, setDrilldownData] = useState<any>(null);
    const [loadingDrilldown, setLoadingDrilldown] = useState(false);
    const [pieTopN, setPieTopN] = useState(10);
    const [allChannels, setAllChannels] = useState<ChannelItem[]>([]);
    const [channelsFetched, setChannelsFetched] = useState(false);

    // Fetch all channels once (lazy — on first search interaction)
    const ensureChannelsLoaded = useCallback(async () => {
        if (channelsFetched) return;
        setLoadingSearch(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/stats/channels?period=${period}`);
            const data = await res.json();
            setAllChannels(data.channels || []);
            setChannelsFetched(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSearch(false);
        }
    }, [guildId, period, channelsFetched]);

    // Reset cache when period changes
    useEffect(() => {
        setChannelsFetched(false);
        setAllChannels([]);
    }, [period]);

    // Filter channels locally when search changes
    useEffect(() => {
        if (!search.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }
        const q = search.toLowerCase();
        const filtered = allChannels.filter(c =>
            c.name.toLowerCase().includes(q) || c.channelId.includes(q)
        );
        setSearchResults(filtered);
        setShowResults(true);
    }, [search, allChannels]);

    // Fetch drilldown data
    useEffect(() => {
        if (!selectedChannel) {
            setDrilldownData(null);
            return;
        }
        setLoadingDrilldown(true);
        fetch(`/api/guilds/${guildId}/stats/channels?channelId=${selectedChannel}&tab=${activeTab}&period=${period}`)
            .then(r => r.json())
            .then(data => setDrilldownData(data))
            .catch(console.error)
            .finally(() => setLoadingDrilldown(false));
    }, [guildId, selectedChannel, activeTab, period]);

    const selectChannel = useCallback((ch: ChannelItem) => {
        setSelectedChannel(ch.channelId);
        setSelectedChannelName(ch.name);
        setActiveTab('overview');
        setSearch('');
        setShowResults(false);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedChannel(null);
        setDrilldownData(null);
    }, []);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}${text.hours} ${m}${text.minutes}`;
        return `${m} ${text.minutes}`;
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins} min ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    // --- RENDER ---
    return (
        <div className="p-6 space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                        <Hash size={32} weight="fill" className="text-cyan-500 drop-shadow-lg" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">{text.title}</h1>
                        <p className="text-default-400 font-medium">{text.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-[#18181b]/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md w-full md:w-auto">
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
                        <SelectItem key="7d">{text.day7}</SelectItem>
                        <SelectItem key="30d">{text.day30}</SelectItem>
                        <SelectItem key="90d">{text.day90}</SelectItem>
                        <SelectItem key="365d">{text.day365}</SelectItem>
                    </Select>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Input
                    placeholder={text.searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => {
                        ensureChannelsLoaded();
                        if (search.trim()) setShowResults(true);
                    }}
                    startContent={<MagnifyingGlass size={20} className="text-default-400" />}
                    classNames={{
                        inputWrapper: "bg-[#18181b]/60 border border-white/5 hover:border-white/10 data-[focused=true]:border-primary/50 backdrop-blur-md h-12",
                        input: "text-white"
                    }}
                    isClearable
                    onClear={() => { setSearch(''); setShowResults(false); }}
                />

                {/* Search Results Dropdown */}
                {showResults && search.trim() && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-[#18181b]/95 border border-white/10 backdrop-blur-xl shadow-2xl">
                        {loadingSearch ? (
                            <div className="p-4 space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="p-6 text-center">
                                <Hash size={32} className="text-default-300 mx-auto mb-2" />
                                <p className="text-default-400 text-sm">{text.noData}</p>
                            </div>
                        ) : (
                            searchResults.map((ch) => (
                                <button
                                    key={ch.channelId}
                                    onClick={() => selectChannel(ch)}
                                    className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-cyan-500/10 transition-colors cursor-pointer border-b border-white/[0.03] last:border-b-0"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0">
                                            <Hash size={16} className="text-cyan-400" />
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <p className="text-white font-semibold text-sm truncate">{ch.name}</p>
                                            <p className="text-xs text-default-400 font-mono">{ch.channelId}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {ch.messages > 0 && (
                                            <div className="flex items-center gap-1 text-default-400">
                                                <MessengerLogo size={14} weight="fill" className="text-violet-400" />
                                                <span className="text-xs font-semibold text-white">{ch.messages.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {ch.voiceSeconds > 0 && (
                                            <div className="flex items-center gap-1 text-default-400">
                                                <SpeakerHigh size={14} weight="fill" className="text-orange-400" />
                                                <span className="text-xs font-semibold text-white">{formatDuration(ch.voiceSeconds)}</span>
                                            </div>
                                        )}
                                        <ArrowRight size={14} className="text-default-300" />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Selected Channel Chip */}
            {selectedChannel && (
                <div className="flex items-center gap-3 flex-wrap">
                    <Chip
                        size="lg"
                        variant="flat"
                        classNames={{
                            base: "bg-cyan-500/10 border border-cyan-500/20 px-4 py-5",
                            content: "text-white font-bold text-base"
                        }}
                        startContent={<Hash size={18} className="text-cyan-400" />}
                        onClose={clearSelection}
                    >
                        {selectedChannelName}
                    </Chip>
                </div>
            )}

            {/* DRILLDOWN VIEW */}
            {selectedChannel ? (
                <div className="space-y-6">
                    {/* Tabs */}
                    <Tabs
                        selectedKey={activeTab}
                        onSelectionChange={(key) => setActiveTab(key as string)}
                        classNames={{
                            tabList: "bg-[#18181b]/60 border border-white/5 p-1 rounded-2xl backdrop-blur-md",
                            cursor: "bg-primary shadow-lg",
                            tab: "h-10 font-semibold",
                            tabContent: "group-data-[selected=true]:text-white text-default-400"
                        }}
                        variant="solid"
                        color="primary"
                    >
                        <Tab
                            key="overview"
                            title={
                                <div className="flex items-center gap-2">
                                    <ChartBar size={18} weight="fill" />
                                    <span>{text.overview}</span>
                                </div>
                            }
                        />
                        <Tab
                            key="messages"
                            title={
                                <div className="flex items-center gap-2">
                                    <Hash size={18} weight="bold" />
                                    <span>{text.messages}</span>
                                </div>
                            }
                        />
                        <Tab
                            key="voice"
                            title={
                                <div className="flex items-center gap-2">
                                    <SpeakerHigh size={18} weight="fill" />
                                    <span>{text.voice}</span>
                                </div>
                            }
                        />
                    </Tabs>

                    {/* TAB: Overview */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatsCard
                                    title={text.totalMessages}
                                    value={drilldownData?.overview?.totalMessages?.toLocaleString() ?? '—'}
                                    description={`${text.avgPerDay}: ${drilldownData?.overview?.avgMessagesPerDay ?? 0}`}
                                    icon={<MessengerLogo size={24} weight="fill" />}
                                    loading={loadingDrilldown}
                                />
                                <StatsCard
                                    title={text.uniqueMembers}
                                    value={drilldownData?.overview?.uniqueMessageMembers?.toLocaleString() ?? '—'}
                                    icon={<Users size={24} weight="fill" />}
                                    loading={loadingDrilldown}
                                />
                                <StatsCard
                                    title={text.totalVoice}
                                    value={drilldownData?.overview ? formatDuration(drilldownData.overview.totalVoiceSeconds) : '—'}
                                    description={`${drilldownData?.overview?.voiceSessions ?? 0} ${text.voiceSessions}`}
                                    icon={<Clock size={24} weight="fill" />}
                                    loading={loadingDrilldown}
                                />
                                <StatsCard
                                    title={text.uniqueMembers}
                                    subValue="(voice)"
                                    value={drilldownData?.overview?.uniqueVoiceMembers?.toLocaleString() ?? '—'}
                                    icon={<MicrophoneStage size={24} weight="fill" />}
                                    loading={loadingDrilldown}
                                />
                            </div>

                            {/* Bottom info cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Top Message Member */}
                                <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.topMember} (msgs)</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.topMessageMember ? (
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        src={drilldownData.overview.topMessageMember.avatar}
                                                        name={drilldownData.overview.topMessageMember.name}
                                                        size="sm"
                                                        className="flex-shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-white font-bold truncate">{drilldownData.overview.topMessageMember.name}</p>
                                                        <p className="text-xs text-default-400">{drilldownData.overview.topMessageMember.value.toLocaleString()} {text.msgs}</p>
                                                    </div>
                                                </div>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Top Voice Member */}
                                <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.topMember} (voice)</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.topVoiceMember ? (
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        src={drilldownData.overview.topVoiceMember.avatar}
                                                        name={drilldownData.overview.topVoiceMember.name}
                                                        size="sm"
                                                        className="flex-shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-white font-bold truncate">{drilldownData.overview.topVoiceMember.name}</p>
                                                        <p className="text-xs text-default-400">{formatDuration(drilldownData.overview.topVoiceMember.value)}</p>
                                                    </div>
                                                </div>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Most Recent */}
                                <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.mostRecent}</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.mostRecentMessage ? (
                                                <div>
                                                    <p className="text-white font-bold">{new Date(drilldownData.overview.mostRecentMessage.date).toLocaleDateString()}</p>
                                                    <p className="text-xs text-default-400">{timeAgo(drilldownData.overview.mostRecentMessage.date)}</p>
                                                </div>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Recent Member */}
                                <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.recentMember}</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.mostRecentMessage ? (
                                                <div>
                                                    <p className="text-white font-bold">{drilldownData.overview.mostRecentMessage.name}</p>
                                                    <p className="text-xs text-default-400">ID: {drilldownData.overview.mostRecentMessage.userId}</p>
                                                </div>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* TAB: Messages */}
                    {activeTab === 'messages' && (
                        <div className="space-y-6">
                            <ChartContainer title={text.msgsByDay} loading={loadingDrilldown} height={300}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={drilldownData?.chart || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.3} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                        <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                                        <RechartsTooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                                backdropFilter: 'blur(8px)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '12px',
                                            }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Bar dataKey="messages" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>

                            {/* Member Breakdown */}
                            <MemberBreakdownSection
                                members={drilldownData?.members || []}
                                totalValue={drilldownData?.totalMessages || 0}
                                valueKey="messages"
                                valueLabel={text.msgs}
                                loading={loadingDrilldown}
                                title={text.memberBreakdown}
                                nameLabel={text.name}
                                countLabel={text.count}
                                percentLabel={text.percentage}
                                pieTopN={pieTopN}
                                setPieTopN={setPieTopN}
                            />
                        </div>
                    )}

                    {/* TAB: Voice */}
                    {activeTab === 'voice' && (
                        <div className="space-y-6">
                            <ChartContainer title={text.voiceByDay} loading={loadingDrilldown} height={300}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={drilldownData?.chart || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="voiceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                        <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis
                                            stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dx={-10}
                                            tickFormatter={(v) => `${v}m`}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                                backdropFilter: 'blur(8px)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '12px',
                                            }}
                                            itemStyle={{ color: '#fff' }}
                                            formatter={(val: number) => [`${val} min`, 'Voice']}
                                        />
                                        <Area type="monotone" dataKey="voiceMinutes" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#voiceAreaGrad)" activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartContainer>

                            {/* Member Breakdown */}
                            <MemberBreakdownSection
                                members={(drilldownData?.members || []).map((m: any) => ({ ...m, messages: m.voiceSeconds }))}
                                totalValue={drilldownData?.totalSeconds || 0}
                                valueKey="messages"
                                valueLabel={text.minutes}
                                loading={loadingDrilldown}
                                title={text.memberBreakdown}
                                nameLabel={text.name}
                                countLabel={text.totalVoice}
                                percentLabel={text.percentage}
                                pieTopN={pieTopN}
                                setPieTopN={setPieTopN}
                                formatValue={(v: number) => formatDuration(v)}
                            />
                        </div>
                    )}
                </div>
            ) : (
                /* Empty state — no channel selected */
                !showResults && (
                    <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                        <CardBody className="p-16 text-center">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/10 flex items-center justify-center mx-auto mb-6">
                                <MagnifyingGlass size={40} className="text-cyan-500/50" />
                            </div>
                            <p className="text-default-400 font-medium text-lg">{text.selectChannel}</p>
                        </CardBody>
                    </Card>
                )
            )}
        </div>
    );
}


// --- Member Breakdown Sub-component ---
interface MemberBreakdownProps {
    members: any[];
    totalValue: number;
    valueKey: string;
    valueLabel: string;
    loading: boolean;
    title: string;
    nameLabel: string;
    countLabel: string;
    percentLabel: string;
    pieTopN: number;
    setPieTopN: (n: number) => void;
    formatValue?: (v: number) => string;
}

function MemberBreakdownSection({
    members, totalValue, valueKey, valueLabel, loading, title,
    nameLabel, countLabel, percentLabel, pieTopN, setPieTopN, formatValue
}: MemberBreakdownProps) {
    const pieData = useMemo(() => {
        const top = members.slice(0, pieTopN);
        const otherValue = members.slice(pieTopN).reduce((sum: number, m: any) => sum + (m[valueKey] || 0), 0);
        const result = top.map((m: any) => ({
            name: m.name,
            value: m[valueKey] || 0
        }));
        if (otherValue > 0) {
            result.push({ name: 'Other', value: otherValue });
        }
        return result;
    }, [members, pieTopN, valueKey]);

    if (loading) {
        return <Skeleton className="h-80 w-full rounded-2xl" />;
    }

    if (!members.length) return null;

    return (
        <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
            <CardBody className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Users size={22} weight="fill" className="text-primary" />
                        <h2 className="text-lg font-bold text-white">{title}</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left text-xs text-default-400 font-semibold pb-3 w-8">#</th>
                                    <th className="text-left text-xs text-default-400 font-semibold pb-3">{nameLabel}</th>
                                    <th className="text-right text-xs text-default-400 font-semibold pb-3">{countLabel}</th>
                                    <th className="text-right text-xs text-default-400 font-semibold pb-3 w-16">{percentLabel}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.slice(0, 15).map((m: any, i: number) => (
                                    <tr key={m.userId || i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                                        <td className="py-2.5 text-default-400 text-sm font-medium">{m.rank || i + 1}</td>
                                        <td className="py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <Avatar
                                                    src={m.avatar}
                                                    name={m.name}
                                                    size="sm"
                                                    className="w-6 h-6 flex-shrink-0"
                                                />
                                                <span className="text-white text-sm font-medium truncate max-w-[180px]">{m.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 text-right text-white text-sm font-bold">
                                            {formatValue ? formatValue(m[valueKey]) : m[valueKey]?.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 text-right text-default-400 text-sm">{m.percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pie Chart */}
                    <div>
                        <div className="flex justify-end mb-4">
                            <ButtonGroup size="sm">
                                {[3, 5, 10].map(n => (
                                    <Button
                                        key={n}
                                        variant={pieTopN === n ? 'solid' : 'flat'}
                                        color={pieTopN === n ? 'primary' : 'default'}
                                        onPress={() => setPieTopN(n)}
                                        className={pieTopN === n ? '' : 'bg-transparent hover:bg-white/5'}
                                    >
                                        Top {n}
                                    </Button>
                                ))}
                            </ButtonGroup>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={110}
                                    paddingAngle={2}
                                    dataKey="value"
                                    nameKey="name"
                                    stroke="none"
                                >
                                    {pieData.map((_: any, i: number) => (
                                        <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Legend
                                    iconType="circle"
                                    wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }}
                                />
                                <RechartsTooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '12px',
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(val: number) => [formatValue ? formatValue(val) : val.toLocaleString(), '']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
