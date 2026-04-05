'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardBody, Button, Progress, Chip } from '@nextui-org/react';
import { AreaChart, Card as TremorCard, Title } from '@tremor/react';
import { Power, ArrowClockwise, StopCircle, Cpu, HardDrives, Pulse } from '@phosphor-icons/react';
import { getStoredLocale } from '@/lib/i18n';

type BotStatus = 'ONLINE' | 'OFFLINE' | 'PARTIAL';
type MetricStatus = 'ok' | 'warning' | 'critical' | 'unknown';

interface PathMetric {
    path: string | null;
    bytes: number | null;
    status: MetricStatus;
}

interface DiskMetric {
    path: string;
    totalBytes: number | null;
    freeBytes: number | null;
    usedPercent: number | null;
    status: MetricStatus;
}

interface SwapMetric {
    totalMb: number | null;
    usedMb: number | null;
    peakMb: number | null;
    status: MetricStatus;
}

interface StorageDiagnostics {
    disk: DiskMetric;
    swap: SwapMetric;
    temp: PathMetric;
    npmCache: PathMetric;
    playwrightCache: PathMetric;
    workspaceCache: PathMetric;
    database: PathMetric;
    logs: PathMetric;
    backups: PathMetric;
    updatedAt: string;
}

interface SystemStats {
    cpu: number;
    memory: number;
    totalMemory?: number | null;
    uptime: string;
    ping: number | null;
    botStatus: BotStatus;
    diagnostics: StorageDiagnostics;
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
        noData: 'No data',
        excellent: 'Excellent',
        good: 'Good',
        high: 'High',
        normal: 'Normal',
        gatewayLatency: 'Gateway latency',
        cpuHistory: 'CPU History',
        memoryHistory: 'Memory History',
        storageTitle: 'Storage Watch',
        storageSubtitle: 'Track the places that usually fill up first',
        diskFree: 'Disk Free',
        systemTemp: 'System Temp',
        packageCache: 'NPM Cache',
        browserCache: 'Playwright Cache',
        workspaceCache: 'Workspace Cache',
        databaseFiles: 'Database Files',
        logs: 'Logs',
        backups: 'Backups',
        swap: 'Swap / Pagefile',
        updated: 'Updated',
        healthy: 'Healthy',
        watch: 'Watch',
        critical: 'Critical',
        unavailable: 'Unavailable',
        peak: 'Peak',
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
        noData: 'Нет данных',
        excellent: 'Отлично',
        good: 'Хорошо',
        high: 'Высокий',
        normal: 'Норма',
        gatewayLatency: 'Задержка шлюза',
        cpuHistory: 'История CPU',
        memoryHistory: 'История памяти',
        storageTitle: 'Контроль хранилища',
        storageSubtitle: 'Куда чаще всего утекает диск и кэш',
        diskFree: 'Свободно на диске',
        systemTemp: 'Системный Temp',
        packageCache: 'Кэш NPM',
        browserCache: 'Кэш Playwright',
        workspaceCache: 'Кэш рабочей среды',
        databaseFiles: 'Файлы базы',
        logs: 'Логи',
        backups: 'Бэкапы',
        swap: 'Swap / pagefile',
        updated: 'Обновлено',
        healthy: 'Норма',
        watch: 'Следить',
        critical: 'Критично',
        unavailable: 'Недоступно',
        peak: 'Пик',
    },
} as const;

const emptyDiagnostics: StorageDiagnostics = {
    disk: {
        path: 'system',
        totalBytes: null,
        freeBytes: null,
        usedPercent: null,
        status: 'unknown',
    },
    swap: {
        totalMb: null,
        usedMb: null,
        peakMb: null,
        status: 'unknown',
    },
    temp: { path: null, bytes: null, status: 'unknown' },
    npmCache: { path: null, bytes: null, status: 'unknown' },
    playwrightCache: { path: null, bytes: null, status: 'unknown' },
    workspaceCache: { path: null, bytes: null, status: 'unknown' },
    database: { path: null, bytes: null, status: 'unknown' },
    logs: { path: null, bytes: null, status: 'unknown' },
    backups: { path: null, bytes: null, status: 'unknown' },
    updatedAt: new Date(0).toISOString(),
};

