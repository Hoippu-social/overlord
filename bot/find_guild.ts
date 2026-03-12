import { PrismaClient } from '@prisma/client';
const statsPrisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/stats.db' } }
});

async function run() {
    const guilds = await statsPrisma.statMessage.groupBy({
        by: ['guildId'],
        _count: { guildId: true }
    });
    console.log(guilds);
}
run();
