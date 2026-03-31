'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Spinner,
    Switch,
    Select,
    SelectItem,
    Tabs,
    Tab
} from '@nextui-org/react';
import {
    Ticket,
    Gear,
    ChartBar,
    Scroll,
    CheckCircle,
    Article,
    TrendUp,
    Clock,
    CalendarCheck,
    ThumbsUp,
    ThumbsDown,
    HandPeace,
    Plus,
    MagnifyingGlass,
    Users,
    CircleDashed
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import CategoryModal, { CategoryData } from '@/components/tickets/CategoryModal';
import { usePersistentPeriod } from '@/hooks/usePersistentPeriod';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { InteractiveSelect } from '@/components/moderation/ui';
import { buildChannelSelectOptions } from '@/lib/channelSelectOptions';

type TicketConfig = {
    enabled: boolean;
    logChannelId: string | null;
};

type TicketCategoryStats = {
    total: number;
    active: number;
};

type TicketCategory = {
    id: number;
    name: string;
    channelId: string | null;
    stats: TicketCategoryStats;
    saveHistory: boolean;
    mentionAgents: boolean;
    allowUserClose: boolean;
    enableRating: boolean;
    messagePayload: CategoryData['messagePayload'];
    buttonText: string;
    buttonEmoji: string | null;
    buttonStyle: string;
};

type ChannelOption = {
    id: string;
    name?: string;
    type?: number | string;
    parentId?: string | null;
    isCategory?: boolean;
    categoryName?: string | null;
};

type CategoryPieEntry = {
    name: string;
    value: number;
};

type GlobalStats = {
    open: number;
    onHold: number;
    closed: number;
    total: number;
    avgResolutionMins: number;
    ratings: {
        positive: number;
        neutral: number;
        negative: number;
        total: number;
    };
    categoryPieData: CategoryPieEntry[];
};

type ActivityPoint = {
    date: string;
    created: number;
    solved: number;
};

const MESSAGES = {
    en: {
        title: "Service Desk",
        subtitle: "Manage support tickets, categories, and analytics.",
        overview: "Dashboard",
        settings: "Project Settings",
        loggingTitle: "Audit & Logging",
        loggingDesc: "Store transcripts and ticket events in a secure channel.",
        logChannelLabel: "Transcript Archive Channel",
        logChannelPlaceholder: "Select a channel...",
        adminToolsTitle: "Quick Links",
        transcripts: "Ticket Archives",
        transcriptsDesc: "View history of closed tickets.",
        statistics: "Agent Performance",
        statisticsDesc: "Resolution times & insights.",
        categoriesTitle: "Ticket Categories",
        categoriesDesc: "Support topics and routing rules.",
        createCategory: "New Category",
        activeTickets: "Open",
        totalTickets: "Total",
        edit: "Configure",
        save: "Save",
        saved: "Saved",
        auditLogWarn: "Please select a channel to enable logging.",
        soon: "Soon",
        openTickets: "Created Tickets",
        unsolvedTickets: "Unresolved",
        resolvedTickets: "Resolved",
        avgResolution: "Avg Resolution Time",
        ticketsActivity: "Ticket Volume",
        ticketsByCategory: "Tickets by Category",
        customerSatisfaction: "CSAT Score",
        dateDay1: "Last 24 Hours",
        dateDay3: "Last 3 Days",
        dateDay7: "Last 7 Days",
        dateDay14: "Last 14 Days",
        dateDay30: "Last 30 Days",
        dateMonth3: "Last 90 Days",
        dateYear1: "Last Year",
        positive: "Satisfied",
        neutral: "Neutral",
        negative: "Dissatisfied",
        noData: "Insufficient Data",
        searchCategories: "Filter categories..."
    },
    ru: {
        title: "Служба Поддержки",
        subtitle: "Управление обращениями, маршрутизация и аналитика.",
        overview: "Дашборд",
        settings: "Настройки Проекта",
        loggingTitle: "Аудит и Логи",
        loggingDesc: "Сохранение транскриптов и событий тикетов в безопасный канал.",
        logChannelLabel: "Канал архива транскриптов",
        logChannelPlaceholder: "Выберите канал...",
        adminToolsTitle: "Быстрые Ссылки",
        transcripts: "Архив Тикетов",
        transcriptsDesc: "История закрытых обращений.",
        statistics: "Эффективность Агентов",
        statisticsDesc: "Время решения и аналитика.",
        categoriesTitle: "Категории Обращений",
        categoriesDesc: "Темы поддержки и правила маршрутизации.",
        createCategory: "Новая Категория",
        activeTickets: "Открыто",
        totalTickets: "Всего",
        edit: "Настроить",
        save: "Сохранить",
        saved: "Сохранено",
        auditLogWarn: "Выберите канал для включения логов.",
        soon: "Скоро",
        openTickets: "Создано тикетов",
        unsolvedTickets: "Нерешенные",
        resolvedTickets: "Решенные",
        avgResolution: "Среднее время решения",
        ticketsActivity: "Объем Тикетов",
        ticketsByCategory: "По Категориям",
        customerSatisfaction: "Индекс CSAT",
        dateDay1: "За 24 часа",
        dateDay3: "За 3 дня",
        dateDay7: "За 7 дней",
        dateDay14: "За 14 дней",
        dateDay30: "За 30 дней",
        dateMonth3: "За 90 дней",
        dateYear1: "За год",
        positive: "Довольны",
        neutral: "Нейтрально",
        negative: "Недовольны",
        noData: "Недостаточно данных",
        searchCategories: "Фильтр категорий..."
    }
} as const;

const PIE_COLORS = ['#3b82f6', '#8f5eff', '#10b981', '#f59e0b', '#ec4899', '#64748b'];

// Stats Card Component matching Atlassian/Linear dark bento style
const StatCard = ({ title, value, icon, trend }: { title: string, value: string | number, icon: React.ReactNode, trend?: { value: number, isPositive: boolean } }) => (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 shadow-sm relative overflow-hidden group">
        <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{title}</h3>
            <div className="text-[var(--text-muted)] group-hover:text-white transition-colors">{icon}</div>
        </div>
        <div className="flex items-end gap-3 relative z-10">
            <span className="text-4xl font-black font-akony text-white tracking-tight">{value}</span>
            {trend && (
                <span className={`text-xs font-bold pb-1.5 ${trend.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
            )}
        </div>
        {/* Subtle background glow on hover */}
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-[var(--text-muted)]/10 blur-[40px] rounded-full group-hover:bg-[var(--color-primary-2)]/20 transition-colors pointer-events-none" />
    </div>
);

export default function TicketsPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const t = MESSAGES[locale as keyof typeof MESSAGES] || MESSAGES.en;

    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<TicketConfig | null>(null);
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [channels, setChannels] = useState<{ text: ChannelOption[], categories: ChannelOption[] }>({ text: [], categories: [] });
    const [searchQuery, setSearchQuery] = useState('');

    // Stats State
    const [globalStats, setGlobalStats] = useState<GlobalStats>({ open: 0, onHold: 0, closed: 0, total: 0, avgResolutionMins: 0, ratings: { positive: 0, neutral: 0, negative: 0, total: 0 }, categoryPieData: [] });
    const [activityData, setActivityData] = useState<ActivityPoint[]>([]);

    const [period, setPeriod] = usePersistentPeriod('7d');
    const [, setSavingConfig] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<TicketCategory | null>(null);
    const [savingCategory, setSavingCategory] = useState(false);

    const logChannelOptions = useMemo(() => buildChannelSelectOptions({
        channels: channels.text,
        categories: channels.categories,
        includeCategories: true,
    }), [channels]);

    // Fetch Data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/tickets?period=${period}`);
            const data = await res.json();
            if (res.ok) {
                setConfig(data.config || { enabled: true, logChannelId: null });
                setCategories(data.categories || []);
                setChannels({
                    text: data.channels?.text || [],
                    categories: data.channels?.categories || []
                });
                if (data.globalStats) setGlobalStats(data.globalStats as GlobalStats);
                if (Array.isArray(data.activityData)) setActivityData(data.activityData as ActivityPoint[]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [guildId, period]);

    useEffect(() => {
        if (guildId) fetchData();
    }, [fetchData, guildId]);

    // Handlers
    const handleConfigUpdate = async (updates: Partial<TicketConfig>) => {
        if (!config) return;
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);

        setSavingConfig(true);
        try {
            await fetch(`/api/guilds/${guildId}/tickets`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });
        } catch (e) {
            console.error(e);
        } finally {
            setSavingConfig(false);
        }
    };

    const openCreateModal = () => {
        setEditingCategory(null);
        setIsModalOpen(true);
    };

    const openEditModal = (category: TicketCategory) => {
        setEditingCategory(category);
        setIsModalOpen(true);
    };

    const handleSaveCategory = async (data: Partial<CategoryData>) => {
        setSavingCategory(true);
        try {
            const isEdit = !!editingCategory;

            if (isEdit) {
                alert("Editing pending backend implementation. Only creation is currently supported.");
                setIsModalOpen(false);
                setSavingCategory(false);
                return;
            }

            const res = await fetch(`/api/guilds/${guildId}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                await fetchData();
                setIsModalOpen(false);
            } else {
                alert("Failed to save category");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSavingCategory(false);
        }
    };

    const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (loading && !config) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Spinner size="lg" color="primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12 animate-fade-in max-w-[1200px] mx-auto w-full">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center border border-[#3b82f6]/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                        <Ticket size={28} weight="duotone" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">{t.title}</h1>
                        <p className="text-[var(--text-muted)] text-sm mt-0.5">{t.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-[var(--surface-hover)] p-1 rounded-xl border border-[var(--border-divider)]">
                    <Select
                        selectedKeys={[period]}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="w-40"
                        classNames={{
                            trigger: "bg-transparent shadow-none border-none min-h-8 h-8",
                            value: "text-xs font-bold text-[var(--text-secondary)]",
                            popoverContent: "bg-[#111] border border-[var(--border-subtle)]"
                        }}
                        startContent={<CalendarCheck className="text-[var(--text-muted)] shrink-0" size={16} />}
                        disallowEmptySelection
                    >
                        <SelectItem key="24h" classNames={{ base: "text-white" }}>{t.dateDay1}</SelectItem>
                        <SelectItem key="3d" classNames={{ base: "text-white" }}>{t.dateDay3}</SelectItem>
                        <SelectItem key="7d" classNames={{ base: "text-white" }}>{t.dateDay7}</SelectItem>
                        <SelectItem key="14d" classNames={{ base: "text-white" }}>{t.dateDay14}</SelectItem>
                        <SelectItem key="30d" classNames={{ base: "text-white" }}>{t.dateDay30}</SelectItem>
                        <SelectItem key="90d" classNames={{ base: "text-white" }}>{t.dateMonth3}</SelectItem>
                        <SelectItem key="365d" classNames={{ base: "text-white" }}>{t.dateYear1}</SelectItem>
                    </Select>
                </div>
            </div>

            <Tabs
                aria-label="Service Desk Views"
                color="primary"
                variant="light"
                classNames={{
                    tabList: "p-0 gap-8 border-b border-[var(--border-divider)] rounded-none w-full",
                    cursor: "bg-transparent border-b-2 border-white rounded-none w-full",
                    tab: "px-2 py-4 h-auto capitalize",
                    tabContent: "text-sm font-bold group-data-[selected=true]:text-white text-[var(--text-muted)] transition-colors"
                }}
            >
                <Tab
                    key="dashboard"
                    title={
                        <div className="flex items-center gap-2">
                            <ChartBar size={18} weight="duotone" />
                            <span>{t.overview}</span>
                        </div>
                    }
                >
                    <div className="mt-6 space-y-6">
                        {/* Highlights Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                title={t.openTickets}
                                value={globalStats.total}
                                icon={<Ticket size={24} weight="duotone" />}
                            />
                            <StatCard
                                title={t.unsolvedTickets}
                                value={globalStats.open + globalStats.onHold}
                                icon={<CircleDashed size={24} weight="duotone" />}
                                trend={globalStats.open > 0 ? { value: 12, isPositive: false } : undefined}
                            />
                            <StatCard
                                title={t.resolvedTickets}
                                value={globalStats.closed}
                                icon={<CheckCircle size={24} weight="duotone" />}
                                trend={globalStats.closed > 0 ? { value: 8, isPositive: true } : undefined}
                            />
                            <StatCard
                                title={t.avgResolution}
                                value={`${globalStats.avgResolutionMins}m`}
                                icon={<Clock size={24} weight="duotone" />}
                            />
                        </div>

                        {/* Middle Area: Core Analytics */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Activity Chart (Span 2) */}
                            <div className="lg:col-span-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                                    <TrendUp className="text-[var(--text-muted)]" weight="duotone" />
                                    {t.ticketsActivity}
                                </h3>
                                <div className="h-[280px] w-full">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-full"><Spinner size="lg" color="primary" /></div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="#52525b"
                                                    fontSize={11}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    stroke="#52525b"
                                                    fontSize={11}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(val) => val === 0 ? '' : val}
                                                />
                                                <RechartsTooltip
                                                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                                    contentStyle={{
                                                        backgroundColor: '#111',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '12px',
                                                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold'
                                                    }}
                                                    itemStyle={{ color: '#fff' }}
                                                    labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                                                />
                                                <Bar dataKey="created" name={t.openTickets} fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
                                                <Bar dataKey="solved" name={t.resolvedTickets} fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Ticket Categories Breakdown */}
                            <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 shadow-sm flex flex-col">
                                <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                                    <Article className="text-[var(--text-muted)]" weight="duotone" />
                                    {t.ticketsByCategory}
                                </h3>

                                <div className="flex-1 flex flex-col justify-center relative">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-full"><Spinner color="primary" /></div>
                                    ) : globalStats.categoryPieData.length > 0 ? (
                                        <>
                                            <div className="h-[180px] w-full relative mb-6">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={globalStats.categoryPieData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={80}
                                                            paddingAngle={2}
                                                            dataKey="value"
                                                            stroke="none"
                                                            cornerRadius={4}
                                                        >
                                                            {globalStats.categoryPieData.map((entry, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <RechartsTooltip
                                                            contentStyle={{
                                                                backgroundColor: '#111',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                borderRadius: '12px',
                                                                fontSize: '12px',
                                                                fontWeight: 'bold'
                                                            }}
                                                            itemStyle={{ color: '#fff' }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                {/* Center Total */}
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                                                    <span className="text-2xl font-black font-akony text-white leading-none">{globalStats.total}</span>
                                                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Total</span>
                                                </div>
                                            </div>

                                            {/* Legend */}
                                            <div className="space-y-2 overflow-y-auto max-h-[140px] pr-2 custom-scrollbar">
                                                {globalStats.categoryPieData.map((entry, index: number) => (
                                                    <div key={index} className="flex items-center justify-between py-1 group">
                                                        <div className="flex items-center gap-2 truncate pr-2">
                                                            <div className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                                            <span className="text-xs font-semibold text-[var(--text-secondary)] group-hover:text-white transition-colors truncate">{entry.name}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-white tabular-nums bg-[var(--surface-hover)] px-2 py-0.5 rounded-md">{entry.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
                                            <CircleDashed size={32} weight="duotone" className="opacity-20" />
                                            <span className="text-sm font-bold">{t.noData}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row: CSAT */}
                        <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
                                <Users className="text-[var(--text-muted)]" weight="duotone" />
                                {t.customerSatisfaction}
                            </h3>

                            {globalStats.ratings.total > 0 ? (
                                <div className="flex flex-col md:flex-row items-center gap-8">
                                    <div className="flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 border-emerald-500/20 shrink-0 relative">
                                        <span className="text-3xl font-black text-emerald-500 font-akony">
                                            {Math.round((globalStats.ratings.positive / globalStats.ratings.total) * 100)}%
                                        </span>
                                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">CSAT</span>
                                        {/* Sparkles */}
                                        <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                    </div>

                                    <div className="flex-1 w-full space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-xs font-bold">
                                                <span className="text-emerald-500 flex items-center gap-1.5"><ThumbsUp size={14} weight="fill" /> {t.positive}</span>
                                                <span className="text-white tabular-nums bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">{globalStats.ratings.positive}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-[var(--surface-hover)] rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(globalStats.ratings.positive / globalStats.ratings.total) * 100}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-xs font-bold">
                                                <span className="text-amber-500 flex items-center gap-1.5"><HandPeace size={14} weight="fill" /> {t.neutral}</span>
                                                <span className="text-white tabular-nums bg-amber-500/10 px-2 py-0.5 rounded text-[10px]">{globalStats.ratings.neutral}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-[var(--surface-hover)] rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(globalStats.ratings.neutral / globalStats.ratings.total) * 100}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-xs font-bold">
                                                <span className="text-rose-500 flex items-center gap-1.5"><ThumbsDown size={14} weight="fill" /> {t.negative}</span>
                                                <span className="text-white tabular-nums bg-rose-500/10 px-2 py-0.5 rounded text-[10px]">{globalStats.ratings.negative}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-[var(--surface-hover)] rounded-full overflow-hidden">
                                                <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${(globalStats.ratings.negative / globalStats.ratings.total) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-24 flex items-center justify-center border border-dashed border-[var(--border-divider)] rounded-xl text-[var(--text-muted)] text-sm font-bold">
                                    {t.noData}
                                </div>
                            )}
                        </div>
                    </div>
                </Tab>

                <Tab
                    key="settings"
                    title={
                        <div className="flex items-center gap-2">
                            <Gear size={18} weight="duotone" />
                            <span>{t.settings}</span>
                        </div>
                    }
                >
                    <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                        {/* Right Content Column (Categories - main body in Atlassian pattern) */}
                        <div className="xl:col-span-2 space-y-6 xl:order-2">

                            {/* Categories Header/Search */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white">{t.categoriesTitle}</h2>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{t.categoriesDesc}</p>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:w-64">
                                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                        <input
                                            type="text"
                                            placeholder={t.searchCategories}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full h-10 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[#3b82f6] rounded-xl pl-9 pr-4 text-sm text-white placeholder-[var(--text-muted)] outline-none transition-colors"
                                        />
                                    </div>
                                    <button
                                        onClick={openCreateModal}
                                        className="h-10 px-4 rounded-xl bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#2563eb] transition-colors flex items-center gap-2 shrink-0 shadow-sm"
                                    >
                                        <Plus weight="bold" /> <span className="hidden sm:inline">{t.createCategory}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Categories List (Jira Board Style rows) */}
                            <div className="space-y-3">
                                {filteredCategories.length === 0 ? (
                                    <div className="py-12 bg-[var(--surface-card)] border border-dashed border-[var(--border-divider)] rounded-[24px] flex flex-col items-center justify-center text-[var(--text-muted)]">
                                        <Article size={48} weight="duotone" className="mb-4 opacity-50" />
                                        <p className="text-sm font-bold">{searchQuery ? 'No categories found' : 'No categories configured'}</p>
                                    </div>
                                ) : (
                                    filteredCategories.map((cat) => (
                                        <div key={cat.id} className="group bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[#3b82f6]/30 rounded-[24px] p-5 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex items-center justify-between" onClick={() => openEditModal(cat)}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-divider)] flex items-center justify-center shrink-0">
                                                    <span className="text-xl">{cat.buttonEmoji || '📝'}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-white leading-none">{cat.name}</h4>
                                                        {cat.mentionAgents && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider">Alerts</span>}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-medium">
                                                        <span className="flex items-center gap-1.5"><Ticket size={14} /> Total: {cat.stats?.total || 0}</span>
                                                        <span className="w-1 h-1 rounded-full bg-[var(--border-divider)]" />
                                                        <span className="flex items-center gap-1.5 text-emerald-400"><CircleDashed size={14} /> Active: {cat.stats?.active || 0}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] border border-[var(--border-divider)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-white group-hover:bg-[#3b82f6] group-hover:border-[#3b82f6] transition-all">
                                                <Gear size={16} weight="fill" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Left Side Column (Settings & Auditing) */}
                        <div className="xl:col-span-1 space-y-6 xl:order-1 lg:sticky lg:top-8">

                            {/* Global Config Card */}
                            <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
                                    <Scroll className="text-[#8f5eff]" weight="duotone" />
                                    {t.loggingTitle}
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] mb-6 leading-relaxed">
                                    {t.loggingDesc}
                                </p>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-4 border-b border-[var(--border-divider)]">
                                        <span className="text-sm font-bold text-[var(--text-secondary)]">Archive Tickets</span>
                                        <div className="flex items-center h-6">
                                            <Switch
                                                isSelected={config?.enabled}
                                                onValueChange={(v) => handleConfigUpdate({ enabled: v })}
                                                color="success"
                                                size="sm"
                                            />
                                        </div>
                                    </div>

                                    <div className={`transition-opacity duration-300 ${!config?.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <InteractiveSelect
                                            label={t.logChannelLabel}
                                            value={config?.logChannelId || ''}
                                            onChange={(value) => handleConfigUpdate({ logChannelId: value || null })}
                                            placeholder={t.logChannelPlaceholder}
                                            options={logChannelOptions}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Quick Links Card */}
                            <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-2 shadow-sm">
                                <button
                                    className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-[var(--surface-hover)] transition-colors group text-left"
                                    onClick={() => alert("Transcripts viewer is a separate micro-app.")}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white transition-colors">
                                            <Article size={20} weight="duotone" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white mb-0.5">{t.transcripts}</p>
                                            <p className="text-[11px] text-[var(--text-muted)]">{t.transcriptsDesc}</p>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-[var(--surface-hover)] transition-colors group text-left"
                                    onClick={() => alert("Advanced stats is a sub-module.")}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                            <TrendUp size={20} weight="duotone" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white mb-0.5">Advanced Reports</p>
                                            <p className="text-[11px] text-[var(--text-muted)]">Download CSV & detailed SLA metrics.</p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                        </div>
                    </div>
                </Tab>
            </Tabs>

            <CategoryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                category={editingCategory}
                onSave={handleSaveCategory}
                channels={channels.categories}
                saving={savingCategory}
            />
        </div>
    );
}
