import { NextRequest, NextResponse } from 'next/server';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { withStatsTelemetry } from '@/lib/statsTelemetry';

// In-memory storage for sync status
// In production, consider using Redis or database
const syncStatus = new Map<string, {
    isRunning: boolean;
    progress: number; // 0-100
    message: string;
    startedAt?: Date;
    finishedAt?: Date;
    lastSyncDate?: Date | null;
}>();

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

            const status = syncStatus.get(guildId) || {
                isRunning: false,
                progress: 0,
                message: 'Ready',
                lastSyncDate: null
            };

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

// Helper functions to update status (used by sync route)
export function updateSyncStatus(guildId: string, update: Partial<{
    isRunning: boolean;
    progress: number;
    message: string;
    startedAt: Date;
    finishedAt: Date;
    lastSyncDate: Date | null;
}>) {
    const current = syncStatus.get(guildId) || {
        isRunning: false,
        progress: 0,
        message: 'Ready',
        lastSyncDate: null
    };

    syncStatus.set(guildId, { ...current, ...update });
}

export function getSyncStatus(guildId: string) {
    return syncStatus.get(guildId);
}
