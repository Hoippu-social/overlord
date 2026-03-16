'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Chip, Progress, Divider } from "@nextui-org/react";
import { Power, ArrowClockwise, StopCircle, Cpu, HardDrives, Pulse, Warning } from "@phosphor-icons/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useGuildLocale } from '@/lib/i18n';

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
        title: 'Bot Control & System Monitor',
        subtitle: 'Manage bot status and monitor system resources',
        botControl: 'Bot Control',
        startBot: 'Start Bot',
        stopBot: 'Stop Bot',
        reboot: 'Reboot',
        forceStop: 'Force Stop',
        moduleStatus: 'Module Status',
        discordBot: 'Discord Bot',
        lavalink: 'Lavalink',
        database: 'Database',
        running: 'Running',
        stopped: 'Stopped',
        connected: 'Connected',
        disconnected: 'Disconnected',
        cpuUsage: 'CPU Usage',
        ramUsage: 'RAM Usage',
        uptime: 'Uptime',
        sinceRestart: 'Since last restart',
        ping: 'Ping',
        pingNoData: 'No data',
        pingExcellent: 'Excellent',
        pingGood: 'Good',
        pingHigh: 'High',
        cpuHigh: 'High',
        cpuNormal: 'Normal',
        memoryHigh: 'High',
        memoryNormal: 'Normal',
        statusOnline: 'online',
        statusOffline: 'offline',
        statusPartial: 'partial',
    },
    ru: {
        title: 'Управление ботом и мониторинг',
        subtitle: 'Управляйте ботом и следите за ресурсами системы',
        botControl: 'Управление ботом',
        startBot: 'Запустить бота',
        stopBot: 'Остановить бота',
        reboot: 'Перезапуск',
        forceStop: 'Принудительная остановка',
        moduleStatus: 'Состояние модулей',
        discordBot: 'Discord бот',
        lavalink: 'Lavalink',
        database: 'База данных',
        running: 'Запущен',
        stopped: 'Остановлен',
        connected: 'Подключен',
        disconnected: 'Отключен',
        cpuUsage: 'Загрузка CPU',
        ramUsage: 'Загрузка RAM',
        uptime: 'Аптайм',
        sinceRestart: 'С момента перезапуска',
        ping: 'Пинг',
        pingNoData: 'Нет данных',
        pingExcellent: 'Отлично',
        pingGood: 'Хорошо',
        pingHigh: 'Высокий',
        cpuHigh: 'Высокая',
        cpuNormal: 'Норма',
        memoryHigh: 'Высокая',
        memoryNormal: 'Норма',
        statusOnline: 'онлайн',
        statusOffline: 'офлайн',
        statusPartial: 'частично',
    },
} as const;

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

