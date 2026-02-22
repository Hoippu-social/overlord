'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    Button, Input, Card, CardBody, Chip, Skeleton, Avatar, Select, SelectItem,
    Tabs, Tab, ButtonGroup
} from "@nextui-org/react";
import {
    MagnifyingGlass, Hash, SpeakerHigh, MessengerLogo, UserCircle,
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
        title: 'About User',
        subtitle: 'Deep analysis of individual users',
        searchPlaceholder: 'Search for a user...',
        overview: 'Overview',
        messages: 'Messages',
        voice: 'Voice',
        totalMessages: 'Messages',
        avgPerDay: 'Avg / Day',
        uniqueChannels: 'Unique Channels',
        totalVoice: 'Voice Time',
        voiceSessions: 'Voice Sessions',
        topChannel: 'Top Channel',
        mostRecent: 'Most Recent',
        recentChannel: 'Recent Channel',
        channelBreakdown: 'Channel Breakdown',
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
        noData: 'No data for this user',
        selectUser: 'Search for a user to see detailed statistics',
        msgs: 'msgs',
    },
    ru: {
        title: 'О пользователе',
        subtitle: 'Глубокий анализ отдельных пользователей',
        searchPlaceholder: 'Искать пользователя...',
        overview: 'Обзор',
        messages: 'Сообщения',
        voice: 'Голос',
        totalMessages: 'Сообщений',
        avgPerDay: 'Среднее / День',
        uniqueChannels: 'Уник. каналов',
        totalVoice: 'Время в голосе',
        voiceSessions: 'Голос. сессий',
        topChannel: 'Топ канал',
        mostRecent: 'Последняя активность',
        recentChannel: 'Последний канал',
        channelBreakdown: 'Распределение по каналам',
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
        noData: 'Нет данных по этому пользователю',
        selectUser: 'Найдите пользователя для просмотра подробной статистики',
        msgs: 'сообщ.',
    },
} as const;

const PIE_COLORS = [
    '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#6b7280',
    '#ec4899', '#f97316', '#06b6d4', '#ef4444', '#84cc16'
];

interface UserItem {
    userId: string;
    name: string;
    username?: string;
    tag?: string;
    avatar: string | null;
    messages: number;
    voiceSessions: number;
    voiceSeconds: number;
}

