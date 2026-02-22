import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prisma = new PrismaClient();

// Second Prisma client pointing to stats.db (Dual-DB Architecture)
const statsPrisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.STATS_DATABASE_URL || 'file:D:/discord_bot/Dev/bot/prisma/stats.db',
        },
    },
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
