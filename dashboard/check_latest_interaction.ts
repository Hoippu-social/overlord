import { PrismaClient } from '@prisma/client';
import path from 'path';

const statsPrisma = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve('../bot/prisma/stats.db')}` } }
});

async function run() {
    const latest = await statsPrisma.statInteraction.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    console.log('Latest interaction:', latest);
}

run().finally(() => statsPrisma.$disconnect());
