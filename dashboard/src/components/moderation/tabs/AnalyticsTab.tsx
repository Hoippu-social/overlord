import React, { useEffect, useMemo, useState } from 'react';
import { AnalyticsState, AppealTicket, ModerationCase } from '@/app/dashboard/[guildId]/moderation/types';
import { AnimatedCard, InteractiveSelect, Badge } from '@/components/moderation/ui';
import { StatsCard } from '@/components/stats/StatsCard';
import { ChartLineUp, Users, ShieldCheck, Crosshair, UserCircle, Scroll, Gavel } from '@phosphor-icons/react';
import { formatDate } from '@/app/dashboard/[guildId]/moderation/constants';

interface AnalyticsTabProps {
    guildId: string;
    analyticsState: AnalyticsState;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
    windowDays: string;
    setWindowDays: (val: string) => void;
}

type ModeratorDrilldown = {
    cases: ModerationCase[];
    tickets: AppealTicket[];
};

export function AnalyticsTab({ guildId, analyticsState, locale, tr, windowDays, setWindowDays }: AnalyticsTabProps) {
    void locale;

    const [selectedModeratorId, setSelectedModeratorId] = useState<string | null>(null);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [drilldownError, setDrilldownError] = useState<string | null>(null);
    const [drilldown, setDrilldown] = useState<ModeratorDrilldown>({ cases: [], tickets: [] });

    const getModeratorLabel = (moderator: AnalyticsState['moderators'][number]) =>
        moderator.moderatorProfile?.name || moderator.moderatorProfile?.globalName || moderator.moderatorId;

    const getModeratorInitials = (moderator: AnalyticsState['moderators'][number]) =>
        getModeratorLabel(moderator).trim().slice(0, 2).toUpperCase();

    const getRoleBadgeStyle = (moderator: AnalyticsState['moderators'][number]) => {
        const roleColor = moderator.moderatorProfile?.roleColor;
        if (!roleColor) {
            return undefined;
        }

        const color = `#${roleColor.toString(16).padStart(6, '0')}`;
        return {
            color,
            borderColor: `${color}55`,
            backgroundColor: `${color}1A`,
        };
    };

    const selectedModerator =
        analyticsState.moderators.find((moderator) => moderator.moderatorId === selectedModeratorId) ?? null;

    useEffect(() => {
        if (!analyticsState.moderators.length) {
            setSelectedModeratorId(null);
            return;
        }

        setSelectedModeratorId((current) => {
            if (current && analyticsState.moderators.some((moderator) => moderator.moderatorId === current)) {
                return current;
            }
            return analyticsState.moderators[0]?.moderatorId ?? null;
        });
    }, [analyticsState.moderators]);

    useEffect(() => {
        if (!selectedModeratorId) {
            setDrilldown({ cases: [], tickets: [] });
            return;
        }

        let cancelled = false;

        const loadDrilldown = async () => {
            setDrilldownLoading(true);
            setDrilldownError(null);

            try {
                const [casesRes, ticketsRes] = await Promise.all([
                    fetch(`/api/guilds/${guildId}/moderation/cases?limit=100&actorUserId=${encodeURIComponent(selectedModeratorId)}`, { cache: 'no-store' }),
                    fetch(`/api/guilds/${guildId}/moderation/appeals/tickets?limit=100&moderationActorUserId=${encodeURIComponent(selectedModeratorId)}`, { cache: 'no-store' }),
                ]);

                if (!casesRes.ok || !ticketsRes.ok) {
                    throw new Error('Failed to load moderator drilldown.');
                }

                const [casesData, ticketsData] = await Promise.all([casesRes.json(), ticketsRes.json()]);

                if (cancelled) return;

                setDrilldown({
                    cases: Array.isArray(casesData.cases) ? casesData.cases : [],
                    tickets: Array.isArray(ticketsData.tickets) ? ticketsData.tickets : [],
                });
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setDrilldownError(tr('Не удалось загрузить детали модератора.', 'Failed to load moderator details.'));
                }
            } finally {
                if (!cancelled) {
                    setDrilldownLoading(false);
                }
            }
        };

        void loadDrilldown();

        return () => {
            cancelled = true;
        };
    }, [guildId, selectedModeratorId, tr]);

    const totalAiReviews = analyticsState.summary.totalAiReviews;
    const totalFalsePositives = analyticsState.moderators.reduce((sum, moderator) => sum + moderator.falsePositives, 0);
    const globalFpRate = totalAiReviews > 0 ? totalFalsePositives / totalAiReviews : 0;

    const activeDrilldownCases = useMemo(
        () => drilldown.cases.filter((moderationCase) => moderationCase.status === 'ACTIVE').length,
        [drilldown.cases],
    );

    const activeDrilldownTickets = useMemo(
        () => drilldown.tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_REVIEW').length,
        [drilldown.tickets],
    );

    const getActionBadgeVariant = (actionType: string) =>
        actionType === 'BAN' || actionType === 'TEMPBAN' || actionType === 'KICK' ? 'danger' : 'warning';

    const getStatusBadgeVariant = (status: string) =>
        status === 'ACTIVE' || status === 'OPEN' ? 'danger' : status === 'IN_REVIEW' ? 'warning' : 'default';

    const getActionLabel = (actionType: string) => {
        switch (actionType) {
            case 'WARN':
                return tr('Варн', 'Warn');
            case 'MUTE':
                return tr('Мут', 'Mute');
            case 'TIMEOUT':
                return tr('Тайм-аут', 'Timeout');
            case 'KICK':
                return tr('Кик', 'Kick');
            case 'BAN':
                return tr('Бан', 'Ban');
            case 'TEMPBAN':
                return tr('Временный бан', 'Temp Ban');
            default:
                return actionType;
        }
    };

    const getTicketStatusLabel = (status: string) => {
        switch (status) {
            case 'OPEN':
                return tr('Открыт', 'Open');
            case 'IN_REVIEW':
                return tr('В процессе', 'In Review');
            case 'ACCEPTED':
                return tr('Принят', 'Accepted');
            case 'PARDONED':
                return tr('Помилован', 'Pardoned');
            case 'REJECTED':
                return tr('Отклонен', 'Rejected');
            default:
                return status;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="mb-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h2 className="mb-1 text-2xl font-black tracking-tight text-white drop-shadow-sm">
                        {tr('Аналитика Модерации', 'Moderation Analytics')}
                    </h2>
                    <p className="text-sm text-white/50">
                        {tr('Статистика активности персонала и метрики по кейсам и апелляциям.', 'Staff activity statistics, case metrics, and appeal visibility.')}
                    </p>
                </div>
                <div className="w-full sm:w-[220px]">
                    <InteractiveSelect
                        value={windowDays}
                        onChange={setWindowDays}
                        options={[
                            { id: '7', name: tr('Последние 7 дней', 'Last 7 Days') },
                            { id: '30', name: tr('Последние 30 дней', 'Last 30 Days') },
                            { id: '90', name: tr('Последние 90 дней', 'Last 90 Days') },
                        ]}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <StatsCard
                    title={tr('Всего действий', 'Total Actions')}
                    value={analyticsState.summary.totalModeratorActions}
                    icon={<ChartLineUp size={24} weight="duotone" />}
                    accentColor="var(--color-primary-1)"
                />
                <StatsCard
                    title={tr('Активных модераторов', 'Active Staff')}
                    value={analyticsState.summary.uniqueModerators}
                    icon={<Users size={24} weight="duotone" />}
                    accentColor="#3b82f6"
                />
                <StatsCard
                    title={tr('Ревью ИИ', 'AI Reviews')}
                    value={analyticsState.summary.totalAiReviews}
                    icon={<ShieldCheck size={24} weight="duotone" />}
                    accentColor="#10b981"
                />
                <StatsCard
                    title={tr('Точность ИИ (FP)', 'AI False Positives')}
                    value={`${(globalFpRate * 100).toFixed(1)}%`}
                    icon={<Crosshair size={24} weight="duotone" />}
                    accentColor={globalFpRate > 0.15 ? '#f43f5e' : '#f59e0b'}
                />
            </div>

            <AnimatedCard
                title={tr('Активность Персонала', 'Staff Activity')}
                subtitle={tr('Нажмите на модератора, чтобы открыть все его кейсы и связанные апелляции.', 'Click a moderator to inspect all of their cases and related appeal tickets.')}
            >
                <div className="overflow-x-auto rounded-[20px] border border-white/10 bg-black/20 shadow-inner">
                    <table className="w-full text-left text-sm text-white/90">
                        <thead className="border-b border-white/5 bg-black/30 text-xs uppercase tracking-[0.2em] text-white/40">
                            <tr>
                                <th className="px-6 py-5 font-bold">{tr('Модератор', 'Moderator')}</th>
                                <th className="px-6 py-5 font-bold">{tr('Роль', 'Role')}</th>
                                <th className="px-6 py-5 text-center font-bold">{tr('Бан', 'Bans')}</th>
                                <th className="px-6 py-5 text-center font-bold">{tr('Кик', 'Kicks')}</th>
                                <th className="px-6 py-5 text-center font-bold">{tr('Мьют', 'Mutes & Timeouts')}</th>
                                <th className="px-6 py-5 text-center font-bold">{tr('Варн', 'Warns')}</th>
                                <th className="px-6 py-5 text-center font-bold">{tr('Апелляции', 'Appeals')}</th>
                                <th className="px-6 py-5 text-right font-bold">{tr('Всего', 'Total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {analyticsState.moderators.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center italic text-white/30">
                                        {tr('Нет данных за выбранный период.', 'No data for the selected period.')}
                                    </td>
                                </tr>
                            ) : (
                                analyticsState.moderators.map((moderator) => {
                                    const isSelected = selectedModeratorId === moderator.moderatorId;

                                    return (
                                        <tr
                                            key={moderator.moderatorId}
                                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-[var(--color-primary-1)]/10' : 'hover:bg-white/5'}`}
                                            onClick={() => setSelectedModeratorId(moderator.moderatorId)}
                                        >
                                            <td className="px-6 py-5 font-medium">
                                                <div className="flex items-center gap-4">
                                                    {moderator.moderatorProfile?.avatar ? (
                                                        <img
                                                            src={moderator.moderatorProfile.avatar}
                                                            alt={getModeratorLabel(moderator)}
                                                            className="h-10 w-10 rounded-full border border-[var(--color-primary-1)]/20 object-cover shadow-inner"
                                                        />
                                                    ) : (
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-primary-1)]/20 bg-gradient-to-br from-[var(--color-primary-1)]/30 to-[var(--color-primary-1)]/10 text-sm font-bold text-white shadow-inner">
                                                            {getModeratorInitials(moderator)}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="max-w-[220px] truncate font-semibold tracking-wide">{getModeratorLabel(moderator)}</div>
                                                        <div className="max-w-[220px] truncate text-xs text-white/40">
                                                            {moderator.moderatorProfile?.tag || moderator.moderatorId}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span
                                                    className="inline-flex max-w-[180px] truncate rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/75"
                                                    style={getRoleBadgeStyle(moderator)}
                                                >
                                                    {moderator.moderatorProfile?.roleName || tr('Без роли', 'No role')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-center font-mono font-bold text-rose-400">{moderator.bans || 0}</td>
                                            <td className="px-6 py-5 text-center font-mono font-bold text-amber-500">{moderator.kicks || 0}</td>
                                            <td className="px-6 py-5 text-center font-mono font-bold text-amber-300">{(moderator.mutes || 0) + (moderator.timeouts || 0)}</td>
                                            <td className="px-6 py-5 text-center font-mono font-bold text-blue-400">{moderator.warns || 0}</td>
                                            <td className="px-6 py-5 text-center">
                                                <Badge variant="default" className="bg-black/40 text-white/80">
                                                    {moderator.activeRelatedAppealTickets} <span className="opacity-40">/</span> {moderator.relatedAppealTickets}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className="text-xl font-bold text-[var(--color-primary-1)] drop-shadow-md">{moderator.totalActions}</span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </AnimatedCard>

            {selectedModerator ? (
                <AnimatedCard
                    title={tr('Разбор Модератора', 'Moderator Drilldown')}
                    subtitle={`${getModeratorLabel(selectedModerator)} • ${selectedModerator.moderatorProfile?.tag || selectedModerator.moderatorId}`}
                >
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <StatsCard
                            title={tr('Активные кейсы', 'Active Cases')}
                            value={selectedModerator.activeCases}
                            icon={<Gavel size={22} weight="duotone" />}
                            accentColor="#f59e0b"
                        />
                        <StatsCard
                            title={tr('Активные апелляции', 'Active Appeals')}
                            value={selectedModerator.activeRelatedAppealTickets}
                            icon={<Scroll size={22} weight="duotone" />}
                            accentColor="#60a5fa"
                        />
                        <StatsCard
                            title={tr('Все апелляции', 'All Appeals')}
                            value={selectedModerator.relatedAppealTickets}
                            icon={<Scroll size={22} weight="duotone" />}
                            accentColor="#a78bfa"
                        />
                        <StatsCard
                            title={tr('Всего наказаний', 'Total Punishments')}
                            value={selectedModerator.totalActions}
                            icon={<ChartLineUp size={22} weight="duotone" />}
                            accentColor="var(--color-primary-1)"
                        />
                    </div>

                    {drilldownError ? (
                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                            {drilldownError}
                        </div>
                    ) : null}

                    {drilldownLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/50">
                            {tr('Загрузка кейсов и апелляций...', 'Loading cases and appeal tickets...')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            <div className="rounded-[20px] border border-white/10 bg-black/20 p-4 shadow-inner">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/75">
                                        {tr('Наказания', 'Punishments')}
                                    </h3>
                                    <Badge variant="warning">{drilldown.cases.length}</Badge>
                                </div>
                                <div className="custom-scrollbar flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-2">
                                    {drilldown.cases.length === 0 ? (
                                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/35">
                                            {tr('У этого модератора нет кейсов за выбранный период.', 'This moderator has no cases in the selected period.')}
                                        </div>
                                    ) : (
                                        drilldown.cases.map((moderationCase) => (
                                            <div key={moderationCase.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white">#{moderationCase.caseNumber}</span>
                                                        <Badge variant={getActionBadgeVariant(moderationCase.actionType)}>{getActionLabel(moderationCase.actionType)}</Badge>
                                                        <Badge variant={getStatusBadgeVariant(moderationCase.status)}>{moderationCase.status}</Badge>
                                                    </div>
                                                    <span className="font-mono text-xs text-white/35">{formatDate(moderationCase.createdAt)}</span>
                                                </div>
                                                <div className="text-sm text-white/70">
                                                    {tr('Нарушитель:', 'Target:')} <span className="font-semibold text-white/90">{moderationCase.targetProfile?.name || moderationCase.targetProfile?.globalName || moderationCase.targetUserId}</span>
                                                </div>
                                                <div className="mt-2 line-clamp-2 text-xs text-white/45">
                                                    {moderationCase.reason || tr('Причина не указана.', 'No reason provided.')}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="rounded-[20px] border border-white/10 bg-black/20 p-4 shadow-inner">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/75">
                                        {tr('Связанные Апелляции', 'Related Appeals')}
                                    </h3>
                                    <Badge variant="default">{drilldown.tickets.length}</Badge>
                                </div>
                                <div className="custom-scrollbar flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-2">
                                    {drilldown.tickets.length === 0 ? (
                                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/35">
                                            {tr('По наказаниям этого модератора нет апелляций.', 'No appeal tickets reference this moderator’s punishments.')}
                                        </div>
                                    ) : (
                                        drilldown.tickets.map((ticket) => (
                                            <div key={ticket.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white">#{ticket.id}</span>
                                                        <Badge variant={getStatusBadgeVariant(ticket.status)}>{getTicketStatusLabel(ticket.status)}</Badge>
                                                    </div>
                                                    <span className="font-mono text-xs text-white/35">{formatDate(ticket.createdAt)}</span>
                                                </div>
                                                <div className="text-sm text-white/70">
                                                    {tr('Кейс:', 'Case:')} <span className="font-semibold text-white/90">#{ticket.moderationCase.caseNumber}</span>
                                                    <span className="mx-2 text-white/25">•</span>
                                                    <span className="text-white/85">{getActionLabel(ticket.moderationCase.actionType)}</span>
                                                </div>
                                                <div className="mt-2 line-clamp-2 text-xs text-white/45">{ticket.message}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </AnimatedCard>
            ) : null}
        </div>
    );
}
