import { PrismaClient } from '@prisma/client';
import { PrismaClient as StatsPgPrismaClient } from '../generated/stats-pg-client';
import logger from './logger';

const prisma = new PrismaClient();
const statsProvider = (process.env.STATS_DB_PROVIDER || 'sqlite').toLowerCase();
const usePostgresStats = ['postgres', 'postgresql', 'pg'].includes(statsProvider);

// Second Prisma client pointing to stats.db — single source of truth for all statistics
const statsPrisma = (usePostgresStats
    ? new StatsPgPrismaClient({
        datasources: {
            db: {
                url: process.env.STATS_PG_DATABASE_URL,
            },
        },
    })
    : new PrismaClient({
        datasources: {
            db: {
                url: process.env.STATS_DATABASE_URL || 'file:D:/discord_bot/Dev/bot/prisma/stats.db',
            },
        },
    })) as unknown as PrismaClient;

// ── Safety Middleware ────────────────────────────────────────────────────────
// Protects stats.db from accidental full-table deletes and raw DROP/TRUNCATE.
// This middleware runs BEFORE every query on statsPrisma.
statsPrisma.$use(async (params, next) => {
    // Block deleteMany without a WHERE clause
    if (params.action === 'deleteMany') {
        const where = params.args?.where;
        const isEmpty = !where || Object.keys(where).length === 0;
        if (isEmpty) {
            const msg = `[DB SAFETY] deleteMany on ${params.model} without WHERE is FORBIDDEN on stats storage!`;
            logger.error(msg);
            throw new Error(msg);
        }
    }

    // Block raw DROP TABLE / TRUNCATE
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
        logger.info('Database connected successfully');
    } catch (error) {
        logger.error('Database connection failed', error);
        process.exit(1);
    }
}

export { prisma, statsPrisma, connectDB };
