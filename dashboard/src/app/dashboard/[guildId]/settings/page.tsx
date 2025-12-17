'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Chip, Progress, Divider } from "@nextui-org/react";
import { Power, ArrowClockwise, StopCircle, Cpu, HardDrives, Pulse, Warning } from "@phosphor-icons/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type BotStatus = 'ONLINE' | 'OFFLINE' | 'PARTIAL';

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

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-surface border border-divider rounded-lg p-3 shadow-xl">
                <p className="text-default-500 text-xs mb-1">{label}</p>
                <p className="text-foreground font-bold text-lg">
                    {payload[0].value}{payload[0].name === 'CPU' ? '%' : ' MB'}
                </p>
            </div>
        );
    }
    return null;
};

export default function SettingsPage() {
    const [stats, setStats] = useState<SystemStats>({
        cpu: 0,
        memory: 0,
        totalMemory: null,
        uptime: '0s',
        ping: null,
        botStatus: 'OFFLINE',
        modules: {
            discord: false,
            lavalink: false,
            database: false
        }
    });
    const [loading, setLoading] = useState(false);
    const [cpuHistory, setCpuHistory] = useState<{ time: string, value: number }[]>([]);
    const [memHistory, setMemHistory] = useState<{ time: string, value: number }[]>([]);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/system');
            const data = await res.json();
            setStats(data);

            const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            setCpuHistory(prev => {
                const newHistory = [...prev, { time: now, value: data.cpu }];
                return newHistory.slice(-20); // Keep last 20 points for smoother chart
            });

            setMemHistory(prev => {
                const newHistory = [...prev, { time: now, value: data.memory }];
                return newHistory.slice(-20);
            });

        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const handleAction = async (action: 'start' | 'stop' | 'restart' | 'kill') => {
        setLoading(true);
        try {
            await fetch('/api/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            setTimeout(fetchStats, 2000);
        } catch (error) {
            console.error('Action failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = () => {
        switch (stats.botStatus) {
            case 'ONLINE': return 'success';
            case 'OFFLINE': return 'danger';
            case 'PARTIAL': return 'warning';
        }
    };

    const getStatusIcon = () => {
        switch (stats.botStatus) {
            case 'ONLINE': return <Pulse size={16} weight="fill" />;
            case 'OFFLINE': return <StopCircle size={16} weight="fill" />;
            case 'PARTIAL': return <Warning size={16} weight="fill" />;
        }
    };

    const getPingState = (ping: number | null) => {
        if (ping === null || ping === undefined) return { label: 'No data', className: 'text-default-500' };
        if (ping < 100) return { label: 'Excellent', className: 'text-success' };
        if (ping < 200) return { label: 'Good', className: 'text-warning' };
        return { label: 'High', className: 'text-danger' };
    };

    const memoryPercent = stats.totalMemory ? Math.min(100, Math.round((stats.memory / stats.totalMemory) * 100)) : 0;
    const isMemoryHigh = stats.totalMemory ? stats.memory > stats.totalMemory * 0.6 : stats.memory > 1024;
    const pingState = getPingState(stats.ping);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Bot Settings & System Monitor</h1>
                    <p className="text-default-500">Manage bot status and monitor system resources</p>
                </div>
                <Chip
                    color={getStatusColor()}
                    variant="flat"
                    startContent={getStatusIcon()}
                    size="lg"
                    className="capitalize"
                >
                    {stats.botStatus.toLowerCase()}
                </Chip>
            </div>

            {/* Control Panel */}
            <Card className="bg-surface border border-divider">
                <CardBody className="p-6">
                    <h3 className="text-xl font-bold mb-4">Bot Control</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button
                            color={stats.botStatus === 'OFFLINE' ? 'success' : 'danger'}
                            size="lg"
                            startContent={<Power size={20} />}
                            onPress={() => handleAction(stats.botStatus === 'OFFLINE' ? 'start' : 'stop')}
                            isLoading={loading}
                            className="h-16 font-semibold text-lg shadow-lg"
                        >
                            {stats.botStatus === 'OFFLINE' ? 'Start Bot' : 'Stop Bot'}
                        </Button>
                        <Button
                            color="warning"
                            variant="flat"
                            size="lg"
                            startContent={<ArrowClockwise size={20} />}
                            onPress={() => handleAction('restart')}
                            isLoading={loading}
                            isDisabled={stats.botStatus === 'OFFLINE'}
                            className="h-16 font-semibold text-lg"
                        >
                            Reboot
                        </Button>
                        <Button
                            color="danger"
                            variant="bordered"
                            size="lg"
                            startContent={<StopCircle size={20} />}
                            onPress={() => handleAction('kill')}
                            isLoading={loading}
                            isDisabled={stats.botStatus === 'OFFLINE'}
                            className="h-16 font-semibold text-lg"
                        >
                            Force Stop
                        </Button>
                    </div>

                    <Divider className="my-6" />

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-default-500">Module Status</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-default-50 border border-default-100">
                                <span className="text-sm font-medium">Discord Bot</span>
                                <Chip size="sm" color={stats.modules.discord ? 'success' : 'danger'} variant="flat" classNames={{ content: "font-semibold" }}>
                                    {stats.modules.discord ? 'Running' : 'Stopped'}
                                </Chip>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-default-50 border border-default-100">
                                <span className="text-sm font-medium">Lavalink</span>
                                <Chip size="sm" color={stats.modules.lavalink ? 'success' : 'danger'} variant="flat" classNames={{ content: "font-semibold" }}>
                                    {stats.modules.lavalink ? 'Running' : 'Stopped'}
                                </Chip>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-default-50 border border-default-100">
                                <span className="text-sm font-medium">Database</span>
                                <Chip size="sm" color={stats.modules.database ? 'success' : 'danger'} variant="flat" classNames={{ content: "font-semibold" }}>
                                    {stats.modules.database ? 'Connected' : 'Disconnected'}
                                </Chip>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* System Resources */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Cpu size={24} weight="fill" /></div>
                            <span className="text-default-500 font-medium">CPU Usage</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold">{stats.cpu}%</span>
                            <span className={`text-sm mb-1 font-medium ${stats.cpu > 80 ? 'text-danger' : 'text-success'}`}>
                                {stats.cpu > 80 ? 'High' : 'Normal'}
                            </span>
                        </div>
                        <Progress value={stats.cpu} color="primary" className="mt-3" size="sm" />
                    </CardBody>
                </Card>

                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><HardDrives size={24} weight="fill" /></div>
                            <span className="text-default-500 font-medium">RAM Usage</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold">{stats.memory} MB</span>
                            {stats.totalMemory && (
                                <span className="text-default-400 text-sm mb-1">/ {stats.totalMemory} MB</span>
                            )}
                            <span className={`text-sm mb-1 font-medium ${isMemoryHigh ? 'text-danger' : 'text-success'}`}>
                                {isMemoryHigh ? 'High' : 'Normal'}
                            </span>
                        </div>
                        <Progress value={memoryPercent} color="secondary" className="mt-3" size="sm" />
                    </CardBody>
                </Card>

                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-success/10 rounded-lg text-success"><Pulse size={24} weight="fill" /></div>
                            <span className="text-default-500 font-medium">Uptime</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold">{stats.uptime}</span>
                        </div>
                        <div className="text-xs text-default-400 mt-3">Since last restart</div>
                    </CardBody>
                </Card>

                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-warning/10 rounded-lg text-warning"><Warning size={24} weight="fill" /></div>
                            <span className="text-default-500 font-medium">Ping</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold">
                                {stats.ping ?? '—'}{stats.ping !== null && stats.ping !== undefined ? 'ms' : ''}
                            </span>
                            <span className={`${pingState.className} text-sm mb-1 font-medium`}>
                                {pingState.label}
                            </span>
                        </div>
                        <div className="text-xs text-default-400 mt-3">Gateway latency</div>
                    </CardBody>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-surface border border-divider p-6">
                    <h3 className="text-foreground font-bold mb-4 text-xl">CPU History</h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cpuHistory}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                                <XAxis dataKey="time" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    name="CPU"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorCpu)"
                                    animationDuration={500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="bg-surface border border-divider p-6">
                    <h3 className="text-foreground font-bold mb-4 text-xl">Memory History</h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={memHistory}>
                                <defs>
                                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                                <XAxis dataKey="time" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}MB`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    name="RAM"
                                    stroke="#ec4899"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorMem)"
                                    animationDuration={500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
}
