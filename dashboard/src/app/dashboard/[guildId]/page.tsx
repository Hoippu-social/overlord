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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{text.pageTitle}</h1>
                    <p className="text-default-500">{formatText(text.liveData, { server: summary?.guild.name ?? text.na })}</p>
                    <p className="text-default-400 text-sm">{formatText(text.prefixLabel, { prefix: summary?.guild.prefix ?? text.prefixNotSet })}</p>
                </div>

                <div className="flex items-center gap-4">
                    <ButtonGroup size="lg" variant="flat" className="bg-surface-hover/50 rounded-xl p-1 border border-divider">
                        {localeOptions.map((option) => {
                            const isActive = option.key === locale;
                            return (
                                <Button
                                    key={option.key}
                                    size="sm"
                                    color={isActive ? "primary" : "default"}
                                    variant={isActive ? "solid" : "light"}
                                    className={`min-w-unit-8 h-8 px-3 rounded-lg font-medium transition-all ${isActive ? 'shadow-md' : 'hover:bg-default/40'}`}
                                    onPress={() => setLocale(option.key)}
                                    startContent={
                                        <img
                                            src={option.key === 'ru' ? "/icons/free_russia_flag.png" : "/icons/uk_flag.png"}
                                            className="w-4 h-4 rounded-sm object-contain"
                                            alt=""
                                        />
                                    }
                                >
                                    {option.label}
                                </Button>
                            );
                        })}
                    </ButtonGroup>

                    <Link href={`/dashboard/${guildId}/settings`} className="inline-flex">
                        <Chip
                            color={getStatusColor(systemStats?.botStatus)}
                            variant="flat"
                            startContent={<Pulse size={16} weight="fill" />}
                            size="lg"
                            className="capitalize cursor-pointer hover:opacity-90"
                        >
                            {systemStats?.botStatus
                                ? systemStats.botStatus === 'ONLINE'
                                    ? text.statusOnline
                                    : systemStats.botStatus === 'OFFLINE'
                                        ? text.statusOffline
                                        : text.statusPartial
                                : text.statusUnknown}
                        </Chip>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
                <div className="xl:col-span-2 h-full">
                    <MusicWidget className="h-full" nowPlaying={nowPlaying || undefined} guildId={guildId} />
                </div>

                <div className="h-full flex flex-col gap-6">
                    <Card className="bg-surface border border-divider">
                        <CardBody className="flex flex-row items-center gap-4 p-6">
                            <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                <UsersThree size={32} weight="fill" />
                            </div>
                            <div className="flex-1">
                                <p className="text-default-500 text-sm">{text.users}</p>
                                <h3 className="text-2xl font-bold">{formatCount(totalMembers)}</h3>
                                <p className="text-default-400 text-xs mt-1">{text.totalMembers}</p>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="flex flex-row items-center gap-4 p-6">
                            <div className="p-3 rounded-xl bg-success/10 text-success">
                                <UserCircle size={32} weight="fill" />
                            </div>
                            <div>
                                <p className="text-default-500 text-sm">{text.online}</p>
                                <h3 className="text-2xl font-bold">{formatCount(onlineMembers)}</h3>
                                <p className="text-default-400 text-xs mt-1">{onlineHint}</p>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider flex-1">
                        <CardHeader className="pb-0 pt-4 px-4 flex-col items-start">
                            <h4 className="font-bold text-large">{text.syncStatus}</h4>
                        </CardHeader>
                        <CardBody className="px-4 py-2 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-default-500">{text.lastSynced}</span>
                                <span className="text-foreground font-semibold">{formatDate(summary?.lastSyncedAt)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-default-500">{text.uptime}</span>
                                <span className="text-foreground font-semibold">{systemStats?.uptime ?? text.na}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-default-500">{text.ping}</span>
                                <span className="text-foreground font-semibold">
                                    {systemStats?.ping ?? text.na}{systemStats?.ping !== null && systemStats?.ping !== undefined ? 'ms' : ''}
                                </span>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>

            <h2 className="text-xl font-bold mt-8 mb-4">{text.modulesTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {modules.map((mod) => (
                    <Link key={mod.href} href={mod.href}>
                        <Card className="h-full bg-surface border border-divider hover:border-primary/50 transition-colors cursor-pointer group">
                            <CardBody className="p-6 flex flex-col gap-4">
                                <div
                                    className="p-3 w-fit rounded-xl bg-default-100 group-hover:bg-primary/10 transition-colors"
                                >
                                    <mod.icon size={32} weight="fill" className="text-default-500 group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{mod.label}</h3>
                                    <p className="text-default-500 text-sm mt-1">{mod.desc}</p>
                                </div>
                                <div className="mt-auto pt-4 flex items-center text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                                    Manage <CaretRight size={16} className="ml-1" />
                                </div>
                            </CardBody>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}

