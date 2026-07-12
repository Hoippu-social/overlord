import React from 'react';
import { ShieldCheck, WarningOctagon, Clock, UserMinus, ShieldSlash, CheckCircle, UserCircle } from '@phosphor-icons/react';
import { CasesState, ModerationCase } from '@/app/dashboard/[guildId]/moderation/types';
import { StatsCard } from '@/components/stats/StatsCard';
import { AnimatedCard, TextField, InteractiveSelect, Badge } from '@/components/moderation/ui';
import { formatDate } from '@/app/dashboard/[guildId]/moderation/constants';

interface OverviewTabProps {
    casesState: CasesState;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
    caseFilter: string;
    setCaseFilter: (v: string) => void;
    caseNumberFilter: string;
    setCaseNumberFilter: (v: string) => void;
    caseStatusFilter: string;
    setCaseStatusFilter: (v: string) => void;
    caseActionFilter: string;
    setCaseActionFilter: (v: string) => void;
    selectedCaseId: number | null;
    setSelectedCaseId: (id: number | null) => void;
}

type CaseUserProfile = NonNullable<ModerationCase['targetProfile']>;

function getUserPrimary(profile: CaseUserProfile | null | undefined, userId: string) {
    return profile?.name || profile?.globalName || profile?.username || userId;
}

function getUserSecondary(profile: CaseUserProfile | null | undefined, userId: string) {
    return profile?.tag || userId;
}

function UserIdentity({
    profile,
    userId,
    accentClass = 'text-white',
    align = 'left',
    compact = false,
}: {
    profile?: CaseUserProfile | null;
    userId: string;
    accentClass?: string;
    align?: 'left' | 'right';
    compact?: boolean;
}) {
    const primary = getUserPrimary(profile, userId);
    const secondary = getUserSecondary(profile, userId);

    return (
        <div className={`flex min-w-0 items-center gap-2.5 ${align === 'right' ? 'justify-end text-right' : ''}`}>
            {profile?.avatar ? (
                <img
                    src={profile.avatar}
                    alt={primary}
                    className={`${compact ? 'h-7 w-7 rounded-md' : 'h-11 w-11 rounded-2xl'} shrink-0 border border-white/10 object-cover shadow-inner`}
                />
            ) : (
                <div className={`${compact ? 'h-7 w-7 rounded-md' : 'h-11 w-11 rounded-2xl'} shrink-0 border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/35 shadow-inner`}>
                    <UserCircle size={compact ? 16 : 24} weight="fill" />
                </div>
            )}
            <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
                <div className={`${compact ? 'text-[12px]' : 'text-sm'} truncate font-bold tracking-wide ${accentClass}`}>{primary}</div>
                {!compact ? <div className="truncate text-xs text-white/40">{secondary}</div> : null}
            </div>
        </div>
    );
}

