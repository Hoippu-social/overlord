'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Chip, Spinner, Button, ButtonGroup } from "@nextui-org/react";
import { MusicWidget } from '@/components/MusicWidget';
import {
    ShieldCheck,
    Scroll,
    Coins,
    MusicNote,
    ChatsTeardrop,
    Ticket,
    Buildings,
    Gear,
    UsersThree,
    UserCircle,
    Pulse,
    CaretRight,
    Translate,
} from "@phosphor-icons/react";
import Link from 'next/link';
import { useGuildLocale } from '@/lib/i18n';

type BotStatus = 'ONLINE' | 'OFFLINE' | 'PARTIAL';
type NowPlaying = {
    title: string;
    author?: string | null;
    uri?: string | null;
    artworkUrl?: string | null;
    durationMs?: number | null;
    positionMs?: number | null;
    volume?: number | null;
    paused?: boolean | null;
    sourceName?: string | null;
};

interface GuildSummary {
    guild: {
        id: string;
        name?: string | null;
        icon?: string | null;
        prefix?: string | null;
    };
    counts: {
        roles: number;
        voiceChannels: number;
        textChannels: number;
        totalChannels: number;
        members?: number | null;
        onlineMembers?: number | null;
    };
    lastSyncedAt?: string;
}

interface SystemStats {
    cpu: number;
    memory: number;
    totalMemory?: number | null;
    uptime: string;
    ping: number | null;
    botStatus: BotStatus;
    modules: {
        discord: boolean;
        lavalink: boolean;
        database: boolean;
    };
}

const strings = {
    en: {
        loading: 'Loading dashboard...',
        guildUnavailable: 'Guild data is not available yet. Make sure the bot has synced at least once.',
        details: 'Details: {details}',
        errorLoad: 'Failed to load dashboard data. Check console/network logs.',
        notSynced: 'Not synced yet',
        onlineHintAvailable: 'Currently online',
        onlineHintMissing: 'Enable presence intent to show online users',
        pageTitle: 'Dashboard Hub',
        liveData: 'Live data for {server}',
        prefixLabel: 'Prefix: {prefix}',
        prefixNotSet: 'not set',
        users: 'Users',
        totalMembers: 'Total members',
        online: 'Online',
        syncStatus: 'Sync & Status',
        lastSynced: 'Last synced',
        uptime: 'Uptime',
        ping: 'Ping',
        na: 'n/a',
        modulesTitle: 'Modules',
        statusOnline: 'online',
        statusOffline: 'offline',
        statusPartial: 'partial',
        statusUnknown: 'unknown',
        modules: {
            moderation: { label: 'Moderation', desc: 'Auto-mod, warnings, and bans' },
            audit: { label: 'Audit Logs', desc: 'Track server events' },
            economy: { label: 'Economy', desc: 'Currency, shop, and items' },
            music: { label: 'Music', desc: 'Playback settings and queue tools' },
            tempVoice: { label: 'Temp Voice', desc: 'Auto voice rooms and templates' },
            tickets: { label: 'Tickets', desc: 'Support system management' },
            botSettings: { label: 'Bot settings', desc: 'Bot control and system status' },
            serverSettings: { label: 'Server settings', desc: 'Prefix, roles, and channels' },
        },
    },
    ru: {
        loading: 'Загрузка панели...',
        guildUnavailable: 'Данные сервера пока недоступны. Убедитесь, что бот синхронизировал данные.',
        details: 'Детали: {details}',
        errorLoad: 'Не удалось загрузить данные панели. Проверьте консоль/сеть.',
        notSynced: 'Пока не синхронизировано',
        onlineHintAvailable: 'Сейчас онлайн',
        onlineHintMissing: 'Включите intent присутствия, чтобы видеть онлайн',
        pageTitle: 'Главная',
        liveData: 'Данные для {server}',
        prefixLabel: 'Префикс: {prefix}',
        prefixNotSet: 'не задан',
        users: 'Пользователи',
        totalMembers: 'Всего участников',
        online: 'Онлайн',
        syncStatus: 'Синхронизация и статус',
        lastSynced: 'Последняя синхронизация',
        uptime: 'Аптайм',
        ping: 'Пинг',
        na: 'н/д',
        modulesTitle: 'Модули',
        statusOnline: 'в сети',
        statusOffline: 'офлайн',
        statusPartial: 'частично',
        statusUnknown: 'неизвестно',
        modules: {
            moderation: { label: 'Модерация', desc: 'Автомод, предупреждения и баны' },
            audit: { label: 'Аудит', desc: 'События сервера' },
            economy: { label: 'Экономика', desc: 'Валюта, магазин, предметы' },
            music: { label: 'Музыка', desc: 'Настройки плеера и очереди' },
            tempVoice: { label: 'Временные комнаты', desc: 'Авто-комнаты и шаблоны' },
            tickets: { label: 'Тикеты', desc: 'Управление тикетами' },
            botSettings: { label: 'Настройки бота', desc: 'Управление ботом и статус' },
            serverSettings: { label: 'Настройки сервера', desc: 'Префикс, роли, каналы' },
        },
    },
} as const;

