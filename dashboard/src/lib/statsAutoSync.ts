import { prisma } from '@/lib/prisma';
import { resolveSyncStatus } from '@/app/api/guilds/[guildId]/stats/sync/status/route';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 60 * 60 * 1000;
const DEFAULT_SYNC_DAYS = 90;

type StatsAutoSyncState = {
    started: boolean;
    timer: NodeJS.Timeout | null;
    tickRunning: boolean;
};

const globalForStatsAutoSync = globalThis as typeof globalThis & {
    __statsAutoSyncState__?: StatsAutoSyncState;
};

const autoSyncState =
    globalForStatsAutoSync.__statsAutoSyncState__ ?? {
        started: false,
        timer: null,
        tickRunning: false,
    };

if (!globalForStatsAutoSync.__statsAutoSyncState__) {
    globalForStatsAutoSync.__statsAutoSyncState__ = autoSyncState;
}

const getDashboardBaseUrl = () => {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://127.0.0.1:3001';
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
};

async function runAutoSyncTick() {
    if (autoSyncState.tickRunning) {
        return;
    }

    autoSyncState.tickRunning = true;

    try {
        const guilds = await prisma.guild.findMany({
            select: { id: true },
        });

        if (guilds.length === 0) {
            return;
        }

        const syncSecret = process.env.NEXTAUTH_SECRET;
        if (!syncSecret) {
            console.warn('[StatsAutoSync] NEXTAUTH_SECRET is missing; auto-sync is disabled.');
            return;
        }

        const now = Date.now();
        const baseUrl = getDashboardBaseUrl();

        for (const { id: guildId } of guilds) {
            try {
                const status = await resolveSyncStatus(guildId);
                if (status.isRunning) {
                    continue;
                }

                const lastSyncTime = status.lastSyncDate
                    ? new Date(status.lastSyncDate).getTime()
                    : 0;

                if (lastSyncTime && now - lastSyncTime < STALE_AFTER_MS) {
                    continue;
                }

                console.log(`[StatsAutoSync] Triggering hourly background sync for guild ${guildId}`);

                const response = await fetch(`${baseUrl}/api/guilds/${guildId}/stats/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-stats-cron-key': syncSecret,
                    },
                    body: JSON.stringify({ days: DEFAULT_SYNC_DAYS }),
                    cache: 'no-store',
                });

                if (!response.ok) {
                    const details = await response.text();
                    console.error(`[StatsAutoSync] Sync failed for guild ${guildId}: ${response.status} ${details}`);
                }
            } catch (error) {
                console.error(`[StatsAutoSync] Sync tick failed for guild ${guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('[StatsAutoSync] Failed to scan guilds for background sync:', error);
    } finally {
        autoSyncState.tickRunning = false;
    }
}

export function ensureStatsAutoSyncStarted() {
    if (typeof window !== 'undefined' || autoSyncState.started) {
        return;
    }

    autoSyncState.started = true;

    void runAutoSyncTick();

    autoSyncState.timer = setInterval(() => {
        void runAutoSyncTick();
    }, CHECK_INTERVAL_MS);

    autoSyncState.timer.unref?.();
}
