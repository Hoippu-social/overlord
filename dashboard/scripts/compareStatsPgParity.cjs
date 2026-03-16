const {
    WORKLOAD_TABLES,
    buildTableSummary,
    createSourceClient,
    createTargetClient,
    getSourceStatsUrl,
    getTargetStatsPgUrl,
    loadEnv,
} = require('./lib/statsPgMigration.cjs');

function toIsoOrNull(value) {
    return value ? new Date(value).toISOString() : null;
}

async function main() {
    loadEnv();

    const sourceUrl = getSourceStatsUrl();
    const targetUrl = getTargetStatsPgUrl();

    if (!targetUrl) {
        throw new Error('STATS_PG_DATABASE_URL is not configured');
    }

    const source = createSourceClient(sourceUrl);
    const target = createTargetClient(targetUrl);

    const mismatches = [];

    try {
        await Promise.all([source.$connect(), target.$connect()]);

        for (const table of WORKLOAD_TABLES) {
            const sourceSummary = await buildTableSummary(source, table);
            const targetSummary = await buildTableSummary(
                { [table.sourceModel]: target[table.targetModel] },
                { ...table, sourceModel: table.targetModel }
            );

            const sourceMin = toIsoOrNull(sourceSummary.minDate);
            const sourceMax = toIsoOrNull(sourceSummary.maxDate);
            const targetMin = toIsoOrNull(targetSummary.minDate);
            const targetMax = toIsoOrNull(targetSummary.maxDate);

            const same =
                sourceSummary.count === targetSummary.count &&
                sourceMin === targetMin &&
                sourceMax === targetMax;

            if (!same) {
                mismatches.push({
                    table: table.label,
                    source: { count: sourceSummary.count, minDate: sourceMin, maxDate: sourceMax },
                    target: { count: targetSummary.count, minDate: targetMin, maxDate: targetMax },
                });
            }

            console.log(
                `[StatsPgParity] ${table.label}: source=${sourceSummary.count}/${sourceMin || '-'}..${sourceMax || '-'} ` +
                `target=${targetSummary.count}/${targetMin || '-'}..${targetMax || '-'} ${same ? 'OK' : 'MISMATCH'}`
            );
        }
    } finally {
        await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
    }

    if (mismatches.length > 0) {
        console.error('[StatsPgParity] Mismatches found:');
        console.error(JSON.stringify(mismatches, null, 2));
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('[StatsPgParity] Failed:', error);
    process.exit(1);
});
