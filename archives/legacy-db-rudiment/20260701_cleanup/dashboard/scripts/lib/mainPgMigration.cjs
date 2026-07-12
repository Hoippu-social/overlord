const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(ROOT_DIR, '..');
const BOT_ROOT = path.resolve(REPO_ROOT, 'bot');
const DEFAULT_SOURCE_MAIN_DB = path.resolve(BOT_ROOT, 'prisma/development.db');
const DEFAULT_ARCHIVE_DIR = path.resolve(REPO_ROOT, 'archives/sqlite');
const DEFAULT_MANIFEST_DIR = path.resolve(BOT_ROOT, 'prisma/staging');
const SQLITE_SOURCE_CLIENT_PATH = path.resolve(ROOT_DIR, 'src/generated/main-sqlite-source-client');

const MAIN_WORKLOAD_TABLES = [
    { label: 'User', sourceModel: 'user', targetModel: 'user', primaryKey: 'id', kind: 'string', dateField: 'createdAt' },
    { label: 'Guild', sourceModel: 'guild', targetModel: 'guild', primaryKey: 'id', kind: 'string', dateField: 'createdAt' },
    { label: 'BotSettings', sourceModel: 'botSettings', targetModel: 'botSettings', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'MusicConfig', sourceModel: 'musicConfig', targetModel: 'musicConfig', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'Warning', sourceModel: 'warning', targetModel: 'warning', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'ModerationConfig', sourceModel: 'moderationConfig', targetModel: 'moderationConfig', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'ModerationRoleBinding', sourceModel: 'moderationRoleBinding', targetModel: 'moderationRoleBinding', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'ModerationCase', sourceModel: 'moderationCase', targetModel: 'moderationCase', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AppealConfig', sourceModel: 'appealConfig', targetModel: 'appealConfig', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AppealTicket', sourceModel: 'appealTicket', targetModel: 'appealTicket', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AppealEvent', sourceModel: 'appealEvent', targetModel: 'appealEvent', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'RetentionPolicy', sourceModel: 'retentionPolicy', targetModel: 'retentionPolicy', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'ModerationCaseNote', sourceModel: 'moderationCaseNote', targetModel: 'moderationCaseNote', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'ModerationCommandGrant', sourceModel: 'moderationCommandGrant', targetModel: 'moderationCommandGrant', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AutomodRuleConfig', sourceModel: 'automodRuleConfig', targetModel: 'automodRuleConfig', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AutomodCustomRule', sourceModel: 'automodCustomRule', targetModel: 'automodCustomRule', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AutomodSanctionStep', sourceModel: 'automodSanctionStep', targetModel: 'automodSanctionStep', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AiModerationConfig', sourceModel: 'aiModerationConfig', targetModel: 'aiModerationConfig', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AiModerationCategoryRule', sourceModel: 'aiModerationCategoryRule', targetModel: 'aiModerationCategoryRule', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AiModerationIncident', sourceModel: 'aiModerationIncident', targetModel: 'aiModerationIncident', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'TempVoiceConfig', sourceModel: 'tempVoiceConfig', targetModel: 'tempVoiceConfig', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'TempVoiceRoom', sourceModel: 'tempVoiceRoom', targetModel: 'tempVoiceRoom', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'UserVoiceSettings', sourceModel: 'userVoiceSettings', targetModel: 'userVoiceSettings', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'MusicNowPlaying', sourceModel: 'musicNowPlaying', targetModel: 'musicNowPlaying', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'MessageEvent', sourceModel: 'messageEvent', targetModel: 'messageEvent', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AuditLogEvent', sourceModel: 'auditLogEvent', targetModel: 'auditLogEvent', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'AuditTagRoute', sourceModel: 'auditTagRoute', targetModel: 'auditTagRoute', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'InviteSnapshot', sourceModel: 'inviteSnapshot', targetModel: 'inviteSnapshot', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'InviteUseEvent', sourceModel: 'inviteUseEvent', targetModel: 'inviteUseEvent', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'StatMessage', sourceModel: 'statMessage', targetModel: 'statMessage', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'StatVoiceState', sourceModel: 'statVoiceState', targetModel: 'statVoiceState', primaryKey: 'id', kind: 'int', dateField: 'joinedAt' },
    { label: 'StatMemberCount', sourceModel: 'statMemberCount', targetModel: 'statMemberCount', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'StatMemberEvent', sourceModel: 'statMemberEvent', targetModel: 'statMemberEvent', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'StatHourly', sourceModel: 'statHourly', targetModel: 'statHourly', primaryKey: 'id', kind: 'int', dateField: 'dateHour' },
    { label: 'StatDaily', sourceModel: 'statDaily', targetModel: 'statDaily', primaryKey: 'id', kind: 'int', dateField: 'date' },
    { label: 'StatTopMember', sourceModel: 'statTopMember', targetModel: 'statTopMember', primaryKey: 'id', kind: 'int', dateField: 'updatedAt' },
    { label: 'StatTopChannel', sourceModel: 'statTopChannel', targetModel: 'statTopChannel', primaryKey: 'id', kind: 'int', dateField: 'updatedAt' },
    { label: 'StatMemberDaily', sourceModel: 'statMemberDaily', targetModel: 'statMemberDaily', primaryKey: 'id', kind: 'int', dateField: 'date' },
    { label: 'StatChannelDaily', sourceModel: 'statChannelDaily', targetModel: 'statChannelDaily', primaryKey: 'id', kind: 'int', dateField: 'date' },
    { label: 'StatActivity', sourceModel: 'statActivity', targetModel: 'statActivity', primaryKey: 'id', kind: 'int', dateField: 'startTime' },
    { label: 'StatInteraction', sourceModel: 'statInteraction', targetModel: 'statInteraction', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'GuildTimezoneHistory', sourceModel: 'guildTimezoneHistory', targetModel: 'guildTimezoneHistory', primaryKey: 'id', kind: 'int', dateField: 'effectiveFrom' },
    { label: 'StatsAggregationState', sourceModel: 'statsAggregationState', targetModel: 'statsAggregationState', primaryKey: 'guildId', kind: 'string', dateField: 'updatedAt' },
    { label: 'StatsJob', sourceModel: 'statsJob', targetModel: 'statsJob', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'TicketConfig', sourceModel: 'ticketConfig', targetModel: 'ticketConfig', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'TicketCategory', sourceModel: 'ticketCategory', targetModel: 'ticketCategory', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'TicketItem', sourceModel: 'ticketItem', targetModel: 'ticketItem', primaryKey: 'id', kind: 'int' },
    { label: 'TicketFormQuestion', sourceModel: 'ticketFormQuestion', targetModel: 'ticketFormQuestion', primaryKey: 'id', kind: 'int' },
    { label: 'Ticket', sourceModel: 'ticket', targetModel: 'ticket', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
    { label: 'TicketEvent', sourceModel: 'ticketEvent', targetModel: 'ticketEvent', primaryKey: 'id', kind: 'int', dateField: 'createdAt' },
];

function loadEnv() {
    dotenv.config({ path: path.resolve(BOT_ROOT, '.env') });
    dotenv.config({ path: path.resolve(ROOT_DIR, '.env'), override: true });
}

function getArg(name) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

function buildSqliteUrl(inputPath) {
    if (!inputPath) return `file:${DEFAULT_SOURCE_MAIN_DB}`;
    if (inputPath.startsWith('file:')) return inputPath;
    return `file:${path.resolve(inputPath)}`;
}

function assertPostgresUrl(value, name) {
    if (!value || !/^postgres(ql)?:\/\//i.test(value)) {
        throw new Error(`${name} must be a PostgreSQL URL`);
    }
    return value;
}

function getSourceMainUrl() {
    return getArg('source') || process.env.MAIN_SQLITE_SOURCE_URL || buildSqliteUrl(DEFAULT_SOURCE_MAIN_DB);
}

function getTargetMainPgUrl() {
    const candidate = getArg('target') || process.env.MAIN_PG_DATABASE_URL || process.env.DATABASE_URL || '';
    return candidate ? assertPostgresUrl(candidate, 'MAIN_PG_DATABASE_URL or DATABASE_URL') : '';
}

function getChunkSize() {
    const raw = Number(getArg('chunk-size') || process.env.MAIN_PG_BACKFILL_CHUNK_SIZE || 500);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 500;
}

function getManifestPath(prefix) {
    ensureDir(DEFAULT_MANIFEST_DIR);
    return path.resolve(DEFAULT_MANIFEST_DIR, `${prefix}_${getTimestamp()}.json`);
}

function getArchivePath() {
    const explicit = getArg('archive-dir') || process.env.SQLITE_ARCHIVE_DIR;
    const dir = explicit ? path.resolve(explicit) : path.resolve(DEFAULT_ARCHIVE_DIR, getTimestamp());
    ensureDir(dir);
    return dir;
}

function loadSqliteSourceClientCtor() {
    if (!fs.existsSync(SQLITE_SOURCE_CLIENT_PATH)) {
        throw new Error(`SQLite source Prisma client is not generated yet: ${SQLITE_SOURCE_CLIENT_PATH}`);
    }
    return require(SQLITE_SOURCE_CLIENT_PATH).PrismaClient;
}

function createSourceClient(url) {
    const SqliteSourceClient = loadSqliteSourceClientCtor();
    return new SqliteSourceClient({ datasources: { db: { url } } });
}

function createTargetClient(url) {
    const { PrismaClient } = require('@prisma/client');
    return new PrismaClient({ datasources: { db: { url } } });
}

async function fetchCount(client, model) {
    if (!client[model]) return 0;
    try {
        return await client[model].count();
    } catch (error) {
        if (String(error?.message || error).includes('does not exist')) return 0;
        throw error;
    }
}

async function fetchBoundary(client, model, field, direction) {
    if (!field) return null;
    if (!client[model]) return null;
    const row = await client[model].findFirst({
        select: { [field]: true },
        orderBy: { [field]: direction },
    });
    return row ? row[field] : null;
}

async function fetchMaxPk(client, table) {
    if (table.kind !== 'int') return null;
    if (!client[table.sourceModel]) return null;
    const row = await client[table.sourceModel].findFirst({
        select: { [table.primaryKey]: true },
        orderBy: { [table.primaryKey]: 'desc' },
    });
    return row ? row[table.primaryKey] : null;
}

async function buildTableSummary(client, table) {
    return {
        table: table.label,
        exists: Boolean(client[table.sourceModel]),
        count: await fetchCount(client, table.sourceModel),
        maxId: await fetchMaxPk(client, table),
        minDate: table.dateField ? await fetchBoundary(client, table.sourceModel, table.dateField, 'asc') : null,
        maxDate: table.dateField ? await fetchBoundary(client, table.sourceModel, table.dateField, 'desc') : null,
    };
}

async function readBatch(client, table, cursor, take) {
    if (!client[table.sourceModel]) return [];
    const query = { take, orderBy: { [table.primaryKey]: 'asc' } };
    if (cursor !== null && cursor !== undefined) {
        query.cursor = { [table.primaryKey]: cursor };
        query.skip = 1;
    }
    return client[table.sourceModel].findMany(query);
}

function stableJson(value) {
    return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((result, key) => {
                if (value[key] === null) return result;
                result[key] = canonicalize(value[key]);
                return result;
            }, {});
    }
    return value;
}

