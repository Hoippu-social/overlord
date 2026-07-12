import { NextRequest, NextResponse } from 'next/server';
import { prisma, statsPrisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { updateSyncStatus } from './status/route';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import {
    buildVoiceWhereClause,
    forEachVoiceSessionHourBucket,
    getClampedVoiceSessionDurationSeconds,
} from '@/lib/stats';
import { withStatsTelemetry } from '@/lib/statsTelemetry';

const isInternalStatsSyncRequest = (request: NextRequest) => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return false;
    return request.headers.get('x-stats-cron-key') === secret;
};

const isMissingTableError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
};

async function setAggregationState(
    guildId: string,
    data: {
        timezone: string;
        rebuildRequired?: boolean;
        jobStatus: string;
        lastSuccessfulRebuildAt?: Date;
        lastReadModelSyncAt?: Date;
        lastSourceEventAt?: Date;
    }
) {
    try {
        await statsPrisma.statsAggregationState.upsert({
            where: { guildId },
            update: data,
            create: {
                guildId,
                schemaVersion: 1,
                ...data,
            },
        });
    } catch (error) {
        if (!isMissingTableError(error)) {
            throw error;
        }
    }
}

async function aggregateMemberEvents(
    guildId: string,
    since: Date,
    getHourlyEntry: (date: Date) => { joined: number; left: number },
    getDailyEntry: (date: Date) => { joined: number; left: number }
) {
    try {
        let cursor: number | undefined;
        let fetched = 0;

        while (true) {
            const chunk = await statsPrisma.statMemberEvent.findMany({
                where: {
                    guildId,
                    createdAt: { gte: since },
                },
                select: {
                    id: true,
                    eventType: true,
                    createdAt: true,
                },
                take: 50_000,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { id: 'asc' },
            });

            if (chunk.length === 0) break;
            fetched += chunk.length;

            for (const event of chunk) {
                if (event.eventType === 'JOIN') {
                    getHourlyEntry(event.createdAt).joined++;
                    getDailyEntry(event.createdAt).joined++;
                } else if (event.eventType === 'LEAVE') {
                    getHourlyEntry(event.createdAt).left++;
                    getDailyEntry(event.createdAt).left++;
                }
            }

            cursor = chunk[chunk.length - 1].id;
        }

        return { source: 'StatMemberEvent', fetched };
    } catch (error) {
        if (!isMissingTableError(error)) {
            throw error;
        }

        let cursor: number | undefined;
        let fetched = 0;

        while (true) {
            const chunk: Array<{ id: number; createdAt: Date; payload: string | null }> = await statsPrisma.auditLogEvent.findMany({
                where: {
                    guildId,
                    tag: 'invites',
                    createdAt: { gte: since }
                },
                take: 50000,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { id: 'asc' }
            });
            if (chunk.length === 0) break;
            fetched += chunk.length;

            for (const event of chunk) {
                if (!event.payload) continue;
                let payload: { event?: string } = {};
                try { payload = JSON.parse(event.payload) as { event?: string }; } catch { continue; }

                if (payload.event === 'invite_join') {
                    getHourlyEntry(event.createdAt).joined++;
                    getDailyEntry(event.createdAt).joined++;
                }
                if (payload.event === 'invite_leave') {
                    getHourlyEntry(event.createdAt).left++;
                    getDailyEntry(event.createdAt).left++;
                }
            }

            cursor = chunk[chunk.length - 1].id;
        }

        return { source: 'AuditLogEvent(invites)', fetched };
    }
}

type DailyReadModelEntry = {
    messages: number;
    voiceSeconds: number;
    interactions: number;
};

function getOrCreateDailyEntry<T extends DailyReadModelEntry>(
    map: Map<string, T>,
    key: string,
    factory: () => T
) {
    if (!map.has(key)) {
        map.set(key, factory());
    }
    return map.get(key)!;
}

async function executeOpsInChunks(
    ops: Prisma.PrismaPromise<unknown>[],
    guildId: string,
    progressStart: number,
    progressSpan: number,
    messagePrefix: string
) {
    if (ops.length === 0) return;

    const chunkSize = 1000;
    for (let i = 0; i < ops.length; i += chunkSize) {
        await statsPrisma.$transaction(ops.slice(i, i + chunkSize));
        const percent = progressStart + Math.floor((i / ops.length) * progressSpan);
        updateSyncStatus(guildId, {
            progress: percent,
            message: `${messagePrefix} ${Math.floor(i / chunkSize) + 1}...`,
        });
    }
}

