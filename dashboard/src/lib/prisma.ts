import { PrismaClient } from '@prisma/client';
import { PrismaClient as StatsPgPrismaClient } from '@/generated/stats-pg-client';

const globalForPrisma = global as unknown as { prisma: PrismaClient; statsPrisma: PrismaClient };

function requirePostgresUrl(name: string): string {
    const value = process.env[name];
    if (!value || !/^postgres(ql)?:\/\//i.test(value)) {
        throw new Error(`${name} must be configured as a PostgreSQL connection string`);
    }
    return value;
}

requirePostgresUrl('DATABASE_URL');
const statsPgUrl = requirePostgresUrl('STATS_PG_DATABASE_URL');

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    });

export const statsPrisma =
    globalForPrisma.statsPrisma ||
    (new StatsPgPrismaClient({
        datasources: {
            db: {
                url: statsPgUrl,
            },
        },
    }) as unknown as PrismaClient);

export const isStatsPostgres = true;

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
    globalForPrisma.statsPrisma = statsPrisma;
}
