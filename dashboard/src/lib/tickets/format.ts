import type { LocaleCode } from '@/lib/i18n';
import type { SlaState, TicketStatus, TransferStatus } from './types';

/** Minutes → compact "2h 15m" / "45m" / "3d 4h" label. */
export function formatDuration(totalMinutes: number, locale: LocaleCode): string {
    const abs = Math.abs(Math.round(totalMinutes));
    const dLabel = locale === 'ru' ? 'д' : 'd';
    const hLabel = locale === 'ru' ? 'ч' : 'h';
    const mLabel = locale === 'ru' ? 'м' : 'm';

    if (abs >= 1440) {
        const days = Math.floor(abs / 1440);
        const hours = Math.floor((abs % 1440) / 60);
        return hours > 0 ? `${days}${dLabel} ${hours}${hLabel}` : `${days}${dLabel}`;
    }
    if (abs >= 60) {
        const hours = Math.floor(abs / 60);
        const mins = abs % 60;
        return mins > 0 ? `${hours}${hLabel} ${mins}${mLabel}` : `${hours}${hLabel}`;
    }
    return `${abs}${mLabel}`;
}

/** Seconds → compact local label while retaining second-level precision. */
export function formatDurationSeconds(totalSeconds: number, locale: LocaleCode): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    if (seconds < 60) return locale === 'ru' ? `${seconds} сек` : `${seconds}s`;
    return formatDuration(seconds / 60, locale);
}

/** Relative "5m ago" / "через 2ч" style label from an ISO timestamp. */
export function formatRelative(iso: string, locale: LocaleCode): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const past = diffMs >= 0;
    const label = formatDuration(Math.abs(diffMs) / 60000, locale);

    if (locale === 'ru') {
        return past ? `${label} назад` : `через ${label}`;
    }
    return past ? `${label} ago` : `in ${label}`;
}

/** SLA countdown text: negative remaining renders as an overdue string. */
export function formatSlaRemaining(remainingMinutes: number | undefined, locale: LocaleCode): string {
    if (remainingMinutes === undefined) {
        return locale === 'ru' ? 'Пауза' : 'Paused';
    }
    const label = formatDuration(remainingMinutes, locale);
    if (remainingMinutes < 0) {
        return locale === 'ru' ? `−${label}` : `−${label}`;
    }
    return label;
}

export function formatDateTime(iso: string, locale: LocaleCode): string {
    return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const STATUS_TONE: Record<TicketStatus, 'primary' | 'warning' | 'danger' | 'neutral' | 'info'> = {
    open: 'primary',
    waiting_support: 'info',
    waiting_user: 'warning',
    on_hold: 'neutral',
    escalated: 'danger',
    closed: 'neutral',
};

export function statusTone(status: TicketStatus) {
    return STATUS_TONE[status];
}

const SLA_TONE: Record<SlaState, 'primary' | 'warning' | 'danger' | 'neutral'> = {
    healthy: 'primary',
    due_soon: 'warning',
    overdue: 'danger',
    paused: 'neutral',
};

export function slaTone(state: SlaState) {
    return SLA_TONE[state];
}

const TRANSFER_TONE: Record<TransferStatus, 'primary' | 'warning' | 'danger' | 'neutral'> = {
    none: 'neutral',
    pending: 'warning',
    confirmed: 'primary',
    declined: 'danger',
};

export function transferTone(status: TransferStatus) {
    return TRANSFER_TONE[status];
}

/** Readable text color for a chip painted with an arbitrary hex background. */
export function readableOn(hex: string): string {
    const value = hex.replace('#', '');
    if (value.length < 6) return '#0e0e0e';
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#0e0e0e' : '#f4f1ee';
}