export function OverviewTab({
    casesState,
    locale,
    tr,
    caseFilter,
    setCaseFilter,
    caseNumberFilter,
    setCaseNumberFilter,
    caseStatusFilter,
    setCaseStatusFilter,
    caseActionFilter,
    setCaseActionFilter,
    selectedCaseId,
    setSelectedCaseId,
}: OverviewTabProps) {
    void locale;

    const filteredCases = React.useMemo(() => {
        const normalizedReason = caseFilter.trim().toLocaleLowerCase();
        const normalizedCaseNumber = caseNumberFilter.trim();

        return casesState.cases.filter((entry) => {
            if (normalizedReason) {
                const reason = (entry.reason || '').toLocaleLowerCase();
                if (!reason.includes(normalizedReason)) {
                    return false;
                }
            }

            if (normalizedCaseNumber) {
                if (!String(entry.caseNumber).includes(normalizedCaseNumber)) {
                    return false;
                }
            }

            if (caseStatusFilter && entry.status !== caseStatusFilter) {
                return false;
            }

            if (caseActionFilter && entry.actionType !== caseActionFilter) {
                return false;
            }

            return true;
        });
    }, [caseActionFilter, caseFilter, caseNumberFilter, caseStatusFilter, casesState.cases]);

    const selectedCase = filteredCases.find((entry) => entry.id === selectedCaseId) ?? null;

    React.useEffect(() => {
        if (selectedCaseId !== null && !filteredCases.some((entry) => entry.id === selectedCaseId)) {
            setSelectedCaseId(filteredCases[0]?.id ?? null);
        }
    }, [filteredCases, selectedCaseId, setSelectedCaseId]);

    const activeTimed = casesState.cases.filter(
        (entry) => entry.status === 'ACTIVE' && entry.expiresAt && new Date(entry.expiresAt).getTime() > Date.now(),
    );

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return tr('Активен', 'Active');
            case 'CLEARED':
                return tr('Снят', 'Cleared');
            case 'EXPIRED':
                return tr('Истек', 'Expired');
            case 'REVERTED':
                return tr('Отменен', 'Reverted');
            default:
                return status;
        }
    };

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
            case 'UNWARN':
                return tr('Снятие варна', 'Unwarn');
            case 'UNMUTE':
                return tr('Размут', 'Unmute');
            case 'UNTIMEOUT':
                return tr('Снятие тайм-аута', 'Remove Timeout');
            case 'UNBAN':
                return tr('Разбан', 'Unban');
            default:
                return actionType;
        }
    };

    const getSourceLabel = (source: string) => {
        switch (source.toLowerCase()) {
            case 'manual':
                return tr('Вручную', 'Manual');
            case 'system':
                return tr('Система', 'System');
            case 'automod':
                return tr('Автомод', 'AutoMod');
            default:
                return source;
        }
    };

    const getStatusVariant = (status: string) => (status === 'ACTIVE' ? 'danger' : 'default');

    const getActionVariant = (actionType: string) =>
        actionType === 'BAN' || actionType === 'TEMPBAN' || actionType === 'KICK' ? 'danger' : 'warning';

    const getActionIcon = (actionType: string) => {
        if (actionType === 'BAN' || actionType === 'TEMPBAN' || actionType === 'UNBAN') return UserMinus;
        if (actionType === 'MUTE' || actionType === 'UNMUTE') return ShieldSlash;
        if (actionType === 'TIMEOUT' || actionType === 'UNTIMEOUT') return Clock;
        return WarningOctagon;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4" data-tour="mod-overview-cards">
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
                    accentColor="#60a5fa"
                />
                <StatsCard
                    title={tr('Временные наказания', 'Timed Punishments')}
                    value={casesState.summary.timed}
                    icon={<Clock size={24} weight="duotone" />}
                    accentColor="#fcd34d"
                />
            </div>

            {activeTimed.length > 0 && (
                <div className="custom-scrollbar flex snap-x gap-4 overflow-x-auto pb-4">
                    {activeTimed.map((entry) => (
                        <div
                            key={entry.id}
                            className="snap-start flex min-w-[320px] shrink-0 flex-col gap-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-transform hover:-translate-y-1 hover:bg-white/[0.05]"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <Badge variant={getActionVariant(entry.actionType)}>
                                    #{entry.caseNumber} {getActionLabel(entry.actionType)}
                                </Badge>
                                <span className="rounded-md bg-black/30 px-2 py-1 font-mono text-xs text-white/40">
                                    {formatDate(entry.expiresAt, tr('Без срока', 'No expiry'))}
                                </span>
                            </div>
                            <UserIdentity profile={entry.targetProfile} userId={entry.targetUserId} compact />
                            <div className="line-clamp-2 text-xs italic text-white/55">
                                &ldquo;{entry.reason || tr('Причина не указана', 'No reason specified')}&rdquo;
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col items-start gap-8 lg:flex-row">
                <div className="flex w-full flex-col gap-6 lg:w-[60%]" data-tour="mod-cases-feed">
                    <AnimatedCard
                        title={tr('Лента Действий', 'Recent Actions')}
                        subtitle={tr('Управление и фильтрация всех модерационных кейсов.', 'Manage and filter all moderation cases.')}
                    >
                        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <TextField
                                value={caseFilter}
                                onChange={setCaseFilter}
                                placeholder={tr('Поиск по причине...', 'Search reason...')}
                            />
                            <TextField
                                value={caseNumberFilter}
                                onChange={setCaseNumberFilter}
                                placeholder={tr('Кейс #', 'Case #')}
                            />
                            <InteractiveSelect
                                value={caseStatusFilter}
                                onChange={setCaseStatusFilter}
                                options={[
                                    { id: 'ACTIVE', name: tr('Активен', 'Active') },
                                    { id: 'EXPIRED', name: tr('Истек', 'Expired') },
                                    { id: 'CLEARED', name: tr('Снят', 'Cleared') },
                                ]}
                                placeholder={tr('Статус', 'Status')}
                            />
                            <InteractiveSelect
                                value={caseActionFilter}
                                onChange={setCaseActionFilter}
                                options={[
                                    { id: 'WARN', name: tr('Варн', 'Warn'), color: '#60a5fa' },
                                    { id: 'MUTE', name: tr('Мут', 'Mute'), color: '#fcd34d' },
                                    { id: 'TIMEOUT', name: tr('Тайм-аут', 'Timeout'), color: '#fcd34d' },
                                    { id: 'KICK', name: tr('Кик', 'Kick'), color: '#f59e0b' },
                                    { id: 'BAN', name: tr('Бан', 'Ban'), color: '#fb7185' },
                                    { id: 'TEMPBAN', name: tr('Временный бан', 'Temp Ban'), color: '#fb7185' },
                                ]}
                                placeholder={tr('Действие', 'Action')}
                            />
                        </div>

                        <div className="custom-scrollbar flex max-h-[600px] flex-col gap-4 overflow-y-auto pr-2">
                            {filteredCases.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] py-16 text-white/30">
                                    <CheckCircle size={48} weight="duotone" className="mb-4 text-[var(--color-primary-1)] opacity-50" />
                                    <p className="text-lg font-semibold">{tr('Здесь чисто', 'All clear')}</p>
                                    <p className="mt-1 text-sm">{tr('Нет кейсов, соответствующих фильтрам.', 'No cases match filtering.')}</p>
                                </div>
                            ) : (
                                filteredCases.map((entry) => {
                                    const isSelected = selectedCaseId === entry.id;
                                    const ActionIcon = getActionIcon(entry.actionType);

                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => setSelectedCaseId(entry.id)}
                                            className={`group relative flex min-h-[104px] w-full items-start gap-4 overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
                                                isSelected
                                                    ? 'border-[#7AAA7A] bg-gradient-to-r from-[var(--color-primary-1)]/10 via-[var(--color-primary-1)]/4 to-transparent shadow-[0_0_32px_rgba(var(--color-primary-1-rgb),0.16)]'
                                                    : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]'
                                            }`}
                                        >
                                            <div
                                                className={`pointer-events-none absolute inset-0 transition-opacity ${
                                                    isSelected
                                                        ? 'bg-[radial-gradient(circle_at_left_center,rgba(var(--color-primary-1-rgb),0.14),transparent_58%)] opacity-100'
                                                        : 'bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100'
                                                }`}
                                            />

                                            <div className="relative z-10 mt-1 shrink-0">
                                                <div
                                                    className={`rounded-xl bg-black/40 p-2 ${
                                                        entry.actionType === 'BAN' || entry.actionType === 'TEMPBAN' || entry.actionType === 'KICK'
                                                            ? 'text-rose-400'
                                                            : entry.actionType === 'WARN'
                                                                ? 'text-blue-400'
                                                                : 'text-amber-300'
                                                    }`}
                                                >
                                                    <ActionIcon size={24} weight="duotone" />
                                                </div>
                                            </div>

                                            <div className="relative z-10 flex-1 min-w-0 py-1">
                                                <div className="mb-3 flex min-w-0 items-center gap-2">
                                                    <span className="text-lg font-black text-white drop-shadow-md">#{entry.caseNumber}</span>
                                                    <span className="text-sm text-white/25">|</span>
                                                    <div className="min-w-0 max-w-[220px]">
                                                        <UserIdentity profile={entry.targetProfile} userId={entry.targetUserId} compact />
                                                    </div>
                                                    <span className="text-sm text-white/25">|</span>
                                                    <span
                                                        className={`truncate text-[12px] font-bold uppercase tracking-wide ${
                                                            entry.actionType === 'BAN' || entry.actionType === 'TEMPBAN' || entry.actionType === 'KICK'
                                                                ? 'text-rose-400'
                                                                : entry.actionType === 'WARN'
                                                                    ? 'text-blue-400'
                                                                    : 'text-amber-300'
                                                        }`}
                                                    >
                                                        {getActionLabel(entry.actionType)}
                                                    </span>
                                                    <Badge variant={getStatusVariant(entry.status)} className="origin-left scale-90">
                                                        {getStatusLabel(entry.status)}
                                                    </Badge>
                                                </div>

                                                <p className="line-clamp-2 pr-4 text-xs text-white/50">
                                                    {entry.reason || tr('Причина не указана.', 'No reason provided.')}
                                                </p>
                                            </div>

                                            <div className="relative z-10 hidden shrink-0 text-right sm:flex sm:flex-col sm:items-end sm:gap-2">
                                                <span className="rounded-lg border border-white/5 bg-black/40 px-2 py-1 font-mono text-xs text-white/40">
                                                    {formatDate(entry.createdAt)}
                                                </span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-1)]">
                                                    {getSourceLabel(entry.source)}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </AnimatedCard>
                </div>

                <div className="w-full lg:sticky lg:top-[90px] lg:w-[40%]" data-tour="mod-case-details">
                    <AnimatedCard
                        title={tr('Детали кейса', 'Case Details')}
                        subtitle={tr('Подробная информация о нарушении', 'Detailed violation info')}
                    >
                        {!selectedCase ? (
                            <div className="flex h-[400px] flex-col items-center justify-center p-10 text-center text-white/30">
                                <ShieldCheck size={64} weight="thin" className="mb-6 opacity-20" />
                                <p className="text-lg font-medium">{tr('Выберите кейс', 'Select a case')}</p>
                                <p className="mt-2 max-w-[200px] text-sm">
                                    {tr('Выберите кейс из списка слева, чтобы посмотреть его историю.', 'Select a case from the timeline to view its history.')}
                                </p>
                            </div>
                        ) : (
                            <div className="relative flex flex-col gap-6 animate-fade-in">
                                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 bg-black/50 shadow-inner">
                                            <span className="text-2xl font-black text-white">#{selectedCase.caseNumber}</span>
                                        </div>
                                        <div>
                                            <Badge variant={getActionVariant(selectedCase.actionType)} className="px-3 py-1 text-sm uppercase">
                                                {getActionLabel(selectedCase.actionType)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Badge variant={getStatusVariant(selectedCase.status)} className="px-4 py-1.5 text-sm uppercase shadow-lg">
                                        {getStatusLabel(selectedCase.status)}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 p-4 sm:flex-row sm:items-center">
                                        <span className="text-xs font-bold uppercase tracking-widest text-white/40">
                                            {tr('Нарушитель', 'Target User')}
                                        </span>
                                        <UserIdentity profile={selectedCase.targetProfile} userId={selectedCase.targetUserId} accentClass="text-white" align="right" />
                                    </div>
                                    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 p-4 sm:flex-row sm:items-center">
                                        <span className="text-xs font-bold uppercase tracking-widest text-white/40">
                                            {tr('Модератор', 'Moderator')}
                                        </span>
                                        {selectedCase.actorUserId ? (
                                            <UserIdentity
                                                profile={selectedCase.actorProfile}
                                                userId={selectedCase.actorUserId}
                                                accentClass="text-[var(--color-primary-1)]"
                                                align="right"
                                            />
                                        ) : (
                                            <span className="rounded-lg bg-[var(--color-primary-1)]/10 px-3 py-1.5 text-sm font-bold text-[var(--color-primary-1)]">
                                                {tr('Система', 'System')}
                                            </span>
                                        )}
                                    </div>
                                    {selectedCase.status === 'CLEARED' && selectedCase.resolvedByUserId ? (
                                        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 p-4 sm:flex-row sm:items-center">
                                            <span className="text-xs font-bold uppercase tracking-widest text-white/40">
                                                {tr('Кто снял', 'Cleared By')}
                                            </span>
                                            <UserIdentity
                                                profile={selectedCase.resolvedByProfile}
                                                userId={selectedCase.resolvedByUserId}
                                                accentClass="text-[var(--color-primary-1)]"
                                                align="right"
                                            />
                                        </div>
                                    ) : null}

                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                                            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                                                {tr('Выдан', 'Issued')}
                                            </div>
                                            <div className="font-mono text-xs text-white/80">{formatDate(selectedCase.createdAt)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                                            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                                                {tr('Истекает', 'Expires')}
                                            </div>
                                            <div className="font-mono text-xs text-white/80">
                                                {formatDate(selectedCase.expiresAt, tr('Без срока', 'Never'))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative mt-2 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5 shadow-lg">
                                    <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[var(--color-primary-1)]/10 blur-3xl" />
                                    <div className="relative z-10 mb-3 text-xs font-bold uppercase tracking-widest text-white/50">
                                        {tr('Причина наказания', 'Reason for Action')}
                                    </div>
                                    <p className="relative z-10 text-base italic leading-relaxed text-white/90">
                                        &ldquo;{selectedCase.reason || tr('Причина не указана', 'No reason specified')}&rdquo;
                                    </p>
                                </div>

                                {selectedCase.notes && selectedCase.notes.length > 0 && (
                                    <div className="mt-4 space-y-4">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50">
                                            <span>{tr('Заметки персонала', 'Staff Notes')}</span>
                                            <span className="h-px flex-1 bg-white/10" />
                                        </div>
                                        <div className="space-y-3">
                                            {selectedCase.notes.map((note) => (
                                                <div key={note.id} className="relative rounded-2xl border border-white/5 bg-black/30 p-4">
                                                    <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl bg-blue-500/50" />
                                                    <div className="mb-3 text-sm text-white/90">{note.note}</div>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
                                                        <span>{tr('Автор:', 'By')}</span>
                                                        <span className="text-white/70">
                                                            {getUserPrimary(note.actorProfile, note.actorUserId)}
                                                        </span>
                                                        <span>{tr('в', 'at')}</span>
                                                        <span className="font-mono">{formatDate(note.createdAt)}</span>
                                                    </div>
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
