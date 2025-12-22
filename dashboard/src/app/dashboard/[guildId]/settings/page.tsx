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
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
                        {text.title}
                    </h1>
                    <p className="text-default-400 text-lg">{text.subtitle}</p>
                </div>

                <div className={`
                    h-12 px-5 rounded-2xl flex items-center gap-3 border border-white/5 shadow-2xl backdrop-blur-md
                    ${stats.botStatus === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400' :
                        stats.botStatus === 'OFFLINE' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}
                `}>
                    <div className="relative flex items-center justify-center">
                        <div className={`absolute w-3 h-3 rounded-full animate-ping ${stats.botStatus === 'ONLINE' ? 'bg-emerald-500' :
                                stats.botStatus === 'OFFLINE' ? 'bg-rose-500' : 'bg-amber-500'
                            } opacity-75`} />
                        <div className={`relative w-2.5 h-2.5 rounded-full ${stats.botStatus === 'ONLINE' ? 'bg-emerald-500' :
                                stats.botStatus === 'OFFLINE' ? 'bg-rose-500' : 'bg-amber-500'
                            }`} />
                    </div>
                    <span className="font-bold text-sm uppercase tracking-wider">
                        {stats.botStatus === 'ONLINE' ? text.statusOnline : stats.botStatus === 'OFFLINE' ? text.statusOffline : text.statusPartial}
                    </span>
                </div>
            </div>

            {/* Control Panel */}
            <Card className="bg-[#181A20] border border-white/5 shadow-2xl rounded-[32px] overflow-visible">
                <CardBody className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-default-400">
                            <Cpu size={22} weight="fill" />
                        </div>
                        <h3 className="text-xl font-bold text-white">{text.botControl}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Button
                            className={`h-24 text-lg font-bold rounded-[24px] border border-white/5 shadow-lg relative overflow-hidden group transition-all duration-300 ${stats.botStatus === 'OFFLINE'
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:scale-[1.02] hover:shadow-emerald-500/10'
                                    : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:scale-[1.02] hover:shadow-rose-500/10'
                                }`}
                            onPress={() => handleAction(stats.botStatus === 'OFFLINE' ? 'start' : 'stop')}
                            isLoading={loading}
                        >
                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${stats.botStatus === 'OFFLINE' ? 'from-emerald-500/20 via-transparent to-transparent' : 'from-rose-500/20 via-transparent to-transparent'
                                }`} />
                            <div className="flex flex-col items-center gap-2 relative z-10">
                                <Power size={32} weight="fill" />
                                <span>{stats.botStatus === 'OFFLINE' ? text.startBot : text.stopBot}</span>
                            </div>
                        </Button>

                        <Button
                            className="h-24 text-lg font-bold rounded-[24px] bg-amber-500/10 text-amber-400 border border-white/5 shadow-lg relative overflow-hidden group transition-all duration-300 hover:bg-amber-500/20 hover:scale-[1.02] hover:shadow-amber-500/10"
                            onPress={() => handleAction('restart')}
                            isLoading={loading}
                            isDisabled={stats.botStatus === 'OFFLINE'}
                        >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-500/20 via-transparent to-transparent" />
                            <div className="flex flex-col items-center gap-2 relative z-10">
                                <ArrowClockwise size={32} weight="fill" className="group-hover:rotate-180 transition-transform duration-500" />
                                <span>{text.reboot}</span>
                            </div>
                        </Button>

                        <Button
                            className="h-24 text-lg font-bold rounded-[24px] bg-white/[0.03] text-default-400 border border-white/5 shadow-lg relative overflow-hidden group transition-all duration-300 hover:bg-white/[0.06] hover:text-white"
                            onPress={() => handleAction('kill')}
                            isLoading={loading}
                            isDisabled={stats.botStatus === 'OFFLINE'}
                        >
                            <div className="flex flex-col items-center gap-2 relative z-10">
                                <StopCircle size={32} weight="fill" />
                                <span>{text.forceStop}</span>
                            </div>
                        </Button>
                    </div>

                    <Divider className="my-8 bg-white/5" />

                    <div>
                        <h4 className="text-sm font-bold text-default-400 uppercase tracking-wider mb-4">{text.moduleStatus}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { label: text.discordBot, active: stats.modules.discord, icon: <Cpu weight="fill" /> },
                                { label: text.lavalink, active: stats.modules.lavalink, icon: <Pulse weight="fill" /> },
                                { label: text.database, active: stats.modules.database, activeLabel: text.connected, inactiveLabel: text.disconnected, icon: <HardDrives weight="fill" /> }
                            ].map((mod, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-[20px] bg-white/[0.02] border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${mod.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {React.cloneElement(mod.icon as React.ReactElement, { size: 20 })}
                                        </div>
                                        <span className="font-bold text-default-200">{mod.label}</span>
                                    </div>
                                    <Chip
                                        size="sm"
                                        classNames={{
                                            base: `border-none ${mod.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`,
                                            content: "font-bold"
                                        }}
                                        variant="flat"
                                    >
                                        {mod.active ? (mod.activeLabel || text.running) : (mod.inactiveLabel || text.stopped)}
                                    </Chip>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    {
                        title: text.cpuUsage,
                        value: `${stats.cpu}%`,
                        subval: stats.cpu > 80 ? text.cpuHigh : text.cpuNormal,
                        color: stats.cpu > 80 ? 'text-rose-400' : 'text-emerald-400',
                        progress: stats.cpu,
                        progressColor: "primary",
                        icon: <Cpu weight="fill" size={24} />
                    },
                    {
                        title: text.ramUsage,
                        value: `${stats.memory} MB`,
                        subval: stats.totalMemory ? `/ ${stats.totalMemory} MB` : '',
                        color: isMemoryHigh ? 'text-rose-400' : 'text-emerald-400',
                        progress: memoryPercent,
                        progressColor: "secondary",
                        icon: <HardDrives weight="fill" size={24} />
                    },
                    {
                        title: text.uptime,
                        value: stats.uptime,
                        subval: text.sinceRestart,
                        color: 'text-white',
                        progress: 100, // Static full bar looks nice as an "always on" indicator
                        progressColor: "default",
                        icon: <ArrowClockwise weight="fill" size={24} />
                    },
                    {
                        title: text.ping,
                        value: stats.ping !== null ? `${stats.ping}ms` : text.pingNoData,
                        subval: pingState.label,
                        color: pingState.className,
                        progress: stats.ping ? Math.min(100, (stats.ping / 500) * 100) : 0,
                        progressColor: "warning",
                        icon: <Pulse weight="fill" size={24} />
                    }
                ].map((item, i) => (
                    <Card key={i} className="bg-[#181A20] border border-white/5 shadow-xl rounded-[28px] group hover:border-white/10 transition-colors">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-white/5 rounded-xl text-white group-hover:scale-110 transition-transform">
                                    {item.icon}
                                </div>
                                <span className="text-default-400 font-bold text-sm tracking-wide">{item.title}</span>
                            </div>

                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-3xl font-extrabold text-white tracking-tight">{item.value}</span>
                                <span className={`text-xs font-bold uppercase ${item.color.replace('text-white', 'text-default-500')}`}>
                                    {item.subval}
                                </span>
                            </div>

                            <Progress
                                value={item.progress}
                                color={item.progressColor as any}
                                size="sm"
                                radius="full"
                                classNames={{ indicator: "bg-gradient-to-r from-current to-white/50" }}
                            />
                        </CardBody>
                    </Card>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] p-2">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-2 h-8 rounded-full bg-primary" />
                            <h4 className="text-lg font-bold text-white">CPU History</h4>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={cpuHistory}>
                                    <defs>
                                        <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.05} stroke="#fff" vertical={false} />
                                    <XAxis dataKey="time" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} dx={-10} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8B5CF6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area type="monotone" dataKey="value" name="CPU" stroke="#8B5CF6" strokeWidth={3} fill="url(#colorCpu)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] p-2">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-2 h-8 rounded-full bg-emerald-500" />
                            <h4 className="text-lg font-bold text-white">RAM History</h4>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={memHistory}>
                                    <defs>
                                        <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.05} stroke="#fff" vertical={false} />
                                    <XAxis dataKey="time" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} dx={-10} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#10B981', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area type="monotone" dataKey="value" name="RAM" stroke="#10B981" strokeWidth={3} fill="url(#colorMem)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
