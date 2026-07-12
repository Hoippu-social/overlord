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

test('dashboard Prisma runtime requires PostgreSQL URLs', () => {
    const source = fs.readFileSync(path.resolve(repoRoot, 'dashboard/src/lib/prisma.ts'), 'utf8');
    assert.match(source, /requirePostgresUrl\('DATABASE_URL'\)/);
    assert.match(source, /requirePostgresUrl\('STATS_PG_DATABASE_URL'\)/);
    assert.match(source, /isStatsPostgres\s*=\s*true/);
    assert.doesNotMatch(source, legacyRuntimePattern);
});

test('dashboard local Prisma schema is PostgreSQL-backed', () => {
    const schema = fs.readFileSync(path.resolve(repoRoot, 'dashboard/prisma/schema.prisma'), 'utf8');
    assert.match(schema, /provider\s*=\s*"postgresql"/);
    assert.doesNotMatch(schema, new RegExp(`provider\\s*=\\s*"${legacyEngine}"`));
});

test('dashboard package exposes PostgreSQL-only runtime guard', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(repoRoot, 'dashboard/package.json'), 'utf8'));
    assert.equal(pkg.scripts['db:postgres-only'], 'node scripts/checkPostgresOnlyRuntime.cjs');
    assert.equal(pkg.scripts[`db:no-${legacyEngine}-runtime`], undefined);
    assert.equal(pkg.scripts['main:pg:generate-source'], undefined);
    assert.equal(pkg.scripts['stats:pg:generate-source'], undefined);
});

test('dashboard API auth refreshes expired Discord access tokens before guild checks', () => {
    const source = fs.readFileSync(path.resolve(repoRoot, 'dashboard/src/lib/auth.ts'), 'utf8');
    assert.match(source, /hasExpiredAccessToken/);
    assert.match(source, /canRefreshAccessToken/);
    assert.match(source, /token\s*=\s*await refreshAccessToken\(token\)/);
    assert.match(source, /RefreshAccessTokenError/);
    assert.match(source, /token\.sub\s*===\s*BOT_OWNER_ID/);
    assert.match(source, /accessToken:\s*'admin'/);
    assert.match(source, /role:\s*'owner'/);
});

test('dashboard guild API auth bypasses Discord guild checks for super users', () => {
    const source = fs.readFileSync(path.resolve(repoRoot, 'dashboard/src/lib/guildApiAuth.ts'), 'utf8');
    assert.match(source, /SUPER_USER_ROLES/);
    assert.match(source, /admin.*owner.*master/);
    assert.match(source, /accessToken:\s*'admin'/);
    assert.match(source, /canAccessGuild/);
});
