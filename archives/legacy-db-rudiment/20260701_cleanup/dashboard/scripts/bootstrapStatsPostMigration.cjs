const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_STATS_DB_PATH = path.resolve(__dirname, '../../bot/prisma/stats.db');

function getArg(name) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
}

function splitIntoChunks(items, chunkSize) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

function buildStatsUrl(statsPath) {
    if (statsPath.startsWith('file:')) {
        return statsPath;
    }
    return `file:${path.resolve(statsPath)}`;
}

function isMemberJoinPayload(payload) {
    return payload && payload.event === 'invite_join';
}

function isMemberLeavePayload(payload) {
    return payload && payload.event === 'invite_leave';
}

function getTruncatedUtc(date, timezone, truncateTo) {
    const zoned = toZonedTime(date, timezone);
    const year = zoned.getUTCFullYear();
    const month = String(zoned.getUTCMonth() + 1).padStart(2, '0');
    const day = String(zoned.getUTCDate()).padStart(2, '0');
    const hour = truncateTo === 'hour' ? String(zoned.getUTCHours()).padStart(2, '0') : '00';
    const localTruncated = `${year}-${month}-${day}T${hour}:00:00`;
    return fromZonedTime(localTruncated, timezone);
}

function getVoiceDurationSeconds(session, now) {
    if (!session.joinedAt) return 0;
    const endDate = session.leftAt || now;
    return Math.max(0, Math.floor((endDate.getTime() - session.joinedAt.getTime()) / 1000));
}

function getVoiceBucketDate(session, now) {
    return session.leftAt || now;
}

async function querySingleDate(statsPrisma, sql) {
    const rows = await statsPrisma.$queryRawUnsafe(sql);
    const raw = rows[0] && (rows[0].value || rows[0].minDate || rows[0].maxDate);
    return normalizeRawDate(raw);
}

function normalizeRawDate(value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'bigint') {
        return new Date(Number(value));
    }

    if (typeof value === 'number') {
        return new Date(value);
    }

    if (typeof value === 'string') {
        const numericValue = Number(value);
        if (!Number.isNaN(numericValue) && value.trim() !== '') {
            return new Date(numericValue);
        }
        return new Date(value);
    }

    return new Date(value);
}

async function getGuildDateRange(statsPrisma, guildId) {
    const sqlParts = [
        `SELECT MIN("createdAt") AS value FROM "StatMessage" WHERE "guildId" = '${guildId}'`,
        `SELECT MIN("joinedAt") AS value FROM "StatVoiceState" WHERE "guildId" = '${guildId}'`,
        `SELECT MIN("createdAt") AS value FROM "StatInteraction" WHERE "guildId" = '${guildId}'`,
        `SELECT MIN("startTime") AS value FROM "StatActivity" WHERE "guildId" = '${guildId}'`,
        `SELECT MIN("createdAt") AS value FROM "StatMemberCount" WHERE "guildId" = '${guildId}'`,
        `SELECT MIN("createdAt") AS value FROM "AuditLogEvent" WHERE "guildId" = '${guildId}'`,
    ];
    const minRows = await statsPrisma.$queryRawUnsafe(
        `SELECT MIN(value) AS minDate FROM (${sqlParts.join(' UNION ALL ')}) WHERE value IS NOT NULL`
    );

    const maxSqlParts = [
        `SELECT MAX("createdAt") AS value FROM "StatMessage" WHERE "guildId" = '${guildId}'`,
        `SELECT MAX(COALESCE("leftAt", "joinedAt")) AS value FROM "StatVoiceState" WHERE "guildId" = '${guildId}'`,
        `SELECT MAX("createdAt") AS value FROM "StatInteraction" WHERE "guildId" = '${guildId}'`,
        `SELECT MAX(COALESCE("endTime", "startTime")) AS value FROM "StatActivity" WHERE "guildId" = '${guildId}'`,
        `SELECT MAX("createdAt") AS value FROM "StatMemberCount" WHERE "guildId" = '${guildId}'`,
        `SELECT MAX("createdAt") AS value FROM "AuditLogEvent" WHERE "guildId" = '${guildId}'`,
    ];
    const maxRows = await statsPrisma.$queryRawUnsafe(
        `SELECT MAX(value) AS maxDate FROM (${maxSqlParts.join(' UNION ALL ')}) WHERE value IS NOT NULL`
    );

    return {
        oldest: normalizeRawDate(minRows[0] && minRows[0].minDate),
        latest: normalizeRawDate(maxRows[0] && maxRows[0].maxDate),
    };
}

async function getGuildIds(statsPrisma, targetGuildId) {
    if (targetGuildId) {
        return [targetGuildId];
    }

    const rows = await statsPrisma.$queryRawUnsafe(`
        SELECT guildId FROM "StatMessage"
        UNION
        SELECT guildId FROM "StatVoiceState"
        UNION
        SELECT guildId FROM "StatInteraction"
        UNION
        SELECT guildId FROM "StatActivity"
        UNION
        SELECT guildId FROM "StatMemberCount"
        UNION
        SELECT guildId FROM "AuditLogEvent"
        ORDER BY guildId
    `);

    return rows.map((row) => row.guildId).filter(Boolean);
}

