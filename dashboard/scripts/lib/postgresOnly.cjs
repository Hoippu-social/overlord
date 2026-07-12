const path = require('path');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(ROOT_DIR, '..');
const BOT_ROOT = path.resolve(REPO_ROOT, 'bot');
const STATS_POSTGRES_CLIENT_PATH = path.resolve(ROOT_DIR, 'src/generated/stats-pg-client');

function loadEnv() {
    dotenv.config({ path: path.resolve(BOT_ROOT, '.env') });
    dotenv.config({ path: path.resolve(ROOT_DIR, '.env'), override: true });
}

function getArg(name) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
}

function assertPostgresUrl(value, name) {
    if (!value || !/^postgres(ql)?:\/\//i.test(value)) {
        throw new Error(`${name} must be a PostgreSQL URL`);
    }
    return value;
}

function getMainPostgresUrl() {
    const candidate = getArg('target') || process.env.MAIN_PG_DATABASE_URL || process.env.DATABASE_URL || '';
    return candidate ? assertPostgresUrl(candidate, 'MAIN_PG_DATABASE_URL or DATABASE_URL') : '';
}

function getStatsPostgresUrl() {
    const candidate = getArg('target') || process.env.STATS_PG_DATABASE_URL || '';
    return candidate ? assertPostgresUrl(candidate, 'STATS_PG_DATABASE_URL') : '';
}

module.exports = {
    BOT_ROOT,
    ROOT_DIR,
    STATS_POSTGRES_CLIENT_PATH,
    getMainPostgresUrl,
    getStatsPostgresUrl,
    loadEnv,
};
