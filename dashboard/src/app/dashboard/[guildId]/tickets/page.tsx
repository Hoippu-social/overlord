'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Card,
    CardBody,
    Button,
    Input,
    Spinner,
    Switch,
    Select,
    SelectItem,
    Chip,
    Divider,
    Tooltip,
    Tabs,
    Tab
} from '@nextui-org/react';
import {
    Ticket,
    Gear,
    Warning,
    ChartBar,
    Scroll,
    CheckCircle,
    XCircle,
    Article,
    TrendUp,
    Clock,
    CalendarCheck,
    ThumbsUp,
    ThumbsDown,
    HandPeace
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import CategoryModal, { CategoryData } from '@/components/tickets/CategoryModal';
import { StatsCard } from '@/components/stats/StatsCard';
import { usePersistentPeriod } from '@/hooks/usePersistentPeriod';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
    messagePayload: string | any;
    buttonText: string;
    buttonEmoji: string | null;
    buttonStyle: string;
};

type ChannelOption = {
    id: string;
    name?: string;
    type?: number | string;
};

const MESSAGES = {
    en: {
        title: "Tickets",
        subtitle: "Manage support tickets and settings.",
        overview: "Dashboard",
        settings: "Configuration",
        loggingTitle: "Logging",
        loggingDesc: "Store transcripts and events in a separate channel.",
        logChannelLabel: "Log Channel",
        logChannelPlaceholder: "Select a channel...",
        adminToolsTitle: "Admin Tools",
        transcripts: "Transcripts",
        transcriptsDesc: "View history of closed tickets.",
        statistics: "Statistics",
        statisticsDesc: "Agent performance & insights.",
        categoriesTitle: "Categories",
        categoriesDesc: "Support topics available to users.",
        createCategory: "Create Category",
        activeTickets: "Active",
        totalTickets: "Total",
        edit: "Configure",
        save: "Save",
        saved: "Saved",
        auditLogWarn: "Please select a channel to enable logging.",
        soon: "Soon",
        openTickets: "Created Tickets",
        unsolvedTickets: "Unsolved Tickets",
        resolvedTickets: "Solved Tickets",
        avgResolution: "Avg First Time Reply",
        ticketsActivity: "Average Tickets Created",
        ticketsByCategory: "Ticket By Categories",
        customerSatisfaction: "Customer Satisfaction",
        dateDay1: "24 Hours",
        dateDay3: "3 Days",
        dateDay7: "7 Days",
        dateDay14: "14 Days",
        dateDay30: "30 Days",
        dateMonth3: "90 Days",
        dateYear1: "365 Days",
        positive: "Positive",
        neutral: "Neutral",
        negative: "Negative",
        noData: "Empty"
    },
    ru: {
        title: "Тикеты",
        subtitle: "Управление системой поддержки.",
        overview: "Обзор",
        settings: "Настройки",
        loggingTitle: "Логирование",
        loggingDesc: "Сохранение транскриптов и событий в канал.",
        logChannelLabel: "Канал для логов",
        logChannelPlaceholder: "Выберите канал...",
        adminToolsTitle: "Инструменты",
        transcripts: "Транскрипты",
        transcriptsDesc: "История закрытых обращений.",
        statistics: "Статистика",
        statisticsDesc: "Эффективность агентов.",
        categoriesTitle: "Категории",
        categoriesDesc: "Темы обращений для пользователей.",
        createCategory: "Создать раздел",
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
        avgResolution: "Среднее время",
        ticketsActivity: "Активность обращений",
        ticketsByCategory: "Тикеты по категориям",
        customerSatisfaction: "Удовлетворенность",
        dateDay1: "24 часа",
        dateDay3: "3 дня",
        dateDay7: "7 дней",
        dateDay14: "14 дней",
        dateDay30: "30 дней",
        dateMonth3: "90 дней",
        dateYear1: "365 дней",
        positive: "Позитивно",
        neutral: "Нейтрально",
        negative: "Негативно",
        noData: "Пусто"
    }
};

const PIE_COLORS = ['#34C759', '#FF9F0A', '#AF52DE', '#FF3B30', '#5AC8FA', '#FFCC00'];

