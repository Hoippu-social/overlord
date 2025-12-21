'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, Button, Progress, Chip } from "@nextui-org/react";
import { AreaChart, Card as TremorCard, Title } from "@tremor/react";
import { Power, ArrowClockwise, StopCircle, Cpu, HardDrives, Pulse } from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";

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

const strings = {
    en: {
        title: 'System Status',
        subtitle: 'Monitor bot performance and resource usage',
        start: 'Start Bot',
        restart: 'Restart',
        stop: 'Stop',
        cpuUsage: 'CPU Usage',
        ramUsage: 'RAM Usage',
        uptime: 'Uptime',
        sinceRestart: 'Since last restart',
        ping: 'Ping',
        pingNoData: 'No data',
        pingExcellent: 'Excellent',
        pingGood: 'Good',
        pingHigh: 'High',
        gatewayLatency: 'Gateway latency',
        cpuHigh: 'High',
        cpuNormal: 'Normal',
        statusOnline: 'ONLINE',
        statusOffline: 'OFFLINE',
        statusPartial: 'PARTIAL',
        cpuHistory: 'CPU History',
        memoryHistory: 'Memory History',
    },
    ru: {
        title: 'Состояние системы',
        subtitle: 'Мониторинг производительности и ресурсов',
        start: 'Запустить бота',
        restart: 'Перезапуск',
        stop: 'Остановить',
        cpuUsage: 'Загрузка CPU',
        ramUsage: 'Загрузка RAM',
        uptime: 'Аптайм',
        sinceRestart: 'С момента перезапуска',
        ping: 'Пинг',
        pingNoData: 'Нет данных',
        pingExcellent: 'Отлично',
        pingGood: 'Хорошо',
        pingHigh: 'Высокий',
        gatewayLatency: 'Задержка шлюза',
        cpuHigh: 'Высокая',
        cpuNormal: 'Норма',
        statusOnline: 'В СЕТИ',
        statusOffline: 'ОФФЛАЙН',
        statusPartial: 'ЧАСТИЧНО',
        cpuHistory: 'История CPU',
        memoryHistory: 'История памяти',
    },
} as const;

export default function SystemPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

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
            database: false,
        },
    });

    const [cpuHistory, setCpuHistory] = useState<{ date: string, CPU: number }[]>([]);
    const [ramHistory, setRamHistory] = useState<{ date: string, RAM: number }[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, [locale]);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/system');
            if (!res.ok) return;
            const data = await res.json();
            setStats(data);

            const localeTag = locale === 'ru' ? 'ru-RU' : 'en-US';
            const now = new Date().toLocaleTimeString(localeTag, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
            setTimeout(fetchStats, 2000);
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
        if (ping === null || ping === undefined) return { label: text.pingNoData, className: 'text-default-500' };
        if (ping < 100) return { label: text.pingExcellent, className: 'text-success' };
        if (ping < 200) return { label: text.pingGood, className: 'text-warning' };
        return { label: text.pingHigh, className: 'text-danger' };
    };

    const memoryPercent = stats.totalMemory ? Math.min(100, Math.round((stats.memory / stats.totalMemory) * 100)) : 0;
    const pingState = getPingState(stats.ping);

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">{text.title}</h1>
                            <Chip color={getStatusColor(stats.botStatus)} variant="flat" size="lg">
                                {stats.botStatus === 'ONLINE'
                                    ? text.statusOnline
                                    : stats.botStatus === 'OFFLINE'
                                        ? text.statusOffline
                                        : text.statusPartial}
                            </Chip>
                        </div>
                        <p className="text-default-500">{text.subtitle}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            color="success"
                            startContent={<Power size={18} />}
                            onPress={() => handleAction('start')}
                            isLoading={loading}
                            isDisabled={stats.botStatus === 'ONLINE'}
                        >
                            {text.start}
                        </Button>
                        <Button
                            color="warning"
                            variant="flat"
                            startContent={<ArrowClockwise size={18} />}
                            onPress={() => handleAction('restart')}
                            isLoading={loading}
                        >
                            {text.restart}
                        </Button>
                        <Button
                            color="danger"
                            variant="flat"
                            startContent={<StopCircle size={18} />}
                            onPress={() => handleAction('stop')}
                            isLoading={loading}
                            isDisabled={stats.botStatus === 'OFFLINE'}
                        >
                            {text.stop}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Cpu size={24} /></div>
                                <span className="text-default-500 font-medium">{text.cpuUsage}</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">{stats.cpu}%</span>
                                <span className={`text-sm mb-1 ${stats.cpu > 80 ? 'text-danger' : 'text-success'}`}>
                                    {stats.cpu > 80 ? text.cpuHigh : text.cpuNormal}
                                </span>
                            </div>
                            <Progress value={stats.cpu} color="primary" className="mt-3" size="sm" />
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><HardDrives size={24} /></div>
                                <span className="text-default-500 font-medium">{text.ramUsage}</span>
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
                                <span className="text-default-500 font-medium">{text.uptime}</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">{stats.uptime}</span>
                            </div>
                            <div className="text-xs text-default-400 mt-3">{text.sinceRestart}</div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-warning/10 rounded-lg text-warning"><Pulse size={24} /></div>
                                <span className="text-default-500 font-medium">{text.ping}</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">
                                    {stats.ping ?? text.pingNoData}{stats.ping !== null && stats.ping !== undefined ? 'ms' : ''}
                                </span>
                                <span className={`text-sm mb-1 ${pingState.className}`}>{pingState.label}</span>
                            </div>
                            <div className="text-xs text-default-400 mt-3">{text.gatewayLatency}</div>
                        </CardBody>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TremorCard className="bg-surface border border-divider ring-0">
                        <Title className="text-foreground">{text.cpuHistory}</Title>
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
                        <Title className="text-foreground">{text.memoryHistory}</Title>
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
