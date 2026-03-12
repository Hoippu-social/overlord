import { PrismaClient } from '@prisma/client';
const statsPrisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/stats.db' } }});

async function run() {
    const tables = await statsPrisma.$queryRawUnsafe<any[]>("SELECT name FROM sqlite_master WHERE type='table'");
    for (const t of tables) {
        const c = await statsPrisma.$queryRawUnsafe<any[]>(`SELECT count(*) as count FROM ${t.name}`);
        if (c[0].count > 0n) {
            console.log(t.name, c[0].count);
        }
    }
}
run();
