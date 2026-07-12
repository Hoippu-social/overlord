const path = require('path');
const { spawnSync } = require('child_process');
const { BOT_ROOT, getMainPostgresUrl, loadEnv } = require('./lib/postgresOnly.cjs');

function main() {
    loadEnv();
    if (!getMainPostgresUrl()) {
        throw new Error('MAIN_PG_DATABASE_URL or PostgreSQL DATABASE_URL is not configured');
    }

    const result = process.platform === 'win32'
        ? spawnSync(
            'cmd.exe',
            ['/c', 'npx', 'prisma', 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'],
            { cwd: BOT_ROOT, stdio: 'inherit', env: process.env }
        )
        : spawnSync(
            path.resolve(BOT_ROOT, 'node_modules/.bin/prisma'),
            ['db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'],
            { cwd: BOT_ROOT, stdio: 'inherit', env: process.env }
        );

    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
    main();
} catch (error) {
    console.error('[MainPgPush] Failed:', error.message || error);
    process.exit(1);
}