export default function SettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
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
    }, [locale]);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/system');
            const data = await res.json();
            setStats(data);

            const localeTag = locale === 'ru' ? 'ru-RU' : 'en-US';
            const now = new Date().toLocaleTimeString(localeTag, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            setCpuHistory(prev => {
                const newHistory = [...prev, { time: now, value: data.cpu }];
                return newHistory.slice(-20);
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
        if (ping === null || ping === undefined) return { label: text.pingNoData, className: 'text-default-500' };
        if (ping < 100) return { label: text.pingExcellent, className: 'text-success' };
        if (ping < 200) return { label: text.pingGood, className: 'text-warning' };
        return { label: text.pingHigh, className: 'text-danger' };
    };

    const memoryPercent = stats.totalMemory ? Math.min(100, Math.round((stats.memory / stats.totalMemory) * 100)) : 0;
    const isMemoryHigh = stats.totalMemory ? stats.memory > stats.totalMemory * 0.6 : stats.memory > 1024;
    const pingState = getPingState(stats.ping);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{text.title}</h1>
                    <p className="text-default-500">{text.subtitle}</p>
                </div>
                <Chip
                    color={getStatusColor()}
                    variant="flat"
                    startContent={getStatusIcon()}
                    size="lg"
                    className="capitalize"
                >
                    {stats.botStatus === 'ONLINE'
                        ? text.statusOnline
                        : stats.botStatus === 'OFFLINE'
                            ? text.statusOffline
                            : text.statusPartial}
                </Chip>
            </div>

            <Card className="bg-surface border border-divider">
                <CardBody className="p-6">
                    <h3 className="text-xl font-bold mb-4">{text.botControl}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button
                            color={stats.botStatus === 'OFFLINE' ? 'success' : 'danger'}
                            size="lg"
                            startContent={<Power size={20} />}
                            onPress={() => handleAction(stats.botStatus === 'OFFLINE' ? 'start' : 'stop')}
                            isLoading={loading}
                            className="h-16 font-semibold text-lg shadow-lg"
                        >
                            {stats.botStatus === 'OFFLINE' ? text.startBot : text.stopBot}
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
                            {text.reboot}
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
                            {text.forceStop}
                        </Button>
                    </div>

                    <Divider className="my-6" />

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-default-500">{text.moduleStatus}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-default-50 border border-default-100">
                                <span className="text-sm font-medium">{text.discordBot}</span>
                                <Chip size="sm" color={stats.modules.discord ? 'success' : 'danger'} variant="flat" classNames={{ content: "font-semibold" }}>
                                    {stats.modules.discord ? text.running : text.stopped}
                                </Chip>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-default-50 border border-default-100">
                                <span className="text-sm font-medium">{text.lavalink}</span>
                                <Chip size="sm" color={stats.modules.lavalink ? 'success' : 'danger'} variant="flat" classNames={{ content: "font-semibold" }}>
                                    {stats.modules.lavalink ? text.running : text.stopped}
                                </Chip>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-default-50 border border-default-100">
                                <span className="text-sm font-medium">{text.database}</span>
                                <Chip size="sm" color={stats.modules.database ? 'success' : 'danger'} variant="flat" classNames={{ content: "font-semibold" }}>
                                    {stats.modules.database ? text.connected : text.disconnected}
                                </Chip>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Cpu size={24} weight="fill" /></div>
                            <span className="text-default-500 font-medium">{text.cpuUsage}</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold">{stats.cpu}%</span>
                            <span className={`text-sm mb-1 font-medium ${stats.cpu > 80 ? 'text-danger' : 'text-success'}`}>
                                {stats.cpu > 80 ? text.cpuHigh : text.cpuNormal}
                            </span>
                        </div>
                        <Progress value={stats.cpu} color="primary" className="mt-3" size="sm" />
                    </CardBody>
                </Card>

                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><HardDrives size={24} weight="fill" /></div>
                            <span className="text-default-500 font-medium">{text.ramUsage}</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold">{stats.memory} MB</span>
                            {stats.totalMemory && (
                                <span className="text-default-400 text-sm mb-1">/ {stats.totalMemory} MB</span>
                            )}
                            <span className={`text-sm mb-1 font-medium ${isMemoryHigh ? 'text-danger' : 'text-success'}`}>
                                {isMemoryHigh ? text.memoryHigh : text.memoryNormal}
                            </span>
                        </div>
                        <Progress value={memoryPercent} color="secondary" className="mt-3" size="sm" />
                    </CardBody>
                </Card>

                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-success/10 rounded-lg text-success"><Pulse size={24} weight="fill" /></div>
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
                            <div className="p-2 bg-warning/10 rounded-lg text-warning"><Pulse size={24} weight="fill" /></div>
                            <span className="text-default-500 font-medium">{text.ping}</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold">
                                {stats.ping ?? text.pingNoData}{stats.ping !== null && stats.ping !== undefined ? 'ms' : ''}
                            </span>
                            <span className={`text-sm mb-1 font-medium ${pingState.className}`}>{pingState.label}</span>
                        </div>
                        <div className="text-xs text-default-400 mt-3">{text.ping}</div>
                    </CardBody>
                </Card>
            </div>

            <Card className="bg-surface border border-divider p-4">
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={cpuHistory}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis dataKey="time" tick={{ fill: 'var(--foreground)' }} />
                        <YAxis tick={{ fill: 'var(--foreground)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="value" name="CPU" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} />
                    </AreaChart>
                </ResponsiveContainer>
            </Card>

            <Card className="bg-surface border border-divider p-4">
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={memHistory}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis dataKey="time" tick={{ fill: 'var(--foreground)' }} />
                        <YAxis tick={{ fill: 'var(--foreground)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="value" name="RAM" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                    </AreaChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
}
