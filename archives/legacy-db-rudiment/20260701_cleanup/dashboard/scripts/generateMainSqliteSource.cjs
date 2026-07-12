const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');
const {
    ROOT_DIR,
    getSourceMainUrl,
    loadEnv,
} = require('./lib/mainPgMigration.cjs');

const targetSchema = path.resolve(ROOT_DIR, 'prisma/main-sqlite-source.schema.prisma');

function buildSqliteSourceSchema() {
    return [
        '// Generated migration-source schema. Do not use for runtime.',
        'generator client {',
        '  provider = "prisma-client-js"',
        '  output   = "../src/generated/main-sqlite-source-client"',
        '}',
        '',
        'datasource db {',
        '  provider = "sqlite"',
        '  url      = env("MAIN_SQLITE_SOURCE_URL")',
        '}',
        '',
    ].join('\n');
}

function runPrisma(args, env) {
    const cwd = ROOT_DIR;
    const result = process.platform === 'win32'
        ? spawnSync('cmd.exe', ['/c', 'npx', ...args], { cwd, stdio: 'inherit', env })
        : spawnSync(path.resolve(cwd, 'node_modules/.bin/prisma'), args.slice(1), { cwd, stdio: 'inherit', env });

    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
    loadEnv();
    const sourceUrl = getSourceMainUrl();
    const env = { ...process.env, MAIN_SQLITE_SOURCE_URL: sourceUrl };
    fs.mkdirSync(path.dirname(targetSchema), { recursive: true });
    fs.writeFileSync(targetSchema, buildSqliteSourceSchema());
    console.log('[MainSqliteSource] Wrote schema:', targetSchema);
    runPrisma(['prisma', 'db', 'pull', '--schema', 'prisma/main-sqlite-source.schema.prisma', '--force'], env);
    runPrisma(['prisma', 'generate', '--schema', 'prisma/main-sqlite-source.schema.prisma'], env);
}

try {
    main();
} catch (error) {
    console.error('[MainSqliteSource] Failed:', error.message || error);
    process.exit(1);
}
