const {
    MAIN_WORKLOAD_TABLES,
    createSourceClient,
    createTargetClient,
    fetchCount,
    getChunkSize,
    getSourceMainUrl,
    getTargetMainPgUrl,
    loadEnv,
    readBatch,
    syncSequence,
} = require('./lib/mainPgMigration.cjs');

function shouldSyncSequence(table) {
    return table.kind === 'int';
}

async function backfillTable(source, target, table, chunkSize) {
    if (!source[table.sourceModel]) {
        console.log(`[MainPgBackfill] ${table.label}: skipped; source model is absent in SQLite snapshot`);
        return 0;
    }

    let cursor = null;
    let copied = 0;

    while (true) {
        const rows = await readBatch(source, table, cursor, chunkSize);
        if (rows.length === 0) break;

        await target[table.targetModel].createMany({
            data: rows,
            skipDuplicates: true,
        });

        copied += rows.length;
        cursor = rows[rows.length - 1][table.primaryKey];
        console.log(`[MainPgBackfill] ${table.label}: copied ${copied}`);
    }

    if (shouldSyncSequence(table)) {
        await syncSequence(target, table.label);
    }

    return copied;
}

async function main() {
    loadEnv();
    const sourceUrl = getSourceMainUrl();
    const targetUrl = getTargetMainPgUrl();
    const chunkSize = getChunkSize();

    if (!targetUrl) {
        throw new Error('MAIN_PG_DATABASE_URL or PostgreSQL DATABASE_URL is not configured');
    }

    const source = createSourceClient(sourceUrl);
    const target = createTargetClient(targetUrl);

    try {
        await Promise.all([source.$connect(), target.$connect()]);

        for (const table of MAIN_WORKLOAD_TABLES) {
            const sourceCount = await fetchCount(source, table.sourceModel);
            const targetBefore = await fetchCount(target, table.targetModel);
            console.log(`[MainPgBackfill] ${table.label}: source=${sourceCount} targetBefore=${targetBefore}`);
            await backfillTable(source, target, table, chunkSize);
            const targetAfter = await fetchCount(target, table.targetModel);
            console.log(`[MainPgBackfill] ${table.label}: targetAfter=${targetAfter}`);
        }
    } finally {
        await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
    }
}

main().catch((error) => {
    console.error('[MainPgBackfill] Failed:', error);
    process.exit(1);
});