export default function GlobalSystemPage() {
    const [locale] = useState(getStoredLocale());
    const text = strings[locale];
    const [stats, setStats] = useState<SystemStats>({
        cpu: 0,
        memory: 0,
        totalMemory: null,
        uptime: '0s',
        ping: null,
        botStatus: 'OFFLINE',
        diagnostics: emptyDiagnostics,
        modules: {
            discord: false,
            lavalink: false,
            database: false,
        },
    });
    const [cpuHistory, setCpuHistory] = useState<Array<{ date: string; CPU: number }>>([]);
    const [ramHistory, setRamHistory] = useState<Array<{ date: string; RAM: number }>>([]);
    const [loading, setLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/system');
            if (!res.ok) {
                return;
            }

            const data = (await res.json()) as SystemStats;
            setStats(data);

            const localeTag = locale === 'ru' ? 'ru-RU' : 'en-US';
            const now = new Date().toLocaleTimeString(localeTag, {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });

            setCpuHistory((prev) => [...prev, { date: now, CPU: data.cpu }].slice(-20));
            setRamHistory((prev) => [...prev, { date: now, RAM: data.memory }].slice(-20));
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, [locale]);

    useEffect(() => {
        void fetchStats();
        const interval = setInterval(() => {
            void fetchStats();
        }, 5000);

        return () => clearInterval(interval);
    }, [locale, fetchStats]);

    const handleAction = async (action: 'start' | 'stop' | 'restart' | 'kill') => {
        setLoading(true);
        try {
            await fetch('/api/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            setTimeout(() => void fetchStats(), 2000);
        } catch (error) {
            console.error('Action failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: BotStatus) => {
        switch (status) {
            case 'ONLINE':
                return 'success';
            case 'OFFLINE':
                return 'danger';
            case 'PARTIAL':
                return 'warning';
            default:
                return 'default';
        }
    };

    const getPingState = (ping: number | null) => {
        if (ping === null || ping === undefined) {
            return { label: text.noData, className: 'text-default-500' };
        }
        if (ping < 100) {
            return { label: text.excellent, className: 'text-success' };
        }
        if (ping < 200) {
            return { label: text.good, className: 'text-warning' };
        }
        return { label: text.high, className: 'text-danger' };
    };

    const memoryPercent = stats.totalMemory ? Math.min(100, Math.round((stats.memory / stats.totalMemory) * 100)) : 0;
    const pingState = getPingState(stats.ping);
    const diskValue = stats.diagnostics.disk.totalBytes && stats.diagnostics.disk.freeBytes !== null
        ? `${formatBytes(stats.diagnostics.disk.freeBytes)} / ${formatBytes(stats.diagnostics.disk.totalBytes)}`
        : text.noData;
    const swapValue = stats.diagnostics.swap.usedMb !== null
        ? `${stats.diagnostics.swap.usedMb} MB${stats.diagnostics.swap.totalMb !== null ? ` / ${stats.diagnostics.swap.totalMb} MB` : ''}`
        : text.noData;
    const updatedAt = stats.diagnostics.updatedAt !== new Date(0).toISOString()
        ? new Date(stats.diagnostics.updatedAt).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
        : text.noData;

    const renderMetricRow = (label: string, metric: PathMetric) => (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="truncate text-xs text-default-500">{metric.path || text.noData}</div>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
                <span className="text-sm font-semibold text-white">{formatBytes(metric.bytes)}</span>
                <Chip color={getMetricColor(metric.status)} size="sm" variant="flat">
                    {getMetricLabel(metric.status, text)}
                </Chip>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">{text.title}</h1>
                            <Chip color={getStatusColor(stats.botStatus)} variant="flat" size="lg">
                                {stats.botStatus}
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
                                    {stats.cpu > 80 ? text.high : text.normal}
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
                                    {stats.ping ?? text.noData}
                                    {stats.ping !== null && stats.ping !== undefined ? 'ms' : ''}
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
                            categories={['CPU']}
                            colors={['indigo']}
                            valueFormatter={(number) => `${number}%`}
                            showAnimation
                            autoMinValue
                        />
                    </TremorCard>

                    <TremorCard className="bg-surface border border-divider ring-0">
                        <Title className="text-foreground">{text.memoryHistory}</Title>
                        <AreaChart
                            className="h-72 mt-4"
                            data={ramHistory}
                            index="date"
                            categories={['RAM']}
                            colors={['emerald']}
                            valueFormatter={(number) => `${number} MB`}
                            showAnimation
                            autoMinValue
                        />
                    </TremorCard>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-white">{text.storageTitle}</h2>
                        <p className="text-default-500">{text.storageSubtitle}</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="bg-surface border border-divider">
                            <CardBody className="space-y-4 p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-sm font-medium text-default-500">{text.diskFree}</div>
                                        <div className="mt-1 text-2xl font-bold text-white">{diskValue}</div>
                                        <div className="mt-1 text-xs text-default-400">{stats.diagnostics.disk.path}</div>
                                    </div>
                                    <Chip color={getMetricColor(stats.diagnostics.disk.status)} variant="flat">
                                        {getMetricLabel(stats.diagnostics.disk.status, text)}
                                    </Chip>
                                </div>
                                <Progress
                                    value={stats.diagnostics.disk.usedPercent ?? 0}
                                    color={getProgressColor(stats.diagnostics.disk.status)}
                                    size="sm"
                                />
                                <div className="flex items-center justify-between gap-4 text-sm text-default-400">
                                    <span>{text.swap}</span>
                                    <span>{swapValue}</span>
                                </div>
                                {stats.diagnostics.swap.peakMb !== null && (
                                    <div className="text-xs text-default-500">
                                        {text.peak}: {stats.diagnostics.swap.peakMb} MB
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        <Card className="bg-surface border border-divider">
                            <CardBody className="space-y-4 p-6">
                                {renderMetricRow(text.systemTemp, stats.diagnostics.temp)}
                                {renderMetricRow(text.packageCache, stats.diagnostics.npmCache)}
                                {renderMetricRow(text.browserCache, stats.diagnostics.playwrightCache)}
                            </CardBody>
                        </Card>

                        <Card className="bg-surface border border-divider">
                            <CardBody className="space-y-4 p-6">
                                {renderMetricRow(text.workspaceCache, stats.diagnostics.workspaceCache)}
                                {renderMetricRow(text.databaseFiles, stats.diagnostics.database)}
                            </CardBody>
                        </Card>

                        <Card className="bg-surface border border-divider">
                            <CardBody className="space-y-4 p-6">
                                {renderMetricRow(text.logs, stats.diagnostics.logs)}
                                {renderMetricRow(text.backups, stats.diagnostics.backups)}
                                <div className="pt-1 text-xs text-default-500">
                                    {text.updated}: {updatedAt}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatBytes(bytes: number | null): string {
    if (bytes === null) {
        return '-';
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function getMetricColor(status: MetricStatus): 'success' | 'warning' | 'danger' | 'default' {
    switch (status) {
        case 'ok':
            return 'success';
        case 'warning':
            return 'warning';
        case 'critical':
            return 'danger';
        default:
            return 'default';
    }
}

function getProgressColor(status: MetricStatus): 'success' | 'warning' | 'danger' | 'default' {
    return getMetricColor(status);
}

function getMetricLabel(
    status: MetricStatus,
    text: { healthy: string; watch: string; critical: string; unavailable: string }
): string {
    switch (status) {
        case 'ok':
            return text.healthy;
        case 'warning':
            return text.watch;
        case 'critical':
            return text.critical;
        default:
            return text.unavailable;
    }
}
