'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Chip, Spinner } from "@nextui-org/react";
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
} from "@phosphor-icons/react";
import Link from 'next/link';

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

const getStatusColor = (status?: BotStatus) => {
    switch (status) {
        case 'ONLINE': return 'success';
        case 'PARTIAL': return 'warning';
        case 'OFFLINE': return 'danger';
        default: return 'default';
    }
};

const formatDate = (value?: string) => {
    if (!value) return 'Not synced yet';
    const date = new Date(value);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

export default function HubPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const [summary, setSummary] = useState<GuildSummary | null>(null);
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

    const modules = [
        { label: 'Moderation', href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck, desc: 'Auto-mod, warnings, and bans' },
        { label: 'Audit Logs', href: `/dashboard/${guildId}/audit`, icon: Scroll, desc: 'Track server events' },
        { label: 'Economy', href: `/dashboard/${guildId}/economy`, icon: Coins, desc: 'Currency, shop, and items' },
        { label: 'Music', href: `/dashboard/${guildId}/music`, icon: MusicNote, desc: 'Playback settings and queue tools' },
        { label: 'Temp Voice', href: `/dashboard/${guildId}/tempvoice`, icon: ChatsTeardrop, desc: 'Auto voice rooms and templates' },
        { label: 'Tickets', href: `/dashboard/${guildId}/tickets`, icon: Ticket, desc: 'Support system management' },
        { label: 'Bot settings', href: `/dashboard/${guildId}/settings`, icon: Gear, desc: 'Bot control and system status' },
        { label: 'Server settings', href: `/dashboard/${guildId}/server-settings`, icon: Buildings, desc: 'Prefix, roles, and channels' },
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
                    setError(`Guild API returned ${summaryRes.status}: ${body.error || 'no message'}`);
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
                setError('Failed to load dashboard data. Check console/network logs.');
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
                <Spinner color="primary" label="Loading dashboard..." />
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="bg-surface border border-divider p-8">
                    <p className="text-default-500">
                        Guild data is not available yet. Make sure the bot has synced at least once.
                        {error && <><br /><span className="text-danger">Details: {error}</span></>}
                    </p>
                </Card>
            </div>
        );
    }

    const totalMembers = summary?.counts.members ?? null;
    const onlineMembers = summary?.counts.onlineMembers ?? null;
    const formatCount = (value: number | null | undefined) =>
        typeof value === 'number' ? value.toLocaleString() : 'n/a';
    const onlineHint = typeof onlineMembers === 'number'
        ? 'Currently online'
        : 'Enable presence intent to show online users';

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard Hub</h1>
                    <p className="text-default-500">Live data for {summary?.guild.name ?? 'your server'}</p>
                    <p className="text-default-400 text-sm">Prefix: {summary?.guild.prefix ?? 'not set'}</p>
                </div>
                <Link href={`/dashboard/${guildId}/settings`} className="inline-flex">
                    <Chip
                        color={getStatusColor(systemStats?.botStatus)}
                        variant="flat"
                        startContent={<Pulse size={16} weight="fill" />}
                        size="lg"
                        className="capitalize cursor-pointer hover:opacity-90"
                    >
                        {systemStats?.botStatus?.toLowerCase() ?? 'unknown'}
                    </Chip>
                </Link>
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
                                <p className="text-default-500 text-sm">Users</p>
                                <h3 className="text-2xl font-bold">{formatCount(totalMembers)}</h3>
                                <p className="text-default-400 text-xs mt-1">Total members</p>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="flex flex-row items-center gap-4 p-6">
                            <div className="p-3 rounded-xl bg-success/10 text-success">
                                <UserCircle size={32} weight="fill" />
                            </div>
                            <div>
                                <p className="text-default-500 text-sm">Online</p>
                                <h3 className="text-2xl font-bold">{formatCount(onlineMembers)}</h3>
                                <p className="text-default-400 text-xs mt-1">{onlineHint}</p>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider flex-1">
                        <CardHeader className="pb-0 pt-4 px-4 flex-col items-start">
                            <h4 className="font-bold text-large">Sync & Status</h4>
                        </CardHeader>
                        <CardBody className="px-4 py-2 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-default-500">Last synced</span>
                                <span className="text-foreground font-semibold">{formatDate(summary?.lastSyncedAt)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-default-500">Uptime</span>
                                <span className="text-foreground font-semibold">{systemStats?.uptime ?? 'n/a'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-default-500">Ping</span>
                                <span className="text-foreground font-semibold">
                                    {systemStats?.ping ?? 'n/a'}{systemStats?.ping !== null && systemStats?.ping !== undefined ? 'ms' : ''}
                                </span>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>

            <h2 className="text-xl font-bold mt-8 mb-4">Modules</h2>
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

