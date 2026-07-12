const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const FORBIDDEN_ENGINE = ['sql', 'ite'].join('');
const DB_SUFFIX = ['.', 'd', 'b'].join('');
const LEGACY_STATS_URL = ['STATS', 'DATABASE', 'URL'].join('_');
const LEGACY_STATS_PROVIDER = ['STATS', 'DB', 'PROVIDER'].join('_');

const SCAN_TARGETS = [
    'bot/src',
    'dashboard/src',
    'bot/prisma/schema.prisma',
    'dashboard/prisma/schema.prisma',
    'bot/package.json',
    'dashboard/package.json',
    'README.md',
    'dashboard/README.md',
    'start.bat',
    'start_bot.bat',
    'start_dashboard.bat',
    'dashboard/scripts',
    'bot/scripts',
    'docs',
    'bot/.env',
    'dashboard/.env',
];

const ALLOWED_PATH_PARTS = [
    'archives',
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    'src/generated',
];

const DISALLOWED = [
    new RegExp(`provider\\s*=\\s*"${FORBIDDEN_ENGINE}"`, 'i'),
    new RegExp(`file:[^\\s"']*\\${DB_SUFFIX}`, 'i'),
    new RegExp(`\\b${LEGACY_STATS_PROVIDER}\\b`, 'i'),
    new RegExp(`\\b${LEGACY_STATS_URL}\\b`, 'i'),
    new RegExp(`\\bstats\\${DB_SUFFIX}\\b`, 'i'),
    new RegExp(`\\bdevelopment\\${DB_SUFFIX}\\b`, 'i'),
    new RegExp(`\\bdev\\${DB_SUFFIX}\\b`, 'i'),
    new RegExp(`\\b${FORBIDDEN_ENGINE}_master\\b`, 'i'),
];

function isAllowed(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    return ALLOWED_PATH_PARTS.some((part) => normalized.includes(part.replace(/\\/g, '/')));
}

function walk(input, files = []) {
    if (!fs.existsSync(input)) return files;
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(input)) {
            walk(path.join(input, entry), files);
        }
        return files;
    }
    files.push(input);
    return files;
}

function main() {
    const offenders = [];
    for (const target of SCAN_TARGETS) {
        for (const file of walk(path.resolve(REPO_ROOT, target))) {
            if (isAllowed(file)) continue;
            const text = fs.readFileSync(file, 'utf8');
            for (const regex of DISALLOWED) {
                if (regex.test(text)) {
                    offenders.push({ file: path.relative(REPO_ROOT, file), pattern: String(regex) });
                }
            }
        }
    }

    if (offenders.length > 0) {
        console.error('[PostgresOnlyRuntime] Forbidden non-PostgreSQL runtime references found:');
        for (const offender of offenders) {
            console.error(`- ${offender.file}: ${offender.pattern}`);
        }
        process.exit(1);
    }

    console.log('[PostgresOnlyRuntime] OK: active runtime code is PostgreSQL-only.');
}

try {
    main();
} catch (error) {
    console.error('[PostgresOnlyRuntime] Failed:', error.message || error);
    process.exit(1);
}
