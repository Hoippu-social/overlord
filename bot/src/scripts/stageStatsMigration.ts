import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

type TableCount = {
    table: string;
    sourceCount: number;
    stagedCount: number;
};

const SOURCE_DB_PATH = path.resolve(__dirname, '../../prisma/stats.db');
const STAGING_DIR = path.resolve(__dirname, '../../prisma/staging');
const MIGRATION_PATH = path.resolve(
    __dirname,
    '../../prisma/migrations/20260312170000_stats_control_plane_foundation/migration.sql'
);

const SOURCE_TABLES_TO_COMPARE = [
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

function getArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    const arg = process.argv.find((entry) => entry.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
}

function getTimestamp(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function splitSqlStatements(sql: string): string[] {
    return sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((statement) => statement.trim())
        .filter(Boolean);
}

async function tableCount(client: PrismaClient, table: string): Promise<number> {
    const rows = await client.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*) as count FROM "${table}"`
    );
    return Number(rows[0]?.count ?? 0);
}

async function tableExists(client: PrismaClient, table: string): Promise<boolean> {
    const rows = await client.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`
    );
    return rows.length > 0;
}

async function main() {
    const sourcePath = path.resolve(getArg('source') || SOURCE_DB_PATH);
    const outPath = path.resolve(
        getArg('out') || path.join(STAGING_DIR, `stats_stage_${getTimestamp()}.db`)
    );
    const migrationPath = path.resolve(getArg('migration') || MIGRATION_PATH);

    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source stats DB not found: ${sourcePath}`);
    }

    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration SQL not found: ${migrationPath}`);
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.copyFileSync(sourcePath, outPath);

    const sourceClient = new PrismaClient({
        datasources: { db: { url: `file:${sourcePath}` } },
    });
    const stagedClient = new PrismaClient({
        datasources: { db: { url: `file:${outPath}` } },
    });

    try {
        await sourceClient.$connect();
        await stagedClient.$connect();

        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        const statements = splitSqlStatements(migrationSql);

        for (const statement of statements) {
            await stagedClient.$executeRawUnsafe(statement);
        }

        const counts: TableCount[] = [];
        for (const table of SOURCE_TABLES_TO_COMPARE) {
            counts.push({
                table,
                sourceCount: await tableCount(sourceClient, table),
                stagedCount: await tableCount(stagedClient, table),
            });
        }

        const mismatchedCounts = counts.filter(
            (entry) => entry.sourceCount !== entry.stagedCount
        );
        if (mismatchedCounts.length > 0) {
            throw new Error(
                `Source count mismatch after migration copy: ${JSON.stringify(mismatchedCounts)}`
            );
        }

        const missingTables: string[] = [];
        for (const table of REQUIRED_NEW_TABLES) {
            if (!(await tableExists(stagedClient, table))) {
                missingTables.push(table);
            }
        }

        if (missingTables.length > 0) {
            throw new Error(`Missing new tables after migration: ${missingTables.join(', ')}`);
        }

        console.log(`[stage-stats-migration] Source: ${sourcePath}`);
        console.log(`[stage-stats-migration] Staged copy: ${outPath}`);
        console.log(`[stage-stats-migration] Migration: ${migrationPath}`);
        console.log('[stage-stats-migration] Source counts preserved:');
        for (const entry of counts) {
            console.log(`  - ${entry.table}: ${entry.stagedCount}`);
        }
        console.log('[stage-stats-migration] New tables present:');
        for (const table of REQUIRED_NEW_TABLES) {
            console.log(`  - ${table}`);
        }
    } finally {
        await Promise.allSettled([sourceClient.$disconnect(), stagedClient.$disconnect()]);
    }
}

main().catch((error) => {
    console.error('[stage-stats-migration] Failed:', error);
    process.exit(1);
});
