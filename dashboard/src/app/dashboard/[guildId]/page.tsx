'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Chip, Spinner } from "@nextui-org/react";
import { MusicWidget } from '@/components/MusicWidget';
import {
    ShieldCheck,
    Scroll,
    Coins,
    Ticket,
    Gear,
    Users,
    ChatCircleDots,
    Pulse,
    CaretRight,
    Waveform
} from "@phosphor-icons/react";
import Link from 'next/link';
import { RoleChip } from '@/components/RoleChip';

type BotStatus = 'ONLINE' | 'OFFLINE' | 'PARTIAL';

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
    };
    topRoles: { id: string; name: string; color: string }[];
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

export default function HubPage({ params }: { params: { guildId: string } }) {
    const { guildId } = params;
    const [summary, setSummary] = useState<GuildSummary | null>(null);
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);

    const modules = [
        { label: 'Moderation', href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck, desc: 'Auto-mod, warnings, and bans' },
        { label: 'Audit Logs', href: `/dashboard/${guildId}/audit`, icon: Scroll, desc: 'Track server events' },
        { label: 'Economy', href: `/dashboard/${guildId}/economy`, icon: Coins, desc: 'Currency, shop, and items' },
        { label: 'Tickets', href: `/dashboard/${guildId}/tickets`, icon: Ticket, desc: 'Support system management' },
    ];

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [summaryRes, systemRes] = await Promise.all([
                    fetch(`/api/guilds/${guildId}`),
                    fetch('/api/system')
                ]);

                if (summaryRes.ok) {
                    const summaryData = await summaryRes.json();
                    setSummary(summaryData);
                }

                if (systemRes.ok) {
                    const systemData = await systemRes.json();
                    setSystemStats(systemData);
                }
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        load();
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
                    <p className="text-default-500">Guild data is not available yet. Make sure the bot has synced at least once.</p>
                </Card>
            </div>
        );
    }

    const topRoles = summary?.topRoles ?? [];
    const voiceChannels = summary?.counts.voiceChannels ?? 0;
    const textChannels = summary?.counts.textChannels ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard Hub</h1>
                    <p className="text-default-500">Live data for {summary?.guild.name ?? 'your server'}</p>
                    <p className="text-default-400 text-sm">Prefix: {summary?.guild.prefix ?? 'not set'}</p>
                </div>
                <Chip
                    color={getStatusColor(systemStats?.botStatus)}
                    variant="flat"
                    startContent={<Pulse size={16} weight="fill" />}
                    size="lg"
                    className="capitalize"
                >
                    {systemStats?.botStatus?.toLowerCase() ?? 'unknown'}
                </Chip>
            </div>

            {/* Top Row: Music Widget & Stats */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Music Widget (Takes 2 columns on large screens) */}
                <div className="xl:col-span-2">
                    <MusicWidget />
                </div>

                {/* Stats Column */}
                <div className="space-y-6">
                    <Card className="bg-surface border border-divider">
                        <CardBody className="flex flex-row items-center gap-4 p-6">
                            <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                <Waveform size={32} weight="fill" />
                            </div>
                            <div className="flex-1">
                                <p className="text-default-500 text-sm">Voice Channels</p>
                                <h3 className="text-2xl font-bold">{voiceChannels}</h3>
                                <p className="text-default-400 text-xs mt-1">Total channels: {summary?.counts.totalChannels ?? 0}</p>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="flex flex-row items-center gap-4 p-6">
                            <div className="p-3 rounded-xl bg-success/10 text-success">
                                <ChatCircleDots size={32} weight="fill" />
                            </div>
                            <div>
                                <p className="text-default-500 text-sm">Text Channels</p>
                                <h3 className="text-2xl font-bold">{textChannels}</h3>
                                <p className="text-default-400 text-xs mt-1">Prefix: {summary?.guild.prefix ?? 'not set'}</p>
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
                                <span className="text-foreground font-semibold">{systemStats?.uptime ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-default-500">Ping</span>
                                <span className="text-foreground font-semibold">
                                    {systemStats?.ping ?? '—'}{systemStats?.ping !== null && systemStats?.ping !== undefined ? 'ms' : ''}
                                </span>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>

            {/* Modules Grid */}
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

                <Link href={`/dashboard/${guildId}/settings`}>
                    <Card className="h-full bg-surface border border-divider hover:border-primary/50 transition-colors cursor-pointer group border-dashed">
                        <CardBody className="p-6 flex flex-col gap-4 items-center justify-center text-center h-full">
                            <div className="p-3 w-fit rounded-xl bg-default-100 group-hover:bg-default-200 transition-colors">
                                <Gear size={32} weight="fill" className="text-default-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">General Settings</h3>
                                <p className="text-default-500 text-sm mt-1">Configure bot basics</p>
                            </div>
                        </CardBody>
                    </Card>
                </Link>
            </div>

            <Card className="bg-surface border border-divider">
                <CardHeader className="pb-0 pt-4 px-4 flex-col items-start">
                    <h4 className="font-bold text-large">Top Roles</h4>
                    <p className="text-default-500 text-sm">Live data from Discord sync</p>
                </CardHeader>
                <CardBody className="px-4 py-4">
                    <p className="text-default-500 text-xs mb-3">Roles synced: {summary?.counts.roles ?? 0}</p>
                    {topRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                            {topRoles.map((role) => (
                                <RoleChip key={role.id} name={role.name} color={role.color} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-default-500 text-sm">No roles synced yet.</p>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
