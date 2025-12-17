'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Progress, Chip } from "@nextui-org/react";
import { AreaChart, Card as TremorCard, Title } from "@tremor/react";
import { Power, ArrowClockwise, StopCircle, Cpu, HardDrives, Pulse, Warning } from "@phosphor-icons/react";

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

export default function GlobalSystemPage() {
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

    const [cpuHistory, setCpuHistory] = useState<{ date: string, CPU: number }[]>([]);
    const [ramHistory, setRamHistory] = useState<{ date: string, RAM: number }[]>([]);
    const [loading, setLoading] = useState(false);

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

            const now = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            setCpuHistory(prev => {
                const newHistory = [...prev, { date: now, CPU: data.cpu }];
                return newHistory.slice(-20);
            });

            setRamHistory(prev => {
                const newHistory = [...prev, { date: now, RAM: data.memory }];
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
            setTimeout(fetchStats, 2000); // Wait for process to start/stop
        } catch (error) {
            console.error('Action failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: BotStatus) => {
        switch (status) {
            case 'ONLINE': return 'success';
            case 'OFFLINE': return 'danger';
            case 'PARTIAL': return 'warning';
            default: return 'default';
        }
    };

    const getPingState = (ping: number | null) => {
        if (ping === null || ping === undefined) return { label: 'No data', className: 'text-default-500' };
        if (ping < 100) return { label: 'Excellent', className: 'text-success' };
        if (ping < 200) return { label: 'Good', className: 'text-warning' };
        return { label: 'High', className: 'text-danger' };
    };

    const memoryPercent = stats.totalMemory ? Math.min(100, Math.round((stats.memory / stats.totalMemory) * 100)) : 0;
    const pingState = getPingState(stats.ping);

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">System Status</h1>
                            <Chip color={getStatusColor(stats.botStatus)} variant="flat" size="lg">
                                {stats.botStatus}
                            </Chip>
                        </div>
                        <p className="text-default-500">Monitor bot performance and resource usage</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            color="success"
                            startContent={<Power size={18} />}
                            onPress={() => handleAction('start')}
                            isLoading={loading}
                            isDisabled={stats.botStatus === 'ONLINE'}
                        >
                            Start Bot
                        </Button>
                        <Button
                            color="warning"
                            variant="flat"
                            startContent={<ArrowClockwise size={18} />}
                            onPress={() => handleAction('restart')}
                            isLoading={loading}
                        >
                            Restart
                        </Button>
                        <Button
                            color="danger"
                            variant="flat"
                            startContent={<StopCircle size={18} />}
                            onPress={() => handleAction('stop')}
                            isLoading={loading}
                            isDisabled={stats.botStatus === 'OFFLINE'}
                        >
                            Stop
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Cpu size={24} /></div>
                                <span className="text-default-500 font-medium">CPU Usage</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">{stats.cpu}%</span>
                                <span className={`text-sm mb-1 ${stats.cpu > 80 ? 'text-danger' : 'text-success'}`}>
                                    {stats.cpu > 80 ? 'High' : 'Normal'}
                                </span>
                            </div>
                            <Progress value={stats.cpu} color="primary" className="mt-3" size="sm" />
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><HardDrives size={24} /></div>
                                <span className="text-default-500 font-medium">RAM Usage</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">{stats.memory} MB</span>
                                {stats.totalMemory && (
                                    <span className="text-default-400 text-sm mb-1">/ {stats.totalMemory} MB</span>
                                )}
                            </div>
                            <Progress value={memoryPercent} color="secondary" className="mt-3" size="sm" />
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-success/10 rounded-lg text-success"><Pulse size={24} /></div>
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
                                <div className="p-2 bg-warning/10 rounded-lg text-warning"><Pulse size={24} /></div>
                                <span className="text-default-500 font-medium">Ping</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">
                                    {stats.ping ?? '—'}{stats.ping !== null && stats.ping !== undefined ? 'ms' : ''}
                                </span>
                                <span className={`text-sm mb-1 ${pingState.className}`}>{pingState.label}</span>
                            </div>
                            <div className="text-xs text-default-400 mt-3">Gateway latency</div>
                        </CardBody>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TremorCard className="bg-surface border border-divider ring-0">
                        <Title className="text-foreground">CPU History</Title>
                        <AreaChart
                            className="h-72 mt-4"
                            data={cpuHistory}
                            index="date"
                            categories={["CPU"]}
                            colors={["indigo"]}
                            valueFormatter={(number) => `${number}%`}
                            showAnimation={true}
                            autoMinValue={true}
                        />
                    </TremorCard>

                    <TremorCard className="bg-surface border border-divider ring-0">
                        <Title className="text-foreground">Memory History</Title>
                        <AreaChart
                            className="h-72 mt-4"
                            data={ramHistory}
                            index="date"
                            categories={["RAM"]}
                            colors={["emerald"]}
                            valueFormatter={(number) => `${number} MB`}
                            showAnimation={true}
                            autoMinValue={true}
                        />
                    </TremorCard>
                </div>
            </div>
        </div>
    );
}