export default function UserDrilldownPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<UserItem[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState('');
    const [selectedUserAvatar, setSelectedUserAvatar] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [period, setPeriod] = useState('30d');
    const [drilldownData, setDrilldownData] = useState<any>(null);
    const [loadingDrilldown, setLoadingDrilldown] = useState(false);
    const [pieTopN, setPieTopN] = useState(10);
    const [allUsers, setAllUsers] = useState<UserItem[]>([]);
    const [usersFetched, setUsersFetched] = useState(false);

    // Fetch all users once (lazy — on first search interaction)
    const ensureUsersLoaded = useCallback(async () => {
        if (usersFetched) return;
        setLoadingSearch(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/stats/users?period=${period}`);
            const data = await res.json();
            setAllUsers(data.users || []);
            setUsersFetched(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSearch(false);
        }
    }, [guildId, period, usersFetched]);

    // Reset cache when period changes
    useEffect(() => {
        setUsersFetched(false);
        setAllUsers([]);
    }, [period]);

    // Filter users locally when search changes
    useEffect(() => {
        if (!search.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }
        const q = search.toLowerCase();
        const filtered = allUsers.filter(u =>
            u.name.toLowerCase().includes(q) ||
            (u.username || '').toLowerCase().includes(q) ||
            (u.tag || '').toLowerCase().includes(q) ||
            u.userId.includes(q)
        );
        setSearchResults(filtered);
        setShowResults(true);
    }, [search, allUsers]);

    // Fetch drilldown data
    useEffect(() => {
        if (!selectedUser) {
            setDrilldownData(null);
            return;
        }
        setLoadingDrilldown(true);
        fetch(`/api/guilds/${guildId}/stats/users?userId=${selectedUser}&tab=${activeTab}&period=${period}`)
            .then(r => r.json())
            .then(data => setDrilldownData(data))
            .catch(console.error)
            .finally(() => setLoadingDrilldown(false));
    }, [guildId, selectedUser, activeTab, period]);

    const selectUser = useCallback((u: UserItem) => {
        setSelectedUser(u.userId);
        setSelectedUserName(u.name);
        setSelectedUserAvatar(u.avatar);
        setActiveTab('overview');
        setSearch('');
        setShowResults(false);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedUser(null);
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
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                        <UserCircle size={32} weight="fill" className="text-violet-500 drop-shadow-lg" />
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
                        ensureUsersLoaded();
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
                                <UserCircle size={32} className="text-default-300 mx-auto mb-2" />
                                <p className="text-default-400 text-sm">{text.noData}</p>
                            </div>
                        ) : (
                            searchResults.map((u) => (
                                <button
                                    key={u.userId}
                                    onClick={() => selectUser(u)}
                                    className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-violet-500/10 transition-colors cursor-pointer border-b border-white/[0.03] last:border-b-0"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar
                                            src={u.avatar || undefined}
                                            name={u.name}
                                            size="sm"
                                            className="w-8 h-8 flex-shrink-0"
                                        />
                                        <div className="min-w-0 text-left">
                                            <p className="text-white font-semibold text-sm truncate">{u.name}</p>
                                            <p className="text-xs text-default-400 font-mono">{u.tag || u.userId}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {u.messages > 0 && (
                                            <div className="flex items-center gap-1 text-default-400">
                                                <MessengerLogo size={14} weight="fill" className="text-violet-400" />
                                                <span className="text-xs font-semibold text-white">{u.messages.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {u.voiceSeconds > 0 && (
                                            <div className="flex items-center gap-1 text-default-400">
                                                <SpeakerHigh size={14} weight="fill" className="text-orange-400" />
                                                <span className="text-xs font-semibold text-white">{formatDuration(u.voiceSeconds)}</span>
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

            {/* Selected User Chip */}
            {selectedUser && (
                <div className="flex items-center gap-3 flex-wrap">
                    <Chip
                        size="lg"
                        variant="flat"
                        classNames={{
                            base: "bg-violet-500/10 border border-violet-500/20 px-4 py-5",
                            content: "text-white font-bold text-base"
                        }}
                        avatar={
                            <Avatar
                                src={selectedUserAvatar || undefined}
                                name={selectedUserName}
                                size="sm"
                            />
                        }
                        onClose={clearSelection}
                    >
                        {selectedUserName}
                    </Chip>
                </div>
            )}

            {/* DRILLDOWN VIEW */}
            {selectedUser ? (
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
                                    <MessengerLogo size={18} weight="fill" />
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
                                    title={text.uniqueChannels}
                                    value={drilldownData?.overview?.uniqueMessageChannels?.toLocaleString() ?? '—'}
                                    icon={<Hash size={24} weight="bold" />}
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
                                    title={text.uniqueChannels}
                                    subValue="(voice)"
                                    value={drilldownData?.overview?.uniqueVoiceChannels?.toLocaleString() ?? '—'}
                                    icon={<MicrophoneStage size={24} weight="fill" />}
                                    loading={loadingDrilldown}
                                />
                            </div>

                            {/* Bottom info cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Top Message Channel */}
                                <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.topChannel} (msgs)</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.topMessageChannel ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0">
                                                        <Hash size={16} className="text-cyan-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-white font-bold truncate">{drilldownData.overview.topMessageChannel.name}</p>
                                                        <p className="text-xs text-default-400">{drilldownData.overview.topMessageChannel.value.toLocaleString()} {text.msgs}</p>
                                                    </div>
                                                </div>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Top Voice Channel */}
                                <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.topChannel} (voice)</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.topVoiceChannel ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/10 flex items-center justify-center flex-shrink-0">
                                                        <SpeakerHigh size={16} className="text-orange-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-white font-bold truncate">{drilldownData.overview.topVoiceChannel.name}</p>
                                                        <p className="text-xs text-default-400">{formatDuration(drilldownData.overview.topVoiceChannel.value)}</p>
                                                    </div>
                                                </div>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Most Recent Message */}
                                <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.mostRecent} (msg)</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.mostRecentMessage ? (
                                                <div>
                                                    <p className="text-white font-bold">{new Date(drilldownData.overview.mostRecentMessage.date).toLocaleDateString()}</p>
                                                    <p className="text-xs text-default-400">#{drilldownData.overview.mostRecentMessage.channelName} · {timeAgo(drilldownData.overview.mostRecentMessage.date)}</p>
                                                </div>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Most Recent Voice */}
                                <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.mostRecent} (voice)</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.mostRecentVoice ? (
                                                <div>
                                                    <p className="text-white font-bold">{new Date(drilldownData.overview.mostRecentVoice.date).toLocaleDateString()}</p>
                                                    <p className="text-xs text-default-400">#{drilldownData.overview.mostRecentVoice.channelName} · {timeAgo(drilldownData.overview.mostRecentVoice.date)}</p>
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
                                            <linearGradient id="userBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
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
                                        <Bar dataKey="messages" fill="url(#userBarGradient)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>

                            {/* Channel Breakdown */}
                            <ChannelBreakdownSection
                                channels={drilldownData?.channels || []}
                                totalValue={drilldownData?.totalMessages || 0}
                                valueKey="messages"
                                valueLabel={text.msgs}
                                loading={loadingDrilldown}
                                title={text.channelBreakdown}
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
                                            <linearGradient id="userVoiceAreaGrad" x1="0" y1="0" x2="0" y2="1">
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
                                        <Area type="monotone" dataKey="voiceMinutes" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#userVoiceAreaGrad)" activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartContainer>

                            {/* Channel Breakdown */}
                            <ChannelBreakdownSection
                                channels={(drilldownData?.channels || []).map((c: any) => ({ ...c, messages: c.voiceSeconds }))}
                                totalValue={drilldownData?.totalSeconds || 0}
                                valueKey="messages"
                                valueLabel={text.minutes}
                                loading={loadingDrilldown}
                                title={text.channelBreakdown}
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
                /* Empty state — no user selected */
                !showResults && (
                    <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
                        <CardBody className="p-16 text-center">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/10 flex items-center justify-center mx-auto mb-6">
                                <MagnifyingGlass size={40} className="text-violet-500/50" />
                            </div>
                            <p className="text-default-400 font-medium text-lg">{text.selectUser}</p>
                        </CardBody>
                    </Card>
                )
            )}
        </div>
    );
}


// --- Channel Breakdown Sub-component ---
interface ChannelBreakdownProps {
    channels: any[];
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

function ChannelBreakdownSection({
    channels, totalValue, valueKey, valueLabel, loading, title,
    nameLabel, countLabel, percentLabel, pieTopN, setPieTopN, formatValue
}: ChannelBreakdownProps) {
    const pieData = useMemo(() => {
        const top = channels.slice(0, pieTopN);
        const otherValue = channels.slice(pieTopN).reduce((sum: number, c: any) => sum + (c[valueKey] || 0), 0);
        const result = top.map((c: any) => ({
            name: c.name,
            value: c[valueKey] || 0
        }));
        if (otherValue > 0) {
            result.push({ name: 'Other', value: otherValue });
        }
        return result;
    }, [channels, pieTopN, valueKey]);

    if (loading) {
        return <Skeleton className="h-80 w-full rounded-2xl" />;
    }

    if (!channels.length) return null;

    return (
        <Card className="bg-[#18181b]/60 border border-white/5 backdrop-blur-md">
            <CardBody className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Hash size={22} weight="bold" className="text-primary" />
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
                                {channels.slice(0, 15).map((c: any, i: number) => (
                                    <tr key={c.channelId || i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                                        <td className="py-2.5 text-default-400 text-sm font-medium">{c.rank || i + 1}</td>
                                        <td className="py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-6 h-6 rounded bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                                                    <Hash size={12} className="text-cyan-400" />
                                                </div>
                                                <span className="text-white text-sm font-medium truncate max-w-[180px]">{c.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 text-right text-white text-sm font-bold">
                                            {formatValue ? formatValue(c[valueKey]) : c[valueKey]?.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 text-right text-default-400 text-sm">{c.percentage}%</td>
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