const localeOptions = [
    { key: 'ru', label: 'RU' },
    { key: 'en', label: 'EN' },
] as const;

const formatText = (template: string, vars?: Record<string, string | number>) => {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
};

const getStatusColor = (status?: BotStatus) => {
    switch (status) {
        case 'ONLINE': return 'success';
        case 'PARTIAL': return 'warning';
        case 'OFFLINE': return 'danger';
        default: return 'default';
    }
};

export default function HubPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale, setLocale } = useGuildLocale(guildId);
    const text = strings[locale];
    const [summary, setSummary] = useState<GuildSummary | null>(null);
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

    const modules = [
        { label: text.modules.moderation.label, href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck, desc: text.modules.moderation.desc },
        { label: text.modules.audit.label, href: `/dashboard/${guildId}/audit`, icon: Scroll, desc: text.modules.audit.desc },
        { label: text.modules.economy.label, href: `/dashboard/${guildId}/economy`, icon: Coins, desc: text.modules.economy.desc },
        { label: text.modules.music.label, href: `/dashboard/${guildId}/music`, icon: MusicNote, desc: text.modules.music.desc },
        { label: text.modules.tempVoice.label, href: `/dashboard/${guildId}/tempvoice`, icon: ChatsTeardrop, desc: text.modules.tempVoice.desc },
        { label: text.modules.tickets.label, href: `/dashboard/${guildId}/tickets`, icon: Ticket, desc: text.modules.tickets.desc },
        { label: text.modules.botSettings.label, href: `/dashboard/${guildId}/settings`, icon: Gear, desc: text.modules.botSettings.desc },
        { label: text.modules.serverSettings.label, href: `/dashboard/${guildId}/server-settings`, icon: Buildings, desc: text.modules.serverSettings.desc },
    ];

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [summaryRes, systemRes, npRes] = await Promise.all([
                    fetch(`/api/guilds/${guildId}`),
                    fetch('/api/system'),
                    fetch(`/api/guilds/${guildId}/nowplaying`)
                ]);

                if (summaryRes.ok) {
                    const summaryData = await summaryRes.json();
                    setSummary(summaryData);
                } else {
                    const body = await summaryRes.json().catch(() => ({}));
                    const details = `${summaryRes.status}: ${body.error || text.na}`;
                    setError(formatText(text.details, { details }));
                }

                if (systemRes.ok) {
                    const systemData = await systemRes.json();
                    setSystemStats(systemData);
                }

                if (npRes.ok) {
                    const { nowPlaying } = await npRes.json();
                    setNowPlaying(nowPlaying || null);
                }
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
                setError(text.errorLoad);
            } finally {
                setLoading(false);
            }
        };

        load();
        const timer = setInterval(() => {
            fetch(`/api/guilds/${guildId}/nowplaying`)
                .then((r) => r.json())
                .then((data) => setNowPlaying(data.nowPlaying || null))
                .catch(() => { /* ignore */ });
        }, 5000);
        return () => clearInterval(timer);
    }, [guildId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner color="primary" label={text.loading} />
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="bg-surface border border-divider p-8">
                    <p className="text-default-500">
                        {text.guildUnavailable}
                        {error && <><br /><span className="text-danger">{formatText(text.details, { details: error })}</span></>}
                    </p>
                </Card>
            </div>
        );
    }

    const totalMembers = summary?.counts.members ?? null;
    const onlineMembers = summary?.counts.onlineMembers ?? null;
    const formatCount = (value: number | null | undefined) =>
        typeof value === 'number' ? value.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : text.na;
    const onlineHint = typeof onlineMembers === 'number'
        ? text.onlineHintAvailable
        : text.onlineHintMissing;
    const formatDate = (value?: string) => {
        if (!value) return text.notSynced;
        const date = new Date(value);
        const localeTag = locale === 'ru' ? 'ru-RU' : 'en-US';
        return `${date.toLocaleDateString(localeTag)} ${date.toLocaleTimeString(localeTag)}`;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
                        {text.pageTitle}
                    </h1>
                    <div className="flex items-center gap-3 text-default-400">
                        <span className="font-medium text-lg">{summary?.guild.name ?? text.na}</span>
                        <div className="w-1 h-1 rounded-full bg-default-400/50" />
                        <span className="text-default-400/80 font-mono text-sm bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                            {summary?.guild.prefix ?? text.prefixNotSet}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <ButtonGroup className="bg-[#181A20] border border-white/5 p-1 rounded-2xl shadow-lg">
                        {localeOptions.map((option) => {
                            const isActive = option.key === locale;
                            return (
                                <Button
                                    key={option.key}
                                    size="sm"
                                    variant={isActive ? "solid" : "light"}
                                    color={isActive ? "primary" : "default"}
                                    className={`min-w-10 h-9 rounded-xl font-bold transition-all ${isActive
                                            ? 'bg-primary text-white shadow-md'
                                            : 'text-default-500 hover:text-default-300'
                                        }`}
                                    onPress={() => setLocale(option.key)}
                                    startContent={
                                        <div className={`w-5 h-5 rounded-full overflow-hidden border border-white/10 ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                                            <img
                                                src={option.key === 'ru' ? "/icons/free_russia_flag.png" : "/icons/uk_flag.png"}
                                                className="w-full h-full object-cover"
                                                alt={option.label}
                                            />
                                        </div>
                                    }
                                >
                                    {option.label}
                                </Button>
                            );
                        })}
                    </ButtonGroup>

                    <Link href={`/dashboard/${guildId}/settings`}>
                        <div className={`
                            h-11 px-4 rounded-2xl flex items-center gap-3 border border-white/5 shadow-lg transition-all hover:scale-105 active:scale-95
                            ${systemStats?.botStatus === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' :
                                systemStats?.botStatus === 'OFFLINE' ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-amber-500/10 text-amber-400'}
                        `}>
                            <div className="relative flex items-center justify-center">
                                <div className={`absolute w-3 h-3 rounded-full animate-ping ${systemStats?.botStatus === 'ONLINE' ? 'bg-emerald-500' :
                                        systemStats?.botStatus === 'OFFLINE' ? 'bg-rose-500' : 'bg-amber-500'
                                    } opacity-75`} />
                                <div className={`relative w-2 h-2 rounded-full ${systemStats?.botStatus === 'ONLINE' ? 'bg-emerald-500' :
                                        systemStats?.botStatus === 'OFFLINE' ? 'bg-rose-500' : 'bg-amber-500'
                                    }`} />
                            </div>
                            <span className="font-bold text-sm uppercase tracking-wider">
                                {systemStats?.botStatus
                                    ? systemStats.botStatus === 'ONLINE'
                                        ? text.statusOnline
                                        : systemStats.botStatus === 'OFFLINE'
                                            ? text.statusOffline
                                            : text.statusPartial
                                    : text.statusUnknown}
                            </span>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Music Widget Area */}
                <div className="xl:col-span-8 h-full">
                    <MusicWidget className="h-full rounded-[32px] border-white/5 shadow-2xl bg-[#181A20]" nowPlaying={nowPlaying || undefined} guildId={guildId} />
                </div>

                {/* Stats Column */}
                <div className="xl:col-span-4 flex flex-col gap-6">
                    {/* Members Card */}
                    <div className="bg-[#181A20] rounded-[32px] p-6 border border-white/5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full translate-x-10 -translate-y-10 group-hover:bg-primary/30 transition-all duration-700" />

                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner-lg">
                                <UsersThree size={28} weight="fill" />
                            </div>
                            <div>
                                <p className="text-default-400 text-sm font-medium uppercase tracking-wider mb-0.5">{text.users}</p>
                                <h3 className="text-3xl font-bold text-white">{formatCount(totalMembers)}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Online Card */}
                    <div className="bg-[#181A20] rounded-[32px] p-6 border border-white/5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full translate-x-10 -translate-y-10 group-hover:bg-emerald-500/20 transition-all duration-700" />

                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner-lg">
                                <UserCircle size={28} weight="fill" />
                            </div>
                            <div>
                                <p className="text-default-400 text-sm font-medium uppercase tracking-wider mb-0.5">{text.online}</p>
                                <h3 className="text-3xl font-bold text-white">{formatCount(onlineMembers)}</h3>
                                <p className="text-emerald-500/60 text-xs font-semibold">{onlineHint}</p>
                            </div>
                        </div>
                    </div>

                    {/* System Status Card */}
                    <div className="bg-[#181A20] rounded-[32px] p-6 border border-white/5 shadow-xl flex-1 flex flex-col">
                        <h4 className="font-bold text-lg text-white mb-6 flex items-center gap-2">
                            <Pulse size={20} className="text-default-400" />
                            {text.syncStatus}
                        </h4>

                        <div className="space-y-4 flex-1">
                            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
                                <span className="text-default-500 text-sm font-medium">{text.lastSynced}</span>
                                <span className="text-white font-mono text-sm bg-white/5 px-2 py-1 rounded-lg">
                                    {formatDate(summary?.lastSyncedAt).split(' ').map((part, i) => (
                                        <span key={i} className={i === 0 ? "text-default-300 mr-2" : "text-white font-bold"}>{part}</span>
                                    ))}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
                                <span className="text-default-500 text-sm font-medium">{text.uptime}</span>
                                <span className="text-emerald-400 font-mono text-sm font-bold">
                                    {systemStats?.uptime ?? text.na}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
                                <span className="text-default-500 text-sm font-medium">{text.ping}</span>
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-0.5 items-end h-3">
                                        <div className={`w-1 rounded-sm bg-emerald-500/30 ${!systemStats?.ping || systemStats.ping < 100 ? 'h-full bg-emerald-500' : 'h-1/2'}`} />
                                        <div className={`w-1 rounded-sm bg-emerald-500/30 ${!systemStats?.ping || systemStats.ping < 50 ? 'h-3/4 bg-emerald-500' : 'h-1/3'}`} />
                                        <div className={`w-1 rounded-sm bg-emerald-500/30 ${!systemStats?.ping || systemStats.ping < 20 ? 'h-1/2 bg-emerald-500' : 'h-1/4'}`} />
                                    </div>
                                    <span className="text-white font-mono text-sm font-bold">
                                        {systemStats?.ping ?? text.na}
                                        <span className="text-default-600 text-xs ml-0.5">ms</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modules Section */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-primary to-primary/20" />
                    {text.modulesTitle}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {modules.map((mod, i) => (
                        <Link key={mod.href} href={mod.href} className="group h-full">
                            <div className="bg-[#181A20] h-full rounded-[24px] p-6 border border-white/5 shadow-lg group-hover:scale-[1.02] group-hover:shadow-2xl group-hover:border-white/10 transition-all duration-300 relative overflow-hidden flex flex-col">
                                {/* Globular Gradient Hover Blob */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[50px] rounded-full translate-x-12 -translate-y-12 group-hover:bg-primary/20 transition-all duration-500" />

                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-default-400 group-hover:text-white group-hover:bg-primary group-hover:rotate-6 transition-all duration-300 shadow-inner mb-6 relative z-10">
                                    <mod.icon size={26} weight="fill" />
                                </div>

                                <div className="relative z-10 mb-4">
                                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">{mod.label}</h3>
                                    <p className="text-default-500 text-sm leading-relaxed group-hover:text-default-400 transition-colors">{mod.desc}</p>
                                </div>

                                <div className="mt-auto relative z-10 flex items-center text-sm font-bold text-primary opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                                    Manage <CaretRight size={16} weight="bold" className="ml-1" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

