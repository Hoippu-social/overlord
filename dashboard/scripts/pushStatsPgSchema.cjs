const path = require('path');
const { spawnSync } = require('child_process');
const { getTargetStatsPgUrl, loadEnv } = require('./lib/statsPgMigration.cjs');

function main() {
    loadEnv();

    if (!getTargetStatsPgUrl()) {
        throw new Error('STATS_PG_DATABASE_URL is not configured');
    }

    const cwd = path.resolve(__dirname, '..');
    const result = process.platform === 'win32'
        ? spawnSync(
            'cmd.exe',
            ['/c', 'npx', 'prisma', 'db', 'push', '--schema', 'prisma/stats-postgres.schema.prisma', '--skip-generate'],
            {
                cwd,
                stdio: 'inherit',
                env: process.env,
            }
        )
        : spawnSync(
            path.resolve(__dirname, '../node_modules/.bin/prisma'),
            ['db', 'push', '--schema', 'prisma/stats-postgres.schema.prisma', '--skip-generate'],
            {
                cwd,
                stdio: 'inherit',
                env: process.env,
            }
        );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

try {
    main();
} catch (error) {
    console.error('[StatsPgPush] Failed:', error.message || error);
    process.exit(1);
}
