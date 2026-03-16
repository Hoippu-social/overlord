const fs = require('fs');
const path = require('path');
const {
    WORKLOAD_TABLES,
    buildTableSummary,
    createSourceClient,
    getManifestPath,
    getSourceStatsUrl,
    getTargetStatsPgUrl,
    loadEnv,
    POSTGRES_CLIENT_PATH,
} = require('./lib/statsPgMigration.cjs');

async function main() {
    loadEnv();

    const sourceUrl = getSourceStatsUrl();
    const targetUrl = getTargetStatsPgUrl();
    const source = createSourceClient(sourceUrl);

    try {
        await source.$connect();

        const summaries = [];
        for (const table of WORKLOAD_TABLES) {
            summaries.push(await buildTableSummary(source, table));
        }

        const manifest = {
            createdAt: new Date().toISOString(),
            sourceUrl,
            targetConfigured: Boolean(targetUrl),
            postgresClientGenerated: fs.existsSync(POSTGRES_CLIENT_PATH),
            tables: summaries,
        };

        const manifestPath = getManifestPath('stats_pg_prepare');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        console.log('[StatsPgPrepare] Source:', sourceUrl);
        console.log('[StatsPgPrepare] Target configured:', Boolean(targetUrl));
        console.log('[StatsPgPrepare] Postgres client generated:', fs.existsSync(POSTGRES_CLIENT_PATH));
        console.log('[StatsPgPrepare] Manifest:', manifestPath);

        for (const entry of summaries) {
            console.log(
                `[StatsPgPrepare] ${entry.table}: count=${entry.count}` +
                (entry.minDate ? ` min=${new Date(entry.minDate).toISOString()}` : '') +
                (entry.maxDate ? ` max=${new Date(entry.maxDate).toISOString()}` : '')
            );
        }
    } finally {
        await source.$disconnect();
    }
}

main().catch((error) => {
    console.error('[StatsPgPrepare] Failed:', error);
    process.exit(1);
});
