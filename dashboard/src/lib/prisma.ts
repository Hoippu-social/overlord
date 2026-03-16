import { PrismaClient } from '@prisma/client';
import { PrismaClient as StatsPgPrismaClient } from '@/generated/stats-pg-client';

const globalForPrisma = global as unknown as { prisma: PrismaClient; statsPrisma: PrismaClient };
const statsProvider = (process.env.STATS_DB_PROVIDER || 'sqlite').toLowerCase();
const isPostgresStatsProvider = ['postgres', 'postgresql', 'pg'].includes(statsProvider);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        // Only log queries in development
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    });

export const statsPrisma =
    globalForPrisma.statsPrisma ||
    (isPostgresStatsProvider
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

export const isStatsPostgres = isPostgresStatsProvider;

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
    globalForPrisma.statsPrisma = statsPrisma;
}
