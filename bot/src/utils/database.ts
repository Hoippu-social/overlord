import { PrismaClient } from '@prisma/client';
import { PrismaClient as StatsPgPrismaClient } from '../generated/stats-pg-client';
import logger from './logger';

function requirePostgresUrl(name: string): string {
    const value = process.env[name];
    if (!value || !/^postgres(ql)?:\/\//i.test(value)) {
        throw new Error(`${name} must be configured as a PostgreSQL connection string`);
    }
    return value;
}

requirePostgresUrl('DATABASE_URL');
const statsPgUrl = requirePostgresUrl('STATS_PG_DATABASE_URL');

const prisma = new PrismaClient();

// Dedicated PostgreSQL statistics client. Alternative local file-backed fallbacks are intentionally forbidden.
const statsPrisma = new StatsPgPrismaClient({
    datasources: {
        db: {
            url: statsPgUrl,
        },
    },
}) as unknown as PrismaClient;

// Protects stats storage from accidental full-table deletes and raw DROP/TRUNCATE.
statsPrisma.$use(async (params, next) => {
    if (params.action === 'deleteMany') {
        const where = params.args?.where;
        const isEmpty = !where || Object.keys(where).length === 0;
        if (isEmpty) {
            const msg = `[DB SAFETY] deleteMany on ${params.model} without WHERE is FORBIDDEN on stats storage!`;
            logger.error(msg);
            throw new Error(msg);
        }
    }

    if (params.action === 'queryRaw' || params.action === 'executeRaw') {
        const query: string = String(params.args?.query || params.args?.[0] || '').toUpperCase();
        if (query.includes('DROP TABLE') || query.includes('TRUNCATE')) {
            const msg = `[DB SAFETY] DROP TABLE / TRUNCATE is FORBIDDEN on stats storage!`;
            logger.error(msg);
            throw new Error(msg);
        }
    }

    return next(params);
});

async function connectDB() {
    try {
        await prisma.$connect();
        await statsPrisma.$connect();
        logger.info('PostgreSQL databases connected successfully');
    } catch (error) {
        logger.error('Database connection failed', error);
        process.exit(1);
    }
}

export { prisma, statsPrisma, connectDB, requirePostgresUrl };
