'use client';

import React, { useState } from 'react';
import { Confetti, Ticket, Trophy, Plus, TrendUp, X } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import type {
    EconomyWorkspaceData,
    EventWindow,
    Lottery,
    Season,
    SeasonResultRow,
} from '@/lib/economy/types';
import { getEconomyCopy } from '@/lib/economy/i18n';
import { formatMoney, formatMultiplier, formatDateTime } from '@/lib/economy/format';
import {
    createEventWindow,
    createLottery,
    drawLottery,
    cancelEvent,
    endSeason,
    loadHallOfFame,
} from '@/lib/economy/api';
import {
    Panel,
    EmptyState,
    Chip,
    Toggle,
    LabeledField,
    MoneyField,
    NumberField,
    ChannelSelect,
    ActionButton,
    ModalShell,
    AgentAvatar,
    type Tone,
} from '@/components/economy/primitives';

interface EventsPanelProps {
    guildId: string;
    data: EconomyWorkspaceData;
    locale: LocaleCode;
    onSaved: () => void;
}

function toLocalInputValue(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function localInputToISO(value: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

const WINDOW_STATUS_TONE: Record<string, Tone> = {
    SCHEDULED: 'info',
    ACTIVE: 'primary',
    DONE: 'neutral',
    CANCELLED: 'danger',
};
const LOTTERY_STATUS_TONE: Record<string, Tone> = {
    OPEN: 'primary',
    DRAWN: 'neutral',
    CANCELLED: 'danger',
};

function DateTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors focus:border-[var(--color-primary-1)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-1)]/10 [color-scheme:dark]"
        />
    );
}

