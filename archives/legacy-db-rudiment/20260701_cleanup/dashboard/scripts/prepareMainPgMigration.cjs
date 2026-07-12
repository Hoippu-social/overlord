const fs = require('fs');
const {
    MAIN_WORKLOAD_TABLES,
    SQLITE_SOURCE_CLIENT_PATH,
    buildTableChecksum,
    buildTableSummary,
    createSourceClient,
    getManifestPath,
    getSourceMainUrl,
    getTargetMainPgUrl,
    loadEnv,
} = require('./lib/mainPgMigration.cjs');

async function main() {
    loadEnv();
    const sourceUrl = getSourceMainUrl();
    const targetUrl = getTargetMainPgUrl();
    const source = createSourceClient(sourceUrl);

    try {
        await source.$connect();
        const tables = [];
        for (const table of MAIN_WORKLOAD_TABLES) {
            const summary = await buildTableSummary(source, table);
            const checksum = await buildTableChecksum(source, table, 1000);
            tables.push({ ...summary, checksum });
        }

        const manifest = {
            createdAt: new Date().toISOString(),
            sourceUrl,
            targetConfigured: Boolean(targetUrl),
            sqliteSourceClientGenerated: fs.existsSync(SQLITE_SOURCE_CLIENT_PATH),
            tables,
        };

        const manifestPath = getManifestPath('main_pg_prepare');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log('[MainPgPrepare] Source:', sourceUrl);
        console.log('[MainPgPrepare] Target configured:', Boolean(targetUrl));
        console.log('[MainPgPrepare] Manifest:', manifestPath);
        for (const entry of tables) {
            console.log(`[MainPgPrepare] ${entry.table}: count=${entry.count} maxId=${entry.maxId ?? '-'}`);
        }
    } finally {
        await source.$disconnect();
    }
}

main().catch((error) => {
    console.error('[MainPgPrepare] Failed:', error);
    process.exit(1);
});
