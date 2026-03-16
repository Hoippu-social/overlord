const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient: SqlitePrismaClient } = require('@prisma/client');

const ROOT_DIR = path.resolve(__dirname, '../..');
const DEFAULT_SOURCE_STATS_DB = path.resolve(ROOT_DIR, '../bot/prisma/stats.db');
const DEFAULT_MANIFEST_DIR = path.resolve(ROOT_DIR, '../bot/prisma/staging');
const POSTGRES_CLIENT_PATH = path.resolve(ROOT_DIR, 'src/generated/stats-pg-client');

const WORKLOAD_TABLES = [
    {
        label: 'Guild',
        sourceModel: 'guild',
        targetModel: 'guild',
        primaryKey: 'id',
        kind: 'string',
    },
    {
        label: 'AuditLogEvent',
        sourceModel: 'auditLogEvent',
        targetModel: 'auditLogEvent',
        primaryKey: 'id',
        kind: 'int',
    },
    {
        label: 'MessageEvent',
        sourceModel: 'messageEvent',
        targetModel: 'messageEvent',
        primaryKey: 'id',
        kind: 'int',
    },
    {
        label: 'InviteSnapshot',
        sourceModel: 'inviteSnapshot',
        targetModel: 'inviteSnapshot',
        primaryKey: 'id',
        kind: 'int',
    },
    {
        label: 'InviteUseEvent',
        sourceModel: 'inviteUseEvent',
        targetModel: 'inviteUseEvent',
        primaryKey: 'id',
        kind: 'int',
    },
    {
        label: 'StatMessage',
        sourceModel: 'statMessage',
        targetModel: 'statMessage',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'createdAt',
    },
    {
        label: 'StatVoiceState',
        sourceModel: 'statVoiceState',
        targetModel: 'statVoiceState',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'joinedAt',
    },
    {
        label: 'StatMemberCount',
        sourceModel: 'statMemberCount',
        targetModel: 'statMemberCount',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'createdAt',
    },
    {
        label: 'StatMemberEvent',
        sourceModel: 'statMemberEvent',
        targetModel: 'statMemberEvent',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'createdAt',
    },
    {
        label: 'StatHourly',
        sourceModel: 'statHourly',
        targetModel: 'statHourly',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'dateHour',
    },
    {
        label: 'StatDaily',
        sourceModel: 'statDaily',
        targetModel: 'statDaily',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'date',
    },
    {
        label: 'StatTopMember',
        sourceModel: 'statTopMember',
        targetModel: 'statTopMember',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'updatedAt',
    },
    {
        label: 'StatTopChannel',
        sourceModel: 'statTopChannel',
        targetModel: 'statTopChannel',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'updatedAt',
    },
    {
        label: 'StatMemberDaily',
        sourceModel: 'statMemberDaily',
        targetModel: 'statMemberDaily',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'date',
    },
    {
        label: 'StatChannelDaily',
        sourceModel: 'statChannelDaily',
        targetModel: 'statChannelDaily',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'date',
    },
    {
        label: 'StatActivity',
        sourceModel: 'statActivity',
        targetModel: 'statActivity',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'startTime',
    },
    {
        label: 'StatInteraction',
        sourceModel: 'statInteraction',
        targetModel: 'statInteraction',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'createdAt',
    },
    {
        label: 'GuildTimezoneHistory',
        sourceModel: 'guildTimezoneHistory',
        targetModel: 'guildTimezoneHistory',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'effectiveFrom',
    },
    {
        label: 'StatsAggregationState',
        sourceModel: 'statsAggregationState',
        targetModel: 'statsAggregationState',
        primaryKey: 'guildId',
        kind: 'string',
        dateField: 'updatedAt',
    },
    {
        label: 'StatsJob',
        sourceModel: 'statsJob',
        targetModel: 'statsJob',
        primaryKey: 'id',
        kind: 'int',
        dateField: 'createdAt',
    },
];

function loadEnv() {
    dotenv.config({ path: path.resolve(ROOT_DIR, '.env') });
}

function getArg(name) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
}

function buildSqliteUrl(inputPath) {
    if (!inputPath) {
        return `file:${DEFAULT_SOURCE_STATS_DB}`;
    }
    if (inputPath.startsWith('file:')) {
        return inputPath;
    }
    return `file:${path.resolve(inputPath)}`;
}

function getSourceStatsUrl() {
    return getArg('source') || process.env.STATS_SOURCE_DATABASE_URL || process.env.STATS_DATABASE_URL || buildSqliteUrl(DEFAULT_SOURCE_STATS_DB);
}

function getTargetStatsPgUrl() {
    return getArg('target') || process.env.STATS_PG_DATABASE_URL || '';
}

function getChunkSize() {
    const raw = Number(getArg('chunk-size') || process.env.STATS_PG_BACKFILL_CHUNK_SIZE || 500);
    if (!Number.isFinite(raw) || raw <= 0) {
        return 500;
    }
    return Math.floor(raw);
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

function getManifestPath(prefix) {
    ensureDir(DEFAULT_MANIFEST_DIR);
    return path.resolve(DEFAULT_MANIFEST_DIR, `${prefix}_${getTimestamp()}.json`);
}

function createSourceClient(url) {
    return new SqlitePrismaClient({
        datasources: {
            db: { url },
        },
    });
}

function loadTargetClientCtor() {
    if (!fs.existsSync(POSTGRES_CLIENT_PATH)) {
        throw new Error(`Postgres Prisma client is not generated yet: ${POSTGRES_CLIENT_PATH}`);
    }
    return require(POSTGRES_CLIENT_PATH).PrismaClient;
}

function createTargetClient(url) {
    const PgPrismaClient = loadTargetClientCtor();
    return new PgPrismaClient({
        datasources: {
            db: { url },
        },
    });
}

async function fetchCount(client, model) {
    return client[model].count();
}

async function fetchBoundary(client, model, field, direction) {
    if (!field) return null;
    const row = await client[model].findFirst({
        select: { [field]: true },
        orderBy: { [field]: direction },
    });
    return row ? row[field] : null;
}

async function buildTableSummary(client, table) {
    return {
        table: table.label,
        count: await fetchCount(client, table.sourceModel),
        minDate: table.dateField ? await fetchBoundary(client, table.sourceModel, table.dateField, 'asc') : null,
        maxDate: table.dateField ? await fetchBoundary(client, table.sourceModel, table.dateField, 'desc') : null,
    };
}

async function readBatch(client, table, cursor, take) {
    const orderBy = { [table.primaryKey]: 'asc' };
    const query = {
        take,
        orderBy,
    };

    if (cursor !== null && cursor !== undefined) {
        query.cursor = { [table.primaryKey]: cursor };
        query.skip = 1;
    }

    return client[table.sourceModel].findMany(query);
}

async function syncSequence(target, label) {
    const sql = `SELECT setval(pg_get_serial_sequence('"${label}"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${label}"`;
    await target.$executeRawUnsafe(sql);
}

module.exports = {
    DEFAULT_MANIFEST_DIR,
    POSTGRES_CLIENT_PATH,
    WORKLOAD_TABLES,
    buildTableSummary,
    createSourceClient,
    createTargetClient,
    ensureDir,
    fetchCount,
    getArg,
    getChunkSize,
    getManifestPath,
    getSourceStatsUrl,
    getTargetStatsPgUrl,
    loadEnv,
    readBatch,
    syncSequence,
};