export function EventsPanel({ guildId, data, locale, onSaved }: EventsPanelProps) {
    const t = getEconomyCopy(locale);
    const channelName = (id: string | null) => {
        if (!id) return null;
        const c = data.channels.find((ch) => ch.id === id);
        return c ? `#${c.name}` : id;
    };

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // modal state
    const [modal, setModal] = useState<null | 'airdrop' | 'multiplier' | 'lottery' | 'endSeason'>(null);

    // airdrop form
    const [airAmount, setAirAmount] = useState<string | null>('1000');
    const [airChannel, setAirChannel] = useState<string | null>(null);

    // multiplier form
    const [mulValue, setMulValue] = useState<number | null>(2);
    const [mulChannel, setMulChannel] = useState<string | null>(null);
    const [mulStarts, setMulStarts] = useState<string>(toLocalInputValue(new Date().toISOString()));
    const [mulEnds, setMulEnds] = useState<string>(toLocalInputValue(new Date(Date.now() + 3600_000).toISOString()));

    // lottery form
    const [lotPrice, setLotPrice] = useState<string | null>('100');
    const [lotHouseCut, setLotHouseCut] = useState<number | null>(500);
    const [lotChannel, setLotChannel] = useState<string | null>(null);
    const [lotEnds, setLotEnds] = useState<string>(toLocalInputValue(new Date(Date.now() + 86400_000).toISOString()));

    // end-season form
    const [resetBalances, setResetBalances] = useState(false);

    // hall of fame
    const [hof, setHof] = useState<SeasonResultRow[] | null>(null);
    const [hofLoading, setHofLoading] = useState(false);

    const activeSeason: Season | undefined = data.seasons.find((s) => s.status === 'ACTIVE');

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            setModal(null);
            onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : t.saveFailed);
        } finally {
            setBusy(false);
        }
    };

    const submitAirdrop = () =>
        run(async () => {
            const now = new Date();
            await createEventWindow(guildId, {
                type: 'AIRDROP',
                amount: airAmount ?? '0',
                channelId: airChannel ?? undefined,
                startsAt: now.toISOString(),
                endsAt: new Date(now.getTime() + 3600_000).toISOString(),
            });
        });

    const submitMultiplier = () =>
        run(async () => {
            const startsAt = localInputToISO(mulStarts);
            const endsAt = localInputToISO(mulEnds);
            if (!startsAt || !endsAt) throw new Error(t.saveFailed);
            await createEventWindow(guildId, {
                type: 'MULTIPLIER',
                multiplier: mulValue ?? 1,
                channelId: mulChannel ?? undefined,
                startsAt,
                endsAt,
            });
        });

    const submitLottery = () =>
        run(async () => {
            const endsAt = localInputToISO(lotEnds);
            if (!endsAt) throw new Error(t.saveFailed);
            await createLottery(guildId, {
                ticketPrice: lotPrice ?? '0',
                houseCutBps: lotHouseCut ?? 0,
                endsAt,
                channelId: lotChannel ?? undefined,
            });
        });

    const submitEndSeason = () => run(async () => { await endSeason(guildId, { resetBalances }); });

    const loadHof = async () => {
        setHofLoading(true);
        setError(null);
        try {
            const rows = await loadHallOfFame(guildId);
            setHof(rows);
        } catch (e) {
            setError(e instanceof Error ? e.message : t.error);
        } finally {
            setHofLoading(false);
        }
    };

    return (
        <div className="space-y-5 animate-fade-in">
            {error && (
                <div className="rounded-2xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 px-4 py-3 text-xs font-bold text-[var(--color-destructive)]">
                    {error}
                </div>
            )}

            <Panel
                title={t.events.airdrops}
                icon={<Confetti weight="duotone" />}
                action={
                    <div className="flex gap-2">
                        <ActionButton variant="primary" onClick={() => setModal('airdrop')}>
                            <Plus size={14} weight="bold" /> {t.events.createAirdrop}
                        </ActionButton>
                        <ActionButton onClick={() => setModal('multiplier')}>
                            <TrendUp size={14} weight="bold" /> {t.events.createMultiplier}
                        </ActionButton>
                    </div>
                }
            >
                {data.eventWindows.length === 0 ? (
                    <EmptyState title={t.events.noEvents} icon={<Confetti size={40} weight="duotone" />} />
                ) : (
                    <ul className="space-y-2">
                        {data.eventWindows.map((w: EventWindow) => {
                            const cancellable = w.status === 'ACTIVE' || w.status === 'SCHEDULED';
                            return (
                                <li
                                    key={w.id}
                                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 px-4 py-3"
                                >
                                    <Chip tone={w.type === 'AIRDROP' ? 'primary' : 'info'}>{w.type}</Chip>
                                    <span className="text-sm font-bold text-white tabular-nums">
                                        {w.type === 'AIRDROP'
                                            ? formatMoney(w.amount ?? '0')
                                            : formatMultiplier(w.multiplier ?? 1)}
                                    </span>
                                    {channelName(w.channelId) && (
                                        <span className="text-xs text-[var(--text-secondary)]">{channelName(w.channelId)}</span>
                                    )}
                                    <span className="text-xs text-[var(--text-secondary)]">
                                        {formatDateTime(w.startsAt, locale)} → {formatDateTime(w.endsAt, locale)}
                                    </span>
                                    <div className="ml-auto flex items-center gap-2">
                                        <Chip tone={WINDOW_STATUS_TONE[w.status] ?? 'neutral'}>{w.status}</Chip>
                                        {cancellable && (
                                            <button
                                                onClick={() => run(() => cancelEvent(guildId, 'event-window', w.id))}
                                                disabled={busy}
                                                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] disabled:opacity-50"
                                                aria-label="cancel"
                                            >
                                                <X size={15} weight="bold" />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p className="mt-3 text-[11px] text-[var(--text-secondary)]">
                    {locale === 'ru'
                        ? 'Бот запускает airdrop и активирует окна в течение ~1 минуты.'
                        : 'The bot executes airdrops and activates windows within ~1 minute.'}
                </p>
            </Panel>

            <Panel
                title={t.events.lotteries}
                icon={<Ticket weight="duotone" />}
                action={
                    <ActionButton variant="primary" onClick={() => setModal('lottery')}>
                        <Plus size={14} weight="bold" /> {t.events.createLottery}
                    </ActionButton>
                }
            >
                {data.lotteries.length === 0 ? (
                    <EmptyState title={t.events.noLotteries} icon={<Ticket size={40} weight="duotone" />} />
                ) : (
                    <ul className="space-y-2">
                        {data.lotteries.map((lot: Lottery) => (
                            <li
                                key={lot.id}
                                className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 px-4 py-3"
                            >
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {t.events.ticketPrice}:{' '}
                                    <span className="font-bold text-white tabular-nums">{formatMoney(lot.ticketPrice)}</span>
                                </span>
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {t.events.pot}:{' '}
                                    <span className="font-bold text-white tabular-nums">{formatMoney(lot.pot)}</span>
                                </span>
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {t.events.tickets}:{' '}
                                    <span className="font-bold text-white tabular-nums">{lot.ticketCount}</span>
                                </span>
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {t.events.endsAt}: {formatDateTime(lot.endsAt, locale)}
                                </span>
                                <div className="ml-auto flex items-center gap-2">
                                    <Chip tone={LOTTERY_STATUS_TONE[lot.status] ?? 'neutral'}>{lot.status}</Chip>
                                    {lot.status === 'OPEN' && (
                                        <>
                                            <ActionButton
                                                onClick={() => run(() => drawLottery(guildId, lot.id))}
                                                disabled={busy}
                                            >
                                                {t.events.draw}
                                            </ActionButton>
                                            <button
                                                onClick={() => run(() => cancelEvent(guildId, 'lottery', lot.id))}
                                                disabled={busy}
                                                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] disabled:opacity-50"
                                                aria-label="cancel"
                                            >
                                                <X size={15} weight="bold" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-3 text-[11px] text-[var(--text-secondary)]">
                    {locale === 'ru'
                        ? 'Розыгрыш выполняется ботом в течение ~1 минуты.'
                        : 'Draws are performed by the bot within ~1 minute.'}
                </p>
            </Panel>

            <Panel title={t.events.seasons} icon={<Trophy weight="duotone" />}>
                {activeSeason ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                {t.events.currentSeason}
                            </p>
                            <p className="mt-1 text-sm font-bold text-white">
                                #{activeSeason.number}
                                {activeSeason.name ? ` · ${activeSeason.name}` : ''}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                {formatDateTime(activeSeason.startsAt, locale)}
                            </p>
                        </div>
                        <ActionButton variant="danger" onClick={() => setModal('endSeason')}>
                            {t.events.endSeason}
                        </ActionButton>
                    </div>
                ) : (
                    <EmptyState title={t.events.noEvents} icon={<Trophy size={40} weight="duotone" />} />
                )}

                <div className="mt-4 border-t border-[var(--border-divider)] pt-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            {t.events.hallOfFame}
                        </p>
                        <ActionButton onClick={loadHof} disabled={hofLoading}>
                            {hofLoading ? t.loading : t.events.hallOfFame}
                        </ActionButton>
                    </div>
                    {hof && (
                        hof.length === 0 ? (
                            <p className="mt-3 text-xs text-[var(--text-secondary)]">{t.overview.noData}</p>
                        ) : (
                            <ol className="mt-3 space-y-1.5">
                                {hof.map((row) => (
                                    <li
                                        key={row.userId}
                                        className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 px-3 py-2"
                                    >
                                        <span className="w-6 text-center font-akony text-xs font-black text-[var(--color-primary-1)] tabular-nums">
                                            {row.rank}
                                        </span>
                                        <AgentAvatar name={row.displayName || row.userId} size={26} />
                                        <span className="flex-1 truncate text-sm font-semibold text-white">
                                            {row.displayName || row.userId}
                                        </span>
                                        <span className="text-sm font-bold text-white tabular-nums">
                                            {formatMoney(row.totalEarned)}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )
                    )}
                </div>
            </Panel>

            {modal === 'airdrop' && (
                <ModalShell
                    title={t.events.createAirdrop}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            <ActionButton onClick={() => setModal(null)}>{t.events.cancel}</ActionButton>
                            <ActionButton variant="primary" onClick={submitAirdrop} disabled={busy}>
                                {t.events.confirm}
                            </ActionButton>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <LabeledField label={t.events.amount}>
                            <MoneyField value={airAmount} onChange={setAirAmount} className="text-right tabular-nums" />
                        </LabeledField>
                        <LabeledField label={t.events.channel}>
                            <ChannelSelect value={airChannel} onChange={setAirChannel} channels={data.channels} />
                        </LabeledField>
                    </div>
                </ModalShell>
            )}

            {modal === 'multiplier' && (
                <ModalShell
                    title={t.events.createMultiplier}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            <ActionButton onClick={() => setModal(null)}>{t.events.cancel}</ActionButton>
                            <ActionButton variant="primary" onClick={submitMultiplier} disabled={busy}>
                                {t.events.confirm}
                            </ActionButton>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <LabeledField label={t.events.multiplier}>
                            <NumberField value={mulValue} min={0} step={0.5} onChange={setMulValue} />
                        </LabeledField>
                        <LabeledField label={t.events.channel}>
                            <ChannelSelect value={mulChannel} onChange={setMulChannel} channels={data.channels} />
                        </LabeledField>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <LabeledField label={t.events.startsAt}>
                                <DateTimeInput value={mulStarts} onChange={setMulStarts} />
                            </LabeledField>
                            <LabeledField label={t.events.endsAt}>
                                <DateTimeInput value={mulEnds} onChange={setMulEnds} />
                            </LabeledField>
                        </div>
                    </div>
                </ModalShell>
            )}

            {modal === 'lottery' && (
                <ModalShell
                    title={t.events.createLottery}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            <ActionButton onClick={() => setModal(null)}>{t.events.cancel}</ActionButton>
                            <ActionButton variant="primary" onClick={submitLottery} disabled={busy}>
                                {t.events.confirm}
                            </ActionButton>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <LabeledField label={t.events.ticketPrice}>
                            <MoneyField value={lotPrice} onChange={setLotPrice} className="text-right tabular-nums" />
                        </LabeledField>
                        <LabeledField label="house cut (bps)">
                            <NumberField value={lotHouseCut} min={0} max={10000} onChange={setLotHouseCut} />
                        </LabeledField>
                        <LabeledField label={t.events.channel}>
                            <ChannelSelect value={lotChannel} onChange={setLotChannel} channels={data.channels} />
                        </LabeledField>
                        <LabeledField label={t.events.endsAt}>
                            <DateTimeInput value={lotEnds} onChange={setLotEnds} />
                        </LabeledField>
                    </div>
                </ModalShell>
            )}

            {modal === 'endSeason' && (
                <ModalShell
                    title={t.events.endSeason}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            <ActionButton onClick={() => setModal(null)}>{t.events.cancel}</ActionButton>
                            <ActionButton variant="danger" onClick={submitEndSeason} disabled={busy}>
                                {t.events.confirm}
                            </ActionButton>
                        </>
                    }
                >
                    <label className="flex items-center gap-3 text-sm font-bold text-[var(--text-secondary)]">
                        <Toggle checked={resetBalances} onChange={setResetBalances} label={t.events.resetBalances} />
                        {t.events.resetBalances}
                    </label>
                </ModalShell>
            )}
        </div>
    );
}
