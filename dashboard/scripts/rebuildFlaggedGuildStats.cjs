const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaClient: StatsPgPrismaClient } = require('../src/generated/stats-pg-client');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getArg(name) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
}

function getStatsPgUrl() {
    const url = process.env.STATS_PG_DATABASE_URL;
    if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) {
        throw new Error('STATS_PG_DATABASE_URL must be configured with a PostgreSQL URL');
    }
    return url;
}

function splitIntoChunks(items, chunkSize) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

async function createInChunks(factory, rows, chunkSize = 250) {
    for (const chunk of splitIntoChunks(rows, chunkSize)) {
        if (chunk.length === 0) continue;
        await factory(chunk);
    }
}

function getTruncatedUtc(date, timezone, truncateTo) {
    const zoned = toZonedTime(date, timezone);
    const year = zoned.getUTCFullYear();
    const month = String(zoned.getUTCMonth() + 1).padStart(2, '0');
    const day = String(zoned.getUTCDate()).padStart(2, '0');
    const hour = truncateTo === 'hour' ? String(zoned.getUTCHours()).padStart(2, '0') : '00';
    return fromZonedTime(`${year}-${month}-${day}T${hour}:00:00`, timezone);
}

function getVoiceDurationSeconds(session, now) {
    if (typeof session.duration === 'number' && session.duration >= 0) {
        return session.duration;
    }
    const endDate = session.leftAt || now;
    return Math.max(0, Math.floor((endDate.getTime() - session.joinedAt.getTime()) / 1000));
}

function getVoiceBucketDate(session, now) {
    return session.leftAt || now;
}

async function getFlaggedGuildIds(statsPrisma, targetGuildId) {
    if (targetGuildId) return [targetGuildId];
    const rows = await statsPrisma.statsAggregationState.findMany({
        where: { rebuildRequired: true },
        select: { guildId: true },
        orderBy: { guildId: 'asc' },
    });
    return rows.map((row) => row.guildId);
}

