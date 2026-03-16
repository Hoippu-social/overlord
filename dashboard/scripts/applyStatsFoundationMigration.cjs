const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_STATS_DB_PATH = path.resolve(__dirname, '../../bot/prisma/stats.db');
const DEFAULT_MIGRATION_PATH = path.resolve(
    __dirname,
    '../../bot/prisma/migrations/20260312170000_stats_control_plane_foundation/migration.sql'
);
const DEFAULT_SNAPSHOT_DIR = path.resolve(__dirname, '../../bot/prisma/staging');

const SOURCE_TABLES = [
    'StatMessage',
    'StatVoiceState',
    'StatInteraction',
    'StatActivity',
    'StatMemberCount',
    'StatHourly',
    'StatDaily',
    'StatTopMember',
    'StatTopChannel',
];

const REQUIRED_NEW_TABLES = [
    'StatMemberEvent',
    'StatMemberDaily',
    'StatChannelDaily',
    'GuildTimezoneHistory',
    'StatsAggregationState',
    'StatsJob',
];

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

function getTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function splitSqlStatements(sql) {
    return sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((statement) => statement.trim())
        .filter(Boolean);
}

async function tableCount(prisma, table) {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM "${table}"`);
    return Number(rows[0] && rows[0].count ? rows[0].count : 0);
}

async function tableExists(prisma, table) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`
    );
    return rows.length > 0;
}

async function main() {
    const statsPathArg = getArg('stats-path');
    const migrationPathArg = getArg('migration-path');
    const statsUrl = buildStatsUrl(statsPathArg || DEFAULT_STATS_DB_PATH);
    const statsPath = statsUrl.replace(/^file:/, '');
    const migrationPath = path.resolve(migrationPathArg || DEFAULT_MIGRATION_PATH);

    if (!fs.existsSync(statsPath)) {
        throw new Error(`Stats DB not found: ${statsPath}`);
    }

    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration SQL not found: ${migrationPath}`);
    }

    fs.mkdirSync(DEFAULT_SNAPSHOT_DIR, { recursive: true });
    const snapshotPath = path.join(
        DEFAULT_SNAPSHOT_DIR,
        `stats_pre_foundation_${getTimestamp()}.db`
    );
    fs.copyFileSync(statsPath, snapshotPath);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: statsUrl,
            },
        },
    });

    try {
        await prisma.$connect();

        const existingTables = [];
        for (const table of REQUIRED_NEW_TABLES) {
            if (await tableExists(prisma, table)) {
                existingTables.push(table);
            }
        }

        if (existingTables.length === REQUIRED_NEW_TABLES.length) {
            console.log('[apply-stats-foundation] Migration already present, skipping DDL');
            console.log(`[apply-stats-foundation] Snapshot created: ${snapshotPath}`);
            return;
        }

        const beforeCounts = {};
        for (const table of SOURCE_TABLES) {
            beforeCounts[table] = await tableCount(prisma, table);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');
        const statements = splitSqlStatements(sql);
        for (const statement of statements) {
            await prisma.$executeRawUnsafe(statement);
        }

        for (const table of REQUIRED_NEW_TABLES) {
            if (!(await tableExists(prisma, table))) {
                throw new Error(`Missing expected table after migration: ${table}`);
            }
        }

        for (const table of SOURCE_TABLES) {
            const afterCount = await tableCount(prisma, table);
            if (afterCount !== beforeCounts[table]) {
                throw new Error(
                    `Count mismatch in ${table}: before=${beforeCounts[table]} after=${afterCount}`
                );
            }
        }

        console.log(`[apply-stats-foundation] Target DB: ${statsPath}`);
        console.log(`[apply-stats-foundation] Snapshot created: ${snapshotPath}`);
        console.log(`[apply-stats-foundation] Applied migration: ${migrationPath}`);
        console.log('[apply-stats-foundation] Source counts preserved');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error('[apply-stats-foundation] Failed:', error);
    process.exit(1);
});