async function buildTableChecksum(client, table, chunkSize = 1000) {
    const hash = crypto.createHash('sha256');
    let cursor = null;
    let chunks = 0;
    let rows = 0;
    while (true) {
        const batch = await readBatch(client, table, cursor, chunkSize);
        if (batch.length === 0) break;
        hash.update(batch.map(stableJson).join('\n'));
        rows += batch.length;
        chunks += 1;
        cursor = batch[batch.length - 1][table.primaryKey];
    }
    return { rows, chunks, sha256: hash.digest('hex') };
}

async function syncSequence(target, label) {
    const sql = `SELECT setval(pg_get_serial_sequence('"${label}"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${label}"`;
    await target.$executeRawUnsafe(sql);
}

module.exports = {
    BOT_ROOT,
    DEFAULT_ARCHIVE_DIR,
    DEFAULT_MANIFEST_DIR,
    DEFAULT_SOURCE_MAIN_DB,
    MAIN_WORKLOAD_TABLES,
    REPO_ROOT,
    ROOT_DIR,
    SQLITE_SOURCE_CLIENT_PATH,
    buildTableChecksum,
    buildTableSummary,
    createSourceClient,
    createTargetClient,
    ensureDir,
    fetchCount,
    getArchivePath,
    getArg,
    getChunkSize,
    getManifestPath,
    getSourceMainUrl,
    getTargetMainPgUrl,
    loadEnv,
    readBatch,
    stableJson,
    syncSequence,
};
