import { PrismaClient } from '@prisma/client';
import path from 'path';

const statsPrisma = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve('../bot/prisma/stats.db')}` } }
});

async function run() {
    const guildId = '1374115841855197184';
    const period = '30d';
    const now = new Date();
    const startDate = new Date();
    startDate.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log(`Checking for guild ${guildId} since ${startDate.toISOString()}...`);

    const count = await statsPrisma.statInteraction.count({
        where: { guildId, createdAt: { gte: startDate } }
    });
    console.log(`Count for 30d: ${count}`);

    const allCount = await statsPrisma.statInteraction.count({ where: { guildId } });
    console.log(`Total count for guild: ${allCount}`);
}

run().finally(() => statsPrisma.$disconnect());
