import { PrismaClient } from '@prisma/client';
const statsPrisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/stats.db' } }});

async function run() {
    const rawCounts = await statsPrisma.$queryRaw`SELECT guildId, COUNT(*) as c FROM StatMessage GROUP BY guildId LIMIT 10`;
    console.log("Raw query counts:", rawCounts);
}
run();
