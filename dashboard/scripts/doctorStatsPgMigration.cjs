const fs = require('fs');
const {
    STATS_POSTGRES_CLIENT_PATH,
    getStatsPostgresUrl,
    loadEnv,
} = require('./lib/postgresOnly.cjs');

async function main() {
    loadEnv();

    const targetUrl = getStatsPostgresUrl();
    const clientGenerated = fs.existsSync(STATS_POSTGRES_CLIENT_PATH);

    console.log('[StatsPgDoctor] Target configured:', Boolean(targetUrl));
    console.log('[StatsPgDoctor] Postgres client generated:', clientGenerated);

    if (!targetUrl) {
        console.log('[StatsPgDoctor] Missing STATS_PG_DATABASE_URL');
        process.exit(1);
    }

    if (!clientGenerated) {
        console.log('[StatsPgDoctor] Missing generated PostgreSQL Prisma client');
        process.exit(1);
    }

    const { Prisma, PrismaClient } = require(STATS_POSTGRES_CLIENT_PATH);
    const target = new PrismaClient({
        datasources: {
            db: { url: targetUrl },
        },
    });

    try {
        await target.$connect();
        await target.$queryRawUnsafe('SELECT 1');

        console.log('[StatsPgDoctor] Target connection: OK');

        for (const model of Prisma.dmmf.datamodel.models) {
            const delegate = model.name[0].toLowerCase() + model.name.slice(1);
            if (!target[delegate]?.count) continue;
            const count = await target[delegate].count();
            console.log(`[StatsPgDoctor] ${model.name}: OK (${count} rows)`);
        }
    } finally {
        await target.$disconnect();
    }
}

main().catch((error) => {
    console.error('[StatsPgDoctor] Failed:', error.message || error);
    process.exit(1);
});
