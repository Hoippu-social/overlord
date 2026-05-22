'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    Button, Input, Card, CardBody, Chip, Skeleton, Avatar,
    Tabs, Tab, ButtonGroup
} from "@nextui-org/react";
import {
    MagnifyingGlass, Hash, SpeakerHigh, MessengerLogo, UserCircle,
    Clock, ChartBar, ArrowRight, MicrophoneStage
} from "@phosphor-icons/react";

import { useGuildLocale, useGuildTimezone } from "@/lib/i18n";
import { usePersistentPeriod } from "@/hooks/usePersistentPeriod";
import { formatDateInTimezone, formatLocaleNumber, formatYAxis } from "@/lib/utils";
import { StatsCard } from "@/components/stats/StatsCard";
import { ChartContainer } from "@/components/stats/ChartContainer";
import { ChartTooltip } from "@/components/stats/ChartTooltip";
import { StatsPageHeader, StatsPageShell } from "@/components/stats/StatsPageScaffold";
import {
    BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell
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
        day1: '24 Hours',
        day3: '3 Days',
        day7: '7 Days',
        day14: '14 Days',
        day30: '30 Days',
        day90: '90 Days',
        day365: '365 Days',
        minutes: 'min',
        hours: 'h',
        noData: 'No data for this user',
        selectUser: 'Search for a user to see detailed statistics',
        msgs: 'msgs',
        minutesAgo: 'min ago',
        hoursAgo: 'h ago',
        daysAgo: 'd ago',
        noDataShort: 'No Data',
        other: 'Other',
        topChannelMsgs: 'Top Channel (msgs)',
        topChannelVoice: 'Top Channel (voice)',
        mostRecentMsg: 'Most Recent (msg)',
        mostRecentVoice: 'Most Recent (voice)',
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
        day1: '24 часа',
        day3: '3 дня',
        day7: '7 дней',
        day14: '14 дней',
        day30: '30 дней',
        day90: '90 дней',
        day365: '365 дней',
        minutes: 'мин',
        hours: 'ч',
        noData: 'Нет данных по этому пользователю',
        selectUser: 'Найдите пользователя для просмотра подробной статистики',
        msgs: 'сообщ.',
        minutesAgo: 'мин назад',
        hoursAgo: 'ч назад',
        daysAgo: 'д назад',
        noDataShort: 'Нет данных',
        other: 'Прочие',
        topChannelMsgs: 'Топ канал (сообщ.)',
        topChannelVoice: 'Топ канал (голос)',
        mostRecentMsg: 'Последнее (сообщ.)',
        mostRecentVoice: 'Последнее (голос)',
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
    const guildTimezone = useGuildTimezone(guildId);
    const text = strings[locale];

    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<UserItem[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState('');
    const [selectedUserAvatar, setSelectedUserAvatar] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [period] = usePersistentPeriod('7d');

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

    const formatDate = (dateStr: string) => {
        return formatDateInTimezone(dateStr, guildTimezone, locale);
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}\u00A0${text.hours} ${m}\u00A0${text.minutes}`;
        return `${m}\u00A0${text.minutes}`;
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins} ${text.minutesAgo}`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} ${text.hoursAgo}`;
        const days = Math.floor(hrs / 24);
        return `${days} ${text.daysAgo}`;
    };

    // --- RENDER ---
    return (
        <StatsPageShell>
            <StatsPageHeader
                title={text.title}
                subtitle={text.subtitle}
                icon={<UserCircle size={26} weight="fill" />}
                iconClassName="text-[var(--color-primary-2)]"
            />

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
                        inputWrapper: "h-12 rounded-2xl border border-divider bg-surface hover:border-white/10 data-[focused=true]:border-primary/50",
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
                                    className="flex w-full cursor-pointer flex-col gap-2 border-b border-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-primary/10 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
                                    <div className="flex flex-shrink-0 flex-wrap items-center gap-3 pl-11 sm:pl-0">
                                        {u.messages > 0 && (
                                            <div className="flex items-center gap-1 text-default-400">
                                                <MessengerLogo size={14} weight="fill" className="text-violet-400" />
                                                <span className="text-xs font-semibold text-white">{formatLocaleNumber(u.messages, locale)}</span>
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
                            base: "max-w-full border border-primary/20 bg-primary/10 px-3 py-4 sm:px-4 sm:py-5",
                            content: "truncate text-sm font-bold text-white sm:text-base"
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
                <div className="space-y-4 sm:space-y-6">
                    {/* Tabs */}
                    <Tabs
                        selectedKey={activeTab}
                        onSelectionChange={(key) => setActiveTab(key as string)}
                        classNames={{
                            base: "w-full overflow-x-auto",
                            tabList: "w-full min-w-max rounded-2xl border border-divider bg-surface p-1",
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
                        <div className="space-y-4 sm:space-y-6">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                                <StatsCard
                                    title={text.totalMessages}
                                    value={drilldownData?.overview?.totalMessages != null ? formatLocaleNumber(drilldownData.overview.totalMessages, locale) : '—'}
                                    description={`${text.avgPerDay}: ${drilldownData?.overview?.avgMessagesPerDay ?? 0}`}
                                    icon={<MessengerLogo size={24} weight="fill" />}
                                    loading={loadingDrilldown}
                                />
                                <StatsCard
                                    title={text.uniqueChannels}
                                    value={drilldownData?.overview?.uniqueMessageChannels != null ? formatLocaleNumber(drilldownData.overview.uniqueMessageChannels, locale) : '—'}
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
                                    value={drilldownData?.overview?.uniqueVoiceChannels != null ? formatLocaleNumber(drilldownData.overview.uniqueVoiceChannels, locale) : '—'}
                                    icon={<MicrophoneStage size={24} weight="fill" />}
                                    loading={loadingDrilldown}
                                />
                            </div>

                            {/* Bottom info cards */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                                {/* Top Message Channel */}
                                <Card className="border border-divider bg-surface">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.topChannelMsgs}</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.topMessageChannel ? (
                                                <a href={`/dashboard/${guildId}/stats/channels?channelId=${drilldownData.overview.topMessageChannel.channelId || drilldownData.overview.topMessageChannel.id}`} className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-lg transition-colors group">
                                                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 group-hover:border-cyan-500/30">
                                                        <Hash size={16} className="text-cyan-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-white font-bold truncate group-hover:text-primary transition-colors">{drilldownData.overview.topMessageChannel.name}</p>
                                                        <p className="text-xs text-default-400">{formatLocaleNumber(drilldownData.overview.topMessageChannel.value, locale)} {text.msgs}</p>
                                                    </div>
                                                </a>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Top Voice Channel */}
                                <Card className="border border-divider bg-surface">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.topChannelVoice}</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.topVoiceChannel ? (
                                                <a href={`/dashboard/${guildId}/stats/channels?channelId=${drilldownData.overview.topVoiceChannel.channelId || drilldownData.overview.topVoiceChannel.id}`} className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-lg transition-colors group">
                                                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/10 flex items-center justify-center flex-shrink-0 group-hover:border-orange-500/30">
                                                        <SpeakerHigh size={16} className="text-orange-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-white font-bold truncate group-hover:text-primary transition-colors">{drilldownData.overview.topVoiceChannel.name}</p>
                                                        <p className="text-xs text-default-400">{formatDuration(drilldownData.overview.topVoiceChannel.value)}</p>
                                                    </div>
                                                </a>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Most Recent Message */}
                                <Card className="border border-divider bg-surface">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.mostRecentMsg}</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.mostRecentMessage ? (
                                                <div>
                                                    <p className="text-white font-bold">{formatDate(drilldownData.overview.mostRecentMessage.date)}</p>
                                                    <p className="text-xs text-default-400">#{drilldownData.overview.mostRecentMessage.channelName} · {timeAgo(drilldownData.overview.mostRecentMessage.date)}</p>
                                                </div>
                                            ) : <p className="text-default-500 text-sm">—</p>
                                        )}
                                    </CardBody>
                                </Card>

                                {/* Most Recent Voice */}
                                <Card className="border border-divider bg-surface">
                                    <CardBody className="p-5">
                                        <p className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">{text.mostRecentVoice}</p>
                                        {loadingDrilldown ? <Skeleton className="h-8 w-full rounded-lg" /> : (
                                            drilldownData?.overview?.mostRecentVoice ? (
                                                <div>
                                                    <p className="text-white font-bold">{formatDate(drilldownData.overview.mostRecentVoice.date)}</p>
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
                                        <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dx={-10} width={50} tickFormatter={(v) => formatYAxis(v, locale as 'ru' | 'en')} />
                                        <RechartsTooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            content={<ChartTooltip locale={locale} colorOverrides={{ messages: '#8b5cf6' }} />}
                                        />
                                        <Bar dataKey="messages" fill="url(#userBarGradient)" radius={[12, 12, 0, 0]} />
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
                                guildId={guildId}
                                otherLabel={text.other}
                                noDataLabel={text.noDataShort}
                                locale={locale}
                            />
                        </div>
                    )}

                    {/* TAB: Voice */}
                    {activeTab === 'voice' && (
                        <div className="space-y-6">
                            <ChartContainer title={text.voiceByDay} loading={loadingDrilldown} height={300}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={drilldownData?.chart || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="userVoiceBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#f97316" stopOpacity={0.3} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                        <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis
                                            stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dx={-10} width={50}
                                            tickFormatter={(v) => `${formatYAxis(v, locale as 'ru' | 'en')}\u00A0${text.minutes}`}
                                        />
                                        <RechartsTooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            content={(props: any) => (
                                                <ChartTooltip
                                                    {...props}
                                                    locale={locale}
                                                    colorOverrides={{ voiceMinutes: '#f97316' }}
                                                    formatters={{
                                                        voiceMinutes: (v) => formatDuration(v as number)
                                                    }}
                                                />
                                            )}
                                        />
                                        <Bar dataKey="voiceMinutes" fill="url(#userVoiceBarGradient)" radius={[12, 12, 0, 0]} />
                                    </BarChart>
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
                                guildId={guildId}
                                otherLabel={text.other}
                                noDataLabel={text.noDataShort}
                                locale={locale}
                            />
                        </div>
                    )}
                </div>
            ) : (
                /* Empty state — no user selected */
                !showResults && (
                    <Card className="border border-divider bg-surface">
                        <CardBody className="p-8 text-center sm:p-16">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/10 bg-primary/10 sm:mb-6 sm:h-20 sm:w-20">
                                <MagnifyingGlass size={36} className="text-primary/60" />
                            </div>
                            <p className="text-base font-medium text-default-400 sm:text-lg">{text.selectUser}</p>
                        </CardBody>
                    </Card>
                )
            )}
        </StatsPageShell>
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
    guildId: string;
    otherLabel: string;
    noDataLabel: string;
    locale: 'ru' | 'en';
}

function ChannelBreakdownSection({
    channels, totalValue, valueKey, valueLabel, loading, title,
    nameLabel, countLabel, percentLabel, pieTopN, setPieTopN, formatValue, guildId,
    otherLabel, noDataLabel, locale
}: ChannelBreakdownProps) {
    const pieData = useMemo(() => {
        const top = channels.slice(0, pieTopN);
        const otherValue = channels.slice(pieTopN).reduce((sum: number, c: any) => sum + (c[valueKey] || 0), 0);
        const result = top.map((c: any) => ({
            name: c.name,
            value: c[valueKey] || 0
        }));
        if (otherValue > 0) {
            result.push({ name: otherLabel, value: otherValue });
        }
        return result;
    }, [channels, pieTopN, valueKey, otherLabel]);

    if (loading) {
        return <Skeleton className="h-80 w-full rounded-2xl" />;
    }

    if (!channels.length) return null;

    return (
        <Card className="border border-divider bg-surface">
            <CardBody className="p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between sm:mb-6">
                    <div className="flex min-w-0 items-center gap-2">
                        <Hash size={22} weight="bold" className="text-primary" />
                        <h2 className="truncate text-base font-bold text-white sm:text-lg">{title}</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
                    {/* List */}
                    <div className="custom-scrollbar h-[300px] space-y-2 overflow-y-auto pr-1 sm:h-[350px] sm:space-y-3 sm:pr-2">
                        {channels.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-default-500">
                                {noDataLabel}
                            </div>
                        ) : (
                            channels.slice(0, 15).map((c: any, i: number) => (
                                <a
                                    key={c.channelId || i}
                                    href={`/dashboard/${guildId}/stats/channels?channelId=${c.channelId}`}
                                    className="flex items-center justify-between p-2 md:p-3 rounded-xl bg-white/5 hover:bg-white/10 hover:border-white/10 border border-transparent transition-all group cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-1 min-w-0">
                                        <div className="flex-shrink-0 w-6 md:w-8 text-center text-default-400 font-medium text-sm group-hover:text-primary">#{c.rank || i + 1}</div>
                                        <div className="w-8 h-8 rounded-full bg-default-100/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                                            <Hash size={16} className="text-default-400 group-hover:text-primary" />
                                        </div>
                                        <span className="font-medium truncate text-sm md:text-base flex-1 min-w-0 block text-white group-hover:text-primary transition-colors">{c.name}</span>
                                    </div>
                                    <div className="font-bold font-mono text-primary text-sm md:text-base whitespace-nowrap ml-2 md:ml-4 text-right">
                                        {formatValue ? formatValue(c[valueKey]) : formatLocaleNumber(c[valueKey] || 0, locale)}
                                    </div>
                                </a>
                            ))
                        )}
                    </div>

                    {/* Pie Chart */}
                    <div className="flex h-[300px] flex-col sm:h-[350px]">
                        <div className="flex justify-end mb-2">
                            <ButtonGroup size="sm">
                                {[3, 5, 10].map(n => (
                                    <Button
                                        key={n}
                                        variant={pieTopN === n ? 'solid' : 'flat'}
                                        color={pieTopN === n ? 'primary' : 'default'}
                                        onPress={() => setPieTopN(n)}
                                        className={pieTopN === n ? '' : 'bg-transparent hover:bg-white/5'}
                                    >
                                        {locale === 'ru' ? 'Топ' : 'Top'} {n}
                                    </Button>
                                ))}
                            </ButtonGroup>
                        </div>
                        <div className="flex-1 min-h-0 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        cornerRadius={4}
                                        dataKey="value"
                                        nameKey="name"
                                        stroke="none"
                                    >
                                        {pieData.map((_: any, i: number) => (
                                            <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        content={(props: any) => (
                                            <ChartTooltip
                                                {...props}
                                                locale={locale}
                                            />
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Custom Legend */}
                        <div className="custom-scrollbar mt-4 grid max-h-[110px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:max-h-[120px] sm:grid-cols-2 sm:pr-2">
                            {pieData.map((item: any, index: number) => (
                                <div key={`legend-${index}`} className="flex items-center gap-2 p-2 rounded-lg bg-transparent border border-white/5">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                    <span className="text-xs truncate flex-1 font-medium text-default-300">{item.name}</span>
                                    <span className="text-[10px] text-default-500 font-mono">
                                        {((item.value / Math.max(1, pieData.reduce((a: any, b: any) => a + b.value, 0))) * 100).toFixed(0)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
