import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient; statsPrisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        // Only log queries in development
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    });

export const statsPrisma =
    globalForPrisma.statsPrisma ||
    new PrismaClient({
        datasources: {
            db: {
                url: process.env.STATS_DATABASE_URL || 'file:D:/discord_bot/Dev/bot/prisma/stats.db',
            },
        },
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
    globalForPrisma.statsPrisma = statsPrisma;
}
