'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, Button, Progress, Chip } from "@nextui-org/react";
import { AreaChart, Card as TremorCard, Title } from "@tremor/react";
import {
    Power,
    ArrowClockwise,
    StopCircle,
    Cpu,
    HardDrives,
    Pulse,
    Gauge,
    WarningCircle,
    ClockCounterClockwise,
    Graph,
} from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";
import { formatLocaleNumber } from "@/lib/utils";

type BotStatus = 'ONLINE' | 'OFFLINE' | 'PARTIAL';
type TelemetryWindow = '24h' | '7d';

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

interface StatsTelemetryResponse {
    window: TelemetryWindow;
    summary: {
        requests: number;
        avgMs: number;
        p50Ms: number;
        p95Ms: number;
        p99Ms: number;
        errorCount: number;
        slowRequests: number;
        distinctEndpoints: number;
        errorRate: number;
    };
    endpoints: Array<{
        endpoint: string;
        requests: number;
        p95Ms: number;
        errorRate: number;
    }>;
    timeline: Array<{
        date: string;
        requests: number;
        p95Ms: number;
        errorRate: number;
    }>;
    ingestion: {
        activeGuilds30d: number;
        rebuildRequired: boolean;
        jobStatus: string;
        lastSourceEventAt: string | null;
        lastReadModelSyncAt: string | null;
        readModelLagMinutes: number | null;
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
        statsOps: 'Stats Operations',
        statsOpsDesc: 'Latency, errors and read-model health for the statistics module',
        requests: 'Requests',
        p95: 'p95 Latency',
        errorRate: 'Error Rate',
        readModelLag: 'Read Model Lag',
        activeGuilds: 'Active Guilds',
        last24h: '24 Hours',
        last7d: '7 Days',
        requestsHistory: 'Request Volume',
        latencyHistory: 'Latency p95',
        endpointHotspots: 'Endpoint Hotspots',
        endpoint: 'Endpoint',
        requestCount: 'Requests',
        avgLatency: 'Avg',
        slowRequests: 'Slow Requests',
        syncStatus: 'Sync Status',
        rebuildRequired: 'Rebuild required',
        yes: 'Yes',
        no: 'No',
        noTelemetry: 'No telemetry recorded yet.',
        moduleHealthy: 'Healthy',
        minutes: 'min',
        milliseconds: 'ms',
        percent: '%',
        jobIdle: 'Idle',
        lastSourceEvent: 'Last source event',
        lastReadSync: 'Last read-model sync',
        unknown: 'Unknown',
    },
    ru: {
        title: 'Состояние системы',
        subtitle: 'Мониторинг производительности бота и статистического контура',
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
        statsOps: 'Операции статистики',
        statsOpsDesc: 'Задержки, ошибки и состояние агрегированных витрин модуля статистики',
        requests: 'Запросы',
        p95: 'p95 задержка',
        errorRate: 'Доля ошибок',
        readModelLag: 'Лаг витрин',
        activeGuilds: 'Активных серверов',
        last24h: '24 часа',
        last7d: '7 дней',
        requestsHistory: 'Объём запросов',
        latencyHistory: 'Задержка p95',
        endpointHotspots: 'Тяжёлые эндпоинты',
        endpoint: 'Эндпоинт',
        requestCount: 'Запросы',
        avgLatency: 'Средняя',
        slowRequests: 'Медленные',
        syncStatus: 'Статус синка',
        rebuildRequired: 'Нужен rebuild',
        yes: 'Да',
        no: 'Нет',
        noTelemetry: 'Telemetry ещё не накоплена.',
        moduleHealthy: 'Норма',
        minutes: 'мин',
        milliseconds: 'мс',
        percent: '%',
        jobIdle: 'Ожидание',
        lastSourceEvent: 'Последнее source-событие',
        lastReadSync: 'Последний sync витрин',
        unknown: 'Неизвестно',
    },
} as const;

