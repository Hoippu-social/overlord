import { NextRequest, NextResponse } from 'next/server';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { withStatsTelemetry } from '@/lib/statsTelemetry';
import { statsPrisma } from '@/lib/prisma';

export type StatsSyncStatus = {
    isRunning: boolean;
    progress: number;
    message: string;
    startedAt?: Date;
    finishedAt?: Date;
    lastSyncDate?: Date | null;
};

const DEFAULT_STATUS: StatsSyncStatus = {
    isRunning: false,
    progress: 0,
    message: 'Ready',
    lastSyncDate: null,
};

const isMissingTableError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
};

const globalForStatsSyncStatus = globalThis as typeof globalThis & {
    __statsSyncStatusMap__?: Map<string, StatsSyncStatus>;
};

const syncStatus =
    globalForStatsSyncStatus.__statsSyncStatusMap__ ??
    new Map<string, StatsSyncStatus>();

if (!globalForStatsSyncStatus.__statsSyncStatusMap__) {
    globalForStatsSyncStatus.__statsSyncStatusMap__ = syncStatus;
}

async function getPersistedLastSyncDate(guildId: string) {
    try {
        const state = await statsPrisma.statsAggregationState.findUnique({
            where: { guildId },
            select: {
                lastReadModelSyncAt: true,
                lastSuccessfulRebuildAt: true,
            },
        });

        return state?.lastReadModelSyncAt ?? state?.lastSuccessfulRebuildAt ?? null;
    } catch (error) {
        if (isMissingTableError(error)) {
            return null;
        }

        throw error;
    }
}

export async function resolveSyncStatus(guildId: string): Promise<StatsSyncStatus> {
    const current = syncStatus.get(guildId);
    if (current?.isRunning) {
        return current;
    }

    const persistedLastSyncDate = await getPersistedLastSyncDate(guildId);

    return {
        ...DEFAULT_STATUS,
        ...current,
        lastSyncDate: current?.lastSyncDate ?? persistedLastSyncDate,
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    return withStatsTelemetry({ guildId, endpoint: 'sync-status', method: 'GET' }, async () => {
        try {
            const access = await requireGuildStatsAccess(request, guildId);
            if (!access.ok) {
                return access.response;
            }

            const status = await resolveSyncStatus(guildId);
            return NextResponse.json(status);
        } catch (error) {
            console.error('[SyncStatus] Error:', error);
            return NextResponse.json(
                { error: 'Failed to get sync status' },
                { status: 500 }
            );
        }
    });
}

export function updateSyncStatus(
    guildId: string,
    update: Partial<StatsSyncStatus>
) {
    const current = syncStatus.get(guildId) || DEFAULT_STATUS;
    syncStatus.set(guildId, { ...current, ...update });
}

export function getSyncStatus(guildId: string) {
    return syncStatus.get(guildId);
}
