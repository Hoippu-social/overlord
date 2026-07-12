const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');
const legacyProvider = ['STATS', 'DB', 'PROVIDER'].join('_');
const legacyStatsUrl = ['STATS', 'DATABASE', 'URL'].join('_');
const legacyEngine = ['sql', 'ite'].join('');
const dbSuffix = ['.', 'd', 'b'].join('');
const legacyRuntimePattern = new RegExp(`${legacyProvider}|${legacyStatsUrl}|file:.*\\${dbSuffix}|stats\\${dbSuffix}|development\\${dbSuffix}`);

test('main Prisma schema is PostgreSQL-backed', () => {
    const schema = fs.readFileSync(path.resolve(repoRoot, 'bot/prisma/schema.prisma'), 'utf8');
    assert.match(schema, /provider\s*=\s*"postgresql"/);
    assert.doesNotMatch(schema, new RegExp(`provider\\s*=\\s*"${legacyEngine}"`));
});

test('bot database runtime uses PostgreSQL-only wiring', () => {
    const source = fs.readFileSync(path.resolve(repoRoot, 'bot/src/utils/database.ts'), 'utf8');
    assert.match(source, /requirePostgresUrl\('DATABASE_URL'\)/);
    assert.match(source, /requirePostgresUrl\('STATS_PG_DATABASE_URL'\)/);
    assert.doesNotMatch(source, legacyRuntimePattern);
});

test('backup runtime uses PostgreSQL dumps only', () => {
    const source = fs.readFileSync(path.resolve(repoRoot, 'bot/src/services/BackupService.ts'), 'utf8');
    assert.match(source, /pg_dump\.exe/);
    assert.match(source, /DATABASE_URL/);
    assert.match(source, /STATS_PG_DATABASE_URL/);
    assert.doesNotMatch(source, new RegExp(`copyFileSync|${legacyStatsUrl}|${legacyProvider}|\\${dbSuffix}`));
});
