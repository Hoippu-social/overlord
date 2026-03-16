const {
    WORKLOAD_TABLES,
    createSourceClient,
    createTargetClient,
    fetchCount,
    getChunkSize,
    getSourceStatsUrl,
    getTargetStatsPgUrl,
    loadEnv,
    readBatch,
    syncSequence,
} = require('./lib/statsPgMigration.cjs');

function shouldSyncSequence(table) {
    return table.kind === 'int';
}

async function backfillTable(source, target, table, chunkSize) {
    let cursor = null;
    let inserted = 0;

    while (true) {
        const rows = await readBatch(source, table, cursor, chunkSize);
        if (rows.length === 0) break;

        await target[table.targetModel].createMany({
            data: rows,
            skipDuplicates: true,
        });

        inserted += rows.length;
        cursor = rows[rows.length - 1][table.primaryKey];
        console.log(`[StatsPgBackfill] ${table.label}: copied ${inserted}`);
    }

    if (shouldSyncSequence(table)) {
        await syncSequence(target, table.label);
    }

    return inserted;
}

async function main() {
    loadEnv();

    const sourceUrl = getSourceStatsUrl();
    const targetUrl = getTargetStatsPgUrl();
    const chunkSize = getChunkSize();

    if (!targetUrl) {
        throw new Error('STATS_PG_DATABASE_URL is not configured');
    }

    const source = createSourceClient(sourceUrl);
    const target = createTargetClient(targetUrl);

    try {
        await Promise.all([source.$connect(), target.$connect()]);

        for (const table of WORKLOAD_TABLES) {
            const sourceCount = await fetchCount(source, table.sourceModel);
            const targetBefore = await fetchCount(target, table.targetModel);
            console.log(`[StatsPgBackfill] ${table.label}: source=${sourceCount} targetBefore=${targetBefore}`);
            await backfillTable(source, target, table, chunkSize);
            const targetAfter = await fetchCount(target, table.targetModel);
            console.log(`[StatsPgBackfill] ${table.label}: targetAfter=${targetAfter}`);
        }
    } finally {
        await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
    }
}

main().catch((error) => {
    console.error('[StatsPgBackfill] Failed:', error);
    process.exit(1);
});
