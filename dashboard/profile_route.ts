import { PrismaClient } from '@prisma/client';

const statsPrisma = new PrismaClient({
    datasources: { db: { url: 'file:D:/discord_bot/Dev/bot/prisma/stats.db' } }
});

async function run() {
    const guildId = '1374115841855197184';
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    console.time('Total');
    
    console.time('GroupBy 1');
    const [distinctChannelsObj, distinctMembersObj] = await Promise.all([
        statsPrisma.$queryRaw<{count: number}[]>`SELECT COUNT(DISTINCT channelId) as count FROM StatMessage WHERE guildId = ${guildId} AND createdAt >= ${startDate}`,
        statsPrisma.$queryRaw<{count: number}[]>`SELECT COUNT(DISTINCT authorId) as count FROM StatMessage WHERE guildId = ${guildId} AND createdAt >= ${startDate}`
    ]);
    console.timeEnd('GroupBy 1');

    console.time('Fetch Array');
    const daily = await statsPrisma.statDaily.findMany({
        where: { guildId, date: { gte: startDate } },
        orderBy: { date: 'asc' },
        select: { date: true, messages: true }
    });
    console.timeEnd('Fetch Array');
    
    console.timeEnd('Total');
}
run();
