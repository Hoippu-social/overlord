import React from 'react';
import { AnalyticsState } from '@/app/dashboard/[guildId]/moderation/types';
import { AnimatedCard, InteractiveSelect, Badge } from '@/components/moderation/ui';
import { StatsCard } from '@/components/stats/StatsCard';
import { ChartLineUp, Users, ShieldCheck, Crosshair } from '@phosphor-icons/react';

interface AnalyticsTabProps {
    analyticsState: AnalyticsState;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
    windowDays: string;
    setWindowDays: (val: string) => void;
}

export function AnalyticsTab({ analyticsState, locale, tr, windowDays, setWindowDays }: AnalyticsTabProps) {

    // Calculate an aggregate FP rate if not provided in summary
    const totalAiReviews = analyticsState.summary.totalAiReviews;
    const totalFalsePositives = analyticsState.moderators.reduce((sum, m) => sum + m.falsePositives, 0);
    const globalFpRate = totalAiReviews > 0 ? totalFalsePositives / totalAiReviews : 0;

    return (
        <div className="space-y-8 animate-fade-in">
            
            {/* Context Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-sm mb-1">{tr('Аналитика Модерации', 'Moderation Analytics')}</h2>
                    <p className="text-sm text-white/50">{tr('Статистика активности персонала и метрики качества ИИ.', 'Staff activity statistics and AI quality metrics.')}</p>
                </div>
                <div className="w-full sm:w-[220px]">
                    <InteractiveSelect
                        value={windowDays}
                        onChange={setWindowDays}
                        options={[
                            { id: '7', name: tr('Последние 7 дней', 'Last 7 Days') },
                            { id: '30', name: tr('Последние 30 дней', 'Last 30 Days') },
                            { id: '90', name: tr('Последние 90 дней', 'Last 90 Days') }
                        ]}
                    />
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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

            {/* Staff Activity Table embedded inside an AnimatedCard */}
            <AnimatedCard title={tr('Активность Персонала', 'Staff Activity')} subtitle={tr('Подробная разбивка действий по каждому модератору.', 'Detailed action breakdown per moderator.')}>
                <div className="overflow-x-auto rounded-[20px] border border-white/10 bg-black/20 shadow-inner">
                    <table className="w-full text-left text-sm text-white/90">
                        <thead className="bg-black/30 text-xs uppercase text-white/40 tracking-[0.2em] border-b border-white/5">
                            <tr>
                                <th className="px-6 py-5 font-bold">{tr('Модератор', 'Moderator')}</th>
                                <th className="px-6 py-5 font-bold text-center">{tr('Бан', 'Bans')}</th>
                                <th className="px-6 py-5 font-bold text-center">{tr('Кик', 'Kicks')}</th>
                                <th className="px-6 py-5 font-bold text-center">{tr('Мьют', 'Mutes & Timeouts')}</th>
                                <th className="px-6 py-5 font-bold text-center">{tr('Варн', 'Warns')}</th>
                                <th className="px-6 py-5 font-bold text-right">{tr('Ревью ИИ', 'AI Reviews')}</th>
                                <th className="px-6 py-5 font-bold text-right">{tr('Всего', 'Total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {analyticsState.moderators.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-white/30 italic">
                                        {tr('Нет данных за выбранный период.', 'No data for the selected period.')}
                                    </td>
                                </tr>
                            ) : (
                                analyticsState.moderators.map((mod, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors group cursor-default">
                                        <td className="px-6 py-5 font-medium flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary-1)]/30 to-[var(--color-primary-1)]/10 border border-[var(--color-primary-1)]/20 flex items-center justify-center text-white font-bold text-sm shadow-inner group-hover:scale-105 transition-transform">
                                                {mod.moderatorId.slice(0, 2)}
                                            </div>
                                            <span className="truncate max-w-[180px] font-semibold tracking-wide">{mod.moderatorId}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center font-mono text-rose-400 font-bold">{mod.bans || 0}</td>
                                        <td className="px-6 py-5 text-center font-mono text-amber-500 font-bold">{mod.kicks || 0}</td>
                                        <td className="px-6 py-5 text-center font-mono text-amber-300 font-bold">{(mod.mutes || 0) + (mod.timeouts || 0)}</td>
                                        <td className="px-6 py-5 text-center font-mono text-blue-400 font-bold">{mod.warns || 0}</td>
                                        <td className="px-6 py-5 text-right font-mono text-white/60">
                                            <Badge variant="default" className="text-white/80 bg-black/40">
                                                {mod.aiReviews} <span className="opacity-40 ml-1">({mod.reversals})</span>
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-bold text-[var(--color-primary-1)] text-xl drop-shadow-md">
                                                {mod.totalActions}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </AnimatedCard>

        </div>
    );
}