async function getGuildDateBounds(statsPrisma, guildId) {
    const entries = await Promise.all([
        statsPrisma.statMessage.findFirst({ where: { guildId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
        statsPrisma.statVoiceState.findFirst({ where: { guildId }, orderBy: { joinedAt: 'asc' }, select: { joinedAt: true } }),
        statsPrisma.statInteraction.findFirst({ where: { guildId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
        statsPrisma.statActivity.findFirst({ where: { guildId }, orderBy: { startTime: 'asc' }, select: { startTime: true } }),
        statsPrisma.statMemberEvent.findFirst({ where: { guildId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
        statsPrisma.auditLogEvent.findFirst({ where: { guildId, tag: 'invites' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);

    const latestEntries = await Promise.all([
        statsPrisma.statMessage.findFirst({ where: { guildId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        statsPrisma.statVoiceState.findFirst({
            where: { guildId },
            orderBy: [{ leftAt: 'desc' }, { joinedAt: 'desc' }],
            select: { joinedAt: true, leftAt: true },
        }),
        statsPrisma.statInteraction.findFirst({ where: { guildId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        statsPrisma.statActivity.findFirst({
            where: { guildId },
            orderBy: [{ endTime: 'desc' }, { startTime: 'desc' }],
            select: { startTime: true, endTime: true },
        }),
        statsPrisma.statMemberEvent.findFirst({ where: { guildId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        statsPrisma.auditLogEvent.findFirst({ where: { guildId, tag: 'invites' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    const minDates = entries
        .map((entry) => {
            if (!entry) return null;
            if ('joinedAt' in entry) return entry.joinedAt;
            if ('startTime' in entry) return entry.startTime;
            return entry.createdAt;
        })
        .filter(Boolean);

    const maxDates = latestEntries
        .map((entry) => {
            if (!entry) return null;
            if ('leftAt' in entry) return entry.leftAt || entry.joinedAt;
            if ('endTime' in entry) return entry.endTime || entry.startTime;
            if ('startTime' in entry) return entry.startTime;
            return entry.createdAt;
        })
        .filter(Boolean);

    if (minDates.length === 0) {
        return { earliest: null, latest: null };
    }

    minDates.sort((a, b) => a.getTime() - b.getTime());
    maxDates.sort((a, b) => a.getTime() - b.getTime());
    return {
        earliest: minDates[0],
        latest: maxDates[maxDates.length - 1] || minDates[0],
    };
}

async function ensureLegacyMemberEvents(statsPrisma, guildId) {
    let cursor;
    while (true) {
        const chunk = await statsPrisma.auditLogEvent.findMany({
            where: { guildId, tag: 'invites' },
            select: { id: true, createdAt: true, payload: true },
            take: 1000,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
        });
        if (chunk.length === 0) break;

        const ops = [];
        for (const event of chunk) {
            if (!event.payload) continue;
            let payload;
            try {
                payload = JSON.parse(event.payload);
            } catch {
                continue;
            }

            let eventType = null;
            if (payload?.event === 'invite_join') eventType = 'JOIN';
            if (payload?.event === 'invite_leave') eventType = 'LEAVE';
            if (!eventType) continue;

            const userId = payload.userId || payload.memberId || payload.targetId || payload.discordId || 'unknown';
            const eventKey = `legacy-audit:${event.id}`;
            ops.push(
                statsPrisma.statMemberEvent.upsert({
                    where: { eventKey },
                    update: {},
                    create: {
                        guildId,
                        userId,
                        eventType,
                        eventKey,
                        source: 'legacy_audit',
                        createdAt: event.createdAt,
                    },
                })
            );
        }

        for (const txChunk of splitIntoChunks(ops, 250)) {
            if (txChunk.length > 0) await statsPrisma.$transaction(txChunk);
        }

        cursor = chunk[chunk.length - 1].id;
    }
}

async function rebuildGuild(statsPrisma, guildId, timezone) {
    const now = new Date();
    const hourlyStats = new Map();
    const dailyStats = new Map();
    const memberDailyStats = new Map();
    const channelDailyStats = new Map();

    const totals = {
        messages: 0,
        voiceSeconds: 0,
        interactions: 0,
        joins: 0,
        leaves: 0,
    };

    const getHourlyEntry = (date) => {
        const bucketDate = getTruncatedUtc(date, timezone, 'hour');
        const key = bucketDate.toISOString();
        if (!hourlyStats.has(key)) {
            hourlyStats.set(key, {
                dateHour: bucketDate,
                messages: 0,
                voiceSeconds: 0,
                newMembers: 0,
                leftMembers: 0,
            });
        }
        return hourlyStats.get(key);
    };

    const getDailyEntry = (date) => {
        const bucketDate = getTruncatedUtc(date, timezone, 'day');
        const key = bucketDate.toISOString();
        if (!dailyStats.has(key)) {
            dailyStats.set(key, {
                date: bucketDate,
                messages: 0,
                voiceSeconds: 0,
                newMembers: 0,
                leftMembers: 0,
            });
        }
        return dailyStats.get(key);
    };

    const getMemberDailyEntry = (userId, date) => {
        const bucketDate = getTruncatedUtc(date, timezone, 'day');
        const key = `${userId}:${bucketDate.toISOString()}`;
        if (!memberDailyStats.has(key)) {
            memberDailyStats.set(key, {
                userId,
                date: bucketDate,
                messages: 0,
                voiceSeconds: 0,
                interactions: 0,
            });
        }
        return memberDailyStats.get(key);
    };

    const getChannelDailyEntry = (channelId, date) => {
        const bucketDate = getTruncatedUtc(date, timezone, 'day');
        const key = `${channelId}:${bucketDate.toISOString()}`;
        if (!channelDailyStats.has(key)) {
            channelDailyStats.set(key, {
                channelId,
                date: bucketDate,
                messages: 0,
                voiceSeconds: 0,
                interactions: 0,
            });
        }
        return channelDailyStats.get(key);
    };

    let cursor;
    while (true) {
        const chunk = await statsPrisma.statMessage.findMany({
            where: { guildId },
            select: { id: true, authorId: true, channelId: true, createdAt: true },
            take: 50000,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
        });
        if (chunk.length === 0) break;
        for (const msg of chunk) {
            getHourlyEntry(msg.createdAt).messages++;
            getDailyEntry(msg.createdAt).messages++;
            getMemberDailyEntry(msg.authorId, msg.createdAt).messages++;
            getChannelDailyEntry(msg.channelId, msg.createdAt).messages++;
            totals.messages++;
        }
        cursor = chunk[chunk.length - 1].id;
    }

    cursor = undefined;
    while (true) {
        const chunk = await statsPrisma.statVoiceState.findMany({
            where: { guildId },
            select: { id: true, userId: true, channelId: true, joinedAt: true, leftAt: true, duration: true },
            take: 50000,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
        });
        if (chunk.length === 0) break;
        for (const session of chunk) {
            const duration = getVoiceDurationSeconds(session, now);
            const bucketDate = getVoiceBucketDate(session, now);
            getHourlyEntry(bucketDate).voiceSeconds += duration;
            getDailyEntry(bucketDate).voiceSeconds += duration;
            getMemberDailyEntry(session.userId, bucketDate).voiceSeconds += duration;
            getChannelDailyEntry(session.channelId, bucketDate).voiceSeconds += duration;
            totals.voiceSeconds += duration;
        }
        cursor = chunk[chunk.length - 1].id;
    }

    cursor = undefined;
    while (true) {
        const chunk = await statsPrisma.statInteraction.findMany({
            where: { guildId },
            select: { id: true, fromUserId: true, channelId: true, createdAt: true },
            take: 50000,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
        });
        if (chunk.length === 0) break;
        for (const row of chunk) {
            getMemberDailyEntry(row.fromUserId, row.createdAt).interactions++;
            getChannelDailyEntry(row.channelId, row.createdAt).interactions++;
            totals.interactions++;
        }
        cursor = chunk[chunk.length - 1].id;
    }

    cursor = undefined;
    while (true) {
        const chunk = await statsPrisma.statMemberEvent.findMany({
            where: { guildId },
            select: { id: true, eventType: true, createdAt: true },
            take: 50000,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
        });
        if (chunk.length === 0) break;
        for (const row of chunk) {
            if (row.eventType === 'JOIN') {
                getHourlyEntry(row.createdAt).newMembers++;
                getDailyEntry(row.createdAt).newMembers++;
                totals.joins++;
            } else if (row.eventType === 'LEAVE') {
                getHourlyEntry(row.createdAt).leftMembers++;
                getDailyEntry(row.createdAt).leftMembers++;
                totals.leaves++;
            }
        }
        cursor = chunk[chunk.length - 1].id;
    }

    await statsPrisma.$transaction([
        statsPrisma.statHourly.deleteMany({ where: { guildId } }),
        statsPrisma.statDaily.deleteMany({ where: { guildId } }),
        statsPrisma.statMemberDaily.deleteMany({ where: { guildId } }),
        statsPrisma.statChannelDaily.deleteMany({ where: { guildId } }),
    ]);

    const hourlyData = Array.from(hourlyStats.values()).map((row) => ({
        guildId,
        dateHour: row.dateHour,
        messages: row.messages,
        voiceSeconds: row.voiceSeconds,
        newMembers: row.newMembers,
        leftMembers: row.leftMembers,
    }));
    const dailyData = Array.from(dailyStats.values()).map((row) => ({
        guildId,
        date: row.date,
        messages: row.messages,
        voiceSeconds: row.voiceSeconds,
        newMembers: row.newMembers,
        leftMembers: row.leftMembers,
    }));
    const memberDailyData = Array.from(memberDailyStats.values()).map((row) => ({
        guildId,
        userId: row.userId,
        date: row.date,
        messages: row.messages,
        voiceSeconds: row.voiceSeconds,
        interactions: row.interactions,
    }));
    const channelDailyData = Array.from(channelDailyStats.values()).map((row) => ({
        guildId,
        channelId: row.channelId,
        date: row.date,
        messages: row.messages,
        voiceSeconds: row.voiceSeconds,
        interactions: row.interactions,
    }));

    await createInChunks(
        (chunk) =>
            statsPrisma.$transaction(
                chunk.map((row) => statsPrisma.statHourly.create({ data: row }))
            ),
        hourlyData
    );
    await createInChunks(
        (chunk) =>
            statsPrisma.$transaction(
                chunk.map((row) => statsPrisma.statDaily.create({ data: row }))
            ),
        dailyData
    );
    await createInChunks(
        (chunk) =>
            statsPrisma.$transaction(
                chunk.map((row) => statsPrisma.statMemberDaily.create({ data: row }))
            ),
        memberDailyData
    );
    await createInChunks(
        (chunk) =>
            statsPrisma.$transaction(
                chunk.map((row) => statsPrisma.statChannelDaily.create({ data: row }))
            ),
        channelDailyData
    );

    return {
        totals,
        counts: {
            hourly: hourlyData.length,
            daily: dailyData.length,
            memberDaily: memberDailyData.length,
            channelDaily: channelDailyData.length,
        },
    };
}

async function main() {
    const targetGuildId = getArg('guild');
    const statsUrl = getStatsPgUrl();

    const appPrisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    });
    const statsPrisma = new StatsPgPrismaClient({
        datasources: {
            db: {
                url: statsUrl,
            },
        },
    });

    try {
        await Promise.all([appPrisma.$connect(), statsPrisma.$connect()]);
        const guildIds = await getFlaggedGuildIds(statsPrisma, targetGuildId);

        console.log('[rebuild-flagged] Stats storage: PostgreSQL');
        console.log(`[rebuild-flagged] Guilds to rebuild: ${guildIds.length}`);

        for (const guildId of guildIds) {
            const botSettings = await appPrisma.botSettings.findUnique({
                where: { guildId },
                select: { timezone: true },
            });
            const state = await statsPrisma.statsAggregationState.findUnique({
                where: { guildId },
                select: { timezone: true },
            });
            const timezone = botSettings?.timezone || state?.timezone || 'UTC';

            console.log(`[rebuild-flagged] Rebuilding guild ${guildId} (${timezone})`);

            await ensureLegacyMemberEvents(statsPrisma, guildId);
            const bounds = await getGuildDateBounds(statsPrisma, guildId);
            const result = await rebuildGuild(statsPrisma, guildId, timezone);
            const finishedAt = new Date();

            await statsPrisma.statsAggregationState.upsert({
                where: { guildId },
                update: {
                    timezone,
                    rebuildRequired: false,
                    jobStatus: 'IDLE',
                    lastSuccessfulRebuildAt: finishedAt,
                    lastReadModelSyncAt: finishedAt,
                    lastSourceEventAt: bounds.latest,
                    sourceHighWatermark: bounds.latest ? bounds.latest.toISOString() : null,
                },
                create: {
                    guildId,
                    timezone,
                    schemaVersion: 1,
                    rebuildRequired: false,
                    jobStatus: 'IDLE',
                    lastSuccessfulRebuildAt: finishedAt,
                    lastReadModelSyncAt: finishedAt,
                    lastSourceEventAt: bounds.latest,
                    sourceHighWatermark: bounds.latest ? bounds.latest.toISOString() : null,
                },
            });

            console.log(
                `[rebuild-flagged] Guild ${guildId}: hourly=${result.counts.hourly}, daily=${result.counts.daily}, memberDaily=${result.counts.memberDaily}, channelDaily=${result.counts.channelDaily}, messages=${result.totals.messages}, voiceSeconds=${result.totals.voiceSeconds}, interactions=${result.totals.interactions}, joins=${result.totals.joins}, leaves=${result.totals.leaves}`
            );
        }

        console.log('[rebuild-flagged] Completed successfully');
    } finally {
        await Promise.allSettled([appPrisma.$disconnect(), statsPrisma.$disconnect()]);
    }
}

main().catch((error) => {
    console.error('[rebuild-flagged] Failed:', error);
    process.exit(1);
});
