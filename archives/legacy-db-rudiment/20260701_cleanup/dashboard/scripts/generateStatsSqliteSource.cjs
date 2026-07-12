const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    ROOT_DIR,
    getSourceStatsUrl,
    loadEnv,
} = require('./lib/statsPgMigration.cjs');

const targetSchema = path.resolve(ROOT_DIR, 'prisma/stats-sqlite-source.schema.prisma');

function buildSqliteSourceSchema() {
    return [
        '// Generated stats migration-source schema. Do not use for runtime.',
        'generator client {',
        '  provider = "prisma-client-js"',
        '  output   = "../src/generated/stats-sqlite-source-client"',
        '}',
        '',
        'datasource db {',
        '  provider = "sqlite"',
        '  url      = env("STATS_SQLITE_SOURCE_URL")',
        '}',
        '',
    ].join('\n');
}

function runPrisma(args, env) {
    const result = process.platform === 'win32'
        ? spawnSync('cmd.exe', ['/c', 'npx', ...args], { cwd: ROOT_DIR, stdio: 'inherit', env })
        : spawnSync(path.resolve(ROOT_DIR, 'node_modules/.bin/prisma'), args.slice(1), { cwd: ROOT_DIR, stdio: 'inherit', env });

    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

function restoreDatasourceUrl() {
    const text = fs.readFileSync(targetSchema, 'utf8');
    const next = text.replace(/url\s*=\s*env\("DATABASE_URL"\)/, 'url      = env("STATS_SQLITE_SOURCE_URL")');
    fs.writeFileSync(targetSchema, next);
}

function main() {
    loadEnv();
    const env = { ...process.env, STATS_SQLITE_SOURCE_URL: getSourceStatsUrl() };
    fs.mkdirSync(path.dirname(targetSchema), { recursive: true });
    fs.writeFileSync(targetSchema, buildSqliteSourceSchema());
    console.log('[StatsSqliteSource] Wrote schema:', targetSchema);
    runPrisma(['prisma', 'db', 'pull', '--schema', 'prisma/stats-sqlite-source.schema.prisma', '--force'], env);
    restoreDatasourceUrl();
    runPrisma(['prisma', 'generate', '--schema', 'prisma/stats-sqlite-source.schema.prisma'], env);
}

try {
    main();
} catch (error) {
    console.error('[StatsSqliteSource] Failed:', error.message || error);
    process.exit(1);
}
