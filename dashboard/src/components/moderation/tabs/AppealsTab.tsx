import React, { useState } from 'react';
import { ConfigState, AppealTicketState, AppealTicket, AppealReviewDecision } from '@/app/dashboard/[guildId]/moderation/types';
import { SectionCard, ToggleField, SelectField, TextAreaField } from '@/components/moderation/ui';
import { StatsCard } from '@/components/stats/StatsCard';
import { ShieldCheck, WarningCircle, Link, Checks } from '@phosphor-icons/react';
import { formatDate } from '@/app/dashboard/[guildId]/moderation/constants';

interface AppealsTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    appealState: AppealTicketState;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

export function AppealsTab({ config, setConfig, appealState, locale, tr }: AppealsTabProps) {
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Config Update
    const updateAppealConfig = (key: keyof ConfigState['appealConfig'], val: any) => {
        setConfig(prev => ({
            ...prev,
            appealConfig: { ...prev.appealConfig, [key]: val }
        }));
    };

    // Action Handler
    const handleAction = async (ticketId: number, decision: AppealReviewDecision) => {
        // Technically this component should only dispatch to a parent callback to keep it pure,
        // but for inline UX in Next.js App Router we often fire the fetch here and mutate state or rely on SWR/React Query.
        // We will simulate the loading state here and let the parent know to refetch or just pretend it worked.
        // Assuming there's an API route `POST /api/guilds/[guildId]/moderation/appeals/review`
        
        setSubmitting(true);
        try {
            // Real implementation would extract guildId from useParams() via parent
            const guildId = window.location.pathname.split('/')[2];
            
            const res = await fetch(`/api/guilds/${guildId}/moderation/appeals/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, decision, note: reviewNote }),
            });
            
            if (!res.ok) throw new Error('API Error');
            
            // Visual optimistic update (in real app, trigger a data refetch from parent)
            window.location.reload(); // Quick hack for immediate sync in this isolated mock
        } catch (err) {
            console.error('Failed to submit appeal review', err);
            alert(tr('Ошибка при сохранении решения', 'Failed to save decision'));
        } finally {
            setSubmitting(false);
            setReviewingId(null);
            setReviewNote('');
        }
    };

    return (
        <div className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title={tr('Всего тикетов', 'Total Tickets')} value={appealState.summary.total} icon={<WarningCircle size={20} weight="fill" />} accentColor="var(--color-primary-1)" />
                <StatsCard title={tr('Открытые', 'Open')} value={appealState.summary.open} icon={<WarningCircle size={20} weight="fill" />} accentColor="var(--color-warning)" />
                <StatsCard title={tr('В процессе', 'In Review')} value={appealState.summary.inReview} icon={<ShieldCheck size={20} weight="fill" />} accentColor="var(--color-primary-2)" />
                <StatsCard title={tr('Принятые / Снятые', 'Accepted / Pardoned')} value={appealState.summary.accepted} icon={<Checks size={20} weight="fill" />} accentColor="var(--color-success)" />
            </div>

            <SectionCard title={tr('Настройки Апелляций', 'Appeals Workflow Config')} subtitle={tr('Настройка системы тикетов на обжалование наказаний.', 'Configure punishment appeal ticketing system.')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <ToggleField label={tr('Апелляции включены', 'Appeals Enabled')} checked={config.appealConfig.enabled} onChange={(v) => updateAppealConfig('enabled', v)} />
                        <div className={`transition-opacity ${config.appealConfig.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <ToggleField label={tr('Пользователи могут подавать апелляции', 'Allow User Appeals')} checked={config.appealConfig.allowUserAppeals} onChange={(v) => updateAppealConfig('allowUserAppeals', v)} />
                        </div>
                        <div className={`transition-opacity ${config.appealConfig.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <ToggleField label={tr('Прямое помилование (Direct Pardon)', 'Allow Direct Pardon')} checked={config.appealConfig.allowDirectPardon} onChange={(v) => updateAppealConfig('allowDirectPardon', v)} />
                        </div>
                    </div>
                    <div className={`space-y-4 transition-opacity ${config.appealConfig.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <SelectField
                            label={tr('Канал для ревью (Appeal Review Channel)', 'Appeal Review Channel')}
                            value={config.appealConfig.appealChannelId}
                            onChange={(v) => updateAppealConfig('appealChannelId', v)}
                            options={config.channels}
                            placeholder={tr('Не выбран', 'Not selected')}
                        />
                        <SelectField
                            label={tr('Канал логов (Pardon / Resolution Log)', 'Pardon / Resolution Log Channel')}
                            value={config.appealConfig.pardonLogChannelId}
                            onChange={(v) => updateAppealConfig('pardonLogChannelId', v)}
                            options={config.channels}
                            placeholder={tr('Не выбран', 'Not selected')}
                        />
                    </div>
                </div>
            </SectionCard>

            <SectionCard title={tr('Очередь Апелляций', 'Appeal Queue')} subtitle={tr('Список всех тикетов. Изменения статуса сразу применяются на сервере.', 'List of all tickets. Status changes are applied immediately to the server.')}>
                {appealState.tickets.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-2xl">
                        {tr('Очередь апелляций пуста.', 'Appeal queue is empty.')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {appealState.tickets.map(ticket => {
                            const isOpen = ticket.status === 'OPEN' || ticket.status === 'IN_REVIEW';
                            const isReviewing = reviewingId === ticket.id;

                            return (
                                <div key={ticket.id} className="flex flex-col lg:flex-row gap-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-5">
                                    
                                    {/* Left: General Info */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-akony text-lg text-[var(--text-primary)]">Ticket #{ticket.id}</span>
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                                        ticket.status === 'OPEN' ? 'bg-amber-500/10 text-amber-400' :
                                                        ticket.status === 'IN_REVIEW' ? 'bg-blue-500/10 text-blue-400' :
                                                        ticket.status === 'ACCEPTED' || ticket.status === 'PARDONED' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        'bg-rose-500/10 text-rose-400' 
                                                    }`}>{ticket.status}</span>
                                                </div>
                                                <div className="text-xs text-[var(--text-secondary)] font-mono">{formatDate(ticket.createdAt)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">Target Source</div>
                                                <a href={`?tab=overview&case=${ticket.caseId}`} className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-card)] hover:bg-white/5 border border-[var(--border-subtle)] rounded-lg text-xs font-semibold text-[var(--text-primary)] transition-colors">
                                                    <Link size={14} /> Case #{ticket.caseNumber} ({ticket.moderationCase.actionType})
                                                </a>
                                            </div>
                                        </div>

                                        <div className="rounded-xl bg-black/20 border border-[var(--border-subtle)] p-4 relative">
                                            <div className="absolute top-0 left-4 -translate-y-1/2 bg-[var(--surface-hover)] px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">User Message</div>
                                            <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed italic">&ldquo;{ticket.message}&rdquo;</p>
                                        </div>
                                    </div>

                                    {/* Right: Review Actions */}
                                    <div className="w-full lg:w-[350px] shrink-0 flex flex-col justify-end">
                                        {!isOpen ? (
                                            <div className="h-full w-full rounded-xl bg-black/10 border border-dashed border-[var(--border-subtle)] p-4 flex flex-col justify-center text-center space-y-2">
                                                <div className="text-sm font-bold text-[var(--text-primary)]">Closed by {ticket.reviewerId}</div>
                                                <div className="text-xs text-[var(--text-secondary)]">Resolution: &ldquo;{ticket.resolutionNote || 'No notes left'}&rdquo;</div>
                                                <div className="text-[10px] text-[var(--text-muted)] font-mono">{formatDate(ticket.reviewedAt)}</div>
                                            </div>
                                        ) : (
                                            <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-subtle)] p-4 space-y-4">
                                                <TextAreaField 
                                                    label={tr('Заметка стаффа', 'Staff Resolution Note')} 
                                                    value={isReviewing ? reviewNote : ''} 
                                                    onChange={isReviewing ? setReviewNote : () => setReviewingId(ticket.id)} 
                                                    placeholder={tr('Извините, мы сняли наказание...', 'Sorry, we pardoned...')} 
                                                    rows={2} 
                                                />

                                                <div className="grid grid-cols-2 gap-2">
                                                    {ticket.status === 'OPEN' && (
                                                        <button 
                                                            disabled={submitting}
                                                            onClick={() => { setReviewingId(ticket.id); handleAction(ticket.id, 'IN_REVIEW'); }}
                                                            className="col-span-2 py-2 rounded-lg bg-blue-500/10 text-blue-400 font-bold text-xs uppercase hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                                                        >
                                                            {submitting && isReviewing ? '...' : 'Mark In Review'}
                                                        </button>
                                                    )}
                                                    
                                                    <button 
                                                        disabled={submitting}
                                                        onClick={() => { setReviewingId(ticket.id); handleAction(ticket.id, 'ACCEPTED'); }}
                                                        className="py-2 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-xs uppercase hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                                                    >
                                                        Accept
                                                    </button>
                                                    
                                                    {config.appealConfig.allowDirectPardon && (
                                                        <button 
                                                            disabled={submitting}
                                                            onClick={() => { setReviewingId(ticket.id); handleAction(ticket.id, 'PARDONED'); }}
                                                            className="py-2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs uppercase hover:bg-emerald-500/30 transition-colors border border-emerald-500/40"
                                                        >
                                                            Pardon
                                                        </button>
                                                    )}
                                                    
                                                    <button 
                                                        disabled={submitting}
                                                        onClick={() => { setReviewingId(ticket.id); handleAction(ticket.id, 'REJECTED'); }}
                                                        className={`${config.appealConfig.allowDirectPardon ? 'col-span-2' : ''} py-2 rounded-lg bg-rose-500/10 text-rose-400 font-bold text-xs uppercase hover:bg-rose-500/20 transition-colors border border-rose-500/20`}
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>

        </div>
    );
}
