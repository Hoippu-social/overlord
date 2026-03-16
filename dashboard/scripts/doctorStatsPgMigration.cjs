const fs = require('fs');
const path = require('path');
const {
    POSTGRES_CLIENT_PATH,
    WORKLOAD_TABLES,
    createTargetClient,
    getTargetStatsPgUrl,
    loadEnv,
} = require('./lib/statsPgMigration.cjs');

async function main() {
    loadEnv();

    const targetUrl = getTargetStatsPgUrl();
    const clientGenerated = fs.existsSync(POSTGRES_CLIENT_PATH);

    console.log('[StatsPgDoctor] Target configured:', Boolean(targetUrl));
    console.log('[StatsPgDoctor] Postgres client generated:', clientGenerated);
    console.log('[StatsPgDoctor] Expected schema:', path.resolve(__dirname, '../prisma/stats-postgres.schema.prisma'));

    if (!targetUrl) {
        console.log('[StatsPgDoctor] Missing STATS_PG_DATABASE_URL');
        process.exit(1);
    }

    if (!clientGenerated) {
        console.log('[StatsPgDoctor] Missing generated PostgreSQL Prisma client');
        process.exit(1);
    }

    const target = createTargetClient(targetUrl);

    try {
        await target.$connect();
        await target.$queryRawUnsafe('SELECT 1');

        console.log('[StatsPgDoctor] Target connection: OK');

        for (const table of WORKLOAD_TABLES) {
            try {
                const count = await target[table.targetModel].count();
                console.log(`[StatsPgDoctor] ${table.label}: OK (${count} rows)`);
            } catch (error) {
                console.log(`[StatsPgDoctor] ${table.label}: MISSING_OR_INVALID`);
                throw error;
            }
        }
    } finally {
        await target.$disconnect();
    }
}

main().catch((error) => {
    console.error('[StatsPgDoctor] Failed:', error.message || error);
    process.exit(1);
});
