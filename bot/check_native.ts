import { PrismaClient } from '@prisma/client';
const statsPrisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/stats.db' } }});

async function run() {
    const tables = await statsPrisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
    console.log("Tables in stats.db:", tables);
}
run();