async function ensureTimezoneHistory(statsPrisma, guildId, timezone, effectiveFrom) {
    const existing = await statsPrisma.guildTimezoneHistory.findFirst({
        where: { guildId },
        orderBy: { effectiveFrom: 'asc' },
        select: { id: true },
    });

    if (!existing) {
        await statsPrisma.guildTimezoneHistory.create({
            data: {
                guildId,
                timezone,
                source: 'migration_seed',
                effectiveFrom: effectiveFrom || new Date(),
            },
        });
    }
}

async function seedLegacyMemberEvents(statsPrisma, guildId) {
    let cursor;
    let processed = 0;

    while (true) {
        const chunk = await statsPrisma.auditLogEvent.findMany({
            where: {
                guildId,
                tag: 'invites',
            },
            select: {
                id: true,
                createdAt: true,
                payload: true,
            },
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
            if (isMemberJoinPayload(payload)) eventType = 'JOIN';
            if (isMemberLeavePayload(payload)) eventType = 'LEAVE';
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

        for (const chunkOps of splitIntoChunks(ops, 250)) {
            if (chunkOps.length > 0) {
                await statsPrisma.$transaction(chunkOps);
            }
        }

        processed += chunk.length;
        cursor = chunk[chunk.length - 1].id;
    }

    return processed;
}

async function buildReadModelsForGuild(statsPrisma, guildId, timezone) {
    const now = new Date();
    const memberDaily = new Map();
    const channelDaily = new Map();
    const totals = {
        messages: 0,
        voiceSeconds: 0,
        interactions: 0,
    };

    const getMemberEntry = (userId, date) => {
        const bucketDate = getTruncatedUtc(date, timezone, 'day');
        const key = `${userId}:${bucketDate.toISOString()}`;
        if (!memberDaily.has(key)) {
            memberDaily.set(key, {
                userId,
                date: bucketDate,
                messages: 0,
                voiceSeconds: 0,
                interactions: 0,
            });
        }
        return memberDaily.get(key);
    };

    const getChannelEntry = (channelId, date) => {
        const bucketDate = getTruncatedUtc(date, timezone, 'day');
        const key = `${channelId}:${bucketDate.toISOString()}`;
        if (!channelDaily.has(key)) {
            channelDaily.set(key, {
                channelId,
                date: bucketDate,
                messages: 0,
                voiceSeconds: 0,
                interactions: 0,
            });
        }
        return channelDaily.get(key);
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
        for (const row of chunk) {
            getMemberEntry(row.authorId, row.createdAt).messages++;
            getChannelEntry(row.channelId, row.createdAt).messages++;
            totals.messages++;
        }
        cursor = chunk[chunk.length - 1].id;
    }

    cursor = undefined;
    while (true) {
        const chunk = await statsPrisma.statVoiceState.findMany({
            where: { guildId },
            select: { id: true, userId: true, channelId: true, joinedAt: true, leftAt: true },
            take: 50000,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
        });
        if (chunk.length === 0) break;
        for (const row of chunk) {
            const duration = getVoiceDurationSeconds(row, now);
            const bucketDate = getVoiceBucketDate(row, now);
            getMemberEntry(row.userId, bucketDate).voiceSeconds += duration;
            getChannelEntry(row.channelId, bucketDate).voiceSeconds += duration;
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
            getMemberEntry(row.fromUserId, row.createdAt).interactions++;
            getChannelEntry(row.channelId, row.createdAt).interactions++;
            totals.interactions++;
        }
        cursor = chunk[chunk.length - 1].id;
    }

    const memberOps = Array.from(memberDaily.values()).map((entry) =>
        statsPrisma.statMemberDaily.upsert({
            where: {
                guildId_userId_date: {
                    guildId,
                    userId: entry.userId,
                    date: entry.date,
                },
            },
            update: {
                messages: entry.messages,
                voiceSeconds: entry.voiceSeconds,
                interactions: entry.interactions,
            },
            create: {
                guildId,
                userId: entry.userId,
                date: entry.date,
                messages: entry.messages,
                voiceSeconds: entry.voiceSeconds,
                interactions: entry.interactions,
            },
        })
    );

    const channelOps = Array.from(channelDaily.values()).map((entry) =>
        statsPrisma.statChannelDaily.upsert({
            where: {
                guildId_channelId_date: {
                    guildId,
                    channelId: entry.channelId,
                    date: entry.date,
                },
            },
            update: {
                messages: entry.messages,
                voiceSeconds: entry.voiceSeconds,
                interactions: entry.interactions,
            },
            create: {
                guildId,
                channelId: entry.channelId,
                date: entry.date,
                messages: entry.messages,
                voiceSeconds: entry.voiceSeconds,
                interactions: entry.interactions,
            },
        })
    );

    for (const chunkOps of splitIntoChunks(memberOps, 500)) {
        if (chunkOps.length > 0) {
            await statsPrisma.$transaction(chunkOps);
        }
    }

    for (const chunkOps of splitIntoChunks(channelOps, 500)) {
        if (chunkOps.length > 0) {
            await statsPrisma.$transaction(chunkOps);
        }
    }

    return {
        totals,
        memberRows: memberDaily.size,
        channelRows: channelDaily.size,
    };
}

async function validateGuildReadModels(statsPrisma, guildId, expectedTotals) {
    const memberSums = await statsPrisma.statMemberDaily.aggregate({
        where: { guildId },
        _sum: {
            messages: true,
            voiceSeconds: true,
            interactions: true,
        },
    });
    const channelSums = await statsPrisma.statChannelDaily.aggregate({
        where: { guildId },
        _sum: {
            messages: true,
            voiceSeconds: true,
            interactions: true,
        },
    });

    const compare = (label, expected, actual) => {
        if ((expected || 0) !== (actual || 0)) {
            throw new Error(
                `${label} mismatch for guild ${guildId}: expected ${expected || 0}, got ${actual || 0}`
            );
        }
    };

    compare('member messages', expectedTotals.messages, memberSums._sum.messages);
    compare('channel messages', expectedTotals.messages, channelSums._sum.messages);
    compare('member voiceSeconds', expectedTotals.voiceSeconds, memberSums._sum.voiceSeconds);
    compare('channel voiceSeconds', expectedTotals.voiceSeconds, channelSums._sum.voiceSeconds);
    compare('member interactions', expectedTotals.interactions, memberSums._sum.interactions);
    compare('channel interactions', expectedTotals.interactions, channelSums._sum.interactions);
}

async function ensureAggregationState(statsPrisma, guildId, timezone, latestSourceDate) {
    const now = new Date();
    await statsPrisma.statsAggregationState.upsert({
        where: { guildId },
        update: {
            timezone,
            schemaVersion: 1,
            sourceHighWatermark: latestSourceDate ? latestSourceDate.toISOString() : null,
            rebuildRequired: false,
            jobStatus: 'IDLE',
            lastSuccessfulRebuildAt: now,
            lastSourceEventAt: latestSourceDate,
            lastReadModelSyncAt: now,
        },
        create: {
            guildId,
            timezone,
            schemaVersion: 1,
            sourceHighWatermark: latestSourceDate ? latestSourceDate.toISOString() : null,
            rebuildRequired: false,
            jobStatus: 'IDLE',
            lastSuccessfulRebuildAt: now,
            lastSourceEventAt: latestSourceDate,
            lastReadModelSyncAt: now,
        },
    });
}

async function main() {
    const statsPathArg = getArg('stats-path');
    const targetGuildId = getArg('guild');
    const statsUrl = buildStatsUrl(statsPathArg || DEFAULT_STATS_DB_PATH);
    const statsPath = statsUrl.replace(/^file:/, '');

    if (!fs.existsSync(statsPath)) {
        throw new Error(`Stats DB not found: ${statsPath}`);
    }

    const appPrisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    });

    const statsPrisma = new PrismaClient({
        datasources: {
            db: {
                url: statsUrl,
            },
        },
    });

    try {
        await Promise.all([appPrisma.$connect(), statsPrisma.$connect()]);

        const missingTables = [];
        for (const table of [
            'StatMemberEvent',
            'StatMemberDaily',
            'StatChannelDaily',
            'GuildTimezoneHistory',
            'StatsAggregationState',
        ]) {
            const rows = await statsPrisma.$queryRawUnsafe(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`
            );
            if (rows.length === 0) {
                missingTables.push(table);
            }
        }

        if (missingTables.length > 0) {
            throw new Error(
                `Target stats DB is missing post-migration tables: ${missingTables.join(', ')}`
            );
        }

        const guildIds = await getGuildIds(statsPrisma, targetGuildId);
        console.log(`[bootstrap-stats] Target DB: ${statsPath}`);
        console.log(`[bootstrap-stats] Guilds to process: ${guildIds.length}`);

        for (const guildId of guildIds) {
            const botSettings = await appPrisma.botSettings.findUnique({
                where: { guildId },
                select: { timezone: true },
            });
            const timezone = botSettings && botSettings.timezone ? botSettings.timezone : 'UTC';
            const dateRange = await getGuildDateRange(statsPrisma, guildId);

            console.log(`[bootstrap-stats] Processing guild ${guildId} (${timezone})`);

            await ensureTimezoneHistory(statsPrisma, guildId, timezone, dateRange.oldest);
            const seededEvents = await seedLegacyMemberEvents(statsPrisma, guildId);
            const buildResult = await buildReadModelsForGuild(statsPrisma, guildId, timezone);
            await validateGuildReadModels(statsPrisma, guildId, buildResult.totals);
            await ensureAggregationState(statsPrisma, guildId, timezone, dateRange.latest);

            console.log(
                `[bootstrap-stats] Guild ${guildId}: memberRows=${buildResult.memberRows}, channelRows=${buildResult.channelRows}, legacyMemberEventsProcessed=${seededEvents}`
            );
        }

        console.log('[bootstrap-stats] Completed successfully');
    } finally {
        await Promise.allSettled([appPrisma.$disconnect(), statsPrisma.$disconnect()]);
    }
}

main().catch((error) => {
    console.error('[bootstrap-stats] Failed:', error);
    process.exit(1);
});