const formatDateTime = (value: string | null, locale: 'ru' | 'en') => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

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
    const [telemetryWindow, setTelemetryWindow] = useState<TelemetryWindow>('24h');
    const [telemetry, setTelemetry] = useState<StatsTelemetryResponse | null>(null);
    const [cpuHistory, setCpuHistory] = useState<{ date: string; CPU: number }[]>([]);
    const [ramHistory, setRamHistory] = useState<{ date: string; RAM: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [telemetryLoading, setTelemetryLoading] = useState(false);

    useEffect(() => {
        void fetchSystemStats();
        const interval = setInterval(() => {
            void fetchSystemStats();
        }, 5000);
        return () => clearInterval(interval);
    }, [locale]);

    useEffect(() => {
        void fetchTelemetry();
        const interval = setInterval(() => {
            void fetchTelemetry();
        }, 30000);
        return () => clearInterval(interval);
    }, [telemetryWindow, guildId]);

    const fetchSystemStats = async () => {
        try {
            const res = await fetch('/api/system');
            if (!res.ok) return;
            const data = await res.json();
            setStats(data);

            const localeTag = locale === 'ru' ? 'ru-RU' : 'en-US';
            const now = new Date().toLocaleTimeString(localeTag, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            setCpuHistory((prev) => [...prev, { date: now, CPU: data.cpu }].slice(-20));
            setRamHistory((prev) => [...prev, { date: now, RAM: data.memory }].slice(-20));
        } catch (error) {
            console.error('Failed to fetch system stats:', error);
        }
    };

    const fetchTelemetry = async () => {
        setTelemetryLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/stats/telemetry?window=${telemetryWindow}`);
            if (!res.ok) {
                setTelemetry(null);
                return;
            }
            const data = await res.json();
            setTelemetry(data);
        } catch (error) {
            console.error('Failed to fetch stats telemetry:', error);
            setTelemetry(null);
        } finally {
            setTelemetryLoading(false);
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
            setTimeout(() => void fetchSystemStats(), 2000);
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

                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold">{text.statsOps}</h2>
                                    <Chip size="sm" variant="flat" color={telemetry?.ingestion.rebuildRequired ? 'warning' : 'success'}>
                                        {telemetry?.ingestion.rebuildRequired ? text.rebuildRequired : text.moduleHealthy}
                                    </Chip>
                                </div>
                                <p className="text-default-500">{text.statsOpsDesc}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={telemetryWindow === '24h' ? 'solid' : 'flat'}
                                    color={telemetryWindow === '24h' ? 'primary' : 'default'}
                                    onPress={() => setTelemetryWindow('24h')}
                                >
                                    {text.last24h}
                                </Button>
                                <Button
                                    size="sm"
                                    variant={telemetryWindow === '7d' ? 'solid' : 'flat'}
                                    color={telemetryWindow === '7d' ? 'primary' : 'default'}
                                    onPress={() => setTelemetryWindow('7d')}
                                >
                                    {text.last7d}
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                            <Card className="bg-default-50/5 border border-divider">
                                <CardBody className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Graph size={20} className="text-primary" />
                                        <span className="text-default-500 text-sm">{text.requests}</span>
                                    </div>
                                    <div className="text-3xl font-bold">
                                        {formatLocaleNumber(telemetry?.summary.requests || 0, locale)}
                                    </div>
                                    <div className="text-xs text-default-400 mt-2">
                                        {formatLocaleNumber(telemetry?.summary.distinctEndpoints || 0, locale)} endpoints
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="bg-default-50/5 border border-divider">
                                <CardBody className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Gauge size={20} className="text-warning" />
                                        <span className="text-default-500 text-sm">{text.p95}</span>
                                    </div>
                                    <div className="text-3xl font-bold">
                                        {formatLocaleNumber(Math.round(telemetry?.summary.p95Ms || 0), locale)} {text.milliseconds}
                                    </div>
                                    <div className="text-xs text-default-400 mt-2">
                                        p50 {formatLocaleNumber(Math.round(telemetry?.summary.p50Ms || 0), locale)} {text.milliseconds}
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="bg-default-50/5 border border-divider">
                                <CardBody className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <WarningCircle size={20} className="text-danger" />
                                        <span className="text-default-500 text-sm">{text.errorRate}</span>
                                    </div>
                                    <div className="text-3xl font-bold">
                                        {formatLocaleNumber(Math.round((telemetry?.summary.errorRate || 0) * 10) / 10, locale)} {text.percent}
                                    </div>
                                    <div className="text-xs text-default-400 mt-2">
                                        {formatLocaleNumber(telemetry?.summary.errorCount || 0, locale)} / {formatLocaleNumber(telemetry?.summary.requests || 0, locale)}
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="bg-default-50/5 border border-divider">
                                <CardBody className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <ClockCounterClockwise size={20} className="text-secondary" />
                                        <span className="text-default-500 text-sm">{text.readModelLag}</span>
                                    </div>
                                    <div className="text-3xl font-bold">
                                        {telemetry?.ingestion.readModelLagMinutes != null
                                            ? `${formatLocaleNumber(telemetry.ingestion.readModelLagMinutes, locale)} ${text.minutes}`
                                            : '—'}
                                    </div>
                                    <div className="text-xs text-default-400 mt-2">
                                        {text.syncStatus}: {telemetry?.ingestion.jobStatus || text.unknown}
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="bg-default-50/5 border border-divider">
                                <CardBody className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Pulse size={20} className="text-success" />
                                        <span className="text-default-500 text-sm">{text.activeGuilds}</span>
                                    </div>
                                    <div className="text-3xl font-bold">
                                        {formatLocaleNumber(telemetry?.ingestion.activeGuilds30d || 0, locale)}
                                    </div>
                                    <div className="text-xs text-default-400 mt-2">
                                        {text.slowRequests}: {formatLocaleNumber(telemetry?.summary.slowRequests || 0, locale)}
                                    </div>
                                </CardBody>
                            </Card>
                        </div>

                        {telemetryLoading && !telemetry ? (
                            <div className="text-default-400">{text.noTelemetry}</div>
                        ) : telemetry ? (
                            <>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    <TremorCard className="bg-default-50/5 border border-divider ring-0">
                                        <Title className="text-foreground">{text.requestsHistory}</Title>
                                        <AreaChart
                                            className="h-72 mt-4"
                                            data={telemetry.timeline}
                                            index="date"
                                            categories={["requests"]}
                                            colors={["indigo"]}
                                            valueFormatter={(value) => formatLocaleNumber(value, locale)}
                                            showAnimation
                                        />
                                    </TremorCard>

                                    <TremorCard className="bg-default-50/5 border border-divider ring-0">
                                        <Title className="text-foreground">{text.latencyHistory}</Title>
                                        <AreaChart
                                            className="h-72 mt-4"
                                            data={telemetry.timeline}
                                            index="date"
                                            categories={["p95Ms"]}
                                            colors={["amber"]}
                                            valueFormatter={(value) => `${formatLocaleNumber(Math.round(value), locale)} ${text.milliseconds}`}
                                            showAnimation
                                        />
                                    </TremorCard>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <Card className="xl:col-span-2 bg-default-50/5 border border-divider">
                                        <CardBody className="p-6">
                                            <h3 className="text-lg font-semibold mb-4">{text.endpointHotspots}</h3>
                                            <div className="space-y-3">
                                                {telemetry.endpoints.map((row) => (
                                                    <div key={row.endpoint} className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr] gap-3 items-center rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                                                        <div className="font-mono text-sm text-white truncate">{row.endpoint}</div>
                                                        <div className="text-sm text-default-300">{formatLocaleNumber(row.requests, locale)}</div>
                                                        <div className="text-sm text-warning">{formatLocaleNumber(Math.round(row.p95Ms), locale)} {text.milliseconds}</div>
                                                        <div className="text-sm text-danger">{formatLocaleNumber(Math.round(row.errorRate * 10) / 10, locale)}%</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardBody>
                                    </Card>

                                    <Card className="bg-default-50/5 border border-divider">
                                        <CardBody className="p-6 space-y-4">
                                            <h3 className="text-lg font-semibold">{text.syncStatus}</h3>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-default-400">{text.rebuildRequired}</span>
                                                    <span className="font-semibold">{telemetry.ingestion.rebuildRequired ? text.yes : text.no}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-default-400">{text.syncStatus}</span>
                                                    <span className="font-semibold">{telemetry.ingestion.jobStatus || text.jobIdle}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-default-400">{text.lastSourceEvent}</span>
                                                    <span className="font-semibold text-right">{formatDateTime(telemetry.ingestion.lastSourceEventAt, locale)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-default-400">{text.lastReadSync}</span>
                                                    <span className="font-semibold text-right">{formatDateTime(telemetry.ingestion.lastReadModelSyncAt, locale)}</span>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </div>
                            </>
                        ) : (
                            <div className="text-default-400">{text.noTelemetry}</div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
