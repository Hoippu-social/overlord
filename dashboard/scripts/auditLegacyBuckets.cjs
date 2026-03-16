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

function buildStatsUrl(statsPath) {
    if (statsPath.startsWith('file:')) {
        return statsPath;
    }
    return `file:${path.resolve(statsPath)}`;
}

function normalizeDateValue(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'bigint') return new Date(Number(value));
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const asNumber = Number(value);
        if (!Number.isNaN(asNumber) && value.trim() !== '') {
            return new Date(asNumber);
        }
        return new Date(value);
    }
    return new Date(value);
}

function getExpectedUtcHour(date, timezone) {
    const zoned = toZonedTime(date, timezone);
    const yyyy = zoned.getUTCFullYear();
    const mm = String(zoned.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(zoned.getUTCDate()).padStart(2, '0');
    const expected = fromZonedTime(`${yyyy}-${mm}-${dd}T00:00:00`, timezone);
    return expected.getUTCHours();
}

async function getGuildIds(statsPrisma, targetGuildId) {
    if (targetGuildId) return [targetGuildId];

    const rows = await statsPrisma.$queryRawUnsafe(`
        SELECT guildId FROM "StatsAggregationState"
        UNION
        SELECT guildId FROM "StatDaily"
        ORDER BY guildId
    `);

    return rows.map((row) => row.guildId).filter(Boolean);
}

async function main() {
    const statsPathArg = getArg('stats-path');
    const targetGuildId = getArg('guild');
    const mark = getArg('mark') !== 'false';
    const statsUrl = buildStatsUrl(statsPathArg || DEFAULT_STATS_DB_PATH);

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

        const guildIds = await getGuildIds(statsPrisma, targetGuildId);
        console.log(`[audit-buckets] Target guilds: ${guildIds.length}`);

        let flagged = 0;

        for (const guildId of guildIds) {
            const [state, botSettings, dailyRows] = await Promise.all([
                statsPrisma.statsAggregationState.findUnique({
                    where: { guildId },
                    select: {
                        timezone: true,
                        rebuildRequired: true,
                    },
                }),
                appPrisma.botSettings.findUnique({
                    where: { guildId },
                    select: { timezone: true },
                }),
                statsPrisma.statDaily.findMany({
                    where: { guildId },
                    select: { date: true },
                    orderBy: { date: 'asc' },
                }),
            ]);

            const configuredTimezone = botSettings?.timezone || state?.timezone || 'UTC';
            const actualHours = new Set();
            const expectedHours = new Set();
            let mismatchedRows = 0;

            for (const row of dailyRows) {
                const date = normalizeDateValue(row.date);
                const actualHour = date.getUTCHours();
                const expectedHour = getExpectedUtcHour(date, configuredTimezone);
                actualHours.add(actualHour);
                expectedHours.add(expectedHour);
                if (actualHour !== expectedHour) {
                    mismatchedRows += 1;
                }
            }

            const timezoneMismatch = Boolean(state?.timezone && state.timezone !== configuredTimezone);
            const shouldMark = mismatchedRows > 0 || timezoneMismatch;

            if (shouldMark) {
                flagged += 1;
                if (mark) {
                    await statsPrisma.statsAggregationState.upsert({
                        where: { guildId },
                        update: {
                            timezone: configuredTimezone,
                            rebuildRequired: true,
                            jobStatus: state?.rebuildRequired ? undefined : 'IDLE',
                        },
                        create: {
                            guildId,
                            timezone: configuredTimezone,
                            schemaVersion: 1,
                            rebuildRequired: true,
                            jobStatus: 'IDLE',
                        },
                    });
                }
            }

            console.log(
                `[audit-buckets] guild=${guildId} timezone=${configuredTimezone} actualHours=${Array.from(actualHours).sort((a, b) => a - b).join(',') || '-'} expectedHours=${Array.from(expectedHours).sort((a, b) => a - b).join(',') || '-'} mismatchedRows=${mismatchedRows} timezoneMismatch=${timezoneMismatch} flagged=${shouldMark}`
            );
        }

        console.log(`[audit-buckets] Flagged guilds: ${flagged}`);
    } finally {
        await Promise.allSettled([appPrisma.$disconnect(), statsPrisma.$disconnect()]);
    }
}

main().catch((error) => {
    console.error('[audit-buckets] Failed:', error);
    process.exit(1);
});
