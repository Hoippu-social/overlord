const {
    MAIN_WORKLOAD_TABLES,
    buildTableChecksum,
    buildTableSummary,
    createSourceClient,
    createTargetClient,
    getSourceMainUrl,
    getTargetMainPgUrl,
    loadEnv,
} = require('./lib/mainPgMigration.cjs');

function toIsoOrNull(value) {
    return value ? new Date(value).toISOString() : null;
}

async function main() {
    loadEnv();
    const sourceUrl = getSourceMainUrl();
    const targetUrl = getTargetMainPgUrl();
    if (!targetUrl) {
        throw new Error('MAIN_PG_DATABASE_URL or PostgreSQL DATABASE_URL is not configured');
    }

    const source = createSourceClient(sourceUrl);
    const target = createTargetClient(targetUrl);
    const mismatches = [];

    try {
        await Promise.all([source.$connect(), target.$connect()]);

        for (const table of MAIN_WORKLOAD_TABLES) {
            const sourceSummary = await buildTableSummary(source, table);
            const targetSummary = await buildTableSummary(
                { [table.sourceModel]: target[table.targetModel] },
                { ...table, sourceModel: table.targetModel }
            );

            const sourceChecksum = await buildTableChecksum(source, table, 1000);
            const targetChecksum = await buildTableChecksum(
                { [table.sourceModel]: target[table.targetModel] },
                { ...table, sourceModel: table.targetModel },
                1000
            );

            const same =
                sourceSummary.count === targetSummary.count &&
                sourceSummary.maxId === targetSummary.maxId &&
                toIsoOrNull(sourceSummary.minDate) === toIsoOrNull(targetSummary.minDate) &&
                toIsoOrNull(sourceSummary.maxDate) === toIsoOrNull(targetSummary.maxDate) &&
                sourceChecksum.sha256 === targetChecksum.sha256;

            if (!same) {
                mismatches.push({
                    table: table.label,
                    source: { ...sourceSummary, checksum: sourceChecksum },
                    target: { ...targetSummary, checksum: targetChecksum },
                });
            }

            console.log(
                `[MainPgParity] ${table.label}: source=${sourceSummary.count}/${sourceSummary.maxId ?? '-'} ` +
                `target=${targetSummary.count}/${targetSummary.maxId ?? '-'} ${same ? 'OK' : 'MISMATCH'}`
            );
        }
    } finally {
        await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
    }

    if (mismatches.length > 0) {
        console.error('[MainPgParity] Mismatches found:');
        console.error(JSON.stringify(mismatches, null, 2));
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('[MainPgParity] Failed:', error);
    process.exit(1);
});