async function getAggregationState(guildId: string) {
    try {
        return await statsPrisma.statsAggregationState.findUnique({
            where: { guildId },
            select: {
                rebuildRequired: true,
                timezone: true,
                lastReadModelSyncAt: true,
            },
        });
    } catch (error) {
        if (isMissingTableError(error)) {
            return null;
        }
        throw error;
    }
}

async function getEarliestSourceDate(guildId: string): Promise<Date | null> {
    const candidates = await Promise.all([
        statsPrisma.statMessage.findFirst({
            where: { guildId },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
        statsPrisma.statVoiceState.findFirst({
            where: { guildId },
            orderBy: { joinedAt: 'asc' },
            select: { joinedAt: true },
        }),
        statsPrisma.statInteraction.findFirst({
            where: { guildId },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
        statsPrisma.statActivity.findFirst({
            where: { guildId },
            orderBy: { startTime: 'asc' },
            select: { startTime: true },
        }),
        statsPrisma.statMemberCount.findFirst({
            where: { guildId },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
        statsPrisma.statMemberEvent.findFirst({
            where: { guildId },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }).catch((error) => {
            if (isMissingTableError(error)) return null;
            throw error;
        }),
        statsPrisma.auditLogEvent.findFirst({
            where: { guildId, tag: 'invites' },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
    ]);

    const dates = candidates
        .map((entry) => {
            if (!entry) return null;
            if ('joinedAt' in entry) return entry.joinedAt;
            if ('startTime' in entry) return entry.startTime;
            return entry.createdAt;
        })
        .filter((date): date is Date => date instanceof Date);

    if (dates.length === 0) {
        return null;
    }

    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates[0];
}

function getMinimumDate(values: Iterable<Date>, fallback: Date) {
    let min = fallback;
    for (const value of values) {
        if (value.getTime() < min.getTime()) {
            min = value;
        }
    }
    return min;
}

async function clearExistingReadModels(
    guildId: string,
    options: {
        clearAll: boolean;
        hourlyStart: Date;
        dailyStart: Date;
    }
) {
    const { clearAll, hourlyStart, dailyStart } = options;

    await statsPrisma.statHourly.deleteMany({
        where: clearAll
            ? { guildId }
            : { guildId, dateHour: { gte: hourlyStart } },
    });

    await statsPrisma.statDaily.deleteMany({
        where: clearAll
            ? { guildId }
            : { guildId, date: { gte: dailyStart } },
    });

    try {
        await statsPrisma.statMemberDaily.deleteMany({
            where: clearAll
                ? { guildId }
                : { guildId, date: { gte: dailyStart } },
        });
        await statsPrisma.statChannelDaily.deleteMany({
            where: clearAll
                ? { guildId }
                : { guildId, date: { gte: dailyStart } },
        });
    } catch (error) {
        if (!isMissingTableError(error)) {
            throw error;
        }
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    return withStatsTelemetry({ guildId, endpoint: 'sync', method: 'POST' }, async () => {
        if (!isInternalStatsSyncRequest(request)) {
            const access = await requireGuildStatsAccess(request, guildId, { live: true });
            if (!access.ok) {
                return access.response;
            }
        }

        let customDays: number | null = null;
        try {
            const body = await request.json();
            customDays = body.days || null;
        } catch {
            // No body or invalid JSON, use default
        }

        const DEFAULT_SYNC_DAYS = 90;
        const defaultSince = new Date();
        defaultSince.setDate(defaultSince.getDate() - (customDays || DEFAULT_SYNC_DAYS));
        defaultSince.setHours(0, 0, 0, 0);

        const since30d = new Date();
        since30d.setDate(since30d.getDate() - 30);
        since30d.setHours(0, 0, 0, 0);
        const syncNow = new Date();
        let aggregationTimezone = 'UTC';

        try {
        const existingState = await getAggregationState(guildId);

        // Fetch guild timezone settings
        const botSettings = await prisma.botSettings.findUnique({
            where: { guildId },
            select: { timezone: true }
        });
        const tz = botSettings?.timezone || 'UTC';
        aggregationTimezone = tz;

        let since = new Date(defaultSince);
        let isFullRebuild = false;

        if (existingState?.rebuildRequired && !customDays) {
            const earliestSourceDate = await getEarliestSourceDate(guildId);
            if (earliestSourceDate) {
                since = new Date(earliestSourceDate);
                isFullRebuild = true;
            }
        }

        await setAggregationState(guildId, {
            timezone: tz,
            rebuildRequired: false,
            jobStatus: 'RUNNING',
        });

        console.log(
            `[StatsSync] Starting comprehensive sync for guild ${guildId} since ${since.toISOString()} in timezone ${tz} (fullRebuild=${isFullRebuild})`
        );

        // Initialize progress
        updateSyncStatus(guildId, {
            isRunning: true,
            progress: 0,
            message: 'Starting sync...',
            startedAt: new Date()
        });

        updateSyncStatus(guildId, {
            progress: 20,
            message: isFullRebuild ? 'Processing full rebuild from source...' : 'Processing total messages...',
        });

        // Group by Hour (for StatHourly) and Day (for StatDaily)
        const hourlyStats = new Map<string, { messages: number, voice: number, joined: number, left: number }>();
        const dailyStats = new Map<string, { messages: number, voice: number, joined: number, left: number }>();
        const memberDailyStats = new Map<string, DailyReadModelEntry & { userId: string; date: Date }>();
        const channelDailyStats = new Map<string, DailyReadModelEntry & { channelId: string; date: Date }>();

        const tzDayCache = new Map<number, Date>();
        const tzHourCache = new Map<number, Date>();

        const getTruncatedUTC = (date: Date, truncateTo: 'hour' | 'day'): Date => {
            const utcHour = Math.floor(date.getTime() / 3600000);

            if (truncateTo === 'day' && tzDayCache.has(utcHour)) return tzDayCache.get(utcHour)!;
            if (truncateTo === 'hour' && tzHourCache.has(utcHour)) return tzHourCache.get(utcHour)!;

            const zoned = toZonedTime(date, tz);
            const y = zoned.getUTCFullYear();
            const m = String(zoned.getUTCMonth() + 1).padStart(2, '0');
            const d = String(zoned.getUTCDate()).padStart(2, '0');
            const h = truncateTo === 'hour' ? String(zoned.getUTCHours()).padStart(2, '0') : '00';

            const localTruncatedStr = `${y}-${m}-${d}T${h}:00:00`;
            const result = fromZonedTime(localTruncatedStr, tz);

            if (truncateTo === 'day') tzDayCache.set(utcHour, result);
            if (truncateTo === 'hour') tzHourCache.set(utcHour, result);
            return result;
        };

        const getHourlyEntry = (date: Date) => {
            const truncated = getTruncatedUTC(date, 'hour');
            const key = truncated.toISOString();
            if (!hourlyStats.has(key)) hourlyStats.set(key, { messages: 0, voice: 0, joined: 0, left: 0 });
            return hourlyStats.get(key)!;
        };

        const getDailyEntry = (date: Date) => {
            const truncated = getTruncatedUTC(date, 'day');
            const key = truncated.toISOString();
            if (!dailyStats.has(key)) dailyStats.set(key, { messages: 0, voice: 0, joined: 0, left: 0 });
            return dailyStats.get(key)!;
        };

        const getMemberDailyEntry = (userId: string, date: Date) => {
            const truncated = getTruncatedUTC(date, 'day');
            const key = `${userId}:${truncated.toISOString()}`;
            return getOrCreateDailyEntry(memberDailyStats, key, () => ({
                userId,
                date: truncated,
                messages: 0,
                voiceSeconds: 0,
                interactions: 0,
            }));
        };

        const getChannelDailyEntry = (channelId: string, date: Date) => {
            const truncated = getTruncatedUTC(date, 'day');
            const key = `${channelId}:${truncated.toISOString()}`;
            return getOrCreateDailyEntry(channelDailyStats, key, () => ({
                channelId,
                date: truncated,
                messages: 0,
                voiceSeconds: 0,
                interactions: 0,
            }));
        };

        // Maps for Tops (calculated directly in chunk loops to avoid memory overhead)
        const topMsgChannelMap = new Map<string, number>();
        const topMsgMemberMap = new Map<string, number>();
        const topVoiceChannelMap = new Map<string, number>();
        const topVoiceMemberMap = new Map<string, number>();

        console.time('[StatsSync] Process Messages Loop');
        let msgCursor: number | undefined = undefined;
        let fetchedMsgs = 0;

        while (true) {
            const chunk: Array<{ id: number; createdAt: Date; authorId: string; channelId: string }> = await statsPrisma.statMessage.findMany({
                where: { guildId, createdAt: { gte: since } },
                take: 50000,
                skip: msgCursor ? 1 : 0,
                cursor: msgCursor ? { id: msgCursor } : undefined,
                orderBy: { id: 'asc' }
            });
            if (chunk.length === 0) break;
            fetchedMsgs += chunk.length;

            for (const msg of chunk) {
                const h = getHourlyEntry(msg.createdAt);
                h.messages++;
                const d = getDailyEntry(msg.createdAt);
                d.messages++;
                getMemberDailyEntry(msg.authorId, msg.createdAt).messages++;
                getChannelDailyEntry(msg.channelId, msg.createdAt).messages++;

                // Inline Top Calculation
                if (msg.createdAt >= since30d) {
                    topMsgChannelMap.set(msg.channelId, (topMsgChannelMap.get(msg.channelId) || 0) + 1);
                    topMsgMemberMap.set(msg.authorId, (topMsgMemberMap.get(msg.authorId) || 0) + 1);
                }
            }
            msgCursor = chunk[chunk.length - 1].id;
        }
        console.timeEnd('[StatsSync] Process Messages Loop');
        console.log(`[StatsSync] Fetched and processed ${fetchedMsgs} messages from PostgreSQL stats storage`);

        // --- 2. Aggregating Voice ---
        updateSyncStatus(guildId, { progress: 30, message: 'Fetching voice data...' });

        console.time('[StatsSync] Process Voice Loop');
        let voiceCursor: number | undefined = undefined;
        let fetchedVoice = 0;

        while (true) {
            const chunk: Array<{
                id: number;
                joinedAt: Date;
                leftAt: Date | null;
                duration: number | null;
                userId: string;
                channelId: string;
            }> = await statsPrisma.statVoiceState.findMany({
                where: {
                    guildId,
                    ...buildVoiceWhereClause(since, syncNow),
                },
                select: {
                    id: true,
                    joinedAt: true,
                    leftAt: true,
                    duration: true,
                    userId: true,
                    channelId: true,
                },
                take: 50000,
                skip: voiceCursor ? 1 : 0,
                cursor: voiceCursor ? { id: voiceCursor } : undefined,
                orderBy: { id: 'asc' }
            });
            if (chunk.length === 0) break;
            fetchedVoice += chunk.length;

            for (const session of chunk) {
                if (!session.joinedAt) continue;

                forEachVoiceSessionHourBucket(
                    session,
                    { startDate: since, endDate: syncNow, timezone: tz, now: syncNow },
                    (bucketStart, seconds) => {
                        getHourlyEntry(bucketStart).voice += seconds;
                        getDailyEntry(bucketStart).voice += seconds;
                        getMemberDailyEntry(session.userId, bucketStart).voiceSeconds += seconds;
                        getChannelDailyEntry(session.channelId, bucketStart).voiceSeconds += seconds;
                    }
                );

                const topWindowDuration = getClampedVoiceSessionDurationSeconds(
                    session,
                    since30d,
                    syncNow,
                    syncNow
                );

                if (topWindowDuration > 0) {
                    topVoiceChannelMap.set(
                        session.channelId,
                        (topVoiceChannelMap.get(session.channelId) || 0) + topWindowDuration
                    );
                    topVoiceMemberMap.set(
                        session.userId,
                        (topVoiceMemberMap.get(session.userId) || 0) + topWindowDuration
                    );
                }
            }
            voiceCursor = chunk[chunk.length - 1].id;
        }
        console.timeEnd('[StatsSync] Process Voice Loop');
        console.log(`[StatsSync] Fetched and processed ${fetchedVoice} voice sessions from PostgreSQL stats storage`);

        // --- 3. Aggregating Interactions for daily read models ---
        updateSyncStatus(guildId, { progress: 40, message: 'Fetching interactions...' });

        console.time('[StatsSync] Process Interactions Loop');
        let interactionCursor: number | undefined = undefined;
        let fetchedInteractions = 0;

        while (true) {
            const chunk: Array<{ id: number; fromUserId: string; channelId: string; createdAt: Date }> =
                await statsPrisma.statInteraction.findMany({
                    where: { guildId, createdAt: { gte: since } },
                    select: {
                        id: true,
                        fromUserId: true,
                        channelId: true,
                        createdAt: true,
                    },
                    take: 50_000,
                    skip: interactionCursor ? 1 : 0,
                    cursor: interactionCursor ? { id: interactionCursor } : undefined,
                    orderBy: { id: 'asc' },
                });

            if (chunk.length === 0) break;
            fetchedInteractions += chunk.length;

            for (const interaction of chunk) {
                getMemberDailyEntry(interaction.fromUserId, interaction.createdAt).interactions++;
                getChannelDailyEntry(interaction.channelId, interaction.createdAt).interactions++;
            }

            interactionCursor = chunk[chunk.length - 1].id;
        }
        console.timeEnd('[StatsSync] Process Interactions Loop');
        console.log(`[StatsSync] Fetched and processed ${fetchedInteractions} interactions from PostgreSQL stats storage`);

        // --- 4. Aggregating Members (Joins/Leaves) from Audit Logs ---
        updateSyncStatus(guildId, { progress: 45, message: 'Fetching member events...' });

        console.time('[StatsSync] Process Member Events Loop');
        const memberEvents = await aggregateMemberEvents(guildId, since, getHourlyEntry, getDailyEntry);
        console.timeEnd('[StatsSync] Process Member Events Loop');
        console.log(`[StatsSync] Fetched and processed ${memberEvents.fetched} member events from ${memberEvents.source}`);

        const cleanupHourlyStart = getMinimumDate(
            Array.from(hourlyStats.keys(), (key) => new Date(key)),
            since
        );
        const cleanupDailyStart = getMinimumDate(
            [
                ...Array.from(dailyStats.keys(), (key) => new Date(key)),
                ...Array.from(memberDailyStats.values(), (entry) => entry.date),
                ...Array.from(channelDailyStats.values(), (entry) => entry.date),
            ],
            since
        );

        updateSyncStatus(guildId, {
            progress: 55,
            message: isFullRebuild ? 'Clearing stale aggregates for full rebuild...' : 'Clearing stale aggregates...',
        });
        await clearExistingReadModels(guildId, {
            clearAll: isFullRebuild,
            hourlyStart: cleanupHourlyStart,
            dailyStart: cleanupDailyStart,
        });

        // --- 5. Writing Hourly/Daily to Database (AGGREGATE DATABASE) ---
        updateSyncStatus(guildId, { progress: 60, message: 'Updating hourly/daily records...' });

        const ops: Prisma.PrismaPromise<unknown>[] = [];

        console.time('[StatsSync] Build Upsert Arrays');
        for (const [key, stats] of hourlyStats) {
            const dateHour = new Date(key);
            ops.push(statsPrisma.statHourly.upsert({
                where: { guildId_dateHour: { guildId, dateHour } },
                update: {
                    messages: stats.messages,
                    voiceSeconds: stats.voice,
                    newMembers: stats.joined,
                    leftMembers: stats.left
                },
                create: {
                    guildId, dateHour,
                    messages: stats.messages,
                    voiceSeconds: stats.voice,
                    newMembers: stats.joined,
                    leftMembers: stats.left
                }
            }));
        }

        for (const [key, stats] of dailyStats) {
            const date = new Date(key);
            ops.push(statsPrisma.statDaily.upsert({
                where: { guildId_date: { guildId, date } },
                update: {
                    messages: stats.messages,
                    voiceSeconds: stats.voice,
                    newMembers: stats.joined,
                    leftMembers: stats.left
                },
                create: {
                    guildId, date,
                    messages: stats.messages,
                    voiceSeconds: stats.voice,
                    newMembers: stats.joined,
                    leftMembers: stats.left
                }
            }));
        }
        console.timeEnd('[StatsSync] Build Upsert Arrays');

        console.time('[StatsSync] Execute Transactions');
        await executeOpsInChunks(ops, guildId, 60, 10, 'Saving hourly/daily chunk');
        console.timeEnd('[StatsSync] Execute Transactions');

        updateSyncStatus(guildId, { progress: 70, message: 'Updating member/channel daily records...' });
        try {
            const readModelOps: Prisma.PrismaPromise<unknown>[] = [];

            for (const stats of memberDailyStats.values()) {
                readModelOps.push(statsPrisma.statMemberDaily.upsert({
                    where: { guildId_userId_date: { guildId, userId: stats.userId, date: stats.date } },
                    update: {
                        messages: stats.messages,
                        voiceSeconds: stats.voiceSeconds,
                        interactions: stats.interactions,
                    },
                    create: {
                        guildId,
                        userId: stats.userId,
                        date: stats.date,
                        messages: stats.messages,
                        voiceSeconds: stats.voiceSeconds,
                        interactions: stats.interactions,
                    }
                }));
            }

            for (const stats of channelDailyStats.values()) {
                readModelOps.push(statsPrisma.statChannelDaily.upsert({
                    where: { guildId_channelId_date: { guildId, channelId: stats.channelId, date: stats.date } },
                    update: {
                        messages: stats.messages,
                        voiceSeconds: stats.voiceSeconds,
                        interactions: stats.interactions,
                    },
                    create: {
                        guildId,
                        channelId: stats.channelId,
                        date: stats.date,
                        messages: stats.messages,
                        voiceSeconds: stats.voiceSeconds,
                        interactions: stats.interactions,
                    }
                }));
            }

            console.time('[StatsSync] Execute Read Model Transactions');
            await executeOpsInChunks(readModelOps, guildId, 70, 10, 'Saving read-model chunk');
            console.timeEnd('[StatsSync] Execute Read Model Transactions');
        } catch (error) {
            if (!isMissingTableError(error)) {
                throw error;
            }
            console.warn('[StatsSync] Read-model tables are not available yet; skipping StatMemberDaily/StatChannelDaily sync');
        }

        // --- 6. Saving Tops (Last 30d) ---
        updateSyncStatus(guildId, { progress: 80, message: 'Saving rankings...' });
        console.time('[StatsSync] Calculate & Save Tops');

        // Clean old 30d tops
        await statsPrisma.statTopChannel.deleteMany({ where: { guildId, period: '30D' } });
        await statsPrisma.statTopMember.deleteMany({ where: { guildId, period: '30D' } });

        // Save new Tops
        const topPromises = [];

        // Sort and take top 20
        const sortedMsgChannels = Array.from(topMsgChannelMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [id, val] of sortedMsgChannels) {
            topPromises.push(statsPrisma.statTopChannel.create({ data: { guildId, channelId: id, period: '30D', category: 'MESSAGES', value: val } }));
        }

        const sortedVoiceChannels = Array.from(topVoiceChannelMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [id, val] of sortedVoiceChannels) {
            topPromises.push(statsPrisma.statTopChannel.create({ data: { guildId, channelId: id, period: '30D', category: 'VOICE', value: val } }));
        }

        const sortedMsgMembers = Array.from(topMsgMemberMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [id, val] of sortedMsgMembers) {
            topPromises.push(statsPrisma.statTopMember.create({ data: { guildId, userId: id, period: '30D', category: 'MESSAGES', value: val } }));
        }

        const sortedVoiceMembers = Array.from(topVoiceMemberMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [id, val] of sortedVoiceMembers) {
            topPromises.push(statsPrisma.statTopMember.create({ data: { guildId, userId: id, period: '30D', category: 'VOICE', value: val } }));
        }

        await Promise.all(topPromises);
        console.timeEnd('[StatsSync] Calculate & Save Tops');

        console.log(`[StatsSync] Completed comprehensive sync for ${guildId}.`);

        updateSyncStatus(guildId, {
            isRunning: false,
            progress: 100,
            message: 'Sync completed',
            finishedAt: new Date(),
            lastSyncDate: new Date()
        });

        const completedAt = new Date();
        await setAggregationState(guildId, {
            timezone: tz,
            rebuildRequired: false,
            jobStatus: 'IDLE',
            lastSuccessfulRebuildAt: completedAt,
            lastReadModelSyncAt: completedAt,
            lastSourceEventAt: completedAt,
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[StatsSync] CRITICAL ERROR:', error);
        updateSyncStatus(guildId, {
            isRunning: false,
            progress: 0,
            message: `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
            finishedAt: new Date()
        });
        try {
            await setAggregationState(guildId, {
                timezone: aggregationTimezone,
                rebuildRequired: true,
                jobStatus: 'FAILED',
            });
        } catch (stateError) {
            console.error('[StatsSync] Failed to update aggregation state:', stateError);
        }
            return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 });
        }
    });
}
