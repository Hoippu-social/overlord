const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    BOT_ROOT,
    MAIN_WORKLOAD_TABLES,
    buildTableChecksum,
    buildTableSummary,
    createSourceClient,
    getArchivePath,
    getSourceMainUrl,
    loadEnv,
} = require('./lib/mainPgMigration.cjs');
const {
    WORKLOAD_TABLES: STATS_WORKLOAD_TABLES,
    buildTableSummary: buildStatsTableSummary,
    createSourceClient: createStatsSourceClient,
    getSourceStatsUrl,
} = require('./lib/statsPgMigration.cjs');

function sha256File(filePath) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function copyIfExists(source, targetDir) {
    if (!fs.existsSync(source)) return null;
    const target = path.resolve(targetDir, path.basename(source));
    fs.copyFileSync(source, target);
    return {
        source,
        archivedAs: target,
        bytes: fs.statSync(source).size,
        sha256: sha256File(target),
    };
}

function sqliteSchemaDump(dbPath, outPath) {
    const candidates = [
        process.env.SQLITE_EXE,
        'sqlite3',
        'sqlite3.exe',
    ].filter(Boolean);

    for (const exe of candidates) {
        const result = spawnSync(exe, [dbPath, '.schema'], { encoding: 'utf8' });
        if (!result.error && result.status === 0) {
            fs.writeFileSync(outPath, result.stdout);
            return { ok: true, command: exe };
        }
    }

    fs.writeFileSync(outPath, '-- sqlite3 executable was not available; schema dump skipped.\n');
    return { ok: false, command: null };
}

async function summarizeMain(sourceUrl) {
    const client = createSourceClient(sourceUrl);
    const tables = [];
    try {
        await client.$connect();
        for (const table of MAIN_WORKLOAD_TABLES) {
            const summary = await buildTableSummary(client, table);
            const checksum = await buildTableChecksum(client, table, 1000);
            tables.push({ ...summary, checksum });
        }
    } finally {
        await client.$disconnect();
    }
    return tables;
}

async function summarizeStats(sourceUrl) {
    const client = createStatsSourceClient(sourceUrl);
    const tables = [];
    try {
        await client.$connect();
        for (const table of STATS_WORKLOAD_TABLES) {
            tables.push(await buildStatsTableSummary(client, table));
        }
    } finally {
        await client.$disconnect();
    }
    return tables;
}

async function main() {
    loadEnv();

    const archiveDir = getArchivePath();
    const dbDir = path.resolve(BOT_ROOT, 'prisma');
    const sqliteFiles = [
        'development.db',
        'dev.db',
        'development_pre_migration.db',
        'stats.db',
        'stats_pre_migration.db',
    ].map((name) => path.resolve(dbDir, name));

    const archivedFiles = sqliteFiles.map((file) => copyIfExists(file, archiveDir)).filter(Boolean);
    const schemaDumps = [];

    for (const item of archivedFiles) {
        const schemaPath = path.resolve(archiveDir, `${path.basename(item.archivedAs)}.schema.sql`);
        schemaDumps.push({
            db: item.archivedAs,
            schemaPath,
            ...sqliteSchemaDump(item.archivedAs, schemaPath),
        });
    }

    const mainSourceUrl = getSourceMainUrl();
    const statsSourceUrl = getSourceStatsUrl();
    const manifest = {
        createdAt: new Date().toISOString(),
        archiveDir,
        files: archivedFiles,
        schemaDumps,
        main: {
            sourceUrl: mainSourceUrl,
            tables: await summarizeMain(mainSourceUrl),
        },
        stats: {
            sourceUrl: statsSourceUrl,
            tables: await summarizeStats(statsSourceUrl),
        },
    };

    const manifestPath = path.resolve(archiveDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('[SqliteArchive] Archive:', archiveDir);
    console.log('[SqliteArchive] Manifest:', manifestPath);
    for (const file of archivedFiles) {
        console.log(`[SqliteArchive] ${path.basename(file.archivedAs)} ${file.bytes} bytes sha256=${file.sha256}`);
    }
}

main().catch((error) => {
    console.error('[SqliteArchive] Failed:', error);
    process.exit(1);
});
