import { formatInTimeZone } from 'date-fns-tz';

export type StatsPeriod = '24h' | '3d' | '7d' | '14d' | '30d' | '90d' | '180d' | '365d' | 'all';

type VoiceSessionLike = {
    joinedAt: Date;
    leftAt: Date | null;
    duration: number | null;
};

export const STATS_PERIOD_MAP: Record<StatsPeriod, { key: string; days: number | null }> = {
    '24h': { key: '24H', days: 1 },
    '3d': { key: '3D', days: 3 },
    '7d': { key: '7D', days: 7 },
    '14d': { key: '14D', days: 14 },
    '30d': { key: '30D', days: 30 },
    '90d': { key: '90D', days: 90 },
    '180d': { key: '180D', days: 180 },
    '365d': { key: '365D', days: 365 },
    all: { key: 'ALL', days: null },
};

export function normalizeStatsPeriod(value?: string | null): StatsPeriod {
    if (!value) return '30d';
    if (value in STATS_PERIOD_MAP) return value as StatsPeriod;
    return '30d';
}

export function getStatsStartDate(periodValue?: string | null, now = new Date()): Date {
    const period = normalizeStatsPeriod(periodValue);
    const startDate = new Date(now);

    switch (period) {
        case '24h':
            startDate.setTime(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '3d':
            startDate.setTime(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '14d':
            startDate.setTime(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '90d':
            startDate.setTime(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case '180d':
            startDate.setTime(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            break;
        case '365d':
            startDate.setTime(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        case 'all':
            startDate.setFullYear(2000);
            break;
    }

    return startDate;
}

export function getStatsPeriodKey(periodValue?: string | null): string {
    return STATS_PERIOD_MAP[normalizeStatsPeriod(periodValue)].key;
}

export function buildVoiceWhereClause(startDate: Date) {
    return {
        OR: [
            { leftAt: { gte: startDate } },
            { leftAt: null, joinedAt: { gte: startDate } },
        ],
    };
}

export function getVoiceSessionDurationSeconds(
    session: VoiceSessionLike,
    now = new Date()
): number {
    if (typeof session.duration === 'number' && session.duration >= 0) {
        return session.duration;
    }

    const endDate = session.leftAt ?? now;
    return Math.max(0, Math.floor((endDate.getTime() - session.joinedAt.getTime()) / 1000));
}

export function getVoiceSessionBucketDate(
    session: Pick<VoiceSessionLike, 'joinedAt' | 'leftAt'>,
    now = new Date()
): Date {
    return session.leftAt ?? now;
}

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

export function getStatsBucketKey(
    date: Date,
    periodValue: string | null | undefined,
    timezone = 'UTC'
): string {
    const period = normalizeStatsPeriod(periodValue);
    return formatInTimeZone(
        date,
        timezone,
        period === '24h' ? "yyyy-MM-dd'T'HH" : 'yyyy-MM-dd'
    );
}

export function formatStatsBucketLabel(
    date: Date,
    periodValue: string | null | undefined,
    timezone = 'UTC'
): string {
    const key = getStatsBucketKey(date, periodValue, timezone);

    if (normalizeStatsPeriod(periodValue) === '24h') {
        return `${key.slice(11, 13)}:00`;
    }

    const year = key.slice(0, 4);
    const month = key.slice(5, 7);
    const day = key.slice(8, 10);
    return `${day}.${month}.${year}`;
}

export function buildStatsBucketLabels(
    startDate: Date,
    endDate: Date,
    periodValue: string | null | undefined,
    timezone = 'UTC'
): string[] {
    const period = normalizeStatsPeriod(periodValue);
    const startKey = getStatsBucketKey(startDate, period, timezone);
    const endKey = getStatsBucketKey(endDate, period, timezone);
    const labels: string[] = [];

    if (period === '24h') {
        const cursor = new Date(`${startKey}:00:00.000Z`);
        const limit = new Date(`${endKey}:00:00.000Z`);

        while (cursor <= limit) {
            labels.push(`${pad2(cursor.getUTCHours())}:00`);
            cursor.setUTCHours(cursor.getUTCHours() + 1);
        }

        return labels;
    }

    const cursor = new Date(`${startKey}T00:00:00.000Z`);
    const limit = new Date(`${endKey}T00:00:00.000Z`);

    while (cursor <= limit) {
        labels.push(`${pad2(cursor.getUTCDate())}.${pad2(cursor.getUTCMonth() + 1)}.${cursor.getUTCFullYear()}`);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return labels;
}

export function getStatsHourOfDay(date: Date, timezone = 'UTC'): number {
    return Number(formatInTimeZone(date, timezone, 'H'));
}

export function mergeBucketSeries<T>(
    rows: T[],
    getDate: (row: T) => Date,
    getValues: (row: T) => Record<string, number>,
    periodValue: string | null | undefined,
    timezone = 'UTC'
): Array<{ date: string } & Record<string, number | string>> {
    const merged = new Map<string, Record<string, number>>();

    for (const row of rows) {
        const key = getStatsBucketKey(getDate(row), periodValue, timezone);
        const current = merged.get(key) || {};
        const values = getValues(row);

        for (const [field, value] of Object.entries(values)) {
            current[field] = (current[field] || 0) + value;
        }

        merged.set(key, current);
    }

    return Array.from(merged.entries()).map(([key, values]) => ({
        ...values,
        date: normalizeStatsPeriod(periodValue) === '24h'
            ? `${key.slice(11, 13)}:00`
            : `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`,
    }));
}
