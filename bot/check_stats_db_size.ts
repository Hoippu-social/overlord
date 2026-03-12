import { PrismaClient } from '@prisma/client';
// Use the stats Prisma Client
const statsPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/stats.db'
    }
  }
});

async function run() {
    const raw = await statsPrisma.statMessage.count({
        where: { guildId: '236471924660436992' }
    });
    console.log('Total raw messages in stats.db for guild:', raw);
    
    const d = new Date();
    d.setDate(d.getDate() - 90);
    const recent = await statsPrisma.statMessage.count({
        where: { guildId: '236471924660436992', createdAt: { gte: d } }
    });
    console.log('Recent 90d raw messages in stats.db for guild:', recent);
}
run();
