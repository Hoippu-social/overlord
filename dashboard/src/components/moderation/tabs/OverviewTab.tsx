import React from 'react';
import { ShieldCheck, WarningOctagon, Clock, UserMinus, ShieldSlash, CheckCircle } from '@phosphor-icons/react';
import { CasesState } from '@/app/dashboard/[guildId]/moderation/types';
import { StatsCard } from '@/components/stats/StatsCard';
import { AnimatedCard, TextField, InteractiveSelect, Badge } from '@/components/moderation/ui';
import { formatDate } from '@/app/dashboard/[guildId]/moderation/constants';

interface OverviewTabProps {
    casesState: CasesState;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
    caseFilter: string; setCaseFilter: (v: string) => void;
    caseNumberFilter: string; setCaseNumberFilter: (v: string) => void;
    caseStatusFilter: string; setCaseStatusFilter: (v: string) => void;
    caseActionFilter: string; setCaseActionFilter: (v: string) => void;
    selectedCaseId: number | null; setSelectedCaseId: (id: number | null) => void;
}

export function OverviewTab({
    casesState,
    locale,
    tr,
    caseFilter, setCaseFilter,
    caseNumberFilter, setCaseNumberFilter,
    caseStatusFilter, setCaseStatusFilter,
    caseActionFilter, setCaseActionFilter,
    selectedCaseId, setSelectedCaseId
}: OverviewTabProps) {

    const selectedCase = casesState.cases.find(c => c.id === selectedCaseId);

    const activeTimed = casesState.cases.filter(
        c => c.status === 'ACTIVE' && c.expiresAt && new Date(c.expiresAt).getTime() > Date.now()
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Top Stat Cards Hero Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title={tr('Всего кейсов', 'Total Cases')}
                    value={casesState.summary.total}
                    icon={<ShieldCheck size={24} weight="duotone" />}
                    accentColor="var(--color-primary-1)"
                />
                <StatsCard
                    title={tr('Активные', 'Active Cases')}
                    value={casesState.summary.active}
                    icon={<WarningOctagon size={24} weight="duotone" />}
                    accentColor="#f59e0b"
                />
                <StatsCard
                    title={tr('Предупреждения', 'Warnings')}
                    value={casesState.summary.warnings}
                    icon={<ShieldSlash size={24} weight="duotone" />}
                    accentColor="#f43f5e"
                />
                <StatsCard
                    title={tr('Временные мьюты/баны', 'Timed Punishments')}
                    value={casesState.summary.timed}
                    icon={<Clock size={24} weight="duotone" />}
                    accentColor="#8b5cf6"
                />
            </div>

            {/* Active Timed Punishments Feed - Horizontal Scroller */}
            {activeTimed.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                    {activeTimed.map(c => (
                        <div key={c.id} className="snap-start min-w-[300px] shrink-0 rounded-[20px] border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-3 transition-transform hover:-translate-y-1 hover:bg-white/[0.05]">
                            <div className="flex items-center justify-between">
                                <Badge variant="danger">#{c.caseNumber} {c.actionType}</Badge>
                                <span className="text-xs text-white/40 font-mono bg-black/30 px-2 py-1 rounded-md">{formatDate(c.expiresAt)}</span>
                            </div>
                            <div className="text-sm text-white/90 font-bold truncate tracking-wide">Target: {c.targetUserId}</div>
                            <div className="text-xs text-white/50 line-clamp-2 italic">&ldquo;{c.reason || 'No reason'}&rdquo;</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Dual Column Area */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
                
                {/* Left Column: CASE MANAGEMENT (60%) */}
                <div className="w-full lg:w-[60%] flex flex-col gap-6">
                    <AnimatedCard title={tr('Лента Действий', 'Recent Actions')} subtitle={tr('Управление и фильтрация всех модерационных кейсов.', 'Manage and filter all moderation cases.')}>
                        {/* Filters Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                            <TextField 
                                value={caseFilter} 
                                onChange={setCaseFilter} 
                                placeholder={tr('Поиск по причине...', 'Search reason...')} 
                            />
                            <TextField 
                                value={caseNumberFilter} 
                                onChange={setCaseNumberFilter} 
                                placeholder="Case #" 
                            />
                            <InteractiveSelect 
                                value={caseStatusFilter}
                                onChange={setCaseStatusFilter}
                                options={[
                                    { id: 'ACTIVE', name: 'Active' },
                                    { id: 'CLEARED', name: 'Cleared' },
                                    { id: 'EXPIRED', name: 'Expired' }
                                ]}
                                placeholder={tr('Статус', 'Status')}
                            />
                            <InteractiveSelect 
                                value={caseActionFilter}
                                onChange={setCaseActionFilter}
                                options={[
                                    { id: 'WARN', name: 'Warn' },
                                    { id: 'MUTE', name: 'Mute' },
                                    { id: 'KICK', name: 'Kick' },
                                    { id: 'BAN', name: 'Ban' }
                                ]}
                                placeholder={tr('Действие', 'Action')}
                            />
                        </div>

                        {/* Animated Case Timeline Feed */}
                        <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {casesState.cases.length === 0 ? (
                                <div className="py-16 flex flex-col items-center justify-center text-white/30 border border-white/5 bg-white/[0.02] rounded-3xl">
                                    <CheckCircle size={48} weight="duotone" className="mb-4 opacity-50 text-[var(--color-primary-1)]" />
                                    <p className="text-lg font-semibold">{tr('Здесь чисто', 'All clear')}</p>
                                    <p className="text-sm mt-1">{tr('Нет кейсов, соответствующих фильтрам.', 'No cases match filtering.')}</p>
                                </div>
                            ) : (
                                casesState.cases.map(c => {
                                    const isSelected = selectedCaseId === c.id;
                                    const ActionIcon = c.actionType === 'BAN' ? UserMinus : c.actionType === 'MUTE' ? ShieldSlash : WarningOctagon;
                                    
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedCaseId(c.id)}
                                            className={`relative flex items-start gap-4 text-left w-full p-4 rounded-2xl transition-all duration-300 group overflow-hidden ${
                                                isSelected 
                                                ? 'bg-gradient-to-r from-[var(--color-primary-1)]/20 to-transparent border-l-4 border-[var(--color-primary-1)]' 
                                                : 'bg-white/[0.03] border-l-4 border-transparent hover:bg-white/[0.06]'
                                            }`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                            
                                            <div className="mt-1 flex-shrink-0 relative z-10">
                                                <div className={`p-2 rounded-xl bg-black/40 ${c.actionType === 'BAN' || c.actionType === 'KICK' ? 'text-rose-400' : 'text-amber-400'}`}>
                                                    <ActionIcon size={24} weight="duotone" />
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 min-w-0 relative z-10">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-black text-lg text-white drop-shadow-md">#{c.caseNumber}</span>
                                                    <Badge variant={c.status === 'ACTIVE' ? 'danger' : 'default'} className="scale-90 origin-left">
                                                        {c.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm font-semibold text-white/80 truncate">User: <span className="text-white">{c.targetUserId}</span></p>
                                                <p className="text-xs text-white/50 line-clamp-1 mt-1 pr-4">{c.reason || 'No reason provided.'}</p>
                                            </div>
                                            
                                            <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0 text-right relative z-10">
                                                <span className="text-xs text-white/40 font-mono bg-black/40 px-2 py-1 rounded-lg border border-white/5">{formatDate(c.createdAt)}</span>
                                                <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-primary-1)]">{c.source}</span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </AnimatedCard>
                </div>

                {/* Right Column: DETAIL PANEL (40%) */}
                <div className="w-full lg:w-[40%] lg:sticky lg:top-[90px]">
                    <AnimatedCard title={tr('Детали кейса', 'Case Details')} subtitle={tr('Подробная информация о нарушении', 'Detailed violation info')}>
                        {!selectedCase ? (
                            <div className="flex flex-col items-center justify-center p-10 text-center text-white/30 h-[400px]">
                                <ShieldCheck size={64} weight="thin" className="mb-6 opacity-20" />
                                <p className="text-lg font-medium">{tr('Выберите дело', 'Select a case')}</p>
                                <p className="text-sm mt-2 max-w-[200px]">{tr('Выберите кейс из списка слева, чтобы посмотреть его историю.', 'Select a case from the timeline to view its history.')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 animate-fade-in relative">
                                {/* Header badge */}
                                <div className="flex items-center justify-between pb-6 border-b border-white/10">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-black/50 border border-white/5 w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner">
                                            <span className="text-2xl font-black text-white">#{selectedCase.caseNumber}</span>
                                        </div>
                                        <div>
                                            <Badge variant={selectedCase.actionType === 'BAN' ? 'danger' : 'warning'} className="text-sm px-3 py-1 uppercase">{selectedCase.actionType}</Badge>
                                        </div>
                                    </div>
                                    <Badge variant={selectedCase.status === 'ACTIVE' ? 'danger' : 'default'} className="px-4 py-1.5 text-sm uppercase shadow-lg">
                                        {selectedCase.status}
                                    </Badge>
                                </div>

                                {/* Main Data Grid - Glassy Panels */}
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                        <span className="text-xs uppercase font-bold text-white/40 tracking-widest">Target User</span>
                                        <span className="text-sm font-bold text-white bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 break-all">{selectedCase.targetUserId}</span>
                                    </div>
                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                        <span className="text-xs uppercase font-bold text-white/40 tracking-widest">Moderator</span>
                                        <span className="text-sm font-bold text-[var(--color-primary-1)] bg-[var(--color-primary-1)]/10 px-3 py-1.5 rounded-lg break-all">{selectedCase.actorUserId || 'System AutoMod'}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                                            <div className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">Issued</div>
                                            <div className="text-xs text-white/80 font-mono">{formatDate(selectedCase.createdAt)}</div>
                                        </div>
                                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                                            <div className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">Expires</div>
                                            <div className="text-xs text-white/80 font-mono">{formatDate(selectedCase.expiresAt, 'Never')}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Reason Block */}
                                <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 p-5 mt-2 shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary-1)]/10 blur-3xl rounded-full" />
                                    <div className="text-xs uppercase font-bold text-white/50 tracking-widest mb-3 relative z-10">Reason for Action</div>
                                    <p className="text-base text-white/90 leading-relaxed italic relative z-10">&ldquo;{selectedCase.reason || 'No reason specified'}&rdquo;</p>
                                </div>

                                {/* Notes Block */}
                                {selectedCase.notes && selectedCase.notes.length > 0 && (
                                    <div className="space-y-4 mt-4">
                                        <div className="text-xs uppercase font-bold text-white/50 tracking-widest flex items-center gap-2">
                                            <span>Staff Notes</span>
                                            <span className="h-px bg-white/10 flex-1" />
                                        </div>
                                        <div className="space-y-3">
                                            {selectedCase.notes.map(note => (
                                                <div key={note.id} className="relative p-4 rounded-2xl bg-black/30 border border-white/5">
                                                    <div className="w-1.5 h-full absolute left-0 top-0 bg-blue-500/50 rounded-l-2xl" />
                                                    <div className="text-sm text-white/90 mb-2">{note.note}</div>
                                                    <div className="text-xs text-white/40 font-mono">By <span className="text-white/60">{note.actorUserId}</span> at {formatDate(note.createdAt)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </AnimatedCard>
                </div>
            </div>
        </div>
    );
}