export default function TicketsPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const router = useRouter();
    const { locale } = useGuildLocale(guildId);
    const t = MESSAGES[locale as keyof typeof MESSAGES] || MESSAGES.en;

    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<TicketConfig | null>(null);
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [channels, setChannels] = useState<{ text: ChannelOption[], categories: ChannelOption[] }>({ text: [], categories: [] });

    // Stats State
    const [globalStats, setGlobalStats] = useState<any>({ open: 0, onHold: 0, closed: 0, total: 0, avgResolutionMins: 0, ratings: { positive: 0, neutral: 0, negative: 0, total: 0 }, categoryPieData: [] });
    const [activityData, setActivityData] = useState<any[]>([]);

    const [period, setPeriod] = usePersistentPeriod('7d');
    const [savingConfig, setSavingConfig] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<TicketCategory | null>(null);
    const [savingCategory, setSavingCategory] = useState(false);

    // Fetch Data
    const fetchData = async () => {
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
                if (data.globalStats) setGlobalStats(data.globalStats);
                if (data.activityData) setActivityData(data.activityData);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (guildId) fetchData();
    }, [guildId, period]);

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
            let url = `/api/guilds/${guildId}/tickets`;
            let method = 'POST';

            if (isEdit) {
                alert("Editing implementation pending Backend Update. Only creation logic is connected.");
                setIsModalOpen(false);
                setSavingCategory(false);
                return;
            }

            const res = await fetch(url, {
                method,
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

    if (loading && !config) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Spinner size="lg" color="primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10 animate-fade-in min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/10 flex items-center justify-center backdrop-blur-sm shadow-xl flex-shrink-0">
                        <Ticket size={32} weight="fill" className="text-violet-500 drop-shadow-lg" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">
                            {t.title}
                        </h1>
                        <p className="text-default-400 font-medium">{t.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-[#18181b]/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md w-full md:w-auto">
                    <Select
                        labelPlacement="outside"
                        selectedKeys={[period]}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="flex-1 md:w-40"
                        classNames={{
                            trigger: "bg-transparent shadow-none hover:bg-white/5 border-0 min-h-10 h-10 data-[focus=true]:bg-white/5 justify-between",
                            value: "text-small font-medium group-data-[has-value=true]:text-white",
                            popoverContent: "bg-[#18181b] border border-white/10 dark"
                        }}
                        startContent={<CalendarCheck className="text-default-400" size={16} />}
                        disallowEmptySelection
                    >
                        <SelectItem key="24h">{t.dateDay1}</SelectItem>
                        <SelectItem key="3d">{t.dateDay3}</SelectItem>
                        <SelectItem key="7d">{t.dateDay7}</SelectItem>
                        <SelectItem key="14d">{t.dateDay14}</SelectItem>
                        <SelectItem key="30d">{t.dateDay30}</SelectItem>
                        <SelectItem key="90d">{t.dateMonth3}</SelectItem>
                        <SelectItem key="365d">{t.dateYear1}</SelectItem>
                    </Select>
                </div>
            </div>

            <Tabs
                aria-label="Options"
                color="primary"
                variant="solid"
                classNames={{
                    tabList: "bg-[#18181b]/60 border border-white/5 p-1 rounded-2xl backdrop-blur-md",
                    cursor: "bg-primary shadow-lg",
                    tab: "h-10 font-semibold",
                    tabContent: "group-data-[selected=true]:text-white text-default-400"
                }}
            >
                <Tab
                    key="dashboard"
                    title={
                        <div className="flex items-center space-x-2">
                            <ChartBar size={20} />
                            <span>{t.overview}</span>
                        </div>
                    }
                >
                    <div className="mt-6 space-y-6">
                        {/* 4 Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatsCard
                                title={t.openTickets}
                                value={globalStats.total}
                                loading={loading}
                                icon={<Ticket size={24} weight="fill" />}
                            />
                            <StatsCard
                                title={t.unsolvedTickets}
                                value={globalStats.open + globalStats.onHold}
                                loading={loading}
                                icon={<Warning size={24} weight="fill" />}
                            />
                            <StatsCard
                                title={t.resolvedTickets}
                                value={globalStats.closed}
                                loading={loading}
                                icon={<CheckCircle size={24} weight="fill" />}
                            />
                            <StatsCard
                                title={t.avgResolution}
                                value={`${globalStats.avgResolutionMins} min`}
                                loading={loading}
                                icon={<Clock size={24} weight="fill" />}
                            />
                        </div>

                        {/* Mid Row: Activity Chart */}
                        <Card className="bg-[#18181b]/60 backdrop-blur-md border border-white/5 shadow-lg rounded-2xl">
                            <CardBody className="p-6">
                                <h3 className="text-lg font-bold text-white mb-6">{t.ticketsActivity}</h3>
                                <div className="h-[300px] w-full">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Spinner color="primary" />
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="#52525b"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    stroke="#52525b"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                />
                                                <RechartsTooltip
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(24, 24, 27, 0.9)',
                                                        backdropFilter: 'blur(8px)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '12px',
                                                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                                                    }}
                                                    itemStyle={{ color: '#fff' }}
                                                    labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                />
                                                <Bar dataKey="created" name={t.openTickets} fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="solved" name={t.resolvedTickets} fill="#10B981" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </CardBody>
                        </Card>

                        {/* Bottom Row: Category Pie & Satisfaction */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="bg-[#18181b]/60 backdrop-blur-md border border-white/5 shadow-lg rounded-2xl">
                                <CardBody className="p-6 flex flex-col md:flex-row items-center gap-8">
                                    <div className="w-full md:w-1/2">
                                        <h3 className="text-lg font-bold text-white mb-6">{t.ticketsByCategory}</h3>
                                        <div className="h-[250px] w-full">
                                            {loading ? (
                                                <div className="flex items-center justify-center h-full"><Spinner /></div>
                                            ) : globalStats.categoryPieData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={globalStats.categoryPieData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={80}
                                                            paddingAngle={5}
                                                            dataKey="value"
                                                        >
                                                            {globalStats.categoryPieData.map((entry: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <RechartsTooltip
                                                            contentStyle={{
                                                                backgroundColor: 'rgba(24, 24, 27, 0.9)',
                                                                backdropFilter: 'blur(8px)',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                borderRadius: '12px',
                                                            }}
                                                            itemStyle={{ color: '#fff' }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-default-400">{t.noData}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Pie Chart Legend */}
                                    <div className="w-full md:w-1/2 space-y-3">
                                        {!loading && globalStats.categoryPieData.map((entry: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                                    <span className="text-sm font-medium text-white">{entry.name}</span>
                                                </div>
                                                <span className="text-sm text-default-400">{entry.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="bg-[#18181b]/60 backdrop-blur-md border border-white/5 shadow-lg rounded-2xl">
                                <CardBody className="p-6">
                                    <h3 className="text-lg font-bold text-white mb-6">{t.customerSatisfaction}</h3>

                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <p className="text-default-400 text-sm">{t.totalTickets}</p>
                                            <p className="text-3xl font-black text-white">{globalStats.ratings.total}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Positive */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2 text-emerald-500">
                                                    <ThumbsUp size={18} weight="fill" />
                                                    <span className="font-semibold text-sm">{t.positive}</span>
                                                </div>
                                                <span className="font-bold text-emerald-500">
                                                    {globalStats.ratings.total > 0 ? Math.round((globalStats.ratings.positive / globalStats.ratings.total) * 100) : 0}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-emerald-500/10 overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full"
                                                    style={{ width: `${globalStats.ratings.total > 0 ? (globalStats.ratings.positive / globalStats.ratings.total) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Neutral */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2 text-amber-500">
                                                    <HandPeace size={18} weight="fill" />
                                                    <span className="font-semibold text-sm">{t.neutral}</span>
                                                </div>
                                                <span className="font-bold text-amber-500">
                                                    {globalStats.ratings.total > 0 ? Math.round((globalStats.ratings.neutral / globalStats.ratings.total) * 100) : 0}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-amber-500/10 overflow-hidden">
                                                <div
                                                    className="h-full bg-amber-500 rounded-full"
                                                    style={{ width: `${globalStats.ratings.total > 0 ? (globalStats.ratings.neutral / globalStats.ratings.total) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Negative */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2 text-rose-500">
                                                    <ThumbsDown size={18} weight="fill" />
                                                    <span className="font-semibold text-sm">{t.negative}</span>
                                                </div>
                                                <span className="font-bold text-rose-500">
                                                    {globalStats.ratings.total > 0 ? Math.round((globalStats.ratings.negative / globalStats.ratings.total) * 100) : 0}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-rose-500/10 overflow-hidden">
                                                <div
                                                    className="h-full bg-rose-500 rounded-full"
                                                    style={{ width: `${globalStats.ratings.total > 0 ? (globalStats.ratings.negative / globalStats.ratings.total) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </div>
                </Tab>

                <Tab
                    key="settings"
                    title={
                        <div className="flex items-center space-x-2">
                            <Gear size={20} />
                            <span>{t.settings}</span>
                        </div>
                    }
                >
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <Card className="lg:col-span-3 bg-[#18181b]/60 backdrop-blur-md border border-white/5 shadow-lg rounded-2xl">
                            <CardBody className="p-6 space-y-6">
                                {/* Logging */}
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Switch
                                            isSelected={config?.enabled}
                                            onValueChange={(v) => handleConfigUpdate({ enabled: v })}
                                            classNames={{
                                                wrapper: "group-data-[selected=true]:bg-primary"
                                            }}
                                        />
                                        <span className="font-bold text-white">{t.logChannelLabel}</span>
                                    </div>

                                    <Select
                                        placeholder={t.logChannelPlaceholder}
                                        selectedKeys={config?.logChannelId ? [config.logChannelId] : []}
                                        onSelectionChange={(keys) => handleConfigUpdate({ logChannelId: Array.from(keys)[0] as string })}
                                        items={channels.text}
                                        isDisabled={!config?.enabled}
                                        className="w-full md:w-64"
                                        classNames={{
                                            trigger: "bg-[#0A0B0E] border border-white/5 h-12 rounded-xl",
                                            popoverContent: "bg-[#181A20] border border-white/10"
                                        }}
                                        renderValue={(items) => items.map(item => <span key={item.key} className="text-white font-medium">#{item.textValue}</span>)}
                                    >
                                        {(item) => <SelectItem key={item.id} textValue={item.name} classNames={{ base: "data-[hover=true]:bg-white/5 text-default-400 data-[hover=true]:text-white" }}>#{item.name}</SelectItem>}
                                    </Select>
                                </div>

                                {/* Categories List */}
                                <div className="space-y-4">
                                    {categories.map((cat) => (
                                        <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-[#0A0B0E] hover:border-white/10 transition-colors">
                                            <div className="flex flex-col">
                                                <div className="font-bold text-lg text-white mb-1">Раздел #{cat.name}</div>
                                                <div className="text-sm text-default-500">
                                                    {t.totalTickets}: <span className="text-white font-medium">{cat.stats?.total || 0}</span> ; {t.activeTickets}: <span className="text-white font-medium">{cat.stats?.active || 0}</span>
                                                </div>
                                            </div>
                                            <Button isIconOnly size="sm" variant="flat" color="primary" className="bg-primary/10 text-primary" onPress={() => openEditModal(cat)}>
                                                <Gear size={20} weight="fill" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                {/* Create Button */}
                                <Button
                                    color="primary"
                                    variant="flat"
                                    onPress={openCreateModal}
                                    className="w-full h-12 rounded-xl bg-primary/10 text-primary font-semibold text-base hover:bg-primary/20 transition-colors"
                                >
                                    {t.createCategory}
                                </Button>
                            </CardBody>
                        </Card>

                        <div className="lg:col-span-1 space-y-8">
                            <Card className="bg-[#18181b]/60 backdrop-blur-md border border-white/5 shadow-lg rounded-2xl min-h-[200px] flex flex-col p-6">
                                <h3 className="text-lg font-bold text-white mb-4 text-center">{t.adminToolsTitle}</h3>
                                <div className="space-y-3 flex flex-col h-full justify-center">
                                    <Button
                                        variant="flat"
                                        color="primary"
                                        className="w-full bg-primary/10 text-primary justify-start font-semibold h-11 rounded-xl hover:bg-primary/20 transition-colors"
                                        startContent={<Article size={20} weight="fill" />}
                                        onPress={() => router.push(`/dashboard/${guildId}/tickets/transcripts`)}
                                    >
                                        {t.transcripts}
                                    </Button>
                                    <Button
                                        variant="flat"
                                        color="primary"
                                        className="w-full bg-primary/10 text-primary justify-start font-semibold h-11 rounded-xl hover:bg-primary/20 transition-colors"
                                        startContent={<TrendUp size={20} weight="fill" />}
                                        onPress={() => router.push(`/dashboard/${guildId}/tickets/stats`)}
                                    >
                                        {t.statistics}
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    </div>
                </Tab>
            </Tabs>

            <CategoryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                category={editingCategory as any}
                onSave={handleSaveCategory}
                channels={channels.categories}
                saving={savingCategory}
            />
        </div>
    );
}
